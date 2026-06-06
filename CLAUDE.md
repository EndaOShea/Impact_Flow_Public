# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Impact Flow is a single-user personal task management application with impact tracking, projects, and reporting. Built with TypeScript, React 19, and Vite, on a themeable (light/dark) hand-written CSS design system.

## Development Commands

### Docker Production (Recommended)

```bash
# Start all services (PostgreSQL, Backend, Frontend)
docker-compose -f docker-compose.prod.yml up -d

# Rebuild after code changes
docker-compose -f docker-compose.prod.yml up -d --build

# View logs
docker-compose -f docker-compose.prod.yml logs -f

# Stop all services
docker-compose -f docker-compose.prod.yml down
```

Access at: **http://localhost:2080** (Frontend) and **http://localhost:2001** (Backend API)

### Local Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Environment Configuration

The frontend requires no API keys. Runtime/secret configuration is supplied via a `.env` file consumed by Docker Compose (see **Docker Deployment**; template in `.env.example`).

> The earlier AI/Gemini Mermaid-diagram feature has been **removed** — there is no `services/gemini.ts` and `GEMINI_API_KEY` is not used.

## Architecture

### Data Storage Layer

**PostgreSQL Backend** (`backend/`):
- Express.js REST API server on port 2001
- PostgreSQL database with schema in `backend/database/schema.sql` (tracked; auto-loaded on first DB init)
- **Bearer-token authentication**: the session token is returned on login and sent via the `Authorization: Bearer` header. No session cookie is issued or accepted (no CSRF surface).

**Frontend API Client** (`services/api.ts`):
- Singleton `ApiClient` class handles all HTTP requests (incl. generic `get/post/put/delete` helpers)
- Stores the session token in localStorage and attaches it as a Bearer header

### State Management

Main app state in `App.tsx`:
- No external state library - React hooks (useState, useMemo, useEffect)
- User preferences persisted in localStorage (`impactflow_prefs_${userId}`)
- Filter/sort preferences auto-save on change
- Session management via `impactflow_current_user` localStorage key

### Component Structure

- **App.tsx**: Main orchestrator — auth gating, data load, filtering, theme (light/dark), view routing, modals
- **Sidebar.tsx / TopBar.tsx**: app shell (nav + header)
- **DashboardView / TasksView / NotificationsView / SettingsView**: the four inline views, extracted as components
- **ProjectsView.tsx / CalendarView.tsx / TimelineView.tsx**: projects grid/list, monthly calendar, Gantt timeline
- **SystemReport.tsx / TemporalMetricsCharts.tsx**: reports (generate / schedule / trends) + temporal analytics
- **TaskModal.tsx / ProjectModal.tsx**: tabbed create/edit modals; **TaskReport.tsx** renders the in-modal report
- **AuthScreen.tsx**: Login / registration / recovery
- **FilterBar.tsx**: shared filter chips for Dashboard/Tasks
- **charts/Charts.tsx**: custom SVG chart primitives (AreaChart, Donut, BarChart, Sparkline)
- Design system: `design-system.css` (tokens + light/dark via `[data-theme]`); helpers in `lib/display.ts` and `lib/chart.ts`
- (`MermaidDiagram.tsx`, `SystemHealthDashboard.tsx` exist but are currently unused/orphaned)

### Type System

All types defined in `types.ts`:
- **Task**: Central entity with subtasks, impact metrics, attachments, comments, activity log
- **User**: Simple user with id, name, username, avatarInitials
- **Enums**: TaskStatus, Priority, ImpactType, WorkCategory

### Task Features

**Recurring Tasks**:
- When a recurring task is completed, automatically creates next instance
- Supports DAILY, WEEKLY, MONTHLY, YEARLY frequencies with configurable intervals
- Resets subtasks and impact metrics for new instance

**Auto-Overdue Detection**:
- Tasks with past due dates automatically marked as OVERDUE
- Skips COMPLETED, FAILED, POSTPONED statuses

**Activity Logging**:
- Each task has an `activityLog` array tracking status changes
- Format: `{userId, userName, action, timestamp}`

**Subtask Completion**:
- Inline validation for actual hours entry (no popups)
- Visual feedback with red border and warning message
- Auto-expands subtask when hours are missing

**Attachments** (Max 3 per task, 5MB each):
- **Allowed file types**: PDF, Word, Excel, PowerPoint, Text, CSV, Images (JPG/PNG/GIF/WEBP)
- **Blocked**: Executables, scripts, SVG (XSS protection), ZIP archives
- Server-side validation with file type whitelist
- Client-side + backend validation (defense in depth)
- Download functionality with sanitized filenames
- File size display and validation

**Resource Links**:
- Clickable external links that open in new tabs
- Auto-adds `https://` if protocol missing
- Security: `rel="noopener noreferrer"` prevents tabnabbing

