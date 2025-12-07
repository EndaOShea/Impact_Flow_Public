import { validateSession } from '../utils/auth.js';

// Middleware to require authentication
export const requireAuth = async (req, res, next) => {
    try {
        // Get token from cookie or Authorization header
        const token = req.cookies?.session || req.headers.authorization?.replace('Bearer ', '');

        if (!token) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const user = await validateSession(token);

        if (!user) {
            return res.status(401).json({ error: 'Invalid or expired session' });
        }

        // Attach user to request
        req.user = user;
        next();
    } catch (error) {
        console.error('Auth middleware error:', error);
        res.status(500).json({ error: 'Authentication error' });
    }
};

// Middleware to require specific role
export const requireRole = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }

        next();
    };
};

// Middleware to require organization membership
export const requireOrganization = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    if (!req.user.organizationId && req.user.role !== 'SYSTEM_ADMIN') {
        return res.status(403).json({ error: 'No organization membership' });
    }

    next();
};

// Middleware to verify user belongs to specific organization (from params)
export const verifyOrgAccess = (req, res, next) => {
    const orgIdFromParam = req.params.organizationId || req.body.organizationId;

    // System admins can access any org
    if (req.user.role === 'SYSTEM_ADMIN') {
        return next();
    }

    if (req.user.organizationId !== orgIdFromParam) {
        return res.status(403).json({ error: 'Access denied to this organization' });
    }

    next();
};

// Optional auth - continues even if no token
export const optionalAuth = async (req, res, next) => {
    try {
        const token = req.cookies?.session || req.headers.authorization?.replace('Bearer ', '');

        if (token) {
            const user = await validateSession(token);
            if (user) {
                req.user = user;
            }
        }

        next();
    } catch (error) {
        // Don't fail, just continue without user
        next();
    }
};
