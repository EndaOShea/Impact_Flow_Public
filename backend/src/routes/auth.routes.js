import express from 'express';
import validator from 'validator';
import { query } from '../config/database.js';
import {
    hashPassword,
    verifyPassword,
    createSession,
    destroySession,
    generateRecoveryKey,
    logAudit,
    encryptApiKey,
    decryptApiKey
} from '../utils/auth.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { authRateLimiter } from '../middleware/security.middleware.js';

const router = express.Router();

// ============================================================================
// REGISTER NEW USER
// ============================================================================

router.post('/register', authRateLimiter, async (req, res) => {
    try {
        const { username, password, name, email } = req.body;

        // Validation
        if (!username || !password || !name) {
            return res.status(400).json({ error: 'Username, password, and name are required' });
        }

        if (username.length < 3 || username.length > 50) {
            return res.status(400).json({ error: 'Username must be 3-50 characters' });
        }

        if (password.length < 8) {
            return res.status(400).json({ error: 'Password must be at least 8 characters' });
        }

        if (email && !validator.isEmail(email)) {
            return res.status(400).json({ error: 'Invalid email format' });
        }

        // Check if username exists
        const existingUser = await query(
            'SELECT id FROM users WHERE username = $1',
            [username.toLowerCase()]
        );

        if (existingUser.rows.length > 0) {
            return res.status(409).json({ error: 'Username already exists' });
        }

        // Hash password
        const passwordHash = await hashPassword(password);

        // Generate recovery key
        const recoveryKey = generateRecoveryKey();

        // Generate avatar initials
        const nameParts = name.trim().split(' ');
        const avatarInitials = nameParts.length >= 2
            ? `${nameParts[0][0]}${nameParts[1][0]}`.toUpperCase()
            : name.substring(0, 2).toUpperCase();

        // Create user (no organization yet - will join later)
        const result = await query(
            `INSERT INTO users (username, password_hash, recovery_key, name, email, role, avatar_initials)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING id, username, name, email, role, avatar_initials, recovery_key`,
            [username.toLowerCase(), passwordHash, recoveryKey, name, email || null, 'USER', avatarInitials]
        );

        const newUser = result.rows[0];

        // Audit log
        await logAudit(
            newUser.id,
            null,
            'USER_REGISTERED',
            'user',
            newUser.id,
            { username },
            req.ip,
            req.get('user-agent')
        );

        res.status(201).json({
            user: {
                id: newUser.id,
                username: newUser.username,
                name: newUser.name,
                email: newUser.email,
                role: newUser.role,
                avatarInitials: newUser.avatar_initials
            },
            recoveryKey: newUser.recovery_key,
            message: 'User created successfully. Save your recovery key!'
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
});

// ============================================================================
// LOGIN
// ============================================================================

router.post('/login', authRateLimiter, async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }

        // Find user
        const result = await query(
            `SELECT id, username, password_hash, name, email, role, organization_id, avatar_initials
             FROM users
             WHERE username = $1`,
            [username.toLowerCase()]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }

        const user = result.rows[0];

        // Verify password
        const isValid = await verifyPassword(password, user.password_hash);

        if (!isValid) {
            await logAudit(
                user.id,
                user.organization_id,
                'LOGIN_FAILED',
                'user',
                user.id,
                { reason: 'invalid_password' },
                req.ip,
                req.get('user-agent')
            );
            return res.status(401).json({ error: 'Invalid username or password' });
        }

        // Get user's teams
        const teamsResult = await query(
            'SELECT team_id FROM user_teams WHERE user_id = $1',
            [user.id]
        );

        const teamIds = teamsResult.rows.map(r => r.team_id);

        // Create session
        const sessionToken = await createSession(
            user.id,
            req.ip,
            req.get('user-agent')
        );

        // Update last login
        await query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);

        // Audit log
        await logAudit(
            user.id,
            user.organization_id,
            'LOGIN_SUCCESS',
            'user',
            user.id,
            null,
            req.ip,
            req.get('user-agent')
        );

        // Set secure cookie
        const cookieOptions = {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 24 * 60 * 60 * 1000 // 24 hours
        };

        res.cookie('session', sessionToken, cookieOptions);

        res.json({
            user: {
                id: user.id,
                username: user.username,
                name: user.name,
                email: user.email,
                role: user.role,
                organizationId: user.organization_id,
                avatarInitials: user.avatar_initials,
                teamIds
            },
            sessionToken // Also return in body for clients that prefer headers
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// ============================================================================
// LOGOUT
// ============================================================================

router.post('/logout', requireAuth, async (req, res) => {
    try {
        const token = req.cookies?.session || req.headers.authorization?.replace('Bearer ', '');

        if (token) {
            await destroySession(token);

            // Audit log
            await logAudit(
                req.user.id,
                req.user.organizationId,
                'LOGOUT',
                'user',
                req.user.id,
                null,
                req.ip,
                req.get('user-agent')
            );
        }

        res.clearCookie('session');
        res.json({ message: 'Logged out successfully' });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({ error: 'Logout failed' });
    }
});

// ============================================================================
// GET CURRENT USER (Session Check)
// ============================================================================

router.get('/me', requireAuth, async (req, res) => {
    try {
        res.json({ user: req.user });
    } catch (error) {
        console.error('Get current user error:', error);
        res.status(500).json({ error: 'Failed to get user info' });
    }
});

// ============================================================================
// PASSWORD RESET (Using Recovery Key)
// ============================================================================

router.post('/reset-password', authRateLimiter, async (req, res) => {
    try {
        const { recoveryKey, newPassword } = req.body;

        if (!recoveryKey || !newPassword) {
            return res.status(400).json({ error: 'Recovery key and new password are required' });
        }

        if (newPassword.length < 8) {
            return res.status(400).json({ error: 'Password must be at least 8 characters' });
        }

        // Find user by recovery key
        const result = await query(
            'SELECT id, username, organization_id FROM users WHERE recovery_key = $1',
            [recoveryKey]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Invalid recovery key' });
        }

        const user = result.rows[0];

        // Hash new password
        const passwordHash = await hashPassword(newPassword);

        // Update password
        await query(
            'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
            [passwordHash, user.id]
        );

        // Destroy all existing sessions for this user
        await query('DELETE FROM sessions WHERE user_id = $1', [user.id]);

        // Audit log
        await logAudit(
            user.id,
            user.organization_id,
            'PASSWORD_RESET',
            'user',
            user.id,
            { method: 'recovery_key' },
            req.ip,
            req.get('user-agent')
        );

        res.json({ message: 'Password reset successfully' });
    } catch (error) {
        console.error('Password reset error:', error);
        res.status(500).json({ error: 'Password reset failed' });
    }
});

// ============================================================================
// CHANGE PASSWORD (Authenticated)
// ============================================================================

router.post('/change-password', requireAuth, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'Current and new password are required' });
        }

        if (newPassword.length < 8) {
            return res.status(400).json({ error: 'New password must be at least 8 characters' });
        }

        // Get current password hash
        const result = await query(
            'SELECT password_hash FROM users WHERE id = $1',
            [req.user.id]
        );

        const user = result.rows[0];

        // Verify current password
        const isValid = await verifyPassword(currentPassword, user.password_hash);

        if (!isValid) {
            return res.status(401).json({ error: 'Current password is incorrect' });
        }

        // Hash new password
        const passwordHash = await hashPassword(newPassword);

        // Update password
        await query(
            'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
            [passwordHash, req.user.id]
        );

        // Audit log
        await logAudit(
            req.user.id,
            req.user.organizationId,
            'PASSWORD_CHANGED',
            'user',
            req.user.id,
            null,
            req.ip,
            req.get('user-agent')
        );

        res.json({ message: 'Password changed successfully' });
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ error: 'Failed to change password' });
    }
});

