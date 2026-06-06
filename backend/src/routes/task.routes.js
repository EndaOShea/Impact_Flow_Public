import express from 'express';
import { query, transaction } from '../config/database.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { logAudit } from '../utils/auth.js';
import { validateFile, validateAttachmentCount } from '../utils/fileValidation.js';

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
                u_creator.avatar_initials as creator_initials,
                p.title as project_title
            FROM tasks t
            LEFT JOIN users u_creator ON t.creator_id = u_creator.id
            LEFT JOIN projects p ON t.project_id = p.id
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
            const [subtasks, deps, metrics, comments, attachments, activity, automations, blockers] = await Promise.all([
                query('SELECT * FROM subtasks WHERE task_id = $1 ORDER BY position', [task.id]),
                query('SELECT depends_on_task_id FROM task_dependencies WHERE task_id = $1', [task.id]),
                query('SELECT * FROM impact_metrics WHERE task_id = $1', [task.id]),
                query(`SELECT c.*, u.name as author_name, u.avatar_initials
                       FROM comments c JOIN users u ON c.author_id = u.id
                       WHERE c.task_id = $1 ORDER BY c.created_at DESC`, [task.id]),
                query('SELECT * FROM attachments WHERE task_id = $1 ORDER BY created_at DESC', [task.id]),
                query('SELECT * FROM activity_log WHERE task_id = $1 ORDER BY timestamp DESC LIMIT 20', [task.id]),
                query('SELECT * FROM automation_rules WHERE task_id = $1', [task.id]),
                query(`SELECT tb.*, tm.name as team_member_name
                       FROM task_blockers tb
                       JOIN team_members tm ON tb.team_member_id = tm.id
                       WHERE tb.task_id = $1
                       ORDER BY tb.created_at DESC`, [task.id])
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
                blockers: blockers.rows.map(b => ({
                    id: b.id,
                    taskId: b.task_id,
                    teamMemberId: b.team_member_id,
                    teamMemberName: b.team_member_name,
                    reason: b.reason,
                    createdAt: b.created_at,
                    resolvedAt: b.resolved_at
                })),
                creatorId: task.creator_id,
                projectId: task.project_id,
                projectTitle: task.project_title,
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
            `SELECT t.*, p.title as project_title
             FROM tasks t
             LEFT JOIN projects p ON t.project_id = p.id
             WHERE t.id = $1 AND t.creator_id = $2`,
            [id, user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Task not found' });
        }

        const task = result.rows[0];

        const [subtasks, deps, metrics, comments, attachments, activity, automations, blockers] = await Promise.all([
            query('SELECT * FROM subtasks WHERE task_id = $1 ORDER BY position', [id]),
            query('SELECT depends_on_task_id FROM task_dependencies WHERE task_id = $1', [id]),
            query('SELECT * FROM impact_metrics WHERE task_id = $1', [id]),
            query(`SELECT c.*, u.name as author_name FROM comments c JOIN users u ON c.author_id = u.id WHERE c.task_id = $1 ORDER BY c.created_at DESC`, [id]),
            query('SELECT * FROM attachments WHERE task_id = $1 ORDER BY created_at DESC', [id]),
            query('SELECT * FROM activity_log WHERE task_id = $1 ORDER BY timestamp DESC LIMIT 20', [id]),
            query('SELECT * FROM automation_rules WHERE task_id = $1', [id]),
            query(`SELECT tb.*, tm.name as team_member_name
                   FROM task_blockers tb
                   JOIN team_members tm ON tb.team_member_id = tm.id
                   WHERE tb.task_id = $1
                   ORDER BY tb.created_at DESC`, [id])
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
            blockers: blockers.rows.map(b => ({
                id: b.id,
                taskId: b.task_id,
                teamMemberId: b.team_member_id,
                teamMemberName: b.team_member_name,
                reason: b.reason,
                createdAt: b.created_at,
                resolvedAt: b.resolved_at
            })),
            creatorId: task.creator_id,
            projectId: task.project_id,
            projectTitle: task.project_title,
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
            projectId,
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

        // Validate dates
        if (startDate && dueDate) {
            const start = new Date(startDate);
            const due = new Date(dueDate);
            if (due < start) {
                return res.status(400).json({ error: 'Due date cannot be before start date' });
            }
        }

        // Validate task dates are within project dates
        if (projectId) {
            const projectResult = await query(
                'SELECT start_date, target_end_date FROM projects WHERE id = $1',
                [projectId]
            );

            if (projectResult.rows.length > 0) {
                const project = projectResult.rows[0];

                if (startDate && project.start_date) {
                    const taskStart = new Date(startDate);
                    const projStart = new Date(project.start_date);
                    if (taskStart < projStart) {
                        return res.status(400).json({
                            error: `Task start date cannot be before project start date (${projStart.toLocaleDateString()})`
                        });
                    }
                }

                if (dueDate && project.target_end_date) {
                    const taskDue = new Date(dueDate);
                    const projEnd = new Date(project.target_end_date);
                    if (taskDue > projEnd) {
                        return res.status(400).json({
                            error: `Task due date cannot be after project end date (${projEnd.toLocaleDateString()})`
                        });
                    }
                }
            }
        }

        const newTask = await transaction(async (client) => {
            const taskResult = await client.query(
                `INSERT INTO tasks (
                    title, description, status, priority, project_id,
                    start_date, due_date, is_recurring, recurrence_config,
                    creator_id, okrs, milestone,
                    before_scenario, after_scenario, impact_narrative, resource_links
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
                RETURNING *`,
                [
                    title.trim(),
                    description || '',
                    status || 'TODO',
                    priority || 'MEDIUM',
                    projectId || null,
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
            projectId,
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

        // Validate dates
        const finalStartDate = startDate !== undefined ? startDate : existingTask.start_date;
        const finalDueDate = dueDate !== undefined ? dueDate : existingTask.due_date;

        if (finalStartDate && finalDueDate) {
            const start = new Date(finalStartDate);
            const due = new Date(finalDueDate);
            if (due < start) {
                return res.status(400).json({ error: 'Due date cannot be before start date' });
            }
        }

        // Validate task dates are within project dates
        const finalProjectId = projectId !== undefined ? projectId : existingTask.project_id;
        if (finalProjectId) {
            const projectResult = await query(
                'SELECT start_date, target_end_date FROM projects WHERE id = $1',
                [finalProjectId]
            );

            if (projectResult.rows.length > 0) {
                const project = projectResult.rows[0];

                if (finalStartDate && project.start_date) {
                    const taskStart = new Date(finalStartDate);
                    const projStart = new Date(project.start_date);
                    if (taskStart < projStart) {
                        return res.status(400).json({
                            error: `Task start date cannot be before project start date (${projStart.toLocaleDateString()})`
                        });
                    }
                }

                if (finalDueDate && project.target_end_date) {
                    const taskDue = new Date(finalDueDate);
                    const projEnd = new Date(project.target_end_date);
                    if (taskDue > projEnd) {
                        return res.status(400).json({
                            error: `Task due date cannot be after project end date (${projEnd.toLocaleDateString()})`
                        });
                    }
                }
            }
        }

        // Update main task
        const result = await query(
            `UPDATE tasks SET
                title = COALESCE($1, title),
                description = COALESCE($2, description),
                status = COALESCE($3, status),
                priority = COALESCE($4, priority),
                project_id = $5,
                start_date = $6,
                due_date = $7,
                is_recurring = COALESCE($8, is_recurring),
                recurrence_config = $9,
                okrs = $10,
                milestone = COALESCE($11, milestone),
                before_scenario = $12,
                after_scenario = $13,
                impact_narrative = $14,
                resource_links = $15,
                completed_at = CASE
                    WHEN $3 = 'COMPLETED' AND status != 'COMPLETED' THEN NOW()
                    WHEN $3 != 'COMPLETED' THEN NULL
                    ELSE completed_at
                END,
                updated_at = NOW()
             WHERE id = $16
             RETURNING *`,
            [
                title,
                description,
                status,
                priority,
                projectId || null,
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
        const user = req.user;
        const { title, estimatedHours, category, notes, isMilestone, milestoneDescription } = req.body;

        if (!title) {
            return res.status(400).json({ error: 'Subtask title is required' });
        }

        // Verify the task exists and belongs to the authenticated user
        const taskCheck = await query(
            'SELECT id FROM tasks WHERE id = $1 AND creator_id = $2',
            [id, user.id]
        );
        if (taskCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Task not found' });
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
        const { id, subtaskId } = req.params;
        const user = req.user;
        const { title, completed, hoursSpent, estimatedHours, category, notes, isMilestone, milestoneDescription } = req.body;

        // Verify the subtask belongs to a task owned by the authenticated user
        const ownerCheck = await query(
            `SELECT s.id FROM subtasks s
             JOIN tasks t ON t.id = s.task_id
             WHERE s.id = $1 AND t.id = $2 AND t.creator_id = $3`,
            [subtaskId, id, user.id]
        );
        if (ownerCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Subtask not found' });
        }

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
        const { id, subtaskId } = req.params;
        const user = req.user;

        // Verify the subtask belongs to a task owned by the authenticated user
        const ownerCheck = await query(
            `SELECT s.id FROM subtasks s
             JOIN tasks t ON t.id = s.task_id
             WHERE s.id = $1 AND t.id = $2 AND t.creator_id = $3`,
            [subtaskId, id, user.id]
        );
        if (ownerCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Subtask not found' });
        }

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

        // Verify the task exists and belongs to the authenticated user
        const taskCheck = await query(
            'SELECT id FROM tasks WHERE id = $1 AND creator_id = $2',
            [id, user.id]
        );
        if (taskCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Task not found' });
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

        // Verify task exists and user has access
        const taskCheck = await query(
            'SELECT id FROM tasks WHERE id = $1 AND creator_id = $2',
            [id, user.id]
        );

        if (taskCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Task not found' });
        }

        // Check current attachment count
        const countResult = await query(
            'SELECT COUNT(*) as count FROM attachments WHERE task_id = $1',
            [id]
        );
        const currentCount = parseInt(countResult.rows[0].count);

        const countValidation = validateAttachmentCount(currentCount, 1);
        if (!countValidation.valid) {
            return res.status(400).json({ error: countValidation.error });
        }

        // Validate file
        const fileValidation = validateFile({ name, type, url, size });
        if (!fileValidation.valid) {
            return res.status(400).json({ error: fileValidation.error });
        }

        // Use sanitized filename if provided
        const finalName = fileValidation.sanitizedName || name;

        const result = await query(
            `INSERT INTO attachments (task_id, name, type, url, size, uploaded_by)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [id, finalName, type, url, size, user.id]
        );

        await logAudit(user.id, 'ATTACHMENT_ADDED', 'attachment', result.rows[0].id, { taskId: id, fileName: finalName }, req.ip, req.get('user-agent'));

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Add attachment error:', error);
        res.status(500).json({ error: 'Failed to add attachment' });
    }
});

router.delete('/:id/attachments/:attachmentId', async (req, res) => {
    try {
        const { id, attachmentId } = req.params;
        const user = req.user;

        // Verify the attachment belongs to a task owned by the user
        const attachmentCheck = await query(
            `SELECT a.id, a.name FROM attachments a
             JOIN tasks t ON a.task_id = t.id
             WHERE a.id = $1 AND t.id = $2 AND t.creator_id = $3`,
            [attachmentId, id, user.id]
        );

        if (attachmentCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Attachment not found' });
        }

        await query('DELETE FROM attachments WHERE id = $1', [attachmentId]);

        await logAudit(user.id, 'ATTACHMENT_DELETED', 'attachment', attachmentId, { taskId: id, fileName: attachmentCheck.rows[0].name }, req.ip, req.get('user-agent'));

        res.json({ message: 'Attachment deleted successfully' });
    } catch (error) {
        console.error('Delete attachment error:', error);
        res.status(500).json({ error: 'Failed to delete attachment' });
    }
});

// ============================================================================
// BLOCKER ROUTES
// ============================================================================

// Add a blocker to a task
router.post('/:id/blockers', async (req, res) => {
    try {
        const { id } = req.params;
        const { teamMemberId, reason } = req.body;
        const user = req.user;

        if (!teamMemberId) {
            return res.status(400).json({ error: 'Team member ID is required' });
        }

        // Verify task exists and user has access
        const taskCheck = await query(
            'SELECT id, project_id FROM tasks WHERE id = $1 AND creator_id = $2',
            [id, user.id]
        );

        if (taskCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Task not found' });
        }

        const task = taskCheck.rows[0];

        // Verify team member exists and belongs to the same project
        const memberCheck = await query(
            'SELECT id, name FROM team_members WHERE id = $1 AND project_id = $2',
            [teamMemberId, task.project_id]
        );

        if (memberCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Team member not found or does not belong to this project' });
        }

        const member = memberCheck.rows[0];

        // Check if blocker already exists
        const existingBlocker = await query(
            'SELECT id FROM task_blockers WHERE task_id = $1 AND team_member_id = $2 AND resolved_at IS NULL',
            [id, teamMemberId]
        );

        if (existingBlocker.rows.length > 0) {
            return res.status(400).json({ error: 'This team member is already a blocker for this task' });
        }

        const result = await query(
            `INSERT INTO task_blockers (task_id, team_member_id, reason)
             VALUES ($1, $2, $3)
             RETURNING *`,
            [id, teamMemberId, reason || null]
        );

        const blocker = {
            ...result.rows[0],
            teamMemberName: member.name
        };

        await logAudit(user.id, 'BLOCKER_ADDED', 'task_blocker', result.rows[0].id, { taskId: id, teamMemberId, teamMemberName: member.name }, req.ip, req.get('user-agent'));

        res.status(201).json(blocker);
    } catch (error) {
        console.error('Add blocker error:', error);
        res.status(500).json({ error: 'Failed to add blocker' });
    }
});

// Remove a blocker from a task
router.delete('/:id/blockers/:blockerId', async (req, res) => {
    try {
        const { id, blockerId } = req.params;
        const user = req.user;

        // Verify the blocker belongs to a task owned by the user
        const blockerCheck = await query(
            `SELECT tb.id, tm.name as team_member_name
             FROM task_blockers tb
             JOIN tasks t ON tb.task_id = t.id
             JOIN team_members tm ON tb.team_member_id = tm.id
             WHERE tb.id = $1 AND t.id = $2 AND t.creator_id = $3`,
            [blockerId, id, user.id]
        );

        if (blockerCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Blocker not found' });
        }

        const blocker = blockerCheck.rows[0];

        await query('DELETE FROM task_blockers WHERE id = $1', [blockerId]);

        await logAudit(user.id, 'BLOCKER_REMOVED', 'task_blocker', blockerId, { taskId: id, teamMemberName: blocker.team_member_name }, req.ip, req.get('user-agent'));

        res.json({ message: 'Blocker removed successfully' });
    } catch (error) {
        console.error('Remove blocker error:', error);
        res.status(500).json({ error: 'Failed to remove blocker' });
    }
});

// Mark a blocker as resolved
router.put('/:id/blockers/:blockerId/resolve', async (req, res) => {
    try {
        const { id, blockerId } = req.params;
        const user = req.user;

        // Verify the blocker belongs to a task owned by the user
        const blockerCheck = await query(
            `SELECT tb.id, tm.name as team_member_name
             FROM task_blockers tb
             JOIN tasks t ON tb.task_id = t.id
             JOIN team_members tm ON tb.team_member_id = tm.id
             WHERE tb.id = $1 AND t.id = $2 AND t.creator_id = $3`,
            [blockerId, id, user.id]
        );

        if (blockerCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Blocker not found' });
        }

        const blocker = blockerCheck.rows[0];

        const result = await query(
            `UPDATE task_blockers
             SET resolved_at = NOW()
             WHERE id = $1
             RETURNING *`,
            [blockerId]
        );

        await logAudit(user.id, 'BLOCKER_RESOLVED', 'task_blocker', blockerId, { taskId: id, teamMemberName: blocker.team_member_name }, req.ip, req.get('user-agent'));

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Resolve blocker error:', error);
        res.status(500).json({ error: 'Failed to resolve blocker' });
    }
});

export default router;
