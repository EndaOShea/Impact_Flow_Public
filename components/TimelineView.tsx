import React from 'react';
import { Task, Priority, User } from '../types';
import { Flag, AlertCircle } from 'lucide-react';

interface TimelineViewProps {
  tasks: Task[];
  users: User[];
  onTaskClick: (task: Task) => void;
}

export const TimelineView: React.FC<TimelineViewProps> = ({ tasks, users, onTaskClick }) => {
  // Simple Timeline implementation: Last 7 days + Next 23 days
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 7);
  const totalDays = 30;
  
  const dates = Array.from({ length: totalDays }, (_, i) => {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    return d;
  });

  const getPosition = (date?: Date | string) => {
    if (!date) return 0;
    const d = new Date(date);
    if (isNaN(d.getTime())) return 0; // Invalid date
    const diff = d.getTime() - startDate.getTime();
    const days = diff / (1000 * 3600 * 24);
    return Math.max(0, Math.min(days, totalDays)) * (100 / totalDays);
  };

  const getWidth = (start?: Date | string, end?: Date | string) => {
    if (!start || !end) return 100 / totalDays; // Default 1 day width
    const startD = new Date(start);
    const endD = new Date(end);
    if (isNaN(startD.getTime()) || isNaN(endD.getTime())) return 100 / totalDays;
    const s = Math.max(startD.getTime(), startDate.getTime());
    const e = Math.min(endD.getTime(), startDate.getTime() + (totalDays * 24 * 3600 * 1000));
    const diff = e - s;
    const days = diff / (1000 * 3600 * 24);
    return Math.max(0.5, days) * (100 / totalDays); // Min 0.5 days width
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden animate-in fade-in">
      <div className="p-4 border-b border-slate-200 flex justify-between items-center">
        <h2 className="text-lg font-bold text-slate-800">Project Timeline (30 Days)</h2>
        <div className="flex gap-4 text-xs">
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

          {/* Task Rows */}
          <div className="divide-y divide-slate-100">
            {tasks.map(task => {
              const startPos = getPosition(task.startDate || task.createdAt);
              const width = getWidth(task.startDate || task.createdAt, task.dueDate || new Date());
              
              const colorClass =
                task.priority === Priority.CRITICAL ? 'bg-red-500' :
                task.priority === Priority.HIGH ? 'bg-orange-500' :
                task.priority === Priority.LOW ? 'bg-green-500' :
                'bg-blue-500';

              // Display creator name (single user system)
              const assigneeName = users.find(u => u.id === task.creatorId)?.name || 'You';

              const hasMilestones = task.subtasks && task.subtasks.some(s => s.isMilestone);

              return (
                <div key={task.id} className="flex hover:bg-slate-50 group">
                  <div className="w-48 p-3 text-sm font-medium text-slate-700 truncate sticky left-0 bg-white group-hover:bg-slate-50 border-r border-slate-200 z-10 flex items-center gap-2 cursor-pointer" onClick={() => onTaskClick(task)}>
                    {hasMilestones && <Flag className="w-3 h-3 text-purple-600 fill-purple-600" />}
                    {task.title}
                  </div>
                  <div className="flex-1 relative h-10 my-auto">
                    {/* Grid Lines Background */}
                    <div className="absolute inset-0 flex">
                       {dates.map((_, i) => (
                          <div key={i} className="flex-1 border-r border-slate-100"></div>
                       ))}
                    </div>
                    
                    {/* Bar */}
                    <div 
                      className={`absolute top-2 h-6 rounded-md shadow-sm ${colorClass} opacity-80 hover:opacity-100 cursor-pointer transition-all flex items-center px-2 text-white text-xs whitespace-nowrap overflow-hidden`}
                      style={{ 
                        left: `${startPos}%`, 
                        width: `${width}%` 
                      }}
                      onClick={() => onTaskClick(task)}
                      title={`${task.title} (${new Date(task.startDate || task.createdAt).toLocaleDateString()} - ${task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'No due date'})`}
                    >
                      {width > 5 && assigneeName}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};