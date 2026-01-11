import React from 'react';
import { Task, Priority, User, Project, ProjectStatus } from '../types';
import { Flag, AlertCircle, Briefcase } from 'lucide-react';

interface TimelineViewProps {
  tasks: Task[];
  users: User[];
  projects: Project[];
  onTaskClick: (task: Task) => void;
  onProjectClick: (project: Project) => void;
}

// Helper function to lighten a hex color
const lightenColor = (hex: string, percent: number): string => {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, ((num >> 16) + Math.round((255 - (num >> 16)) * percent)));
  const g = Math.min(255, (((num >> 8) & 0x00FF) + Math.round((255 - ((num >> 8) & 0x00FF)) * percent)));
  const b = Math.min(255, ((num & 0x0000FF) + Math.round((255 - (num & 0x0000FF)) * percent)));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
};

// Helper function to darken a hex color
const darkenColor = (hex: string, percent: number): string => {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, ((num >> 16) - Math.round((num >> 16) * percent)));
  const g = Math.max(0, (((num >> 8) & 0x00FF) - Math.round(((num >> 8) & 0x00FF) * percent)));
  const b = Math.max(0, ((num & 0x0000FF) - Math.round((num & 0x0000FF) * percent)));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
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

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden animate-in fade-in">
      <div className="p-4 border-b border-slate-200 flex justify-between items-center flex-wrap gap-2">
        <h2 className="text-lg font-bold text-slate-800">Timeline (Next 30 Days)</h2>
        <div className="flex gap-4 text-xs flex-wrap items-center">
            <div className="flex items-center gap-1">
              <Briefcase className="w-3 h-3 text-slate-600" />
              <span className="text-slate-600 font-medium">Projects use custom colors</span>
            </div>
            <div className="h-4 w-px bg-slate-300"></div>
            <span className="text-slate-500 font-medium">Standalone Task Priority:</span>
            <div className="flex items-center gap-1"><div className="w-3 h-3 bg-red-500 rounded-sm"></div> Critical</div>
            <div className="flex items-center gap-1"><div className="w-3 h-3 bg-orange-500 rounded-sm"></div> High</div>
            <div className="flex items-center gap-1"><div className="w-3 h-3 bg-blue-500 rounded-sm"></div> Medium</div>
            <div className="flex items-center gap-1"><div className="w-3 h-3 bg-green-500 rounded-sm"></div> Low</div>
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <div className="min-w-[1000px]">
          {/* Header Dates */}
          <div className="flex border-b border-slate-200 bg-slate-50">
            <div className="w-48 p-3 text-xs font-bold text-slate-500 uppercase sticky left-0 bg-slate-50 border-r border-slate-200 z-10">Task</div>
            <div className="flex-1 flex relative">
              {dates.map((date, i) => (
                <div key={i} className="flex-1 text-center border-r border-slate-100 py-2 min-w-[30px]">
                  <span className={`text-[10px] font-semibold ${date.toDateString() === new Date().toDateString() ? 'text-blue-600' : 'text-slate-400'}`}>
                    {date.getDate()}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Projects with their Tasks */}
          {projects.filter(p => p.status !== ProjectStatus.COMPLETED && p.status !== ProjectStatus.CANCELLED).map(project => {
            const projectStartPos = getPosition(project.startDate);
            const projectWidth = getWidth(project.startDate, project.targetEndDate);
            const projectTasks = tasks.filter(t => t.projectId === project.id);

            // Get project color
            const projectColor = project.color || '#8b5cf6';
            const projectBgLight = lightenColor(projectColor, 0.9);
            const projectBgMedium = lightenColor(projectColor, 0.85);
            const projectBorderColor = lightenColor(projectColor, 0.7);
            const projectTextColor = darkenColor(projectColor, 0.3);

            return (
              <div key={`project-group-${project.id}`} className="border-b-2" style={{ borderColor: projectBorderColor }}>
                {/* Project Header Row */}
                <div className="flex group" style={{ backgroundColor: projectBgLight }}>
                  <div
                    className="w-48 p-3 text-sm font-bold truncate sticky left-0 border-r border-slate-200 z-10 flex items-center gap-2 cursor-pointer"
                    style={{
                      backgroundColor: projectBgMedium,
                      color: projectTextColor
                    }}
                    onClick={() => onProjectClick(project)}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = lightenColor(projectColor, 0.8)}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = projectBgMedium}
                  >
                    <Briefcase className="w-4 h-4 flex-shrink-0" style={{ color: projectColor }} />
                    <span className="truncate">{project.title}</span>
                  </div>
                  <div className="flex-1 relative h-10 my-auto">
                    {/* Grid Lines Background */}
                    <div className="absolute inset-0 flex">
                      {dates.map((_, i) => (
                        <div key={i} className="flex-1 border-r border-slate-100"></div>
                      ))}
                    </div>

                    {/* Project Bar */}
                    <div
                      className="absolute top-2 h-6 rounded-md shadow-sm opacity-80 hover:opacity-100 cursor-pointer transition-all flex items-center px-2 text-white text-xs whitespace-nowrap overflow-hidden"
                      style={{
                        left: `${projectStartPos}%`,
                        width: `${projectWidth}%`,
                        backgroundColor: projectColor
                      }}
                      onClick={() => onProjectClick(project)}
                      title={`${project.title} (${project.startDate ? new Date(project.startDate).toLocaleDateString() : 'No start'} - ${project.targetEndDate ? new Date(project.targetEndDate).toLocaleDateString() : 'No end date'})`}
                    >
                      {projectWidth > 8 && project.title}
                    </div>
                  </div>
                </div>

                {/* Project Tasks */}
                {projectTasks.length > 0 ? (
                  <div className="divide-y divide-slate-100" style={{ backgroundColor: projectBgLight }}>
                    {projectTasks.map(task => {
                      const startPos = getPosition(task.startDate || task.createdAt);
                      const width = getWidth(task.startDate || task.createdAt, task.dueDate || new Date());
                      const hasMilestones = task.subtasks && task.subtasks.some(s => s.isMilestone);

                      // Use lighter shade of project color for tasks
                      const taskBarColor = lightenColor(projectColor, 0.3);

                      return (
                        <div key={task.id} className="flex group" style={{ backgroundColor: 'transparent' }}>
                          <div
                            className="w-48 p-2 pl-8 text-sm font-medium truncate sticky left-0 border-r border-slate-200 z-10 flex items-center gap-2 cursor-pointer text-slate-700"
                            style={{ backgroundColor: projectBgLight }}
                            onClick={() => onTaskClick(task)}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = projectBgMedium}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = projectBgLight}
                          >
                            {hasMilestones && <Flag className="w-3 h-3 flex-shrink-0" style={{ color: projectColor, fill: projectColor }} />}
                            <span className="truncate">{task.title}</span>
                          </div>
                          <div className="flex-1 relative h-10 my-auto">
                            {/* Grid Lines Background */}
                            <div className="absolute inset-0 flex">
                              {dates.map((_, i) => (
                                <div key={i} className="flex-1 border-r border-slate-100"></div>
                              ))}
                            </div>

                            {/* Task Bar */}
                            <div
                              className="absolute top-2 h-6 rounded-md shadow-sm opacity-80 hover:opacity-100 cursor-pointer transition-all flex items-center px-2 text-white text-xs whitespace-nowrap overflow-hidden"
                              style={{
                                left: `${startPos}%`,
                                width: `${width}%`,
                                backgroundColor: taskBarColor
                              }}
                              onClick={() => onTaskClick(task)}
                              title={`${task.title} (${new Date(task.startDate || task.createdAt).toLocaleDateString()} - ${task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'No due date'})`}
                            >
                              {width > 5 && task.title}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex" style={{ backgroundColor: lightenColor(projectColor, 0.95) }}>
                    <div className="w-48 p-2 pl-8 text-xs text-slate-400 italic sticky left-0 border-r border-slate-200 z-10" style={{ backgroundColor: lightenColor(projectColor, 0.95) }}>
                      No tasks
                    </div>
                    <div className="flex-1 relative h-8">
                      <div className="absolute inset-0 flex">
                        {dates.map((_, i) => (
                          <div key={i} className="flex-1 border-r border-slate-100"></div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Standalone Tasks Section */}
          {tasks.filter(t => !t.projectId).length > 0 && (
            <div className="border-b-2 border-slate-300">
              {/* Section Header */}
              <div className="flex bg-slate-100">
                <div className="w-48 p-3 text-sm font-bold text-slate-600 sticky left-0 bg-slate-100 border-r border-slate-200 z-10 flex items-center gap-2">
                  <Flag className="w-4 h-4 text-slate-500 flex-shrink-0" />
                  Standalone Tasks
                </div>
                <div className="flex-1 relative h-10">
                  <div className="absolute inset-0 flex">
                    {dates.map((_, i) => (
                      <div key={i} className="flex-1 border-r border-slate-100"></div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Standalone Task Rows */}
              <div className="divide-y divide-slate-100">
                {tasks.filter(t => !t.projectId).map(task => {
                  const startPos = getPosition(task.startDate || task.createdAt);
                  const width = getWidth(task.startDate || task.createdAt, task.dueDate || new Date());
                  const hasMilestones = task.subtasks && task.subtasks.some(s => s.isMilestone);

                  const colorClass =
                    task.priority === Priority.CRITICAL ? 'bg-red-500' :
                    task.priority === Priority.HIGH ? 'bg-orange-500' :
                    task.priority === Priority.LOW ? 'bg-green-500' :
                    'bg-blue-500';

                  return (
                    <div key={task.id} className="flex hover:bg-slate-50 group">
                      <div
                        className="w-48 p-2 pl-8 text-sm font-medium truncate sticky left-0 bg-white group-hover:bg-slate-50 border-r border-slate-200 z-10 flex items-center gap-2 cursor-pointer text-slate-700"
                        onClick={() => onTaskClick(task)}
                      >
                        {hasMilestones && <Flag className="w-3 h-3 text-purple-600 fill-purple-600 flex-shrink-0" />}
                        <span className="truncate">{task.title}</span>
                      </div>
                      <div className="flex-1 relative h-10 my-auto">
                        {/* Grid Lines Background */}
                        <div className="absolute inset-0 flex">
                          {dates.map((_, i) => (
                            <div key={i} className="flex-1 border-r border-slate-100"></div>
                          ))}
                        </div>

                        {/* Task Bar */}
                        <div
                          className={`absolute top-2 h-6 rounded-md shadow-sm ${colorClass} opacity-80 hover:opacity-100 cursor-pointer transition-all flex items-center px-2 text-white text-xs whitespace-nowrap overflow-hidden`}
                          style={{
                            left: `${startPos}%`,
                            width: `${width}%`
                          }}
                          onClick={() => onTaskClick(task)}
                          title={`${task.title} (${new Date(task.startDate || task.createdAt).toLocaleDateString()} - ${task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'No due date'})`}
                        >
                          {width > 5 && task.title}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};