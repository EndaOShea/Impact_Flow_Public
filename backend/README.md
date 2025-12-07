# Impact Flow Backend - PostgreSQL API

Production-ready backend API with PostgreSQL database, Argon2 password hashing, and secure session management.

## Features

✓ **Security First**
- Argon2id password hashing (256 iterations, 512KB memory)
- Secure session management with SHA-256 token hashing
- Row-Level Security (RLS) for multi-tenancy isolation
- Rate limiting (auth endpoints: 5/15min, general API: 100/15min)
- CORS, Helmet, HTTPS-only cookies in production
- SQL injection protection via parameterized queries
- Comprehensive audit logging

✓ **Authentication**
- Username + Password login
- Recovery key system (RK-XXXX-XXXX-XXXX format)
- Session-based auth with secure HTTP-only cookies
- Automatic session cleanup

✓ **Multi-Tenancy**
- Organization-based data isolation
- Role-based access control (SYSTEM_ADMIN, OWNER, ADMIN, TEAM_ADMIN, USER)
- Team management with multi-team membership

✓ **Production Ready**
- PostgreSQL with connection pooling
- Database migrations and seeding
- Graceful shutdown handling
- Error handling and validation
- Request logging
- Health check endpoint

## Prerequisites

- Node.js 18+
- PostgreSQL 14+
- npm or yarn

## Quick Start

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Set Up Database

Create a PostgreSQL database:

```bash
# Option 1: Using psql
createdb impactflow_db

# Option 2: Using PostgreSQL client
psql -U postgres
CREATE DATABASE impactflow_db;
\q
```

### 3. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your settings:

```env
DATABASE_URL=postgresql://username:password@localhost:5432/impactflow_db
PORT=2001
NODE_ENV=development
SESSION_SECRET=generate-random-string-here-min-32-chars
API_KEY_ENCRYPTION_SECRET=another-random-string-for-encryption
FRONTEND_URL=http://localhost:3000
```

**Generate secure secrets:**
```bash
# Use Node.js to generate random secrets
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 4. Run Database Migrations

```bash
# Apply schema
psql $DATABASE_URL -f database/schema.sql

# OR using npm script
npm run db:migrate
```

### 5. Seed Database (Optional)

```bash
# This will create test users and organizations
psql $DATABASE_URL -f database/seed.sql

# OR run the seed script (generates passwords)
npm run db:seed
```

**Default test users** (all passwords: `Password123!`):
- `sysadmin` - System Admin
- `admin` - Organization Owner (Impact Flow HQ)
- `sarah`, `mike` - Regular users
- `test0`, `test1`, `test2`, `test3` - Test App users

### 6. Start Server

```bash
# Development (with auto-reload)
npm run dev

# Production
npm start
```

Server will start on `http://localhost:2001`

## API Endpoints

### Authentication

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/auth/register` | Create new user | No |
| POST | `/api/auth/login` | Login with username/password | No |
| POST | `/api/auth/logout` | Logout current session | Yes |
| GET | `/api/auth/me` | Get current user info | Yes |
| POST | `/api/auth/reset-password` | Reset password with recovery key | No |
| POST | `/api/auth/change-password` | Change password (authenticated) | Yes |

### Organizations

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/organizations` | List all organizations | System Admin |
| POST | `/api/organizations` | Create organization | Yes |
| GET | `/api/organizations/:id` | Get organization details | Yes (member) |
| POST | `/api/organizations/:id/join-request` | Request to join | Yes |
| GET | `/api/organizations/:id/join-requests` | List join requests | Yes (admin) |
| POST | `/api/organizations/:id/join-requests/:reqId/approve` | Approve join request | Yes (admin) |
| POST | `/api/organizations/:id/join-requests/:reqId/reject` | Reject join request | Yes (admin) |

### Teams

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/teams` | List teams in user's org | Yes |
| POST | `/api/teams` | Create team | Yes (admin) |
| PUT | `/api/teams/:id` | Update team | Yes (admin) |
| DELETE | `/api/teams/:id` | Delete team | Yes (admin) |
| POST | `/api/teams/:id/members` | Add member to team | Yes (admin) |
| DELETE | `/api/teams/:id/members/:userId` | Remove member | Yes (admin) |

### Tasks

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/tasks` | List tasks (filtered by org/role) | Yes |
| POST | `/api/tasks` | Create task | Yes |
| GET | `/api/tasks/:id` | Get task details | Yes |
| PUT | `/api/tasks/:id` | Update task | Yes |
| DELETE | `/api/tasks/:id` | Delete task | Yes (admin) |
| POST | `/api/tasks/:id/subtasks` | Add subtask | Yes |
| PUT | `/api/tasks/:id/subtasks/:subtaskId` | Update subtask | Yes |
| DELETE | `/api/tasks/:id/subtasks/:subtaskId` | Delete subtask | Yes |
| POST | `/api/tasks/:id/comments` | Add comment | Yes |
| POST | `/api/tasks/:id/attachments` | Add attachment | Yes |

