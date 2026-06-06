import React, { useState, useMemo, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { TaskModal } from './components/TaskModal';
import { ProjectModal } from './components/ProjectModal';
import { ProjectsView } from './components/ProjectsView';
import { CalendarView } from './components/CalendarView';
import { TimelineView } from './components/TimelineView';
import { SystemReport } from './components/SystemReport';
import { AuthScreen } from './components/AuthScreen';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { DashboardView } from './components/DashboardView';
import { TasksView } from './components/TasksView';
import { NotificationsView } from './components/NotificationsView';
import { SettingsView } from './components/SettingsView';
import { Task, TaskStatus, Priority, User, ViewState, Project } from './types';
import { api } from './services/api';
import { AnalyticsService, trackEvent } from './services/analytics';

type Theme = 'light' | 'dark';

export const App: React.FC = () => {
  // --- AUTH & DATA STATE ---
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);

  // --- UI STATE ---
  const [view, setView] = useState<ViewState>('DASHBOARD');
  const [theme, setTheme] = useState<Theme>('light');

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

  // --- FILTER & SORT STATE ---
  const [filterStatus, setFilterStatus] = useState<TaskStatus | 'ALL'>('ALL');
  const [filterPriority, setFilterPriority] = useState<Priority | 'ALL'>('ALL');
  const [filterDate, setFilterDate] = useState<'ALL' | 'TODAY' | 'WEEK' | 'MONTH' | 'UPCOMING'>('UPCOMING');
  const [filterProject, setFilterProject] = useState<string>('ALL');
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('DESC');

  // Track filter changes
  useEffect(() => {
    if (currentUser && filterStatus !== 'ALL') trackEvent.filterApplied(`status:${filterStatus}`);
  }, [filterStatus, currentUser]);
  useEffect(() => {
    if (currentUser && filterPriority !== 'ALL') trackEvent.filterApplied(`priority:${filterPriority}`);
  }, [filterPriority, currentUser]);
  useEffect(() => {
    if (currentUser && filterDate !== 'ALL') trackEvent.filterApplied(`date:${filterDate}`);
  }, [filterDate, currentUser]);

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
        if (p.theme === 'light' || p.theme === 'dark') setTheme(p.theme);
        if (Array.isArray(p.muted)) setMutedTaskIds(p.muted);
      } catch (e) {
        console.error('Failed to load preferences', e);
      }
    }
  };

  // Save preferences whenever they change
  useEffect(() => {
    if (currentUser) {
      const prefs = {
        status: filterStatus,
        priority: filterPriority,
        date: filterDate,
        sort: sortOrder,
        theme,
        muted: mutedTaskIds,
      };
      localStorage.setItem(`impactflow_prefs_${currentUser.id}`, JSON.stringify(prefs));
    }
  }, [filterStatus, filterPriority, filterDate, sortOrder, theme, mutedTaskIds, currentUser]);

  // --- INITIALIZATION ---
  useEffect(() => {
    const init = async () => {
      const user = api.init();
      if (user) {
        try {
          const validUser = await api.getCurrentUser();
          setCurrentUser(validUser);
          if (validUser) loadUserPreferences(validUser.id);
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
      const [allTasks, allProjects] = await Promise.all([api.getTasks(), api.getProjects()]);

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
    if (currentUser) refreshData();
  }, [currentUser]);

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    localStorage.setItem('impactflow_current_user', JSON.stringify(user));
    setView('DASHBOARD');
    loadUserPreferences(user.id);
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

  const handleAccountDeleted = () => {
    trackEvent.logout();
    AnalyticsService.cleanup();
    setCurrentUser(null);
    setTasks([]);
    setProjects([]);
    setView('DASHBOARD');
    localStorage.clear();
  };

  // --- FILTERING LOGIC ---
  const filteredTasks = useMemo(() => {
    let result = [...tasks];

    if (filterStatus !== 'ALL') result = result.filter(t => t.status === filterStatus);
    if (filterPriority !== 'ALL') result = result.filter(t => t.priority === filterPriority);

    if (filterProject !== 'ALL') {
      if (filterProject === 'NONE') result = result.filter(t => !t.projectId);
      else result = result.filter(t => t.projectId === filterProject);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (filterDate === 'TODAY') {
      result = result.filter(t => {
        if (!t.dueDate) return false;
        const d = new Date(t.dueDate); d.setHours(0, 0, 0, 0);
        return d.getTime() === today.getTime();
      });
    } else if (filterDate === 'WEEK') {
      const nextWeek = new Date(today); nextWeek.setDate(today.getDate() + 7);
      result = result.filter(t => {
        if (!t.dueDate) return false;
        const d = new Date(t.dueDate);
        return d >= today && d <= nextWeek;
      });
    } else if (filterDate === 'MONTH') {
      const nextMonth = new Date(today); nextMonth.setMonth(today.getMonth() + 1);
      result = result.filter(t => {
        if (!t.dueDate) return false;
        const d = new Date(t.dueDate);
        return d >= today && d <= nextMonth;
      });
    } else if (filterDate === 'UPCOMING') {
      result = result.filter(t => {
        if (t.status === TaskStatus.OVERDUE) return true;
        if (filterStatus === 'ALL') {
          if (t.status === TaskStatus.COMPLETED) return false;
          if (t.status === TaskStatus.FAILED) return false;
        }
        return true;
      });
    }

    result.sort((a, b) => {
      const dateA = a.dueDate ? new Date(a.dueDate).getTime() : (sortOrder === 'ASC' ? 9999999999999 : 0);
      const dateB = b.dueDate ? new Date(b.dueDate).getTime() : (sortOrder === 'ASC' ? 9999999999999 : 0);
      return sortOrder === 'ASC' ? dateA - dateB : dateB - dateA;
    });

    return result;
  }, [tasks, filterStatus, filterPriority, filterProject, filterDate, sortOrder]);

  // --- NOTIFICATIONS LOGIC ---
  const notifications = useMemo(() => {
    const now = new Date();
    const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000);
    return tasks.filter(t => {
      if (t.status === TaskStatus.COMPLETED || t.status === TaskStatus.FAILED) return false;
      if (!t.dueDate) return false;
      const due = new Date(t.dueDate);
      return (due <= in48h && due >= now) || due < now;
    }).sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime());
  }, [tasks]);

  const unreadNotifications = notifications.filter(t => !mutedTaskIds.includes(t.id));

  // --- ACTIONS ---
  const handleSaveTask = async (updatedTask: Task) => {
    // Recurrence: if a recurring task is completed, spawn the next instance
    if (updatedTask.status === TaskStatus.COMPLETED && updatedTask.isRecurring && updatedTask.recurrenceConfig) {
      const config = updatedTask.recurrenceConfig;
      let nextStartDate = new Date(updatedTask.startDate || new Date());
      let nextDueDate = updatedTask.dueDate ? new Date(updatedTask.dueDate) : undefined;

      const addInterval = (date: Date) => {
        const d = new Date(date);
        if (config.frequency === 'DAILY') d.setDate(d.getDate() + config.interval);
        if (config.frequency === 'WEEKLY') d.setDate(d.getDate() + config.interval * 7);
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
        activityLog: [],
      };

      await api.createTask(nextTask);
    }

    const isExistingTask = updatedTask.id && tasks.some(t => t.id === updatedTask.id);
    if (isExistingTask) {
      await api.updateTask(updatedTask.id, updatedTask);
      trackEvent.taskUpdated(updatedTask.id);
      if (updatedTask.status === TaskStatus.COMPLETED) trackEvent.taskCompleted(updatedTask.id);
    } else {
      await api.createTask(updatedTask);
      if (updatedTask.id) trackEvent.taskCreated(updatedTask.id);
    }
    refreshData();
  };

  const handleSaveProject = async (updatedProject: Project) => {
    const isExistingProject = updatedProject.id && projects.some(p => p.id === updatedProject.id);
    if (isExistingProject) await api.updateProject(updatedProject.id, updatedProject);
    else await api.createProject(updatedProject);
    refreshData();
  };

  const handleToggleComplete = (task: Task) => {
    const completing = task.status !== TaskStatus.COMPLETED;
    handleSaveTask({
      ...task,
      status: completing ? TaskStatus.COMPLETED : TaskStatus.TODO,
      completedAt: completing ? new Date() : undefined,
    });
  };

  const openTask = (t: Task) => { setTaskToEdit(t); setIsTaskModalOpen(true); };
  const newTask = () => { setTaskToEdit(undefined); setIsTaskModalOpen(true); };
  const openProject = (p: Project) => { setProjectToEdit(p); setIsProjectModalOpen(true); };
  const newProject = () => { setProjectToEdit(undefined); setIsProjectModalOpen(true); };

  if (!currentUser) {
    return <AuthScreen onLogin={handleLogin} />;
  }

  const [title, subtitle] = ((): [string, string] => {
    switch (view) {
      case 'DASHBOARD': return ['Dashboard', `Portfolio overview · ${projects.length} project${projects.length === 1 ? '' : 's'} · ${tasks.length} task${tasks.length === 1 ? '' : 's'}`];
      case 'PROJECTS': return ['Projects', `${projects.length} project${projects.length === 1 ? '' : 's'}`];
      case 'TASKS': return ['Tasks', `${tasks.length} task${tasks.length === 1 ? '' : 's'} across your workspace`];
      case 'CALENDAR': return ['Calendar', 'Tasks and projects by date'];
      case 'TIMELINE': return ['Timeline', 'Roadmap for the weeks ahead'];
      case 'REPORTS': return ['Reports', 'Generate, schedule and explore performance'];
      case 'NOTIFICATIONS': return ['Notifications', 'Stay on top of due and overdue work'];
      case 'SETTINGS': return ['Settings', 'Manage your account and preferences'];
      default: return ['Impact Flow', ''];
    }
  })();

  const primary =
    view === 'PROJECTS' ? <button className="btn" onClick={newProject}><Plus className="w-4 h-4" /> New Project</button>
      : (view === 'TASKS' || view === 'CALENDAR') ? <button className="btn" onClick={newTask}><Plus className="w-4 h-4" /> New Task</button>
        : undefined;

  const filter = {
    filterStatus, setFilterStatus, filterPriority, setFilterPriority,
    filterDate, setFilterDate, filterProject, setFilterProject, sortOrder, setSortOrder,
  };

  return (
    <div className={'shell' + (isSidebarOpen ? ' sb-open' : '')} data-theme={theme}>
      <div className="sb-backdrop" onClick={() => setIsSidebarOpen(false)} />
      <Sidebar
        view={view}
        go={(v) => { setView(v); setIsSidebarOpen(false); }}
        user={currentUser}
        unreadCount={unreadNotifications.length}
        onLogout={handleLogout}
      />
      <div className="main">
        <TopBar
          title={title}
          subtitle={subtitle}
          theme={theme}
          onToggleTheme={() => setTheme(theme === 'light' ? 'dark' : 'light')}
          onBell={() => setView('NOTIFICATIONS')}
          onMenu={() => setIsSidebarOpen(true)}
          hasUnread={unreadNotifications.length > 0}
          primary={primary}
        />
        <div className="scroll">
          {view === 'DASHBOARD' && (
            <DashboardView
              tasks={filteredTasks}
              allTasks={tasks}
              projects={projects}
              onTaskClick={openTask}
              onProjectClick={openProject}
              goProjects={() => setView('PROJECTS')}
              filter={filter}
            />
          )}
          {view === 'TASKS' && (
            <TasksView tasks={filteredTasks} onTaskClick={openTask} onToggleComplete={handleToggleComplete} filter={filter} />
          )}
          {view === 'PROJECTS' && (
            <div className="body view-enter">
              <ProjectsView projects={projects} tasks={tasks} onProjectClick={openProject} onTaskClick={openTask} />
            </div>
          )}
          {view === 'CALENDAR' && (
            <div className="body view-enter">
              <CalendarView tasks={filteredTasks} projects={projects} onTaskClick={openTask} onProjectClick={openProject} />
            </div>
          )}
          {view === 'TIMELINE' && (
            <div className="body view-enter">
              <TimelineView tasks={filteredTasks} users={[currentUser]} projects={projects} onTaskClick={openTask} onProjectClick={openProject} />
            </div>
          )}
          {view === 'REPORTS' && (
            <div className="body view-enter">
              <SystemReport tasks={tasks} projects={projects} />
            </div>
          )}
          {view === 'NOTIFICATIONS' && (
            <NotificationsView
              notifications={notifications}
              mutedTaskIds={mutedTaskIds}
              onView={openTask}
              onMarkRead={(id) => setMutedTaskIds(prev => prev.includes(id) ? prev : [...prev, id])}
              onMarkAllRead={() => setMutedTaskIds(prev => Array.from(new Set([...prev, ...notifications.map(n => n.id)])))}
            />
          )}
          {view === 'SETTINGS' && (
            <SettingsView user={currentUser} theme={theme} onSetTheme={setTheme} onAccountDeleted={handleAccountDeleted} />
          )}
        </div>
      </div>

      <TaskModal
        isOpen={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        onSave={handleSaveTask}
        taskToEdit={taskToEdit}
        allTasks={tasks}
        projects={projects}
        currentUser={currentUser}
      />

      <ProjectModal
        isOpen={isProjectModalOpen}
        onClose={() => setIsProjectModalOpen(false)}
        onSave={handleSaveProject}
        projectToEdit={projectToEdit}
        currentUser={currentUser}
      />
    </div>
  );
};
