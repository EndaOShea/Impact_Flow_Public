/**
 * API Client for Impact Flow
 *
 * This client replaces the localStorage-based db.ts with real API calls
 * to the PostgreSQL backend.
 */

import { User, Task, Team, Organization, JoinRequest, TaskAssignmentRequest, SupportTicket, ReportSchedule } from '../types';

// API Configuration
const API_BASE = process.env.NODE_ENV === 'production'
    ? 'https://your-backend-url.com/api'  // Replace with your production backend URL
    : 'http://localhost:2001/api';

/**
 * API Client Class
 * Handles all HTTP requests to the backend with authentication
 */
class ApiClient {
    private sessionToken: string | null = null;

    /**
     * Generic request handler with authentication
     */
    private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
        const headers: HeadersInit = {
            'Content-Type': 'application/json',
            ...(options.headers || {}),
        };

        // Add authorization header if we have a session token
        if (this.sessionToken) {
            headers['Authorization'] = `Bearer ${this.sessionToken}`;
        }

        const config: RequestInit = {
            ...options,
            headers,
            credentials: 'include', // Include cookies for session management
        };

        try {
            const response = await fetch(`${API_BASE}${endpoint}`, config);

            // Handle non-OK responses
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Request failed' }));
                throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
            }

            // Parse JSON response
            return await response.json();
        } catch (error) {
            console.error(`API Error [${endpoint}]:`, error);
            throw error;
        }
    }

    // ============================================================================
    // AUTHENTICATION
    // ============================================================================

    /**
     * Register a new user
     */
    async register(username: string, password: string, name: string, email?: string): Promise<{ user: User; recoveryKey: string }> {
        const data = await this.request<{ user: User; recoveryKey: string }>('/auth/register', {
            method: 'POST',
            body: JSON.stringify({ username, password, name, email }),
        });
        return data;
    }

    /**
     * Login with username and password (replaces db.authenticate)
     */
    async authenticate(username: string, password: string): Promise<User> {
        const data = await this.request<{ user: User; sessionToken: string }>('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ username, password }),
        });

        // Store session token for subsequent requests
        this.sessionToken = data.sessionToken;

        // Also store in localStorage for persistence across page refreshes
        localStorage.setItem('sessionToken', data.sessionToken);
        localStorage.setItem('currentUser', JSON.stringify(data.user));

        return data.user;
    }

    /**
     * Logout current user
     */
    async logout(): Promise<void> {
        await this.request('/auth/logout', { method: 'POST' });
        this.sessionToken = null;
        localStorage.removeItem('sessionToken');
        localStorage.removeItem('currentUser');
    }

    /**
     * Get current logged-in user
     */
    async getCurrentUser(): Promise<User | null> {
        try {
            const data = await this.request<{ user: User }>('/auth/me');
            return data.user;
        } catch (error) {
            // Session expired or not authenticated
            this.sessionToken = null;
            localStorage.removeItem('sessionToken');
            localStorage.removeItem('currentUser');
            return null;
        }
    }

    /**
     * Reset password using recovery key
     */
    async resetPassword(recoveryKey: string, newPassword: string): Promise<void> {
        await this.request('/auth/reset-password', {
            method: 'POST',
            body: JSON.stringify({ recoveryKey, newPassword }),
        });
    }

    /**
     * Change password (authenticated user)
     */
    async changePassword(currentPassword: string, newPassword: string): Promise<void> {
        await this.request('/auth/change-password', {
            method: 'POST',
            body: JSON.stringify({ currentPassword, newPassword }),
        });
    }

    /**
     * Initialize session from localStorage (call on app startup)
     */
    init(): User | null {
        const token = localStorage.getItem('sessionToken');
        const userStr = localStorage.getItem('currentUser');

        if (token && userStr) {
            this.sessionToken = token;
            try {
                return JSON.parse(userStr);
            } catch (error) {
                console.error('Failed to parse stored user:', error);
                localStorage.removeItem('currentUser');
                localStorage.removeItem('sessionToken');
            }
        }

        return null;
    }

    // ============================================================================
    // TASKS
    // ============================================================================

    /**
     * Get all tasks (filtered by organization and role)
     */
    async getTasks(filters?: {
        status?: string;
        priority?: string;
        assigneeId?: string;
        teamId?: string;
    }): Promise<Task[]> {
        const queryParams = new URLSearchParams();
        if (filters) {
            Object.entries(filters).forEach(([key, value]) => {
                if (value) queryParams.append(key, value);
            });
        }

        const endpoint = `/tasks${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
        return await this.request<Task[]>(endpoint);
    }

    /**
     * Get single task by ID
     */
    async getTask(taskId: string): Promise<Task> {
        return await this.request<Task>(`/tasks/${taskId}`);
    }

    /**
     * Create a new task
     */
    async saveTask(task: Task): Promise<Task> {
        if (task.id && task.createdAt) {
            // Update existing task
            return await this.request<Task>(`/tasks/${task.id}`, {
                method: 'PUT',
                body: JSON.stringify(task),
            });
        } else {
            // Create new task
            return await this.request<Task>('/tasks', {
                method: 'POST',
                body: JSON.stringify(task),
            });
        }
    }

    /**
     * Delete a task
     */
    async deleteTask(taskId: string): Promise<void> {
        await this.request(`/tasks/${taskId}`, { method: 'DELETE' });
    }

    /**
     * Add subtask to task
     */
    async addSubtask(taskId: string, subtask: any): Promise<any> {
        return await this.request(`/tasks/${taskId}/subtasks`, {
            method: 'POST',
            body: JSON.stringify(subtask),
        });
    }

    /**
     * Update subtask
     */
    async updateSubtask(taskId: string, subtaskId: string, updates: any): Promise<any> {
        return await this.request(`/tasks/${taskId}/subtasks/${subtaskId}`, {
            method: 'PUT',
            body: JSON.stringify(updates),
        });
    }

    /**
     * Delete subtask
     */
    async deleteSubtask(taskId: string, subtaskId: string): Promise<void> {
        await this.request(`/tasks/${taskId}/subtasks/${subtaskId}`, {
            method: 'DELETE',
        });
    }

    /**
     * Add comment to task
     */
    async addComment(taskId: string, text: string): Promise<any> {
        return await this.request(`/tasks/${taskId}/comments`, {
            method: 'POST',
            body: JSON.stringify({ text }),
        });
    }

    /**
     * Add attachment to task
     */
    async addAttachment(taskId: string, attachment: { name: string; type: string; url: string; size: number }): Promise<any> {
        return await this.request(`/tasks/${taskId}/attachments`, {
            method: 'POST',
            body: JSON.stringify(attachment),
        });
    }

    /**
     * Delete attachment
     */
    async deleteAttachment(taskId: string, attachmentId: string): Promise<void> {
        await this.request(`/tasks/${taskId}/attachments/${attachmentId}`, {
            method: 'DELETE',
        });
    }

    // ============================================================================
    // USERS
    // ============================================================================

    /**
     * Get all users in organization
     */
    async getUsers(): Promise<User[]> {
        return await this.request<User[]>('/users');
    }

    /**
     * Get user by ID
     */
    async getUser(userId: string): Promise<User> {
        return await this.request<User>(`/users/${userId}`);
    }

    /**
     * Update user
     */
    async updateUser(user: User): Promise<User> {
        return await this.request<User>(`/users/${user.id}`, {
            method: 'PUT',
            body: JSON.stringify(user),
        });
    }

    /**
     * Delete user
     */
    async deleteUser(userId: string): Promise<void> {
        await this.request(`/users/${userId}`, { method: 'DELETE' });
    }

    /**
     * Create user (admin only)
     */
    async createUser(user: Partial<User>, password: string): Promise<User> {
        return await this.request<User>('/users', {
            method: 'POST',
            body: JSON.stringify({ ...user, password }),
        });
    }

    // ============================================================================
    // ORGANIZATIONS
    // ============================================================================

    /**
     * Get all organizations (system admin only)
     */
    async getOrganizations(): Promise<Organization[]> {
        return await this.request<Organization[]>('/organizations');
    }

    /**
     * Get organization by ID
     */
    async getOrganization(orgId: string): Promise<Organization> {
        return await this.request<Organization>(`/organizations/${orgId}`);
    }

    /**
     * Create organization
     */
    async createOrganization(name: string): Promise<Organization> {
        return await this.request<Organization>('/organizations', {
            method: 'POST',
            body: JSON.stringify({ name }),
        });
    }

    /**
     * Delete organization (Owner only)
     */
    async deleteOrganization(organizationId: string): Promise<void> {
        await this.request(`/organizations/${organizationId}`, {
            method: 'DELETE',
        });
    }

    /**
     * Upload organization banner (Owner/Admin only)
     */
    async uploadOrganizationBanner(organizationId: string, base64Image: string): Promise<void> {
        await this.request(`/organizations/${organizationId}/banner`, {
            method: 'POST',
            body: JSON.stringify({ banner: base64Image }),
        });
    }

    /**
     * Request to join organization
     */
    async requestJoin(organizationId: string): Promise<void> {
        await this.request(`/organizations/${organizationId}/join-request`, {
            method: 'POST',
        });
    }

    /**
     * Cancel join request
     */
    async cancelJoinRequest(requestId: string): Promise<void> {
        await this.request(`/organizations/join-requests/${requestId}`, {
            method: 'DELETE',
        });
    }

    /**
     * Get join requests for organization
     */
    async getJoinRequests(organizationId?: string): Promise<JoinRequest[]> {
        const endpoint = organizationId
            ? `/organizations/${organizationId}/join-requests`
            : '/organizations/join-requests';
        return await this.request<JoinRequest[]>(endpoint);
    }

    /**
     * Process join request (approve/reject)
     */
    async processJoinRequest(organizationId: string, requestId: string, status: 'APPROVED' | 'REJECTED'): Promise<void> {
        await this.request(`/organizations/${organizationId}/join-requests/${requestId}/${status.toLowerCase()}`, {
            method: 'POST',
        });
    }

    // ============================================================================
    // TEAMS
    // ============================================================================

    /**
     * Get all teams in organization
     */
    async getTeams(): Promise<Team[]> {
        return await this.request<Team[]>('/teams');
    }

    /**
     * Create team
     */
    async createTeam(team: Omit<Team, 'id' | 'createdAt'>): Promise<Team> {
        return await this.request<Team>('/teams', {
            method: 'POST',
            body: JSON.stringify(team),
        });
    }

    /**
     * Update team
     */
    async updateTeam(team: Team): Promise<Team> {
        return await this.request<Team>(`/teams/${team.id}`, {
            method: 'PUT',
            body: JSON.stringify(team),
        });
    }

    /**
     * Delete team
     */
    async deleteTeam(teamId: string): Promise<void> {
        await this.request(`/teams/${teamId}`, { method: 'DELETE' });
    }

    /**
     * Add user to team
     */
    async addTeamMember(teamId: string, userId: string): Promise<void> {
        await this.request(`/teams/${teamId}/members`, {
            method: 'POST',
            body: JSON.stringify({ userId }),
        });
    }

    /**
     * Remove user from team
     */
    async removeTeamMember(teamId: string, userId: string): Promise<void> {
        await this.request(`/teams/${teamId}/members/${userId}`, {
            method: 'DELETE',
        });
    }

    // ============================================================================
    // TASK ASSIGNMENT REQUESTS (Cross-team)
    // ============================================================================

    /**
     * Get task assignment requests
     */
    async getTaskAssignmentRequests(): Promise<TaskAssignmentRequest[]> {
        return await this.request<TaskAssignmentRequest[]>('/task-assignment-requests');
    }

    /**
     * Create task assignment request
     */
    async createTaskAssignmentRequest(
        taskId: string,
        taskTitle: string,
        targetUserId: string,
        targetTeamId: string
    ): Promise<void> {
        await this.request('/task-assignment-requests', {
            method: 'POST',
            body: JSON.stringify({ taskId, taskTitle, targetUserId, targetTeamId }),
        });
    }

    /**
     * Process task assignment request
     */
    async processTaskAssignmentRequest(requestId: string, status: 'APPROVED' | 'REJECTED'): Promise<void> {
        await this.request(`/task-assignment-requests/${requestId}/${status.toLowerCase()}`, {
            method: 'POST',
        });
    }

    // ============================================================================
    // SUPPORT TICKETS
    // ============================================================================

    /**
     * Get support tickets
     */
    async getTickets(): Promise<SupportTicket[]> {
        return await this.request<SupportTicket[]>('/tickets');
    }

    /**
     * Create support ticket
     */
    async createTicket(ticket: Omit<SupportTicket, 'id' | 'createdAt' | 'status'>): Promise<SupportTicket> {
        return await this.request<SupportTicket>('/tickets', {
            method: 'POST',
            body: JSON.stringify(ticket),
        });
    }

    /**
     * Resolve ticket
     */
    async resolveTicket(ticketId: string): Promise<void> {
        await this.request(`/tickets/${ticketId}/resolve`, {
            method: 'POST',
        });
    }

    // ============================================================================
    // REPORT SCHEDULES
    // ============================================================================

    /**
     * Get report schedules
     */
    async getReportSchedules(): Promise<ReportSchedule[]> {
        return await this.request<ReportSchedule[]>('/report-schedules');
    }

    /**
     * Create report schedule
     */
    async createReportSchedule(schedule: Omit<ReportSchedule, 'id'>): Promise<ReportSchedule> {
        return await this.request<ReportSchedule>('/report-schedules', {
            method: 'POST',
            body: JSON.stringify(schedule),
        });
    }

    /**
     * Delete report schedule
     */
    async deleteReportSchedule(scheduleId: string): Promise<void> {
        await this.request(`/report-schedules/${scheduleId}`, {
            method: 'DELETE',
        });
    }

    // ============================================================================
    // UTILITY METHODS
    // ============================================================================

    /**
     * Check if user is authenticated
     */
    isAuthenticated(): boolean {
        return this.sessionToken !== null;
    }

    /**
     * Get current session token
     */
    getSessionToken(): string | null {
        return this.sessionToken;
    }

    /**
     * Set session token manually (useful for testing or manual auth)
     */
    setSessionToken(token: string): void {
        this.sessionToken = token;
        localStorage.setItem('sessionToken', token);
    }
}

// Export singleton instance
export const api = new ApiClient();

// Export the class for testing or custom instances
export default ApiClient;
