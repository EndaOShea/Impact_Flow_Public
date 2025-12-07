# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Impact Flow Task Manager is a multi-tenant React task management application with advanced impact tracking, team collaboration, and AI-powered diagram generation. Built with TypeScript, React 19, and Vite.

## Development Commands

```bash
# Install dependencies
npm install

# Run development server (localhost:3000)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Environment Configuration

Create a `.env.local` file with:
```
GEMINI_API_KEY=your_gemini_api_key_here
```

The API key is required for AI-powered Mermaid diagram generation in task strategy planning.

## Architecture

### Multi-Tenancy System

The app implements organization-based multi-tenancy with role-based access control:

- **Organizations**: Top-level isolation boundary for all data (tasks, teams, users)
- **Roles**: SYSTEM_ADMIN (platform-wide), OWNER (org creator), ADMIN (org-level), TEAM_ADMIN (team-level), USER (standard)
- **Task Visibility Logic** (App.tsx:124-165):
  - OWNER/ADMIN: See all organization tasks
  - TEAM_ADMIN: See tasks assigned to their team members or themselves
  - USER: See only tasks assigned to them, created by them, or where they're explicit admins

### Data Storage Layer

**PostgreSQL Backend** (`backend/`):
- Express.js REST API server on port 2001
- PostgreSQL database with full schema in `backend/database/schema.sql`
- Row-level security (RLS) for multi-tenancy isolation
- Session-based authentication with secure cookies

**Frontend API Client** (`services/api.ts`):
- Singleton `ApiClient` class handles all HTTP requests
- Automatic session token management via localStorage
- Methods mirror the old localStorage db.ts interface for easy migration

### State Management

Main app state in `App.tsx` / `components/App.tsx`:
- No external state library - React hooks (useState, useMemo, useEffect)
- User preferences persisted per-user in localStorage (`impactflow_prefs_${userId}`)
- Filter/sort preferences auto-save on change (line 63-74)
- Session management via `impactflow_current_user` localStorage key

### Component Structure

- **App.tsx**: Main orchestrator, handles auth, filtering, routing between views
- **TaskModal.tsx**: Complex modal for creating/editing tasks with subtasks, impact metrics, diagrams
- **AdminPanel.tsx**: Organization management (users, teams, join requests)
- **PlatformAdminPanel.tsx**: System-wide admin for SYSTEM_ADMIN role
- **AuthScreen.tsx**: Login/registration with username + password
- **Onboarding.tsx**: First-time user flow to create or join organizations
- **CalendarView.tsx**: Monthly calendar with task visualization
- **TimelineView.tsx**: Gantt-style timeline view
- **ImpactChart.tsx**: Impact metrics visualization using Recharts
- **SystemReport.tsx**: Analytics and reporting dashboard
- **MermaidDiagram.tsx**: Mermaid.js flowchart renderer

### Type System

All types defined in `types.ts`:
- **Task**: Central entity with subtasks, impact metrics, attachments, comments, activity log
- **User**: Multi-team support via `teamIds` array
- **Team**: Organization-scoped with color coding
- **Organization**: Top-level tenant container
- **Enums**: TaskStatus, Priority, ImpactType, WorkCategory, UserRole

### Task Features

**Recurring Tasks** (App.tsx:307-341):
- When a recurring task is completed, automatically creates next instance
- Supports DAILY, WEEKLY, MONTHLY, YEARLY frequencies with configurable intervals
- Resets subtasks and impact metrics for new instance

**Auto-Overdue Detection** (App.tsx:167-180):
- Tasks with past due dates automatically marked as OVERDUE
- Skips COMPLETED, FAILED, POSTPONED statuses

**Activity Logging**:
- Each task has an `activityLog` array tracking status changes
- Format: `{userId, userName, action, timestamp}`

### AI Integration

**Gemini API Service** (`services/gemini.ts`):
- Uses Google GenAI SDK (`@google/genai`)
- Model: `gemini-2.5-flash`
- Function: `generateDiagramCode(userDescription)` - converts natural language to Mermaid flowchart
- API key injected via Vite's env variable replacement

### Styling

- Tailwind CSS v3.4+ with PostCSS (production-ready setup)
- Custom animations: fade-in, slide-in-from-top (defined in tailwind.config.js)
- Custom scrollbar styling in styles.css
- Responsive design with mobile sidebar overlay
- Lucide React icons

## Key Patterns

### Path Aliases

TypeScript and Vite configured with `@/*` alias pointing to project root:
```typescript
import { Task } from './types';           // Relative
import { db } from './services/db';       // Relative
import { TaskModal } from './components/TaskModal';  // Relative
```

### Date Handling

- All dates stored as JavaScript Date objects
- LocalStorage serialization handled in db.ts with JSON.parse/stringify
- Display format: British locale (`en-GB`)

### Multi-Assignee Support

Tasks support multiple assignees via `assigneeIds` array:
- Migration logic in db.ts:553 handles legacy `assigneeId` -> `assigneeIds`
- UI shows first assignee with "+N more" indicator

### Cross-Team Assignment Requests

When TEAM_ADMIN wants to assign someone from another team:
- Creates `TaskAssignmentRequest` with PENDING status
- Target team's admin must approve
- Stored in `impactflow_pg_task_requests` localStorage

## Security Notes

- **Passwords**: Hashed with Argon2id (256 iterations, 512KB memory) on the backend
- **Recovery keys**: Format `RK-XXXX-XXXX-XXXX`
- **Sessions**: SHA-256 hashed tokens stored in database, 24-hour expiry
- **API Keys**: User-specific encrypted storage using AES-256-GCM
  - Each user can store their own Google Gemini API key
  - Encrypted server-side with `API_KEY_ENCRYPTION_SECRET` env var
  - Stored in `user_api_keys` table per user/service
  - Managed via "My API Key" tab in Admin Panel
  - Frontend service: `services/apiKeyManager.ts`
  - Backend endpoints: `POST/GET/DELETE /api/auth/api-key/:serviceName`
- Do not commit `.env` or `.env.local` with real secrets

## Testing Data

Default test users (password: `Password123!` for all):
- `admin` - Organization Owner
- `sarah` - Standard User
- `mike` - Standard User
- `sysadmin` - System Admin (platform-wide)
- `test0` - Test Org Owner
- `test1` - Test Team Admin

To reset database: Run `backend/scripts/seed-db.js` or drop and recreate PostgreSQL tables

## Common Gotchas

1. **App.tsx vs components/App.tsx**: Two identical files exist - actual entry is `/App.tsx` imported by index.tsx
2. **API Key Storage**: User API keys are stored encrypted in the backend database, not in environment variables
3. **Task Filtering**: Default filter is "Active / Upcoming" (excludes completed/failed), sort is DESC (newest first)
4. **Organization Isolation**: All queries must filter by `organizationId` - forgetting this breaks multi-tenancy
5. **Backend Required**: The frontend requires the backend API server running on port 2001

## Backend API Structure

**Routes** (`backend/src/routes/`):
- `auth.routes.js` - Authentication, password management, API key management
- `user.routes.js` - User CRUD (org-scoped)
- `organization.routes.js` - Organization and join request management
- `team.routes.js` - Team and membership management
- `task.routes.js` - Task CRUD with subtasks, comments, attachments

**Key Backend Files**:
- `backend/src/utils/auth.js` - Password hashing, session management, API key encryption
- `backend/src/config/database.js` - PostgreSQL connection pool
- `backend/src/middleware/auth.middleware.js` - Session validation middleware
- `backend/src/middleware/security.middleware.js` - Rate limiting, CORS
- I dont not need any summary documentation.