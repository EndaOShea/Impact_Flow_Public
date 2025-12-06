import { User, Team, Task, UserRole, TaskStatus, Priority, WorkCategory, ImpactType, SupportTicket, Organization, JoinRequest, TaskAssignmentRequest, ReportSchedule } from '../types';
import { argon2id } from 'hash-wasm';

/**
 * DB Service
 * 
 * Mimics a PostgreSQL database connection with secure Argon2 hashing.
 * Now supports Multi-Tenancy via Organizations and Multi-Team Users.
 */

const STORAGE_KEYS = {
    USERS: 'impactflow_pg_users',
    TEAMS: 'impactflow_pg_teams',
    TASKS: 'impactflow_pg_tasks',
    TICKETS: 'impactflow_pg_tickets',
    ORGS: 'impactflow_pg_orgs',
    JOIN_REQUESTS: 'impactflow_pg_join_requests',
    TASK_REQUESTS: 'impactflow_pg_task_requests',
    REPORT_SCHEDULES: 'impactflow_pg_report_schedules',
    INIT: 'impactflow_pg_init_v6' // Bump version to load new random test data
};

// --- ARGON2 HELPERS ---

const generateSalt = (): string => {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
};

const hashPassword = async (password: string): Promise<string> => {
    const salt = generateSalt();
    const hash = await argon2id({
        password,
        salt: new TextEncoder().encode(salt), // salt must be Uint8Array
        parallelism: 1,
        iterations: 256,
        memorySize: 512, // kb
        hashLength: 32,
        outputType: 'hex'
    });
    // Store as salt$hash
    return `${salt}$${hash}`;
};

const verifyPassword = async (password: string, storedHashString: string): Promise<boolean> => {
    const [salt, originalHash] = storedHashString.split('$');
    if (!salt || !originalHash) return false;

    const hash = await argon2id({
        password,
        salt: new TextEncoder().encode(salt),
        parallelism: 1,
        iterations: 256,
        memorySize: 512,
        hashLength: 32,
        outputType: 'hex'
    });

    return hash === originalHash;
};

// --- SEED DATA ---

const DEFAULT_ORG_ID = 'org_demo_1';
const TEST_ORG_ID = 'org_test_app';

const SEED_ORGS: Organization[] = [
    {
        id: DEFAULT_ORG_ID,
        name: 'Impact Flow HQ',
        ownerId: 'u1',
        createdAt: new Date()
    },
    {
        id: TEST_ORG_ID,
        name: 'Test App',
        ownerId: 'u_test0',
        createdAt: new Date()
    }
];

const SEED_TEAMS: Team[] = [
    // Impact Flow HQ Teams
    { id: 't1', organizationId: DEFAULT_ORG_ID, name: 'Product', color: 'bg-purple-500' },
    { id: 't2', organizationId: DEFAULT_ORG_ID, name: 'Engineering', color: 'bg-blue-500' },
    { id: 't3', organizationId: DEFAULT_ORG_ID, name: 'Design', color: 'bg-pink-500' },
    { id: 't4', organizationId: DEFAULT_ORG_ID, name: 'Marketing', color: 'bg-orange-500' },
    { id: 't5', organizationId: DEFAULT_ORG_ID, name: 'Customer Success', color: 'bg-green-500' },
    
    // Test App Teams
    { id: 't_sales', organizationId: TEST_ORG_ID, name: 'Sales', color: 'bg-green-500' },
    { id: 't_mkt', organizationId: TEST_ORG_ID, name: 'Marketing', color: 'bg-orange-500' },
    { id: 't_eng', organizationId: TEST_ORG_ID, name: 'Engineering', color: 'bg-blue-500' },
    { id: 't_ops', organizationId: TEST_ORG_ID, name: 'DevOps', color: 'bg-slate-500' },
    { id: 't_hr', organizationId: TEST_ORG_ID, name: 'HR', color: 'bg-rose-500' }
];