// ============================================================================
// API KEY MANAGEMENT (User-specific encrypted keys)
// ============================================================================

/**
 * Store/Update API key for a service
 * POST /auth/api-key
 * Body: { serviceName: string, apiKey: string }
 */
router.post('/api-key', requireAuth, async (req, res) => {
    try {
        const { serviceName, apiKey } = req.body;

        if (!serviceName || !apiKey) {
            return res.status(400).json({ error: 'Service name and API key are required' });
        }

        // Validate service name
        const allowedServices = ['gemini', 'openai'];
        if (!allowedServices.includes(serviceName.toLowerCase())) {
            return res.status(400).json({ error: 'Invalid service name' });
        }

        // Encrypt the API key
        const encryptedKey = encryptApiKey(apiKey);

        // Check if key already exists
        const existing = await query(
            'SELECT id FROM user_api_keys WHERE user_id = $1 AND service_name = $2',
            [req.user.id, serviceName.toLowerCase()]
        );

        if (existing.rows.length > 0) {
            // Update existing key
            await query(
                `UPDATE user_api_keys
                 SET encrypted_key = $1, updated_at = NOW()
                 WHERE user_id = $2 AND service_name = $3`,
                [encryptedKey, req.user.id, serviceName.toLowerCase()]
            );
        } else {
            // Insert new key
            await query(
                `INSERT INTO user_api_keys (user_id, service_name, encrypted_key)
                 VALUES ($1, $2, $3)`,
                [req.user.id, serviceName.toLowerCase(), encryptedKey]
            );
        }

        // Audit log
        await logAudit(
            req.user.id,
            req.user.organizationId,
            'API_KEY_STORED',
            'api_key',
            null,
            { serviceName },
            req.ip,
            req.get('user-agent')
        );

        res.json({ message: 'API key stored successfully' });
    } catch (error) {
        console.error('Store API key error:', error);
        res.status(500).json({ error: 'Failed to store API key' });
    }
});

