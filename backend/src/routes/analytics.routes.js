import express from 'express';
import { query } from '../config/database.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const router = express.Router();

// ============================================================================
// TRACK EVENT
// ============================================================================

router.post('/track', requireAuth, async (req, res) => {
    try {
        const { eventType, eventCategory, eventData } = req.body;

        if (!eventType || !eventCategory) {
            return res.status(400).json({ error: 'eventType and eventCategory are required' });
        }

        await query(
            `INSERT INTO usage_analytics (user_id, event_type, event_category, event_data, ip_address, user_agent)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [
                req.user.id,
                eventType,
                eventCategory,
                eventData ? JSON.stringify(eventData) : null,
                req.ip,
                req.get('user-agent')
            ]
        );

        res.json({ success: true });
    } catch (error) {
        console.error('Analytics tracking error:', error);
        res.status(500).json({ error: 'Failed to track event' });
    }
});

// ============================================================================
// GET USER ANALYTICS
// ============================================================================

router.get('/user/summary', requireAuth, async (req, res) => {
    try {
        const { days = 30 } = req.query;

        // Get daily summary for last N days
        const dailyStats = await query(
            `SELECT date, tasks_created, tasks_completed, tasks_updated, logins,
                    session_duration_minutes, views_count, reports_generated
             FROM daily_usage_summary
             WHERE user_id = $1 AND date >= CURRENT_DATE - $2
             ORDER BY date DESC`,
            [req.user.id, parseInt(days)]
        );

        // Get event breakdown
        const eventBreakdown = await query(
            `SELECT event_category, event_type, COUNT(*) as count
             FROM usage_analytics
             WHERE user_id = $1 AND timestamp >= NOW() - INTERVAL '${parseInt(days)} days'
             GROUP BY event_category, event_type
             ORDER BY count DESC
             LIMIT 20`,
            [req.user.id]
        );

        // Get total stats
        const totalStats = await query(
            `SELECT
                COUNT(*) FILTER (WHERE event_type = 'task_created') as total_tasks_created,
                COUNT(*) FILTER (WHERE event_type = 'task_completed') as total_tasks_completed,
                COUNT(*) FILTER (WHERE event_type = 'login') as total_logins,
                COUNT(*) FILTER (WHERE event_category = 'navigation') as total_views
             FROM usage_analytics
             WHERE user_id = $1`,
            [req.user.id]
        );

        res.json({
            dailyStats: dailyStats.rows,
            eventBreakdown: eventBreakdown.rows,
            totalStats: totalStats.rows[0]
        });
    } catch (error) {
        console.error('Get analytics error:', error);
        res.status(500).json({ error: 'Failed to get analytics' });
    }
});

// ============================================================================
// GET RECENT ACTIVITY
// ============================================================================

router.get('/user/activity', requireAuth, async (req, res) => {
    try {
        const { limit = 50 } = req.query;

        const activity = await query(
            `SELECT event_type, event_category, event_data, timestamp
             FROM usage_analytics
             WHERE user_id = $1
             ORDER BY timestamp DESC
             LIMIT $2`,
            [req.user.id, parseInt(limit)]
        );

        res.json({ activity: activity.rows });
    } catch (error) {
        console.error('Get activity error:', error);
        res.status(500).json({ error: 'Failed to get activity' });
    }
});

// ============================================================================
// GET SYSTEM METRICS (Overall stats)
// ============================================================================

router.get('/system/metrics', requireAuth, async (req, res) => {
    try {
        const { days = 30 } = req.query;

        const metrics = await query(
            `SELECT metric_date, total_users, active_users, total_tasks,
                    tasks_created_today, tasks_completed_today,
                    avg_session_duration_minutes, total_logins
             FROM system_metrics
             WHERE metric_date >= CURRENT_DATE - $1
             ORDER BY metric_date DESC`,
            [parseInt(days)]
        );

        // Get current counts
        const currentStats = await query(
            `SELECT
                (SELECT COUNT(*) FROM users) as total_users,
                (SELECT COUNT(*) FROM tasks) as total_tasks,
                (SELECT COUNT(*) FROM tasks WHERE created_at::date = CURRENT_DATE) as tasks_today,
                (SELECT COUNT(*) FROM tasks WHERE status = 'COMPLETED' AND completed_at::date = CURRENT_DATE) as completed_today,
                (SELECT COUNT(DISTINCT user_id) FROM sessions WHERE created_at::date = CURRENT_DATE) as active_users_today`
        );

        res.json({
            historical: metrics.rows,
            current: currentStats.rows[0]
        });
    } catch (error) {
        console.error('Get system metrics error:', error);
        res.status(500).json({ error: 'Failed to get system metrics' });
    }
});

// ============================================================================
// GET SYSTEM HEALTH & STATS (Admin dashboard)
// ============================================================================

router.get('/system/health', requireAuth, async (req, res) => {
    try {
        const startTime = Date.now();

        // Get database health
        const dbHealth = await query('SELECT NOW() as db_time');
        const dbResponseTime = Date.now() - startTime;

        // Get total users
        const usersResult = await query('SELECT COUNT(*) as total FROM users');
        const totalUsers = parseInt(usersResult.rows[0].total);

        // Get active sessions (logged in users)
        const sessionsResult = await query(
            'SELECT COUNT(*) as active FROM sessions WHERE expires_at > NOW()'
        );
        const activeSessions = parseInt(sessionsResult.rows[0].active);

        // Get today's stats
        const todayStats = await query(`
            SELECT
                COUNT(*) FILTER (WHERE event_category = 'navigation') as page_views,
                COUNT(*) FILTER (WHERE event_type = 'login') as logins,
                COUNT(DISTINCT user_id) as active_users
            FROM usage_analytics
            WHERE timestamp >= CURRENT_DATE
        `);

        // Get total analytics events (all-time visits)
        const totalVisits = await query('SELECT COUNT(*) as total FROM usage_analytics');

        // Get last 7 days activity
        const weeklyActivity = await query(`
            SELECT
                DATE(timestamp) as date,
                COUNT(*) as events,
                COUNT(DISTINCT user_id) as unique_users
            FROM usage_analytics
            WHERE timestamp >= CURRENT_DATE - INTERVAL '7 days'
            GROUP BY DATE(timestamp)
            ORDER BY date DESC
        `);

        // Get top events in last 24 hours
        const topEvents = await query(`
            SELECT
                event_type,
                COUNT(*) as count
            FROM usage_analytics
            WHERE timestamp >= NOW() - INTERVAL '24 hours'
            GROUP BY event_type
            ORDER BY count DESC
            LIMIT 10
        `);

        res.json({
            health: {
                status: 'healthy',
                uptime: process.uptime(),
                uptimeFormatted: formatUptime(process.uptime()),
                dbResponseTime,
                timestamp: new Date().toISOString()
            },
            users: {
                total: totalUsers,
                activeSessions: activeSessions,
                activeToday: parseInt(todayStats.rows[0].active_users) || 0
            },
            activity: {
                pageViewsToday: parseInt(todayStats.rows[0].page_views) || 0,
                loginsToday: parseInt(todayStats.rows[0].logins) || 0,
                totalVisitsAllTime: parseInt(totalVisits.rows[0].total) || 0,
                weeklyActivity: weeklyActivity.rows,
                topEvents: topEvents.rows
            },
            memory: {
                used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
                total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
                unit: 'MB'
            }
        });
    } catch (error) {
        console.error('System health check error:', error);
        res.status(500).json({
            health: {
                status: 'unhealthy',
                error: error.message
            }
        });
    }
});

// Helper function to format uptime
function formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);

    return parts.join(' ') || '< 1m';
}

// ============================================================================
// GET TEMPORAL METRICS (Workload, velocity, time to completion, failed deadlines)
// ============================================================================

router.get('/temporal-metrics', requireAuth, async (req, res) => {
    try {
        const { granularity = 'monthly', months = 12 } = req.query;

        // Validate granularity
        const validGranularities = ['daily', 'weekly', 'monthly'];
        if (!validGranularities.includes(granularity)) {
            return res.status(400).json({ error: 'Invalid granularity. Must be daily, weekly, or monthly' });
        }

        // Calculate date range
        const monthsBack = parseInt(months) || 12;
        const endDate = new Date();
        const startDate = new Date();
        startDate.setMonth(startDate.getMonth() - monthsBack);

        // Determine date format and interval for generate_series
        let dateFormat, seriesInterval, dateTrunc;
        if (granularity === 'daily') {
            dateFormat = 'YYYY-MM-DD';
            seriesInterval = '1 day';
            dateTrunc = 'day';
        } else if (granularity === 'weekly') {
            dateFormat = 'YYYY-"W"IW';
            seriesInterval = '1 week';
            dateTrunc = 'week';
        } else {
            dateFormat = 'Mon YYYY';
            seriesInterval = '1 month';
            dateTrunc = 'month';
        }

        // Query 1: Workload Over Time (tasks in progress during each period)
        const workloadQuery = `
            WITH date_series AS (
                SELECT generate_series(
                    DATE_TRUNC($3, $1::timestamp),
                    DATE_TRUNC($3, $2::timestamp),
                    $4::interval
                ) AS period_start
            ),
            workload_data AS (
                SELECT
                    ds.period_start,
                    COUNT(DISTINCT t.id) AS workload
                FROM date_series ds
                LEFT JOIN tasks t ON
                    t.creator_id = $5
                    AND t.start_date IS NOT NULL
                    AND t.start_date <= ds.period_start
                    AND (
                        t.completed_at IS NULL OR
                        DATE_TRUNC($3, t.completed_at) > ds.period_start
                    )
                    AND t.status IN ('IN_PROGRESS', 'REVIEW')
                GROUP BY ds.period_start
            )
            SELECT
                TO_CHAR(period_start, $6) AS date,
                COALESCE(workload, 0) AS workload
            FROM workload_data
            ORDER BY period_start;
        `;

        // Query 2: Completion Velocity (tasks completed per period)
        const velocityQuery = `
            WITH date_series AS (
                SELECT generate_series(
                    DATE_TRUNC($3, $1::timestamp),
                    DATE_TRUNC($3, $2::timestamp),
                    $4::interval
                ) AS period_start
            ),
            completed_data AS (
                SELECT
                    DATE_TRUNC($3, t.completed_at) AS period_start,
                    COUNT(*) AS completion_count
                FROM tasks t
                WHERE t.creator_id = $5
                  AND t.status = 'COMPLETED'
                  AND t.completed_at IS NOT NULL
                  AND t.completed_at >= $1
                  AND t.completed_at <= $2
                GROUP BY DATE_TRUNC($3, t.completed_at)
            )
            SELECT
                TO_CHAR(ds.period_start, $6) AS date,
                COALESCE(cd.completion_count, 0) AS completion_velocity
            FROM date_series ds
            LEFT JOIN completed_data cd ON ds.period_start = cd.period_start
            ORDER BY ds.period_start;
        `;

        // Query 3: Time to Completion (average hours from start to completion)
        const timeToCompletionQuery = `
            WITH date_series AS (
                SELECT generate_series(
                    DATE_TRUNC($3, $1::timestamp),
                    DATE_TRUNC($3, $2::timestamp),
                    $4::interval
                ) AS period_start
            ),
            task_durations AS (
                SELECT
                    DATE_TRUNC($3, t.completed_at) AS period_start,
                    t.id,
                    COALESCE(
                        (SELECT SUM(s.hours_spent)
                         FROM subtasks s
                         WHERE s.task_id = t.id),
                        0
                    ) AS total_hours
                FROM tasks t
                WHERE t.creator_id = $5
                  AND t.status = 'COMPLETED'
                  AND t.completed_at IS NOT NULL
                  AND t.start_date IS NOT NULL
                  AND t.completed_at >= $1
                  AND t.completed_at <= $2
            ),
            avg_durations AS (
                SELECT
                    period_start,
                    AVG(total_hours) AS avg_hours,
                    COUNT(*) AS task_count
                FROM task_durations
                WHERE total_hours > 0
                GROUP BY period_start
            )
            SELECT
                TO_CHAR(ds.period_start, $6) AS date,
                COALESCE(ROUND(ad.avg_hours::numeric, 1), 0) AS avg_time_to_completion
            FROM date_series ds
            LEFT JOIN avg_durations ad ON ds.period_start = ad.period_start
            ORDER BY ds.period_start;
        `;

        // Query 4: Failed/Missed Deadlines (tasks that became overdue or failed)
        const failedDeadlinesQuery = `
            WITH date_series AS (
                SELECT generate_series(
                    DATE_TRUNC($3, $1::timestamp),
                    DATE_TRUNC($3, $2::timestamp),
                    $4::interval
                ) AS period_start
            ),
            failed_data AS (
                SELECT
                    DATE_TRUNC($3, al.timestamp) AS period_start,
                    COUNT(DISTINCT al.task_id) AS failed_count
                FROM activity_log al
                JOIN tasks t ON al.task_id = t.id
                WHERE t.creator_id = $5
                  AND (
                      al.action LIKE '%OVERDUE%' OR
                      al.action LIKE '%FAILED%'
                  )
                  AND al.timestamp >= $1
                  AND al.timestamp <= $2
                GROUP BY DATE_TRUNC($3, al.timestamp)
            )
            SELECT
                TO_CHAR(ds.period_start, $6) AS date,
                COALESCE(fd.failed_count, 0) AS failed_deadlines
            FROM date_series ds
            LEFT JOIN failed_data fd ON ds.period_start = fd.period_start
            ORDER BY ds.period_start;
        `;

        // Execute all queries in parallel
        const [workloadResult, velocityResult, timeToCompletionResult, failedDeadlinesResult] = await Promise.all([
            query(workloadQuery, [startDate, endDate, dateTrunc, seriesInterval, req.user.id, dateFormat]),
            query(velocityQuery, [startDate, endDate, dateTrunc, seriesInterval, req.user.id, dateFormat]),
            query(timeToCompletionQuery, [startDate, endDate, dateTrunc, seriesInterval, req.user.id, dateFormat]),
            query(failedDeadlinesQuery, [startDate, endDate, dateTrunc, seriesInterval, req.user.id, dateFormat])
        ]);

        // Combine results by date
        const metricsMap = new Map();

        // Initialize with all dates from workload query
        workloadResult.rows.forEach(row => {
            metricsMap.set(row.date, {
                date: row.date,
                workload: parseInt(row.workload) || 0,
                completionVelocity: 0,
                avgTimeToCompletion: 0,
                failedDeadlines: 0
            });
        });

        // Merge velocity data
        velocityResult.rows.forEach(row => {
            const existing = metricsMap.get(row.date);
            if (existing) {
                existing.completionVelocity = parseInt(row.completion_velocity) || 0;
            }
        });

        // Merge time to completion data
        timeToCompletionResult.rows.forEach(row => {
            const existing = metricsMap.get(row.date);
            if (existing) {
                existing.avgTimeToCompletion = parseFloat(row.avg_time_to_completion) || 0;
            }
        });

        // Merge failed deadlines data
        failedDeadlinesResult.rows.forEach(row => {
            const existing = metricsMap.get(row.date);
            if (existing) {
                existing.failedDeadlines = parseInt(row.failed_deadlines) || 0;
            }
        });

        // Convert map to array
        const metrics = Array.from(metricsMap.values());

        // Calculate summary statistics
        const summary = {
            totalCompleted: metrics.reduce((sum, m) => sum + m.completionVelocity, 0),
            totalFailed: metrics.reduce((sum, m) => sum + m.failedDeadlines, 0),
            avgWorkload: metrics.length > 0
                ? parseFloat((metrics.reduce((sum, m) => sum + m.workload, 0) / metrics.length).toFixed(1))
                : 0,
            avgCompletionTime: metrics.length > 0
                ? parseFloat((metrics.reduce((sum, m) => sum + m.avgTimeToCompletion, 0) / metrics.filter(m => m.avgTimeToCompletion > 0).length || 0).toFixed(1))
                : 0
        };

        res.json({ metrics, summary });
    } catch (error) {
        console.error('Get temporal metrics error:', error);
        res.status(500).json({ error: 'Failed to get temporal metrics' });
    }
});

// ============================================================================
// UPDATE DAILY SUMMARY (Background job helper)
// ============================================================================

export const updateDailySummary = async (userId, date = new Date()) => {
    try {
        const dateStr = date.toISOString().split('T')[0];

        // Count events for the day
        const events = await query(
            `SELECT
                COUNT(*) FILTER (WHERE event_type = 'task_created') as tasks_created,
                COUNT(*) FILTER (WHERE event_type = 'task_completed') as tasks_completed,
                COUNT(*) FILTER (WHERE event_type = 'task_updated') as tasks_updated,
                COUNT(*) FILTER (WHERE event_type = 'login') as logins,
                COUNT(*) FILTER (WHERE event_category = 'navigation') as views,
                COUNT(*) FILTER (WHERE event_type = 'report_generated') as reports
             FROM usage_analytics
             WHERE user_id = $1 AND DATE(timestamp) = $2`,
            [userId, dateStr]
        );

        const stats = events.rows[0];

        // Upsert daily summary
        await query(
            `INSERT INTO daily_usage_summary
                (user_id, date, tasks_created, tasks_completed, tasks_updated, logins, views_count, reports_generated)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             ON CONFLICT (user_id, date)
             DO UPDATE SET
                tasks_created = EXCLUDED.tasks_created,
                tasks_completed = EXCLUDED.tasks_completed,
                tasks_updated = EXCLUDED.tasks_updated,
                logins = EXCLUDED.logins,
                views_count = EXCLUDED.views_count,
                reports_generated = EXCLUDED.reports_generated`,
            [
                userId,
                dateStr,
                parseInt(stats.tasks_created) || 0,
                parseInt(stats.tasks_completed) || 0,
                parseInt(stats.tasks_updated) || 0,
                parseInt(stats.logins) || 0,
                parseInt(stats.views) || 0,
                parseInt(stats.reports) || 0
            ]
        );
    } catch (error) {
        console.error('Update daily summary error:', error);
    }
};

export default router;
