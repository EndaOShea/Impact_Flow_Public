import React from 'react';
import { Task, Priority, User, Project, ProjectStatus } from '../types';
import { Flag, Briefcase } from 'lucide-react';

interface TimelineViewProps {
  tasks: Task[];
  users: User[];
  projects: Project[];
  onTaskClick: (task: Task) => void;
  onProjectClick: (project: Project) => void;
}

// Priority color map for standalone task bars
const PRIORITY_COLORS: Record<string, string> = {
  [Priority.CRITICAL]: '#ef4444',
  [Priority.HIGH]: '#f59e0b',
  [Priority.MEDIUM]: '#6366f1',
  [Priority.LOW]: '#0d9488',
};

export const TimelineView: React.FC<TimelineViewProps> = ({ tasks, users, projects, onTaskClick, onProjectClick }) => {
  // Timeline implementation: Today + Next 29 days (30 days total)
  const startDate = new Date();
  startDate.setHours(0, 0, 0, 0); // Set to start of day to avoid timezone issues
  const totalDays = 30;

  const dates = Array.from({ length: totalDays }, (_, i) => {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    return d;
  });

  const todayStr = new Date().toDateString();
  const gridCols = `210px repeat(${totalDays}, minmax(26px,1fr))`;

  const getPosition = (date?: Date | string) => {
    if (!date) return 0;
    const d = new Date(date);
    d.setHours(0, 0, 0, 0); // Normalize to start of day
    if (isNaN(d.getTime())) return 0; // Invalid date
    const diff = d.getTime() - startDate.getTime();
    const days = diff / (1000 * 3600 * 24);
    return Math.max(0, Math.min(days, totalDays)) * (100 / totalDays);
  };

  const getWidth = (start?: Date | string, end?: Date | string) => {
    if (!start || !end) return 100 / totalDays; // Default 1 day width
    const startD = new Date(start);
    startD.setHours(0, 0, 0, 0); // Normalize to start of day
    const endD = new Date(end);
    endD.setHours(0, 0, 0, 0); // Normalize to start of day
    if (isNaN(startD.getTime()) || isNaN(endD.getTime())) return 100 / totalDays;
    const s = Math.max(startD.getTime(), startDate.getTime());
    const e = Math.min(endD.getTime(), startDate.getTime() + (totalDays * 24 * 3600 * 1000));
    const diff = e - s;
    const days = diff / (1000 * 3600 * 24);
    return Math.max(0.5, days) * (100 / totalDays); // Min 0.5 days width
  };

  const activeProjects = projects.filter(p => p.status !== ProjectStatus.COMPLETED && p.status !== ProjectStatus.CANCELLED);
  const standaloneTasks = tasks.filter(t => !t.projectId);

  return (
    <div className="panel flush">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px', borderBottom: '1px solid var(--line)', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 800 }}>Timeline · Next 30 Days</h3>
          <div className="sub" style={{ fontSize: 12.5, color: 'var(--muted)' }}>Projects use custom colors · standalone tasks colored by priority</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 11.5, fontWeight: 700, color: 'var(--muted)' }}>
          {([['Critical', '#ef4444'], ['High', '#f59e0b'], ['Medium', '#6366f1'], ['Low', '#0d9488']] as [string, string][]).map(([l, c]) => (
            <span key={l} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <i style={{ width: 10, height: 10, borderRadius: 3, background: c }}></i>{l}
            </span>
          ))}
        </div>
      </div>

      <div className="gantt">
        <div className="gantt-grid">
          {/* Header Dates */}
          <div className="gantt-head" style={{ gridTemplateColumns: gridCols }}>
            <div className="gantt-label" style={{ fontSize: 11, color: 'var(--faint)', letterSpacing: '.06em', fontWeight: 800 }}>TASK</div>
            {dates.map((date, i) => {
              const isToday = date.toDateString() === todayStr;
              return (
                <div
                  key={i}
                  className="gantt-daycell"
                  style={{ background: isToday ? 'var(--accent-softer)' : 'transparent', color: isToday ? 'var(--accent)' : 'var(--faint)' }}
                >
                  {date.getDate()}
                </div>
              );
            })}
          </div>

          {/* Projects Group */}
          {activeProjects.length > 0 && (
            <div className="gantt-group">
              <div style={{ padding: '8px 14px', fontSize: 12, fontWeight: 800, letterSpacing: '.04em', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Briefcase className="w-3.5 h-3.5" /> PROJECTS
              </div>
            </div>
          )}

          {activeProjects.map(project => {
            const projectStartPos = getPosition(project.startDate);
            const projectWidth = getWidth(project.startDate, project.targetEndDate);
            const projectTasks = tasks.filter(t => t.projectId === project.id);
            const projectColor = project.color || '#8b5cf6';
            const progress = (project as any).progress;
            const hasProgress = typeof progress === 'number' && !isNaN(progress);

            return (
              <React.Fragment key={`project-group-${project.id}`}>
                {/* Project Header Row */}
                <div className="gantt-row" style={{ gridTemplateColumns: gridCols }}>
                  <div className="gantt-label" style={{ cursor: 'pointer' }} onClick={() => onProjectClick(project)} title={project.title}>
                    <span className="proj-dot" style={{ background: projectColor }}></span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{project.title}</span>
                  </div>
                  <div className="gantt-track">
                    <div
                      className="gantt-bar"
                      style={{ left: `${projectStartPos}%`, width: `${projectWidth}%`, background: projectColor, color: '#fff', position: 'absolute' }}
                      onClick={() => onProjectClick(project)}
                      title={`${project.title} (${project.startDate ? new Date(project.startDate).toLocaleDateString() : 'No start'} - ${project.targetEndDate ? new Date(project.targetEndDate).toLocaleDateString() : 'No end date'})`}
                    >
                      {hasProgress && (
                        <div style={{ position: 'absolute', inset: 0, width: `${Math.max(0, Math.min(100, progress))}%`, background: 'rgba(255,255,255,.22)', borderRadius: 8 }}></div>
                      )}
                      <span style={{ position: 'relative', zIndex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{projectWidth > 8 && project.title}</span>
                    </div>
                  </div>
                </div>

                {/* Project Tasks */}
                {projectTasks.map(task => {
                  const startPos = getPosition(task.startDate || task.createdAt);
                  const width = getWidth(task.startDate || task.createdAt, task.dueDate || new Date());
                  const hasMilestones = task.subtasks && task.subtasks.some(s => s.isMilestone);

                  return (
                    <div key={task.id} className="gantt-row" style={{ gridTemplateColumns: gridCols }}>
                      <div className="gantt-label" style={{ cursor: 'pointer', paddingLeft: 28, fontWeight: 600, fontSize: 13 }} onClick={() => onTaskClick(task)} title={task.title}>
                        {hasMilestones && <Flag className="w-3 h-3 flex-shrink-0" style={{ color: projectColor, fill: projectColor }} />}
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.title}</span>
                      </div>
                      <div className="gantt-track">
                        <div
                          className="gantt-bar"
                          style={{ left: `${startPos}%`, width: `${width}%`, background: `${projectColor}26`, color: projectColor, border: `1.5px solid ${projectColor}55`, position: 'absolute' }}
                          onClick={() => onTaskClick(task)}
                          title={`${task.title} (${new Date(task.startDate || task.createdAt).toLocaleDateString()} - ${task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'No due date'})`}
                        >
                          <span style={{ position: 'relative', zIndex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{width > 5 && task.title}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </React.Fragment>
            );
          })}

          {/* Standalone Tasks Group */}
          {standaloneTasks.length > 0 && (
            <>
              <div className="gantt-group">
                <div style={{ padding: '8px 14px', fontSize: 12, fontWeight: 800, letterSpacing: '.04em', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Flag className="w-3.5 h-3.5" /> STANDALONE TASKS
                </div>
              </div>

              {standaloneTasks.map(task => {
                const startPos = getPosition(task.startDate || task.createdAt);
                const width = getWidth(task.startDate || task.createdAt, task.dueDate || new Date());
                const hasMilestones = task.subtasks && task.subtasks.some(s => s.isMilestone);
                const barColor = PRIORITY_COLORS[task.priority] || '#6366f1';

                return (
                  <div key={task.id} className="gantt-row" style={{ gridTemplateColumns: gridCols }}>
                    <div className="gantt-label" style={{ cursor: 'pointer', paddingLeft: 28, fontWeight: 600, fontSize: 13 }} onClick={() => onTaskClick(task)} title={task.title}>
                      {hasMilestones && <Flag className="w-3 h-3 flex-shrink-0" style={{ color: barColor, fill: barColor }} />}
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.title}</span>
                    </div>
                    <div className="gantt-track">
                      <div
                        className="gantt-bar"
                        style={{ left: `${startPos}%`, width: `${width}%`, background: barColor, color: '#fff', position: 'absolute' }}
                        onClick={() => onTaskClick(task)}
                        title={`${task.title} (${new Date(task.startDate || task.createdAt).toLocaleDateString()} - ${task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'No due date'})`}
                      >
                        <span style={{ position: 'relative', zIndex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{width > 5 && task.title}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
