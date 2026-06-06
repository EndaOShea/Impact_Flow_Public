import React, { useState, useMemo } from 'react';
import { Task, TaskStatus, Priority, Project, ProjectStatus } from '../types';
import { ChevronLeft, ChevronRight, Filter } from 'lucide-react';
import { colorForId } from '../lib/display';

interface CalendarViewProps {
  tasks: Task[];
  projects: Project[];
  onTaskClick: (task: Task) => void;
  onProjectClick: (project: Project) => void;
}

type CalendarFilter = 'ALL' | 'PROJECTS_ONLY' | 'STANDALONE_ONLY' | string; // string for specific project ID

// Priority colors (used for standalone task chips).
const priorityColor = (p: Priority): string => {
  switch (p) {
    case Priority.CRITICAL: return '#ef4444';
    case Priority.HIGH: return '#f59e0b';
    case Priority.MEDIUM: return '#eab308';
    case Priority.LOW: return '#10b981';
    default: return '#3b82f6';
  }
};

export const CalendarView: React.FC<CalendarViewProps> = ({ tasks, projects, onTaskClick, onProjectClick }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarFilter, setCalendarFilter] = useState<CalendarFilter>('ALL');

  // Filter tasks and projects based on selected filter
  const filteredTasks = useMemo(() => {
    if (calendarFilter === 'ALL') return tasks;
    if (calendarFilter === 'PROJECTS_ONLY') return tasks.filter(t => !!t.projectId);
    if (calendarFilter === 'STANDALONE_ONLY') return tasks.filter(t => !t.projectId);
    // Specific project ID
    return tasks.filter(t => t.projectId === calendarFilter);
  }, [tasks, calendarFilter]);

  const filteredProjects = useMemo(() => {
    if (calendarFilter === 'STANDALONE_ONLY') return [];
    if (calendarFilter === 'ALL' || calendarFilter === 'PROJECTS_ONLY') return projects;
    // Specific project ID - only show that project
    return projects.filter(p => p.id === calendarFilter);
  }, [projects, calendarFilter]);

  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  // MON-first grid: convert JS getDay() (0=Sun) to Monday-based index.
  const rawFirstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();
  const firstDayOfMonth = (rawFirstDay + 6) % 7;

  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const padding = Array.from({ length: firstDayOfMonth }, (_, i) => i);

  const getEventsForDay = (day: number) => {
    const targetDateStr = new Date(currentDate.getFullYear(), currentDate.getMonth(), day).toDateString();

    const events: Array<
      | { type: 'START' | 'DUE'; task: Task; itemType: 'task' }
      | { type: 'PROJECT_START' | 'PROJECT_END'; project: Project; itemType: 'project' }
    > = [];

    // Add task events
    filteredTasks.forEach(task => {
        // Check Start Date
        if (task.startDate) {
            const start = new Date(task.startDate);
            if (start.toDateString() === targetDateStr) {
                events.push({ type: 'START', task, itemType: 'task' });
            }
        }
        // Check Due Date
        if (task.dueDate) {
            const due = new Date(task.dueDate);
            if (due.toDateString() === targetDateStr) {
                 const existing = events.find(e => e.itemType === 'task' && e.task.id === task.id && e.type === 'START');
                 if(!existing) {
                     events.push({ type: 'DUE', task, itemType: 'task' });
                 }
            }
        }
    });

    // Add project events
    filteredProjects.forEach(project => {
        // Check Project Start Date
        if (project.startDate) {
            const start = new Date(project.startDate);
            if (start.toDateString() === targetDateStr) {
                events.push({ type: 'PROJECT_START', project, itemType: 'project' });
            }
        }
        // Check Project Target End Date
        if (project.targetEndDate) {
            const end = new Date(project.targetEndDate);
            if (end.toDateString() === targetDateStr) {
                const existing = events.find(e => e.itemType === 'project' && e.project.id === project.id && e.type === 'PROJECT_START');
                if(!existing) {
                    events.push({ type: 'PROJECT_END', project, itemType: 'project' });
                }
            }
        }
    });

    // Sort: Projects first, then due dates, then starts
    return events.sort((a, b) => {
      if (a.itemType === 'project' && b.itemType === 'task') return -1;
      if (a.itemType === 'task' && b.itemType === 'project') return 1;
      if (a.itemType === 'task' && b.itemType === 'task') {
        return a.type === 'DUE' ? -1 : 1;
      }
      return 0;
    });
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const dow = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

  return (
    <div className="cal">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px', borderBottom: '1px solid var(--line)', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--ink)' }}>
            {currentDate.toLocaleDateString('default', { month: 'long', year: 'numeric' })}
          </h3>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={prevMonth} className="icon-btn" style={{ width: 32, height: 32 }} aria-label="Previous month">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button onClick={nextMonth} className="icon-btn" style={{ width: 32, height: 32 }} aria-label="Next month">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <Filter className="w-4 h-4" style={{ color: 'var(--faint)' }} />
          <div className="seg">
            {([
              ['ALL', 'All Items'],
              ['PROJECTS_ONLY', 'Projects'],
              ['STANDALONE_ONLY', 'Tasks'],
            ] as Array<[CalendarFilter, string]>).map(([value, label]) => (
              <button
                key={value}
                className={calendarFilter === value ? 'on' : ''}
                onClick={() => setCalendarFilter(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Day-of-week header */}
      <div className="cal-dow">
        {dow.map(d => <span key={d}>{d}</span>)}
      </div>

      {/* Grid */}
      <div className="cal-grid">
        {padding.map(i => (
          <div key={`pad-${i}`} className="cal-cell dim" />
        ))}
        {days.map(day => {
          const events = getEventsForDay(day);
          const isToday = new Date().toDateString() === new Date(currentDate.getFullYear(), currentDate.getMonth(), day).toDateString();

          return (
            <div key={day} className={'cal-cell' + (isToday ? ' today' : '')}>
              <span className="cal-daynum">{day}</span>
              {events.map((evt, idx) => {
                if (evt.itemType === 'task') {
                  const { task, type } = evt;
                  const isDue = type === 'DUE';
                  const isProjectTask = !!task.projectId;

                  // Color: project color for project tasks, priority/start color otherwise.
                  let color: string;
                  if (isProjectTask) {
                    const taskProject = projects.find(p => p.id === task.projectId);
                    color = taskProject?.color || colorForId(task.projectId || task.id);
                  } else {
                    color = isDue ? priorityColor(task.priority) : '#10b981';
                  }

                  const label = `${isDue ? 'Due' : 'Start'}: ${task.title}`;
                  const completed = task.status === TaskStatus.COMPLETED;

                  return (
                    <span
                      key={`task-${task.id}-${type}-${idx}`}
                      className="cal-ev"
                      style={{ background: color + '1f', color, borderLeftColor: color, opacity: completed ? 0.5 : 1 }}
                      title={label + (isProjectTask && task.projectTitle ? ` • Project: ${task.projectTitle}` : '')}
                      onClick={(e) => { e.stopPropagation(); onTaskClick(task); }}
                    >
                      {label}
                    </span>
                  );
                }

                // Project event
                const { project, type } = evt;
                const isEnd = type === 'PROJECT_END';
                const color = project.color || colorForId(project.id);
                const label = `${isEnd ? 'End' : 'Start'}: Project - ${project.title}`;
                const completed = project.status === ProjectStatus.COMPLETED;

                return (
                  <span
                    key={`project-${project.id}-${type}-${idx}`}
                    className="cal-ev"
                    style={{ background: color + '1f', color, borderLeftColor: color, opacity: completed ? 0.5 : 1 }}
                    title={label}
                    onClick={(e) => { e.stopPropagation(); onProjectClick(project); }}
                  >
                    {label}
                  </span>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
};
