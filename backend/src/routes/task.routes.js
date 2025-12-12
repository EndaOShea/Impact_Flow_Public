import express from 'express';
import { query, transaction } from '../config/database.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { logAudit } from '../utils/auth.js';

const router = express.Router();

// All task routes require authentication
router.use(requireAuth);

// ============================================================================
// GET ALL TASKS
// ============================================================================

router.get('/', async (req, res) => {
    try {
        const { status, priority } = req.query;
        const user = req.user;

        let tasksQuery = `
            SELECT t.*,
                u_creator.name as creator_name,
                u_creator.avatar_initials as creator_initials
            FROM tasks t
            LEFT JOIN users u_creator ON t.creator_id = u_creator.id
            WHERE t.creator_id = $1
        `;

        const params = [user.id];
        let paramIndex = 2;

        if (status) {
            tasksQuery += ` AND t.status = $${paramIndex}`;
            params.push(status);
            paramIndex++;
        }

        if (priority) {
            tasksQuery += ` AND t.priority = $${paramIndex}`;
            params.push(priority);
            paramIndex++;
        }

        tasksQuery += ` ORDER BY t.created_at DESC`;

        const result = await query(tasksQuery, params);

        // Fetch subtasks, dependencies, and other nested data for each task
        const tasks = await Promise.all(result.rows.map(async (task) => {
            const [subtasks, deps, metrics, comments, attachments, activity, automations] = await Promise.all([
                query('SELECT * FROM subtasks WHERE task_id = $1 ORDER BY position', [task.id]),
                query('SELECT depends_on_task_id FROM task_dependencies WHERE task_id = $1', [task.id]),
                query('SELECT * FROM impact_metrics WHERE task_id = $1', [task.id]),
                query(`SELECT c.*, u.name as author_name, u.avatar_initials
                       FROM comments c JOIN users u ON c.author_id = u.id
                       WHERE c.task_id = $1 ORDER BY c.created_at DESC`, [task.id]),
                query('SELECT * FROM attachments WHERE task_id = $1 ORDER BY created_at DESC', [task.id]),
                query('SELECT * FROM activity_log WHERE task_id = $1 ORDER BY timestamp DESC LIMIT 20', [task.id]),
                query('SELECT * FROM automation_rules WHERE task_id = $1', [task.id])
            ]);

            return {
                ...task,
                subtasks: subtasks.rows.map(s => ({
                    ...s,
                    hoursSpent: parseFloat(s.hours_spent) || 0,
                    estimatedHours: parseFloat(s.estimated_hours) || 0,
                    isMilestone: s.is_milestone,
                    milestoneDescription: s.milestone_description
                })),
                dependencyIds: deps.rows.map(r => r.depends_on_task_id),
                impactMetrics: metrics.rows.map(m => ({
                    ...m,
                    achievedValue: parseFloat(m.achieved_value) || 0,
                    value: parseFloat(m.value) || 0
                })),
                comments: comments.rows.map(c => ({
                    ...c,
                    authorId: c.author_id,
                    createdAt: c.created_at
                })),
                attachments: attachments.rows.map(a => ({
                    ...a,
                    createdAt: a.created_at
                })),
                activityLog: activity.rows.map(a => ({
                    ...a,
                    userId: a.user_id,
                    userName: a.user_name
                })),
                automations: automations.rows,
                creatorId: task.creator_id,
                startDate: task.start_date,
                dueDate: task.due_date,
                isRecurring: task.is_recurring,
                recurrenceConfig: task.recurrence_config,
                okrAlignment: task.okrs?.[0] || '',
                beforeScenario: task.before_scenario,
                afterScenario: task.after_scenario,
                impactNarrative: task.impact_narrative,
                resourceLinks: task.resource_links || [],
                createdAt: task.created_at,
                completedAt: task.completed_at
            };
        }));

        res.json(tasks);
    } catch (error) {
        console.error('Get tasks error:', error);
        res.status(500).json({ error: 'Failed to fetch tasks' });
    }
});

