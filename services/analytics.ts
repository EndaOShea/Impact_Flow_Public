import { api } from './api';

export class AnalyticsService {
    private static sessionStart: number = Date.now();
    private static lastActivity: number = Date.now();
    private static eventQueue: Array<{eventType: string; eventCategory: string; eventData?: any}> = [];
    private static flushInterval: NodeJS.Timeout | null = null;

    /**
     * Initialize analytics tracking
     */
    static init() {
        this.sessionStart = Date.now();
        this.lastActivity = Date.now();

        // Track page visibility changes
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                this.track('session_resumed', 'auth');
            }
        });

        // Flush events every 30 seconds
        this.flushInterval = setInterval(() => {
            this.flush();
        }, 30000);

        // Track initial page load
        this.track('app_opened', 'navigation');
    }

    /**
     * Track an event (queued and batched)
     */
    static track(eventType: string, eventCategory: string, eventData?: any) {
        this.lastActivity = Date.now();
        this.eventQueue.push({ eventType, eventCategory, eventData });

        // Flush if queue is large
        if (this.eventQueue.length >= 10) {
            this.flush();
        }
    }

    /**
     * Flush queued events to server
     */
    private static async flush() {
        if (this.eventQueue.length === 0) return;

        const events = [...this.eventQueue];
        this.eventQueue = [];

        // Send events in batches
        try {
            for (const event of events) {
                await api.post('/analytics/track', event);
            }
        } catch (error) {
            console.error('Analytics flush error:', error);
            // Re-queue failed events
            this.eventQueue.unshift(...events);
        }
    }

    /**
     * Get user analytics summary
     */
    static async getUserSummary(days: number = 30) {
        try {
            const response = await api.get(`/analytics/user/summary?days=${days}`);
            return response;
        } catch (error) {
            console.error('Get analytics summary error:', error);
            return null;
        }
    }

    /**
     * Get recent activity
     */
    static async getRecentActivity(limit: number = 50) {
        try {
            const response = await api.get(`/analytics/user/activity?limit=${limit}`);
            return response;
        } catch (error) {
            console.error('Get recent activity error:', error);
            return null;
        }
    }

    /**
     * Get system metrics
     */
    static async getSystemMetrics(days: number = 30) {
        try {
            const response = await api.get(`/analytics/system/metrics?days=${days}`);
            return response;
        } catch (error) {
            console.error('Get system metrics error:', error);
            return null;
        }
    }

    /**
     * Get temporal metrics (workload, velocity, time to completion, failed deadlines)
     */
    static async getTemporalMetrics(
        granularity: 'daily' | 'weekly' | 'monthly' = 'monthly',
        months: number = 12
    ) {
        try {
            const response = await api.get(
                `/analytics/temporal-metrics?granularity=${granularity}&months=${months}`
            );
            return response;
        } catch (error) {
            console.error('Get temporal metrics error:', error);
            return null;
        }
    }

    /**
     * Get session duration in minutes
     */
    static getSessionDuration(): number {
        return Math.floor((Date.now() - this.sessionStart) / 60000);
    }

    /**
     * Cleanup on app close
     */
    static cleanup() {
        this.flush();
        if (this.flushInterval) {
            clearInterval(this.flushInterval);
        }
    }
}

// Track common events automatically
export const trackEvent = {
    taskCreated: (taskId: string) => AnalyticsService.track('task_created', 'task', { taskId }),
    taskCompleted: (taskId: string) => AnalyticsService.track('task_completed', 'task', { taskId }),
    taskUpdated: (taskId: string) => AnalyticsService.track('task_updated', 'task', { taskId }),
    taskDeleted: (taskId: string) => AnalyticsService.track('task_deleted', 'task', { taskId }),

    viewChanged: (view: string) => AnalyticsService.track('view_changed', 'navigation', { view }),
    reportGenerated: (reportType: string) => AnalyticsService.track('report_generated', 'report', { reportType }),

    login: () => AnalyticsService.track('login', 'auth'),
    logout: () => AnalyticsService.track('logout', 'auth'),

    filterApplied: (filterType: string) => AnalyticsService.track('filter_applied', 'interaction', { filterType }),
    sortApplied: (sortType: string) => AnalyticsService.track('sort_applied', 'interaction', { sortType }),
};
