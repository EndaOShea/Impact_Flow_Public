import express from 'express';
import { query, transaction } from '../config/database.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { logAudit } from '../utils/auth.js';

const router = express.Router();

// All routes require authentication
router.use(requireAuth);

// ============================================================================
// GET ALL PROJECTS
// ============================================================================

router.get('/', async (req, res) => {
    try {
        const { status, priority } = req.query;

        let sql = `
            SELECT p.*
            FROM projects p
            WHERE p.creator_id = $1
        `;
        const params = [req.user.id];
        let paramIndex = 2;

        // Apply filters
        if (status) {
            sql += ` AND p.status = $${paramIndex}`;
            params.push(status);
            paramIndex++;
        }

        if (priority) {
            sql += ` AND p.priority = $${paramIndex}`;
            params.push(priority);
            paramIndex++;
        }

        sql += ' ORDER BY p.created_at DESC';

        const result = await query(sql, params);

        // Load nested data for each project
        const projects = await Promise.all(result.rows.map(async (project) => {
            const [teamMembers, comments, attachments, activityLog, tasks] = await Promise.all([
                query('SELECT * FROM team_members WHERE project_id = $1 ORDER BY created_at', [project.id]),
                query(`
                    SELECT c.*, u.name as author_name, u.avatar_initials as author_initials
                    FROM project_comments c
                    LEFT JOIN users u ON c.author_id = u.id
                    WHERE c.project_id = $1
                    ORDER BY c.created_at DESC
                `, [project.id]),
                query('SELECT * FROM project_attachments WHERE project_id = $1 ORDER BY created_at', [project.id]),
                query('SELECT * FROM project_activity_log WHERE project_id = $1 ORDER BY timestamp DESC LIMIT 20', [project.id]),
                query('SELECT id, title, status FROM tasks WHERE project_id = $1', [project.id])
            ]);

            // Calculate aggregated metrics
            const totalTasks = tasks.rows.length;
            const completedTasks = tasks.rows.filter(t => t.status === 'COMPLETED').length;
            const progressPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

            return {
                id: project.id,
                title: project.title,
                description: project.description,
                status: project.status,
                priority: project.priority,
                color: project.color || '#8b5cf6',
                creatorId: project.creator_id,
                startDate: project.start_date,
                targetEndDate: project.target_end_date,
                actualEndDate: project.actual_end_date,
                createdAt: project.created_at,
                updatedAt: project.updated_at,
                completedAt: project.completed_at,
                okrs: project.okrs || [],
                vision: project.vision,
                successCriteria: project.success_criteria,
                notes: project.notes,
                resourceLinks: project.resource_links || [],
                teamMembers: teamMembers.rows.map(tm => ({
                    id: tm.id,
                    projectId: tm.project_id,
                    name: tm.name,
                    role: tm.role,
                    email: tm.email,
                    notes: tm.notes,
                    createdAt: tm.created_at,
                    updatedAt: tm.updated_at
                })),
                comments: comments.rows.map(c => ({
                    id: c.id,
                    projectId: c.project_id,
                    authorId: c.author_id,
                    authorName: c.author_name,
                    authorInitials: c.author_initials,
                    text: c.text,
                    createdAt: c.created_at
                })),
                attachments: attachments.rows.map(a => ({
                    id: a.id,
                    projectId: a.project_id,
                    name: a.name,
                    type: a.type,
                    url: a.url,
                    size: a.size,
                    uploadedBy: a.uploaded_by,
                    createdAt: a.created_at
                })),
                activityLog: activityLog.rows.map(al => ({
                    id: al.id,
                    projectId: al.project_id,
                    userId: al.user_id,
                    userName: al.user_name,
                    action: al.action,
                    timestamp: al.timestamp
                })),
                totalTasks,
                completedTasks,
                progressPercentage
            };
        }));

        res.json(projects);
    } catch (error) {
        console.error('Get projects error:', error);
        res.status(500).json({ error: 'Failed to fetch projects' });
    }
});

// ============================================================================
// GET SINGLE PROJECT
// ============================================================================

