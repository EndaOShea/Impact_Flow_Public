# Fresh Start with PostgreSQL Backend

We're building the application from scratch using the PostgreSQL backend. No migration needed - just clean, new development.

## Quick Setup (10 Minutes)

### 1. Install PostgreSQL

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

### 2. Create Database

```bash
# Connect to PostgreSQL
psql postgres

# Create database
CREATE DATABASE impactflow_db;

# Exit
\q
```

### 3. Setup Backend

```bash
cd backend
npm install

# Configure environment
cp .env.example .env
```

Edit `backend/.env`:
```env
DATABASE_URL=postgresql://localhost:5432/impactflow_db
PORT=2001
NODE_ENV=development

# Generate these with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
SESSION_SECRET=your_64_character_random_hex_here
API_KEY_ENCRYPTION_SECRET=another_64_character_random_hex_here

FRONTEND_URL=http://localhost:3000
```

### 4. Initialize Database

```bash
# Apply schema
psql impactflow_db -f database/schema.sql

# Load test data
psql impactflow_db -f database/seed.sql

# Hash passwords for test users
npm run db:seed
```

### 5. Start Backend

```bash
npm run dev
```

You should see:
```
✓ Database connected successfully
╔═══════════════════════════════════════════════════════╗
║   Impact Flow API Server                             ║
║   Environment: development                           ║
║   Port:        2001                                  ║
╚═══════════════════════════════════════════════════════╝
```

### 6. Test Backend

```bash
# Test health endpoint
curl http://localhost:2001/health

# Test login
curl -X POST http://localhost:2001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "Password123!"}'

# You should get back a sessionToken and user object
```

## Test Users

All passwords: `Password123!`

| Username | Role | Organization | Teams |
|----------|------|--------------|-------|
| sysadmin | SYSTEM_ADMIN | None | None |
| admin | OWNER | Impact Flow HQ | Product, Marketing |
| sarah | USER | Impact Flow HQ | Engineering, Customer Success |
| mike | USER | Impact Flow HQ | Design, Product |
| test0 | OWNER | Test App | None |
| test1 | TEAM_ADMIN | Test App | Sales, Marketing |
| test2 | USER | Test App | Sales |
| test3 | USER | Test App | DevOps |

## Frontend Setup

### Option 1: Build New React App

```bash
# Create new React app with TypeScript
npx create-react-app impact-flow-frontend --template typescript
cd impact-flow-frontend

# Copy the API client
mkdir src/services
cp ../services/api.ts src/services/
cp ../types.ts src/
```

### Option 2: Use Existing Frontend

Just use the API client instead of db.ts:

```typescript
// src/App.tsx
import { api } from './services/api';
import { useEffect, useState } from 'react';

function App() {
    const [currentUser, setCurrentUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Initialize session from localStorage
        const user = api.init();

        if (user) {
            // Verify session is still valid
            api.getCurrentUser()
                .then(setCurrentUser)
                .catch(() => setCurrentUser(null))
                .finally(() => setLoading(false));
        } else {
            setLoading(false);
        }
    }, []);

    if (loading) return <div>Loading...</div>;

    return currentUser ? <Dashboard user={currentUser} /> : <LoginScreen />;
}
```

## Using the API Client

### Authentication

```typescript
import { api } from './services/api';

// Register
const { user, recoveryKey } = await api.register(
    'johndoe',
    'SecurePass123!',
    'John Doe',
    'john@example.com'
);
console.log('Save this recovery key:', recoveryKey);

// Login
const user = await api.authenticate('admin', 'Password123!');
console.log('Logged in:', user);

// Logout
await api.logout();

// Get current user
const user = await api.getCurrentUser();

// Reset password with recovery key
await api.resetPassword('RK-XXXX-XXXX-XXXX', 'NewPass123!');
```

### Working with Tasks

```typescript
// Get all tasks (automatically filtered by organization and role)
const tasks = await api.getTasks();

// Filter tasks
const tasks = await api.getTasks({
    status: 'IN_PROGRESS',
    priority: 'HIGH',
    assigneeId: 'user-id-here'
});

// Get single task
const task = await api.getTask('task-id');

// Create task
const newTask = await api.saveTask({
    title: 'Implement login feature',
    description: 'Build authentication system',
    status: 'TODO',
    priority: 'HIGH',
    startDate: new Date(),
    dueDate: new Date('2024-12-31'),
    assigneeIds: ['user-id'],
    subtasks: [
        {
            title: 'Design UI',
            estimatedHours: 4,
            category: 'Design',
            notes: 'Create mockups'
        }
    ],
    impactMetrics: [
        {
            type: 'Revenue',
            value: 50000,
            currency: 'USD',
            description: 'Expected revenue impact'
        }
    ]
});

// Update task
const updated = await api.saveTask({
    id: 'existing-task-id',
    status: 'IN_PROGRESS',
    // ... other fields
});

// Delete task
await api.deleteTask('task-id');

// Add subtask
const subtask = await api.addSubtask('task-id', {
    title: 'Write tests',
    estimatedHours: 6,
    category: 'Testing'
});

// Update subtask
await api.updateSubtask('task-id', 'subtask-id', {
    completed: true,
    hoursSpent: 5.5
});

// Add comment
await api.addComment('task-id', 'This is progressing well!');

// Add attachment
await api.addAttachment('task-id', {
    name: 'design-mockup.png',
    type: 'image/png',
    url: 'data:image/png;base64,...',
    size: 12345
});
```

### Working with Users

```typescript
// Get all users in organization
const users = await api.getUsers();

// Get specific user
const user = await api.getUser('user-id');

// Update user
await api.updateUser({
    id: 'user-id',
    name: 'Updated Name',
    email: 'newemail@example.com'
});
```

