import React, { useState, useMemo, useEffect } from 'react';
import {
  LayoutDashboard, CheckSquare, Plus, GitGraph, BarChart2, Calendar as CalendarIcon,
  Settings, Bell, Search, Filter, ArrowUpDown, ChevronDown, Check, Menu, X,
  LogOut, Activity
} from 'lucide-react';
import { TaskModal } from './components/TaskModal';
import { ImpactChart } from './components/ImpactChart';
import { CalendarView } from './components/CalendarView';
import { TimelineView } from './components/TimelineView';
import { SystemReport } from './components/SystemReport';
import { AuthScreen } from './components/AuthScreen';
import { AnalyticsDashboard } from './components/AnalyticsDashboard';
import { Task, TaskStatus, Priority, User, ViewState, WorkCategory } from './types';
import { api } from './services/api';
import { AnalyticsService, trackEvent } from './services/analytics';

export const App: React.FC = () => {
  // --- AUTH & DATA STATE ---
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);

  // --- UI STATE ---
  const [view, setView] = useState<ViewState>('DASHBOARD');

  // Track view changes
  useEffect(() => {
    if (currentUser) {
      trackEvent.viewChanged(view);
    }
  }, [view, currentUser]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [taskToEdit, setTaskToEdit] = useState<Task | undefined>(undefined);
  const [mutedTaskIds, setMutedTaskIds] = useState<string[]>([]);

  // --- FILTER & SORT STATE ---
  const [filterStatus, setFilterStatus] = useState<TaskStatus | 'ALL'>('ALL');
  const [filterPriority, setFilterPriority] = useState<Priority | 'ALL'>('ALL');
  const [filterDate, setFilterDate] = useState<'ALL' | 'TODAY' | 'WEEK' | 'MONTH' | 'UPCOMING'>('UPCOMING');

  // Track filter changes
  useEffect(() => {
    if (currentUser && filterStatus !== 'ALL') {
      trackEvent.filterApplied(`status:${filterStatus}`);
    }
  }, [filterStatus, currentUser]);

  useEffect(() => {
    if (currentUser && filterPriority !== 'ALL') {
      trackEvent.filterApplied(`priority:${filterPriority}`);
    }
  }, [filterPriority, currentUser]);

  useEffect(() => {
    if (currentUser && filterDate !== 'ALL') {
      trackEvent.filterApplied(`date:${filterDate}`);
    }
  }, [filterDate, currentUser]);
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('DESC');

  // --- PREFERENCE MANAGEMENT ---
  const loadUserPreferences = (userId: string) => {
      const savedPrefs = localStorage.getItem(`impactflow_prefs_${userId}`);
      if (savedPrefs) {
          try {
              const p = JSON.parse(savedPrefs);
              if (p.status) setFilterStatus(p.status);
              if (p.priority) setFilterPriority(p.priority);
              if (p.date) setFilterDate(p.date);
              if (p.sort) setSortOrder(p.sort);
          } catch (e) {
              console.error("Failed to load preferences", e);
          }
      }
  };

  // Save preferences whenever filters change
  useEffect(() => {
      if (currentUser) {
          const prefs = {
              status: filterStatus,
              priority: filterPriority,
              date: filterDate,
              sort: sortOrder
          };
          localStorage.setItem(`impactflow_prefs_${currentUser.id}`, JSON.stringify(prefs));
      }
  }, [filterStatus, filterPriority, filterDate, sortOrder, currentUser]);

  // --- INITIALIZATION ---
  useEffect(() => {
    const init = async () => {
        const user = api.init();
        if (user) {
            try {
                const validUser = await api.getCurrentUser();
                setCurrentUser(validUser);
                loadUserPreferences(validUser.id);
                refreshData();
            } catch (error) {
                console.error('Session validation failed:', error);
                api.logout();
                localStorage.removeItem('impactflow_current_user');
            }
        }
    };
    init();
  }, []);

  const refreshData = async () => {
    if (!currentUser) return;

    try {
        const allTasks = await api.getTasks();

        // Auto-update OVERDUE status
        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];

        const processedTasks = allTasks.map(t => {
            if (t.status !== TaskStatus.COMPLETED && t.status !== TaskStatus.FAILED && t.status !== TaskStatus.POSTPONED && t.dueDate) {
                const dueStr = new Date(t.dueDate).toISOString().split('T')[0];
                if (dueStr < todayStr && t.status !== TaskStatus.OVERDUE) {
                    return { ...t, status: TaskStatus.OVERDUE };
                }
            }
            return t;
        });

        setTasks(processedTasks);
    } catch (error) {
        console.error('Error refreshing data:', error);
    }
  };

  // Refresh data when user changes
  useEffect(() => {
    if (currentUser) {
      refreshData();
    }
  }, [currentUser]);

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    localStorage.setItem('impactflow_current_user', JSON.stringify(user));
    setView('DASHBOARD');
    loadUserPreferences(user.id);

    // Initialize analytics
    AnalyticsService.init();
    trackEvent.login();
  };

  const handleLogout = () => {
    trackEvent.logout();
    AnalyticsService.cleanup();

    api.logout();
    setCurrentUser(null);
    localStorage.removeItem('impactflow_current_user');
    setView('DASHBOARD');
    setTasks([]);
  };

  // --- FILTERING LOGIC ---
  const filteredTasks = useMemo(() => {
    let result = tasks;

    // 1. Status Filter
    if (filterStatus !== 'ALL') {
        result = result.filter(t => t.status === filterStatus);
    }

    // 2. Priority Filter
    if (filterPriority !== 'ALL') {
        result = result.filter(t => t.priority === filterPriority);
    }

    // 3. Date Filter
    const today = new Date();
    today.setHours(0,0,0,0);

    if (filterDate === 'TODAY') {
        result = result.filter(t => {
            if (!t.dueDate) return false;
            const d = new Date(t.dueDate);
            d.setHours(0,0,0,0);
            return d.getTime() === today.getTime();
        });
    } else if (filterDate === 'WEEK') {
        const nextWeek = new Date(today);
        nextWeek.setDate(today.getDate() + 7);
        result = result.filter(t => {
            if (!t.dueDate) return false;
            const d = new Date(t.dueDate);
            return d >= today && d <= nextWeek;
        });
    } else if (filterDate === 'MONTH') {
        const nextMonth = new Date(today);
        nextMonth.setMonth(today.getMonth() + 1);
        result = result.filter(t => {
            if (!t.dueDate) return false;
            const d = new Date(t.dueDate);
            return d >= today && d <= nextMonth;
        });
    } else if (filterDate === 'UPCOMING') {
        // Only filter out completed/failed if status filter is set to 'ALL'
        // This allows users to see completed tasks when explicitly filtering by status
        result = result.filter(t => {
            if (t.status === TaskStatus.OVERDUE) return true;
            if (filterStatus === 'ALL') {
                if (t.status === TaskStatus.COMPLETED) return false;
                if (t.status === TaskStatus.FAILED) return false;
            }
            return true;
        });
    }

    // 4. Sorting
    result.sort((a, b) => {
        const dateA = a.dueDate ? new Date(a.dueDate).getTime() : (sortOrder === 'ASC' ? 9999999999999 : 0);
        const dateB = b.dueDate ? new Date(b.dueDate).getTime() : (sortOrder === 'ASC' ? 9999999999999 : 0);

        if (sortOrder === 'ASC') {
            return dateA - dateB;
        } else {
            return dateB - dateA;
        }
    });

    return result;
  }, [tasks, filterStatus, filterPriority, filterDate, sortOrder]);


  // --- NOTIFICATIONS LOGIC ---
  const notifications = useMemo(() => {
    const now = new Date();
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000);

    return tasks.filter(t => {
        if (t.status === TaskStatus.COMPLETED || t.status === TaskStatus.FAILED) return false;
        if (!t.dueDate) return false;

        const due = new Date(t.dueDate);
        const isUrgent = due <= in48h && due >= now;
        const isOverdue = due < now;

        return isUrgent || isOverdue;
    }).sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime());
  }, [tasks]);

  const unreadNotifications = notifications.filter(t => !mutedTaskIds.includes(t.id));

  // --- ACTIONS ---

  const handleSaveTask = async (updatedTask: Task) => {
    // Recurrence Logic: If task is COMPLETED and isRecurring, create next instance
    if (updatedTask.status === TaskStatus.COMPLETED && updatedTask.isRecurring && updatedTask.recurrenceConfig) {
         const config = updatedTask.recurrenceConfig;
         let nextStartDate = new Date(updatedTask.startDate || new Date());
         let nextDueDate = updatedTask.dueDate ? new Date(updatedTask.dueDate) : undefined;

         const addInterval = (date: Date) => {
             const d = new Date(date);
             if (config.frequency === 'DAILY') d.setDate(d.getDate() + config.interval);
             if (config.frequency === 'WEEKLY') d.setDate(d.getDate() + (config.interval * 7));
             if (config.frequency === 'MONTHLY') d.setMonth(d.getMonth() + config.interval);
             if (config.frequency === 'YEARLY') d.setFullYear(d.getFullYear() + config.interval);
             return d;
         };

         nextStartDate = addInterval(nextStartDate);
         if (nextDueDate) nextDueDate = addInterval(nextDueDate);

         const nextTask: Task = {
             ...updatedTask,
             id: crypto.randomUUID(),
             status: TaskStatus.TODO,
             startDate: nextStartDate,
             dueDate: nextDueDate,
             createdAt: new Date(),
             completedAt: undefined,
             subtasks: updatedTask.subtasks.map(s => ({ ...s, completed: false, hoursSpent: 0 })),
             impactMetrics: updatedTask.impactMetrics.map(m => ({ ...m, achievedValue: 0 })),
             comments: [],
             activityLog: []
         };

         await api.createTask(nextTask);
    }

    // Check if this is an update (task has ID and exists in our tasks list)
    const isExistingTask = updatedTask.id && tasks.some(t => t.id === updatedTask.id);

    if (isExistingTask) {
        await api.updateTask(updatedTask.id, updatedTask);
        trackEvent.taskUpdated(updatedTask.id);

        // Track completion
        if (updatedTask.status === TaskStatus.COMPLETED) {
            trackEvent.taskCompleted(updatedTask.id);
        }
    } else {
        await api.createTask(updatedTask);
        if (updatedTask.id) {
            trackEvent.taskCreated(updatedTask.id);
        }
    }
    refreshData();
  };

  if (!currentUser) {
    return <AuthScreen onLogin={handleLogin} />;
  }

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 font-sans overflow-hidden print:h-auto print:overflow-visible print:block">

      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div
            className="fixed inset-0 bg-black/50 z-20 lg:hidden"
            onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-30 w-64 bg-slate-900 text-slate-300 transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0 flex flex-col print:hidden
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
            <h1 className="text-xl font-bold text-white">Impact Flow</h1>
            <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden text-slate-400 hover:text-white">
                <X className="w-6 h-6" />
            </button>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <button onClick={() => setView('DASHBOARD')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${view === 'DASHBOARD' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'hover:bg-slate-800'}`}>
            <LayoutDashboard className="w-5 h-5" /> Dashboard
          </button>
          <button onClick={() => setView('TASKS')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${view === 'TASKS' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'hover:bg-slate-800'}`}>
            <CheckSquare className="w-5 h-5" /> All Tasks
          </button>
          <button onClick={() => setView('CALENDAR')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${view === 'CALENDAR' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'hover:bg-slate-800'}`}>
            <CalendarIcon className="w-5 h-5" /> Calendar
          </button>
          <button onClick={() => setView('TIMELINE')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${view === 'TIMELINE' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'hover:bg-slate-800'}`}>
            <GitGraph className="w-5 h-5" /> Timeline
          </button>
          <button onClick={() => setView('REPORTS')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${view === 'REPORTS' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'hover:bg-slate-800'}`}>
            <BarChart2 className="w-5 h-5" /> Reports
          </button>

          <div className="pt-4 pb-2">
              <p className="px-4 text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Workspace</p>
              <button onClick={() => setView('NOTIFICATIONS')} className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all ${view === 'NOTIFICATIONS' ? 'bg-blue-600 text-white' : 'hover:bg-slate-800'}`}>
                <div className="flex items-center gap-3"><Bell className="w-5 h-5" /> Notifications</div>
                {unreadNotifications.length > 0 && <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{unreadNotifications.length}</span>}
              </button>

              <button onClick={() => setView('SETTINGS')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${view === 'SETTINGS' ? 'bg-blue-600 text-white' : 'hover:bg-slate-800'}`}>
                <Settings className="w-5 h-5" /> Settings
              </button>
          </div>
        </nav>

        <div className="p-4 border-t border-slate-800">
            <div className="flex items-center gap-3 mb-4 px-2">
                <div className="w-10 h-10 bg-slate-700 rounded-full flex items-center justify-center font-bold text-white border-2 border-slate-600">
                    {currentUser.avatarInitials}
                </div>
                <div className="flex flex-col min-w-0">
                    <span className="font-bold text-white truncate">{currentUser.name}</span>
                    <span className="text-xs text-slate-500 truncate">@{currentUser.username}</span>
                </div>
            </div>
            <button onClick={handleLogout} className="w-full py-2 bg-red-900/30 hover:bg-red-900/50 text-red-200 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors">
                <LogOut className="w-4 h-4" /> Sign Out
            </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative print:h-auto print:overflow-visible">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 flex-shrink-0 z-10 print:hidden">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-lg">
              <Menu className="w-6 h-6" />
            </button>
            <div className="hidden md:block">
              <h1 className="text-xl font-bold text-slate-800">
                {view === 'DASHBOARD' ? 'Dashboard' :
                 view === 'TASKS' ? 'All Tasks' :
                 view === 'CALENDAR' ? 'Calendar' :
                 view === 'TIMELINE' ? 'Timeline' :
                 view === 'SETTINGS' ? 'Settings' :
                 view === 'REPORTS' ? 'System Reports' :
                 'Notifications'}
              </h1>
              <p className="text-sm text-slate-500">Impact Flow Task Manager</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
             <button
                onClick={() => { setTaskToEdit(undefined); setIsTaskModalOpen(true); }}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium shadow-md shadow-blue-600/20 transition-all active:scale-95"
            >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">New Task</span>
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 lg:p-8 print:overflow-visible print:p-0">

            {(view === 'DASHBOARD' || view === 'TASKS') && (
                <div className="mb-6 bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap gap-4 items-center animate-in slide-in-from-top-2">
                    <div className="flex items-center gap-2 text-slate-500 text-sm font-bold uppercase tracking-wider mr-2">
                        <Filter className="w-4 h-4" /> Filters:
                    </div>

                    <div className="relative group">
                        <select
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value as any)}
                            className="appearance-none bg-white border border-slate-200 text-black text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full px-4 py-2 pr-8 cursor-pointer font-medium"
                        >
                            <option value="ALL">Status: All</option>
                            <option value={TaskStatus.TODO}>To Do</option>
                            <option value={TaskStatus.IN_PROGRESS}>In Progress</option>
                            <option value={TaskStatus.REVIEW}>Review</option>
                            <option value={TaskStatus.COMPLETED}>Completed</option>
                            <option value={TaskStatus.OVERDUE}>Overdue</option>
                            <option value={TaskStatus.POSTPONED}>Postponed</option>
                            <option value={TaskStatus.FAILED}>Failed</option>
                        </select>
                        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    </div>

                    <div className="relative group">
                         <select
                            value={filterPriority}
                            onChange={(e) => setFilterPriority(e.target.value as any)}
                            className="appearance-none bg-white border border-slate-200 text-black text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full px-4 py-2 pr-8 cursor-pointer font-medium"
                        >
                            <option value="ALL">Priority: All</option>
                            <option value={Priority.CRITICAL}>Critical</option>
                            <option value={Priority.HIGH}>High</option>
                            <option value={Priority.MEDIUM}>Medium</option>
                            <option value={Priority.LOW}>Low</option>
                        </select>
                        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    </div>

                     <div className="relative group">
                         <select
                            value={filterDate}
                            onChange={(e) => setFilterDate(e.target.value as any)}
                            className="appearance-none bg-white border border-slate-200 text-black text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full px-4 py-2 pr-8 cursor-pointer font-medium"
                        >
                            <option value="ALL">Date: All Time</option>
                            <option value="UPCOMING">Active / Upcoming</option>
                            <option value="TODAY">Due Today</option>
                            <option value="WEEK">Due This Week</option>
                            <option value="MONTH">Due This Month</option>
                        </select>
                        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    </div>

                    <div className="ml-auto flex items-center gap-2">
                        <button
                            onClick={() => setSortOrder(sortOrder === 'ASC' ? 'DESC' : 'ASC')}
                            className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100"
                        >
                            <ArrowUpDown className="w-4 h-4" />
                            {sortOrder === 'ASC' ? 'Oldest First' : 'Newest First'}
                        </button>
                    </div>
                </div>
            )}

            {view === 'DASHBOARD' && (
                <div className="animate-in fade-in duration-500">
                    <ImpactChart tasks={filteredTasks} />

                    <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <CheckSquare className="w-5 h-5 text-blue-500" /> Active Tasks
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {filteredTasks.map(task => (
                            <div
                                key={task.id}
                                onClick={() => { setTaskToEdit(task); setIsTaskModalOpen(true); }}
                                className={`bg-white p-5 rounded-xl shadow-sm border border-slate-200 hover:shadow-md hover:border-blue-300 transition-all cursor-pointer group flex flex-col justify-between h-full relative
                                ${task.status === TaskStatus.COMPLETED ? 'opacity-75 bg-slate-50' : ''}
                                ${task.status === TaskStatus.OVERDUE ? 'border-red-200 bg-red-50' : ''}
                                ${task.status === TaskStatus.POSTPONED ? 'border-slate-200 bg-slate-50 opacity-80' : ''}
                                ${task.status === TaskStatus.FAILED ? 'border-rose-200 bg-rose-50' : ''}`}
                            >
                                <div>
                                    <div className="flex justify-between items-start mb-3">
                                        <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider
                                            ${task.priority === Priority.CRITICAL ? 'bg-red-100 text-red-600' :
                                            task.priority === Priority.HIGH ? 'bg-orange-100 text-orange-600' :
                                            task.priority === Priority.LOW ? 'bg-green-100 text-green-600' :
                                            'bg-blue-100 text-blue-600'}`}>
                                            {task.priority}
                                        </span>
                                        {task.isRecurring && <div className="p-1 bg-slate-100 rounded text-slate-400"><ArrowUpDown className="w-3 h-3" /></div>}
                                    </div>
                                    <h3 className={`font-bold text-slate-800 mb-2 line-clamp-2 group-hover:text-blue-600 transition-colors
                                        ${task.status === TaskStatus.COMPLETED ? 'line-through text-slate-500' : ''}
                                        ${task.status === TaskStatus.FAILED ? 'line-through text-rose-800' : ''}`}>
                                        {task.title}
                                    </h3>
                                    <div className="flex items-center gap-2 mb-4">
                                        <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                            <div
                                                className={`h-full rounded-full
                                                ${task.status === TaskStatus.COMPLETED ? 'bg-green-500' :
                                                  task.status === TaskStatus.FAILED ? 'bg-rose-500' :
                                                  task.status === TaskStatus.POSTPONED ? 'bg-slate-400' :
                                                  'bg-blue-500'}`}
                                                style={{ width: `${task.subtasks.length > 0 ? Math.round((task.subtasks.filter(s => s.completed).length / task.subtasks.length) * 100) : 0}%` }}
                                            ></div>
                                        </div>
                                        <span className="text-xs text-slate-400 font-medium">
                                            {task.subtasks.length > 0 ? Math.round((task.subtasks.filter(s => s.completed).length / task.subtasks.length) * 100) : 0}%
                                        </span>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                                    <span className={`px-2 py-1 rounded text-xs font-bold uppercase
                                        ${task.status === TaskStatus.COMPLETED ? 'bg-green-100 text-green-700' :
                                          task.status === TaskStatus.IN_PROGRESS ? 'bg-amber-100 text-amber-700' :
                                          task.status === TaskStatus.REVIEW ? 'bg-purple-100 text-purple-700' :
                                          task.status === TaskStatus.OVERDUE ? 'bg-red-100 text-red-700' :
                                          task.status === TaskStatus.POSTPONED ? 'bg-slate-200 text-slate-600' :
                                          task.status === TaskStatus.FAILED ? 'bg-rose-950 text-rose-200' :
                                          'bg-slate-100 text-slate-600'}`}>
                                        {task.status.replace('_', ' ')}
                                    </span>
                                    <div className={`text-xs font-medium
                                        ${task.status === TaskStatus.OVERDUE ? 'text-red-600 font-bold' :
                                          task.status === TaskStatus.POSTPONED ? 'text-slate-500 italic' :
                                          task.status === TaskStatus.FAILED ? 'text-rose-600 font-bold' :
                                          'text-slate-400'}`}>
                                        {task.dueDate ? new Date(task.dueDate).toLocaleDateString('en-GB', {day:'numeric', month:'short', year:'numeric'}) : 'No Date'}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                    {filteredTasks.length === 0 && (
                        <div className="text-center py-20 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                            <p className="text-slate-500 font-medium">No tasks found matching filters.</p>
                            <button onClick={() => { setFilterStatus('ALL'); setFilterPriority('ALL'); setFilterDate('ALL'); }} className="mt-2 text-blue-600 text-sm hover:underline">Clear Filters</button>
                        </div>
                    )}
                </div>
            )}

            {view === 'TASKS' && (
                <div className="animate-in fade-in">
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                                <tr>
                                    <th className="p-4">Status</th>
                                    <th className="p-4">Updated</th>
                                    <th className="p-4">Task</th>
                                    <th className="p-4">Priority</th>
                                    <th className="p-4">Due Date</th>
                                    <th className="p-4">Impact</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredTasks.map(task => {
                                    const revenue = task.impactMetrics.find(m => m.type === 'Revenue');
                                    const lastStatusLog = task.activityLog
                                        ?.filter(l => l.action.toLowerCase().includes('status'))
                                        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
                                    const lastUpdatedDate = lastStatusLog ? new Date(lastStatusLog.timestamp) : new Date(task.createdAt);

                                    return (
                                    <tr
                                        key={task.id}
                                        onClick={() => { setTaskToEdit(task); setIsTaskModalOpen(true); }}
                                        className="hover:bg-slate-50 cursor-pointer transition-colors group"
                                    >
                                        <td className="p-4">
                                            <span className={`px-2 py-1 rounded text-xs font-bold uppercase
                                                ${task.status === TaskStatus.COMPLETED ? 'bg-green-100 text-green-700' :
                                                  task.status === TaskStatus.IN_PROGRESS ? 'bg-amber-100 text-amber-700' :
                                                  task.status === TaskStatus.REVIEW ? 'bg-purple-100 text-purple-700' :
                                                  task.status === TaskStatus.OVERDUE ? 'bg-red-100 text-red-700' :
                                                  task.status === TaskStatus.POSTPONED ? 'bg-slate-200 text-slate-600' :
                                                  task.status === TaskStatus.FAILED ? 'bg-rose-950 text-rose-200' :
                                                  'bg-slate-100 text-slate-600'}`}>
                                                {task.status.replace('_', ' ')}
                                            </span>
                                        </td>
                                        <td className="p-4 text-xs text-slate-500">
                                            {lastUpdatedDate.toLocaleDateString()}
                                        </td>
                                        <td className="p-4 font-medium text-slate-900 group-hover:text-blue-600">{task.title}</td>
                                        <td className="p-4">
                                            <div className={`flex items-center gap-1 text-xs font-bold
                                                ${task.priority === Priority.CRITICAL ? 'text-red-600' :
                                                  task.priority === Priority.HIGH ? 'text-orange-500' :
                                                  task.priority === Priority.LOW ? 'text-green-500' :
                                                  'text-blue-500'}`}>
                                                <div className={`w-2 h-2 rounded-full ${task.priority === Priority.CRITICAL ? 'bg-red-600' : task.priority === Priority.HIGH ? 'bg-orange-500' : task.priority === Priority.LOW ? 'bg-green-500' : 'bg-blue-500'}`}></div>
                                                {task.priority}
                                            </div>
                                        </td>
                                        <td className="p-4 text-slate-500">
                                            {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : '-'}
                                        </td>
                                        <td className="p-4">
                                            {revenue ? (
                                                <span className="text-green-600 font-bold text-xs bg-green-50 px-2 py-1 rounded">
                                                    +${(revenue.achievedValue || 0).toLocaleString()}
                                                </span>
                                            ) : '-'}
                                        </td>
                                    </tr>
                                )})}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {view === 'CALENDAR' && (
                <div className="animate-in fade-in">
                    <CalendarView tasks={filteredTasks} onTaskClick={(t) => { setTaskToEdit(t); setIsTaskModalOpen(true); }} />
                </div>
            )}

            {view === 'TIMELINE' && (
                <div className="animate-in fade-in">
                    <TimelineView tasks={filteredTasks} users={[currentUser]} onTaskClick={(t) => { setTaskToEdit(t); setIsTaskModalOpen(true); }} />
                </div>
            )}

            {view === 'SETTINGS' && (
                <div className="animate-in fade-in max-w-2xl mx-auto">
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
                        <h2 className="text-lg font-bold text-slate-800 mb-4">Profile</h2>
                        <div className="flex items-center gap-4 mb-4">
                            <div className="w-16 h-16 bg-slate-200 rounded-full flex items-center justify-center text-xl font-bold text-slate-600">
                                {currentUser.avatarInitials}
                            </div>
                            <div>
                                <p className="font-bold text-slate-800">{currentUser.name}</p>
                                <p className="text-sm text-slate-500">@{currentUser.username}</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {view === 'REPORTS' && (
                <SystemReport tasks={tasks} />
            )}

            {view === 'NOTIFICATIONS' && (
                <div className="max-w-2xl mx-auto space-y-4 animate-in fade-in">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-bold text-slate-800">Alerts & Reminders</h2>
                        {notifications.length > 0 && (
                            <button onClick={() => setMutedTaskIds([...mutedTaskIds, ...notifications.map(n => n.id)])} className="text-sm text-blue-600 hover:underline">
                                Mark all as read
                            </button>
                        )}
                    </div>
                    {notifications.length === 0 && (
                        <div className="text-center py-12 bg-white rounded-xl border border-slate-200 shadow-sm">
                            <Bell className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                            <p className="text-slate-500">You're all caught up! No urgent tasks.</p>
                        </div>
                    )}
                    {notifications.map(task => {
                         const isRead = mutedTaskIds.includes(task.id);
                         const isOverdue = task.status === TaskStatus.OVERDUE || (task.dueDate && new Date(task.dueDate) < new Date());

                         return (
                            <div key={task.id} className={`p-4 rounded-xl border flex items-start justify-between gap-4 transition-all ${isRead ? 'bg-slate-50 border-slate-200 opacity-60' : 'bg-white border-blue-100 shadow-sm'}`}>
                                <div className="flex items-start gap-3">
                                    <div className={`w-2 h-2 mt-2 rounded-full ${isOverdue ? 'bg-red-500' : 'bg-orange-500'}`}></div>
                                    <div>
                                        <h4 className="font-bold text-slate-800">{task.title}</h4>
                                        <p className="text-sm text-slate-500 mb-1">
                                            {isOverdue ? 'Overdue since' : 'Due on'} <span className="font-semibold">{task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'N/A'}</span>
                                        </p>
                                        <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${isOverdue ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'}`}>
                                            {isOverdue ? 'Overdue' : 'Due Soon'}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex flex-col items-end gap-2">
                                    <button onClick={() => { setTaskToEdit(task); setIsTaskModalOpen(true); }} className="px-3 py-1 bg-white border border-slate-300 rounded text-xs font-medium hover:bg-slate-50">
                                        View
                                    </button>
                                    {!isRead && (
                                        <button onClick={() => setMutedTaskIds([...mutedTaskIds, task.id])} className="text-xs text-slate-400 hover:text-blue-600 flex items-center gap-1">
                                            <Check className="w-3 h-3" /> Mark read
                                        </button>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
      </main>

      {/* Task Modal */}
      <TaskModal
        isOpen={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        onSave={handleSaveTask}
        taskToEdit={taskToEdit}
        allTasks={tasks}
        currentUser={currentUser}
      />

    </div>
  );
}
