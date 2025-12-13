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
