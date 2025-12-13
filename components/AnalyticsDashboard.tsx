import React, { useState, useEffect } from 'react';
import { AnalyticsService } from '../services/analytics';
import {
    BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    PieChart, Pie, Cell
} from 'recharts';
import { TrendingUp, Activity, Clock, MousePointerClick, FileText, Calendar } from 'lucide-react';

export const AnalyticsDashboard: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [timeRange, setTimeRange] = useState<number>(30);
    const [summary, setSummary] = useState<any>(null);
    const [systemMetrics, setSystemMetrics] = useState<any>(null);

    useEffect(() => {
        loadAnalytics();
    }, [timeRange]);

    const loadAnalytics = async () => {
        setLoading(true);
        try {
            const [userSummary, metrics] = await Promise.all([
                AnalyticsService.getUserSummary(timeRange),
                AnalyticsService.getSystemMetrics(timeRange)
            ]);

            setSummary(userSummary);
            setSystemMetrics(metrics);
        } catch (error) {
            console.error('Failed to load analytics:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    if (!summary || !systemMetrics) {
        return (
            <div className="text-center py-12 text-slate-400">
                <Activity className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No analytics data available yet</p>
                <p className="text-sm mt-2">Start using the app to see your usage patterns</p>
            </div>
        );
    }

    const { dailyStats, eventBreakdown, totalStats } = summary;
    const { historical, current } = systemMetrics;

    // Prepare chart data
    const dailyChartData = dailyStats.map((stat: any) => ({
        date: new Date(stat.date).toLocaleDateString('en-GB', { month: 'short', day: 'numeric' }),
        created: stat.tasks_created,
        completed: stat.tasks_completed,
        views: stat.views_count
    })).reverse();

    const eventPieData = eventBreakdown.slice(0, 5).map((event: any) => ({
        name: event.event_type.replace(/_/g, ' '),
        value: parseInt(event.count)
    }));

    const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

    return (
        <div className="space-y-6 animate-in fade-in">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">Usage Analytics</h2>
                    <p className="text-sm text-slate-500 mt-1">Track your productivity and activity patterns</p>
                </div>

                {/* Time Range Selector */}
                <select
                    value={timeRange}
                    onChange={(e) => setTimeRange(parseInt(e.target.value))}
                    className="px-4 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                >
                    <option value={7}>Last 7 days</option>
                    <option value={30}>Last 30 days</option>
                    <option value={90}>Last 90 days</option>
                </select>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-blue-100 rounded-lg">
                            <FileText className="w-5 h-5 text-blue-600" />
                        </div>
                        <h3 className="text-sm font-bold text-slate-500 uppercase">Tasks Created</h3>
                    </div>
                    <p className="text-3xl font-bold text-slate-800">{totalStats.total_tasks_created || 0}</p>
                    <p className="text-xs text-slate-400 mt-1">All time</p>
                </div>

                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-green-100 rounded-lg">
                            <TrendingUp className="w-5 h-5 text-green-600" />
                        </div>
                        <h3 className="text-sm font-bold text-slate-500 uppercase">Tasks Completed</h3>
                    </div>
                    <p className="text-3xl font-bold text-slate-800">{totalStats.total_tasks_completed || 0}</p>
                    <p className="text-xs text-slate-400 mt-1">All time</p>
                </div>

                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-purple-100 rounded-lg">
                            <Clock className="w-5 h-5 text-purple-600" />
                        </div>
                        <h3 className="text-sm font-bold text-slate-500 uppercase">Sessions</h3>
                    </div>
                    <p className="text-3xl font-bold text-slate-800">{totalStats.total_logins || 0}</p>
                    <p className="text-xs text-slate-400 mt-1">Total logins</p>
                </div>

                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-amber-100 rounded-lg">
                            <MousePointerClick className="w-5 h-5 text-amber-600" />
                        </div>
                        <h3 className="text-sm font-bold text-slate-500 uppercase">Page Views</h3>
                    </div>
                    <p className="text-3xl font-bold text-slate-800">{totalStats.total_views || 0}</p>
                    <p className="text-xs text-slate-400 mt-1">All time</p>
                </div>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Daily Activity Chart */}
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-blue-600" />
                        Daily Activity
                    </h3>
                    <div className="h-80">
                        {dailyChartData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={dailyChartData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                    <XAxis
                                        dataKey="date"
                                        tick={{ fontSize: 11 }}
                                        stroke="#64748b"
                                        axisLine={false}
                                    />
                                    <YAxis
                                        tick={{ fontSize: 11 }}
                                        stroke="#64748b"
                                        axisLine={false}
                                    />
                                    <Tooltip
                                        contentStyle={{
                                            borderRadius: '8px',
                                            border: 'none',
                                            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                                        }}
                                    />
                                    <Legend />
                                    <Line
                                        type="monotone"
                                        dataKey="created"
                                        stroke="#3b82f6"
                                        strokeWidth={2}
                                        name="Created"
                                        dot={{ r: 3 }}
                                    />
                                    <Line
                                        type="monotone"
                                        dataKey="completed"
                                        stroke="#10b981"
                                        strokeWidth={2}
                                        name="Completed"
                                        dot={{ r: 3 }}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                                No activity data for this period
                            </div>
                        )}
                    </div>
                </div>

                {/* Event Breakdown Pie Chart */}
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <Activity className="w-5 h-5 text-purple-600" />
                        Activity Breakdown
                    </h3>
                    <div className="h-80">
                        {eventPieData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={eventPieData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={100}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {eventPieData.map((entry: any, index: number) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                    <Legend verticalAlign="bottom" height={36} />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                                No event data for this period
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Event Breakdown Table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-200">
                    <h3 className="text-lg font-bold text-slate-800">Event Details</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="px-6 py-3">Event Type</th>
                                <th className="px-6 py-3">Category</th>
                                <th className="px-6 py-3">Count</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {eventBreakdown.map((event: any, index: number) => (
                                <tr key={index} className="hover:bg-slate-50">
                                    <td className="px-6 py-4 font-medium text-slate-700">
                                        {event.event_type.replace(/_/g, ' ')}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs font-medium">
                                            {event.event_category}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-slate-600">{event.count}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