/**
 * Get decrypted API key for a service
 * GET /auth/api-key/:serviceName
 */
router.get('/api-key/:serviceName', requireAuth, async (req, res) => {
    try {
        const { serviceName } = req.params;

        const result = await query(
            `SELECT encrypted_key, updated_at
             FROM user_api_keys
             WHERE user_id = $1 AND service_name = $2`,
            [req.user.id, serviceName.toLowerCase()]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'API key not found' });
        }

        const decryptedKey = decryptApiKey(result.rows[0].encrypted_key);

        if (!decryptedKey) {
            return res.status(500).json({ error: 'Failed to decrypt API key' });
        }

        res.json({ apiKey: decryptedKey });
    } catch (error) {
        console.error('Get API key error:', error);
        res.status(500).json({ error: 'Failed to retrieve API key' });
    }
});

/**
 * Check if API key exists for a service
 * GET /auth/api-key/:serviceName/check
 */
router.get('/api-key/:serviceName/check', requireAuth, async (req, res) => {
    try {
        const { serviceName } = req.params;

        const result = await query(
            'SELECT id FROM user_api_keys WHERE user_id = $1 AND service_name = $2',
            [req.user.id, serviceName.toLowerCase()]
        );

        res.json({ exists: result.rows.length > 0 });
    } catch (error) {
        console.error('Check API key error:', error);
        res.status(500).json({ error: 'Failed to check API key' });
    }
});

/**
 * Get API key metadata (without decrypting)
 * GET /auth/api-key/:serviceName/metadata
 */
router.get('/api-key/:serviceName/metadata', requireAuth, async (req, res) => {
    try {
        const { serviceName } = req.params;

        const result = await query(
            'SELECT created_at, updated_at FROM user_api_keys WHERE user_id = $1 AND service_name = $2',
            [req.user.id, serviceName.toLowerCase()]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'API key not found' });
        }

        const row = result.rows[0];
        res.json({
            createdAt: row.created_at,
            lastUsed: row.updated_at
        });
    } catch (error) {
        console.error('Get API key metadata error:', error);
        res.status(500).json({ error: 'Failed to get API key metadata' });
    }
});

/**
 * Delete API key for a service
 * DELETE /auth/api-key/:serviceName
 */
router.delete('/api-key/:serviceName', requireAuth, async (req, res) => {
    try {
        const { serviceName } = req.params;

        const result = await query(
            'DELETE FROM user_api_keys WHERE user_id = $1 AND service_name = $2 RETURNING id',
            [req.user.id, serviceName.toLowerCase()]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'API key not found' });
        }

        // Audit log
        await logAudit(
            req.user.id,
            req.user.organizationId,
            'API_KEY_DELETED',
            'api_key',
            null,
            { serviceName },
            req.ip,
            req.get('user-agent')
        );

        res.json({ message: 'API key deleted successfully' });
    } catch (error) {
        console.error('Delete API key error:', error);
        res.status(500).json({ error: 'Failed to delete API key' });
    }
});

export default router;