router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const result = await query(
            'SELECT * FROM projects WHERE id = $1 AND creator_id = $2',
            [id, req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Project not found' });
        }

        const project = result.rows[0];

        // Load nested data
        const [teamMembers, comments, attachments, activityLog, tasks] = await Promise.all([
            query('SELECT * FROM team_members WHERE project_id = $1 ORDER BY created_at', [id]),
            query(`
                SELECT c.*, u.name as author_name, u.avatar_initials as author_initials
                FROM project_comments c
                LEFT JOIN users u ON c.author_id = u.id
                WHERE c.project_id = $1
                ORDER BY c.created_at DESC
            `, [id]),
            query('SELECT * FROM project_attachments WHERE project_id = $1 ORDER BY created_at', [id]),
            query('SELECT * FROM project_activity_log WHERE project_id = $1 ORDER BY timestamp DESC LIMIT 50', [id]),
            query('SELECT id, title, status FROM tasks WHERE project_id = $1', [id])
        ]);

        // Calculate metrics
        const totalTasks = tasks.rows.length;
        const completedTasks = tasks.rows.filter(t => t.status === 'COMPLETED').length;
        const progressPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

        res.json({
            id: project.id,
            title: project.title,
            description: project.description,
            status: project.status,
            priority: project.priority,
            creatorId: project.creator_id,
            startDate: project.start_date,
            targetEndDate: project.target_end_date,
            actualEndDate: project.actual_end_date,
            createdAt: project.created_at,
            updatedAt: project.updated_at,
            completedAt: project.completed_at,
            okrs: project.okrs || [],
            vision: project.vision,
            successCriteria: project.success_criteria,
            notes: project.notes,
            resourceLinks: project.resource_links || [],
            teamMembers: teamMembers.rows.map(tm => ({
                id: tm.id,
                projectId: tm.project_id,
                name: tm.name,
                role: tm.role,
                email: tm.email,
                notes: tm.notes,
                createdAt: tm.created_at,
                updatedAt: tm.updated_at
            })),
            comments: comments.rows.map(c => ({
                id: c.id,
                projectId: c.project_id,
                authorId: c.author_id,
                authorName: c.author_name,
                authorInitials: c.author_initials,
                text: c.text,
                createdAt: c.created_at
            })),
            attachments: attachments.rows.map(a => ({
                id: a.id,
                projectId: a.project_id,
                name: a.name,
                type: a.type,
                url: a.url,
                size: a.size,
                uploadedBy: a.uploaded_by,
                createdAt: a.created_at
            })),
            activityLog: activityLog.rows.map(al => ({
                id: al.id,
                projectId: al.project_id,
                userId: al.user_id,
                userName: al.user_name,
                action: al.action,
                timestamp: al.timestamp
            })),
            totalTasks,
            completedTasks,
            progressPercentage
        });
    } catch (error) {
        console.error('Get project error:', error);
        res.status(500).json({ error: 'Failed to fetch project' });
    }
});

// ============================================================================
// CREATE PROJECT
// ============================================================================

