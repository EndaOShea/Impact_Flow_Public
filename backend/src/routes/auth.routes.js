import express from 'express';
import validator from 'validator';
import { query } from '../config/database.js';
import {
    hashPassword,
    verifyPassword,
    createSession,
    destroySession,
    generateRecoveryKey,
    hashRecoveryKey,
    hashToken,
    checkPasswordHistory,
    savePasswordToHistory,
    logAudit
} from '../utils/auth.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { authRateLimiter, recoveryRateLimiter } from '../middleware/security.middleware.js';

const router = express.Router();

// Password complexity regex - must match frontend validation
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
const PASSWORD_ERROR = 'Password must be at least 8 characters with uppercase, lowercase, number, and special character (@$!%*?&)';

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

        if (!PASSWORD_REGEX.test(password)) {
            return res.status(400).json({ error: PASSWORD_ERROR });
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
        const recoveryKeyHash = hashRecoveryKey(recoveryKey);

        const nameParts = name.trim().split(' ');
        const avatarInitials = nameParts.length >= 2
            ? `${nameParts[0][0]}${nameParts[1][0]}`.toUpperCase()
            : name.substring(0, 2).toUpperCase();

        const result = await query(
            `INSERT INTO users (username, password_hash, recovery_key, name, email, avatar_initials)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING id, username, name, email, avatar_initials`,
            [username.toLowerCase(), passwordHash, recoveryKeyHash, name, email || null, avatarInitials]
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
            recoveryKey: recoveryKey,
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

// Account lockout configuration
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 15;

router.post('/login', authRateLimiter, async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }

        const result = await query(
            `SELECT id, username, password_hash, name, email, avatar_initials,
                    failed_login_attempts, locked_until
             FROM users
             WHERE username = $1`,
            [username.toLowerCase()]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }

        const user = result.rows[0];

        // Check if account is locked
        if (user.locked_until && new Date(user.locked_until) > new Date()) {
            const remainingMinutes = Math.ceil((new Date(user.locked_until) - new Date()) / 60000);
            await logAudit(user.id, 'LOGIN_BLOCKED', 'user', user.id, { reason: 'account_locked' }, req.ip, req.get('user-agent'));
            return res.status(423).json({
                error: `Account is temporarily locked. Try again in ${remainingMinutes} minute(s).`,
                lockedUntil: user.locked_until
            });
        }

        const isValid = await verifyPassword(password, user.password_hash);

        if (!isValid) {
            // Increment failed attempts
            const newFailedAttempts = (user.failed_login_attempts || 0) + 1;
            let lockUntil = null;

            // Lock account if max attempts reached
            if (newFailedAttempts >= MAX_FAILED_ATTEMPTS) {
                lockUntil = new Date(Date.now() + LOCKOUT_DURATION_MINUTES * 60 * 1000);
                await logAudit(user.id, 'ACCOUNT_LOCKED', 'user', user.id,
                    { failed_attempts: newFailedAttempts, locked_for_minutes: LOCKOUT_DURATION_MINUTES },
                    req.ip, req.get('user-agent'));
            }

            await query(
                'UPDATE users SET failed_login_attempts = $1, locked_until = $2 WHERE id = $3',
                [newFailedAttempts, lockUntil, user.id]
            );

            await logAudit(user.id, 'LOGIN_FAILED', 'user', user.id,
                { reason: 'invalid_password', attempt: newFailedAttempts },
                req.ip, req.get('user-agent'));

            const attemptsRemaining = MAX_FAILED_ATTEMPTS - newFailedAttempts;
            if (attemptsRemaining > 0) {
                return res.status(401).json({
                    error: `Invalid username or password. ${attemptsRemaining} attempt(s) remaining before lockout.`
                });
            } else {
                return res.status(423).json({
                    error: `Account locked for ${LOCKOUT_DURATION_MINUTES} minutes due to too many failed attempts.`,
                    lockedUntil: lockUntil
                });
            }
        }

        // Successful login - reset failed attempts
        const sessionToken = await createSession(user.id, req.ip, req.get('user-agent'));

        await query(
            'UPDATE users SET last_login = NOW(), failed_login_attempts = 0, locked_until = NULL WHERE id = $1',
            [user.id]
        );

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

router.post('/reset-password', recoveryRateLimiter, async (req, res) => {
    try {
        const { recoveryKey, newPassword } = req.body;

        if (!recoveryKey || !newPassword) {
            return res.status(400).json({ error: 'Recovery key and new password are required' });
        }

        if (!PASSWORD_REGEX.test(newPassword)) {
            return res.status(400).json({ error: PASSWORD_ERROR });
        }

        const recoveryKeyHash = hashRecoveryKey(recoveryKey);

        const result = await query(
            'SELECT id, username, password_hash FROM users WHERE recovery_key = $1',
            [recoveryKeyHash]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Invalid recovery key' });
        }

        const user = result.rows[0];

        // Check if new password matches current password
        const matchesCurrent = await verifyPassword(newPassword, user.password_hash);
        if (matchesCurrent) {
            return res.status(400).json({ error: 'New password must be different from current password' });
        }

        // Check password history
        const inHistory = await checkPasswordHistory(user.id, newPassword);
        if (inHistory) {
            return res.status(400).json({ error: 'Cannot reuse one of your last 5 passwords' });
        }

        // Save current password to history before resetting
        await savePasswordToHistory(user.id, user.password_hash);

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

        if (!PASSWORD_REGEX.test(newPassword)) {
            return res.status(400).json({ error: PASSWORD_ERROR });
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

        // Check if new password matches current password
        const matchesCurrent = await verifyPassword(newPassword, user.password_hash);
        if (matchesCurrent) {
            return res.status(400).json({ error: 'New password must be different from current password' });
        }

        // Check password history
        const inHistory = await checkPasswordHistory(req.user.id, newPassword);
        if (inHistory) {
            return res.status(400).json({ error: 'Cannot reuse one of your last 5 passwords' });
        }

        // Save current password to history before changing
        await savePasswordToHistory(req.user.id, user.password_hash);

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

// ============================================================================
// SESSION MANAGEMENT
// ============================================================================

// Get all active sessions for current user
router.get('/sessions', requireAuth, async (req, res) => {
    try {
        const currentToken = req.cookies?.session || req.headers.authorization?.replace('Bearer ', '');
        const currentTokenHash = currentToken ? hashToken(currentToken) : null;

        const result = await query(
            `SELECT id, ip_address, user_agent, created_at, last_activity, expires_at,
                    (token_hash = $2) as is_current
             FROM sessions
             WHERE user_id = $1 AND expires_at > NOW()
             ORDER BY last_activity DESC`,
            [req.user.id, currentTokenHash]
        );

        const sessions = result.rows.map(session => ({
            id: session.id,
            ipAddress: session.ip_address,
            userAgent: session.user_agent,
            createdAt: session.created_at,
            lastActivity: session.last_activity,
            expiresAt: session.expires_at,
            isCurrent: session.is_current
        }));

        res.json({ sessions });
    } catch (error) {
        console.error('Get sessions error:', error);
        res.status(500).json({ error: 'Failed to get sessions' });
    }
});

// Revoke a specific session
router.delete('/sessions/:sessionId', requireAuth, async (req, res) => {
    try {
        const { sessionId } = req.params;
        const currentToken = req.cookies?.session || req.headers.authorization?.replace('Bearer ', '');
        const currentTokenHash = currentToken ? hashToken(currentToken) : null;

        // Check if session exists and belongs to user
        const sessionResult = await query(
            'SELECT id, token_hash FROM sessions WHERE id = $1 AND user_id = $2',
            [sessionId, req.user.id]
        );

        if (sessionResult.rows.length === 0) {
            return res.status(404).json({ error: 'Session not found' });
        }

        const session = sessionResult.rows[0];

        // Prevent revoking current session via this endpoint
        if (session.token_hash === currentTokenHash) {
            return res.status(400).json({ error: 'Cannot revoke current session. Use logout instead.' });
        }

        await query('DELETE FROM sessions WHERE id = $1', [sessionId]);

        await logAudit(req.user.id, 'SESSION_REVOKED', 'session', sessionId, null, req.ip, req.get('user-agent'));

        res.json({ message: 'Session revoked successfully' });
    } catch (error) {
        console.error('Revoke session error:', error);
        res.status(500).json({ error: 'Failed to revoke session' });
    }
});

// Revoke all sessions except current
router.delete('/sessions', requireAuth, async (req, res) => {
    try {
        const currentToken = req.cookies?.session || req.headers.authorization?.replace('Bearer ', '');
        const currentTokenHash = currentToken ? hashToken(currentToken) : null;

        const result = await query(
            'DELETE FROM sessions WHERE user_id = $1 AND token_hash != $2',
            [req.user.id, currentTokenHash]
        );

        await logAudit(req.user.id, 'ALL_SESSIONS_REVOKED', 'session', null,
            { count: result.rowCount }, req.ip, req.get('user-agent'));

        res.json({
            message: 'All other sessions revoked successfully',
            revokedCount: result.rowCount
        });
    } catch (error) {
        console.error('Revoke all sessions error:', error);
        res.status(500).json({ error: 'Failed to revoke sessions' });
    }
});

export default router;