const SEED_USERS_RAW = [
    // System Admin
    { id: 'u0', organizationId: null, username: 'sysadmin', name: 'System Admin', email: 'sysadmin@impactflow.com', role: UserRole.SYSTEM_ADMIN, teamIds: [], avatarInitials: 'SA', password: 'SysPassword1!', recoveryKey: 'RK-SYS-0000-KEY' },
    
    // Impact Flow HQ Users
    { id: 'u1', organizationId: DEFAULT_ORG_ID, username: 'admin', name: 'Alex Admin', email: 'alex@impactflow.com', role: UserRole.OWNER, teamIds: ['t1', 't4'], avatarInitials: 'AA', password: 'Password123!', recoveryKey: 'RK-ADMIN-0000-KEY' },
    { id: 'u2', organizationId: DEFAULT_ORG_ID, username: 'sarah', name: 'Sarah Dev', email: 'sarah@impactflow.com', role: UserRole.USER, teamIds: ['t2', 't5'], avatarInitials: 'SD', password: 'Password123!', recoveryKey: 'RK-USER-1111-KEY' },
    { id: 'u3', organizationId: DEFAULT_ORG_ID, username: 'mike', name: 'Mike Design', email: 'mike@impactflow.com', role: UserRole.USER, teamIds: ['t3', 't1'], avatarInitials: 'MD', password: 'Password123!', recoveryKey: 'RK-USER-2222-KEY' },

    // Test App Users
    { id: 'u_test0', organizationId: TEST_ORG_ID, username: 'test0', name: 'Test Owner', email: 'test0@testapp.com', role: UserRole.OWNER, teamIds: [], avatarInitials: 'TO', password: 'Password123!', recoveryKey: 'RK-TEST-0000-KEY' },
    { id: 'u_test1', organizationId: TEST_ORG_ID, username: 'test1', name: 'Test Sales Admin', email: 'test1@testapp.com', role: UserRole.TEAM_ADMIN, teamIds: ['t_sales', 't_mkt'], avatarInitials: 'T1', password: 'Password123!', recoveryKey: 'RK-TEST-1111-KEY' },
    { id: 'u_test2', organizationId: TEST_ORG_ID, username: 'test2', name: 'Test Sales User', email: 'test2@testapp.com', role: UserRole.USER, teamIds: ['t_sales'], avatarInitials: 'T2', password: 'Password123!', recoveryKey: 'RK-TEST-2222-KEY' },
    { id: 'u_test3', organizationId: TEST_ORG_ID, username: 'test3', name: 'Test Floater', email: 'test3@testapp.com', role: UserRole.USER, teamIds: ['t_ops'], avatarInitials: 'T3', password: 'Password123!', recoveryKey: 'RK-TEST-3333-KEY' },
];

