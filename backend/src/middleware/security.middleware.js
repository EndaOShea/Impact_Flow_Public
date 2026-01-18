import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import cors from 'cors';
import { query } from '../config/database.js';

// CORS configuration
export const corsMiddleware = cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true, // Allow cookies
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization']
});

// Helmet security headers
export const helmetMiddleware = helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", 'data:', 'https:']
        }
    },
    crossOriginEmbedderPolicy: false // For file uploads
});

// Rate limiting for general API
export const generalRateLimiter = rateLimit({
    windowMs: (parseInt(process.env.RATE_LIMIT_WINDOW_MINUTES) || 15) * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
    message: { error: 'Too many requests, please try again later' },
    standardHeaders: true,
    legacyHeaders: false,
    // Use IP address for rate limiting
    keyGenerator: (req) => {
        return req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    }
});

// Stricter rate limiting for authentication endpoints
export const authRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts per 15 minutes
    message: { error: 'Too many login attempts, please try again later' },
    skipSuccessfulRequests: true, // Don't count successful requests
    keyGenerator: (req) => {
        // Rate limit by IP + username combo
        const username = req.body.username || '';
        return `${req.ip}-${username}`;
    }
});

// Very strict rate limiting for password reset (recovery key has limited entropy)
export const recoveryRateLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // 3 attempts per hour
    message: { error: 'Too many password reset attempts, please try again later' },
    keyGenerator: (req) => {
        return req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    }
});

// Request logging middleware
export const requestLogger = (req, res, next) => {
    const start = Date.now();

    // Log after response
    res.on('finish', () => {
        const duration = Date.now() - start;
        const logLevel = res.statusCode >= 400 ? 'error' : 'info';

        if (process.env.LOG_LEVEL === 'debug' || logLevel === 'error') {
            console.log({
                method: req.method,
                path: req.path,
                status: res.statusCode,
                duration: `${duration}ms`,
                ip: req.ip,
                user: req.user?.username || 'anonymous'
            });
        }
    });

    next();
};

// Visit tracking middleware (tracks API usage for analytics)
export const trackVisits = async (req, res, next) => {
    // Only track if user is authenticated
    if (req.user && req.user.id) {
        // Don't track health checks, static assets, or analytics tracking itself
        if (
            !req.path.includes('/health') &&
            !req.path.includes('/analytics/track') &&
            req.method !== 'OPTIONS'
        ) {
            // Track navigation/API call asynchronously (don't block request)
            setImmediate(async () => {
                try {
                    let eventType = 'api_call';
                    let eventCategory = 'navigation';

                    // Categorize the event
                    if (req.path.includes('/auth')) {
                        eventCategory = 'auth';
                        if (req.path.includes('/login')) eventType = 'login';
                        else if (req.path.includes('/logout')) eventType = 'logout';
                    } else if (req.path.includes('/tasks')) {
                        eventCategory = 'task';
                        if (req.method === 'POST') eventType = 'task_created';
                        else if (req.method === 'PUT' || req.method === 'PATCH') eventType = 'task_updated';
                        else if (req.method === 'DELETE') eventType = 'task_deleted';
                        else eventType = 'task_viewed';
                    } else if (req.path.includes('/projects')) {
                        eventCategory = 'project';
                        if (req.method === 'POST') eventType = 'project_created';
                        else if (req.method === 'PUT' || req.method === 'PATCH') eventType = 'project_updated';
                        else eventType = 'project_viewed';
                    }

                    await query(
                        `INSERT INTO usage_analytics (user_id, event_type, event_category, ip_address, user_agent)
                         VALUES ($1, $2, $3, $4, $5)`,
                        [
                            req.user.id,
                            eventType,
                            eventCategory,
                            req.ip,
                            req.get('user-agent')
                        ]
                    );
                } catch (error) {
                    // Silently fail - don't break the request
                    console.error('Visit tracking error:', error);
                }
            });
        }
    }

    next();
};

// Input sanitization middleware
export const sanitizeInput = (req, res, next) => {
    // Trim all string inputs
    const sanitize = (obj) => {
        if (typeof obj === 'string') {
            return obj.trim();
        }
        if (Array.isArray(obj)) {
            return obj.map(sanitize);
        }
        if (obj && typeof obj === 'object') {
            const sanitized = {};
            for (const key in obj) {
                sanitized[key] = sanitize(obj[key]);
            }
            return sanitized;
        }
        return obj;
    };

    if (req.body) {
        req.body = sanitize(req.body);
    }
    if (req.query) {
        req.query = sanitize(req.query);
    }

    next();
};

// Error handling middleware
export const errorHandler = (err, req, res, next) => {
    console.error('Error:', err);

    // PostgreSQL errors
    if (err.code) {
        switch (err.code) {
            case '23505': // Unique violation
                return res.status(409).json({ error: 'Resource already exists' });
            case '23503': // Foreign key violation
                return res.status(400).json({ error: 'Referenced resource does not exist' });
            case '23502': // Not null violation
                return res.status(400).json({ error: 'Required field missing' });
            default:
                console.error('Database error:', err.code, err.message);
        }
    }

    // Validation errors
    if (err.name === 'ValidationError') {
        return res.status(400).json({ error: err.message });
    }

    // Default error
    const statusCode = err.statusCode || 500;
    const message = process.env.NODE_ENV === 'production'
        ? 'Internal server error'
        : err.message;

    res.status(statusCode).json({ error: message });
};

// 404 handler
export const notFoundHandler = (req, res) => {
    res.status(404).json({ error: 'Route not found' });
};
