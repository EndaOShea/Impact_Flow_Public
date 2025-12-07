# Frontend Migration Guide: localStorage → PostgreSQL API

This guide will help you migrate your existing React components from using `services/db.ts` (localStorage) to `services/api.ts` (PostgreSQL backend).

## Quick Start

### 1. Import API Client

Replace this:
```typescript
import { db } from './services/db';
```

With this:
```typescript
import { api } from './services/api';
```

### 2. Initialize Session on App Load

In your main `App.tsx` or `index.tsx`:

```typescript
import { api } from './services/api';
import { useEffect, useState } from 'react';

function App() {
    const [currentUser, setCurrentUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Try to restore session from localStorage
        const storedUser = api.init();

        if (storedUser) {
            // Verify session is still valid with backend
            api.getCurrentUser()
                .then(user => {
                    setCurrentUser(user);
                    setLoading(false);
                })
                .catch(() => {
                    // Session expired
                    setCurrentUser(null);
                    setLoading(false);
                });
        } else {
            setLoading(false);
        }
    }, []);

    if (loading) {
        return <div>Loading...</div>;
    }

    // Rest of your app...
}
```

## Migration Examples

### Authentication

#### Before (localStorage):
```typescript
const handleLogin = async () => {
    await db.init();
    const user = await db.authenticate(username, password);
    if (user) {
        setCurrentUser(user);
        localStorage.setItem('impactflow_current_user', user.id);
    } else {
        setError('Invalid credentials');
    }
};
```

#### After (API):
```typescript
const handleLogin = async () => {
    try {
        const user = await api.authenticate(username, password);
        setCurrentUser(user);
    } catch (error) {
        setError(error.message || 'Invalid credentials');
    }
};
```

### Logout

#### Before:
```typescript
const handleLogout = () => {
    localStorage.removeItem('impactflow_current_user');
    setCurrentUser(null);
};
```

#### After:
```typescript
const handleLogout = async () => {
    try {
        await api.logout();
        setCurrentUser(null);
    } catch (error) {
        console.error('Logout error:', error);
    }
};
```

### Fetching Tasks

#### Before (synchronous):
```typescript
const fetchTasks = async () => {
    await db.init();
    const allTasks = await db.getTasks();
    const filtered = allTasks.filter(t => t.organizationId === currentUser.organizationId);
    setTasks(filtered);
};
```

#### After (async with loading state):
```typescript
const fetchTasks = async () => {
    try {
        setLoading(true);
        const tasks = await api.getTasks(); // Automatically filtered by org on backend
        setTasks(tasks);
    } catch (error) {
        setError('Failed to load tasks');
        console.error(error);
    } finally {
        setLoading(false);
    }
};
```

### Creating a Task

#### Before:
```typescript
const handleCreateTask = async (task) => {
    await db.saveTask(task);
    // Manually refresh
    const tasks = await db.getTasks();
    setTasks(tasks);
};
```

#### After:
```typescript
const handleCreateTask = async (task) => {
    try {
        setLoading(true);
        const newTask = await api.saveTask(task);
        // Add to local state or refetch
        setTasks(prev => [newTask, ...prev]);
    } catch (error) {
        setError('Failed to create task');
        console.error(error);
    } finally {
        setLoading(false);
    }
};
```

### Updating a Task

#### Before:
```typescript
const handleUpdateTask = async (updatedTask) => {
    await db.saveTask(updatedTask);
    const tasks = await db.getTasks();
    setTasks(tasks);
};
```

#### After:
```typescript
const handleUpdateTask = async (updatedTask) => {
    try {
        const updated = await api.saveTask(updatedTask);
        // Update in local state
        setTasks(prev => prev.map(t => t.id === updated.id ? updated : t));
    } catch (error) {
        setError('Failed to update task');
        console.error(error);
    }
};
```

### Deleting a Task

#### Before:
```typescript
const handleDelete = async (taskId) => {
    const tasks = await db.getTasks();
    const filtered = tasks.filter(t => t.id !== taskId);
    localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(filtered));
    setTasks(filtered);
};
```

#### After:
```typescript
const handleDelete = async (taskId) => {
    try {
        await api.deleteTask(taskId);
        // Remove from local state
        setTasks(prev => prev.filter(t => t.id !== taskId));
    } catch (error) {
        setError('Failed to delete task');
        console.error(error);
    }
};
```

### Working with Teams

