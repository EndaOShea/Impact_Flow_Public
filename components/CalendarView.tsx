import React, { useState, useMemo } from 'react';
import { Task, TaskStatus, Priority, Project, ProjectStatus } from '../types';
import { ChevronLeft, ChevronRight, PlayCircle, Flag, Briefcase, Filter, ChevronDown } from 'lucide-react';

interface CalendarViewProps {
  tasks: Task[];
  projects: Project[];
  onTaskClick: (task: Task) => void;
  onProjectClick: (project: Project) => void;
}

type CalendarFilter = 'ALL' | 'PROJECTS_ONLY' | 'STANDALONE_ONLY' | string; // string for specific project ID

// Helper function to lighten a hex color
const lightenColor = (hex: string, percent: number): string => {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, ((num >> 16) + Math.round((255 - (num >> 16)) * percent)));
  const g = Math.min(255, (((num >> 8) & 0x00FF) + Math.round((255 - ((num >> 8) & 0x00FF)) * percent)));
  const b = Math.min(255, ((num & 0x0000FF) + Math.round((255 - (num & 0x0000FF)) * percent)));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
};

// Helper function to get text color (light or dark) based on background
const getTextColor = (hex: string): string => {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = (num >> 16);
  const g = ((num >> 8) & 0x00FF);
  const b = (num & 0x0000FF);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 155 ? '#1e293b' : '#ffffff';
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
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();

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

  const getPriorityColor = (p: Priority) => {
    switch (p) {
      case Priority.CRITICAL: return 'border-red-200 bg-red-50 text-red-700';
      case Priority.HIGH: return 'border-orange-200 bg-orange-50 text-orange-700';
      case Priority.MEDIUM: return 'border-yellow-200 bg-yellow-50 text-yellow-700';
      case Priority.LOW: return 'border-green-200 bg-green-50 text-green-700'; // Updated to Green
      default: return 'border-blue-200 bg-blue-50 text-blue-700';
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden animate-in fade-in">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-200 flex-wrap gap-3">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-bold text-slate-800">
            {currentDate.toLocaleDateString('default', { month: 'long', year: 'numeric' })}
          </h2>
          <div className="flex gap-2">
            <button onClick={prevMonth} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button onClick={nextMonth} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter Dropdown */}
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <div className="relative">
            <select
              value={calendarFilter}
              onChange={(e) => setCalendarFilter(e.target.value)}
              className="appearance-none bg-white border border-slate-200 text-slate-700 text-sm rounded-lg px-3 py-1.5 pr-8 cursor-pointer font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="ALL">All Items</option>
              <option value="PROJECTS_ONLY">Projects & Their Tasks</option>
              <option value="STANDALONE_ONLY">Standalone Tasks Only</option>
              {projects.length > 0 && (
                <optgroup label="Specific Project">
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.title}</option>
                  ))}
                </optgroup>
              )}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="p-3 text-center text-xs font-semibold text-slate-500 uppercase">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 auto-rows-fr min-h-[600px]">
        {padding.map(i => (
          <div key={`pad-${i}`} className="border-r border-b border-slate-100 bg-slate-50/30" />
        ))}
        {days.map(day => {
          const events = getEventsForDay(day);
          const isToday = new Date().toDateString() === new Date(currentDate.getFullYear(), currentDate.getMonth(), day).toDateString();
          
          return (
            <div key={day} className={`border-r border-b border-slate-100 p-2 min-h-[120px] relative ${isToday ? 'bg-blue-50/30' : ''}`}>
              <div className={`text-sm font-medium mb-2 ${isToday ? 'text-blue-600 bg-blue-100 w-6 h-6 rounded-full flex items-center justify-center' : 'text-slate-400'}`}>
                {day}
              </div>
              <div className="space-y-1">
                {events.map((evt, idx) => {
                  if (evt.itemType === 'task') {
                    const { task, type } = evt;
                    const isDue = type === 'DUE';
                    const isProjectTask = !!task.projectId;

                    // Get project color if this is a project task
                    let taskStyles: React.CSSProperties = {};
                    let taskClasses = '';

                    if (isProjectTask) {
                      const taskProject = projects.find(p => p.id === task.projectId);
                      const projectColor = taskProject?.color || '#8b5cf6';
                      const lightBg = lightenColor(projectColor, 0.85);
                      const lightBorder = lightenColor(projectColor, 0.6);
                      const textColor = getTextColor(lightBg);

                      taskStyles = {
                        backgroundColor: lightBg,
                        borderColor: lightBorder,
                        color: textColor
                      };
                      taskClasses = 'border-2';
                    } else {
                      // Standalone tasks: use priority colors for due, emerald for start
                      taskClasses = isDue ? getPriorityColor(task.priority) : 'border-emerald-200 bg-emerald-50 text-emerald-700';
                    }

                    return (
                      <button
                        key={`task-${task.id}-${type}-${idx}`}
                        onClick={() => onTaskClick(task)}
                        className={`w-full text-left p-1 rounded text-[10px] border flex flex-col gap-0.5 group transition-all
                          ${taskClasses}
                          ${task.status === TaskStatus.COMPLETED ? 'opacity-50 grayscale' : ''}
                        `}
                        style={isProjectTask ? taskStyles : undefined}
                      >
                        <div className="flex items-center gap-1">
                          {isDue ? (
                              <Flag className="w-3 h-3 flex-shrink-0" />
                          ) : (
                              <PlayCircle className="w-3 h-3 flex-shrink-0" />
                          )}
                          <span className="truncate font-medium">
                            {isDue ? 'Due: Task - ' : 'Start: Task - '}{task.title}
                          </span>
                        </div>
                        {isProjectTask && task.projectTitle && (
                          <div className="flex items-center gap-1 pl-4 text-[9px] opacity-75">
                            <Briefcase className="w-2.5 h-2.5 flex-shrink-0" />
                            <span className="truncate">Project - {task.projectTitle}</span>
                          </div>
                        )}
                      </button>
                    );
                  } else {
                    // Project event
                    const { project, type } = evt;
                    const isEnd = type === 'PROJECT_END';
                    const projectColor = project.color || '#8b5cf6';
                    const bgColor = isEnd ? lightenColor(projectColor, 0.7) : lightenColor(projectColor, 0.8);
                    const borderColor = isEnd ? lightenColor(projectColor, 0.4) : lightenColor(projectColor, 0.5);
                    const textColor = getTextColor(bgColor);

                    return (
                      <button
                        key={`project-${project.id}-${type}-${idx}`}
                        onClick={() => onProjectClick(project)}
                        className={`w-full text-left p-1 rounded text-[10px] border-2 flex items-center gap-1 group transition-all
                          ${project.status === ProjectStatus.COMPLETED ? 'opacity-50 grayscale' : ''}
                        `}
                        style={{
                          backgroundColor: bgColor,
                          borderColor: borderColor,
                          color: textColor
                        }}
                      >
                        <Briefcase className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate font-semibold">
                          {isEnd ? 'End: Project - ' : 'Start: Project - '}{project.title}
                        </span>
                      </button>
                    );
                  }
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};