import express from 'express';
import { query } from '../config/database.js';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';
import { logAudit } from '../utils/auth.js';

const router = express.Router();

// All organization routes require authentication
router.use(requireAuth);

// ============================================================================
// GET ALL ORGANIZATIONS
// ============================================================================
router.get('/', async (req, res) => {
    try {
        // All authenticated users can see the list of organizations (for join requests)
        const result = await query(
            `SELECT id, name, owner_id, created_at, updated_at
             FROM organizations
             ORDER BY created_at DESC`
        );

        res.json(result.rows);
    } catch (error) {
        console.error('Get organizations error:', error);
        res.status(500).json({ error: 'Failed to fetch organizations' });
    }
});

// ============================================================================
// JOIN REQUESTS
// ============================================================================
// IMPORTANT: These routes MUST come before /:id routes to avoid parameter matching

// Get all join requests (for user's own requests OR their organization's requests)
router.get('/join-requests', async (req, res) => {
    try {
        let result;

        // If user has an organization and is OWNER/ADMIN, get organization's join requests
        if (req.user.organizationId && ['OWNER', 'ADMIN'].includes(req.user.role)) {
            result = await query(
                `SELECT jr.id,
                        jr.user_id as "userId",
                        jr.organization_id as "organizationId",
                        jr.status,
                        jr.created_at as "createdAt",
                        jr.processed_at as "processedAt",
                        jr.processed_by as "processedBy",
                        u.username,
                        u.name
                 FROM join_requests jr
                 JOIN users u ON jr.user_id = u.id
                 WHERE jr.organization_id = $1 AND jr.status = 'PENDING'
                 ORDER BY jr.created_at DESC`,
                [req.user.organizationId]
            );
        } else {
            // Otherwise, get user's own join requests
            result = await query(
                `SELECT jr.id,
                        jr.user_id as "userId",
                        jr.organization_id as "organizationId",
                        jr.status,
                        jr.created_at as "createdAt",
                        jr.processed_at as "processedAt",
                        jr.processed_by as "processedBy"
                 FROM join_requests jr
                 WHERE jr.user_id = $1
                 ORDER BY jr.created_at DESC`,
                [req.user.id]
            );
        }

        res.json(result.rows);
    } catch (error) {
        console.error('Get join requests error:', error);
        res.status(500).json({ error: 'Failed to fetch join requests' });
    }
});

// Cancel join request (by the requester)
router.delete('/join-requests/:requestId', async (req, res) => {
    try {
        const { requestId } = req.params;

        const result = await query(
            'DELETE FROM join_requests WHERE id = $1 AND user_id = $2 AND status = $3 RETURNING id',
            [requestId, req.user.id, 'PENDING']
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Join request not found or cannot be cancelled' });
        }

        res.json({ message: 'Join request cancelled successfully' });
    } catch (error) {
        console.error('Cancel join request error:', error);
        res.status(500).json({ error: 'Failed to cancel join request' });
    }
});

// ============================================================================
// GET SINGLE ORGANIZATION
// ============================================================================
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Users can only view their own organization (unless SYSTEM_ADMIN)
        if (req.user.role !== 'SYSTEM_ADMIN' && req.user.organizationId !== id) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const result = await query(
            'SELECT id, name, owner_id, created_at, updated_at FROM organizations WHERE id = $1',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Organization not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Get organization error:', error);
        res.status(500).json({ error: 'Failed to fetch organization' });
    }
});

// ============================================================================
// CREATE ORGANIZATION
// ============================================================================
router.post('/', async (req, res) => {
    try {
        const { name } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({ error: 'Organization name is required' });
        }

        // Check if user already has an organization
        if (req.user.organizationId) {
            return res.status(400).json({ error: 'You are already part of an organization' });
        }

        // Create organization
        const orgResult = await query(
            `INSERT INTO organizations (name, owner_id)
             VALUES ($1, $2)
             RETURNING id, name, owner_id, created_at, updated_at`,
            [name.trim(), req.user.id]
        );

        const newOrg = orgResult.rows[0];

        // Update user to set organization_id and role to OWNER
        await query(
            `UPDATE users
             SET organization_id = $1, role = $2, updated_at = NOW()
             WHERE id = $3`,
            [newOrg.id, 'OWNER', req.user.id]
        );

        // Audit log
        await logAudit(
            req.user.id,
            newOrg.id,
            'ORGANIZATION_CREATED',
            'organization',
            newOrg.id,
            { name: newOrg.name },
            req.ip,
            req.get('user-agent')
        );

        res.status(201).json(newOrg);
    } catch (error) {
        console.error('Create organization error:', error);
        res.status(500).json({ error: 'Failed to create organization' });
    }
});