#### Before:
```typescript
const fetchTeams = async () => {
    await db.init();
    const teams = await db.getTeams();
    const orgTeams = teams.filter(t => t.organizationId === currentUser.organizationId);
    setTeams(orgTeams);
};
```

#### After:
```typescript
const fetchTeams = async () => {
    try {
        const teams = await api.getTeams(); // Filtered by org on backend
        setTeams(teams);
    } catch (error) {
        setError('Failed to load teams');
    }
};
```

## Component Pattern Changes

### Add Loading States

All API calls are now asynchronous over the network, so you need loading states:

```typescript
const [tasks, setTasks] = useState<Task[]>([]);
const [loading, setLoading] = useState(false);
const [error, setError] = useState<string | null>(null);

useEffect(() => {
    const loadTasks = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await api.getTasks();
            setTasks(data);
        } catch (err) {
            setError(err.message || 'Failed to load tasks');
        } finally {
            setLoading(false);
        }
    };

    loadTasks();
}, []);

if (loading) return <div>Loading tasks...</div>;
if (error) return <div>Error: {error}</div>;
```

### Error Handling

Wrap all API calls in try-catch:

```typescript
const handleAction = async () => {
    try {
        await api.someMethod();
        // Success handling
    } catch (error) {
        // Show error to user
        setError(error.message);
        console.error('Action failed:', error);
    }
};
```

### Optimistic Updates (Optional)

For better UX, update UI immediately then rollback on error:

```typescript
const handleToggleComplete = async (taskId: string) => {
    // Optimistically update UI
    setTasks(prev => prev.map(t =>
        t.id === taskId ? { ...t, completed: !t.completed } : t
    ));

    try {
        await api.updateTask(taskId, { completed: true });
    } catch (error) {
        // Rollback on error
        setTasks(prev => prev.map(t =>
            t.id === taskId ? { ...t, completed: !t.completed } : t
        ));
        setError('Failed to update task');
    }
};
```

## Specific Component Updates

### App.tsx / Main Component

```typescript
// OLD
useEffect(() => {
    const loadData = async () => {
        await db.init();
        const user = localStorage.getItem('impactflow_current_user');
        if (user) {
            const users = await db.getUsers();
            const currentUser = users.find(u => u.id === user);
            setCurrentUser(currentUser);
        }
    };
    loadData();
}, []);

// NEW
useEffect(() => {
    const initApp = async () => {
        // Restore session from localStorage
        const user = api.init();

        if (user) {
            try {
                // Verify session with backend
                const validatedUser = await api.getCurrentUser();
                setCurrentUser(validatedUser);

                // Load initial data
                const [tasks, teams, users] = await Promise.all([
                    api.getTasks(),
                    api.getTeams(),
                    api.getUsers()
                ]);

                setTasks(tasks);
                setTeams(teams);
                setUsers(users);
            } catch (error) {
                // Session invalid, show login
                setCurrentUser(null);
            }
        }

        setInitialized(true);
    };

    initApp();
}, []);
```

### AuthScreen.tsx

```typescript
// OLD
const handleRegister = async () => {
    const newUser = await db.createUser({ username, ...userData }, password);
    setShowRecoveryKey(newUser.recoveryKey);
};

// NEW
const handleRegister = async () => {
    try {
        setLoading(true);
        const { user, recoveryKey } = await api.register(username, password, name, email);
        setShowRecoveryKey(recoveryKey);
        // Optionally auto-login after registration
        // await api.authenticate(username, password);
        // setCurrentUser(user);
    } catch (error) {
        setError(error.message);
    } finally {
        setLoading(false);
    }
};
```

### TaskModal.tsx

```typescript
// OLD
const handleSave = async () => {
    await db.saveTask(newTask);
    onSave(newTask); // Parent refreshes
    onClose();
};

// NEW
const handleSave = async () => {
    try {
        setSaving(true);
        const savedTask = await api.saveTask(newTask);
        onSave(savedTask); // Pass saved task to parent
        onClose();
    } catch (error) {
        setError('Failed to save task');
        console.error(error);
    } finally {
        setSaving(false);
    }
};
```

### AdminPanel.tsx

```typescript
// OLD
const handleDeleteUser = async (userId: string) => {
    await db.deleteUser(userId);
    const updatedUsers = await db.getUsers();
    setUsers(updatedUsers);
};

// NEW
const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user?')) return;

    try {
        await api.deleteUser(userId);
        setUsers(prev => prev.filter(u => u.id !== userId));
    } catch (error) {
        setError('Failed to delete user');
    }
};
```

