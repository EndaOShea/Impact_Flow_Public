<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Impact Flow Task Manager

A powerful multi-tenant task management application with **PostgreSQL backend**, advanced impact tracking, team collaboration, and AI-powered strategic planning.

## 🚀 Quick Start

### Docker (Recommended - Production Ready)

```bash
# 1. Create .env file
cp .env.example .env
# Edit .env with your secrets (see .env.example)

# 2. Start all services (PostgreSQL, Backend, Frontend)
docker-compose -f docker-compose.prod.yml up -d

# 3. Check logs
docker-compose -f docker-compose.prod.yml logs -f

# Access the application
# Frontend: http://localhost:2080
# Backend API: http://localhost:2001
```

**Default credentials:**
- Username: `user`
- Password: `Password123!`

### Local Development (Without Docker)

<details>
<summary>Click to expand local setup instructions</summary>

#### Prerequisites
- Node.js 18+
- PostgreSQL 14+

#### 1. Backend Setup

```bash
# Create database
createdb impactflow_db

# Install and configure
cd backend
npm install
cp .env.example .env
# Edit .env with your DATABASE_URL and secrets

# Initialize database
psql impactflow_db -f database/schema.sql
psql impactflow_db -f database/seed.sql
npm run db:seed

# Start backend
npm run dev
```

Backend runs on `http://localhost:2001`

#### 2. Frontend Setup

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

Frontend runs on `http://localhost:3000`

#### 3. Login
- Username: `user`
- Password: `Password123!`

</details>

**See [FRESH_START_GUIDE.md](FRESH_START_GUIDE.md) for complete setup guide with examples**

## Features

- **PostgreSQL Backend**: Production-ready API with secure authentication
- **Single-User Mode**: Personal task management with impact tracking
- **Impact Tracking**: Measure and visualize revenue, efficiency gains, customer satisfaction, and more
- **AI-Powered Strategy**: Generate Mermaid flowcharts from natural language using Gemini AI
- **Advanced Task Management**:
  - Recurring tasks with flexible schedules (daily, weekly, monthly, yearly)
  - Task dependencies
  - Subtasks with time tracking and work categorization
  - Inline actual hours validation (no popups)
  - Activity logging and audit trails
- **Secure File Attachments** (Max 3 per task, 5MB each):
  - Whitelist-based validation (PDF, Word, Excel, PowerPoint, Images, Text, CSV)
  - Client + server-side security validation
  - Download functionality with sanitized filenames
  - Blocks executables, scripts, SVG, and ZIP files
- **Resource Links**: Clickable external links with security (opens in new tab)
- **Multiple Views**: Dashboard, List, Calendar, Timeline, and Reports
- **Docker Deployment**: Production-ready containerized setup

## Tech Stack

- **Backend**: PostgreSQL 14+, Express.js, Argon2id authentication
- **Frontend**: React 19, TypeScript, Vite
- **UI**: Tailwind CSS, Lucide React icons
- **Charts**: Recharts
- **AI**: Google Gemini API (gemini-2.5-flash)
- **Deployment**: Docker, Docker Compose
- **Security**:
  - Argon2 password hashing, SHA-256 session tokens
  - File upload validation (whitelist-based, MIME + extension checking)
  - Filename sanitization, path traversal prevention
  - CORS, rate limiting, audit logging

## Default Test Account

Login credentials (password: `Password123!`):

- **user** - Single-user account

## 📁 Project Structure

```
Impact_Flow_App/
├── backend/                    # PostgreSQL + Express API
│   ├── src/
│   │   ├── server.js          # Main server
│   │   ├── routes/            # API endpoints
│   │   │   ├── auth.routes.js # ✅ Complete
│   │   │   ├── task.routes.js # ✅ Complete
│   │   │   └── ...            # Other routes
│   │   ├── middleware/        # Auth, security
│   │   └── utils/             # Auth helpers
│   ├── database/
│   │   ├── schema.sql         # Database schema (20+ tables)
│   │   └── seed.sql           # Test data
│   └── README.md              # API documentation
│
├── services/
│   ├── api.ts                 # ✅ API client (USE THIS)
│   └── gemini.ts              # AI diagram generation
│
├── components/                # React components
│   ├── App.tsx
│   ├── TaskModal.tsx
│   └── ...
├── types.ts                   # TypeScript types
└── FRESH_START_GUIDE.md      # Complete usage guide
```

## 💻 Using the API Client

### Authentication

```typescript
import { api } from './services/api';

// Login
const user = await api.authenticate('admin', 'Password123!');

// Logout
await api.logout();

// Get current user
const user = await api.getCurrentUser();
```

### Tasks

```typescript
// Get all tasks
const tasks = await api.getTasks();

// Create task
const task = await api.saveTask({
    title: 'Build feature',
    status: 'TODO',
    priority: 'HIGH',
    assigneeIds: ['user-id']
});

// Update task
await api.saveTask({ id: 'task-id', status: 'COMPLETED' });

// Delete task
await api.deleteTask('task-id');
```

**See [FRESH_START_GUIDE.md](FRESH_START_GUIDE.md) for complete API examples**

## 🔐 Security

- ✅ Argon2id password hashing (256 iterations, 512KB memory)
- ✅ SHA-256 session token hashing
- ✅ HTTP-only secure cookies
- ✅ Rate limiting (5 auth, 100 API requests per 15min)
- ✅ CORS protection
- ✅ SQL injection protection via parameterized queries
- ✅ Comprehensive audit logging
- ✅ **File Upload Security**:
  - Whitelist-based file type validation (frontend + backend)
  - MIME type + extension verification (defense in depth)
  - Filename sanitization (prevents path traversal)
  - Max 5MB per file, 3 files per task
  - Blocks executables, scripts, SVG (XSS), ZIP files
  - Server-side re-validation prevents bypass
  - Audit logging for all file operations

## 📚 Documentation

- **[FRESH_START_GUIDE.md](FRESH_START_GUIDE.md)** - Complete setup & API usage guide
- **[backend/README.md](backend/README.md)** - Full API documentation
- **[CLAUDE.md](CLAUDE.md)** - Project architecture & development guide

## 🚀 Deployment

### Docker Production (Recommended)

```bash
# Production deployment
docker-compose -f docker-compose.prod.yml up -d

# Rebuild after updates
docker-compose -f docker-compose.prod.yml up -d --build

# View logs
docker-compose -f docker-compose.prod.yml logs -f
```

**Ports:**
- Frontend: `http://localhost:2080`
- Backend API: `http://localhost:2001`
- PostgreSQL: `5432` (internal only)

### Cloud Deployment

See `backend/README.md` for deployment instructions.

**Options:**
- Backend: Railway, Render, Heroku
- Database: Neon, Supabase, AWS RDS
- Frontend: Vercel, Netlify
- Container: Docker Hub, AWS ECR, Google Container Registry

## 📝 License

MIT