router.post('/', async (req, res) => {
    try {
        const {
            title,
            description,
            status,
            priority,
            color,
            startDate,
            targetEndDate,
            okrs,
            vision,
            successCriteria,
            notes,
            resourceLinks,
            teamMembers
        } = req.body;

        if (!title || title.trim().length === 0) {
            return res.status(400).json({ error: 'Project title is required' });
        }

        // Validate dates
        if (startDate && targetEndDate) {
            const start = new Date(startDate);
            const end = new Date(targetEndDate);
            if (end < start) {
                return res.status(400).json({ error: 'Target end date cannot be before start date' });
            }
        }

        const newProject = await transaction(async (client) => {
            // Create project
            const projectResult = await client.query(
                `INSERT INTO projects (
                    title, description, status, priority, color, creator_id,
                    start_date, target_end_date, okrs, vision, success_criteria, notes, resource_links
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
                RETURNING *`,
                [
                    title.trim(),
                    description || null,
                    status || 'PLANNING',
                    priority || 'MEDIUM',
                    color || '#8b5cf6',
                    req.user.id,
                    startDate || null,
                    targetEndDate || null,
                    JSON.stringify(okrs || []),
                    vision || null,
                    successCriteria || null,
                    notes || null,
                    JSON.stringify(resourceLinks || [])
                ]
            );

            const project = projectResult.rows[0];

            // Create team members if provided
            if (teamMembers && Array.isArray(teamMembers) && teamMembers.length > 0) {
                for (const member of teamMembers) {
                    if (member.name && member.name.trim()) {
                        await client.query(
                            `INSERT INTO team_members (project_id, name, role, email, notes)
                             VALUES ($1, $2, $3, $4, $5)`,
                            [
                                project.id,
                                member.name.trim(),
                                member.role || null,
                                member.email || null,
                                member.notes || null
                            ]
                        );
                    }
                }
            }

            // Log activity
            await client.query(
                `INSERT INTO project_activity_log (project_id, user_id, user_name, action)
                 VALUES ($1, $2, $3, $4)`,
                [project.id, req.user.id, req.user.name, 'Created project']
            );

            return project;
        });

        await logAudit(req.user.id, 'PROJECT_CREATED', 'project', newProject.id, { title }, req.ip, req.get('user-agent'));

        // Load team members for response
        const teamMembersResult = await query('SELECT * FROM team_members WHERE project_id = $1 ORDER BY created_at', [newProject.id]);

        res.status(201).json({
            id: newProject.id,
            title: newProject.title,
            description: newProject.description,
            status: newProject.status,
            priority: newProject.priority,
            color: newProject.color,
            creatorId: newProject.creator_id,
            startDate: newProject.start_date,
            targetEndDate: newProject.target_end_date,
            actualEndDate: newProject.actual_end_date,
            createdAt: newProject.created_at,
            updatedAt: newProject.updated_at,
            completedAt: newProject.completed_at,
            okrs: newProject.okrs || [],
            vision: newProject.vision,
            successCriteria: newProject.success_criteria,
            notes: newProject.notes,
            resourceLinks: newProject.resource_links || [],
            teamMembers: teamMembersResult.rows.map(tm => ({
                id: tm.id,
                projectId: tm.project_id,
                name: tm.name,
                role: tm.role,
                email: tm.email,
                notes: tm.notes,
                createdAt: tm.created_at,
                updatedAt: tm.updated_at
            })),
            comments: [],
            attachments: [],
            activityLog: [],
            totalTasks: 0,
            completedTasks: 0,
            progressPercentage: 0
        });
    } catch (error) {
        console.error('Create project error:', error);
        res.status(500).json({ error: 'Failed to create project' });
    }
});

// ============================================================================
// UPDATE PROJECT
// ============================================================================

