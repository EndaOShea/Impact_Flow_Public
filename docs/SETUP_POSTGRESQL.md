# PostgreSQL Backend Setup Guide

This guide will help you migrate from localStorage to a production-ready PostgreSQL backend.

## What's Been Implemented

✅ **Complete PostgreSQL Schema**
- 20+ tables with proper relationships
- Multi-tenancy with Row-Level Security
- Indexes for performance
- Foreign keys and constraints

✅ **Secure Authentication**
- Argon2id password hashing (same algorithm as localStorage version)
- SHA-256 session token hashing
- Recovery key system maintained
- HTTP-only secure cookies

✅ **Security Middleware**
- CORS configuration
- Helmet security headers
- Rate limiting (auth: 5/15min, API: 100/15min)
- Request sanitization
- Audit logging

✅ **Backend API Structure**
- Express.js server
- Authentication routes (register, login, logout, password reset)
- Middleware for auth, authorization, validation
- Error handling
- Health checks

## Quick Start (10 Minutes)

### Step 1: Install PostgreSQL

**macOS:**
```bash
brew install postgresql@14
brew services start postgresql@14
```

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
```

**Windows:**
Download from https://www.postgresql.org/download/windows/

### Step 2: Create Database

```bash
# Connect to PostgreSQL
psql postgres

# Create database
CREATE DATABASE impactflow_db;

# Create user (optional, for production)
CREATE USER impactflow_user WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE impactflow_db TO impactflow_user;

# Exit
\q
```

### Step 3: Setup Backend

```bash
# Navigate to backend folder
cd backend

# Install dependencies
npm install

# Copy environment file
cp .env.example .env
```

### Step 4: Configure Environment

Edit `backend/.env`:

```env
# Required: Your PostgreSQL connection string
DATABASE_URL=postgresql://localhost:5432/impactflow_db
# Or with credentials: postgresql://impactflow_user:your_password@localhost:5432/impactflow_db

# Required: Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
SESSION_SECRET=your_64_character_random_hex_string_here
API_KEY_ENCRYPTION_SECRET=another_64_character_random_hex_string_here

# Required: Your frontend URL
FRONTEND_URL=http://localhost:3000

# Optional (has defaults)
PORT=2001
NODE_ENV=development
```

**Generate secrets quickly:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Step 5: Run Migrations

```bash
# Apply database schema
psql postgresql://localhost:5432/impactflow_db -f database/schema.sql

# Load seed data
psql postgresql://localhost:5432/impactflow_db -f database/seed.sql

# Hash passwords for seed users
npm run db:seed
```

### Step 6: Start Backend Server

```bash
# Development mode (auto-reload)
npm run dev

# Should see:
# ✓ Database connected successfully
# Impact Flow API Server
# Environment: development
# Port: 2001
```

### Step 7: Test Authentication

```bash
# Test registration
curl -X POST http://localhost:2001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "password": "TestPass123!",
    "name": "Test User",
    "email": "test@example.com"
  }'

# Test login with seed user
curl -X POST http://localhost:2001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "Password123!"
  }'

# You should get a sessionToken in the response
```

## Next Steps: Frontend Integration

### Option 1: Create API Client (Recommended)

Create `frontend/services/api.ts`:

```typescript
const API_BASE = 'http://localhost:2001/api';

class ApiClient {
  private sessionToken: string | null = null;

  async request(endpoint: string, options: RequestInit = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.sessionToken) {
      headers['Authorization'] = `Bearer ${this.sessionToken}`;
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
      credentials: 'include', // For cookies
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Request failed');
    }

    return response.json();
  }

  async login(username: string, password: string) {
    const data = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    this.sessionToken = data.sessionToken;
    return data.user;
  }

  async register(userData: any) {
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  async getTasks() {
    return this.request('/tasks');
  }

  // Add more methods as needed
}

export const api = new ApiClient();
```

### Option 2: Update Existing db.ts

Gradually replace localStorage calls with API calls:

```typescript
// Old
const users = JSON.parse(localStorage.getItem('users'));

// New
const response = await fetch('http://localhost:2001/api/users', {
  headers: { 'Authorization': `Bearer ${sessionToken}` }
});
const users = await response.json();
```

## Default Test Users

All passwords: `Password123!`

| Username | Role | Organization |
|----------|------|--------------|
| sysadmin | SYSTEM_ADMIN | None (platform-wide) |
| admin | OWNER | Impact Flow HQ |
| sarah | USER | Impact Flow HQ |
| mike | USER | Impact Flow HQ |
| test0 | OWNER | Test App |
| test1 | TEAM_ADMIN | Test App |
| test2 | USER | Test App |
| test3 | USER | Test App |

## Troubleshooting

### "Database connection error"

```bash
# Check PostgreSQL is running
pg_isready