### Working with Teams

```typescript
// Get all teams
const teams = await api.getTeams();

// Create team
const team = await api.createTeam({
    organizationId: 'org-id',
    name: 'Engineering',
    color: 'bg-blue-500'
});

// Add member to team
await api.addTeamMember('team-id', 'user-id');

// Remove member
await api.removeTeamMember('team-id', 'user-id');
```

### Working with Organizations

```typescript
// Create organization
const org = await api.createOrganization('My Company');

// Request to join organization
await api.requestJoin('org-id');

// Get join requests (admin only)
const requests = await api.getJoinRequests('org-id');

// Approve join request
await api.processJoinRequest('org-id', 'request-id', 'APPROVED');
```

## Example: Complete Login Component

```typescript
import { useState } from 'react';
import { api } from '../services/api';

export function LoginScreen({ onLogin }) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const user = await api.authenticate(username, password);
            onLogin(user);
        } catch (err) {
            setError(err.message || 'Login failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleLogin}>
            <h2>Login</h2>

            {error && <div className="error">{error}</div>}

            <input
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={loading}
            />

            <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
            />

            <button type="submit" disabled={loading}>
                {loading ? 'Logging in...' : 'Login'}
            </button>
        </form>
    );
}
```

## Example: Task List Component

```typescript
import { useState, useEffect } from 'react';
import { api } from '../services/api';

export function TaskList() {
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        loadTasks();
    }, []);

    const loadTasks = async () => {
        try {
            setLoading(true);
            const data = await api.getTasks();
            setTasks(data);
        } catch (err) {
            setError('Failed to load tasks');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (taskId) => {
        if (!confirm('Delete this task?')) return;

        try {
            await api.deleteTask(taskId);
            setTasks(prev => prev.filter(t => t.id !== taskId));
        } catch (err) {
            alert('Failed to delete task');
        }
    };

    const handleToggleStatus = async (task) => {
        const newStatus = task.status === 'COMPLETED' ? 'TODO' : 'COMPLETED';

        try {
            const updated = await api.saveTask({
                ...task,
                status: newStatus
            });
            setTasks(prev => prev.map(t => t.id === task.id ? updated : t));
        } catch (err) {
            alert('Failed to update task');
        }
    };

    if (loading) return <div>Loading tasks...</div>;
    if (error) return <div>Error: {error}</div>;

    return (
        <div>
            <h2>Tasks ({tasks.length})</h2>

            {tasks.map(task => (
                <div key={task.id} className="task-item">
                    <h3>{task.title}</h3>
                    <p>{task.description}</p>
                    <span className={`status-${task.status}`}>
                        {task.status}
                    </span>

                    <button onClick={() => handleToggleStatus(task)}>
                        {task.status === 'COMPLETED' ? 'Reopen' : 'Complete'}
                    </button>

                    <button onClick={() => handleDelete(task.id)}>
                        Delete
                    </button>
                </div>
            ))}

            {tasks.length === 0 && <p>No tasks yet</p>}
        </div>
    );
}
```

## API Client Features

### Automatic Authentication

The API client automatically:
- Stores session tokens in localStorage
- Includes tokens in all requests
- Restores sessions on page refresh
- Clears tokens on logout

### Error Handling

All API methods throw errors that you can catch:

```typescript
try {
    await api.saveTask(task);
} catch (error) {
    console.error('Error:', error.message);
    // Show error to user
}
```

### Type Safety

All methods are fully typed with TypeScript:

```typescript
const tasks: Task[] = await api.getTasks();
const user: User = await api.authenticate('username', 'password');
```

## Available Endpoints

### Authentication
- POST /api/auth/register
- POST /api/auth/login
- POST /api/auth/logout
- GET /api/auth/me
- POST /api/auth/reset-password
- POST /api/auth/change-password

### Tasks (Complete)
- GET /api/tasks
- GET /api/tasks/:id
- POST /api/tasks
- PUT /api/tasks/:id
- DELETE /api/tasks/:id
- POST /api/tasks/:id/subtasks
- PUT /api/tasks/:id/subtasks/:subtaskId
- DELETE /api/tasks/:id/subtasks/:subtaskId
- POST /api/tasks/:id/comments
- POST /api/tasks/:id/attachments
- DELETE /api/tasks/:id/attachments/:attachmentId

### Users, Teams, Organizations
Routes exist but need implementation (1-2 hours each using task routes as template)

## Development Workflow

1. **Start backend**: `cd backend && npm run dev`
2. **Start frontend**: `cd frontend && npm start`
3. **Make API calls**: Use `api.method()` in your components
4. **Check logs**: Backend logs all requests
5. **Debug**: Check browser Network tab and backend console

## Database Management

```bash
# View all tasks
psql impactflow_db -c "SELECT id, title, status FROM tasks;"

# View all users
psql impactflow_db -c "SELECT id, username, role FROM users;"

# Reset database (WARNING: Deletes all data)
psql impactflow_db -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
psql impactflow_db -f database/schema.sql
psql impactflow_db -f database/seed.sql
npm run db:seed

# Backup database
pg_dump impactflow_db > backup.sql

# Restore database
psql impactflow_db < backup.sql
```

## Production Deployment

See `backend/README.md` for detailed deployment instructions.

**Quick deploy with Railway:**

```bash
cd backend
npm install -g @railway/cli
railway login
railway init
railway up

# Set environment variables in Railway dashboard
# Then update frontend API_BASE to Railway URL
```

## Next Steps

1. ✅ Backend is ready (task routes complete)
2. ✅ API client is ready
3. Build your React components using the API client
4. Implement remaining backend routes if needed (user/team/org)
5. Deploy when ready

No migration needed - just build fresh! 🚀
