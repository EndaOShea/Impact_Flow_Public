import React, { useState, useEffect, useMemo } from 'react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { AnalyticsService } from '../services/analytics';
import { TemporalMetricsResponse } from '../types';
import { Loader2, Download } from 'lucide-react';

interface TemporalMetricsChartsProps {
  defaultGranularity?: 'daily' | 'weekly' | 'monthly';
  defaultMonths?: number;
  compact?: boolean;
}

export const TemporalMetricsCharts: React.FC<TemporalMetricsChartsProps> = ({
  defaultGranularity = 'monthly',
  defaultMonths = 12,
  compact = false
}) => {
  const [granularity, setGranularity] = useState<'daily' | 'weekly' | 'monthly'>(defaultGranularity);
  const [monthsBack, setMonthsBack] = useState(defaultMonths);
  const [temporalData, setTemporalData] = useState<TemporalMetricsResponse | null>(null);
  const [loading, setLoading] = useState(false);

  // Load temporal metrics
  useEffect(() => {
    loadTemporalMetrics();
  }, [granularity, monthsBack]);

  const loadTemporalMetrics = async () => {
    setLoading(true);
    try {
      const data = await AnalyticsService.getTemporalMetrics(granularity, monthsBack);
      setTemporalData(data);
    } catch (error) {
      console.error('Failed to load temporal metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  // Chart data (already in correct format from backend)
  const chartData = useMemo(() => {
    return temporalData?.metrics || [];
  }, [temporalData]);

  // Export to CSV
  const handleExportCSV = () => {
    if (!temporalData || chartData.length === 0) return;

    // CSV Header
    const headers = [
      'Date',
      'Workload (Tasks in Progress)',
      'Completion Velocity (Tasks Completed)',
      'Avg Time to Completion (Hours)',
      'Failed/Missed Deadlines'
    ];

    // CSV Rows
    const rows = chartData.map(metric => [
      metric.date,
      metric.workload.toString(),
      metric.completionVelocity.toString(),
      metric.avgTimeToCompletion.toFixed(1),
      metric.failedDeadlines.toString()
    ]);

    // Add summary section
    const summaryRows = [
      [],
      ['Summary Statistics'],
      ['Total Completed', temporalData.summary.totalCompleted.toString()],
      ['Total Failed', temporalData.summary.totalFailed.toString()],
      ['Average Workload', temporalData.summary.avgWorkload.toFixed(1)],
      ['Average Completion Time (Hours)', temporalData.summary.avgCompletionTime.toFixed(1)]
    ];

    // Combine all rows
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(',')),
      ...summaryRows.map(row => row.join(','))
    ].join('\n');

    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `temporal-metrics-${granularity}-${monthsBack}months-${timestamp}.csv`;

    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Empty state
  if (!loading && chartData.length === 0) {
    return (
      <div className="h-64 flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">
        <p className="font-medium">No data available for this period</p>
        <p className="text-xs mt-1">Complete tasks to see temporal trends</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Control Panel */}
      <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between print:hidden">
        {/* Left side: Granularity and Range */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
          {/* Granularity Selector */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-600">View:</span>
            <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
            <button
              onClick={() => setGranularity('daily')}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-all ${
                granularity === 'daily'
                  ? 'bg-white shadow text-blue-600'
                  : 'text-slate-600 hover:text-slate-800'
              }`}
            >
              Daily
            </button>
            <button
              onClick={() => setGranularity('weekly')}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-all ${
                granularity === 'weekly'
                  ? 'bg-white shadow text-blue-600'
                  : 'text-slate-600 hover:text-slate-800'
              }`}
            >
              Weekly
            </button>
            <button
              onClick={() => setGranularity('monthly')}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-all ${
                granularity === 'monthly'
                  ? 'bg-white shadow text-blue-600'
                  : 'text-slate-600 hover:text-slate-800'
              }`}
            >
              Monthly
            </button>
          </div>
        </div>

          {/* Time Range Selector */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-600">Range:</span>
            <select
              value={monthsBack}
              onChange={(e) => setMonthsBack(parseInt(e.target.value))}
              className="px-4 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer shadow-sm hover:border-slate-400 transition-colors"
            >
              <option value={3}>Last 3 months</option>
              <option value={6}>Last 6 months</option>
              <option value={12}>Last 12 months</option>
              <option value={24}>Last 24 months</option>
              <option value={0}>All time</option>
            </select>
          </div>
        </div>

        {/* Export Button */}
        <button
          onClick={handleExportCSV}
          disabled={!temporalData || chartData.length === 0}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-slate-800 whitespace-nowrap"
          title="Export to CSV"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      {/* Summary Stats */}
      {temporalData?.summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-xl border border-green-200">
            <p className="text-xs font-medium text-green-700 uppercase tracking-wide">Total Completed</p>
            <p className="text-2xl font-bold text-green-900 mt-1">{temporalData.summary.totalCompleted}</p>
          </div>
          <div className="bg-gradient-to-br from-red-50 to-red-100 p-4 rounded-xl border border-red-200">
            <p className="text-xs font-medium text-red-700 uppercase tracking-wide">Total Failed</p>
            <p className="text-2xl font-bold text-red-900 mt-1">{temporalData.summary.totalFailed}</p>
          </div>
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-xl border border-blue-200">
            <p className="text-xs font-medium text-blue-700 uppercase tracking-wide">Avg Workload</p>
            <p className="text-2xl font-bold text-blue-900 mt-1">{temporalData.summary.avgWorkload.toFixed(1)}</p>
          </div>
          <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-xl border border-purple-200">
            <p className="text-xs font-medium text-purple-700 uppercase tracking-wide">Avg Completion Time</p>
            <p className="text-2xl font-bold text-purple-900 mt-1">{temporalData.summary.avgCompletionTime.toFixed(1)}h</p>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        </div>
      )}

      {/* Charts Grid */}
      {!loading && chartData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Workload Chart */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col h-[400px] min-w-0">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-slate-800">Workload Over Time</h3>
              <p className="text-sm text-slate-500">Tasks in progress during each period</p>
            </div>
            <div className="flex-1 w-full" style={{ minHeight: '280px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 5 }}>
                  <defs>
                    <linearGradient id="colorWorkload" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11 }}
                    stroke="#64748b"
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    stroke="#64748b"
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '12px',
                      border: 'none',
                      boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'
                    }}
                    formatter={(value: number) => [value, 'Tasks']}
                  />
                  <Area
                    type="monotone"
                    dataKey="workload"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorWorkload)"
                    animationDuration={1000}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Completion Velocity Chart */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col h-[400px] min-w-0">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-slate-800">Completion Velocity</h3>
              <p className="text-sm text-slate-500">Tasks completed per period</p>
            </div>
            <div className="flex-1 w-full" style={{ minHeight: '280px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11 }}
                    stroke="#64748b"
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    stroke="#64748b"
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '12px',
                      border: 'none',
                      boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'
                    }}
                    formatter={(value: number) => [value, 'Completed']}
                  />
                  <Bar
                    dataKey="completionVelocity"
                    fill="#10b981"
                    radius={[6, 6, 0, 0]}
                    barSize={30}
                    animationDuration={1000}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Time to Completion Chart */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col h-[400px] min-w-0">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-slate-800">Time to Completion</h3>
              <p className="text-sm text-slate-500">Average hours from start to completion</p>
            </div>
            <div className="flex-1 w-full" style={{ minHeight: '280px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11 }}
                    stroke="#64748b"
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    stroke="#64748b"
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '12px',
                      border: 'none',
                      boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'
                    }}
                    formatter={(value: number) => [value.toFixed(1) + ' hours', 'Avg Time']}
                  />
                  <Line
                    type="monotone"
                    dataKey="avgTimeToCompletion"
                    stroke="#8b5cf6"
                    strokeWidth={3}
                    dot={{ r: 4, fill: '#8b5cf6' }}
                    activeDot={{ r: 6 }}
                    animationDuration={1000}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Failed Deadlines Chart */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col h-[400px] min-w-0">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-slate-800">Failed/Missed Deadlines</h3>
              <p className="text-sm text-slate-500">Tasks that became overdue or failed</p>
            </div>
            <div className="flex-1 w-full" style={{ minHeight: '280px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11 }}
                    stroke="#64748b"
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    stroke="#64748b"
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '12px',
                      border: 'none',
                      boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'
                    }}
                    formatter={(value: number) => [value, 'Failed']}
                  />
                  <Bar
                    dataKey="failedDeadlines"
                    fill="#ef4444"
                    radius={[6, 6, 0, 0]}
                    barSize={30}
                    animationDuration={1000}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
