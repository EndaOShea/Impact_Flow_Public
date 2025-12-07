import express from 'express';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import compression from 'compression';

// Load environment variables
dotenv.config();

// Import middleware
import {
    corsMiddleware,
    helmetMiddleware,
    generalRateLimiter,
    requestLogger,
    sanitizeInput,
    errorHandler,
    notFoundHandler
} from './middleware/security.middleware.js';

// Import routes
import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/user.routes.js';
import organizationRoutes from './routes/organization.routes.js';
import teamRoutes from './routes/team.routes.js';
import taskRoutes from './routes/task.routes.js';
import taskAssignmentRoutes from './routes/taskAssignment.routes.js';

// Import utilities
import { cleanupExpiredSessions } from './utils/auth.js';
import { pool } from './config/database.js';

const app = express();
const PORT = process.env.PORT || 2001;

// ============================================================================
// MIDDLEWARE SETUP
// ============================================================================

// Security
app.use(helmetMiddleware);
app.use(corsMiddleware);

// Body parsing
app.use(express.json({ limit: '10mb' })); // For attachments as data URLs
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Compression
app.use(compression());

// Request processing
app.use(sanitizeInput);
app.use(requestLogger);

// Rate limiting
app.use('/api/', generalRateLimiter);

// ============================================================================
// ROUTES
// ============================================================================

// Health check (no auth required)
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/organizations', organizationRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/task-assignment-requests', taskAssignmentRoutes);

// 404 handler
app.use(notFoundHandler);

// Error handler (must be last)
app.use(errorHandler);

// ============================================================================
// BACKGROUND JOBS
// ============================================================================

// Session cleanup job (runs every hour)
const SESSION_CLEANUP_INTERVAL = (parseInt(process.env.SESSION_CLEANUP_INTERVAL_MINUTES) || 60) * 60 * 1000;

setInterval(async () => {
    try {
        await cleanupExpiredSessions();
    } catch (error) {
        console.error('Session cleanup error:', error);
    }
}, SESSION_CLEANUP_INTERVAL);

// ============================================================================
// SERVER START
// ============================================================================

const server = app.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════════╗
║                                                       ║
║   Impact Flow API Server                             ║
║                                                       ║
║   Environment: ${process.env.NODE_ENV || 'development'}                      ║
║   Port:        ${PORT}                                    ║
║   Database:    ${process.env.DATABASE_URL ? 'Connected' : 'Not configured'}                         ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
    `);
});

// ============================================================================
// GRACEFUL SHUTDOWN
// ============================================================================

const gracefulShutdown = async (signal) => {
    console.log(`\n${signal} received, shutting down gracefully...`);

    server.close(async () => {
        console.log('HTTP server closed');

        try {
            await pool.end();
            console.log('Database connections closed');
            process.exit(0);
        } catch (error) {
            console.error('Error during shutdown:', error);
            process.exit(1);
        }
    });

    // Force shutdown after 10 seconds
    setTimeout(() => {
        console.error('Forcing shutdown after timeout');
        process.exit(1);
    }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught errors
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

export default app;