// --- RANDOM TASK GENERATOR ---
const generateRandomTasks = (): any[] => {
    const tasks: any[] = [];
    const TITLES_VERBS = ['Fix', 'Implement', 'Design', 'Review', 'Optimize', 'Deploy', 'Analyze', 'Test', 'Update', 'Refactor'];
    const TITLES_NOUNS = ['Login Flow', 'Database Schema', 'Homepage UI', 'API Rate Limits', 'AWS Infrastructure', 'User Onboarding', 'Q3 Sales Report', 'Mobile Nav', 'Checkout Process', 'Search Algo'];
    const CATEGORIES = Object.values(WorkCategory);
    
    // Helper to pick random array element
    const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
    const randomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

    // Create 50 tasks
    for (let i = 0; i < 50; i++) {
        // Randomly assign to one of the organizations and a valid user in that org
        const orgId = Math.random() > 0.5 ? DEFAULT_ORG_ID : TEST_ORG_ID;
        const orgUsers = SEED_USERS_RAW.filter(u => u.organizationId === orgId);
        if (orgUsers.length === 0) continue;
        
        const creator = pick(orgUsers);
        const assignee = pick(orgUsers);
        
        // Random Date in past year
        const daysAgo = randomInt(0, 365);
        const createdAt = new Date();
        createdAt.setDate(createdAt.getDate() - daysAgo);
        
        // Derived Dates
        const startDate = new Date(createdAt);
        startDate.setDate(startDate.getDate() + randomInt(1, 5));
        
        const dueDate = new Date(startDate);
        dueDate.setDate(dueDate.getDate() + randomInt(2, 14));

        // Random Status weighted towards completed for historical data
        const rand = Math.random();
        let status = TaskStatus.TODO;
        let completedAt: Date | undefined = undefined;
        
        if (rand > 0.6) {
            status = TaskStatus.COMPLETED;
            completedAt = new Date(dueDate);
            completedAt.setDate(completedAt.getDate() + randomInt(-2, 2)); // Finished around due date
        } else if (rand > 0.4) {
            status = TaskStatus.IN_PROGRESS;
        } else if (rand > 0.3) {
            status = TaskStatus.REVIEW;
        }

        // Subtasks
        const subtasks = [];
        const numSubtasks = randomInt(1, 5);
        for(let j=0; j<numSubtasks; j++) {
            subtasks.push({
                id: crypto.randomUUID(),
                title: `Step ${j+1}: ${pick(['Research', 'Draft', 'Code', 'Test', 'Document'])}`,
                completed: status === TaskStatus.COMPLETED ? true : Math.random() > 0.5,
                hoursSpent: randomInt(1, 8),
                estimatedHours: randomInt(2, 12),
                category: pick(CATEGORIES),
                notes: 'Generated test note.',
                isMilestone: Math.random() > 0.8 // 20% chance to be a milestone
            });
        }

        // Metrics
        const impactMetrics = [];
        if (Math.random() > 0.5) {
            const type = pick([ImpactType.REVENUE, ImpactType.EFFICIENCY, ImpactType.SATISFACTION]);
            impactMetrics.push({
                id: crypto.randomUUID(),
                type: type,
                value: randomInt(1000, 50000),
                achievedValue: status === TaskStatus.COMPLETED ? randomInt(1000, 50000) : 0,
                currency: 'USD',
                description: 'Projected impact'
            });
        }

        tasks.push({
            id: `auto_task_${i}`,
            organizationId: orgId,
            title: `${pick(TITLES_VERBS)} ${pick(TITLES_NOUNS)}`,
            description: 'This is an automatically generated test task to populate the database with historical data.',
            status: status,
            priority: pick(Object.values(Priority)),
            createdAt: createdAt,
            startDate: startDate,
            dueDate: dueDate,
            assigneeIds: [assignee.id],
            creatorId: creator.id,
            adminIds: [creator.id],
            isRecurring: Math.random() > 0.9,
            dependencyIds: [],
            subtasks: subtasks,
            impactMetrics: impactMetrics,
            attachments: [],
            comments: [],
            automations: [],
            resourceLinks: [],
            completedAt: completedAt,
            diagramCode: '',
            activityLog: []
        });
    }
    return tasks;
};

const SEED_TICKETS: SupportTicket[] = [
    { id: 'tik1', userId: 'u2', subject: 'Password Reset Help', message: 'I cannot find my recovery key.', status: 'OPEN', createdAt: new Date() },
    { id: 'tik2', userId: 'u3', subject: 'Feature Request', message: 'Can we have dark mode?', status: 'RESOLVED', createdAt: new Date(Date.now() - 86400000) }
];