// ============================================================================
// GET SINGLE TASK
// ============================================================================

router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const user = req.user;

        const result = await query(
            `SELECT t.* FROM tasks t WHERE t.id = $1 AND t.creator_id = $2`,
            [id, user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Task not found' });
        }

        const task = result.rows[0];

        const [subtasks, deps, metrics, comments, attachments, activity, automations] = await Promise.all([
            query('SELECT * FROM subtasks WHERE task_id = $1 ORDER BY position', [id]),
            query('SELECT depends_on_task_id FROM task_dependencies WHERE task_id = $1', [id]),
            query('SELECT * FROM impact_metrics WHERE task_id = $1', [id]),
            query(`SELECT c.*, u.name as author_name FROM comments c JOIN users u ON c.author_id = u.id WHERE c.task_id = $1 ORDER BY c.created_at DESC`, [id]),
            query('SELECT * FROM attachments WHERE task_id = $1 ORDER BY created_at DESC', [id]),
            query('SELECT * FROM activity_log WHERE task_id = $1 ORDER BY timestamp DESC LIMIT 20', [id]),
            query('SELECT * FROM automation_rules WHERE task_id = $1', [id])
        ]);

        const fullTask = {
            ...task,
            subtasks: subtasks.rows,
            dependencyIds: deps.rows.map(r => r.depends_on_task_id),
            impactMetrics: metrics.rows,
            comments: comments.rows,
            attachments: attachments.rows,
            activityLog: activity.rows,
            automations: automations.rows,
            creatorId: task.creator_id,
            startDate: task.start_date,
            dueDate: task.due_date,
            isRecurring: task.is_recurring,
            recurrenceConfig: task.recurrence_config,
            okrAlignment: task.okrs?.[0] || '',
            beforeScenario: task.before_scenario,
            afterScenario: task.after_scenario,
            impactNarrative: task.impact_narrative,
            resourceLinks: task.resource_links || [],
            createdAt: task.created_at,
            completedAt: task.completed_at
        };

        res.json(fullTask);
    } catch (error) {
        console.error('Get task error:', error);
        res.status(500).json({ error: 'Failed to fetch task' });
    }
});

// ============================================================================
// CREATE TASK
// ============================================================================

