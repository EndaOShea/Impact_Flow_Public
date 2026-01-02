import express from 'express';
import validator from 'validator';
import { query } from '../config/database.js';
import {
    hashPassword,
    verifyPassword,
    createSession,
    destroySession,
    generateRecoveryKey,
    logAudit
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

        const existingUser = await query(
            'SELECT id FROM users WHERE username = $1',
            [username.toLowerCase()]
        );

        if (existingUser.rows.length > 0) {
            return res.status(409).json({ error: 'Username already exists' });
        }

        const passwordHash = await hashPassword(password);
        const recoveryKey = generateRecoveryKey();

        const nameParts = name.trim().split(' ');
        const avatarInitials = nameParts.length >= 2
            ? `${nameParts[0][0]}${nameParts[1][0]}`.toUpperCase()
            : name.substring(0, 2).toUpperCase();

        const result = await query(
            `INSERT INTO users (username, password_hash, recovery_key, name, email, avatar_initials)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING id, username, name, email, avatar_initials, recovery_key`,
            [username.toLowerCase(), passwordHash, recoveryKey, name, email || null, avatarInitials]
        );

        const newUser = result.rows[0];

        await logAudit(newUser.id, 'USER_REGISTERED', 'user', newUser.id, { username }, req.ip, req.get('user-agent'));

        res.status(201).json({
            user: {
                id: newUser.id,
                username: newUser.username,
                name: newUser.name,
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

        const result = await query(
            `SELECT id, username, password_hash, name, email, avatar_initials
             FROM users
             WHERE username = $1`,
            [username.toLowerCase()]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }

        const user = result.rows[0];

        const isValid = await verifyPassword(password, user.password_hash);

        if (!isValid) {
            await logAudit(user.id, 'LOGIN_FAILED', 'user', user.id, { reason: 'invalid_password' }, req.ip, req.get('user-agent'));
            return res.status(401).json({ error: 'Invalid username or password' });
        }

        const sessionToken = await createSession(user.id, req.ip, req.get('user-agent'));

        await query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);

        await logAudit(user.id, 'LOGIN_SUCCESS', 'user', user.id, null, req.ip, req.get('user-agent'));

        const cookieOptions = {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 24 * 60 * 60 * 1000
        };

        res.cookie('session', sessionToken, cookieOptions);

        res.json({
            user: {
                id: user.id,
                username: user.username,
                name: user.name,
                avatarInitials: user.avatar_initials
            },
            sessionToken
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
            await logAudit(req.user.id, 'LOGOUT', 'user', req.user.id, null, req.ip, req.get('user-agent'));
        }

        res.clearCookie('session');
        res.json({ message: 'Logged out successfully' });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({ error: 'Logout failed' });
    }
});

// ============================================================================
// GET CURRENT USER
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
// PASSWORD RESET
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

        const result = await query(
            'SELECT id, username FROM users WHERE recovery_key = $1',
            [recoveryKey]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Invalid recovery key' });
        }

        const user = result.rows[0];
        const passwordHash = await hashPassword(newPassword);

        await query(
            'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
            [passwordHash, user.id]
        );

        await query('DELETE FROM sessions WHERE user_id = $1', [user.id]);

        await logAudit(user.id, 'PASSWORD_RESET', 'user', user.id, { method: 'recovery_key' }, req.ip, req.get('user-agent'));

        res.json({ message: 'Password reset successfully' });
    } catch (error) {
        console.error('Password reset error:', error);
        res.status(500).json({ error: 'Password reset failed' });
    }
});

// ============================================================================
// CHANGE PASSWORD
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

        const result = await query(
            'SELECT password_hash FROM users WHERE id = $1',
            [req.user.id]
        );

        const user = result.rows[0];
        const isValid = await verifyPassword(currentPassword, user.password_hash);

        if (!isValid) {
            return res.status(401).json({ error: 'Current password is incorrect' });
        }

        const passwordHash = await hashPassword(newPassword);

        await query(
            'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
            [passwordHash, req.user.id]
        );

        await logAudit(req.user.id, 'PASSWORD_CHANGED', 'user', req.user.id, null, req.ip, req.get('user-agent'));

        res.json({ message: 'Password changed successfully' });
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ error: 'Failed to change password' });
    }
});

// ============================================================================
// DELETE ACCOUNT
// ============================================================================

router.delete('/account', requireAuth, async (req, res) => {
    try {
        const { password } = req.body;

        if (!password) {
            return res.status(400).json({ error: 'Password is required to delete account' });
        }

        // Verify password before deletion
        const result = await query(
            'SELECT password_hash FROM users WHERE id = $1',
            [req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const user = result.rows[0];
        const isValid = await verifyPassword(password, user.password_hash);

        if (!isValid) {
            return res.status(401).json({ error: 'Incorrect password' });
        }

        // Log the account deletion before deleting
        await logAudit(req.user.id, 'ACCOUNT_DELETED', 'user', req.user.id, null, req.ip, req.get('user-agent'));

        // Delete all sessions for this user
        await query('DELETE FROM sessions WHERE user_id = $1', [req.user.id]);

        // Delete the user (CASCADE will handle related data)
        await query('DELETE FROM users WHERE id = $1', [req.user.id]);

        // Clear session cookie
        res.clearCookie('session');

        res.json({ message: 'Account deleted successfully' });
    } catch (error) {
        console.error('Delete account error:', error);
        res.status(500).json({ error: 'Failed to delete account' });
    }
});

export default router;
