import React, { useState, useMemo, useEffect } from 'react';
import {
  LayoutDashboard, CheckSquare, Plus, GitGraph, BarChart2, Calendar as CalendarIcon,
  Settings, Bell, Search, Filter, ArrowUpDown, ChevronDown, Check, Menu, X,
  LogOut, Activity, AlertTriangle, Trash2, Lock, Eye, EyeOff, Briefcase
} from 'lucide-react';
import { TaskModal } from './components/TaskModal';
import { ProjectModal } from './components/ProjectModal';
import { ProjectsView } from './components/ProjectsView';
import { ImpactChart } from './components/ImpactChart';
import { CalendarView } from './components/CalendarView';
import { TimelineView } from './components/TimelineView';
import { SystemReport } from './components/SystemReport';
import { AuthScreen } from './components/AuthScreen';
import { AnalyticsDashboard } from './components/AnalyticsDashboard';
import { Task, TaskStatus, Priority, User, ViewState, WorkCategory, Project } from './types';
import { api } from './services/api';
import { AnalyticsService, trackEvent } from './services/analytics';

export const App: React.FC = () => {
  // --- AUTH & DATA STATE ---
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);

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
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [projectToEdit, setProjectToEdit] = useState<Project | undefined>(undefined);
  const [mutedTaskIds, setMutedTaskIds] = useState<string[]>([]);
  const [isDeleteAccountModalOpen, setIsDeleteAccountModalOpen] = useState(false);
  const [deleteAccountPassword, setDeleteAccountPassword] = useState('');
  const [deleteAccountError, setDeleteAccountError] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordChangeError, setPasswordChangeError] = useState('');
  const [passwordChangeSuccess, setPasswordChangeSuccess] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // --- FILTER & SORT STATE ---
  const [filterStatus, setFilterStatus] = useState<TaskStatus | 'ALL'>('ALL');
  const [filterPriority, setFilterPriority] = useState<Priority | 'ALL'>('ALL');
  const [filterDate, setFilterDate] = useState<'ALL' | 'TODAY' | 'WEEK' | 'MONTH' | 'UPCOMING'>('UPCOMING');
  const [filterProject, setFilterProject] = useState<string>('ALL');

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
        const [allTasks, allProjects] = await Promise.all([
            api.getTasks(),
            api.getProjects()
        ]);

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
        setProjects(allProjects);
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
    setProjects([]);
  };

  const handleDeleteAccount = async () => {
    if (!deleteAccountPassword) {
      setDeleteAccountError('Password is required');
      return;
    }

    try {
      setDeleteAccountError('');
      await api.deleteAccount(deleteAccountPassword);

      // Track account deletion
      trackEvent.logout();
      AnalyticsService.cleanup();

      // Clear all local data
      setCurrentUser(null);
      setTasks([]);
      setProjects([]);
      setView('DASHBOARD');
      localStorage.clear();

      // Close modal
      setIsDeleteAccountModalOpen(false);
      setDeleteAccountPassword('');
    } catch (error: any) {
      setDeleteAccountError(error.message || 'Failed to delete account');
    }
  };

  const handleChangePassword = async () => {
    setPasswordChangeError('');
    setPasswordChangeSuccess(false);

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordChangeError('All fields are required');
      return;
    }

    if (newPassword.length < 8) {
      setPasswordChangeError('New password must be at least 8 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordChangeError('New passwords do not match');
      return;
    }

    try {
      await api.changePassword(currentPassword, newPassword);
      setPasswordChangeSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordChangeSuccess(false), 3000);
    } catch (error: any) {
      setPasswordChangeError(error.message || 'Failed to change password');
    }
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

    // 3. Project Filter
    if (filterProject !== 'ALL') {
        if (filterProject === 'NONE') {
            result = result.filter(t => !t.projectId);
        } else {
            result = result.filter(t => t.projectId === filterProject);
        }
    }

    // 4. Date Filter
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

    // 5. Sorting
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
  }, [tasks, filterStatus, filterPriority, filterProject, filterDate, sortOrder]);

  // Standalone tasks (not associated with any project) - for Tasks view
  const standaloneTasks = useMemo(() => {
    return filteredTasks.filter(t => !t.projectId);
  }, [filteredTasks]);


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

  const handleSaveProject = async (updatedProject: Project) => {
    const isExistingProject = updatedProject.id && projects.some(p => p.id === updatedProject.id);

    if (isExistingProject) {
        await api.updateProject(updatedProject.id, updatedProject);
    } else {
        await api.createProject(updatedProject);
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
          <button onClick={() => setView('PROJECTS')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${view === 'PROJECTS' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'hover:bg-slate-800'}`}>
            <Briefcase className="w-5 h-5" /> Projects
          </button>
          <button onClick={() => setView('TASKS')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${view === 'TASKS' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'hover:bg-slate-800'}`}>
            <CheckSquare className="w-5 h-5" /> Tasks
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
                 view === 'PROJECTS' ? 'Projects' :
                 view === 'TASKS' ? 'Tasks' :
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
             {view === 'PROJECTS' ? (
               <button
                  onClick={() => { setProjectToEdit(undefined); setIsProjectModalOpen(true); }}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium shadow-md shadow-blue-600/20 transition-all active:scale-95"
              >
                  <Plus className="w-4 h-4" />
                  <span className="hidden sm:inline">New Project</span>
              </button>
             ) : (
               <button
                  onClick={() => { setTaskToEdit(undefined); setIsTaskModalOpen(true); }}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium shadow-md shadow-blue-600/20 transition-all active:scale-95"
              >
                  <Plus className="w-4 h-4" />
                  <span className="hidden sm:inline">New Task</span>
              </button>
             )}
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

                    {view === 'DASHBOARD' && (
                        <div className="relative group">
                            <select
                                value={filterProject}
                                onChange={(e) => setFilterProject(e.target.value)}
                                className="appearance-none bg-white border border-slate-200 text-black text-sm rounded-lg focus:ring-purple-500 focus:border-purple-500 block w-full px-4 py-2 pr-8 cursor-pointer font-medium"
                            >
                                <option value="ALL">Project: All</option>
                                <option value="NONE">No Project</option>
                                {projects.map(p => (
                                    <option key={p.id} value={p.id}>{p.title}</option>
                                ))}
                            </select>
                            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                        </div>
                    )}

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

                    {/* Active Projects Section */}
                    {projects.length > 0 && (
                        <div className="mb-8">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                    <Briefcase className="w-5 h-5 text-purple-500" /> Active Projects
                                </h2>
                                <button
                                    onClick={() => setView('PROJECTS')}
                                    className="text-sm text-blue-600 hover:underline font-medium"
                                >
                                    View All Projects
                                </button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                {projects
                                    .filter(p => p.status !== 'COMPLETED' && p.status !== 'CANCELLED')
                                    .slice(0, 4)
                                    .map(project => {
                                        const projectTasks = tasks.filter(t => t.projectId === project.id);
                                        const completedTasks = projectTasks.filter(t => t.status === TaskStatus.COMPLETED).length;
                                        const totalTasks = projectTasks.length;
                                        const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

                                        return (
                                            <div
                                                key={project.id}
                                                onClick={() => { setProjectToEdit(project); setIsProjectModalOpen(true); }}
                                                className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 hover:shadow-md hover:border-purple-300 transition-all cursor-pointer group"
                                            >
                                                <div className="flex items-start justify-between mb-3">
                                                    <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                                        <Briefcase className="w-5 h-5 text-purple-600" />
                                                    </div>
                                                    <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider
                                                        ${project.status === 'ACTIVE' ? 'bg-green-100 text-green-600' :
                                                          project.status === 'PLANNING' ? 'bg-blue-100 text-blue-600' :
                                                          project.status === 'ON_HOLD' ? 'bg-orange-100 text-orange-600' :
                                                          'bg-slate-100 text-slate-600'}`}>
                                                        {project.status.replace('_', ' ')}
                                                    </span>
                                                </div>
                                                <h3 className="font-bold text-slate-800 mb-2 line-clamp-1 group-hover:text-purple-600 transition-colors">
                                                    {project.title}
                                                </h3>
                                                {project.description && (
                                                    <p className="text-xs text-slate-500 mb-3 line-clamp-2">{project.description}</p>
                                                )}
                                                <div className="flex items-center gap-2 mb-2">
                                                    <div className="flex-1 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                                        <div
                                                            className="h-full bg-purple-500 rounded-full transition-all"
                                                            style={{ width: `${progress}%` }}
                                                        ></div>
                                                    </div>
                                                    <span className="text-xs text-slate-400 font-medium">{progress}%</span>
                                                </div>
                                                <div className="text-xs text-slate-400">
                                                    {totalTasks} {totalTasks === 1 ? 'task' : 'tasks'} · {completedTasks} done
                                                </div>
                                            </div>
                                        );
                                    })}
                            </div>
                            {projects.filter(p => p.status !== 'COMPLETED' && p.status !== 'CANCELLED').length === 0 && (
                                <div className="text-center py-8 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                                    <Briefcase className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                                    <p className="text-slate-500 text-sm">No active projects</p>
                                </div>
                            )}
                        </div>
                    )}

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
                                {standaloneTasks.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="p-8 text-center text-slate-400">
                                            No standalone tasks found. Tasks associated with projects appear in the Projects tab.
                                        </td>
                                    </tr>
                                ) : standaloneTasks.map(task => {
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
                                                    +€{(revenue.achievedValue || 0).toLocaleString()}
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

            {view === 'PROJECTS' && (
                <div className="animate-in fade-in">
                    <ProjectsView
                        projects={projects}
                        tasks={tasks}
                        onProjectClick={(p) => { setProjectToEdit(p); setIsProjectModalOpen(true); }}
                        onTaskClick={(t) => { setTaskToEdit(t); setIsTaskModalOpen(true); }}
                    />
                </div>
            )}

            {view === 'CALENDAR' && (
                <div className="animate-in fade-in">
                    <CalendarView
                        tasks={filteredTasks}
                        projects={projects}
                        onTaskClick={(t) => { setTaskToEdit(t); setIsTaskModalOpen(true); }}
                        onProjectClick={(p) => { setProjectToEdit(p); setIsProjectModalOpen(true); }}
                    />
                </div>
            )}

            {view === 'TIMELINE' && (
                <div className="animate-in fade-in">
                    <TimelineView
                        tasks={filteredTasks}
                        users={[currentUser]}
                        projects={projects}
                        onTaskClick={(t) => { setTaskToEdit(t); setIsTaskModalOpen(true); }}
                        onProjectClick={(p) => { setProjectToEdit(p); setIsProjectModalOpen(true); }}
                    />
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

                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
                        <div className="flex items-center gap-3 mb-4">
                            <Lock className="w-5 h-5 text-slate-600" />
                            <h2 className="text-lg font-bold text-slate-800">Change Password</h2>
                        </div>

                        {passwordChangeSuccess && (
                            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-4 flex items-center gap-2">
                                <Check className="w-4 h-4" />
                                Password changed successfully!
                            </div>
                        )}

                        {passwordChangeError && (
                            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
                                {passwordChangeError}
                            </div>
                        )}

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Current Password</label>
                                <div className="relative">
                                    <input
                                        type={showCurrentPassword ? 'text' : 'password'}
                                        value={currentPassword}
                                        onChange={(e) => setCurrentPassword(e.target.value)}
                                        className="w-full px-3 py-2 pr-10 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        placeholder="Enter current password"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                    >
                                        {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">New Password</label>
                                <div className="relative">
                                    <input
                                        type={showNewPassword ? 'text' : 'password'}
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        className="w-full px-3 py-2 pr-10 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        placeholder="Enter new password (min 8 characters)"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowNewPassword(!showNewPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                    >
                                        {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Confirm New Password</label>
                                <div className="relative">
                                    <input
                                        type={showConfirmPassword ? 'text' : 'password'}
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleChangePassword()}
                                        className="w-full px-3 py-2 pr-10 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        placeholder="Confirm new password"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                    >
                                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>

                            <button
                                onClick={handleChangePassword}
                                className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                            >
                                Update Password
                            </button>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl shadow-sm border border-red-200 p-6">
                        <div className="flex items-start gap-3 mb-4">
                            <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
                            <div>
                                <h2 className="text-lg font-bold text-slate-800 mb-1">Danger Zone</h2>
                                <p className="text-sm text-slate-600">Irreversible actions that will permanently affect your account.</p>
                            </div>
                        </div>

                        <div className="border-t border-slate-200 pt-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="font-semibold text-slate-800">Delete Account</h3>
                                    <p className="text-sm text-slate-600">Permanently delete your account and all associated data.</p>
                                </div>
                                <button
                                    onClick={() => setIsDeleteAccountModalOpen(true)}
                                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
                                >
                                    <Trash2 className="w-4 h-4" />
                                    Delete Account
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {view === 'REPORTS' && (
                <SystemReport tasks={tasks} projects={projects} />
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
        projects={projects}
        currentUser={currentUser}
      />

      {/* Project Modal */}
      <ProjectModal
        isOpen={isProjectModalOpen}
        onClose={() => setIsProjectModalOpen(false)}
        onSave={handleSaveProject}
        projectToEdit={projectToEdit}
        currentUser={currentUser}
      />

      {/* Delete Account Modal */}
      {isDeleteAccountModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 animate-in fade-in">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-800">Delete Account</h2>
                <p className="text-sm text-slate-600 mt-1">This action cannot be undone. All your data will be permanently deleted.</p>
              </div>
            </div>

            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <h3 className="font-semibold text-red-800 mb-2">What will be deleted:</h3>
              <ul className="text-sm text-red-700 space-y-1">
                <li>• All tasks and subtasks</li>
                <li>• All comments and attachments</li>
                <li>• All analytics and activity logs</li>
                <li>• Your profile and account settings</li>
              </ul>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Enter your password to confirm:
              </label>
              <input
                type="password"
                value={deleteAccountPassword}
                onChange={(e) => setDeleteAccountPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleDeleteAccount()}
                placeholder="Your password"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                autoFocus
              />
              {deleteAccountError && (
                <p className="text-sm text-red-600 mt-2">{deleteAccountError}</p>
              )}
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setIsDeleteAccountModalOpen(false);
                  setDeleteAccountPassword('');
                  setDeleteAccountError('');
                }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium flex items-center gap-2 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Delete My Account
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