router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const {
            title,
            description,
            status,
            priority,
            color,
            startDate,
            targetEndDate,
            actualEndDate,
            completedAt,
            okrs,
            vision,
            successCriteria,
            notes,
            resourceLinks,
            teamMembers
        } = req.body;

        // Verify ownership
        const accessCheck = await query(
            'SELECT * FROM projects WHERE id = $1 AND creator_id = $2',
            [id, req.user.id]
        );

        if (accessCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Project not found' });
        }

        const oldProject = accessCheck.rows[0];

        // Validate dates
        const finalStartDate = startDate !== undefined ? startDate : oldProject.start_date;
        const finalTargetEndDate = targetEndDate !== undefined ? targetEndDate : oldProject.target_end_date;
        const finalActualEndDate = actualEndDate !== undefined ? actualEndDate : oldProject.actual_end_date;

        if (finalStartDate && finalTargetEndDate) {
            const start = new Date(finalStartDate);
            const end = new Date(finalTargetEndDate);
            if (end < start) {
                return res.status(400).json({ error: 'Target end date cannot be before start date' });
            }
        }

        if (finalStartDate && finalActualEndDate) {
            const start = new Date(finalStartDate);
            const actual = new Date(finalActualEndDate);
            if (actual < start) {
                return res.status(400).json({ error: 'Actual end date cannot be before start date' });
            }
        }

        // Update project
        const result = await query(
            `UPDATE projects SET
                title = COALESCE($1, title),
                description = COALESCE($2, description),
                status = COALESCE($3, status),
                priority = COALESCE($4, priority),
                color = COALESCE($5, color),
                start_date = COALESCE($6, start_date),
                target_end_date = COALESCE($7, target_end_date),
                actual_end_date = COALESCE($8, actual_end_date),
                completed_at = COALESCE($9, completed_at),
                okrs = COALESCE($10, okrs),
                vision = COALESCE($11, vision),
                success_criteria = COALESCE($12, success_criteria),
                notes = COALESCE($13, notes),
                resource_links = COALESCE($14, resource_links),
                updated_at = NOW()
             WHERE id = $15 AND creator_id = $16
             RETURNING *`,
            [
                title,
                description,
                status,
                priority,
                color,
                startDate,
                targetEndDate,
                actualEndDate,
                completedAt,
                okrs ? JSON.stringify(okrs) : null,
                vision,
                successCriteria,
                notes,
                resourceLinks ? JSON.stringify(resourceLinks) : null,
                id,
                req.user.id
            ]
        );

        const updatedProject = result.rows[0];

        // Log status change if changed
        if (oldProject.status !== updatedProject.status) {
            await query(
                `INSERT INTO project_activity_log (project_id, user_id, user_name, action)
                 VALUES ($1, $2, $3, $4)`,
                [id, req.user.id, req.user.name, `Changed status from ${oldProject.status} to ${updatedProject.status}`]
            );
        }

        // Handle team members if provided
        if (teamMembers && Array.isArray(teamMembers)) {
            // Get existing team members
            const existingMembersResult = await query(
                'SELECT id FROM team_members WHERE project_id = $1',
                [id]
            );
            const existingIds = new Set(existingMembersResult.rows.map(m => m.id));
            const providedIds = new Set(teamMembers.map(m => m.id).filter(Boolean));

            // Delete removed members
            for (const existingId of existingIds) {
                if (!providedIds.has(existingId)) {
                    await query('DELETE FROM team_members WHERE id = $1', [existingId]);
                }
            }

            // Add or update members
            for (const member of teamMembers) {
                if (member.name && member.name.trim()) {
                    if (member.id && existingIds.has(member.id)) {
                        // Update existing member
                        await query(
                            `UPDATE team_members SET
                                name = $1,
                                role = $2,
                                email = $3,
                                notes = $4,
                                updated_at = NOW()
                             WHERE id = $5`,
                            [
                                member.name.trim(),
                                member.role || null,
                                member.email || null,
                                member.notes || null,
                                member.id
                            ]
                        );
                    } else {
                        // Insert new member
                        await query(
                            `INSERT INTO team_members (project_id, name, role, email, notes)
                             VALUES ($1, $2, $3, $4, $5)`,
                            [
                                id,
                                member.name.trim(),
                                member.role || null,
                                member.email || null,
                                member.notes || null
                            ]
                        );
                    }
                }
            }
        }

        await logAudit(req.user.id, 'PROJECT_UPDATED', 'project', id, { title }, req.ip, req.get('user-agent'));

        // Load team members for response
        const teamMembersResult = await query('SELECT * FROM team_members WHERE project_id = $1 ORDER BY created_at', [id]);

        res.json({
            id: updatedProject.id,
            title: updatedProject.title,
            description: updatedProject.description,
            status: updatedProject.status,
            priority: updatedProject.priority,
            color: updatedProject.color,
            creatorId: updatedProject.creator_id,
            startDate: updatedProject.start_date,
            targetEndDate: updatedProject.target_end_date,
            actualEndDate: updatedProject.actual_end_date,
            createdAt: updatedProject.created_at,
            updatedAt: updatedProject.updated_at,
            completedAt: updatedProject.completed_at,
            okrs: updatedProject.okrs || [],
            vision: updatedProject.vision,
            successCriteria: updatedProject.success_criteria,
            notes: updatedProject.notes,
            resourceLinks: updatedProject.resource_links || [],
            teamMembers: teamMembersResult.rows.map(tm => ({
                id: tm.id,
                projectId: tm.project_id,
                name: tm.name,
                role: tm.role,
                email: tm.email,
                notes: tm.notes,
                createdAt: tm.created_at,
                updatedAt: tm.updated_at
            }))
        });
    } catch (error) {
        console.error('Update project error:', error);
        res.status(500).json({ error: 'Failed to update project' });
    }
});

// ============================================================================
// DELETE PROJECT
// ============================================================================

router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Verify ownership
        const accessCheck = await query(
            'SELECT * FROM projects WHERE id = $1 AND creator_id = $2',
            [id, req.user.id]
        );

        if (accessCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Project not found' });
        }

        const project = accessCheck.rows[0];

        // Check for linked tasks
        const tasksResult = await query(
            'SELECT COUNT(*) as count FROM tasks WHERE project_id = $1',
            [id]
        );

        const taskCount = parseInt(tasksResult.rows[0].count);

        await logAudit(req.user.id, 'PROJECT_DELETED', 'project', id, { title: project.title, taskCount }, req.ip, req.get('user-agent'));

        // Delete project (CASCADE will handle related records, tasks will have project_id set to NULL)
        await query('DELETE FROM projects WHERE id = $1', [id]);

        res.json({
            message: 'Project deleted successfully',
            taskCount: taskCount,
            tasksSetToNull: taskCount > 0
        });
    } catch (error) {
        console.error('Delete project error:', error);
        res.status(500).json({ error: 'Failed to delete project' });
    }
});

