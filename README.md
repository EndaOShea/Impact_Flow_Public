<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Impact Flow Task Manager

A powerful multi-tenant task management application with **PostgreSQL backend**, advanced impact tracking, team collaboration, and AI-powered strategic planning.

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL 14+

### 1. Backend Setup (5 minutes)

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

### 2. Frontend Setup

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

Frontend runs on `http://localhost:3000`

### 3. Login

**Default credentials:**
- Username: `admin`
- Password: `Password123!`

**See [FRESH_START_GUIDE.md](FRESH_START_GUIDE.md) for complete setup guide with examples**

## Features

- **PostgreSQL Backend**: Production-ready API with secure authentication
- **Multi-Organization Support**: Complete tenant isolation with row-level security
- **Role-Based Access Control**: System Admin, Owner, Admin, Team Admin, and User roles
- **Impact Tracking**: Measure and visualize revenue, efficiency gains, customer satisfaction, and more
- **AI-Powered Strategy**: Generate Mermaid flowcharts from natural language using Gemini AI
- **Advanced Task Management**:
  - Recurring tasks with flexible schedules (daily, weekly, monthly, yearly)
  - Multi-assignee support
  - Task dependencies
  - Subtasks with time tracking and work categorization
  - Activity logging and audit trails
- **Multiple Views**: Dashboard, List, Calendar, Timeline, and Reports
- **Team Collaboration**: Cross-team assignment requests with approval workflows

## Tech Stack

- **Backend**: PostgreSQL 14+, Express.js, Argon2id authentication
- **Frontend**: React 19, TypeScript, Vite
- **UI**: Tailwind CSS, Lucide React icons
- **Charts**: Recharts
- **AI**: Google Gemini API (gemini-2.5-flash)
- **Security**: Argon2 password hashing, SHA-256 session tokens, CORS, rate limiting

## Default Test Accounts

Login with any of these test accounts (password: `Password123!`):

- **admin** - Organization Owner (Impact Flow HQ)
- **sarah** - Standard User (Engineering & Customer Success)
- **mike** - Standard User (Design & Product)
- **sysadmin** - Platform System Admin
- **test0** - Organization Owner (Test App)
- **test1** - Team Admin (Sales & Marketing)

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
- ✅ Row-level security for multi-tenancy

## 📚 Documentation

- **[FRESH_START_GUIDE.md](FRESH_START_GUIDE.md)** - Complete setup & API usage guide
- **[backend/README.md](backend/README.md)** - Full API documentation
- **[CLAUDE.md](CLAUDE.md)** - Project architecture & development guide

## 🚀 Deployment

See `backend/README.md` for deployment instructions.

**Quick deploy:**
- Backend: Railway, Render, Heroku
- Database: Neon, Supabase, AWS RDS
- Frontend: Vercel, Netlify

## 📝 License

MIT
