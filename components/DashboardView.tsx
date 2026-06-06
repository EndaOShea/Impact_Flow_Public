import React, { useMemo, useState } from 'react';
import { TrendingUp, CheckCircle2, Clock, Flag, Zap, Activity, ChevronRight } from 'lucide-react';
import { Task, Project, TaskStatus, Priority, ImpactType } from '../types';
import { AreaChart } from './charts/Charts';
import { FilterBar } from './FilterBar';
import {
  projectStatusTagClass, projectStatusLabel, priorityClass, statusLabel, statusTagClass,
  currencySymbol, colorForId, codeFor, fmtDate,
} from '../lib/display';

interface DashboardViewProps {
  tasks: Task[];          // filtered
  allTasks: Task[];
  projects: Project[];
  onTaskClick: (t: Task) => void;
  onProjectClick: (p: Project) => void;
  goProjects: () => void;
  filter: any;
}

const fmtK = (n: number) => {
  if (!n) return '0';
  if (Math.abs(n) >= 1000) return (n / 1000).toFixed(Math.abs(n) % 1000 >= 100 ? 1 : 0) + 'K';
  return String(Math.round(n));
};

const revenueOf = (t: Task) =>
  (t.impactMetrics || [])
    .filter(m => m.type === ImpactType.REVENUE)
    .reduce((s, m) => s + (m.achievedValue || 0), 0);

const PRI_META: [Priority, string, string][] = [
  [Priority.CRITICAL, 'Critical', '#ef4444'],
  [Priority.HIGH, 'High', '#f59e0b'],
  [Priority.MEDIUM, 'Medium', '#6366f1'],
  [Priority.LOW, 'Low', '#0d9488'],
];

