import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

// PostgreSQL connection pool
export const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 20, // Maximum number of connections
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    ssl: false // SSL disabled - containers communicate on internal Docker network
});

// Test database connection on startup
pool.on('connect', () => {
    console.log('✓ Database connected successfully');
});

pool.on('error', (err) => {
    console.error('Unexpected database error:', err);
    process.exit(-1);
});

// Helper function to execute queries
export const query = async (text, params) => {
    const start = Date.now();
    try {
        const res = await pool.query(text, params);
        const duration = Date.now() - start;

        if (process.env.LOG_LEVEL === 'debug') {
            console.log('Executed query', { text, duration, rows: res.rowCount });
        }

        return res;
    } catch (error) {
        console.error('Database query error:', error);
        throw error;
    }
};

// Helper for transactions
export const transaction = async (callback) => {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');
        const result = await callback(client);
        await client.query('COMMIT');
        return result;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

// Set session variables for RLS (Row Level Security)
export const setSessionOrg = async (client, organizationId) => {
    if (organizationId) {
        await client.query('SET app.current_org_id = $1', [organizationId]);
    }
};

// Graceful shutdown
export const closePool = async () => {
    await pool.end();
    console.log('Database pool closed');
};

export default { pool, query, transaction, setSessionOrg, closePool };
