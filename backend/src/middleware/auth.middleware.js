import { validateSession } from '../utils/auth.js';

// Middleware to require authentication
export const requireAuth = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');

        if (!token) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const user = await validateSession(token);

        if (!user) {
            return res.status(401).json({ error: 'Invalid or expired session' });
        }

        req.user = user;
        next();
    } catch (error) {
        console.error('Auth middleware error:', error);
        res.status(500).json({ error: 'Authentication error' });
    }
};

// Optional auth - continues even if no token
export const optionalAuth = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');

        if (token) {
            const user = await validateSession(token);
            if (user) {
                req.user = user;
            }
        }

        next();
    } catch (error) {
        next();
    }
};