### Users

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/users` | List users in organization | Yes |
| GET | `/api/users/:id` | Get user profile | Yes |
| PUT | `/api/users/:id` | Update user | Yes (self or admin) |
| DELETE | `/api/users/:id` | Delete user | Yes (admin) |
| PUT | `/api/users/:id/role` | Change user role | Yes (admin) |

### Health Check

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/health` | Server health status | No |

## Example API Usage

### Register New User

```bash
curl -X POST http://localhost:2001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "johndoe",
    "password": "SecurePass123!",
    "name": "John Doe",
    "email": "john@example.com"
  }'
```

Response:
```json
{
  "user": {
    "id": "uuid-here",
    "username": "johndoe",
    "name": "John Doe",
    "role": "USER",
    "avatarInitials": "JD"
  },
  "recoveryKey": "RK-A1B2-C3D4-E5F6",
  "message": "User created successfully. Save your recovery key!"
}
```

### Login

```bash
curl -X POST http://localhost:2001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "Password123!"
  }'
```

Response:
```json
{
  "user": {
    "id": "uuid",
    "username": "admin",
    "name": "Alex Admin",
    "role": "OWNER",
    "organizationId": "org-uuid",
    "teamIds": ["team-uuid-1", "team-uuid-2"]
  },
  "sessionToken": "session-token-here"
}
```

### Authenticated Request

```bash
# Using cookie (automatically set)
curl http://localhost:2001/api/tasks \
  -H "Cookie: session=your-session-token"

# OR using Authorization header
curl http://localhost:2001/api/tasks \
  -H "Authorization: Bearer your-session-token"
```

## Database Schema

Key tables:
- `organizations` - Multi-tenant root
- `users` - User accounts with Argon2 hashed passwords
- `teams` - Teams within organizations
- `user_teams` - Many-to-many user-team membership
- `tasks` - Task main table
- `task_assignees` - Many-to-many task assignments
- `task_admins` - Task admin permissions
- `subtasks` - Task breakdown steps
- `comments` - Task discussions
- `impact_metrics` - KPI tracking
- `sessions` - Secure session storage
- `audit_log` - Security audit trail

See `database/schema.sql` for full schema definition.

## Security Best Practices

### Password Requirements
- Minimum 8 characters
- Hashed with Argon2id (256 iterations, 512KB memory)
- Never stored in plain text
- Never logged

### Session Management
- Tokens hashed with SHA-256 before storage
- 24-hour expiration (configurable)
- HTTP-only cookies (no JavaScript access)
- Secure flag in production (HTTPS only)
- Automatic cleanup of expired sessions

### Rate Limiting
- Authentication: 5 attempts per 15 minutes
- General API: 100 requests per 15 minutes
- Per-IP and per-username for auth routes

### Input Validation
- All inputs sanitized (trimmed)
- SQL injection protection via parameterized queries
- Email validation with validator library
- Username length: 3-50 characters

### Recovery Keys
- Format: RK-XXXX-XXXX-XXXX
- Cryptographically random
- Must be saved by user on registration
- Used for password reset without email

## Deployment

### Environment Variables for Production

```env
NODE_ENV=production
DATABASE_URL=postgresql://user:pass@production-db:5432/db
SESSION_SECRET=64-char-random-hex-string
API_KEY_ENCRYPTION_SECRET=64-char-random-hex-string
FRONTEND_URL=https://yourdomain.com
PORT=2001
```

### Recommended Hosting

- **Database**: [Neon](https://neon.tech), [Supabase](https://supabase.com), AWS RDS
- **Backend**: [Railway](https://railway.app), [Render](https://render.com), Heroku, AWS Elastic Beanstalk
- **Frontend**: Vercel, Netlify, Cloudflare Pages

### Docker Deployment

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 2001
CMD ["npm", "start"]
```

### Database Backup

```bash
# Backup
pg_dump $DATABASE_URL > backup.sql

# Restore
psql $DATABASE_URL < backup.sql
```

## Troubleshooting

### Database Connection Issues

```bash
# Test connection
psql $DATABASE_URL -c "SELECT NOW();"

# Check PostgreSQL is running
pg_isready

# View logs
tail -f /var/log/postgresql/postgresql-14-main.log
```

### Session Not Persisting

- Check `FRONTEND_URL` in `.env` matches your frontend origin
- Ensure cookies enabled in browser
- In development, use `http://localhost:3000` (not `127.0.0.1`)
- Check `sameSite` cookie setting

### Rate Limit Errors

- Wait 15 minutes for auth attempts to reset
- Clear rate limit manually:
  ```sql
  DELETE FROM sessions WHERE ip_address = 'your-ip';
  ```

## Development

### Database Reset

```bash
# WARNING: Destroys all data
npm run db:reset

# Or manually:
psql $DATABASE_URL -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
npm run db:migrate
npm run db:seed
```

### View Logs

```bash
# All requests (set in .env)
LOG_LEVEL=debug npm run dev

# Error logs only
LOG_LEVEL=error npm start
```

### Test Endpoints

```bash
# Install httpie or use curl
http POST :2001/api/auth/login username=admin password=Password123!
```

## License

MIT

## Support

For issues, please check:
1. Database connection string is correct
2. PostgreSQL is running
3. Migrations have been applied
4. Environment variables are set
5. Node.js version is 18+