// ============================================================================
// UPDATE ORGANIZATION
// ============================================================================
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name } = req.body;

        // Only OWNER or ADMIN can update organization
        if (!['OWNER', 'ADMIN'].includes(req.user.role) || req.user.organizationId !== id) {
            return res.status(403).json({ error: 'Access denied' });
        }

        if (!name || !name.trim()) {
            return res.status(400).json({ error: 'Organization name is required' });
        }

        const result = await query(
            `UPDATE organizations
             SET name = $1, updated_at = NOW()
             WHERE id = $2
             RETURNING id, name, owner_id, created_at, updated_at`,
            [name.trim(), id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Organization not found' });
        }

        // Audit log
        await logAudit(
            req.user.id,
            id,
            'ORGANIZATION_UPDATED',
            'organization',
            id,
            { name: name.trim() },
            req.ip,
            req.get('user-agent')
        );

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Update organization error:', error);
        res.status(500).json({ error: 'Failed to update organization' });
    }
});

// ============================================================================
// UPLOAD ORGANIZATION BANNER (Owner/Admin only)
// ============================================================================
router.post('/:id/banner', async (req, res) => {
    try {
        const { id } = req.params;
        const { banner } = req.body;

        // Only OWNER or ADMIN can upload banner
        if (!['OWNER', 'ADMIN'].includes(req.user.role) || req.user.organizationId !== id) {
            return res.status(403).json({ error: 'Access denied' });
        }

        if (!banner || !banner.trim()) {
            return res.status(400).json({ error: 'Banner data is required' });
        }

        // Validate base64 image format
        if (!banner.startsWith('data:image/')) {
            return res.status(400).json({ error: 'Invalid image format' });
        }

        // Update organization banner
        const result = await query(
            `UPDATE organizations
             SET banner_url = $1, updated_at = NOW()
             WHERE id = $2
             RETURNING id, name, banner_url`,
            [banner, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Organization not found' });
        }

        // Audit log
        await logAudit(
            req.user.id,
            id,
            'ORGANIZATION_BANNER_UPDATED',
            'organization',
            id,
            { banner_uploaded: true },
            req.ip,
            req.get('user-agent')
        );

        res.json({ message: 'Banner uploaded successfully', organization: result.rows[0] });
    } catch (error) {
        console.error('Upload banner error:', error);
        res.status(500).json({ error: 'Failed to upload banner' });
    }
});

// ============================================================================
// DELETE ORGANIZATION (Owner only)
// ============================================================================
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Only OWNER can delete
        if (req.user.role !== 'OWNER' || req.user.organizationId !== id) {
            return res.status(403).json({ error: 'Only the organization owner can delete it' });
        }

        // Delete organization (cascade will handle related data)
        const result = await query(
            'DELETE FROM organizations WHERE id = $1 RETURNING id',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Organization not found' });
        }

        // Audit log
        await logAudit(
            req.user.id,
            id,
            'ORGANIZATION_DELETED',
            'organization',
            id,
            null,
            req.ip,
            req.get('user-agent')
        );

        res.json({ message: 'Organization deleted successfully' });
    } catch (error) {
        console.error('Delete organization error:', error);
        res.status(500).json({ error: 'Failed to delete organization' });
    }
});

