import React, { useState, useMemo, useEffect } from 'react';
import { Task, ImpactType, TaskStatus, ReportSchedule, Project, ProjectStatus } from '../types';
import {
  Calendar, Printer, TrendingUp, Clock, CheckCircle2, DollarSign, BarChart2,
  PieChart as PieChartIcon, Plus, Trash, Clock as ClockIcon, Info, Briefcase, ChevronDown, ChevronRight,
} from 'lucide-react';
import { BarChart, Donut } from './charts/Charts';
import { api } from '../services/api';
import { TemporalMetricsCharts } from './TemporalMetricsCharts';
import { priorityClass } from '../lib/display';

interface SystemReportProps {
  tasks: Task[];
  projects: Project[];
}

const COLORS = ['#6366f1', '#0d9488', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#94a3b8'];
const STATUS_COLOR: Record<string, string> = {
  'COMPLETED': '#0d9488', 'IN PROGRESS': '#6366f1', 'REVIEW': '#8b5cf6',
  'OVERDUE': '#ef4444', 'FAILED': '#ef4444', 'TODO': '#94a3b8', 'POSTPONED': '#f59e0b',
};

export const SystemReport: React.FC<SystemReportProps> = ({ tasks, projects }) => {
  const [activeTab, setActiveTab] = useState<'GENERATE' | 'SCHEDULE' | 'TRENDS'>('GENERATE');
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
    try { setSchedules(await api.getReportSchedules()); }
    catch (err) { console.error('Failed to load report schedules:', err); }
  };

  const handleCreateSchedule = async () => {
    if (!schedName) return;
    let startOffset = schedRangeStart;
    let endOffset = schedRangeEnd;
    if (schedFreq === 'DAILY') {
      if (dailyScope === 'TODAY') { startOffset = 0; endOffset = 0; } else { startOffset = 1; endOffset = 1; }
    } else if (schedFreq === 'WEEKLY') { startOffset = 7; endOffset = 1; }
    else if (schedFreq === 'MONTHLY') {
      startOffset = 30; endOffset = 0;
      if (monthlyScope === 'ROLLING_DAYS') { startOffset = monthlyRollingDays; endOffset = 0; }
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
      active: true,
    };
    try {
      await api.createReportSchedule(newSchedule);
      setIsCreatingSchedule(false);
      setSchedName(''); setSchedFreq('WEEKLY'); setSchedWeekDays([]); setDailyScope('YESTERDAY');
      loadSchedules();
    } catch (err) { console.error('Failed to create report schedule:', err); }
  };

  const handleDeleteSchedule = async (id: string) => {
    try { await api.deleteReportSchedule(id); loadSchedules(); }
    catch (err) { console.error('Failed to delete report schedule:', err); }
  };

  const toggleWeekDay = (dayIdx: number) => {
    if (schedWeekDays.includes(dayIdx)) setSchedWeekDays(schedWeekDays.filter(d => d !== dayIdx));
    else setSchedWeekDays([...schedWeekDays, dayIdx].sort());
  };

  const handlePreset = (preset: 'TODAY' | 'YESTERDAY' | 'THIS_WEEK' | 'LAST_WEEK' | 'THIS_MONTH' | 'LAST_MONTH' | 'THIS_YEAR' | 'LAST_YEAR') => {
    const now = new Date();
    let start = new Date();
    let end = new Date();
    switch (preset) {
      case 'TODAY': break;
      case 'YESTERDAY': start.setDate(now.getDate() - 1); end.setDate(now.getDate() - 1); break;
      case 'THIS_WEEK': start.setDate(now.getDate() - now.getDay()); break;
      case 'LAST_WEEK': start.setDate(now.getDate() - now.getDay() - 7); end.setDate(start.getDate() + 6); break;
      case 'THIS_MONTH': start.setDate(1); break;
      case 'LAST_MONTH': start.setMonth(now.getMonth() - 1, 1); end.setMonth(now.getMonth(), 0); break;
      case 'THIS_YEAR': start.setMonth(0, 1); break;
      case 'LAST_YEAR': start.setFullYear(now.getFullYear() - 1, 0, 1); end.setFullYear(now.getFullYear() - 1, 11, 31); break;
    }
    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);
  };

  const reportData = useMemo(() => {
    if (!startDate || !endDate) return null;
    const startObj = new Date(startDate); startObj.setHours(0, 0, 0, 0);
    const endObj = new Date(endDate); endObj.setHours(23, 59, 59, 999);

    const completedProjects = projects.filter(p => {
      if (p.status !== ProjectStatus.COMPLETED) return false;
      const completionDate = p.actualEndDate || p.completedAt;
      if (!completionDate) return false;
      const date = new Date(completionDate);
      return date >= startObj && date <= endObj;
    });

    const completedInPeriod = tasks.filter(t =>
      t.status === TaskStatus.COMPLETED && t.completedAt &&
      new Date(t.completedAt) >= startObj && new Date(t.completedAt) <= endObj && !t.projectId);

    const createdInPeriod = tasks.filter(t => new Date(t.createdAt) >= startObj && new Date(t.createdAt) <= endObj);
    const dueInPeriod = tasks.filter(t => t.dueDate && new Date(t.dueDate) >= startObj && new Date(t.dueDate) <= endObj);

    let totalRevenue = 0, totalTimeSaved = 0, totalHoursLogged = 0;
    const allCompletedTasks = tasks.filter(t =>
      t.status === TaskStatus.COMPLETED && t.completedAt &&
      new Date(t.completedAt) >= startObj && new Date(t.completedAt) <= endObj);
    allCompletedTasks.forEach(t => {
      totalHoursLogged += t.subtasks.reduce((sum, s) => sum + s.hoursSpent, 0);
      t.impactMetrics.forEach(m => {
        if (m.type === ImpactType.REVENUE) totalRevenue += (m.achievedValue || 0);
        if (m.type === ImpactType.EFFICIENCY) totalTimeSaved += (m.achievedValue || 0);
      });
    });

    const categoryMap: Record<string, number> = {};
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
    const categoryDistribution = Object.entries(categoryMap).map(([name, value]) => ({ name, value })).filter(i => i.value > 0);

    const statusMap: Record<string, number> = {};
    tasks.forEach(t => { statusMap[t.status] = (statusMap[t.status] || 0) + 1; });
    const statusDistribution = Object.entries(statusMap).map(([name, value]) => ({ name: name.replace('_', ' '), value }));

    return {
      completed: completedInPeriod, created: createdInPeriod, due: dueInPeriod, completedProjects,
      metrics: { revenue: totalRevenue, timeSaved: totalTimeSaved, hoursLogged: totalHoursLogged, completionRate: dueInPeriod.length > 0 ? Math.round((completedInPeriod.length / dueInPeriod.length) * 100) : 0 },
      charts: { statusDistribution, categoryDistribution },
    };
  }, [tasks, projects, startDate, endDate]);

  const handlePrint = () => window.print();

  const getOrdinal = (n: number) => {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return s[(v - 20) % 10] || s[v] || s[0];
  };

  const getFriendlyDescription = (s: ReportSchedule) => {
    if (s.frequency === 'DAILY') return `Daily (Data from ${s.dailyScope === 'TODAY' ? 'Today' : 'Yesterday'})`;
    if (s.frequency === 'WEEKLY') {
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      return `Weekly on ${s.weekDays?.map(d => days[d]).join(', ')} (Prev 7 Days)`;
    }
    if (s.frequency === 'MONTHLY') {
      const dayStr = s.monthlyRunDay === 32 ? 'Last Day' : `${s.monthlyRunDay}${getOrdinal(s.monthlyRunDay || 1)}`;
      const scopeStr = s.monthlyScope === 'CALENDAR_MONTH' ? 'Prev Calendar Month' : `Last ${s.monthlyRollingValue} Days`;
      return `Monthly on the ${dayStr} (${scopeStr})`;
    }
    return `Custom (Every ${s.customInterval} Days)`;
  };

  const toggleProjectExpanded = (projectId: string) => {
    setExpandedProjectIds(prev => {
      const next = new Set(prev);
      next.has(projectId) ? next.delete(projectId) : next.add(projectId);
      return next;
    });
  };

  const presets: [string, Parameters<typeof handlePreset>[0]][] = [
    ['Today', 'TODAY'], ['Yesterday', 'YESTERDAY'], ['This Week', 'THIS_WEEK'], ['Last Week', 'LAST_WEEK'],
    ['This Month', 'THIS_MONTH'], ['Last Month', 'LAST_MONTH'], ['This Year', 'THIS_YEAR'], ['Last Year', 'LAST_YEAR'],
  ];

  const kpiPct = (achieved: number, target: number) => target > 0 ? Math.min(100, Math.round((achieved / target) * 100)) : 0;
  const sym = (m: { type: ImpactType; currency?: string }) => m.type === ImpactType.REVENUE ? (m.currency === 'EUR' ? '€' : m.currency === 'GBP' ? '£' : '$') : '';

  const renderTaskCard = (task: Task, idx?: number) => {
    const totalHours = task.subtasks.reduce((sum, s) => sum + s.hoursSpent, 0);
    const completedSubtasks = task.subtasks.filter(s => s.completed).length;
    const progress = task.subtasks.length > 0 ? Math.round((completedSubtasks / task.subtasks.length) * 100) : 100;
    return (
      <div className="subpanel" key={task.id}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              {idx != null && <span className="num" style={{ fontSize: 12, fontWeight: 800, color: 'var(--faint)' }}>#{idx + 1}</span>}
              <h4 style={{ fontSize: 15, fontWeight: 800, margin: 0 }}>{task.title}</h4>
            </div>
            {task.description && <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 8px' }}>{task.description}</p>}
            <div style={{ display: 'flex', gap: 14, fontSize: 12, color: 'var(--muted)', flexWrap: 'wrap' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Calendar className="w-3 h-3" /> {task.completedAt ? new Date(task.completedAt).toLocaleDateString() : 'N/A'}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Clock className="w-3 h-3" /> {totalHours.toFixed(1)}h</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><CheckCircle2 className="w-3 h-3" /> {progress}%</span>
            </div>
          </div>
          <span className={'pri ' + priorityClass(task.priority)}>{task.priority}</span>
        </div>
        {task.impactMetrics.length > 0 && (
          <div className="panel" style={{ boxShadow: 'none', marginBottom: 12 }}>
            <div className="flbl" style={{ marginBottom: 10 }}><TrendingUp className="w-[14px] h-[14px]" /> KEY PERFORMANCE INDICATORS</div>
            <div className="grid-2">
              {task.impactMetrics.map(m => {
                const pct = kpiPct(m.achievedValue || 0, m.value);
                return (
                  <div key={m.id} className="subpanel">
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <div><div style={{ fontSize: 11, fontWeight: 800, color: 'var(--ink2)' }}>{m.type}</div>{m.description && <div style={{ fontSize: 10, color: 'var(--faint)' }}>{m.description}</div>}</div>
                      <span className="tag" style={{ background: pct >= 100 ? 'var(--green-bg)' : 'var(--inset)', color: pct >= 100 ? 'var(--green-ink)' : 'var(--ink2)' }}>{pct}%</span>
                    </div>
                    <div className="num" style={{ fontSize: 15, fontWeight: 800 }}>{sym(m)}{(m.achievedValue || 0).toLocaleString()} <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--faint)' }}>/ {sym(m)}{m.value.toLocaleString()}</span></div>
                    <div className="bar" style={{ marginTop: 6 }}><i style={{ width: pct + '%', background: pct >= 100 ? 'var(--green)' : 'var(--accent)' }} /></div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {task.subtasks.length > 0 && (
          <div className="panel" style={{ boxShadow: 'none' }}>
            <div className="flbl" style={{ marginBottom: 10 }}>WORK BREAKDOWN ({task.subtasks.length} STEPS)</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {task.subtasks.map(s => (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, padding: '6px 0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                    {s.completed ? <CheckCircle2 className="w-4 h-4" style={{ color: 'var(--green)' }} /> : <span style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid var(--line)' }} />}
                    <span style={{ color: s.completed ? 'var(--muted)' : 'var(--ink2)', fontWeight: 600, textDecoration: s.completed ? 'line-through' : 'none' }}>{s.title}</span>
                    <span className="tag">{s.category}</span>
                  </div>
                  <span style={{ color: 'var(--muted)' }}>{s.hoursSpent}h{s.estimatedHours > 0 ? ` (${s.estimatedHours}h est.)` : ''}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {(task.beforeScenario || task.afterScenario || task.impactNarrative) && (
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--line-soft)', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {task.impactNarrative && <p style={{ fontSize: 13, color: 'var(--ink2)', fontStyle: 'italic', margin: 0 }}>&ldquo;{task.impactNarrative}&rdquo;</p>}
            {(task.beforeScenario || task.afterScenario) && (
              <div className="grid-2">
                {task.beforeScenario && <div className="subpanel"><div className="flbl" style={{ marginBottom: 4 }}>BEFORE</div><p style={{ fontSize: 12, color: 'var(--ink2)', margin: 0 }}>{task.beforeScenario}</p></div>}
                {task.afterScenario && <div className="subpanel"><div className="flbl" style={{ marginBottom: 4, color: 'var(--green-ink)' }}>AFTER</div><p style={{ fontSize: 12, color: 'var(--ink2)', margin: 0 }}>{task.afterScenario}</p></div>}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const TABS: [typeof activeTab, string, React.ReactNode][] = [
    ['GENERATE', 'Report Generator', <BarChart2 className="w-4 h-4" />],
    ['SCHEDULE', 'Automation & Schedules', <ClockIcon className="w-4 h-4" />],
    ['TRENDS', 'Trends', <TrendingUp className="w-4 h-4" />],
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--line)' }} className="print:hidden">
        {TABS.map(([id, label, icon]) => (
          <button key={id} className={'modal-tab' + (activeTab === id ? ' on' : '')} onClick={() => setActiveTab(id)} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>{icon} {label}</button>
        ))}
      </div>

      {activeTab === 'GENERATE' && (
        <>
          <div className="panel" style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
            <div className="seg" style={{ flexWrap: 'wrap' }}>
              {presets.map(([label, key]) => <button key={key} onClick={() => handlePreset(key)}>{label}</button>)}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input type="date" className="input" style={{ width: 'auto' }} value={startDate} onChange={e => setStartDate(e.target.value)} />
              <span style={{ color: 'var(--muted)', fontWeight: 700 }}>→</span>
              <input type="date" className="input" style={{ width: 'auto' }} value={endDate} onChange={e => setEndDate(e.target.value)} />
              <button className="btn" onClick={handlePrint}><Printer className="w-4 h-4" /> Export</button>
            </div>
          </div>

          {reportData && (
            <>
              <div>
                <h2 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-.02em', margin: 0 }}>Performance Report</h2>
                <p style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 600, marginTop: 4 }}>Period: {new Date(startDate).toLocaleDateString()} — {new Date(endDate).toLocaleDateString()}</p>
              </div>

              <div className="grid-4">
                {[
                  { l: 'Tasks Completed', v: String(reportData.completed.length), ic: <CheckCircle2 className="w-[18px] h-[18px]" />, c: 'var(--green-ink)' },
                  { l: 'Revenue Impact', v: '€' + reportData.metrics.revenue.toLocaleString(), ic: <DollarSign className="w-[18px] h-[18px]" />, c: 'var(--accent)' },
                  { l: 'Hours Logged', v: reportData.metrics.hoursLogged.toFixed(1), ic: <Clock className="w-[18px] h-[18px]" />, c: 'var(--amber-ink)' },
                  { l: 'Time Saved (hrs)', v: String(reportData.metrics.timeSaved), ic: <TrendingUp className="w-[18px] h-[18px]" />, c: '#8b5cf6' },
                ].map((k, i) => (
                  <div className="panel" key={i}>
                    <div className="kl" style={{ color: k.c }}>{k.ic} {k.l}</div>
                    <div className="num" style={{ fontSize: 30, fontWeight: 800, marginTop: 10, letterSpacing: '-.03em' }}>{k.v}</div>
                  </div>
                ))}
              </div>

              <div className="grid-2">
                <div className="panel">
                  <div className="card-h"><div><h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}><BarChart2 className="w-[18px] h-[18px]" style={{ color: 'var(--accent)' }} /> Tasks by Status</h3></div></div>
                  <BarChart data={reportData.charts.statusDistribution.map(s => ({ label: s.name, value: s.value, color: STATUS_COLOR[s.name] || '#94a3b8' }))} w={560} h={230} />
                </div>
                <div className="panel">
                  <div className="card-h"><div><h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}><PieChartIcon className="w-[18px] h-[18px]" style={{ color: '#8b5cf6' }} /> Work Categories (Hours)</h3></div></div>
                  {reportData.charts.categoryDistribution.length > 0 ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
                      <Donut size={168} stroke={24} segments={reportData.charts.categoryDistribution.map((c, i) => ({ label: c.name, value: c.value, color: COLORS[i % COLORS.length] }))} center={{ v: reportData.charts.categoryDistribution.reduce((s, c) => s + c.value, 0).toFixed(0) + 'h', l: 'logged' }} />
                      <div className="legend" style={{ flex: 1 }}>
                        {reportData.charts.categoryDistribution.map((c, i) => <div className="lg-row" key={i}><i className="sw" style={{ background: COLORS[i % COLORS.length] }} />{c.name}<span className="v num">{c.value}h</span></div>)}
                      </div>
                    </div>
                  ) : <div className="empty" style={{ padding: '30px' }}><p>No hours logged in this period</p></div>}
                </div>
              </div>

              <div className="panel">
                <div className="card-h"><div><h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}><CheckCircle2 className="w-[18px] h-[18px]" style={{ color: 'var(--green)' }} /> Completed Tasks Breakdown</h3></div></div>
                {reportData.completed.length === 0 ? <div className="empty" style={{ padding: 40 }}><p>No tasks completed in this period.</p></div> : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>{reportData.completed.map((t, i) => renderTaskCard(t, i))}</div>
                )}
              </div>

              <div className="panel">
                <div className="card-h"><div><h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Briefcase className="w-[18px] h-[18px]" style={{ color: '#8b5cf6' }} /> Completed Projects</h3></div></div>
                {reportData.completedProjects.length === 0 ? <div className="empty" style={{ padding: 40 }}><p>No projects completed in this period.</p></div> : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {reportData.completedProjects.map((project, index) => {
                      const projectTasks = tasks.filter(t => t.projectId === project.id);
                      const completedTasks = projectTasks.filter(t => t.status === TaskStatus.COMPLETED);
                      const totalProjectHours = projectTasks.reduce((sum, t) => sum + t.subtasks.reduce((ts, s) => ts + s.hoursSpent, 0), 0);
                      const isExpanded = expandedProjectIds.has(project.id);
                      return (
                        <div className="subpanel" key={project.id}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                                <span className="num" style={{ fontSize: 12, fontWeight: 800, color: 'var(--faint)' }}>#{index + 1}</span>
                                <h4 style={{ fontSize: 15, fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}><Briefcase className="w-4 h-4" /> {project.title}</h4>
                              </div>
                              {project.description && <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 8px' }}>{project.description}</p>}
                              <div style={{ display: 'flex', gap: 14, fontSize: 12, color: 'var(--muted)', flexWrap: 'wrap' }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Calendar className="w-3 h-3" /> {project.actualEndDate ? new Date(project.actualEndDate).toLocaleDateString() : 'N/A'}</span>
                                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Clock className="w-3 h-3" /> {totalProjectHours.toFixed(1)}h</span>
                                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><CheckCircle2 className="w-3 h-3" /> {projectTasks.length} tasks</span>
                              </div>
                            </div>
                            <span className={'pri ' + priorityClass(project.priority)}>{project.priority}</span>
                          </div>
                          <div className="grid-4">
                            {[['Total Tasks', String(projectTasks.length), 'var(--ink)'], ['Completed', String(completedTasks.length), 'var(--green-ink)'], ['Total Hours', totalProjectHours.toFixed(1) + 'h', 'var(--accent)'], ['Completion', (projectTasks.length > 0 ? Math.round((completedTasks.length / projectTasks.length) * 100) : 0) + '%', '#8b5cf6']].map(([l, v, c], i) => (
                              <div className="panel" key={i} style={{ boxShadow: 'none' }}><div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700 }}>{l}</div><div className="num" style={{ fontSize: 20, fontWeight: 800, color: c, marginTop: 4 }}>{v}</div></div>
                            ))}
                          </div>
                          {project.aggregatedImpact && (
                            <div className="panel" style={{ boxShadow: 'none', marginTop: 12 }}>
                              <div className="flbl" style={{ marginBottom: 10 }}><TrendingUp className="w-[14px] h-[14px]" /> PROJECT IMPACT SUMMARY</div>
                              <div className="grid-4">
                                {project.aggregatedImpact.revenue > 0 && <div className="subpanel"><div style={{ fontSize: 11, color: 'var(--muted)' }}>Revenue</div><div className="num" style={{ fontSize: 17, fontWeight: 800, color: 'var(--green-ink)' }}>€{project.aggregatedImpact.revenue.toLocaleString()}</div></div>}
                                {project.aggregatedImpact.timeSaved > 0 && <div className="subpanel"><div style={{ fontSize: 11, color: 'var(--muted)' }}>Time Saved</div><div className="num" style={{ fontSize: 17, fontWeight: 800, color: 'var(--accent)' }}>{project.aggregatedImpact.timeSaved.toFixed(1)}h</div></div>}
                                {project.aggregatedImpact.costReduction > 0 && <div className="subpanel"><div style={{ fontSize: 11, color: 'var(--muted)' }}>Cost Saved</div><div className="num" style={{ fontSize: 17, fontWeight: 800, color: '#8b5cf6' }}>${project.aggregatedImpact.costReduction.toLocaleString()}</div></div>}
                                {project.aggregatedImpact.csat > 0 && <div className="subpanel"><div style={{ fontSize: 11, color: 'var(--muted)' }}>CSAT</div><div className="num" style={{ fontSize: 17, fontWeight: 800, color: 'var(--amber-ink)' }}>{project.aggregatedImpact.csat.toFixed(1)}</div></div>}
                              </div>
                            </div>
                          )}
                          {projectTasks.length > 0 && (
                            <button className="btn-g btn" style={{ width: '100%', justifyContent: 'center', marginTop: 12 }} onClick={() => toggleProjectExpanded(project.id)}>
                              {isExpanded ? <><ChevronDown className="w-4 h-4" /> Hide Tasks ({projectTasks.length})</> : <><ChevronRight className="w-4 h-4" /> View Tasks ({projectTasks.length})</>}
                            </button>
                          )}
                          {isExpanded && projectTasks.length > 0 && (
                            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>{projectTasks.map(t => renderTaskCard(t))}</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}

      {activeTab === 'SCHEDULE' && (
        <div className="panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div><h3 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>Automated Report Schedules</h3><p style={{ fontSize: 13, color: 'var(--muted)', margin: '2px 0 0' }}>Configure reports to run automatically.</p></div>
            {!isCreatingSchedule
              ? <button className="btn" onClick={() => setIsCreatingSchedule(true)}><Plus className="w-4 h-4" /> Create Schedule</button>
              : <button className="btn-ghost" onClick={() => setIsCreatingSchedule(false)}>Cancel</button>}
          </div>

          {isCreatingSchedule && (
            <div className="subpanel" style={{ marginBottom: 16 }}>
              <div className="ph">NEW REPORT SCHEDULE</div>
              <div className="grid-2">
                <div>
                  <div className="field"><label>Report Name</label><input className="input" value={schedName} onChange={e => setSchedName(e.target.value)} placeholder="e.g. Weekly Summary" /></div>
                  <div className="field"><label>Run Time</label><input className="input" type="time" value={schedTime} onChange={e => setSchedTime(e.target.value)} /></div>
                  <div className="field" style={{ marginBottom: 0 }}><label>Run Frequency</label>
                    <select className="input" value={schedFreq} onChange={e => setSchedFreq(e.target.value as any)}>
                      <option value="DAILY">Daily</option><option value="WEEKLY">Weekly</option><option value="MONTHLY">Monthly</option><option value="CUSTOM">Custom Interval</option>
                    </select>
                  </div>
                </div>
                <div>
                  {schedFreq === 'DAILY' && (
                    <div className="field"><label>Report Data Scope</label>
                      <div style={{ display: 'flex', gap: 10 }}>
                        {(['TODAY', 'YESTERDAY'] as const).map(s => (
                          <button key={s} className={'chip' + (dailyScope === s ? ' active' : '')} style={{ flex: 1, justifyContent: 'center' }} onClick={() => setDailyScope(s)}>Data from {s === 'TODAY' ? 'Today' : 'Yesterday'}</button>
                        ))}
                      </div>
                    </div>
                  )}
                  {schedFreq === 'WEEKLY' && (
                    <>
                      <div className="field"><label>Run on Days</label>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                            <button key={i} onClick={() => toggleWeekDay(i)} style={{ width: 34, height: 34, borderRadius: '50%', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 800, background: schedWeekDays.includes(i) ? 'var(--accent)' : 'var(--inset)', color: schedWeekDays.includes(i) ? '#fff' : 'var(--muted)' }}>{d}</button>
                          ))}
                        </div>
                      </div>
                      <div className="subpanel" style={{ fontSize: 12, color: 'var(--ink2)' }}><span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}><Info className="w-3 h-3" /> Scope</span><p style={{ margin: '6px 0 0' }}>Weekly reports cover the 7-day period ending the day before the run date.</p></div>
                    </>
                  )}
                  {schedFreq === 'MONTHLY' && (
                    <>
                      <div className="field"><label>Run on Day</label>
                        <select className="input" value={monthlyRunDay} onChange={e => setMonthlyRunDay(parseInt(e.target.value))}>
                          {Array.from({ length: 31 }, (_, i) => i + 1).map(d => <option key={d} value={d}>{d}{getOrdinal(d)}</option>)}
                          <option value={32}>Last Day of Month</option>
                        </select>
                      </div>
                      <div className="field" style={{ marginBottom: 0 }}><label>Data Scope</label>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {(['CALENDAR_MONTH', 'ROLLING_DAYS'] as const).map(s => (
                            <button key={s} className={'chip' + (monthlyScope === s ? ' active' : '')} onClick={() => setMonthlyScope(s)}>{s === 'CALENDAR_MONTH' ? 'Previous Calendar Month' : 'Rolling Days (Custom)'}</button>
                          ))}
                          {monthlyScope === 'ROLLING_DAYS' && <div><label style={{ fontSize: 12, color: 'var(--muted)', marginRight: 8 }}>Days:</label><input type="number" min="1" max="365" className="input" style={{ width: 90, display: 'inline-block' }} value={monthlyRollingDays} onChange={e => setMonthlyRollingDays(parseInt(e.target.value) || 30)} /></div>}
                        </div>
                      </div>
                    </>
                  )}
                  {schedFreq === 'CUSTOM' && (
                    <>
                      <div className="field"><label>Repeat Every (Days)</label><input type="number" min="1" className="input" value={schedCustomInterval} onChange={e => setSchedCustomInterval(parseInt(e.target.value) || 1)} /></div>
                      <div className="grid-2">
                        <div className="field" style={{ marginBottom: 0 }}><label>End Offset</label><input type="number" min="0" className="input" value={schedRangeEnd} onChange={e => setSchedRangeEnd(parseInt(e.target.value) || 0)} /></div>
                        <div className="field" style={{ marginBottom: 0 }}><label>Lookback</label><input type="number" min="0" className="input" value={schedRangeStart} onChange={e => setSchedRangeStart(parseInt(e.target.value) || 0)} /></div>
                      </div>
                    </>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, borderTop: '1px solid var(--line)', paddingTop: 14, marginTop: 14 }}>
                <button className="btn-g btn" onClick={() => setIsCreatingSchedule(false)}>Cancel</button>
                <button className="btn" onClick={handleCreateSchedule}>Save Schedule</button>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {schedules.map(schedule => (
              <div key={schedule.id} className="subpanel" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <span style={{ width: 44, height: 44, borderRadius: 12, display: 'grid', placeItems: 'center', background: schedule.active ? 'var(--green-bg)' : 'var(--inset)', color: schedule.active ? 'var(--green-ink)' : 'var(--faint)' }}><ClockIcon className="w-5 h-5" /></span>
                  <div>
                    <h4 style={{ fontSize: 14.5, fontWeight: 800, margin: 0 }}>{schedule.name}</h4>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>
                      <span className="chip" style={{ padding: '3px 8px' }}><Info className="w-3 h-3" /> {getFriendlyDescription(schedule)}</span>
                      <span>at {schedule.time}</span>
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span className={'tag ' + (schedule.active ? 't-done' : 't-todo')}>{schedule.active ? 'Active' : 'Paused'}</span>
                  <button className="btn-ghost" onClick={() => handleDeleteSchedule(schedule.id)} style={{ color: 'var(--red-ink)' }}><Trash className="w-4 h-4" /></button>
                </div>
              </div>
            ))}
            {schedules.length === 0 && !isCreatingSchedule && <div className="empty"><span className="ic"><ClockIcon className="w-7 h-7" /></span><h4>No schedules</h4><p>Create a schedule to automate reports.</p></div>}
          </div>
        </div>
      )}

      {activeTab === 'TRENDS' && (
        <div className="panel">
          <TemporalMetricsCharts defaultGranularity="monthly" defaultMonths={12} />
        </div>
      )}
    </div>
  );
};
