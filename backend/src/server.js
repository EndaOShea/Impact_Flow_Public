import express from 'express';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import compression from 'compression';

dotenv.config();

import {
    corsMiddleware,
    helmetMiddleware,
    generalRateLimiter,
    requestLogger,
    sanitizeInput,
    errorHandler,
    notFoundHandler
} from './middleware/security.middleware.js';

import authRoutes from './routes/auth.routes.js';
import taskRoutes from './routes/task.routes.js';
import projectRoutes from './routes/project.routes.js';
import reportScheduleRoutes from './routes/reportSchedule.routes.js';
import analyticsRoutes from './routes/analytics.routes.js';

import { cleanupExpiredSessions } from './utils/auth.js';
import { pool } from './config/database.js';

const app = express();
const PORT = process.env.PORT || 2001;

// ============================================================================
// MIDDLEWARE SETUP
// ============================================================================

app.use(helmetMiddleware);
app.use(corsMiddleware);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use(compression());

app.use(sanitizeInput);
app.use(requestLogger);

app.use('/api/', generalRateLimiter);

// ============================================================================
// ROUTES
// ============================================================================

app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/report-schedules', reportScheduleRoutes);
app.use('/api/analytics', analyticsRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

// ============================================================================
// BACKGROUND JOBS
// ============================================================================

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
║   Impact Flow API Server (Single User)               ║
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

    setTimeout(() => {
        console.error('Forcing shutdown after timeout');
        process.exit(1);
    }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

export default app;