// ============================================================================
// TEAM MEMBERS
// ============================================================================

// Get all team members for a project
router.get('/:id/team-members', async (req, res) => {
    try {
        const { id } = req.params;

        // Verify project ownership
        const accessCheck = await query(
            'SELECT id FROM projects WHERE id = $1 AND creator_id = $2',
            [id, req.user.id]
        );

        if (accessCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Project not found' });
        }

        const result = await query(
            'SELECT * FROM team_members WHERE project_id = $1 ORDER BY created_at',
            [id]
        );

        res.json(result.rows.map(tm => ({
            id: tm.id,
            projectId: tm.project_id,
            name: tm.name,
            role: tm.role,
            email: tm.email,
            notes: tm.notes,
            createdAt: tm.created_at,
            updatedAt: tm.updated_at
        })));
    } catch (error) {
        console.error('Get team members error:', error);
        res.status(500).json({ error: 'Failed to fetch team members' });
    }
});

// Add team member
router.post('/:id/team-members', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, role, email, notes } = req.body;

        if (!name || name.trim().length === 0) {
            return res.status(400).json({ error: 'Team member name is required' });
        }

        // Verify project ownership
        const accessCheck = await query(
            'SELECT id FROM projects WHERE id = $1 AND creator_id = $2',
            [id, req.user.id]
        );

        if (accessCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Project not found' });
        }

        const result = await query(
            `INSERT INTO team_members (project_id, name, role, email, notes)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [id, name.trim(), role || null, email || null, notes || null]
        );

        const teamMember = result.rows[0];

        // Log activity
        await query(
            `INSERT INTO project_activity_log (project_id, user_id, user_name, action)
             VALUES ($1, $2, $3, $4)`,
            [id, req.user.id, req.user.name, `Added team member: ${name}`]
        );

        res.status(201).json({
            id: teamMember.id,
            projectId: teamMember.project_id,
            name: teamMember.name,
            role: teamMember.role,
            email: teamMember.email,
            notes: teamMember.notes,
            createdAt: teamMember.created_at,
            updatedAt: teamMember.updated_at
        });
    } catch (error) {
        console.error('Add team member error:', error);
        res.status(500).json({ error: 'Failed to add team member' });
    }
});

// Update team member
router.put('/:id/team-members/:memberId', async (req, res) => {
    try {
        const { id, memberId } = req.params;
        const { name, role, email, notes } = req.body;

        // Verify project ownership
        const accessCheck = await query(
            'SELECT id FROM projects WHERE id = $1 AND creator_id = $2',
            [id, req.user.id]
        );

        if (accessCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Project not found' });
        }

        const result = await query(
            `UPDATE team_members SET
                name = COALESCE($1, name),
                role = COALESCE($2, role),
                email = COALESCE($3, email),
                notes = COALESCE($4, notes),
                updated_at = NOW()
             WHERE id = $5 AND project_id = $6
             RETURNING *`,
            [name, role, email, notes, memberId, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Team member not found' });
        }

        const teamMember = result.rows[0];

        res.json({
            id: teamMember.id,
            projectId: teamMember.project_id,
            name: teamMember.name,
            role: teamMember.role,
            email: teamMember.email,
            notes: teamMember.notes,
            createdAt: teamMember.created_at,
            updatedAt: teamMember.updated_at
        });
    } catch (error) {
        console.error('Update team member error:', error);
        res.status(500).json({ error: 'Failed to update team member' });
    }
});

// Delete team member
router.delete('/:id/team-members/:memberId', async (req, res) => {
    try {
        const { id, memberId } = req.params;

        // Verify project ownership
        const accessCheck = await query(
            'SELECT id FROM projects WHERE id = $1 AND creator_id = $2',
            [id, req.user.id]
        );

        if (accessCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Project not found' });
        }

        // Get team member name before deletion
        const memberResult = await query(
            'SELECT name FROM team_members WHERE id = $1 AND project_id = $2',
            [memberId, id]
        );

        if (memberResult.rows.length === 0) {
            return res.status(404).json({ error: 'Team member not found' });
        }

        const memberName = memberResult.rows[0].name;

        // Delete team member (CASCADE will remove blockers)
        await query('DELETE FROM team_members WHERE id = $1', [memberId]);

        // Log activity
        await query(
            `INSERT INTO project_activity_log (project_id, user_id, user_name, action)
             VALUES ($1, $2, $3, $4)`,
            [id, req.user.id, req.user.name, `Removed team member: ${memberName}`]
        );

        res.json({ message: 'Team member deleted successfully' });
    } catch (error) {
        console.error('Delete team member error:', error);
        res.status(500).json({ error: 'Failed to delete team member' });
    }
});

// ============================================================================
// PROJECT COMMENTS
// ============================================================================

router.post('/:id/comments', async (req, res) => {
    try {
        const { id } = req.params;
        const { text } = req.body;

        if (!text || text.trim().length === 0) {
            return res.status(400).json({ error: 'Comment text is required' });
        }

        // Verify project ownership
        const accessCheck = await query(
            'SELECT id FROM projects WHERE id = $1 AND creator_id = $2',
            [id, req.user.id]
        );

        if (accessCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Project not found' });
        }

        const result = await query(
            `INSERT INTO project_comments (project_id, author_id, text)
             VALUES ($1, $2, $3)
             RETURNING *`,
            [id, req.user.id, text.trim()]
        );

        const comment = result.rows[0];

        // Log activity
        await query(
            `INSERT INTO project_activity_log (project_id, user_id, user_name, action)
             VALUES ($1, $2, $3, $4)`,
            [id, req.user.id, req.user.name, 'Added a comment']
        );

        res.status(201).json({
            id: comment.id,
            projectId: comment.project_id,
            authorId: comment.author_id,
            authorName: req.user.name,
            authorInitials: req.user.avatarInitials,
            text: comment.text,
            createdAt: comment.created_at
        });
    } catch (error) {
        console.error('Add comment error:', error);
        res.status(500).json({ error: 'Failed to add comment' });
    }
});

// ============================================================================
// PROJECT ATTACHMENTS
// ============================================================================

router.post('/:id/attachments', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, type, url, size } = req.body;

        if (!name || !url) {
            return res.status(400).json({ error: 'Attachment name and URL are required' });
        }

        // Verify project ownership
        const accessCheck = await query(
            'SELECT id FROM projects WHERE id = $1 AND creator_id = $2',
            [id, req.user.id]
        );

        if (accessCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Project not found' });
        }

        // Check attachment count (max 3)
        const countResult = await query(
            'SELECT COUNT(*) as count FROM project_attachments WHERE project_id = $1',
            [id]
        );

        if (parseInt(countResult.rows[0].count) >= 3) {
            return res.status(400).json({ error: 'Maximum 3 attachments allowed per project' });
        }

        const result = await query(
            `INSERT INTO project_attachments (project_id, name, type, url, size, uploaded_by)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [id, name, type || null, url, size || null, req.user.id]
        );

        const attachment = result.rows[0];

        // Log activity
        await query(
            `INSERT INTO project_activity_log (project_id, user_id, user_name, action)
             VALUES ($1, $2, $3, $4)`,
            [id, req.user.id, req.user.name, `Uploaded attachment: ${name}`]
        );

        res.status(201).json({
            id: attachment.id,
            projectId: attachment.project_id,
            name: attachment.name,
            type: attachment.type,
            url: attachment.url,
            size: attachment.size,
            uploadedBy: attachment.uploaded_by,
            createdAt: attachment.created_at
        });
    } catch (error) {
        console.error('Add attachment error:', error);
        res.status(500).json({ error: 'Failed to add attachment' });
    }
});

