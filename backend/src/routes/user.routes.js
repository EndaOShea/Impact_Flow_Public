import express from 'express';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';
import { query } from '../config/database.js';
import { hashPassword } from '../utils/auth.js';

const router = express.Router();

// All user routes require authentication
router.use(requireAuth);

// ============================================================================
// GET ALL USERS (org-scoped)
// ============================================================================
router.get('/', async (req, res) => {
    try {
        const orgId = req.user.organizationId;

        if (!orgId) {
            return res.json([]); // No org = no users
        }

        const result = await query(
            `SELECT id, organization_id as "organizationId", username, name,
                    role, avatar_initials as "avatarInitials", created_at as "createdAt"
             FROM users
             WHERE organization_id = $1
             ORDER BY created_at DESC`,
            [orgId]
        );

        // Get team IDs for each user
        const usersWithTeams = await Promise.all(result.rows.map(async (user) => {
            const teamsResult = await query(
                'SELECT team_id FROM user_teams WHERE user_id = $1',
                [user.id]
            );
            return {
                ...user,
                teamIds: teamsResult.rows.map(r => r.team_id)
            };
        }));

        res.json(usersWithTeams);
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

// ============================================================================
// GET SINGLE USER
// ============================================================================
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const orgId = req.user.organizationId;

        const result = await query(
            `SELECT id, organization_id as "organizationId", username, name,
                    role, avatar_initials as "avatarInitials", created_at as "createdAt"
             FROM users
             WHERE id = $1 AND organization_id = $2`,
            [id, orgId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Get team IDs
        const teamsResult = await query(
            'SELECT team_id FROM user_teams WHERE user_id = $1',
            [id]
        );

        const user = {
            ...result.rows[0],
            teamIds: teamsResult.rows.map(r => r.team_id)
        };

        res.json(user);
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ error: 'Failed to fetch user' });
    }
});

// ============================================================================
// CREATE USER (admin only)
// ============================================================================
router.post('/', requireRole('OWNER', 'ADMIN'), async (req, res) => {
    try {
        const { username, password, name, role, teamIds } = req.body;
        const orgId = req.user.organizationId;

        if (!username || !password || !name) {
            return res.status(400).json({ error: 'Username, password, and name are required' });
        }

        // Hash password
        const passwordHash = await hashPassword(password);

        // Generate avatar initials
        const avatarInitials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

        // Create user
        const result = await query(
            `INSERT INTO users (organization_id, username, password_hash, name, role, avatar_initials)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING id, organization_id as "organizationId", username, name, role, avatar_initials as "avatarInitials", created_at as "createdAt"`,
            [orgId, username, passwordHash, name, role || 'USER', avatarInitials]
        );

        const user = result.rows[0];

        // Add to teams if specified
        if (teamIds && teamIds.length > 0) {
            for (const teamId of teamIds) {
                await query(
                    'INSERT INTO user_teams (user_id, team_id) VALUES ($1, $2)',
                    [user.id, teamId]
                );
            }
        }

        user.teamIds = teamIds || [];

        res.status(201).json(user);
    } catch (error) {
        console.error('Create user error:', error);
        if (error.code === '23505') { // Unique constraint violation
            return res.status(400).json({ error: 'Username already exists' });
        }
        res.status(500).json({ error: 'Failed to create user' });
    }
});

// ============================================================================
// UPDATE USER (admin only)
// ============================================================================
router.put('/:id', requireRole('OWNER', 'ADMIN'), async (req, res) => {
    try {
        const { id } = req.params;
        const { name, role, teamIds } = req.body;
        const orgId = req.user.organizationId;

        // Update user
        const result = await query(
            `UPDATE users
             SET name = COALESCE($1, name),
                 role = COALESCE($2, role),
                 updated_at = NOW()
             WHERE id = $3 AND organization_id = $4
             RETURNING id, organization_id as "organizationId", username, name, role, avatar_initials as "avatarInitials", created_at as "createdAt"`,
            [name, role, id, orgId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const user = result.rows[0];

        // Update teams if specified
        if (teamIds) {
            // Remove all existing teams
            await query('DELETE FROM user_teams WHERE user_id = $1', [id]);

            // Add new teams
            for (const teamId of teamIds) {
                await query(
                    'INSERT INTO user_teams (user_id, team_id) VALUES ($1, $2)',
                    [id, teamId]
                );
            }
            user.teamIds = teamIds;
        } else {
            // Get current teams
            const teamsResult = await query(
                'SELECT team_id FROM user_teams WHERE user_id = $1',
                [id]
            );
            user.teamIds = teamsResult.rows.map(r => r.team_id);
        }

        res.json(user);
    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({ error: 'Failed to update user' });
    }
});

// ============================================================================
// DELETE USER (admin only)
// ============================================================================
router.delete('/:id', requireRole('OWNER', 'ADMIN'), async (req, res) => {
    try {
        const { id } = req.params;
        const orgId = req.user.organizationId;

        // Cannot delete yourself
        if (id === req.user.id) {
            return res.status(400).json({ error: 'Cannot delete your own account' });
        }

        const result = await query(
            'DELETE FROM users WHERE id = $1 AND organization_id = $2 RETURNING id',
            [id, orgId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({ message: 'User deleted successfully' });
    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ error: 'Failed to delete user' });
    }
});

export default router;
