import { argon2id } from 'hash-wasm';
import crypto from 'crypto';
import { query } from '../config/database.js';

// ============================================================================
// PASSWORD HASHING (Argon2id)
// ============================================================================

const generateSalt = () => {
    return crypto.randomBytes(16).toString('hex');
};

export const hashPassword = async (password) => {
    const salt = generateSalt();
    const hash = await argon2id({
        password,
        salt: new TextEncoder().encode(salt),
        parallelism: 1,
        iterations: 256,
        memorySize: 512,
        hashLength: 32,
        outputType: 'hex'
    });

    return `${salt}$${hash}`;
};

export const verifyPassword = async (password, storedHashString) => {
    const [salt, originalHash] = storedHashString.split('$');
    if (!salt || !originalHash) return false;

    const hash = await argon2id({
        password,
        salt: new TextEncoder().encode(salt),
        parallelism: 1,
        iterations: 256,
        memorySize: 512,
        hashLength: 32,
        outputType: 'hex'
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
// RECOVERY KEY GENERATION
// ============================================================================

export const generateRecoveryKey = () => {
    const part1 = crypto.randomBytes(2).toString('hex').toUpperCase();
    const part2 = crypto.randomBytes(2).toString('hex').toUpperCase();
    const part3 = crypto.randomBytes(2).toString('hex').toUpperCase();

    return `RK-${part1}-${part2}-${part3}`;
};

// ============================================================================
// API KEY ENCRYPTION
// ============================================================================

const API_KEY_ALGORITHM = 'aes-256-gcm';
const ENCRYPTION_SECRET = process.env.API_KEY_ENCRYPTION_SECRET || 'default-secret-change-this';

export const encryptApiKey = (apiKey) => {
    const key = crypto.scryptSync(ENCRYPTION_SECRET, 'salt', 32);
    const iv = crypto.randomBytes(16);

    const cipher = crypto.createCipheriv(API_KEY_ALGORITHM, key, iv);
    let encrypted = cipher.update(apiKey, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
};

export const decryptApiKey = (encryptedData) => {
    try {
        const [ivHex, authTagHex, encrypted] = encryptedData.split(':');
        const key = crypto.scryptSync(ENCRYPTION_SECRET, 'salt', 32);
        const iv = Buffer.from(ivHex, 'hex');
        const authTag = Buffer.from(authTagHex, 'hex');

        const decipher = crypto.createDecipheriv(API_KEY_ALGORITHM, key, iv);
        decipher.setAuthTag(authTag);

        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;
    } catch (error) {
        console.error('Failed to decrypt API key:', error);
        return null;
    }
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