router.delete('/:id/attachments/:attachmentId', async (req, res) => {
    try {
        const { id, attachmentId } = req.params;

        // Verify project ownership
        const accessCheck = await query(
            'SELECT id FROM projects WHERE id = $1 AND creator_id = $2',
            [id, req.user.id]
        );

        if (accessCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Project not found' });
        }

        // Get attachment name before deletion
        const attachmentResult = await query(
            'SELECT name FROM project_attachments WHERE id = $1 AND project_id = $2',
            [attachmentId, id]
        );

        if (attachmentResult.rows.length === 0) {
            return res.status(404).json({ error: 'Attachment not found' });
        }

        const attachmentName = attachmentResult.rows[0].name;

        await query('DELETE FROM project_attachments WHERE id = $1', [attachmentId]);

        // Log activity
        await query(
            `INSERT INTO project_activity_log (project_id, user_id, user_name, action)
             VALUES ($1, $2, $3, $4)`,
            [id, req.user.id, req.user.name, `Deleted attachment: ${attachmentName}`]
        );

        res.json({ message: 'Attachment deleted successfully' });
    } catch (error) {
        console.error('Delete attachment error:', error);
        res.status(500).json({ error: 'Failed to delete attachment' });
    }
});

// ============================================================================
// PROJECT ANALYTICS
// ============================================================================

