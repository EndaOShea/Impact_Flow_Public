import pg from 'pg';
import { argon2id } from 'hash-wasm';
import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config();

const { Client } = pg;

// Hash password using same method as backend
const generateSalt = () => {
    return crypto.randomBytes(16).toString('hex');
};

const hashPassword = async (password) => {
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

const seedDatabase = async () => {
    const client = new Client({
        connectionString: process.env.DATABASE_URL
    });

    try {
        await client.connect();
        console.log('✓ Connected to database');

        // Hash the default password
        const defaultPassword = 'Password123!';
        const hashedPassword = await hashPassword(defaultPassword);
        console.log('✓ Hashed default password');

        // Update all users with the hashed password
        const result = await client.query(
            'UPDATE users SET password_hash = $1 WHERE password_hash = \'\'',
            [hashedPassword]
        );

        console.log(`✓ Updated ${result.rowCount} user passwords`);

        console.log('\n✓ Database seeding complete!');
        console.log('\nDefault login credentials:');
        console.log('  Username: admin');
        console.log('  Password: Password123!');
        console.log('\nOther test users: sarah, mike, test0, test1, test2, test3');
        console.log('All use the same password: Password123!');

    } catch (error) {
        console.error('❌ Seeding failed:', error);
        process.exit(1);
    } finally {
        await client.end();
    }
};

seedDatabase();
