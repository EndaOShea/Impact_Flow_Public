import express from 'express';
import { query } from '../config/database.js';
import { requireAuth, requireOrganization } from '../middleware/auth.middleware.js';
import { logAudit } from '../utils/auth.js';

const router = express.Router();

// All routes require authentication and organization membership
router.use(requireAuth);
router.use(requireOrganization);

// ============================================================================
// GET TASK ASSIGNMENT REQUESTS
// ============================================================================
router.get('/', async (req, res) => {
    try {
        const user = req.user;

        // Get requests relevant to the user
        // If OWNER/ADMIN: all requests for their org
        // If TEAM_ADMIN: requests for their team members
        // If USER: no access (return empty)

        let result;

        if (['OWNER', 'ADMIN'].includes(user.role)) {
            // Get all requests for the organization
            result = await query(
                `SELECT tar.id,
                        tar.organization_id as "organizationId",
                        tar.task_id as "taskId",
                        tar.requester_id as "requesterId",
                        tar.target_user_id as "targetUserId",
                        tar.target_team_id as "targetTeamId",
                        tar.status,
                        tar.created_at as "createdAt",
                        COALESCE(u_requester.name, 'Unknown') as "requesterName",
                        COALESCE(u_target.name, 'Unknown') as "targetUserName",
                        COALESCE(t_target.name, 'Unknown') as "targetTeamName",
                        COALESCE(t.title, 'Unknown Task') as "taskTitle"
                 FROM task_assignment_requests tar
                 LEFT JOIN users u_requester ON tar.requester_id = u_requester.id
                 LEFT JOIN users u_target ON tar.target_user_id = u_target.id
                 LEFT JOIN teams t_target ON tar.target_team_id = t_target.id
                 LEFT JOIN tasks t ON tar.task_id = t.id
                 WHERE tar.organization_id = $1 AND tar.status = 'PENDING'
                 ORDER BY tar.created_at DESC`,
                [user.organizationId]
            );
        } else if (user.role === 'TEAM_ADMIN') {
            // Get requests for team members or requests made by this team admin
            result = await query(
                `SELECT tar.id,
                        tar.organization_id as "organizationId",
                        tar.task_id as "taskId",
                        tar.requester_id as "requesterId",
                        tar.target_user_id as "targetUserId",
                        tar.target_team_id as "targetTeamId",
                        tar.status,
                        tar.created_at as "createdAt",
                        COALESCE(u_requester.name, 'Unknown') as "requesterName",
                        COALESCE(u_target.name, 'Unknown') as "targetUserName",
                        COALESCE(t_target.name, 'Unknown') as "targetTeamName",
                        COALESCE(t.title, 'Unknown Task') as "taskTitle"
                 FROM task_assignment_requests tar
                 LEFT JOIN users u_requester ON tar.requester_id = u_requester.id
                 LEFT JOIN users u_target ON tar.target_user_id = u_target.id
                 LEFT JOIN teams t_target ON tar.target_team_id = t_target.id
                 LEFT JOIN user_teams tm ON tm.team_id = t_target.id
                 LEFT JOIN tasks t ON tar.task_id = t.id
                 WHERE tar.organization_id = $1
                   AND tar.status = 'PENDING'
                   AND (tm.user_id = $2 OR tar.requester_id = $2)
                 ORDER BY tar.created_at DESC`,
                [user.organizationId, user.id]
            );
        } else {
            // Regular users don't see assignment requests
            result = { rows: [] };
        }

        res.json(result.rows || []);
    } catch (error) {
        console.error('Get task assignment requests error:', error);
        console.error('Error details:', error.message, error.stack);
        res.status(500).json({ error: 'Failed to fetch task assignment requests' });
    }
});

