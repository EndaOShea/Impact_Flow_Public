/**
 * API Client for Impact Flow (Single User)
 *
 * This client handles all HTTP requests to the PostgreSQL backend.
 */

import { User, Task, SupportTicket, ReportSchedule } from '../types';

// API Configuration
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:2001/api';

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

        if (this.sessionToken) {
            headers['Authorization'] = `Bearer ${this.sessionToken}`;
        }

        const config: RequestInit = {
            ...options,
            headers,
            credentials: 'include',
        };

        try {
            const response = await fetch(`${API_BASE}${endpoint}`, config);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Request failed' }));
                throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
            }

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
     * Login with username and password
     */
    async authenticate(username: string, password: string): Promise<User> {
        const data = await this.request<{ user: User; sessionToken: string }>('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ username, password }),
        });

        this.sessionToken = data.sessionToken;
        localStorage.setItem('sessionToken', data.sessionToken);
        localStorage.setItem('currentUser', JSON.stringify(data.user));

        return data.user;
    }

    /**
     * Logout current user
     */
    async logout(): Promise<void> {
        try {
            await this.request('/auth/logout', { method: 'POST' });
        } catch (e) {
            // Ignore logout errors
        }
        this.sessionToken = null;
        localStorage.removeItem('sessionToken');
        localStorage.removeItem('currentUser');
    }

    /**
     * Delete current user account
     */
    async deleteAccount(password: string): Promise<void> {
        await this.request('/auth/account', {
            method: 'DELETE',
            body: JSON.stringify({ password })
        });
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
     * Get all tasks
     */
    async getTasks(filters?: {
        status?: string;
        priority?: string;
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
    async createTask(task: Task): Promise<Task> {
        return await this.request<Task>('/tasks', {
            method: 'POST',
            body: JSON.stringify(task),
        });
    }

    /**
     * Update existing task
     */
    async updateTask(taskId: string, task: Task): Promise<Task> {
        return await this.request<Task>(`/tasks/${taskId}`, {
            method: 'PUT',
            body: JSON.stringify(task),
        });
    }

    /**
     * Save task (create or update)
     */
    async saveTask(task: Task): Promise<Task> {
        if (task.id && task.createdAt) {
            return await this.updateTask(task.id, task);
        } else {
            return await this.createTask(task);
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
    // USER (Single user profile management)
    // ============================================================================

    /**
     * Update current user profile
     */
    async updateProfile(updates: Partial<User>): Promise<User> {
        return await this.request<User>('/auth/profile', {
            method: 'PUT',
            body: JSON.stringify(updates),
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
     * Set session token manually
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
