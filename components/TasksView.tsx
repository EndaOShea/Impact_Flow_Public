import React from 'react';
import { Check, CheckSquare } from 'lucide-react';
import { Task, TaskStatus, ImpactType } from '../types';
import { FilterBar } from './FilterBar';
import { statusTagClass, statusLabel, priorityClass, currencySymbol, colorForId, fmtDate } from '../lib/display';

interface TasksViewProps {
  tasks: Task[];
  onTaskClick: (t: Task) => void;
  onToggleComplete: (t: Task) => void;
  filter: any;
}

export const TasksView: React.FC<TasksViewProps> = ({ tasks, onTaskClick, onToggleComplete, filter }) => (
  <div className="body view-enter">
    <FilterBar {...filter} />
    <div className="panel flush">
      {tasks.length === 0 ? (
        <div className="empty"><span className="ic"><CheckSquare className="w-7 h-7" /></span><h4>No tasks found</h4><p>Nothing matches your current filters. Try clearing them or create a new task.</p></div>
      ) : (
        <table className="tbl">
          <thead><tr>
            <th style={{ paddingLeft: 'var(--card-pad)', width: 40 }} /><th>Task</th><th>Project</th>
            <th>Priority</th><th>Status</th><th>Due</th>
            <th style={{ textAlign: 'right', paddingRight: 'var(--card-pad)' }}>Impact</th>
          </tr></thead>
          <tbody>
            {tasks.map(t => {
              const done = t.status === TaskStatus.COMPLETED;
              const rev = (t.impactMetrics || []).find(m => m.type === ImpactType.REVENUE);
              return (
                <tr key={t.id} onClick={() => onTaskClick(t)}>
                  <td style={{ paddingLeft: 'var(--card-pad)' }}>
                    <span className={'tcheck' + (done ? ' done' : '')} onClick={e => { e.stopPropagation(); onToggleComplete(t); }}>
                      {done && <Check className="w-3 h-3" strokeWidth={4} />}
                    </span>
                  </td>
                  <td><b style={{ color: 'var(--ink)', textDecoration: done ? 'line-through' : 'none', opacity: done ? 0.5 : 1 }}>{t.title}</b></td>
                  <td>{t.projectId
                    ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontWeight: 700 }}><span className="proj-dot" style={{ background: colorForId(t.projectId) }} />{t.projectTitle || 'Project'}</span>
                    : <span style={{ color: 'var(--faint)', fontWeight: 600 }}>Standalone</span>}</td>
                  <td><span className={'pri ' + priorityClass(t.priority)}>{t.priority}</span></td>
                  <td><span className={'tag ' + statusTagClass(t.status)}>{statusLabel(t.status)}</span></td>
                  <td className="num" style={{ color: 'var(--muted)', fontWeight: 700 }}>{fmtDate(t.dueDate)}</td>
                  <td className="num" style={{ textAlign: 'right', paddingRight: 'var(--card-pad)', fontWeight: 800, color: 'var(--ink)' }}>
                    {rev && (rev.achievedValue || 0) > 0 ? `${currencySymbol(rev.currency)}${(rev.achievedValue || 0).toLocaleString()}` : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  </div>
);
