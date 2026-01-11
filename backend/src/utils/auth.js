import { argon2id } from 'hash-wasm';
import crypto from 'crypto';
import { query } from '../config/database.js';

// ============================================================================
// PASSWORD HASHING (Argon2id)
// ============================================================================

const generateSalt = () => {
    return crypto.randomBytes(16).toString('hex');
};

// Argon2id configuration - OWASP recommended settings
// Memory: 64MB (65536 KB) - provides strong resistance to GPU/ASIC attacks
// Iterations: 3 - balanced with higher memory for similar security
// Parallelism: 1 - single-threaded for consistent timing
const ARGON2_CONFIG = {
    parallelism: 1,
    iterations: 3,
    memorySize: 65536, // 64MB in KB
    hashLength: 32,
    outputType: 'hex'
};

export const hashPassword = async (password) => {
    const salt = generateSalt();
    const hash = await argon2id({
        password,
        salt: new TextEncoder().encode(salt),
        ...ARGON2_CONFIG
    });

    return `${salt}$${hash}`;
};

export const verifyPassword = async (password, storedHashString) => {
    const [salt, originalHash] = storedHashString.split('$');
    if (!salt || !originalHash) return false;

    const hash = await argon2id({
        password,
        salt: new TextEncoder().encode(salt),
        ...ARGON2_CONFIG
    });

    return hash === originalHash;
};

// ============================================================================
// SESSION MANAGEMENT
// ============================================================================

export const generateSessionToken = () => {
    return crypto.randomBytes(32).toString('hex');
};

export const hashToken = (token) => {
    return crypto.createHash('sha256').update(token).digest('hex');
};

export const createSession = async (userId, ipAddress, userAgent) => {
    const token = generateSessionToken();
    const tokenHash = hashToken(token);

    const expiresAt = new Date();
    const durationHours = parseInt(process.env.SESSION_DURATION_HOURS) || 24;
    expiresAt.setHours(expiresAt.getHours() + durationHours);

    await query(
        `INSERT INTO sessions (user_id, token_hash, ip_address, user_agent, expires_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [userId, tokenHash, ipAddress, userAgent, expiresAt]
    );

    return token;
};

export const validateSession = async (token) => {
    if (!token) return null;

    const tokenHash = hashToken(token);

    const result = await query(
        `SELECT s.*, u.id as user_id, u.username, u.name, u.email, u.avatar_initials
         FROM sessions s
         JOIN users u ON s.user_id = u.id
         WHERE s.token_hash = $1 AND s.expires_at > NOW()`,
        [tokenHash]
    );

    if (result.rows.length === 0) return null;

    const session = result.rows[0];

    await query(
        'UPDATE sessions SET last_activity = NOW() WHERE token_hash = $1',
        [tokenHash]
    );

    return {
        id: session.user_id,
        username: session.username,
        name: session.name,
        avatarInitials: session.avatar_initials
    };
};

export const destroySession = async (token) => {
    if (!token) return;

    const tokenHash = hashToken(token);
    await query('DELETE FROM sessions WHERE token_hash = $1', [tokenHash]);
};

export const cleanupExpiredSessions = async () => {
    const result = await query('DELETE FROM sessions WHERE expires_at < NOW()');
    if (result.rowCount > 0) {
        console.log(`Cleaned up ${result.rowCount} expired sessions`);
    }
};

// ============================================================================
// PASSWORD HISTORY (Prevent reuse of recent passwords)
// ============================================================================

const PASSWORD_HISTORY_LIMIT = 5; // Remember last 5 passwords

export const checkPasswordHistory = async (userId, newPassword) => {
    const result = await query(
        `SELECT password_hash FROM password_history
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT $2`,
        [userId, PASSWORD_HISTORY_LIMIT]
    );

    for (const row of result.rows) {
        const matches = await verifyPassword(newPassword, row.password_hash);
        if (matches) {
            return true; // Password was used recently
        }
    }
    return false; // Password is not in history
};

export const savePasswordToHistory = async (userId, passwordHash) => {
    // Save current password to history
    await query(
        'INSERT INTO password_history (user_id, password_hash) VALUES ($1, $2)',
        [userId, passwordHash]
    );

    // Cleanup old entries, keep only the most recent ones
    await query(
        `DELETE FROM password_history
         WHERE user_id = $1
         AND id NOT IN (
             SELECT id FROM password_history
             WHERE user_id = $1
             ORDER BY created_at DESC
             LIMIT $2
         )`,
        [userId, PASSWORD_HISTORY_LIMIT]
    );
};

// ============================================================================
// RECOVERY KEY GENERATION & HASHING
// ============================================================================

export const generateRecoveryKey = () => {
    const part1 = crypto.randomBytes(2).toString('hex').toUpperCase();
    const part2 = crypto.randomBytes(2).toString('hex').toUpperCase();
    const part3 = crypto.randomBytes(2).toString('hex').toUpperCase();

    return `RK-${part1}-${part2}-${part3}`;
};

export const hashRecoveryKey = (recoveryKey) => {
    // Normalize the recovery key (uppercase, trimmed) before hashing
    const normalized = recoveryKey.trim().toUpperCase();
    return crypto.createHash('sha256').update(normalized).digest('hex');
};

// ============================================================================
// AUDIT LOGGING
// ============================================================================

export const logAudit = async (userId, action, resourceType, resourceId, details, ipAddress, userAgent) => {
    await query(
        `INSERT INTO audit_log (user_id, action, resource_type, resource_id, details, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [userId, action, resourceType, resourceId, details ? JSON.stringify(details) : null, ipAddress, userAgent]
    );
};