router.get('/:id/analytics', async (req, res) => {
    try {
        const { id } = req.params;

        // Verify project ownership
        const accessCheck = await query(
            'SELECT id FROM projects WHERE id = $1 AND creator_id = $2',
            [id, req.user.id]
        );

        if (accessCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Project not found' });
        }

        // Get all tasks for this project
        const tasksResult = await query(
            `SELECT t.*,
                    (SELECT COALESCE(SUM(s.estimated_hours), 0) FROM subtasks s WHERE s.task_id = t.id) as estimated_hours,
                    (SELECT COALESCE(SUM(s.hours_spent), 0) FROM subtasks s WHERE s.task_id = t.id) as hours_spent
             FROM tasks t
             WHERE t.project_id = $1`,
            [id]
        );

        const tasks = tasksResult.rows;

        // Task summary
        const totalTasks = tasks.length;
        const completedTasks = tasks.filter(t => t.status === 'COMPLETED').length;
        const inProgressTasks = tasks.filter(t => t.status === 'IN_PROGRESS').length;
        const overdueTasks = tasks.filter(t => t.status === 'OVERDUE').length;
        const progressPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

        // Time tracking
        const totalEstimatedHours = tasks.reduce((sum, t) => sum + parseFloat(t.estimated_hours || 0), 0);
        const totalHoursSpent = tasks.reduce((sum, t) => sum + parseFloat(t.hours_spent || 0), 0);
        const hoursRemaining = Math.max(0, totalEstimatedHours - totalHoursSpent);

        // Impact metrics (aggregate from task impact_metrics)
        const impactMetricsResult = await query(
            `SELECT type, COALESCE(SUM(value), 0) as total_value, COALESCE(SUM(achieved_value), 0) as total_achieved
             FROM impact_metrics im
             JOIN tasks t ON im.task_id = t.id
             WHERE t.project_id = $1
             GROUP BY type`,
            [id]
        );

        const aggregatedImpact = {};
        impactMetricsResult.rows.forEach(row => {
            aggregatedImpact[row.type] = {
                target: parseFloat(row.total_value),
                achieved: parseFloat(row.total_achieved)
            };
        });

        // Task blockers
        const blockersResult = await query(
            `SELECT tb.*, tm.name as team_member_name
             FROM task_blockers tb
             JOIN team_members tm ON tb.team_member_id = tm.id
             JOIN tasks t ON tb.task_id = t.id
             WHERE t.project_id = $1`,
            [id]
        );

        const activeBlockers = blockersResult.rows.filter(b => !b.resolved_at).length;
        const resolvedBlockers = blockersResult.rows.filter(b => b.resolved_at).length;

        // Blockers by team member
        const blockersByMember = {};
        blockersResult.rows.forEach(b => {
            if (!blockersByMember[b.team_member_name]) {
                blockersByMember[b.team_member_name] = { active: 0, resolved: 0 };
            }
            if (b.resolved_at) {
                blockersByMember[b.team_member_name].resolved++;
            } else {
                blockersByMember[b.team_member_name].active++;
            }
        });

        res.json({
            projectId: id,
            taskSummary: {
                totalTasks,
                completedTasks,
                inProgressTasks,
                overdueTasks,
                progressPercentage
            },
            timeTracking: {
                totalEstimatedHours: Math.round(totalEstimatedHours * 10) / 10,
                totalHoursSpent: Math.round(totalHoursSpent * 10) / 10,
                hoursRemaining: Math.round(hoursRemaining * 10) / 10
            },
            aggregatedImpact,
            blockers: {
                activeBlockers,
                resolvedBlockers,
                totalBlockers: activeBlockers + resolvedBlockers,
                blockersByMember
            }
        });
    } catch (error) {
        console.error('Get analytics error:', error);
        res.status(500).json({ error: 'Failed to fetch analytics' });
    }
});

export default router;

