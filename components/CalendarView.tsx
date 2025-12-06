import React from 'react';
import { Task, TaskStatus, Priority } from '../types';
import { ChevronLeft, ChevronRight, PlayCircle, Flag } from 'lucide-react';

interface CalendarViewProps {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({ tasks, onTaskClick }) => {
  const [currentDate, setCurrentDate] = React.useState(new Date());

  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();

  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const padding = Array.from({ length: firstDayOfMonth }, (_, i) => i);

  const getEventsForDay = (day: number) => {
    const targetDateStr = new Date(currentDate.getFullYear(), currentDate.getMonth(), day).toDateString();
    
    const events: { type: 'START' | 'DUE'; task: Task }[] = [];

    tasks.forEach(task => {
        // Check Start Date
        if (task.startDate) {
            const start = new Date(task.startDate);
            if (start.toDateString() === targetDateStr) {
                events.push({ type: 'START', task });
            }
        }
        // Check Due Date
        if (task.dueDate) {
            const due = new Date(task.dueDate);
            if (due.toDateString() === targetDateStr) {
                 const existing = events.find(e => e.task.id === task.id && e.type === 'START');
                 if(!existing) {
                     events.push({ type: 'DUE', task });
                 }
            }
        }
    });
    
    // Sort: Due dates first (more urgent), then starts
    return events.sort((a, b) => (a.type === 'DUE' ? -1 : 1));
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
      <div className="flex items-center justify-between p-4 border-b border-slate-200">
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
                  const { task, type } = evt;
                  const isDue = type === 'DUE';
                  return (
                    <button
                      key={`${task.id}-${type}-${idx}`}
                      onClick={() => onTaskClick(task)}
                      className={`w-full text-left p-1 rounded text-[10px] border flex items-center gap-1 group transition-all
                        ${isDue ? getPriorityColor(task.priority) : 'border-emerald-200 bg-emerald-50 text-emerald-700'}
                        ${task.status === TaskStatus.COMPLETED ? 'opacity-50 grayscale' : ''}
                      `}
                    >
                      {isDue ? (
                          <Flag className="w-3 h-3 flex-shrink-0" />
                      ) : (
                          <PlayCircle className="w-3 h-3 flex-shrink-0" />
                      )}
                      <span className="truncate font-medium">{isDue ? 'Due: ' : 'Start: '}{task.title}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};