## Data Type Conversions

### Dates

The API returns dates as ISO strings, not Date objects:

```typescript
// OLD (Date objects)
const dueDate = task.dueDate; // Date object
const formatted = dueDate.toLocaleDateString();

// NEW (ISO strings from API)
const dueDate = task.dueDate; // "2024-01-15T10:30:00Z"
const formatted = new Date(dueDate).toLocaleDateString();
```

### JSONB Fields

Some fields are stored as JSONB in PostgreSQL:

```typescript
// These are automatically parsed by the API:
- task.okrs (array)
- task.resourceLinks (array)
- task.recurrenceConfig (object)
```

## Remove localStorage References

After migration, you can remove these:

```typescript
// Delete these constants
const STORAGE_KEYS = {
    USERS: 'impactflow_pg_users',
    TASKS: 'impactflow_pg_tasks',
    // ... etc
};

// Remove localStorage calls
localStorage.getItem(STORAGE_KEYS.TASKS); // Not needed
localStorage.setItem(STORAGE_KEYS.TASKS, ...); // Not needed

// Keep only session management
localStorage.getItem('sessionToken'); // API client handles this
localStorage.setItem('sessionToken', ...); // API client handles this
```

## Testing Migration

### 1. Test Authentication First

```bash
# In browser console after login:
console.log(api.getSessionToken()); // Should show token
console.log(api.isAuthenticated()); // Should be true
```

### 2. Test One Component at a Time

Start with read-only components (display lists), then move to create/update components.

### 3. Test Error Cases

- Logout and try to access protected data
- Try invalid credentials
- Test network failures (disconnect internet)

## Common Issues & Solutions

### "Unauthorized" errors

```typescript
// Make sure you're calling api.authenticate() first
await api.authenticate(username, password);

// Or restore session
api.init();
await api.getCurrentUser(); // Verifies session
```

### CORS errors

Make sure backend `.env` has:
```env
FRONTEND_URL=http://localhost:3000
```

And frontend is accessing:
```typescript
const API_BASE = 'http://localhost:2001/api';
```

### "Network request failed"

- Check backend is running: `cd backend && npm run dev`
- Check URL is correct in `services/api.ts`
- Check browser console for CORS errors

### Data not updating

```typescript
// Refresh data after mutations
const handleCreate = async (task) => {
    await api.saveTask(task);
    // Refetch to get server version
    const tasks = await api.getTasks();
    setTasks(tasks);
};
```

## Performance Tips

### 1. Cache Data Locally

```typescript
const [tasks, setTasks] = useState([]);
const [lastFetch, setLastFetch] = useState(null);

const fetchTasks = async (force = false) => {
    // Only refetch if > 5 minutes old
    if (!force && lastFetch && Date.now() - lastFetch < 300000) {
        return;
    }

    const data = await api.getTasks();
    setTasks(data);
    setLastFetch(Date.now());
};
```

### 2. Debounce Search/Filter

```typescript
import { useMemo } from 'react';
import debounce from 'lodash/debounce';

const debouncedSearch = useMemo(
    () => debounce(async (query) => {
        const results = await api.getTasks({ search: query });
        setTasks(results);
    }, 300),
    []
);
```

### 3. Parallel Requests

```typescript
// Load multiple resources at once
const loadData = async () => {
    const [tasks, teams, users] = await Promise.all([
        api.getTasks(),
        api.getTeams(),
        api.getUsers()
    ]);

    setTasks(tasks);
    setTeams(teams);
    setUsers(users);
};
```

## Checklist

- [ ] Replace `import { db }` with `import { api }`
- [ ] Add `api.init()` in App component
- [ ] Update login to use `api.authenticate()`
- [ ] Update logout to use `api.logout()`
- [ ] Add loading states to all async operations
- [ ] Add error handling with try-catch
- [ ] Update task CRUD operations
- [ ] Update user management
- [ ] Update team management
- [ ] Update organization handling
- [ ] Remove localStorage calls (except session)
- [ ] Test authentication flow
- [ ] Test all CRUD operations
- [ ] Test error scenarios
- [ ] Test on different browsers
- [ ] Update any hard-coded IDs (UUIDs now from server)

## Need Help?

Check:
1. Browser console for errors
2. Network tab for failed requests
3. Backend logs: `cd backend && npm run dev`
4. API documentation: `backend/README.md`

Your localStorage version is a perfect reference - the API methods mirror the same structure!
