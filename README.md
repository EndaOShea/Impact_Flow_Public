<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />

# Impact Flow Task Manager

**A full-stack personal task management application with impact metrics tracking and strategic planning**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61dafb.svg)](https://reactjs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14-316192.svg)](https://www.postgresql.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED.svg)](https://www.docker.com/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

</div>

---

## 📖 Overview

Impact Flow is a production-ready task management system designed for personal productivity with a focus on measuring and visualizing task impact. Built with modern web technologies, it features a PostgreSQL backend, a themeable (light/dark) UI, and comprehensive security measures.

### 🎯 Project Highlights

- **Full-Stack TypeScript**: End-to-end type safety from database to UI
- **Production-Ready**: Docker containerization with Nginx reverse proxy
- **Security-First**: Defense-in-depth approach with multiple security layers
- **Database-Driven**: PostgreSQL with migrations and proper schema design
- **Modern Architecture**: RESTful API, React 19, Vite, Tailwind CSS
- **Real-World Features**: Recurring tasks, impact tracking, analytics, file uploads

## 📋 Table of Contents

- [Quick Start](#-quick-start)
- [Key Features](#-key-features)
- [Tech Stack](#%EF%B8%8F-tech-stack)
- [Project Architecture](#-project-architecture)
- [API Usage Examples](#-api-usage-examples)
- [Security Implementation](#-security-implementation)
- [Database Schema](#%EF%B8%8F-database-schema)
- [Deployment](#-deployment)
- [Contributing](#-contributing)
- [License](#-license)

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose (recommended)
- OR Node.js 18+ and PostgreSQL 14+ for local development

### Docker Deployment (Recommended)

**1. Clone and configure:**
```bash
git clone <repository-url>
cd Impact_Flow_App

# Create environment file
cp .env.example .env
```

**2. Edit `.env` file with your configuration:**
```env
# Database
POSTGRES_USER=impactflow
POSTGRES_PASSWORD=your_secure_password
POSTGRES_DB=impactflow_db

# Security (generate with: openssl rand -base64 48)
SESSION_SECRET=your_session_secret_here

# Application
FRONTEND_URL=http://localhost:2080
VITE_API_URL=http://localhost:2001/api
NODE_ENV=production
```

**3. Start all services:**
```bash
docker-compose -f docker-compose.prod.yml up -d
```

**4. Access the application:**
- **Frontend**: http://localhost:2080
- **Backend API**: http://localhost:2001

**5. Create your account:**
The database starts empty — open the frontend and **Sign Up** to create your account.

> 💡 Password policy: at least 8 characters with uppercase, lowercase, a number, and a special character. (The Docker Compose stack loads only the schema, not seed data.)

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

Frontend runs on `http://localhost:2080`

#### 3. Login
- Username: `user`
- Password: `Password123!`

</details>


## ✨ Key Features

### 🎯 Task Management
- **Advanced Task Organization**: Create tasks with subtasks, dependencies, and priority levels
- **Recurring Tasks**: Flexible scheduling (daily, weekly, monthly, yearly) with automatic instance creation
- **Time Tracking**: Log estimated and actual hours with work category classification
- **Auto-Overdue Detection**: Automatic status updates for past-due tasks
- **Activity Logging**: Complete audit trail of all task changes

### 📊 Impact Tracking & Analytics
- **Impact Metrics**: Track revenue, efficiency gains, customer satisfaction, and custom metrics
- **Data Visualization**: Interactive charts built on lightweight custom SVG primitives (no heavy chart dependency)
- **Multiple Views**: Dashboard, Tasks, Projects, Calendar (monthly), Timeline (Gantt-style), and Reports
- **Themeable UI**: Light/dark theme toggle, persisted per user

### 📎 File Management
- **Secure Attachments**: Upload up to 3 files per task (5MB max each)
- **File Type Validation**: Whitelist-based security (PDF, Word, Excel, PowerPoint, Images, Text, CSV)
- **Defense-in-Depth**: Client-side + server-side validation prevents malicious uploads
- **Resource Links**: Add external URLs with automatic security measures

### 🔐 Security & Authentication
- **Bearer-Token Auth**: token sent in the `Authorization` header (24-hour expiry); no cookies → no CSRF surface
- **Password Security**: Argon2id hashing (64 MiB / 3 iterations), account lockout, password-reuse history
- **Rate Limiting**: per-client (behind `trust proxy`) protection against brute-force
- **Per-User Authorization**: every resource scoped to its owner (`creator_id`)
- **File Upload Security**: Blocks executables, scripts, SVG (XSS), and ZIP files
- **SQL Injection Protection**: Parameterized queries throughout

### 🐳 Production-Ready Deployment
- **Docker Containerization**: Multi-container orchestration with Docker Compose
- **Nginx Reverse Proxy**: Production-grade request routing
- **PostgreSQL Backend**: Robust relational database with migrations
- **Environment Configuration**: Secure secrets management

## 🛠️ Tech Stack

### Frontend
- **Framework**: React 19 with TypeScript
- **Build Tool**: Vite (fast HMR and optimized builds)
- **Styling**: Tailwind CSS 3.4+ with PostCSS
- **State Management**: React Hooks (useState, useMemo, useEffect)
- **Charts**: custom SVG chart primitives (no external chart library)
- **Design System**: hand-written `design-system.css` with light/dark theming
- **Icons**: Lucide React
- **HTTP Client**: Custom ApiClient singleton with automatic session management

### Backend
- **Runtime**: Node.js with Express.js
- **Database**: PostgreSQL 14+ with connection pooling
- **Authentication**: Bearer-token sessions with Argon2id password hashing
- **Session Storage**: SHA-256 hashed tokens with 24-hour expiry
- **Security Middleware**: CORS, rate limiting (`trust proxy`), helmet

### DevOps & Infrastructure
- **Containerization**: Docker with multi-stage builds
- **Orchestration**: Docker Compose for multi-container setup
- **Reverse Proxy**: Nginx for production routing
- **Environment Management**: dotenv for configuration
- **Database Migrations**: SQL migration scripts

### Development Tools
- **Version Control**: Git
- **Package Manager**: npm
- **Code Quality**: TypeScript strict mode
- **API Design**: RESTful architecture


## 📁 Project Architecture

```
Impact_Flow_App/
├── backend/                        # Express.js API Server
│   ├── src/
│   │   ├── server.js              # Main Express application
│   │   ├── routes/                # RESTful API endpoints
│   │   │   ├── auth.routes.js     # Authentication
│   │   │   ├── task.routes.js     # Task CRUD operations
│   │   │   ├── project.routes.js  # Project management
│   │   │   ├── analytics.routes.js # Analytics & metrics
│   │   │   └── reportSchedule.routes.js
│   │   ├── middleware/
│   │   │   ├── auth.middleware.js # Session validation
│   │   │   └── security.middleware.js # Rate limiting, CORS
│   │   ├── utils/
│   │   │   ├── auth.js            # Password hashing, authentication
│   │   │   └── fileValidation.js  # File upload security
│   │   └── config/
│   │       └── database.js        # PostgreSQL connection pool
│   ├── database/
│   │   ├── schema.sql             # Database schema
│   │   ├── seed.sql               # Sample data
│   │   └── migrations/            # Database migrations
│   ├── Dockerfile                 # Production container
│   └── Dockerfile.dev             # Development container
│
├── App.tsx                         # Main application orchestrator (root)
├── design-system.css               # Design tokens + light/dark theming
├── components/                     # React Components
│   ├── Sidebar.tsx, TopBar.tsx     # App shell (nav + header)
│   ├── DashboardView, TasksView, NotificationsView, SettingsView
│   ├── ProjectsView.tsx           # Projects grid/list
│   ├── CalendarView.tsx           # Monthly calendar
│   ├── TimelineView.tsx           # Gantt timeline
│   ├── SystemReport.tsx           # Reports (generate/schedule/trends)
│   ├── TemporalMetricsCharts.tsx  # Temporal analytics
│   ├── TaskModal.tsx, ProjectModal.tsx, TaskReport.tsx
│   ├── AuthScreen.tsx             # Login/registration/recovery
│   ├── FilterBar.tsx              # Shared filter chips
│   └── charts/Charts.tsx          # Custom SVG chart primitives
│
├── lib/                            # Helpers
│   ├── chart.ts                   # SVG chart math
│   └── display.ts                 # Status/priority/format helpers
│
├── services/                       # API & services
│   ├── api.ts                     # ApiClient singleton (Bearer auth)
│   ├── analytics.ts               # Analytics service
│   └── fileValidation.ts          # Client-side validation
│
├── types.ts                        # TypeScript type definitions
├── docker-compose.prod.yml         # Production orchestration
├── docker-compose.dev.yml          # Development orchestration
├── nginx.conf                      # Nginx reverse proxy config
└── CLAUDE.md                       # Architecture documentation
```

## 💻 API Usage Examples

### Authentication

```typescript
import { api } from './services/api';

// Login
const user = await api.authenticate('username', 'password');
// Returns: { id, name, username, avatarInitials }

// Logout
await api.logout();

// Get current session
const user = await api.getCurrentUser();

// Password recovery
const recoveryKey = await api.requestPasswordReset('username');
await api.resetPasswordWithKey('username', recoveryKey, 'newPassword');
```

### Task Management

```typescript
// Fetch all tasks
const tasks = await api.getTasks();

// Create a new task
const task = await api.saveTask({
    title: 'Implement user authentication',
    description: 'Add JWT-based auth system',
    status: 'TODO',
    priority: 'HIGH',
    dueDate: new Date('2026-02-01'),
    estimatedHours: 8,
    assigneeIds: ['user-123'],
    impactMetrics: [
        { type: 'REVENUE', value: 5000, description: 'Expected revenue impact' }
    ]
});

// Update task status
await api.saveTask({
    id: task.id,
    status: 'IN_PROGRESS'
});

// Add subtask
const updatedTask = await api.saveTask({
    id: task.id,
    subtasks: [
        { title: 'Design database schema', isCompleted: false }
    ]
});

// Delete task
await api.deleteTask(task.id);
```

### Projects

```typescript
// Get all projects
const projects = await api.getProjects();

// Create project
const project = await api.saveProject({
    name: 'Q1 Product Launch',
    description: 'New feature rollout',
    startDate: new Date('2026-01-01'),
    endDate: new Date('2026-03-31'),
    color: '#3B82F6'
});
```

## 🔐 Security Implementation

This application implements comprehensive security measures following industry best practices:

### Authentication & Authorization
- **Password Security**: Argon2id hashing (64 MiB memory, 3 iterations), account lockout, password-reuse history
- **Session Management**: 256-bit tokens stored as SHA-256 hashes; sent as Bearer tokens in the `Authorization` header (no cookies → no CSRF surface)
- **Token Expiry**: 24-hour session timeout with automatic cleanup
- **Recovery System**: Secure password reset with recovery keys (format: `RK-XXXX-XXXX-XXXX`)

### API Security
- **Rate Limiting**: 5 auth attempts, 100 API requests per 15 minutes
- **CORS Protection**: Configurable allowed origins
- **SQL Injection Prevention**: Parameterized queries throughout
- **Input Validation**: Comprehensive request validation middleware

### File Upload Security (Defense-in-Depth)
- **Whitelist Validation**: Only approved file types (PDF, DOC, XLS, PPT, images, text, CSV)
- **Dual Validation**: Client-side + server-side verification
- **MIME Type Checking**: Validates both extension and content type
- **Filename Sanitization**: Prevents directory traversal attacks
- **Size Limits**: 5MB per file, 3 attachments per task
- **Blocked Types**: Executables, scripts, SVG (XSS prevention), ZIP archives
- **Audit Logging**: All file operations logged for compliance

### Data Protection
- **Environment Secrets**: Secure configuration via environment variables
- **Audit Trails**: Comprehensive activity logging for all critical operations

## 🗄️ Database Schema

The PostgreSQL database includes:

- **Core Tables**: `users`, `tasks`, `projects`, `subtasks`, `task_dependencies`
- **Impact Tracking**: `impact_metrics`, `usage_analytics`
- **Collaboration**: `comments`, `attachments`, `team_members`, `task_blockers`, `activity_log`, `audit_log`
- **Scheduling**: `report_schedules`
- **Security**: `sessions`, `password_history`

**Migrations**: Located in `backend/database/migrations/` for version control and schema updates.

**Sample Data**: Run `backend/scripts/seed-db.js` to populate test data.

## 🎨 UI/UX Features

- **Responsive Design**: Mobile-friendly with adaptive layouts
- **Light/Dark Theme**: Full theme toggle (Settings + top bar), persisted per user
- **Custom Animations**: Smooth transitions with Tailwind CSS animations
- **Accessibility**: Semantic HTML and keyboard navigation support
- **Custom Scrollbars**: Styled scrollbars for better aesthetics
- **Loading States**: Skeleton screens and spinners for better UX

## 📚 Additional Documentation

- **[backend/README.md](backend/README.md)** - Complete API endpoint documentation
- **[CLAUDE.md](CLAUDE.md)** - Detailed architecture and development guide
- **[.env.example](.env.example)** - Environment configuration template

## 🤝 Contributing

This is a portfolio project, but suggestions and feedback are welcome! Feel free to:

1. Open an issue for bugs or feature requests
2. Fork the repository and submit pull requests
3. Share your thoughts on improvements

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👤 Author

Enda O'Shea - [EndaOShea](https://github.com/EndaOShea)

---

<div align="center">

**⭐ If you found this project helpful, please consider giving it a star!**

</div>

## 🚀 Deployment

### Docker Production

```bash
# Start all services
docker-compose -f docker-compose.prod.yml up -d

# Rebuild after code changes
docker-compose -f docker-compose.prod.yml up -d --build

# View logs
docker-compose -f docker-compose.prod.yml logs -f

# Stop all services
docker-compose -f docker-compose.prod.yml down

# Stop and remove volumes (fresh start)
docker-compose -f docker-compose.prod.yml down -v
```

**Service Ports:**
- **Frontend**: `http://localhost:2080`
- **Backend API**: `http://localhost:2001`
- **PostgreSQL**: `5432` (internal only, not exposed)

### Development Mode

For local development with hot-reload:

```bash
# Start development environment
docker-compose -f docker-compose.dev.yml up

# Or run frontend/backend separately
cd backend && npm run dev  # Backend on :2001
npm run dev                # Frontend on :3000
```

### Cloud Deployment Options

The application can be deployed to various cloud platforms:

| Component | Recommended Platforms |
|-----------|----------------------|
| **Backend API** | Railway, Render, Heroku, AWS ECS, Google Cloud Run |
| **Database** | Neon, Supabase, AWS RDS, DigitalOcean Managed PostgreSQL |
| **Frontend** | Vercel, Netlify, AWS S3 + CloudFront |
| **Containers** | Docker Hub, AWS ECR, Google Container Registry, GitHub Packages |

### Environment Variables for Production

Ensure these are set in your production environment:

```env
# Database
DATABASE_URL=postgresql://user:password@host:5432/dbname

# Security (generate secure random string)
SESSION_SECRET=<64-char-random-string>

# Application
NODE_ENV=production
FRONTEND_URL=https://your-domain.com
PORT=2001
```

Generate secure secrets:
```bash
openssl rand -base64 48
```