router.post('/', async (req, res) => {
    try {
        const user = req.user;
        const {
            title,
            description,
            status,
            priority,
            startDate,
            dueDate,
            isRecurring,
            recurrenceConfig,
            dependencyIds,
            subtasks,
            impactMetrics,
            automations,
            okrs,
            milestone,
            beforeScenario,
            afterScenario,
            impactNarrative,
            resourceLinks
        } = req.body;

        if (!title || title.trim().length === 0) {
            return res.status(400).json({ error: 'Title is required' });
        }

        const newTask = await transaction(async (client) => {
            const taskResult = await client.query(
                `INSERT INTO tasks (
                    title, description, status, priority,
                    start_date, due_date, is_recurring, recurrence_config,
                    creator_id, okrs, milestone,
                    before_scenario, after_scenario, impact_narrative, resource_links
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
                RETURNING *`,
                [
                    title.trim(),
                    description || '',
                    status || 'TODO',
                    priority || 'MEDIUM',
                    startDate || null,
                    dueDate || null,
                    isRecurring || false,
                    recurrenceConfig ? JSON.stringify(recurrenceConfig) : null,
                    user.id,
                    okrs ? JSON.stringify(okrs) : '[]',
                    milestone || false,
                    beforeScenario || null,
                    afterScenario || null,
                    impactNarrative || null,
                    resourceLinks ? JSON.stringify(resourceLinks) : '[]'
                ]
            );

            const task = taskResult.rows[0];

            // Add dependencies
            if (dependencyIds && dependencyIds.length > 0) {
                for (const depId of dependencyIds) {
                    await client.query(
                        'INSERT INTO task_dependencies (task_id, depends_on_task_id) VALUES ($1, $2)',
                        [task.id, depId]
                    );
                }
            }

            // Add subtasks
            if (subtasks && subtasks.length > 0) {
                for (let i = 0; i < subtasks.length; i++) {
                    const st = subtasks[i];
                    await client.query(
                        `INSERT INTO subtasks (
                            task_id, title, completed, hours_spent, estimated_hours,
                            category, notes, is_milestone, milestone_description, position
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
                        [
                            task.id,
                            st.title,
                            st.completed || false,
                            st.hoursSpent || 0,
                            st.estimatedHours || 0,
                            st.category || 'Development',
                            st.notes || '',
                            st.isMilestone || false,
                            st.milestoneDescription || null,
                            i
                        ]
                    );
                }
            }

            // Add impact metrics
            if (impactMetrics && impactMetrics.length > 0) {
                for (const metric of impactMetrics) {
                    await client.query(
                        `INSERT INTO impact_metrics (
                            task_id, type, value, achieved_value, currency, description
                        ) VALUES ($1, $2, $3, $4, $5, $6)`,
                        [
                            task.id,
                            metric.type,
                            metric.value,
                            metric.achievedValue || 0,
                            metric.currency || 'USD',
                            metric.description || ''
                        ]
                    );
                }
            }

            // Add automations
            if (automations && automations.length > 0) {
                for (const auto of automations) {
                    await client.query(
                        `INSERT INTO automation_rules (task_id, trigger, action, active)
                         VALUES ($1, $2, $3, $4)`,
                        [task.id, auto.trigger, auto.action, auto.active]
                    );
                }
            }

            // Activity log
            await client.query(
                `INSERT INTO activity_log (task_id, user_id, user_name, action)
                 VALUES ($1, $2, $3, $4)`,
                [task.id, user.id, user.name, 'Created task']
            );

            return task;
        });

        await logAudit(user.id, 'TASK_CREATED', 'task', newTask.id, { title }, req.ip, req.get('user-agent'));

        res.status(201).json(newTask);
    } catch (error) {
        console.error('Create task error:', error);
        res.status(500).json({ error: 'Failed to create task' });
    }
});

// ============================================================================
// UPDATE TASK
// ============================================================================

router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const user = req.user;

        const accessCheck = await query(
            `SELECT t.* FROM tasks t WHERE t.id = $1 AND t.creator_id = $2`,
            [id, user.id]
        );

        if (accessCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Task not found' });
        }

        const existingTask = accessCheck.rows[0];

        const {
            title,
            description,
            status,
            priority,
            startDate,
            dueDate,
            isRecurring,
            recurrenceConfig,
            okrs,
            milestone,
            beforeScenario,
            afterScenario,
            impactNarrative,
            resourceLinks,
            subtasks,
            impactMetrics,
            dependencyIds,
            comments,
            attachments
        } = req.body;

        // Update main task
        const result = await query(
            `UPDATE tasks SET
                title = COALESCE($1, title),
                description = COALESCE($2, description),
                status = COALESCE($3, status),
                priority = COALESCE($4, priority),
                start_date = $5,
                due_date = $6,
                is_recurring = COALESCE($7, is_recurring),
                recurrence_config = $8,
                okrs = $9,
                milestone = COALESCE($10, milestone),
                before_scenario = $11,
                after_scenario = $12,
                impact_narrative = $13,
                resource_links = $14,
                completed_at = CASE
                    WHEN $3 = 'COMPLETED' AND status != 'COMPLETED' THEN NOW()
                    WHEN $3 != 'COMPLETED' THEN NULL
                    ELSE completed_at
                END,
                updated_at = NOW()
             WHERE id = $15
             RETURNING *`,
            [
                title,
                description,
                status,
                priority,
                startDate || null,
                dueDate || null,
                isRecurring,
                recurrenceConfig ? JSON.stringify(recurrenceConfig) : null,
                okrs ? JSON.stringify(okrs) : '[]',
                milestone,
                beforeScenario || null,
                afterScenario || null,
                impactNarrative || null,
                resourceLinks ? JSON.stringify(resourceLinks) : '[]',
                id
            ]
        );

        // Update subtasks if provided
        if (subtasks !== undefined) {
            // Delete existing subtasks
            await query('DELETE FROM subtasks WHERE task_id = $1', [id]);

            // Insert new subtasks
            if (subtasks && subtasks.length > 0) {
                for (let i = 0; i < subtasks.length; i++) {
                    const st = subtasks[i];
                    await query(
                        `INSERT INTO subtasks (
                            task_id, title, completed, hours_spent, estimated_hours,
                            category, notes, is_milestone, milestone_description, position
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
                        [
                            id,
                            st.title,
                            st.completed || false,
                            st.hoursSpent || 0,
                            st.estimatedHours || 0,
                            st.category || 'Development',
                            st.notes || '',
                            st.isMilestone || false,
                            st.milestoneDescription || null,
                            i
                        ]
                    );
                }
            }
        }

        // Update impact metrics if provided
        if (impactMetrics !== undefined) {
            await query('DELETE FROM impact_metrics WHERE task_id = $1', [id]);

            if (impactMetrics && impactMetrics.length > 0) {
                for (const metric of impactMetrics) {
                    await query(
                        `INSERT INTO impact_metrics (
                            task_id, type, value, achieved_value, currency, description
                        ) VALUES ($1, $2, $3, $4, $5, $6)`,
                        [
                            id,
                            metric.type,
                            metric.value,
                            metric.achievedValue || 0,
                            metric.currency || 'USD',
                            metric.description || ''
                        ]
                    );
                }
            }
        }

        // Update dependencies if provided
        if (dependencyIds !== undefined) {
            await query('DELETE FROM task_dependencies WHERE task_id = $1', [id]);

            if (dependencyIds && dependencyIds.length > 0) {
                for (const depId of dependencyIds) {
                    await query(
                        'INSERT INTO task_dependencies (task_id, depends_on_task_id) VALUES ($1, $2)',
                        [id, depId]
                    );
                }
            }
        }

        // Activity log if status changed
        if (status && status !== existingTask.status) {
            await query(
                `INSERT INTO activity_log (task_id, user_id, user_name, action)
                 VALUES ($1, $2, $3, $4)`,
                [id, user.id, user.name, `Changed status to ${status}`]
            );
        }

        await logAudit(user.id, 'TASK_UPDATED', 'task', id, { changes: Object.keys(req.body) }, req.ip, req.get('user-agent'));

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Update task error:', error);
        res.status(500).json({ error: 'Failed to update task' });
    }
});

// ============================================================================
// DELETE TASK
// ============================================================================

router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const user = req.user;

        const taskCheck = await query(
            'SELECT title FROM tasks WHERE id = $1 AND creator_id = $2',
            [id, user.id]
        );

        if (taskCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Task not found' });
        }

        const taskTitle = taskCheck.rows[0].title;

        await query('DELETE FROM tasks WHERE id = $1', [id]);

        await logAudit(user.id, 'TASK_DELETED', 'task', id, { title: taskTitle }, req.ip, req.get('user-agent'));

        res.json({ message: 'Task deleted successfully' });
    } catch (error) {
        console.error('Delete task error:', error);
        res.status(500).json({ error: 'Failed to delete task' });
    }
});

