import React, { useMemo } from 'react';
import { Task, WorkCategory, ImpactType } from '../types';
import { Clock, CheckCircle2, AlertCircle, Printer, ArrowRight, Flag } from 'lucide-react';
import { Donut } from './charts/Charts';

interface TaskReportProps {
  task: Task;
}

const COLORS = ['#6366f1', '#0d9488', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#94a3b8'];

export const TaskReport: React.FC<TaskReportProps> = ({ task }) => {
  const stats = useMemo(() => {
    const totalHours = task.subtasks.reduce((acc, curr) => acc + curr.hoursSpent, 0);
    const completedTasks = task.subtasks.filter(s => s.completed).length;
    const progress = task.subtasks.length ? Math.round((completedTasks / task.subtasks.length) * 100) : 0;

    const categoryMap: Record<string, number> = {};
    Object.values(WorkCategory).forEach(c => (categoryMap[c] = 0));
    task.subtasks.forEach(s => { categoryMap[s.category] = (categoryMap[s.category] || 0) + s.hoursSpent; });

    const categoryData = Object.entries(categoryMap)
      .filter(([, val]) => val > 0)
      .map(([name, value], i) => ({ label: name, value, color: COLORS[i % COLORS.length] }));

    const complexityScore = totalHours * 0.5 + task.subtasks.length * 2;
    return { totalHours, progress, categoryData, complexityScore };
  }, [task]);

  const handlePrint = () => window.print();
  const milestones = task.subtasks.filter(s => s.isMilestone);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }} className="animate-in fade-in">
      <div className="card-h" style={{ marginBottom: 0 }}>
        <div><h3 style={{ fontSize: 20 }}>{task.title}</h3><div className="sub">Impact &amp; Execution Report</div></div>
        <button onClick={handlePrint} className="btn-g btn print:hidden"><Printer className="w-4 h-4" /> Export / Print</button>
      </div>

      {((milestones && milestones.length > 0) || task.beforeScenario || task.afterScenario) && (
        <div className="subpanel">
          <div className="ph">STRATEGIC CONTEXT</div>
          {milestones && milestones.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <span className="flbl">STRATEGIC MILESTONES / OKRS</span>
              <ul style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8, listStyle: 'none', padding: 0 }}>
                {milestones.map((ms, idx) => (
                  <li key={idx} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Flag className="w-4 h-4" style={{ color: ms.completed ? 'var(--green)' : 'var(--faint)' }} />
                    <span style={{ fontSize: 14, fontWeight: 600, color: ms.completed ? 'var(--green-ink)' : 'var(--ink2)', textDecoration: ms.completed ? 'line-through' : 'none' }}>{ms.title}</span>
                    {ms.completed && <span className="tag t-done">Achieved</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 14, alignItems: 'center' }}>
            <div className="panel" style={{ boxShadow: 'none' }}>
              <div className="flbl" style={{ marginBottom: 6 }}>BEFORE STATE</div>
              <p style={{ fontSize: 13, color: 'var(--ink2)', lineHeight: 1.6, margin: 0 }}>{task.beforeScenario || 'No prior state defined.'}</p>
            </div>
            <ArrowRight className="w-5 h-5" style={{ color: 'var(--accent)' }} />
            <div className="panel" style={{ boxShadow: 'none' }}>
              <div className="flbl" style={{ marginBottom: 6, color: 'var(--green-ink)' }}>AFTER STATE</div>
              <p style={{ fontSize: 13, color: 'var(--ink2)', lineHeight: 1.6, margin: 0 }}>{task.afterScenario || 'No outcome defined.'}</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid-3">
        {[
          { ic: <Clock className="w-[18px] h-[18px]" />, l: 'Total Effort', v: stats.totalHours, u: 'hours' },
          { ic: <CheckCircle2 className="w-[18px] h-[18px]" />, l: 'Completion', v: stats.progress + '%', u: 'done' },
          { ic: <AlertCircle className="w-[18px] h-[18px]" />, l: 'Complexity', v: stats.complexityScore.toFixed(0), u: 'points' },
        ].map((c, i) => (
          <div className="subpanel" key={i}>
            <div className="kl">{c.ic} {c.l}</div>
            <div className="num" style={{ fontSize: 26, fontWeight: 800, marginTop: 8 }}>{c.v} <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--muted)' }}>{c.u}</span></div>
          </div>
        ))}
      </div>

      <div className="grid-2">
        <div className="subpanel">
          <div className="card-h"><div><h3>Effort Distribution</h3><div className="sub">Hours by work category</div></div></div>
          {stats.categoryData.length > 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
              <Donut segments={stats.categoryData} size={168} stroke={24} center={{ v: `${stats.totalHours}h`, l: 'logged' }} />
              <div className="legend" style={{ flex: 1 }}>
                {stats.categoryData.map((c, i) => (
                  <div className="lg-row" key={i}><i className="sw" style={{ background: c.color }} />{c.label}<span className="v num">{c.value}h</span></div>
                ))}
              </div>
            </div>
          ) : <div className="empty" style={{ padding: '30px 20px' }}><p>No hours recorded yet</p></div>}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {task.impactNarrative && (
            <div className="subpanel">
              <div className="ph">IMPACT NARRATIVE</div>
              <p style={{ fontSize: 13, color: 'var(--ink2)', lineHeight: 1.7, fontStyle: 'italic', margin: 0 }}>&ldquo;{task.impactNarrative}&rdquo;</p>
            </div>
          )}
          <div className="subpanel">
            <div className="ph">KEY PERFORMANCE INDICATORS</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {task.impactMetrics.map(m => {
                const target = m.value;
                const achieved = m.achievedValue || 0;
                const percent = target > 0 ? Math.min(100, Math.round((achieved / target) * 100)) : 0;
                const sym = m.type === ImpactType.REVENUE ? (m.currency === 'EUR' ? '€' : m.currency === 'GBP' ? '£' : '$') : '';
                return (
                  <div key={m.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                      <div><div style={{ fontSize: 11, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase' }}>{m.type}</div><div style={{ fontSize: 12, color: 'var(--faint)' }}>{m.description}</div></div>
                      <div className="num" style={{ fontSize: 15, fontWeight: 800, color: 'var(--ink)' }}>{sym}{achieved.toLocaleString()} <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--faint)' }}>/ {sym}{target.toLocaleString()}</span></div>
                    </div>
                    <div className="bar"><i style={{ width: percent + '%', background: percent >= 100 ? 'var(--green)' : 'var(--accent)' }} /></div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: percent >= 100 ? 'var(--green-ink)' : 'var(--accent)', marginTop: 4 }}>{percent}% achieved</div>
                  </div>
                );
              })}
              {task.impactMetrics.length === 0 && <p style={{ color: 'var(--faint)', fontSize: 13, margin: 0 }}>No KPIs defined.</p>}
            </div>
          </div>
        </div>
      </div>

      <div className="subpanel" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="ph" style={{ padding: '16px 16px 0' }}>DETAILED WORK LOGS</div>
        <table className="tbl" style={{ marginTop: 8 }}>
          <thead><tr>
            <th style={{ paddingLeft: 16 }}>Task Stage</th><th>Category</th><th>Hours</th><th style={{ paddingRight: 16 }}>Notes</th>
          </tr></thead>
          <tbody>
            {task.subtasks.map(sub => (
              <tr key={sub.id}>
                <td style={{ paddingLeft: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {sub.completed ? <CheckCircle2 className="w-4 h-4" style={{ color: 'var(--green)' }} /> : <span style={{ width: 16, height: 16, borderRadius: '50%', border: '1px solid var(--line)', display: 'inline-block' }} />}
                    <b style={{ color: 'var(--ink)' }}>{sub.title}</b>
                    {sub.isMilestone && <Flag className="w-3 h-3" style={{ color: 'var(--accent)' }} />}
                  </div>
                </td>
                <td><span className="tag">{sub.category}</span></td>
                <td className="num">{sub.hoursSpent}</td>
                <td style={{ paddingRight: 16, color: 'var(--muted)', maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={sub.notes}>{sub.notes || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