export const db = {
    // --- INITIALIZATION ---
    async init() {
        const isInit = localStorage.getItem(STORAGE_KEYS.INIT);
        if (!isInit) {
            console.log("Initializing Simulated Database with Organizations and Random Data...");
            
            // Hash passwords for seed users
            const seededUsers: User[] = [];
            for (const u of SEED_USERS_RAW) {
                const hash = await hashPassword(u.password);
                seededUsers.push({
                    id: u.id,
                    organizationId: u.organizationId,
                    username: u.username,
                    name: u.name,
                    email: u.email,
                    role: u.role,
                    teamIds: u.teamIds,
                    avatarInitials: u.avatarInitials,
                    passwordHash: hash,
                    recoveryKey: u.recoveryKey
                });
            }

            // Generate Random Tasks
            const randomTasks = generateRandomTasks();

            localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(seededUsers));
            localStorage.setItem(STORAGE_KEYS.TEAMS, JSON.stringify(SEED_TEAMS));
            localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(randomTasks));
            localStorage.setItem(STORAGE_KEYS.TICKETS, JSON.stringify(SEED_TICKETS));
            localStorage.setItem(STORAGE_KEYS.ORGS, JSON.stringify(SEED_ORGS));
            localStorage.setItem(STORAGE_KEYS.JOIN_REQUESTS, JSON.stringify([]));
            localStorage.setItem(STORAGE_KEYS.TASK_REQUESTS, JSON.stringify([]));
            localStorage.setItem(STORAGE_KEYS.REPORT_SCHEDULES, JSON.stringify([]));
            
            localStorage.setItem(STORAGE_KEYS.INIT, 'true');
        }
    },

    // --- ORGANIZATION METHODS ---
    async createOrganization(name: string, ownerId: string): Promise<Organization> {
        const orgs = await this.getOrganizations();
        const newOrg: Organization = {
            id: crypto.randomUUID(),
            name,
            ownerId,
            createdAt: new Date()
        };
        orgs.push(newOrg);
        localStorage.setItem(STORAGE_KEYS.ORGS, JSON.stringify(orgs));
        
        // Update Owner
        const users = await this.getUsers();
        const ownerIndex = users.findIndex(u => u.id === ownerId);
        if (ownerIndex !== -1) {
            users[ownerIndex].organizationId = newOrg.id;
            users[ownerIndex].role = UserRole.OWNER;
            localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
        }

        return newOrg;
    },

    async getOrganizations(): Promise<Organization[]> {
        const data = localStorage.getItem(STORAGE_KEYS.ORGS);
        if (!data) return [];
        try {
            return JSON.parse(data);
        } catch(e) { return []; }
    },

    async requestJoin(userId: string, organizationId: string): Promise<void> {
        const requests = await this.getJoinRequests();
        if (requests.some(r => r.userId === userId && r.organizationId === organizationId && r.status === 'PENDING')) {
            throw new Error("Request already pending");
        }
        
        const newReq: JoinRequest = {
            id: crypto.randomUUID(),
            userId,
            organizationId,
            status: 'PENDING',
            createdAt: new Date()
        };
        requests.push(newReq);
        localStorage.setItem(STORAGE_KEYS.JOIN_REQUESTS, JSON.stringify(requests));
    },

    async cancelJoinRequest(requestId: string): Promise<void> {
        let requests = await this.getJoinRequests();
        requests = requests.filter(r => r.id !== requestId);
        localStorage.setItem(STORAGE_KEYS.JOIN_REQUESTS, JSON.stringify(requests));
    },

    async getJoinRequests(): Promise<JoinRequest[]> {
        const data = localStorage.getItem(STORAGE_KEYS.JOIN_REQUESTS);
        if (!data) return [];
        try {
            const reqs = JSON.parse(data);
            return reqs.map((r: any) => ({...r, createdAt: new Date(r.createdAt)}));
        } catch(e) { return []; }
    },

    async processJoinRequest(requestId: string, status: 'APPROVED' | 'REJECTED'): Promise<void> {
        const requests = await this.getJoinRequests();
        const idx = requests.findIndex(r => r.id === requestId);
        if (idx === -1) return;

        requests[idx].status = status;
        localStorage.setItem(STORAGE_KEYS.JOIN_REQUESTS, JSON.stringify(requests));

        if (status === 'APPROVED') {
            const req = requests[idx];
            const users = await this.getUsers();
            const userIdx = users.findIndex(u => u.id === req.userId);
            if (userIdx !== -1) {
                users[userIdx].organizationId = req.organizationId;
                users[userIdx].role = UserRole.USER; // Default role
                localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
            }
        }
    },

    // --- TASK ASSIGNMENT REQUESTS ---

    async createTaskAssignmentRequest(taskId: string, taskTitle: string, orgId: string, requesterId: string, targetUserId: string, targetTeamId: string): Promise<void> {
        const requests = await this.getTaskAssignmentRequests();
        const newReq: TaskAssignmentRequest = {
            id: crypto.randomUUID(),
            taskId,
            taskTitle,
            organizationId: orgId,
            requesterId,
            targetUserId,
            targetTeamId,
            status: 'PENDING',
            createdAt: new Date()
        };
        requests.push(newReq);
        localStorage.setItem(STORAGE_KEYS.TASK_REQUESTS, JSON.stringify(requests));
    },

    async getTaskAssignmentRequests(): Promise<TaskAssignmentRequest[]> {
        const data = localStorage.getItem(STORAGE_KEYS.TASK_REQUESTS);
        if (!data) return [];
        try {
            const reqs = JSON.parse(data);
            return reqs.map((r: any) => ({...r, createdAt: new Date(r.createdAt)}));
        } catch (e) { return []; }
    },

    async processTaskAssignmentRequest(requestId: string, status: 'APPROVED' | 'REJECTED'): Promise<void> {
        const requests = await this.getTaskAssignmentRequests();
        const idx = requests.findIndex(r => r.id === requestId);
        if (idx === -1) return;

        requests[idx].status = status;
        localStorage.setItem(STORAGE_KEYS.TASK_REQUESTS, JSON.stringify(requests));

        if (status === 'APPROVED') {
            const req = requests[idx];
            const tasks = await this.getTasks();
            const taskIdx = tasks.findIndex(t => t.id === req.taskId);
            if (taskIdx !== -1) {
                // Add the user to the assignee list (don't replace)
                const currentAssignees = tasks[taskIdx].assigneeIds || [];
                if (!currentAssignees.includes(req.targetUserId)) {
                    tasks[taskIdx].assigneeIds = [...currentAssignees, req.targetUserId];
                }
                tasks[taskIdx].pendingAssigneeId = undefined; // Clear pending
                localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks));
            }
        } else if (status === 'REJECTED') {
             const req = requests[idx];
             const tasks = await this.getTasks();
             const taskIdx = tasks.findIndex(t => t.id === req.taskId);
             if (taskIdx !== -1) {
                 tasks[taskIdx].pendingAssigneeId = undefined;
                 localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks));
             }
        }
    },

    // --- REPORT SCHEDULES ---
    async getReportSchedules(): Promise<ReportSchedule[]> {
        const data = localStorage.getItem(STORAGE_KEYS.REPORT_SCHEDULES);
        if (!data) return [];
        try {
            return JSON.parse(data);
        } catch(e) { return []; }
    },

    async createReportSchedule(schedule: ReportSchedule): Promise<void> {
        const items = await this.getReportSchedules();
        items.push(schedule);
        localStorage.setItem(STORAGE_KEYS.REPORT_SCHEDULES, JSON.stringify(items));
    },

    async deleteReportSchedule(id: string): Promise<void> {
        let items = await this.getReportSchedules();
        items = items.filter(i => i.id !== id);
        localStorage.setItem(STORAGE_KEYS.REPORT_SCHEDULES, JSON.stringify(items));
    },

    // --- USER METHODS ---
    async getUsers(): Promise<User[]> {
        const data = localStorage.getItem(STORAGE_KEYS.USERS);
        if (!data) return [];
        try {
            const loadedUsers = JSON.parse(data);
            // Migration: Ensure all users have teamIds array, convert old teamId if present
            return loadedUsers.map((u: any) => ({
                ...u,
                teamIds: u.teamIds || (u.teamId ? [u.teamId] : [])
            }));
        } catch(e) { return []; }
    },

    async createUser(user: Partial<User>, passwordPlain: string): Promise<User> {
        const users = await this.getUsers();
        if (users.some(u => u.username.toLowerCase() === user.username?.toLowerCase())) {
            throw new Error('Username already exists');
        }

        const hash = await hashPassword(passwordPlain);

        const newUser: User = {
            id: user.id || crypto.randomUUID(),
            organizationId: user.organizationId || null,
            username: user.username!,
            name: user.name || user.username!,
            email: user.email || '',
            role: user.role || UserRole.USER,
            teamIds: user.teamIds || [],
            avatarInitials: user.avatarInitials || '??',
            passwordHash: hash,
            recoveryKey: user.recoveryKey
        };

        users.push(newUser);
        localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
        return newUser;
    },

    async updateUser(user: User): Promise<void> {
        const users = await this.getUsers();
        const index = users.findIndex(u => u.id === user.id);
        if (index !== -1) {
            users[index] = user;
            localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
        }
    },

    async deleteUser(id: string): Promise<void> {
        let users = await this.getUsers();
        users = users.filter(u => u.id !== id);
        localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
    },

    // --- AUTH METHODS ---
    async authenticate(username: string, passwordPlain: string): Promise<User | null> {
        const users = await this.getUsers();
        const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());
        if (!user || !user.passwordHash) return null;
        try {
            const isValid = await verifyPassword(passwordPlain, user.passwordHash);
            if (isValid) return user;
        } catch (e) { return null; }
        return null;
    },

    async resetPassword(recoveryKey: string, newPasswordPlain: string): Promise<User | null> {
        const users = await this.getUsers();
        const userIndex = users.findIndex(u => u.recoveryKey === recoveryKey);
        if (userIndex === -1) return null;
        const hash = await hashPassword(newPasswordPlain);
        users[userIndex].passwordHash = hash;
        localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
        return users[userIndex];
    },

    // --- TEAM METHODS ---
    async getTeams(): Promise<Team[]> {
        const data = localStorage.getItem(STORAGE_KEYS.TEAMS);
        if (!data) return [];
        try {
            return JSON.parse(data);
        } catch (e) { return []; }
    },

    async createTeam(team: Team): Promise<void> {
        const teams = await this.getTeams();
        teams.push(team);
        localStorage.setItem(STORAGE_KEYS.TEAMS, JSON.stringify(teams));
    },

    async deleteTeam(id: string): Promise<void> {
        let teams = await this.getTeams();
        teams = teams.filter(t => t.id !== id);
        localStorage.setItem(STORAGE_KEYS.TEAMS, JSON.stringify(teams));
    },

    // --- TASK METHODS ---
    async getTasks(): Promise<Task[]> {
        const data = localStorage.getItem(STORAGE_KEYS.TASKS);
        if (!data) return [];
        try {
            const tasks = JSON.parse(data);
            return tasks.map((t: any) => ({
                ...t,
                createdAt: new Date(t.createdAt),
                startDate: t.startDate ? new Date(t.startDate) : undefined,
                dueDate: t.dueDate ? new Date(t.dueDate) : undefined,
                completedAt: t.completedAt ? new Date(t.completedAt) : undefined,
                subtasks: t.subtasks || [],
                impactMetrics: t.impactMetrics || [],
                automations: t.automations || [],
                dependencyIds: t.dependencyIds || [],
                resourceLinks: t.resourceLinks || [],
                comments: t.comments?.map((c: any) => ({...c, createdAt: new Date(c.createdAt)})) || [],
                attachments: t.attachments?.map((a: any) => ({...a, createdAt: new Date(a.createdAt)})) || [],
                activityLog: t.activityLog?.map((l: any) => ({...l, timestamp: new Date(l.timestamp)})) || [], // Activity Log Init
                
                // Migration for Multi-Assignee
                assigneeIds: t.assigneeIds || (t.assigneeId ? [t.assigneeId] : []),
                creatorId: t.creatorId || (t.assigneeIds ? t.assigneeIds[0] : t.assigneeId),
                adminIds: t.adminIds || (t.creatorId ? [t.creatorId] : []),
                assignedTeamId: t.assignedTeamId, // New field mapping
                
                organizationId: t.organizationId || DEFAULT_ORG_ID // Backfill old tasks
            }));
        } catch(e) { 
            console.error("Task DB Parse Error", e);
            return [];
        }
    },

    async saveTask(task: Task): Promise<void> {
        const tasks = await this.getTasks();
        const index = tasks.findIndex(t => t.id === task.id);
        if (index !== -1) {
            tasks[index] = task;
        } else {
            tasks.unshift(task); 
        }
        localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks));
    },

    // --- TICKET METHODS ---
    async getTickets(): Promise<SupportTicket[]> {
        const data = localStorage.getItem(STORAGE_KEYS.TICKETS);
        if (!data) return [];
        try {
            const tickets = JSON.parse(data);
            return tickets.map((t: any) => ({ ...t, createdAt: new Date(t.createdAt) }));
        } catch (e) { return []; }
    },

    async resolveTicket(id: string): Promise<void> {
        const tickets = await this.getTickets();
        const index = tickets.findIndex(t => t.id === id);
        if (index !== -1) {
            tickets[index].status = 'RESOLVED';
            localStorage.setItem(STORAGE_KEYS.TICKETS, JSON.stringify(tickets));
        }
    }
};

// --- HELPER FOR ID GENERATION ---
// Fallback for environments where crypto.randomUUID is not available (non-secure contexts)
if (!crypto.randomUUID) {
    crypto.randomUUID = () => {
        return (
            String(1e7) +
            -1e3 +
            -4e3 +
            -8e3 +
            -1e11
        ).replace(/[018]/g, (c: any) =>
            (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16)
        ) as `${string}-${string}-${string}-${string}-${string}`;
    };
}