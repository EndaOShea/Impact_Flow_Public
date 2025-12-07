import express from 'express';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';
import { query } from '../config/database.js';

const router = express.Router();

// All team routes require authentication
router.use(requireAuth);

// ============================================================================
// GET ALL TEAMS (org-scoped)
// ============================================================================
router.get('/', async (req, res) => {
    try {
        const orgId = req.user.organizationId;

        if (!orgId) {
            return res.json([]); // No org = no teams
        }

        const result = await query(
            `SELECT id, organization_id as "organizationId", name, color, created_at as "createdAt"
             FROM teams
             WHERE organization_id = $1
             ORDER BY created_at DESC`,
            [orgId]
        );

        res.json(result.rows);
    } catch (error) {
        console.error('Get teams error:', error);
        res.status(500).json({ error: 'Failed to fetch teams' });
    }
});

// ============================================================================
// GET SINGLE TEAM
// ============================================================================
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const orgId = req.user.organizationId;

        const result = await query(
            `SELECT id, organization_id as "organizationId", name, color, created_at as "createdAt"
             FROM teams
             WHERE id = $1 AND organization_id = $2`,
            [id, orgId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Team not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Get team error:', error);
        res.status(500).json({ error: 'Failed to fetch team' });
    }
});

// ============================================================================
// CREATE TEAM (admin only)
// ============================================================================
router.post('/', requireRole('OWNER', 'ADMIN', 'TEAM_ADMIN'), async (req, res) => {
    try {
        const { id, name, color } = req.body;
        const orgId = req.user.organizationId;

        if (!name) {
            return res.status(400).json({ error: 'Team name is required' });
        }

        const result = await query(
            `INSERT INTO teams (id, organization_id, name, color)
             VALUES ($1, $2, $3, $4)
             RETURNING id, organization_id as "organizationId", name, color, created_at as "createdAt"`,
            [id, orgId, name, color || 'bg-blue-500']
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Create team error:', error);
        if (error.code === '23505') { // Unique constraint violation
            return res.status(400).json({ error: 'Team already exists' });
        }
        res.status(500).json({ error: 'Failed to create team' });
    }
});

// ============================================================================
// UPDATE TEAM (admin only)
// ============================================================================
router.put('/:id', requireRole('OWNER', 'ADMIN', 'TEAM_ADMIN'), async (req, res) => {
    try {
        const { id } = req.params;
        const { name, color } = req.body;
        const orgId = req.user.organizationId;

        const result = await query(
            `UPDATE teams
             SET name = COALESCE($1, name),
                 color = COALESCE($2, color)
             WHERE id = $3 AND organization_id = $4
             RETURNING id, organization_id as "organizationId", name, color, created_at as "createdAt"`,
            [name, color, id, orgId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Team not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Update team error:', error);
        res.status(500).json({ error: 'Failed to update team' });
    }
});

// ============================================================================
// DELETE TEAM (admin only)
// ============================================================================
router.delete('/:id', requireRole('OWNER', 'ADMIN', 'TEAM_ADMIN'), async (req, res) => {
    try {
        const { id } = req.params;
        const orgId = req.user.organizationId;

        const result = await query(
            'DELETE FROM teams WHERE id = $1 AND organization_id = $2 RETURNING id',
            [id, orgId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Team not found' });
        }

        res.json({ message: 'Team deleted successfully' });
    } catch (error) {
        console.error('Delete team error:', error);
        res.status(500).json({ error: 'Failed to delete team' });
    }
});

export default router;