### Charts (no external chart library)

- Charts are hand-rolled SVG primitives in `components/charts/Charts.tsx` (`AreaChart`, `Donut`, `BarChart`, `Sparkline`); math in `lib/chart.ts`. **Recharts has been removed** (≈half the JS bundle).
- The earlier Gemini/Mermaid AI diagram feature has been removed (no `services/gemini.ts`; `@google/genai` and Mermaid are no longer used by the app).

### Styling

- **`design-system.css`** is the primary styling layer: CSS custom-property tokens with **light/dark theming** via `[data-theme]` on the `.shell` root (toggle in Settings + top bar; persisted in `impactflow_prefs_${userId}`). Fonts: Plus Jakarta Sans + Space Grotesk.
- Tailwind CSS v3.4+ with PostCSS remains available for incidental utilities; custom scrollbar/print styles in `styles.css`.
- Responsive with mobile sidebar overlay; Lucide React icons.

## Key Patterns

### Date Handling

- All dates stored as JavaScript Date objects
- Display format: British locale (`en-GB`)

## Security Notes

- **Passwords**: Hashed with Argon2id (64 MiB memory, 3 iterations) on the backend
- **Recovery keys**: Format `RK-XXXX-XXXX-XXXX`
- **Sessions**: 256-bit tokens stored only as SHA-256 hashes in the DB, 24-hour expiry. Auth is **Bearer-only** (`Authorization` header) — no session cookie is issued or accepted, so there is no CSRF surface.
- **Reverse proxy**: `app.set('trust proxy', 1)` so rate limiters key on the real client IP behind nginx.
- **Authorization**: every task/project resource (subtasks, comments, attachments, blockers) is scoped to the authenticated user (`creator_id`).
- **File Upload Security**:
  - Whitelist-based file type validation (frontend + backend)
  - Max file size: 5MB, Max attachments: 3 per task
  - MIME type + extension validation (defense in depth)
  - Filename sanitization to prevent path traversal
  - Data URI format validation
  - Blocks executables, scripts, SVG (XSS), and ZIP files
  - Server-side re-validation prevents client-side bypass
  - Audit logging for all attachment operations
- Do not commit `.env` or `.env.local` with real secrets

## Testing Data

Default user (password: `Password123!`):
- Username: `user`

To reset database: Run `backend/scripts/seed-db.js` or drop and recreate PostgreSQL tables

## Common Gotchas

1. **Docker Ports**: Production runs on port 2080 (frontend) and 2001 (backend), not 3000
2. **API URL Configuration**: Frontend must be built with correct `VITE_API_URL` (set in docker-compose.prod.yml)
3. **API Key Storage**: User API keys are stored encrypted in the backend database, not in environment variables
4. **Task Filtering**: Default filter is "Active / Upcoming" (excludes completed/failed), sort is DESC (newest first)
5. **Backend Required**: The frontend requires the backend API server running on port 2001
6. **File Uploads**: Only specific file types allowed (no ZIP, SVG, executables) - see security notes

## Backend API Structure

**Routes** (`backend/src/routes/`):
- `auth.routes.js` - Authentication (Bearer tokens), password change, recovery, account deletion
- `task.routes.js` - Task CRUD with subtasks, comments, attachments, blockers
- `project.routes.js`, `analytics.routes.js`, `reportSchedule.routes.js` - projects, usage/temporal analytics, report schedules

**Key Backend Files**:
- `backend/src/utils/auth.js` - Password hashing, session management, API key encryption
- `backend/src/utils/fileValidation.js` - File upload validation and security
- `backend/src/config/database.js` - PostgreSQL connection pool
- `backend/src/middleware/auth.middleware.js` - Session validation middleware
- `backend/src/middleware/security.middleware.js` - Rate limiting, CORS

## Docker Deployment

The application runs in Docker containers for production:

**Services**:
- `postgres`: PostgreSQL 14 database
- `backend`: Express.js API (port 2001)
- `frontend`: Vite production build served via `serve` (port 2080)

**Configuration Files**:
- `docker-compose.prod.yml` - Production configuration
- `docker-compose.dev.yml` - Development with hot-reload
- `Dockerfile` - Frontend production build
- `Dockerfile.dev` - Frontend development
- `backend/Dockerfile` - Backend production
- `backend/Dockerfile.dev` - Backend development

**Environment Variables**:
Required in `.env` file (see `.env.example`):
- `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`
- `SESSION_SECRET` (generate with: `openssl rand -base64 48`)
- `API_KEY_ENCRYPTION_SECRET` (for encrypting user API keys)
- `FRONTEND_URL` (CORS configuration)
- `VITE_API_URL` (frontend API endpoint)