// ============================================================================
// SUBTASK ROUTES
// ============================================================================

router.post('/:id/subtasks', async (req, res) => {
    try {
        const { id } = req.params;
        const { title, estimatedHours, category, notes, isMilestone, milestoneDescription } = req.body;

        if (!title) {
            return res.status(400).json({ error: 'Subtask title is required' });
        }

        const posResult = await query(
            'SELECT COALESCE(MAX(position), -1) + 1 as next_pos FROM subtasks WHERE task_id = $1',
            [id]
        );

        const position = posResult.rows[0].next_pos;

        const result = await query(
            `INSERT INTO subtasks (
                task_id, title, estimated_hours, category, notes,
                is_milestone, milestone_description, position
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *`,
            [
                id,
                title,
                estimatedHours || 0,
                category || 'Development',
                notes || '',
                isMilestone || false,
                milestoneDescription || null,
                position
            ]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Add subtask error:', error);
        res.status(500).json({ error: 'Failed to add subtask' });
    }
});

router.put('/:id/subtasks/:subtaskId', async (req, res) => {
    try {
        const { subtaskId } = req.params;
        const { title, completed, hoursSpent, estimatedHours, category, notes, isMilestone, milestoneDescription } = req.body;

        const result = await query(
            `UPDATE subtasks SET
                title = COALESCE($1, title),
                completed = COALESCE($2, completed),
                hours_spent = COALESCE($3, hours_spent),
                estimated_hours = COALESCE($4, estimated_hours),
                category = COALESCE($5, category),
                notes = COALESCE($6, notes),
                is_milestone = COALESCE($7, is_milestone),
                milestone_description = COALESCE($8, milestone_description),
                updated_at = NOW()
             WHERE id = $9
             RETURNING *`,
            [title, completed, hoursSpent, estimatedHours, category, notes, isMilestone, milestoneDescription, subtaskId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Subtask not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Update subtask error:', error);
        res.status(500).json({ error: 'Failed to update subtask' });
    }
});

router.delete('/:id/subtasks/:subtaskId', async (req, res) => {
    try {
        const { subtaskId } = req.params;

        const result = await query('DELETE FROM subtasks WHERE id = $1 RETURNING title', [subtaskId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Subtask not found' });
        }

        res.json({ message: 'Subtask deleted successfully' });
    } catch (error) {
        console.error('Delete subtask error:', error);
        res.status(500).json({ error: 'Failed to delete subtask' });
    }
});

// ============================================================================
// COMMENT ROUTES
// ============================================================================

router.post('/:id/comments', async (req, res) => {
    try {
        const { id } = req.params;
        const { text } = req.body;
        const user = req.user;

        if (!text || text.trim().length === 0) {
            return res.status(400).json({ error: 'Comment text is required' });
        }

        const result = await query(
            `INSERT INTO comments (task_id, author_id, text)
             VALUES ($1, $2, $3)
             RETURNING *`,
            [id, user.id, text.trim()]
        );

        const comment = {
            ...result.rows[0],
            author_name: user.name,
            avatar_initials: user.avatarInitials
        };

        res.status(201).json(comment);
    } catch (error) {
        console.error('Add comment error:', error);
        res.status(500).json({ error: 'Failed to add comment' });
    }
});

// ============================================================================
// ATTACHMENT ROUTES
// ============================================================================

router.post('/:id/attachments', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, type, url, size } = req.body;
        const user = req.user;

        if (!name || !url) {
            return res.status(400).json({ error: 'Attachment name and URL are required' });
        }

        const result = await query(
            `INSERT INTO attachments (task_id, name, type, url, size, uploaded_by)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [id, name, type || 'application/octet-stream', url, size || 0, user.id]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Add attachment error:', error);
        res.status(500).json({ error: 'Failed to add attachment' });
    }
});

router.delete('/:id/attachments/:attachmentId', async (req, res) => {
    try {
        const { attachmentId } = req.params;

        await query('DELETE FROM attachments WHERE id = $1', [attachmentId]);

        res.json({ message: 'Attachment deleted successfully' });
    } catch (error) {
        console.error('Delete attachment error:', error);
        res.status(500).json({ error: 'Failed to delete attachment' });
    }
});

export default router;