export const DashboardView: React.FC<DashboardViewProps> = ({
  tasks, allTasks, projects, onTaskClick, onProjectClick, goProjects, filter,
}) => {
  const [expanded, setExpanded] = useState<string | null>(null);

  const projTasks = (pid: string) => allTasks.filter(t => t.projectId === pid);
  const progressOf = (p: Project) => {
    const ts = projTasks(p.id);
    if (!ts.length) return 0;
    return Math.round((ts.filter(t => t.status === TaskStatus.COMPLETED).length / ts.length) * 100);
  };
  const impactOf = (p: Project) => projTasks(p.id).reduce((s, t) => s + revenueOf(t), 0);

  // KPI strip (portfolio-level, from all tasks)
  const kpis = useMemo(() => {
    const open = allTasks.filter(t => t.status !== TaskStatus.COMPLETED && t.status !== TaskStatus.FAILED);
    const completed = allTasks.filter(t => t.status === TaskStatus.COMPLETED);
    const inProgress = allTasks.filter(t => t.status === TaskStatus.IN_PROGRESS).length;
    const blocked = allTasks.filter(t => (t.blockers || []).some(b => !b.resolvedAt)).length;
    const revenue = allTasks.reduce((s, t) => s + revenueOf(t), 0);
    const revSym = currencySymbol(
      allTasks.flatMap(t => t.impactMetrics || []).find(m => m.type === ImpactType.REVENUE)?.currency,
    );
    const hoursSaved = allTasks
      .flatMap(t => t.impactMetrics || [])
      .filter(m => m.type === ImpactType.EFFICIENCY)
      .reduce((s, m) => s + (m.achievedValue || 0), 0)
      || allTasks.flatMap(t => t.subtasks || []).reduce((s, st) => s + (st.hoursSpent || 0), 0);
    const cycleDays = (() => {
      const done = completed.filter(t => t.completedAt && t.createdAt);
      if (!done.length) return null;
      const avg = done.reduce((s, t) =>
        s + (new Date(t.completedAt!).getTime() - new Date(t.createdAt).getTime()), 0) / done.length;
      return avg / (1000 * 60 * 60 * 24);
    })();
    return [
      { l: 'Revenue Impact', v: revenue ? `${revSym}${fmtK(revenue)}` : '—', d: `${revSym}${fmtK(revenue)} realized`, cls: 'up', ic: <TrendingUp className="w-[15px] h-[15px]" /> },
      { l: 'Completed', v: String(completed.length), d: `${allTasks.length} total`, cls: 'up', ic: <CheckCircle2 className="w-[15px] h-[15px]" /> },
      { l: 'In Progress', v: String(inProgress), d: `${open.length} open`, cls: 'flat', ic: <Clock className="w-[15px] h-[15px]" /> },
      { l: 'Blocked', v: String(blocked), d: blocked ? 'needs attention' : 'none', cls: blocked ? 'dn' : 'flat', ic: <Flag className="w-[15px] h-[15px]" /> },
      { l: 'Hours Logged', v: hoursSaved ? fmtK(hoursSaved) : '—', d: 'tracked', cls: 'up', ic: <Zap className="w-[15px] h-[15px]" /> },
      { l: 'Avg Cycle', v: cycleDays != null ? `${cycleDays.toFixed(1)}d` : '—', d: 'create → done', cls: 'flat', ic: <Activity className="w-[15px] h-[15px]" /> },
    ];
  }, [allTasks]);

  // Weekly throughput series (last 8 weeks)
  const series = useMemo(() => {
    const weeks = 8;
    const msWeek = 7 * 24 * 3600 * 1000;
    const now = new Date(); now.setHours(0, 0, 0, 0);
    const startWindow = now.getTime() - (weeks - 1) * msWeek;
    const completed = new Array(weeks).fill(0);
    const revenue = new Array(weeks).fill(0);
    allTasks.forEach(t => {
      if (t.completedAt) {
        const w = Math.floor((new Date(t.completedAt).getTime() - startWindow) / msWeek);
        if (w >= 0 && w < weeks) { completed[w]++; revenue[w] += revenueOf(t); }
      }
    });
    let acc = 0;
    const cumRevenue = revenue.map(r => (acc += r));
    const hasRevenue = cumRevenue[weeks - 1] > 0;
    const hasAny = completed.some(c => c > 0);
    return { completed, cumRevenue, hasRevenue, hasAny };
  }, [allTasks]);

  // Priority mix of open tasks
  const priorityMix = useMemo(() => {
    const open = allTasks.filter(t => t.status !== TaskStatus.COMPLETED && t.status !== TaskStatus.FAILED);
    return PRI_META.map(([p, label, color]) => ({ label, color, value: open.filter(t => t.priority === p).length }));
  }, [allTasks]);
  const priTotal = priorityMix.reduce((s, p) => s + p.value, 0) || 1;
  const openCount = priorityMix.reduce((s, p) => s + p.value, 0);

  const needsAttention = useMemo(() => {
    const overdueProjectIds = new Set(
      allTasks.filter(t => t.status === TaskStatus.OVERDUE && t.projectId).map(t => t.projectId),
    );
    return projects
      .filter(p => p.status === 'ON_HOLD' || overdueProjectIds.has(p.id))
      .slice(0, 3);
  }, [projects, allTasks]);

  const activeProjects = projects.filter(p => p.status !== 'COMPLETED' && p.status !== 'CANCELLED');

  return (
    <div className="body view-enter">
      <FilterBar {...filter} projects={projects} showProject />

      <div className="kstrip">
        {kpis.map((k, i) => (
          <div className="k" key={i}>
            <div className="kl">{k.ic} {k.l}</div>
            <div className="kv num">{k.v}</div>
            <div className={'kd ' + k.cls}>{k.d}</div>
          </div>
        ))}
      </div>

      <div className="grid-2">
        <div className="panel">
          <div className="card-h">
            <div><h3>Impact &amp; Throughput</h3><div className="sub">{series.hasRevenue ? 'Cumulative revenue vs tasks shipped · last 8 weeks' : 'Tasks shipped per week · last 8 weeks'}</div></div>
          </div>
          {series.hasAny ? (
            <>
              <AreaChart
                vals={series.hasRevenue ? series.cumRevenue : series.completed}
                second={series.hasRevenue ? series.completed : undefined}
                id="dash" w={680} h={236} stroke="var(--accent)"
              />
              <div style={{ display: 'flex', gap: 18, marginTop: 10, fontSize: 12.5, fontWeight: 700, color: 'var(--muted)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><i style={{ width: 14, height: 3, borderRadius: 2, background: 'var(--accent)' }} />{series.hasRevenue ? 'Cumulative revenue' : 'Tasks shipped'}</span>
                {series.hasRevenue && <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><i style={{ width: 14, height: 3, borderRadius: 2, background: 'var(--faint)' }} />Tasks shipped</span>}
              </div>
            </>
          ) : (
            <div className="empty"><span className="ic"><TrendingUp className="w-7 h-7" /></span><h4>No activity yet</h4><p>Complete tasks to see your throughput trend here.</p></div>
          )}
        </div>

        <div className="panel">
          <div className="card-h"><div><h3>Priority Mix</h3><div className="sub">{openCount} open tasks</div></div></div>
          <div className="stack" style={{ marginBottom: 16 }}>
            {priorityMix.map((p, i) => <i key={i} style={{ width: (p.value / priTotal * 100) + '%', background: p.color }} title={p.label} />)}
          </div>
          <div className="legend">
            {priorityMix.map((p, i) => (
              <div className="lg-row" key={i}><i className="sw" style={{ background: p.color }} />{p.label}
                <span className="v num">{p.value}</span>
                <span className="num" style={{ color: 'var(--faint)', fontWeight: 700, width: 40, textAlign: 'right' }}>{Math.round(p.value / priTotal * 100)}%</span></div>
            ))}
          </div>
          {needsAttention.length > 0 && (
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--line-soft)' }}>
              <div className="kl" style={{ marginBottom: 10 }}><Flag className="w-[15px] h-[15px]" /> NEEDS ATTENTION</div>
              {needsAttention.map(p => (
                <div key={p.id} onClick={() => onProjectClick(p)} style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 13, fontWeight: 700, padding: '7px 0', cursor: 'pointer' }}>
                  <span className="proj-dot" style={{ background: p.color || colorForId(p.id) }} />{p.title}
                  <span className={'tag ' + projectStatusTagClass(p.status)} style={{ marginLeft: 'auto' }}>{projectStatusLabel(p.status)}</span></div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="panel flush">
        <div className="card-h" style={{ padding: 'var(--card-pad)', marginBottom: 0 }}>
          <div><h3>Portfolio</h3><div className="sub">Active projects · click a row to see its activity</div></div>
          <button className="chip" onClick={goProjects}>View all <ChevronRight className="w-[15px] h-[15px]" /></button>
        </div>
        {activeProjects.length === 0 ? (
          <div className="empty"><span className="ic"><Activity className="w-7 h-7" /></span><h4>No active projects</h4><p>Create a project to start tracking your portfolio.</p></div>
        ) : (
          <table className="tbl">
            <thead><tr>
              <th style={{ paddingLeft: 'var(--card-pad)' }}>Project</th><th>Status</th><th>Priority</th>
              <th style={{ width: 220 }}>Progress</th><th>Team</th><th style={{ textAlign: 'right' }}>Impact</th>
              <th style={{ width: 44, paddingRight: 'var(--card-pad)' }} />
            </tr></thead>
            <tbody>
              {activeProjects.map(p => {
                const color = p.color || colorForId(p.id);
                const prog = progressOf(p);
                const imp = impactOf(p);
                const open = expanded === p.id;
                const acts = (p.activityLog || []).slice(0, 5);
                const team = p.teamMembers || [];
                return (
                  <React.Fragment key={p.id}>
                    <tr onClick={() => setExpanded(open ? null : p.id)} style={{ background: open ? 'var(--hover)' : undefined }}>
                      <td style={{ paddingLeft: 'var(--card-pad)' }}><div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><span className="proj-badge" style={{ ['--pc' as any]: color }}>{codeFor(p.title)}</span><b style={{ color: 'var(--ink)' }}>{p.title}</b></div></td>
                      <td><span className={'tag ' + projectStatusTagClass(p.status)}>{projectStatusLabel(p.status)}</span></td>
                      <td><span className={'pri ' + priorityClass(p.priority)}>{p.priority}</span></td>
                      <td><span className="mini-bar"><i style={{ width: prog + '%', background: color }} /></span> <span className="num" style={{ fontWeight: 800, color: 'var(--ink)' }}>{prog}%</span></td>
                      <td><div className="ava-stack">{team.slice(0, 4).map((m, i) => <span key={i} className="ava sm" title={m.name}>{(m.name || '?').slice(0, 2).toUpperCase()}</span>)}{team.length === 0 && <span style={{ color: 'var(--faint)', fontWeight: 700, fontSize: 12 }}>—</span>}</div></td>
                      <td className="num" style={{ textAlign: 'right', fontWeight: 800, color: 'var(--ink)' }}>{imp ? `${currencySymbol(allTasks.flatMap(t => t.impactMetrics || []).find(m => m.type === ImpactType.REVENUE)?.currency)}${fmtK(imp)}` : '—'}</td>
                      <td style={{ paddingRight: 'var(--card-pad)', color: 'var(--muted)' }}><span style={{ display: 'inline-flex', transition: 'transform .18s', transform: open ? 'rotate(90deg)' : 'none' }}><ChevronRight className="w-[15px] h-[15px]" /></span></td>
                    </tr>
                    {open && (
                      <tr>
                        <td colSpan={7} style={{ padding: 0, borderBottom: '1px solid var(--line-soft)' }}>
                          <div style={{ background: 'var(--panel-2)', padding: '14px var(--card-pad) 16px', borderLeft: '3px solid ' + color }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                              <div className="flbl"><Activity className="w-[15px] h-[15px]" /> RECENT ACTIVITY · {p.title}</div>
                              <button className="chip" style={{ padding: '6px 11px' }} onClick={e => { e.stopPropagation(); onProjectClick(p); }}>Open project <ChevronRight className="w-[15px] h-[15px]" /></button>
                            </div>
                            {acts.length ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                {acts.map((a, i) => (
                                  <div key={i} style={{ display: 'flex', gap: 11, padding: '8px 0', alignItems: 'center' }}>
                                    <span className="ava sm">{(a.userName || '?').slice(0, 2).toUpperCase()}</span>
                                    <div style={{ flex: 1, fontSize: 13, lineHeight: 1.45 }}>
                                      <span style={{ fontWeight: 700, color: 'var(--ink)' }}>{a.userName}</span>{' '}
                                      <span style={{ color: 'var(--muted)', fontWeight: 600 }}>{a.action}</span>
                                    </div>
                                    <span style={{ fontSize: 11.5, color: 'var(--faint)', fontWeight: 600 }}>{fmtDate(a.timestamp)}</span>
                                  </div>
                                ))}
                              </div>
                            ) : <div style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 600, padding: '6px 0' }}>No recent activity on this project.</div>}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
