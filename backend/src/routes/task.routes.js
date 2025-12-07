import express from 'express';
import { query, transaction } from '../config/database.js';
import { requireAuth, requireOrganization } from '../middleware/auth.middleware.js';
import { logAudit } from '../utils/auth.js';

const router = express.Router();

// All task routes require authentication and organization membership
router.use(requireAuth);
router.use(requireOrganization);

// ============================================================================
// GET ALL TASKS (with filtering based on user role)
// ============================================================================

router.get('/', async (req, res) => {
    try {
        const { status, priority, assigneeId, teamId } = req.query;
        const user = req.user;

        let tasksQuery = `
            SELECT
                t.*,
                json_agg(DISTINCT jsonb_build_object(
                    'id', u_assignee.id,
                    'name', u_assignee.name,
                    'avatarInitials', u_assignee.avatar_initials
                )) FILTER (WHERE u_assignee.id IS NOT NULL) as assignees,
                json_agg(DISTINCT jsonb_build_object(
                    'id', u_admin.id,
                    'name', u_admin.name
                )) FILTER (WHERE u_admin.id IS NOT NULL) as admins,
                u_creator.name as creator_name,
                u_creator.avatar_initials as creator_initials,
                team.name as team_name,
                team.color as team_color
            FROM tasks t
            LEFT JOIN task_assignees ta ON t.id = ta.task_id
            LEFT JOIN users u_assignee ON ta.user_id = u_assignee.id
            LEFT JOIN task_admins tad ON t.id = tad.task_id
            LEFT JOIN users u_admin ON tad.user_id = u_admin.id
            LEFT JOIN users u_creator ON t.creator_id = u_creator.id
            LEFT JOIN teams team ON t.assigned_team_id = team.id
            WHERE t.organization_id = $1
        `;

        const params = [user.organizationId];
        let paramIndex = 2;

        // Apply role-based filtering
        if (user.role === 'USER' || user.role === 'TEAM_ADMIN') {
            // Users only see tasks they're involved with
            tasksQuery += ` AND (
                t.creator_id = $${paramIndex}
                OR EXISTS (SELECT 1 FROM task_assignees WHERE task_id = t.id AND user_id = $${paramIndex})
                OR EXISTS (SELECT 1 FROM task_admins WHERE task_id = t.id AND user_id = $${paramIndex})
            )`;
            params.push(user.id);
            paramIndex++;
        }
        // OWNER and ADMIN see all org tasks (no additional filter)

        // Apply optional filters
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

        if (assigneeId) {
            tasksQuery += ` AND EXISTS (SELECT 1 FROM task_assignees WHERE task_id = t.id AND user_id = $${paramIndex})`;
            params.push(assigneeId);
            paramIndex++;
        }

        if (teamId) {
            tasksQuery += ` AND t.assigned_team_id = $${paramIndex}`;
            params.push(teamId);
            paramIndex++;
        }

        tasksQuery += ` GROUP BY t.id, u_creator.name, u_creator.avatar_initials, team.name, team.color
                        ORDER BY t.created_at DESC`;

        const result = await query(tasksQuery, params);

        // Fetch subtasks, dependencies, and other nested data for each task
        const tasks = await Promise.all(result.rows.map(async (task) => {
            // Get subtasks
            const subtasksResult = await query(
                'SELECT * FROM subtasks WHERE task_id = $1 ORDER BY position',
                [task.id]
            );

            // Get dependencies
            const depsResult = await query(
                'SELECT depends_on_task_id FROM task_dependencies WHERE task_id = $1',
                [task.id]
            );

            // Get impact metrics
            const metricsResult = await query(
                'SELECT * FROM impact_metrics WHERE task_id = $1',
                [task.id]
            );

            // Get comments
            const commentsResult = await query(
                `SELECT c.*, u.name as author_name, u.avatar_initials
                 FROM comments c
                 JOIN users u ON c.author_id = u.id
                 WHERE c.task_id = $1
                 ORDER BY c.created_at DESC`,
                [task.id]
            );

            // Get attachments
            const attachmentsResult = await query(
                'SELECT * FROM attachments WHERE task_id = $1 ORDER BY created_at DESC',
                [task.id]
            );

            // Get activity log
            const activityResult = await query(
                'SELECT * FROM activity_log WHERE task_id = $1 ORDER BY timestamp DESC LIMIT 20',
                [task.id]
            );

            // Get automations
            const automationsResult = await query(
                'SELECT * FROM automation_rules WHERE task_id = $1',
                [task.id]
            );

            return {
                ...task,
                subtasks: subtasksResult.rows,
                dependencyIds: depsResult.rows.map(r => r.depends_on_task_id),
                impactMetrics: metricsResult.rows,
                comments: commentsResult.rows,
                attachments: attachmentsResult.rows,
                activityLog: activityResult.rows,
                automations: automationsResult.rows,
                assigneeIds: task.assignees ? task.assignees.map(a => a.id) : [],
                adminIds: task.admins ? task.admins.map(a => a.id) : []
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
            `SELECT t.* FROM tasks t WHERE t.id = $1 AND t.organization_id = $2`,
            [id, user.organizationId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Task not found' });
        }

        const task = result.rows[0];

        // Check access rights for non-admin users
        if (user.role !== 'OWNER' && user.role !== 'ADMIN') {
            const accessCheck = await query(
                `SELECT 1 FROM tasks t
                 WHERE t.id = $1 AND (
                     t.creator_id = $2
                     OR EXISTS (SELECT 1 FROM task_assignees WHERE task_id = t.id AND user_id = $2)
                     OR EXISTS (SELECT 1 FROM task_admins WHERE task_id = t.id AND user_id = $2)
                 )`,
                [id, user.id]
            );

            if (accessCheck.rows.length === 0) {
                return res.status(403).json({ error: 'Access denied to this task' });
            }
        }

        // Fetch all related data (same as in list)
        const [subtasks, deps, metrics, comments, attachments, activity, automations, assignees, admins] = await Promise.all([
            query('SELECT * FROM subtasks WHERE task_id = $1 ORDER BY position', [id]),
            query('SELECT depends_on_task_id FROM task_dependencies WHERE task_id = $1', [id]),
            query('SELECT * FROM impact_metrics WHERE task_id = $1', [id]),
            query(`SELECT c.*, u.name as author_name FROM comments c JOIN users u ON c.author_id = u.id WHERE c.task_id = $1 ORDER BY c.created_at DESC`, [id]),
            query('SELECT * FROM attachments WHERE task_id = $1 ORDER BY created_at DESC', [id]),
            query('SELECT * FROM activity_log WHERE task_id = $1 ORDER BY timestamp DESC LIMIT 20', [id]),
            query('SELECT * FROM automation_rules WHERE task_id = $1', [id]),
            query('SELECT u.id, u.name, u.avatar_initials FROM task_assignees ta JOIN users u ON ta.user_id = u.id WHERE ta.task_id = $1', [id]),
            query('SELECT u.id, u.name FROM task_admins tad JOIN users u ON tad.user_id = u.id WHERE tad.task_id = $1', [id])
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
            assigneeIds: assignees.rows.map(a => a.id),
            assignees: assignees.rows,
            adminIds: admins.rows.map(a => a.id),
            admins: admins.rows
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
            assigneeIds,
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
            resourceLinks,
            diagramCode,
            assignedTeamId
        } = req.body;

        // Validation
        if (!title || title.trim().length === 0) {
            return res.status(400).json({ error: 'Title is required' });
        }

        // Create task with transaction
        const newTask = await transaction(async (client) => {
            // Insert main task
            const taskResult = await client.query(
                `INSERT INTO tasks (
                    organization_id, title, description, status, priority,
                    start_date, due_date, is_recurring, recurrence_config,
                    creator_id, assigned_team_id, diagram_code, okrs, milestone,
                    before_scenario, after_scenario, impact_narrative, resource_links
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
                RETURNING *`,
                [
                    user.organizationId,
                    title.trim(),
                    description || '',
                    status || 'TODO',
                    priority || 'MEDIUM',
                    startDate || null,
                    dueDate || null,
                    isRecurring || false,
                    recurrenceConfig ? JSON.stringify(recurrenceConfig) : null,
                    user.id,
                    assignedTeamId || null,
                    diagramCode || null,
                    okrs ? JSON.stringify(okrs) : '[]',
                    milestone || false,
                    beforeScenario || null,
                    afterScenario || null,
                    impactNarrative || null,
                    resourceLinks ? JSON.stringify(resourceLinks) : '[]'
                ]
            );

            const task = taskResult.rows[0];

            // Add creator as admin
            await client.query(
                'INSERT INTO task_admins (task_id, user_id) VALUES ($1, $2)',
                [task.id, user.id]
            );

            // Add assignees
            if (assigneeIds && assigneeIds.length > 0) {
                for (const assigneeId of assigneeIds) {
                    await client.query(
                        'INSERT INTO task_assignees (task_id, user_id) VALUES ($1, $2)',
                        [task.id, assigneeId]
                    );
                }
            }

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

        // Audit log
        await logAudit(
            user.id,
            user.organizationId,
            'TASK_CREATED',
            'task',
            newTask.id,
            { title },
            req.ip,
            req.get('user-agent')
        );

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

        // Check task exists and user has access
        const accessCheck = await query(
            `SELECT t.* FROM tasks t
             WHERE t.id = $1 AND t.organization_id = $2`,
            [id, user.organizationId]
        );

        if (accessCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Task not found' });
        }

        const existingTask = accessCheck.rows[0];

        // Check permissions (admins or task admins can edit)
        if (user.role !== 'OWNER' && user.role !== 'ADMIN') {
            const isTaskAdmin = await query(
                'SELECT 1 FROM task_admins WHERE task_id = $1 AND user_id = $2',
                [id, user.id]
            );

            if (isTaskAdmin.rows.length === 0) {
                return res.status(403).json({ error: 'Only task admins can edit this task' });
            }
        }

        const {
            title,
            description,
            status,
            priority,
            startDate,
            dueDate,
            isRecurring,
            recurrenceConfig,
            diagramCode,
            okrs,
            milestone,
            beforeScenario,
            afterScenario,
            impactNarrative,
            resourceLinks,
            assignedTeamId
        } = req.body;

        // Update task
        const result = await query(
            `UPDATE tasks SET
                title = COALESCE($1, title),
                description = COALESCE($2, description),
                status = COALESCE($3, status),
                priority = COALESCE($4, priority),
                start_date = COALESCE($5, start_date),
                due_date = COALESCE($6, due_date),
                is_recurring = COALESCE($7, is_recurring),
                recurrence_config = COALESCE($8, recurrence_config),
                diagram_code = COALESCE($9, diagram_code),
                okrs = COALESCE($10, okrs),
                milestone = COALESCE($11, milestone),
                before_scenario = COALESCE($12, before_scenario),
                after_scenario = COALESCE($13, after_scenario),
                impact_narrative = COALESCE($14, impact_narrative),
                resource_links = COALESCE($15, resource_links),
                assigned_team_id = COALESCE($16, assigned_team_id),
                completed_at = CASE
                    WHEN $3 = 'COMPLETED' AND status != 'COMPLETED' THEN NOW()
                    WHEN $3 != 'COMPLETED' THEN NULL
                    ELSE completed_at
                END,
                updated_at = NOW()
             WHERE id = $17
             RETURNING *`,
            [
                title,
                description,
                status,
                priority,
                startDate,
                dueDate,
                isRecurring,
                recurrenceConfig ? JSON.stringify(recurrenceConfig) : null,
                diagramCode,
                okrs ? JSON.stringify(okrs) : null,
                milestone,
                beforeScenario,
                afterScenario,
                impactNarrative,
                resourceLinks ? JSON.stringify(resourceLinks) : null,
                assignedTeamId,
                id
            ]
        );

        // Activity log if status changed
        if (status && status !== existingTask.status) {
            await query(
                `INSERT INTO activity_log (task_id, user_id, user_name, action)
                 VALUES ($1, $2, $3, $4)`,
                [id, user.id, user.name, `Changed status to ${status}`]
            );
        }

        // Audit log
        await logAudit(
            user.id,
            user.organizationId,
            'TASK_UPDATED',
            'task',
            id,
            { changes: Object.keys(req.body) },
            req.ip,
            req.get('user-agent')
        );

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

        // Only admins can delete tasks
        if (user.role !== 'OWNER' && user.role !== 'ADMIN') {
            const isTaskAdmin = await query(
                'SELECT 1 FROM task_admins WHERE task_id = $1 AND user_id = $2',
                [id, user.id]
            );

            if (isTaskAdmin.rows.length === 0) {
                return res.status(403).json({ error: 'Only admins can delete tasks' });
            }
        }

        // Check task exists
        const taskCheck = await query(
            'SELECT title FROM tasks WHERE id = $1 AND organization_id = $2',
            [id, user.organizationId]
        );

        if (taskCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Task not found' });
        }

        const taskTitle = taskCheck.rows[0].title;

        // Delete task (cascades to all related tables)
        await query('DELETE FROM tasks WHERE id = $1', [id]);

        // Audit log
        await logAudit(
            user.id,
            user.organizationId,
            'TASK_DELETED',
            'task',
            id,
            { title: taskTitle },
            req.ip,
            req.get('user-agent')
        );

        res.json({ message: 'Task deleted successfully' });
    } catch (error) {
        console.error('Delete task error:', error);
        res.status(500).json({ error: 'Failed to delete task' });
    }
});

// ============================================================================
// SUBTASK ROUTES
// ============================================================================

// Add subtask
router.post('/:id/subtasks', async (req, res) => {
    try {
        const { id } = req.params;
        const { title, estimatedHours, category, notes, isMilestone, milestoneDescription } = req.body;

        if (!title) {
            return res.status(400).json({ error: 'Subtask title is required' });
        }

        // Get current max position
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

// Update subtask
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

// Delete subtask
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