// ============================================================================
// CREATE TASK ASSIGNMENT REQUEST
// ============================================================================
router.post('/', async (req, res) => {
    try {
        const { taskId, targetUserId, targetTeamId } = req.body;
        const user = req.user;

        // Only TEAM_ADMIN and above can create assignment requests
        if (!['OWNER', 'ADMIN', 'TEAM_ADMIN'].includes(user.role)) {
            return res.status(403).json({ error: 'Only team admins and above can create assignment requests' });
        }

        // Validate required fields
        if (!taskId || !targetUserId || !targetTeamId) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Check if request already exists
        const existingRequest = await query(
            `SELECT id FROM task_assignment_requests
             WHERE task_id = $1 AND target_user_id = $2 AND status = 'PENDING'`,
            [taskId, targetUserId]
        );

        if (existingRequest.rows.length > 0) {
            return res.status(400).json({ error: 'A pending request already exists for this task and user' });
        }

        // Create the request
        const result = await query(
            `INSERT INTO task_assignment_requests (
                organization_id,
                task_id,
                requester_id,
                target_user_id,
                target_team_id,
                status
            ) VALUES ($1, $2, $3, $4, $5, 'PENDING')
            RETURNING id, organization_id, task_id, requester_id,
                      target_user_id, target_team_id, status, created_at`,
            [user.organizationId, taskId, user.id, targetUserId, targetTeamId]
        );

        // Audit log
        await logAudit(
            user.id,
            user.organizationId,
            'TASK_ASSIGNMENT_REQUEST_CREATED',
            'task_assignment_request',
            result.rows[0].id,
            { taskId, targetUserId, targetTeamId },
            req.ip,
            req.get('user-agent')
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Create task assignment request error:', error);
        res.status(500).json({ error: 'Failed to create task assignment request' });
    }
});

// ============================================================================
// APPROVE TASK ASSIGNMENT REQUEST
// ============================================================================
router.post('/:requestId/approved', async (req, res) => {
    try {
        const { requestId } = req.params;
        const user = req.user;

        // Get the request
        const requestResult = await query(
            `SELECT tar.*, u.id as target_admin_check
             FROM task_assignment_requests tar
             JOIN user_teams tm ON tar.target_team_id = tm.team_id
             JOIN users u ON tm.user_id = u.id
             WHERE tar.id = $1 AND tar.status = 'PENDING'
               AND tar.organization_id = $2`,
            [requestId, user.organizationId]
        );

        if (requestResult.rows.length === 0) {
            return res.status(404).json({ error: 'Request not found or already processed' });
        }

        const request = requestResult.rows[0];

        // Only OWNER/ADMIN or the TEAM_ADMIN of the target team can approve
        const canApprove = ['OWNER', 'ADMIN'].includes(user.role) ||
                          (user.role === 'TEAM_ADMIN' && request.target_admin_check === user.id);

        if (!canApprove) {
            return res.status(403).json({ error: 'You do not have permission to approve this request' });
        }

        // Update request status
        await query(
            `UPDATE task_assignment_requests
             SET status = 'APPROVED', processed_at = NOW()
             WHERE id = $1`,
            [requestId]
        );

        // Add the user as task assignee
        await query(
            `INSERT INTO task_assignees (task_id, user_id)
             VALUES ($1, $2)
             ON CONFLICT (task_id, user_id) DO NOTHING`,
            [request.task_id, request.target_user_id]
        );

        // Audit log
        await logAudit(
            user.id,
            user.organizationId,
            'TASK_ASSIGNMENT_REQUEST_APPROVED',
            'task_assignment_request',
            requestId,
            { taskId: request.task_id, targetUserId: request.target_user_id },
            req.ip,
            req.get('user-agent')
        );

        res.json({ message: 'Assignment request approved successfully' });
    } catch (error) {
        console.error('Approve task assignment request error:', error);
        res.status(500).json({ error: 'Failed to approve task assignment request' });
    }
});

// ============================================================================
// REJECT TASK ASSIGNMENT REQUEST
// ============================================================================
router.post('/:requestId/rejected', async (req, res) => {
    try {
        const { requestId } = req.params;
        const user = req.user;

        // Get the request
        const requestResult = await query(
            `SELECT tar.*, u.id as target_admin_check
             FROM task_assignment_requests tar
             JOIN user_teams tm ON tar.target_team_id = tm.team_id
             JOIN users u ON tm.user_id = u.id
             WHERE tar.id = $1 AND tar.status = 'PENDING'
               AND tar.organization_id = $2`,
            [requestId, user.organizationId]
        );

        if (requestResult.rows.length === 0) {
            return res.status(404).json({ error: 'Request not found or already processed' });
        }

        const request = requestResult.rows[0];

        // Only OWNER/ADMIN or the TEAM_ADMIN of the target team can reject
        const canReject = ['OWNER', 'ADMIN'].includes(user.role) ||
                         (user.role === 'TEAM_ADMIN' && request.target_admin_check === user.id);

        if (!canReject) {
            return res.status(403).json({ error: 'You do not have permission to reject this request' });
        }

        // Update request status
        await query(
            `UPDATE task_assignment_requests
             SET status = 'REJECTED', processed_at = NOW()
             WHERE id = $1`,
            [requestId]
        );

        // Audit log
        await logAudit(
            user.id,
            user.organizationId,
            'TASK_ASSIGNMENT_REQUEST_REJECTED',
            'task_assignment_request',
            requestId,
            { taskId: request.task_id, targetUserId: request.target_user_id },
            req.ip,
            req.get('user-agent')
        );

        res.json({ message: 'Assignment request rejected successfully' });
    } catch (error) {
        console.error('Reject task assignment request error:', error);
        res.status(500).json({ error: 'Failed to reject task assignment request' });
    }
});

export default router;
