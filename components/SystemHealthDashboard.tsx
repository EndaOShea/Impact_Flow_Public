import React, { useEffect, useState } from 'react';
import { Activity, Users, TrendingUp, Server, Database, Clock, Eye, LogIn, AlertCircle } from 'lucide-react';
import { api } from '../services/api';

interface SystemHealthData {
    health: {
        status: string;
        uptime: number;
        uptimeFormatted: string;
        dbResponseTime: number;
        timestamp: string;
    };
    users: {
        total: number;
        activeSessions: number;
        activeToday: number;
    };
    activity: {
        pageViewsToday: number;
        loginsToday: number;
        totalVisitsAllTime: number;
        weeklyActivity: Array<{
            date: string;
            events: number;
            unique_users: number;
        }>;
        topEvents: Array<{
            event_type: string;
            count: number;
        }>;
    };
    memory: {
        used: number;
        total: number;
        unit: string;
    };
}

interface SystemHealthDashboardProps {
    onClose: () => void;
}

export const SystemHealthDashboard: React.FC<SystemHealthDashboardProps> = ({ onClose }) => {
    const [healthData, setHealthData] = useState<SystemHealthData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [autoRefresh, setAutoRefresh] = useState(true);

    const fetchHealthData = async () => {
        try {
            const response = await api.get('/analytics/system/health');
            setHealthData(response);
            setError(null);
        } catch (err) {
            console.error('Failed to fetch system health:', err);
            setError('Failed to load system health data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchHealthData();

        // Auto-refresh every 30 seconds
        let interval: NodeJS.Timeout | null = null;
        if (autoRefresh) {
            interval = setInterval(fetchHealthData, 30000);
        }

        return () => {
            if (interval) clearInterval(interval);
        };
    }, [autoRefresh]);

    if (loading) {
        return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg p-8 max-w-6xl w-full max-h-[90vh] overflow-y-auto">
                    <div className="text-center py-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
                        <p className="mt-4 text-slate-600">Loading system health data...</p>
                    </div>
                </div>
            </div>
        );
    }

    if (error || !healthData) {
        return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg p-8 max-w-2xl w-full">
                    <div className="text-center">
                        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-slate-900 mb-2">Error Loading Data</h3>
                        <p className="text-slate-600 mb-6">{error}</p>
                        <button
                            onClick={onClose}
                            className="px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    const memoryUsagePercent = Math.round((healthData.memory.used / healthData.memory.total) * 100);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between z-10">
                    <div className="flex items-center gap-3">
                        <Server className="w-6 h-6 text-indigo-600" />
                        <h2 className="text-2xl font-bold text-slate-900">System Health Dashboard</h2>
                    </div>
                    <div className="flex items-center gap-3">
                        <label className="flex items-center gap-2 text-sm text-slate-600">
                            <input
                                type="checkbox"
                                checked={autoRefresh}
                                onChange={(e) => setAutoRefresh(e.target.checked)}
                                className="rounded"
                            />
                            Auto-refresh (30s)
                        </label>
                        <button
                            onClick={fetchHealthData}
                            className="px-3 py-1 text-sm bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200"
                        >
                            Refresh Now
                        </button>
                        <button
                            onClick={onClose}
                            className="text-slate-400 hover:text-slate-600 text-2xl font-bold w-8 h-8"
                        >
                            ×
                        </button>
                    </div>
                </div>

                <div className="p-6 space-y-6">
                    {/* Server Health Status */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-4 rounded-xl border border-green-200">
                            <div className="flex items-center gap-2 mb-2">
                                <Activity className="w-5 h-5 text-green-600" />
                                <span className="text-sm font-medium text-green-700">Status</span>
                            </div>
                            <div className="text-2xl font-bold text-green-800 capitalize">
                                {healthData.health.status}
                            </div>
                            <div className="text-xs text-green-600 mt-1">
                                System operational
                            </div>
                        </div>

                        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-4 rounded-xl border border-blue-200">
                            <div className="flex items-center gap-2 mb-2">
                                <Clock className="w-5 h-5 text-blue-600" />
                                <span className="text-sm font-medium text-blue-700">Uptime</span>
                            </div>
                            <div className="text-2xl font-bold text-blue-800">
                                {healthData.health.uptimeFormatted}
                            </div>
                            <div className="text-xs text-blue-600 mt-1">
                                Running continuously
                            </div>
                        </div>

                        <div className="bg-gradient-to-br from-purple-50 to-violet-50 p-4 rounded-xl border border-purple-200">
                            <div className="flex items-center gap-2 mb-2">
                                <Database className="w-5 h-5 text-purple-600" />
                                <span className="text-sm font-medium text-purple-700">DB Response</span>
                            </div>
                            <div className="text-2xl font-bold text-purple-800">
                                {healthData.health.dbResponseTime}ms
                            </div>
                            <div className="text-xs text-purple-600 mt-1">
                                Database latency
                            </div>
                        </div>

                        <div className="bg-gradient-to-br from-orange-50 to-amber-50 p-4 rounded-xl border border-orange-200">
                            <div className="flex items-center gap-2 mb-2">
                                <Server className="w-5 h-5 text-orange-600" />
                                <span className="text-sm font-medium text-orange-700">Memory</span>
                            </div>
                            <div className="text-2xl font-bold text-orange-800">
                                {memoryUsagePercent}%
                            </div>
                            <div className="text-xs text-orange-600 mt-1">
                                {healthData.memory.used} / {healthData.memory.total} {healthData.memory.unit}
                            </div>
                        </div>
                    </div>

                    {/* User Statistics */}
                    <div className="bg-white border border-slate-200 rounded-xl p-6">
                        <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                            <Users className="w-5 h-5 text-indigo-600" />
                            User Statistics
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-slate-50 p-4 rounded-lg">
                                <div className="text-sm text-slate-600 mb-1">Total Users</div>
                                <div className="text-3xl font-bold text-slate-900">{healthData.users.total}</div>
                            </div>
                            <div className="bg-green-50 p-4 rounded-lg">
                                <div className="text-sm text-green-700 mb-1">Active Sessions</div>
                                <div className="text-3xl font-bold text-green-800">{healthData.users.activeSessions}</div>
                                <div className="text-xs text-green-600 mt-1">Currently logged in</div>
                            </div>
                            <div className="bg-blue-50 p-4 rounded-lg">
                                <div className="text-sm text-blue-700 mb-1">Active Today</div>
                                <div className="text-3xl font-bold text-blue-800">{healthData.users.activeToday}</div>
                                <div className="text-xs text-blue-600 mt-1">Unique users today</div>
                            </div>
                        </div>
                    </div>

                    {/* Activity Statistics */}
                    <div className="bg-white border border-slate-200 rounded-xl p-6">
                        <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                            <TrendingUp className="w-5 h-5 text-indigo-600" />
                            Activity Statistics
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                            <div className="bg-indigo-50 p-4 rounded-lg">
                                <div className="flex items-center gap-2 mb-2">
                                    <Eye className="w-4 h-4 text-indigo-600" />
                                    <div className="text-sm text-indigo-700">Page Views Today</div>
                                </div>
                                <div className="text-3xl font-bold text-indigo-800">
                                    {healthData.activity.pageViewsToday.toLocaleString()}
                                </div>
                            </div>
                            <div className="bg-emerald-50 p-4 rounded-lg">
                                <div className="flex items-center gap-2 mb-2">
                                    <LogIn className="w-4 h-4 text-emerald-600" />
                                    <div className="text-sm text-emerald-700">Logins Today</div>
                                </div>
                                <div className="text-3xl font-bold text-emerald-800">
                                    {healthData.activity.loginsToday.toLocaleString()}
                                </div>
                            </div>
                            <div className="bg-purple-50 p-4 rounded-lg">
                                <div className="flex items-center gap-2 mb-2">
                                    <Activity className="w-4 h-4 text-purple-600" />
                                    <div className="text-sm text-purple-700">Total Visits</div>
                                </div>
                                <div className="text-3xl font-bold text-purple-800">
                                    {healthData.activity.totalVisitsAllTime.toLocaleString()}
                                </div>
                                <div className="text-xs text-purple-600 mt-1">All-time</div>
                            </div>
                        </div>

                        {/* Weekly Activity Chart */}
                        {healthData.activity.weeklyActivity.length > 0 && (
                            <div className="mt-6">
                                <h4 className="text-sm font-semibold text-slate-700 mb-3">Last 7 Days Activity</h4>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-slate-200">
                                                <th className="text-left py-2 px-3 text-slate-600 font-medium">Date</th>
                                                <th className="text-right py-2 px-3 text-slate-600 font-medium">Total Events</th>
                                                <th className="text-right py-2 px-3 text-slate-600 font-medium">Unique Users</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {healthData.activity.weeklyActivity.map((day, idx) => (
                                                <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
                                                    <td className="py-2 px-3 text-slate-700">
                                                        {new Date(day.date).toLocaleDateString('en-GB', {
                                                            weekday: 'short',
                                                            month: 'short',
                                                            day: 'numeric'
                                                        })}
                                                    </td>
                                                    <td className="py-2 px-3 text-right font-semibold text-indigo-700">
                                                        {parseInt(day.events).toLocaleString()}
                                                    </td>
                                                    <td className="py-2 px-3 text-right font-semibold text-emerald-700">
                                                        {parseInt(day.unique_users).toLocaleString()}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Top Events */}
                    {healthData.activity.topEvents.length > 0 && (
                        <div className="bg-white border border-slate-200 rounded-xl p-6">
                            <h3 className="text-lg font-semibold text-slate-900 mb-4">
                                Top Events (Last 24 Hours)
                            </h3>
                            <div className="space-y-2">
                                {healthData.activity.topEvents.map((event, idx) => {
                                    const maxCount = Math.max(...healthData.activity.topEvents.map(e => parseInt(e.count)));
                                    const percentage = (parseInt(event.count) / maxCount) * 100;

                                    return (
                                        <div key={idx} className="flex items-center gap-3">
                                            <div className="w-40 text-sm text-slate-700 font-medium truncate">
                                                {event.event_type.replace(/_/g, ' ')}
                                            </div>
                                            <div className="flex-1 bg-slate-100 rounded-full h-6 relative">
                                                <div
                                                    className="bg-gradient-to-r from-indigo-500 to-purple-500 h-6 rounded-full flex items-center justify-end px-2"
                                                    style={{ width: `${percentage}%` }}
                                                >
                                                    <span className="text-xs font-bold text-white">
                                                        {parseInt(event.count).toLocaleString()}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* System Info Footer */}
                    <div className="text-center text-xs text-slate-500 pt-4 border-t border-slate-200">
                        Last updated: {new Date(healthData.health.timestamp).toLocaleString('en-GB')}
                    </div>
                </div>
            </div>
        </div>
    );
};