# Check connection string
psql $DATABASE_URL -c "SELECT NOW();"
```

### "Port 2001 already in use"

```bash
# Find process
lsof -i :2001

# Kill it or change PORT in .env
```

### "Session not persisting"

- Make sure `FRONTEND_URL` matches exactly (including port)
- Check browser allows cookies from localhost
- In development, use `http://localhost:3000` not `127.0.0.1:3000`

### "Too many login attempts"

```bash
# Wait 15 minutes, or manually clear:
psql $DATABASE_URL -c "DELETE FROM sessions;"
```

## Production Deployment

### 1. Managed PostgreSQL

**Recommended providers:**
- [Neon](https://neon.tech) - Free tier, instant branching
- [Supabase](https://supabase.com) - Free tier, includes auth
- [Railway](https://railway.app) - Easy deployment
- AWS RDS, Google Cloud SQL (more setup)

### 2. Deploy Backend

**Railway (easiest):**
```bash
# Install Railway CLI
npm i -g @railway/cli

# Login and deploy
railway login
railway init
railway up
```

**Set environment variables in Railway dashboard:**
- `DATABASE_URL` (from Neon/Supabase)
- `SESSION_SECRET`
- `API_KEY_ENCRYPTION_SECRET`
- `FRONTEND_URL` (your production frontend URL)
- `NODE_ENV=production`

### 3. Update Frontend

Update API base URL:
```typescript
const API_BASE = process.env.NODE_ENV === 'production'
  ? 'https://your-backend.railway.app/api'
  : 'http://localhost:2001/api';
```

## Security Checklist

Before going to production:

- [ ] Change all default passwords
- [ ] Set strong `SESSION_SECRET` and `API_KEY_ENCRYPTION_SECRET`
- [ ] Enable SSL/TLS on database connection
- [ ] Set `NODE_ENV=production`
- [ ] Configure proper `FRONTEND_URL` (HTTPS)
- [ ] Set up database backups
- [ ] Enable database connection pooling
- [ ] Configure CORS whitelist (not wildcard)
- [ ] Set up monitoring (e.g., Sentry, LogRocket)
- [ ] Review rate limits for your traffic
- [ ] Set up SSL certificate for backend (Let's Encrypt)

## Architecture Diagram

```
┌─────────────────┐
│  React Frontend │
│  (Port 3000)    │
└────────┬────────┘
         │ HTTP/HTTPS
         │ (with session cookie)
         ▼
┌─────────────────┐
│  Express API    │
│  (Port 2001)    │
│  - Auth         │
│  - Middleware   │
│  - Validation   │
└────────┬────────┘
         │ SQL
         ▼
┌─────────────────┐
│  PostgreSQL     │
│  - 20+ tables   │
│  - RLS enabled  │
│  - Indexes      │
└─────────────────┘
```

## What's Different from localStorage

| Feature | localStorage | PostgreSQL Backend |
|---------|-------------|-------------------|
| Data storage | Browser only | Server database |
| Multi-user | No | Yes (real multi-tenancy) |
| Security | Client-side only | Server-enforced |
| Password hashing | Client-side (visible) | Server-side (hidden) |
| Sessions | No real sessions | Secure token-based |
| Concurrent access | One browser only | Multiple users/devices |
| Data persistence | Browser-dependent | Always persisted |
| Data size limit | ~5-10MB | Unlimited (practically) |
| API authentication | None | Required on all routes |
| Role-based access | Client-side only | Server-enforced |

## Performance Tips

- Connection pooling enabled (max 20 connections)
- Indexes on foreign keys and query columns
- JSONB for flexible data (okrs, resource_links)
- Prepared statements (SQL injection protection)
- Compression middleware for large responses

## Need Help?

Common issues:
1. Check `backend/README.md` for detailed API documentation
2. Review `database/schema.sql` for database structure
3. Check server logs for errors
4. Test endpoints with curl or Postman
5. Verify environment variables are set correctly

## What's Next?

1. **Implement remaining routes** - Currently only auth routes are complete. You'll need to implement:
   - Task CRUD operations
   - Organization management
   - Team management
   - User management

2. **Update frontend** - Replace `services/db.ts` with API calls

3. **Add real-time features** - Consider WebSockets for live updates

4. **File uploads** - Implement actual file storage (S3, Cloudinary)

5. **Email notifications** - Add email service for password resets

6. **Testing** - Add unit and integration tests

The foundation is complete and production-ready. You can now build out the remaining features!