// Get join requests for organization (Admin/Owner only)
router.get('/:id/join-requests', async (req, res) => {
    try {
        const { id } = req.params;

        // Only admins of the organization can view join requests
        if (!['OWNER', 'ADMIN'].includes(req.user.role) || req.user.organizationId !== id) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const result = await query(
            `SELECT jr.id, jr.user_id, jr.organization_id, jr.status,
                    jr.created_at, jr.processed_at, jr.processed_by,
                    u.username, u.name, u.email
             FROM join_requests jr
             JOIN users u ON jr.user_id = u.id
             WHERE jr.organization_id = $1 AND jr.status = 'PENDING'
             ORDER BY jr.created_at DESC`,
            [id]
        );

        res.json(result.rows);
    } catch (error) {
        console.error('Get join requests error:', error);
        res.status(500).json({ error: 'Failed to fetch join requests' });
    }
});

// Create join request
router.post('/:id/join-request', async (req, res) => {
    try {
        const { id } = req.params;

        // Check if user already has an organization
        if (req.user.organizationId) {
            return res.status(400).json({ error: 'You are already part of an organization' });
        }

        // Check if organization exists
        const orgCheck = await query('SELECT id FROM organizations WHERE id = $1', [id]);
        if (orgCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Organization not found' });
        }

        // Check if request already exists
        const existingRequest = await query(
            'SELECT id FROM join_requests WHERE user_id = $1 AND organization_id = $2 AND status = $3',
            [req.user.id, id, 'PENDING']
        );

        if (existingRequest.rows.length > 0) {
            return res.status(400).json({ error: 'You already have a pending request for this organization' });
        }

        // Create join request
        const result = await query(
            `INSERT INTO join_requests (user_id, organization_id, status)
             VALUES ($1, $2, $3)
             RETURNING id, user_id, organization_id, status, created_at`,
            [req.user.id, id, 'PENDING']
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Create join request error:', error);
        res.status(500).json({ error: 'Failed to create join request' });
    }
});

// Approve join request
router.post('/:orgId/join-requests/:requestId/approved', async (req, res) => {
    try {
        const { orgId, requestId } = req.params;

        // Only admins can approve
        if (!['OWNER', 'ADMIN'].includes(req.user.role) || req.user.organizationId !== orgId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        // Get the request
        const requestResult = await query(
            'SELECT user_id FROM join_requests WHERE id = $1 AND organization_id = $2 AND status = $3',
            [requestId, orgId, 'PENDING']
        );

        if (requestResult.rows.length === 0) {
            return res.status(404).json({ error: 'Join request not found or already processed' });
        }

        const userId = requestResult.rows[0].user_id;

        // Update request status
        await query(
            `UPDATE join_requests
             SET status = $1, processed_at = NOW(), processed_by = $2
             WHERE id = $3`,
            ['APPROVED', req.user.id, requestId]
        );

        // Add user to organization
        await query(
            `UPDATE users
             SET organization_id = $1, role = $2, updated_at = NOW()
             WHERE id = $3`,
            [orgId, 'USER', userId]
        );

        // Audit log
        await logAudit(
            req.user.id,
            orgId,
            'JOIN_REQUEST_APPROVED',
            'join_request',
            requestId,
            { userId },
            req.ip,
            req.get('user-agent')
        );

        res.json({ message: 'Join request approved successfully' });
    } catch (error) {
        console.error('Approve join request error:', error);
        res.status(500).json({ error: 'Failed to approve join request' });
    }
});

// Reject join request
router.post('/:orgId/join-requests/:requestId/rejected', async (req, res) => {
    try {
        const { orgId, requestId } = req.params;

        // Only admins can reject
        if (!['OWNER', 'ADMIN'].includes(req.user.role) || req.user.organizationId !== orgId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const result = await query(
            `UPDATE join_requests
             SET status = $1, processed_at = NOW(), processed_by = $2
             WHERE id = $3 AND organization_id = $4 AND status = $5
             RETURNING user_id`,
            ['REJECTED', req.user.id, requestId, orgId, 'PENDING']
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Join request not found or already processed' });
        }

        // Audit log
        await logAudit(
            req.user.id,
            orgId,
            'JOIN_REQUEST_REJECTED',
            'join_request',
            requestId,
            { userId: result.rows[0].user_id },
            req.ip,
            req.get('user-agent')
        );

        res.json({ message: 'Join request rejected successfully' });
    } catch (error) {
        console.error('Reject join request error:', error);
        res.status(500).json({ error: 'Failed to reject join request' });
    }
});

export default router;
