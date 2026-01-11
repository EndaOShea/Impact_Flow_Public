import React, { useState, useMemo, useEffect } from 'react';
import { Task, ImpactType, TaskStatus, ReportSchedule, Project, ProjectStatus } from '../types';
import {
    Calendar, Printer, TrendingUp, Clock, CheckCircle2,
    DollarSign, BarChart2, PieChart as PieChartIcon, ArrowUpRight, ArrowDownRight,
    PlayCircle, Mail, Plus, Trash, Clock as ClockIcon, CalendarDays, Repeat, Info, HelpCircle, Check, Briefcase, ChevronDown, ChevronRight
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    PieChart, Pie, Cell
} from 'recharts';
import { api } from '../services/api';

interface SystemReportProps {
  tasks: Task[];
  projects: Project[];
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#64748b'];

export const SystemReport: React.FC<SystemReportProps> = ({ tasks, projects }) => {
  const [activeTab, setActiveTab] = useState<'GENERATE' | 'SCHEDULE'>('GENERATE');
  const [expandedProjectIds, setExpandedProjectIds] = useState<Set<string>>(new Set());

  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  const [schedules, setSchedules] = useState<ReportSchedule[]>([]);
  const [isCreatingSchedule, setIsCreatingSchedule] = useState(false);

  const [schedName, setSchedName] = useState('');
  const [schedFreq, setSchedFreq] = useState<'DAILY' | 'WEEKLY' | 'MONTHLY' | 'CUSTOM'>('WEEKLY');
  const [schedTime, setSchedTime] = useState('09:00');

  const [dailyScope, setDailyScope] = useState<'TODAY' | 'YESTERDAY'>('YESTERDAY');

  const [monthlyRunDay, setMonthlyRunDay] = useState<number>(1);
  const [monthlyScope, setMonthlyScope] = useState<'CALENDAR_MONTH' | 'ROLLING_DAYS'>('CALENDAR_MONTH');
  const [monthlyRollingDays, setMonthlyRollingDays] = useState<number>(30);

  const [schedCustomInterval, setSchedCustomInterval] = useState(2);
  const [schedWeekDays, setSchedWeekDays] = useState<number[]>([]);
  const [schedRangeEnd, setSchedRangeEnd] = useState<number>(0);
  const [schedRangeStart, setSchedRangeStart] = useState<number>(7);

  useEffect(() => {
    const start = new Date();
    start.setDate(1);
    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(new Date().toISOString().split('T')[0]);

    loadSchedules();
  }, []);

  const loadSchedules = async () => {
      try {
          const items = await api.getReportSchedules();
          setSchedules(items);
      } catch (err) {
          console.error('Failed to load report schedules:', err);
      }
  };

  const handleCreateSchedule = async () => {
      if(!schedName) return;

      let startOffset = schedRangeStart;
      let endOffset = schedRangeEnd;

      if (schedFreq === 'DAILY') {
          if (dailyScope === 'TODAY') { startOffset = 0; endOffset = 0; }
          else { startOffset = 1; endOffset = 1; }
      }
      else if (schedFreq === 'WEEKLY') {
          startOffset = 7;
          endOffset = 1;
      }
      else if (schedFreq === 'MONTHLY') {
          startOffset = 30; endOffset = 0;
          if (monthlyScope === 'ROLLING_DAYS') {
              startOffset = monthlyRollingDays;
              endOffset = 0;
          }
      }

      const newSchedule: ReportSchedule = {
          id: crypto.randomUUID(),
          name: schedName,
          frequency: schedFreq,
          time: schedTime,

          dailyScope: schedFreq === 'DAILY' ? dailyScope : undefined,
          monthlyRunDay: schedFreq === 'MONTHLY' ? monthlyRunDay : undefined,
          monthlyScope: schedFreq === 'MONTHLY' ? monthlyScope : undefined,
          monthlyRollingValue: schedFreq === 'MONTHLY' && monthlyScope === 'ROLLING_DAYS' ? monthlyRollingDays : undefined,

          customInterval: schedFreq === 'CUSTOM' ? schedCustomInterval : undefined,
          weekDays: schedFreq === 'WEEKLY' ? schedWeekDays : undefined,

          rangeStartOffset: startOffset,
          rangeEndOffset: endOffset,

          recipients: [],
          active: true
      };

      try {
          await api.createReportSchedule(newSchedule);
          setIsCreatingSchedule(false);

          setSchedName('');
          setSchedFreq('WEEKLY');
          setSchedWeekDays([]);
          setDailyScope('YESTERDAY');

          loadSchedules();
      } catch (err) {
          console.error('Failed to create report schedule:', err);
      }
  };

  const handleDeleteSchedule = async (id: string) => {
      try {
          await api.deleteReportSchedule(id);
          loadSchedules();
      } catch (err) {
          console.error('Failed to delete report schedule:', err);
      }
  };

  const toggleWeekDay = (dayIdx: number) => {
      if (schedWeekDays.includes(dayIdx)) {
          setSchedWeekDays(schedWeekDays.filter(d => d !== dayIdx));
      } else {
          setSchedWeekDays([...schedWeekDays, dayIdx].sort());
      }
  };

  const handlePreset = (preset: 'TODAY' | 'YESTERDAY' | 'THIS_WEEK' | 'LAST_WEEK' | 'THIS_MONTH' | 'LAST_MONTH' | 'THIS_YEAR' | 'LAST_YEAR') => {
      const now = new Date();
      let start = new Date();
      let end = new Date();

      switch(preset) {
          case 'TODAY':
              break;
          case 'YESTERDAY':
              start.setDate(now.getDate() - 1);
              end.setDate(now.getDate() - 1);
              break;
          case 'THIS_WEEK':
              start.setDate(now.getDate() - now.getDay());
              break;
          case 'LAST_WEEK':
              start.setDate(now.getDate() - now.getDay() - 7);
              end.setDate(start.getDate() + 6);
              break;
          case 'THIS_MONTH':
              start.setDate(1);
              break;
          case 'LAST_MONTH':
              start.setMonth(now.getMonth() - 1, 1);
              end.setMonth(now.getMonth(), 0);
              break;
          case 'THIS_YEAR':
              start.setMonth(0, 1);
              break;
          case 'LAST_YEAR':
              start.setFullYear(now.getFullYear() - 1, 0, 1);
              end.setFullYear(now.getFullYear() - 1, 11, 31);
              break;
      }
      setStartDate(start.toISOString().split('T')[0]);
      setEndDate(end.toISOString().split('T')[0]);
  };

  const reportData = useMemo(() => {
    if (!startDate || !endDate) return null;
    const startObj = new Date(startDate); startObj.setHours(0,0,0,0);
    const endObj = new Date(endDate); endObj.setHours(23,59,59,999);

    // Filter completed projects in period
    const completedProjects = projects.filter(p =>
      p.status === ProjectStatus.COMPLETED &&
      p.actualEndDate &&
      new Date(p.actualEndDate) >= startObj &&
      new Date(p.actualEndDate) <= endObj
    );

    // Only show standalone tasks (tasks without projectId) in the "Completed Tasks Breakdown" section
    const completedInPeriod = tasks.filter(t =>
      t.status === TaskStatus.COMPLETED &&
      t.completedAt &&
      new Date(t.completedAt) >= startObj &&
      new Date(t.completedAt) <= endObj &&
      !t.projectId  // Exclude project tasks
    );

    const createdInPeriod = tasks.filter(t => new Date(t.createdAt) >= startObj && new Date(t.createdAt) <= endObj);
    const dueInPeriod = tasks.filter(t => t.dueDate && new Date(t.dueDate) >= startObj && new Date(t.dueDate) <= endObj);

    let totalRevenue = 0; let totalTimeSaved = 0; let totalHoursLogged = 0;

    // Calculate metrics from standalone tasks
    completedInPeriod.forEach(t => {
        totalHoursLogged += t.subtasks.reduce((sum, s) => sum + s.hoursSpent, 0);
        t.impactMetrics.forEach(m => {
            if(m.type === ImpactType.REVENUE) totalRevenue += (m.achievedValue || 0);
            if(m.type === ImpactType.EFFICIENCY) totalTimeSaved += (m.achievedValue || 0);
        });
    });

    const categoryMap: Record<string, number> = {};
    // Count from all tasks in period (not just completed), use hoursSpent if available, otherwise estimatedHours
    const tasksInPeriod = tasks.filter(t => {
        const taskDate = t.completedAt || t.dueDate || t.createdAt;
        return taskDate && new Date(taskDate) >= startObj && new Date(taskDate) <= endObj;
    });
    tasksInPeriod.forEach(t => {
        t.subtasks.forEach(s => {
            const hours = s.hoursSpent > 0 ? s.hoursSpent : s.estimatedHours;
            categoryMap[s.category] = (categoryMap[s.category] || 0) + hours;
        });
    });
    const categoryDistribution = Object.entries(categoryMap).map(([name, value]) => ({ name, value })).filter(item => item.value > 0);

    const statusMap: Record<string, number> = {};
    tasks.forEach(t => {
        statusMap[t.status] = (statusMap[t.status] || 0) + 1;
    });
    const statusDistribution = Object.entries(statusMap).map(([name, value]) => ({ name: name.replace('_', ' '), value }));

    return {
        completed: completedInPeriod, created: createdInPeriod, due: dueInPeriod,
        completedProjects,
        metrics: { revenue: totalRevenue, timeSaved: totalTimeSaved, hoursLogged: totalHoursLogged, completionRate: dueInPeriod.length > 0 ? Math.round((completedInPeriod.length / dueInPeriod.length) * 100) : 0 },
        charts: { statusDistribution, categoryDistribution }
    };
  }, [tasks, projects, startDate, endDate]);

  const handlePrint = () => window.print();

  const getFriendlyDescription = (s: ReportSchedule) => {
      if (s.frequency === 'DAILY') {
          return `Daily (Data from ${s.dailyScope === 'TODAY' ? 'Today' : 'Yesterday'})`;
      }
      if (s.frequency === 'WEEKLY') {
          const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
          const dayNames = s.weekDays?.map(d => days[d]).join(', ');
          return `Weekly on ${dayNames} (Prev 7 Days)`;
      }
      if (s.frequency === 'MONTHLY') {
          const dayStr = s.monthlyRunDay === 32 ? 'Last Day' : `${s.monthlyRunDay}${getOrdinal(s.monthlyRunDay || 1)}`;
          const scopeStr = s.monthlyScope === 'CALENDAR_MONTH' ? 'Prev Calendar Month' : `Last ${s.monthlyRollingValue} Days`;
          return `Monthly on the ${dayStr} (${scopeStr})`;
      }
      return `Custom (Every ${s.customInterval} Days)`;
  };

  const getOrdinal = (n: number) => {
      const s = ["th", "st", "nd", "rd"];
      const v = n % 100;
      return s[(v - 20) % 10] || s[v] || s[0];
  };

  const toggleProjectExpanded = (projectId: string) => {
    setExpandedProjectIds(prev => {
      const next = new Set(prev);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
      }
      return next;
    });
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 pb-12">
        <div className="flex gap-4 border-b border-slate-200 print:hidden">
            <button
                onClick={() => setActiveTab('GENERATE')}
                className={`pb-4 px-2 text-sm font-bold flex items-center gap-2 ${activeTab === 'GENERATE' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
            >
                <BarChart2 className="w-4 h-4"/> Report Generator
            </button>
            <button
                onClick={() => setActiveTab('SCHEDULE')}
                className={`pb-4 px-2 text-sm font-bold flex items-center gap-2 ${activeTab === 'SCHEDULE' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
            >
                <ClockIcon className="w-4 h-4"/> Automation & Schedules
            </button>
        </div>

        {activeTab === 'GENERATE' && (
            <>
                <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm gap-4 print:hidden">
                    <div className="flex flex-col md:flex-row gap-4 items-center w-full xl:w-auto">
                        <div className="flex flex-wrap gap-2">
                            <button onClick={() => handlePreset('TODAY')} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold rounded">Today</button>
                            <button onClick={() => handlePreset('YESTERDAY')} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold rounded">Yesterday</button>
                            <div className="w-px h-6 bg-slate-300 mx-1"></div>
                            <button onClick={() => handlePreset('THIS_WEEK')} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold rounded">This Week</button>
                            <button onClick={() => handlePreset('LAST_WEEK')} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold rounded">Last Week</button>
                             <div className="w-px h-6 bg-slate-300 mx-1"></div>
                            <button onClick={() => handlePreset('THIS_MONTH')} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold rounded">This Month</button>
                            <button onClick={() => handlePreset('LAST_MONTH')} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold rounded">Last Month</button>
                            <div className="w-px h-6 bg-slate-300 mx-1"></div>
                            <button onClick={() => handlePreset('THIS_YEAR')} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold rounded">This Year</button>
                            <button onClick={() => handlePreset('LAST_YEAR')} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold rounded">Last Year</button>
                        </div>
                    </div>

                    <div className="flex flex-col md:flex-row gap-4 items-center w-full xl:w-auto">
                        <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-lg border border-slate-200">
                            <span className="text-xs font-bold text-slate-500 pl-2">From</span>
                            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-white border border-slate-300 text-black text-xs rounded px-2 py-1 outline-none focus:ring-1 focus:ring-blue-500"/>
                            <span className="text-xs font-bold text-slate-500">To</span>
                            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-white border border-slate-300 text-black text-xs rounded px-2 py-1 outline-none focus:ring-1 focus:ring-blue-500"/>
                        </div>
                        <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors text-sm font-medium whitespace-nowrap">
                            <Printer className="w-4 h-4" /> Export
                        </button>
                    </div>
                </div>

                {reportData && (
                <div className="print:block">
                    <div className="mb-8 text-center md:text-left">
                        <h1 className="text-3xl font-bold text-slate-900">Performance Report</h1>
                        <p className="text-slate-500 mt-2 text-sm font-medium">Period: {new Date(startDate).toLocaleDateString()} — {new Date(endDate).toLocaleDateString()}</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                            <div className="flex items-center gap-2 mb-2 text-slate-500"><CheckCircle2 className="w-5 h-5 text-green-500" /><span className="text-sm font-bold uppercase">Tasks Completed</span></div>
                            <div className="flex items-end gap-2"><span className="text-3xl font-bold text-slate-800">{reportData.completed.length}</span></div>
                        </div>
                        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                            <div className="flex items-center gap-2 mb-2 text-slate-500"><DollarSign className="w-5 h-5 text-emerald-500" /><span className="text-sm font-bold uppercase">Revenue Impact</span></div>
                            <div className="flex items-end gap-2"><span className="text-3xl font-bold text-slate-800">${reportData.metrics.revenue.toLocaleString()}</span></div>
                        </div>
                        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                            <div className="flex items-center gap-2 mb-2 text-slate-500"><Clock className="w-5 h-5 text-blue-500" /><span className="text-sm font-bold uppercase">Hours Logged</span></div>
                            <div className="flex items-end gap-2"><span className="text-3xl font-bold text-slate-800">{reportData.metrics.hoursLogged.toFixed(1)}</span></div>
                        </div>
                        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                            <div className="flex items-center gap-2 mb-2 text-slate-500"><TrendingUp className="w-5 h-5 text-purple-500" /><span className="text-sm font-bold uppercase">Time Saved (hrs)</span></div>
                            <div className="flex items-end gap-2"><span className="text-3xl font-bold text-slate-800">{reportData.metrics.timeSaved}</span></div>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8 print:break-inside-avoid">
                        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                            <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2"><BarChart2 className="w-5 h-5 text-blue-500" /> Tasks by Status</h3>
                            <div className="h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={reportData.charts.statusDistribution}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" axisLine={false} tickLine={false} /><YAxis axisLine={false} tickLine={false} /><Tooltip /><Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={40} /></BarChart></ResponsiveContainer></div>
                        </div>
                        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                            <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2"><PieChartIcon className="w-5 h-5 text-purple-500" /> Work Categories (Hours)</h3>
                            <div className="h-64"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={reportData.charts.categoryDistribution} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">{reportData.charts.categoryDistribution.map((entry, index) => (<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />))}</Pie><Tooltip /><Legend /></PieChart></ResponsiveContainer></div>
                        </div>
                    </div>

                    {/* Detailed Task Breakdown */}
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm print:break-before-page">
                        <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                            <CheckCircle2 className="w-5 h-5 text-green-500" />
                            Completed Tasks Breakdown
                        </h3>

                        {reportData.completed.length === 0 ? (
                            <div className="text-center py-12 text-slate-400">
                                <p>No tasks completed in this period.</p>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {reportData.completed.map((task, index) => {
                                    const totalHours = task.subtasks.reduce((sum, s) => sum + s.hoursSpent, 0);
                                    const completedSubtasks = task.subtasks.filter(s => s.completed).length;
                                    const progress = task.subtasks.length > 0 ? Math.round((completedSubtasks / task.subtasks.length) * 100) : 100;

                                    return (
                                        <div key={task.id} className="border border-slate-200 rounded-xl p-6 hover:shadow-md transition-shadow print:break-inside-avoid">
                                            {/* Task Header */}
                                            <div className="flex items-start justify-between mb-4">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-3 mb-2">
                                                        <span className="text-xs font-bold text-slate-400">#{index + 1}</span>
                                                        <h4 className="text-lg font-bold text-slate-800">{task.title}</h4>
                                                    </div>
                                                    {task.description && (
                                                        <p className="text-sm text-slate-600 mb-3">{task.description}</p>
                                                    )}
                                                    <div className="flex items-center gap-4 text-xs text-slate-500">
                                                        <span className="flex items-center gap-1">
                                                            <Calendar className="w-3 h-3" />
                                                            Completed: {task.completedAt ? new Date(task.completedAt).toLocaleDateString() : 'N/A'}
                                                        </span>
                                                        <span className="flex items-center gap-1">
                                                            <Clock className="w-3 h-3" />
                                                            {totalHours.toFixed(1)} hours logged
                                                        </span>
                                                        <span className="flex items-center gap-1">
                                                            <CheckCircle2 className="w-3 h-3" />
                                                            {progress}% complete
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                                                        task.priority === 'CRITICAL' ? 'bg-red-100 text-red-700' :
                                                        task.priority === 'HIGH' ? 'bg-orange-100 text-orange-700' :
                                                        task.priority === 'MEDIUM' ? 'bg-blue-100 text-blue-700' :
                                                        'bg-green-100 text-green-700'
                                                    }`}>
                                                        {task.priority}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* KPIs Section */}
                                            {task.impactMetrics.length > 0 && (
                                                <div className="mb-4 bg-gradient-to-r from-emerald-50 to-blue-50 p-4 rounded-lg border border-emerald-100">
                                                    <h5 className="text-xs font-bold text-slate-700 uppercase mb-3 flex items-center gap-2">
                                                        <TrendingUp className="w-4 h-4 text-emerald-600" />
                                                        Key Performance Indicators
                                                    </h5>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                        {task.impactMetrics.map(metric => {
                                                            const target = metric.value;
                                                            const achieved = metric.achievedValue || 0;
                                                            const percent = target > 0 ? Math.min(100, Math.round((achieved / target) * 100)) : 0;
                                                            const currencySymbol = metric.type === ImpactType.REVENUE
                                                                ? (metric.currency === 'EUR' ? '€' : metric.currency === 'GBP' ? '£' : '$')
                                                                : '';

                                                            return (
                                                                <div key={metric.id} className="bg-white p-3 rounded-lg border border-slate-200">
                                                                    <div className="flex justify-between items-start mb-2">
                                                                        <div>
                                                                            <p className="text-xs font-bold text-slate-600">{metric.type}</p>
                                                                            {metric.description && (
                                                                                <p className="text-[10px] text-slate-400">{metric.description}</p>
                                                                            )}
                                                                        </div>
                                                                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                                                                            percent >= 100 ? 'bg-green-100 text-green-700' :
                                                                            percent >= 80 ? 'bg-blue-100 text-blue-700' :
                                                                            percent >= 50 ? 'bg-amber-100 text-amber-700' :
                                                                            'bg-red-100 text-red-700'
                                                                        }`}>
                                                                            {percent}%
                                                                        </span>
                                                                    </div>
                                                                    <div className="flex items-baseline gap-2 mb-2">
                                                                        <span className="text-lg font-bold text-slate-800">
                                                                            {currencySymbol}{achieved.toLocaleString()}
                                                                        </span>
                                                                        <span className="text-xs text-slate-400">
                                                                            / {currencySymbol}{target.toLocaleString()} target
                                                                        </span>
                                                                    </div>
                                                                    <div className="w-full bg-slate-100 rounded-full h-1.5">
                                                                        <div
                                                                            className={`h-1.5 rounded-full transition-all ${
                                                                                percent >= 100 ? 'bg-green-500' :
                                                                                percent >= 80 ? 'bg-blue-500' :
                                                                                percent >= 50 ? 'bg-amber-500' :
                                                                                'bg-red-500'
                                                                            }`}
                                                                            style={{ width: `${Math.min(100, percent)}%` }}
                                                                        />
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Subtasks Breakdown */}
                                            {task.subtasks.length > 0 && (
                                                <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
                                                    <h5 className="text-xs font-bold text-slate-700 uppercase mb-3">Work Breakdown ({task.subtasks.length} steps)</h5>
                                                    <div className="space-y-2">
                                                        {task.subtasks.map(subtask => (
                                                            <div key={subtask.id} className="flex items-center justify-between text-xs bg-white p-2 rounded border border-slate-100">
                                                                <div className="flex items-center gap-2 flex-1">
                                                                    {subtask.completed ? (
                                                                        <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                                                                    ) : (
                                                                        <div className="w-4 h-4 rounded-full border-2 border-slate-300 flex-shrink-0" />
                                                                    )}
                                                                    <span className={subtask.completed ? 'text-slate-500 line-through' : 'text-slate-700 font-medium'}>
                                                                        {subtask.title}
                                                                    </span>
                                                                    <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-medium">
                                                                        {subtask.category}
                                                                    </span>
                                                                </div>
                                                                <div className="flex items-center gap-3 text-slate-500">
                                                                    <span>{subtask.hoursSpent}h logged</span>
                                                                    {subtask.estimatedHours > 0 && (
                                                                        <span className="text-[10px]">({subtask.estimatedHours}h est.)</span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Strategic Context */}
                                            {(task.beforeScenario || task.afterScenario || task.impactNarrative) && (
                                                <div className="mt-4 pt-4 border-t border-slate-200 space-y-3">
                                                    {task.impactNarrative && (
                                                        <div>
                                                            <h5 className="text-xs font-bold text-slate-700 uppercase mb-1">Impact Summary</h5>
                                                            <p className="text-sm text-slate-600 italic">"{task.impactNarrative}"</p>
                                                        </div>
                                                    )}
                                                    {(task.beforeScenario || task.afterScenario) && (
                                                        <div className="grid grid-cols-2 gap-3 text-xs">
                                                            {task.beforeScenario && (
                                                                <div className="bg-slate-50 p-3 rounded border border-slate-100">
                                                                    <p className="font-bold text-slate-500 mb-1">Before</p>
                                                                    <p className="text-slate-600">{task.beforeScenario}</p>
                                                                </div>
                                                            )}
                                                            {task.afterScenario && (
                                                                <div className="bg-emerald-50 p-3 rounded border border-emerald-100">
                                                                    <p className="font-bold text-emerald-700 mb-1">After</p>
                                                                    <p className="text-slate-600">{task.afterScenario}</p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Completed Projects Section */}
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm mt-8 print:break-before-page">
                        <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                            <Briefcase className="w-5 h-5 text-purple-500" />
                            Completed Projects
                        </h3>

                        {reportData.completedProjects.length === 0 ? (
                            <div className="text-center py-12 text-slate-400">
                                <p>No projects completed in this period.</p>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {reportData.completedProjects.map((project, index) => {
                                    const projectTasks = tasks.filter(t => t.projectId === project.id);
                                    const completedTasks = projectTasks.filter(t => t.status === TaskStatus.COMPLETED);
                                    const totalProjectHours = projectTasks.reduce((sum, t) =>
                                        sum + t.subtasks.reduce((tSum, s) => tSum + s.hoursSpent, 0), 0
                                    );
                                    const isExpanded = expandedProjectIds.has(project.id);

                                    return (
                                        <div key={project.id} className="border border-purple-200 rounded-xl p-6 hover:shadow-md transition-shadow print:break-inside-avoid bg-purple-50/30">
                                            {/* Project Header */}
                                            <div className="flex items-start justify-between mb-4">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-3 mb-2">
                                                        <span className="text-xs font-bold text-purple-400">#{index + 1}</span>
                                                        <h4 className="text-lg font-bold text-purple-800 flex items-center gap-2">
                                                            <Briefcase className="w-5 h-5" />
                                                            {project.title}
                                                        </h4>
                                                    </div>
                                                    {project.description && (
                                                        <p className="text-sm text-slate-600 mb-3">{project.description}</p>
                                                    )}
                                                    <div className="flex items-center gap-4 text-xs text-slate-500">
                                                        <span className="flex items-center gap-1">
                                                            <Calendar className="w-3 h-3" />
                                                            Completed: {project.actualEndDate ? new Date(project.actualEndDate).toLocaleDateString() : 'N/A'}
                                                        </span>
                                                        <span className="flex items-center gap-1">
                                                            <Clock className="w-3 h-3" />
                                                            {totalProjectHours.toFixed(1)} hours logged
                                                        </span>
                                                        <span className="flex items-center gap-1">
                                                            <CheckCircle2 className="w-3 h-3" />
                                                            {projectTasks.length} {projectTasks.length === 1 ? 'task' : 'tasks'}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                                                        project.priority === 'CRITICAL' ? 'bg-red-100 text-red-700' :
                                                        project.priority === 'HIGH' ? 'bg-orange-100 text-orange-700' :
                                                        project.priority === 'MEDIUM' ? 'bg-blue-100 text-blue-700' :
                                                        'bg-green-100 text-green-700'
                                                    }`}>
                                                        {project.priority}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Project Stats */}
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                                                <div className="bg-white p-3 rounded-lg border border-purple-100">
                                                    <p className="text-xs text-slate-500 font-medium mb-1">Total Tasks</p>
                                                    <p className="text-xl font-bold text-slate-800">{projectTasks.length}</p>
                                                </div>
                                                <div className="bg-white p-3 rounded-lg border border-purple-100">
                                                    <p className="text-xs text-slate-500 font-medium mb-1">Completed</p>
                                                    <p className="text-xl font-bold text-green-600">{completedTasks.length}</p>
                                                </div>
                                                <div className="bg-white p-3 rounded-lg border border-purple-100">
                                                    <p className="text-xs text-slate-500 font-medium mb-1">Total Hours</p>
                                                    <p className="text-xl font-bold text-blue-600">{totalProjectHours.toFixed(1)}h</p>
                                                </div>
                                                <div className="bg-white p-3 rounded-lg border border-purple-100">
                                                    <p className="text-xs text-slate-500 font-medium mb-1">Completion</p>
                                                    <p className="text-xl font-bold text-purple-600">
                                                        {projectTasks.length > 0 ? Math.round((completedTasks.length / projectTasks.length) * 100) : 0}%
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Aggregated Impact */}
                                            {project.aggregatedImpact && (
                                                <div className="mb-4 bg-gradient-to-r from-emerald-50 to-blue-50 p-4 rounded-lg border border-emerald-100">
                                                    <h5 className="text-xs font-bold text-slate-700 uppercase mb-3 flex items-center gap-2">
                                                        <TrendingUp className="w-4 h-4 text-emerald-600" />
                                                        Project Impact Summary
                                                    </h5>
                                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                                        {project.aggregatedImpact.revenue > 0 && (
                                                            <div className="bg-white p-3 rounded-lg border border-emerald-200">
                                                                <p className="text-xs text-slate-500 mb-1">Revenue</p>
                                                                <p className="text-lg font-bold text-green-600">
                                                                    ${project.aggregatedImpact.revenue.toLocaleString()}
                                                                </p>
                                                            </div>
                                                        )}
                                                        {project.aggregatedImpact.timeSaved > 0 && (
                                                            <div className="bg-white p-3 rounded-lg border border-blue-200">
                                                                <p className="text-xs text-slate-500 mb-1">Time Saved</p>
                                                                <p className="text-lg font-bold text-blue-600">
                                                                    {project.aggregatedImpact.timeSaved.toFixed(1)}h
                                                                </p>
                                                            </div>
                                                        )}
                                                        {project.aggregatedImpact.costReduction > 0 && (
                                                            <div className="bg-white p-3 rounded-lg border border-purple-200">
                                                                <p className="text-xs text-slate-500 mb-1">Cost Saved</p>
                                                                <p className="text-lg font-bold text-purple-600">
                                                                    ${project.aggregatedImpact.costReduction.toLocaleString()}
                                                                </p>
                                                            </div>
                                                        )}
                                                        {project.aggregatedImpact.csat > 0 && (
                                                            <div className="bg-white p-3 rounded-lg border border-orange-200">
                                                                <p className="text-xs text-slate-500 mb-1">CSAT</p>
                                                                <p className="text-lg font-bold text-orange-600">
                                                                    {project.aggregatedImpact.csat.toFixed(1)}
                                                                </p>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Toggle Tasks Button */}
                                            {projectTasks.length > 0 && (
                                                <button
                                                    onClick={() => toggleProjectExpanded(project.id)}
                                                    className="w-full mt-4 py-2 px-4 bg-purple-100 hover:bg-purple-200 border border-purple-200 rounded-lg text-sm font-bold text-purple-700 flex items-center justify-center gap-2 transition-colors"
                                                >
                                                    {isExpanded ? (
                                                        <>
                                                            <ChevronDown className="w-4 h-4" />
                                                            Hide Tasks ({projectTasks.length})
                                                        </>
                                                    ) : (
                                                        <>
                                                            <ChevronRight className="w-4 h-4" />
                                                            View Tasks ({projectTasks.length})
                                                        </>
                                                    )}
                                                </button>
                                            )}

                                            {/* Expanded Task List */}
                                            {isExpanded && projectTasks.length > 0 && (
                                                <div className="mt-4 border-t border-purple-200 pt-4 space-y-3">
                                                    {projectTasks.map((task) => {
                                                        const taskHours = task.subtasks.reduce((sum, s) => sum + s.hoursSpent, 0);
                                                        const completedSubtasks = task.subtasks.filter(s => s.completed).length;
                                                        const taskProgress = task.subtasks.length > 0
                                                            ? Math.round((completedSubtasks / task.subtasks.length) * 100)
                                                            : 100;

                                                        return (
                                                            <div key={task.id} className="bg-white border border-purple-100 rounded-lg p-4 print:break-inside-avoid">
                                                                <div className="flex items-start justify-between mb-2">
                                                                    <div className="flex-1">
                                                                        <h5 className="font-bold text-slate-800 mb-1">{task.title}</h5>
                                                                        {task.description && (
                                                                            <p className="text-xs text-slate-600 mb-2">{task.description}</p>
                                                                        )}
                                                                        <div className="flex items-center gap-3 text-xs text-slate-500">
                                                                            <span className="flex items-center gap-1">
                                                                                <Clock className="w-3 h-3" />
                                                                                {taskHours.toFixed(1)}h logged
                                                                            </span>
                                                                            <span className={`px-2 py-0.5 rounded-full font-bold ${
                                                                                task.status === TaskStatus.COMPLETED ? 'bg-green-100 text-green-700' :
                                                                                task.status === TaskStatus.IN_PROGRESS ? 'bg-blue-100 text-blue-700' :
                                                                                'bg-slate-100 text-slate-600'
                                                                            }`}>
                                                                                {task.status.replace('_', ' ')}
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                    <span className={`px-2 py-1 rounded text-xs font-bold ${
                                                                        task.priority === 'CRITICAL' ? 'bg-red-100 text-red-700' :
                                                                        task.priority === 'HIGH' ? 'bg-orange-100 text-orange-700' :
                                                                        task.priority === 'MEDIUM' ? 'bg-blue-100 text-blue-700' :
                                                                        'bg-green-100 text-green-700'
                                                                    }`}>
                                                                        {task.priority}
                                                                    </span>
                                                                </div>

                                                                {/* Task Subtasks */}
                                                                {task.subtasks.length > 0 && (
                                                                    <div className="mt-3 bg-slate-50 rounded-lg p-3 border border-slate-100">
                                                                        <div className="flex items-center justify-between mb-2">
                                                                            <p className="text-xs font-bold text-slate-600">
                                                                                Subtasks ({completedSubtasks}/{task.subtasks.length})
                                                                            </p>
                                                                            <p className="text-xs font-bold text-purple-600">{taskProgress}%</p>
                                                                        </div>
                                                                        <div className="space-y-1.5">
                                                                            {task.subtasks.map(subtask => (
                                                                                <div key={subtask.id} className="flex items-center justify-between text-xs bg-white p-2 rounded border border-slate-100">
                                                                                    <div className="flex items-center gap-2 flex-1">
                                                                                        {subtask.completed ? (
                                                                                            <CheckCircle2 className="w-3 h-3 text-green-500 flex-shrink-0" />
                                                                                        ) : (
                                                                                            <div className="w-3 h-3 rounded-full border-2 border-slate-300 flex-shrink-0" />
                                                                                        )}
                                                                                        <span className={subtask.completed ? 'text-slate-500 line-through' : 'text-slate-700'}>
                                                                                            {subtask.title}
                                                                                        </span>
                                                                                    </div>
                                                                                    <span className="text-slate-500">{subtask.hoursSpent}h</span>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
                )}
            </>
        )}

        {activeTab === 'SCHEDULE' && (
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800">Automated Report Schedules</h2>
                        <p className="text-slate-500 text-sm">Configure reports to run automatically.</p>
                    </div>
                    {!isCreatingSchedule ? (
                        <button onClick={() => setIsCreatingSchedule(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
                            <Plus className="w-4 h-4" /> Create Schedule
                        </button>
                    ) : (
                        <button onClick={() => setIsCreatingSchedule(false)} className="text-slate-400 hover:text-slate-600">Cancel</button>
                    )}
                </div>

                {isCreatingSchedule && (
                    <div className="mb-8 bg-slate-50 p-6 rounded-xl border border-slate-200 animate-in slide-in-from-top-2">
                        <h3 className="font-bold text-slate-700 mb-4">New Report Schedule</h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                            <div className="space-y-4">
                                <h4 className="text-xs font-bold text-slate-400 uppercase border-b border-slate-200 pb-2">General Info</h4>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Report Name</label>
                                    <input
                                        type="text"
                                        value={schedName}
                                        onChange={(e) => setSchedName(e.target.value)}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white text-black"
                                        placeholder="e.g. Weekly Summary"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Run Time</label>
                                    <input
                                        type="time"
                                        value={schedTime}
                                        onChange={(e) => setSchedTime(e.target.value)}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white text-black"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Run Frequency</label>
                                    <select
                                        value={schedFreq}
                                        onChange={(e) => setSchedFreq(e.target.value as any)}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white text-black"
                                    >
                                        <option value="DAILY">Daily</option>
                                        <option value="WEEKLY">Weekly</option>
                                        <option value="MONTHLY">Monthly</option>
                                        <option value="CUSTOM">Custom Interval</option>
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <h4 className="text-xs font-bold text-slate-400 uppercase border-b border-slate-200 pb-2">Configuration</h4>

                                {schedFreq === 'DAILY' && (
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 mb-2">Report Data Scope</label>
                                        <div className="flex gap-4">
                                            <label className="flex items-center gap-2 cursor-pointer bg-white border border-slate-200 px-3 py-2 rounded-lg flex-1">
                                                <input type="radio" name="dailyScope" checked={dailyScope === 'TODAY'} onChange={() => setDailyScope('TODAY')} className="bg-white" />
                                                <span className="text-sm font-medium text-slate-700">Data from Today</span>
                                            </label>
                                            <label className="flex items-center gap-2 cursor-pointer bg-white border border-slate-200 px-3 py-2 rounded-lg flex-1">
                                                <input type="radio" name="dailyScope" checked={dailyScope === 'YESTERDAY'} onChange={() => setDailyScope('YESTERDAY')} className="bg-white" />
                                                <span className="text-sm font-medium text-slate-700">Data from Yesterday</span>
                                            </label>
                                        </div>
                                    </div>
                                )}

                                {schedFreq === 'WEEKLY' && (
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 mb-2">Run on Days</label>
                                            <div className="flex justify-between gap-1 bg-white p-2 rounded-lg border border-slate-200">
                                                {['S','M','T','W','T','F','S'].map((d, i) => (
                                                    <button
                                                        key={i}
                                                        onClick={() => toggleWeekDay(i)}
                                                        className={`w-8 h-8 rounded-full text-xs font-bold transition-all ${schedWeekDays.includes(i) ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                                                    >
                                                        {d}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-800">
                                            <p className="font-bold flex items-center gap-1"><Info className="w-3 h-3"/> Scope</p>
                                            <p className="mt-1">Weekly reports cover the full 7-day period ending on the day before the run date.</p>
                                        </div>
                                    </div>
                                )}

                                {schedFreq === 'MONTHLY' && (
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 mb-1">Run on Day</label>
                                            <select
                                                value={monthlyRunDay}
                                                onChange={(e) => setMonthlyRunDay(parseInt(e.target.value))}
                                                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white text-black"
                                            >
                                                {Array.from({length: 31}, (_, i) => i + 1).map(d => (
                                                    <option key={d} value={d}>{d}{getOrdinal(d)}</option>
                                                ))}
                                                <option value={32}>Last Day of Month</option>
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 mb-2">Data Scope</label>
                                            <div className="space-y-2">
                                                <label className="flex items-center gap-2 cursor-pointer bg-white border border-slate-200 px-3 py-2 rounded-lg">
                                                    <input type="radio" name="monthlyScope" checked={monthlyScope === 'CALENDAR_MONTH'} onChange={() => setMonthlyScope('CALENDAR_MONTH')} className="bg-white" />
                                                    <span className="text-sm font-medium text-slate-700">Previous Calendar Month</span>
                                                </label>

                                                <label className="flex items-center gap-2 cursor-pointer bg-white border border-slate-200 px-3 py-2 rounded-lg">
                                                    <input type="radio" name="monthlyScope" checked={monthlyScope === 'ROLLING_DAYS'} onChange={() => setMonthlyScope('ROLLING_DAYS')} className="bg-white" />
                                                    <span className="text-sm font-medium text-slate-700">Rolling Days (Custom)</span>
                                                </label>

                                                {monthlyScope === 'ROLLING_DAYS' && (
                                                    <div className="pl-6">
                                                        <label className="text-xs text-slate-500 mr-2">Number of days:</label>
                                                        <input
                                                            type="number"
                                                            min="1"
                                                            max="365"
                                                            value={monthlyRollingDays}
                                                            onChange={(e) => setMonthlyRollingDays(parseInt(e.target.value) || 30)}
                                                            className="w-20 px-2 py-1 border border-slate-300 rounded text-sm bg-white text-black"
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {schedFreq === 'CUSTOM' && (
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 mb-1">Repeat Every (Days)</label>
                                            <input
                                                type="number"
                                                min="1"
                                                value={schedCustomInterval}
                                                onChange={(e) => setSchedCustomInterval(parseInt(e.target.value) || 1)}
                                                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white text-black"
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 mb-1">End Offset</label>
                                                <input type="number" min="0" value={schedRangeEnd} onChange={e => setSchedRangeEnd(parseInt(e.target.value)||0)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white text-black [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 mb-1">Lookback</label>
                                                <input type="number" min="0" value={schedRangeStart} onChange={e => setSchedRangeStart(parseInt(e.target.value)||0)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white text-black [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
                             <button onClick={() => setIsCreatingSchedule(false)} className="px-4 py-2 text-slate-500 hover:bg-slate-200 rounded-lg">Cancel</button>
                             <button onClick={handleCreateSchedule} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shadow-md shadow-blue-500/20">Save Schedule</button>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 gap-4">
                    {schedules.map(schedule => (
                        <div key={schedule.id} className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-lg shadow-sm hover:border-blue-300 transition-colors">
                             <div className="flex items-center gap-4">
                                 <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${schedule.active ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-400'}`}>
                                     <ClockIcon className="w-6 h-6" />
                                 </div>
                                 <div>
                                     <h4 className="font-bold text-slate-800">{schedule.name}</h4>
                                     <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                                         <span className="flex items-center gap-1 bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
                                             <Info className="w-3 h-3" /> {getFriendlyDescription(schedule)}
                                         </span>
                                         <span>at {schedule.time}</span>
                                     </div>
                                 </div>
                             </div>
                             <div className="flex items-center gap-4">
                                 <span className={`text-xs font-bold px-2 py-1 rounded ${schedule.active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                                     {schedule.active ? 'ACTIVE' : 'PAUSED'}
                                 </span>
                                 <button onClick={() => handleDeleteSchedule(schedule.id)} className="text-slate-400 hover:text-red-500 p-2 hover:bg-red-50 rounded-lg transition-colors">
                                     <Trash className="w-4 h-4" />
                                 </button>
                             </div>
                        </div>
                    ))}
                    {schedules.length === 0 && !isCreatingSchedule && (
                        <div className="text-center py-12 border-2 border-dashed border-slate-100 rounded-xl text-slate-400">
                            No active schedules found.
                        </div>
                    )}
                </div>
            </div>
        )}
    </div>
  );
};
