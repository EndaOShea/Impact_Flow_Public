import express from 'express';
import { query } from '../config/database.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { logAudit } from '../utils/auth.js';

const router = express.Router();

// ============================================================================
// GET ALL REPORT SCHEDULES
// ============================================================================

router.get('/', requireAuth, async (req, res) => {
    try {
        const result = await query(
            `SELECT
                id, name, frequency, time,
                daily_scope, monthly_run_day, monthly_scope, monthly_rolling_value,
                custom_interval, week_days,
                range_start_offset, range_end_offset,
                recipients, active, created_at
             FROM report_schedules
             WHERE user_id = $1
             ORDER BY created_at DESC`,
            [req.user.id]
        );

        const schedules = result.rows.map(row => ({
            id: row.id,
            name: row.name,
            frequency: row.frequency,
            time: row.time,
            dailyScope: row.daily_scope,
            monthlyRunDay: row.monthly_run_day,
            monthlyScope: row.monthly_scope,
            monthlyRollingValue: row.monthly_rolling_value,
            customInterval: row.custom_interval,
            weekDays: row.week_days,
            rangeStartOffset: row.range_start_offset,
            rangeEndOffset: row.range_end_offset,
            recipients: row.recipients,
            active: row.active,
            createdAt: row.created_at
        }));

        res.json(schedules);
    } catch (error) {
        console.error('Get report schedules error:', error);
        res.status(500).json({ error: 'Failed to get report schedules' });
    }
});

// ============================================================================
// CREATE REPORT SCHEDULE
// ============================================================================

router.post('/', requireAuth, async (req, res) => {
    try {
        const {
            name, frequency, time,
            dailyScope, monthlyRunDay, monthlyScope, monthlyRollingValue,
            customInterval, weekDays,
            rangeStartOffset, rangeEndOffset,
            recipients, active
        } = req.body;

        if (!name || !frequency || !time) {
            return res.status(400).json({ error: 'Name, frequency, and time are required' });
        }

        const result = await query(
            `INSERT INTO report_schedules (
                user_id, name, frequency, time,
                daily_scope, monthly_run_day, monthly_scope, monthly_rolling_value,
                custom_interval, week_days,
                range_start_offset, range_end_offset,
                recipients, active
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
            RETURNING
                id, name, frequency, time,
                daily_scope, monthly_run_day, monthly_scope, monthly_rolling_value,
                custom_interval, week_days,
                range_start_offset, range_end_offset,
                recipients, active, created_at`,
            [
                req.user.id, name, frequency, time,
                dailyScope || null, monthlyRunDay || null, monthlyScope || null, monthlyRollingValue || null,
                customInterval || null, weekDays ? JSON.stringify(weekDays) : null,
                rangeStartOffset || 0, rangeEndOffset || 0,
                JSON.stringify(recipients || []), active !== false
            ]
        );

        const schedule = result.rows[0];

        await logAudit(req.user.id, 'REPORT_SCHEDULE_CREATED', 'report_schedule', schedule.id, { name }, req.ip, req.get('user-agent'));

        res.status(201).json({
            id: schedule.id,
            name: schedule.name,
            frequency: schedule.frequency,
            time: schedule.time,
            dailyScope: schedule.daily_scope,
            monthlyRunDay: schedule.monthly_run_day,
            monthlyScope: schedule.monthly_scope,
            monthlyRollingValue: schedule.monthly_rolling_value,
            customInterval: schedule.custom_interval,
            weekDays: schedule.week_days,
            rangeStartOffset: schedule.range_start_offset,
            rangeEndOffset: schedule.range_end_offset,
            recipients: schedule.recipients,
            active: schedule.active,
            createdAt: schedule.created_at
        });
    } catch (error) {
        console.error('Create report schedule error:', error);
        res.status(500).json({ error: 'Failed to create report schedule' });
    }
});

// ============================================================================
// DELETE REPORT SCHEDULE
// ============================================================================

router.delete('/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;

        const result = await query(
            'DELETE FROM report_schedules WHERE id = $1 AND user_id = $2 RETURNING id',
            [id, req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Report schedule not found' });
        }

        await logAudit(req.user.id, 'REPORT_SCHEDULE_DELETED', 'report_schedule', id, null, req.ip, req.get('user-agent'));

        res.json({ message: 'Report schedule deleted successfully' });
    } catch (error) {
        console.error('Delete report schedule error:', error);
        res.status(500).json({ error: 'Failed to delete report schedule' });
    }
});

export default router;
