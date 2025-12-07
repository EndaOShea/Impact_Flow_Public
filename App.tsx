import React, { useState, useMemo, useEffect } from 'react';
import { 
  LayoutDashboard, CheckSquare, Plus, GitGraph, BarChart2, Calendar as CalendarIcon, 
  Settings, Bell, Search, Filter, ArrowUpDown, ChevronDown, Check, Menu, X, 
  LogOut, Building2, UserCircle, Briefcase 
} from 'lucide-react';
import { TaskModal } from './components/TaskModal';
import { ImpactChart } from './components/ImpactChart';
import { CalendarView } from './components/CalendarView';
import { TimelineView } from './components/TimelineView';
import { AdminPanel } from './components/AdminPanel';
import { SystemReport } from './components/SystemReport';
import { AuthScreen } from './components/AuthScreen';
import { Onboarding } from './components/Onboarding';
import { PlatformAdminPanel } from './components/PlatformAdminPanel';
import { Task, TaskStatus, Priority, User, UserRole, Team, ViewState, JoinRequest, Organization, WorkCategory } from './types';
import { api } from './services/api';

export const App: React.FC = () => {
  // --- AUTH & DATA STATE ---
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [orgName, setOrgName] = useState<string>('Impact Flow');

  // --- UI STATE ---
  const [view, setView] = useState<ViewState>('DASHBOARD');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [taskToEdit, setTaskToEdit] = useState<Task | undefined>(undefined);
  const [mutedTaskIds, setMutedTaskIds] = useState<string[]>([]);
  const [showCreateTeamModal, setShowCreateTeamModal] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');

  // --- FILTER & SORT STATE ---
  // Default Sort Order changed to DESC (Newest First)
  const [filterStatus, setFilterStatus] = useState<TaskStatus | 'ALL'>('ALL');
  const [filterPriority, setFilterPriority] = useState<Priority | 'ALL'>('ALL');
  const [filterDate, setFilterDate] = useState<'ALL' | 'TODAY' | 'WEEK' | 'MONTH' | 'UPCOMING'>('UPCOMING');
  const [filterAssignee, setFilterAssignee] = useState<string | 'ALL'>('ALL');
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
              if (p.assignee) setFilterAssignee(p.assignee);
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
              assignee: filterAssignee,
              sort: sortOrder
          };
          localStorage.setItem(`impactflow_prefs_${currentUser.id}`, JSON.stringify(prefs));
      }
  }, [filterStatus, filterPriority, filterDate, filterAssignee, sortOrder, currentUser]);

  // --- INITIALIZATION ---
  useEffect(() => {
    const init = async () => {
        const user = api.init();
        if (user) {
            try {
                // Verify session validity by fetching current user from API
                const validUser = await api.getCurrentUser();
                setCurrentUser(validUser);
                loadUserPreferences(validUser.id);
                refreshData(validUser);
            } catch (error) {
                console.error('Session validation failed:', error);
                api.logout();
                localStorage.removeItem('impactflow_current_user');
            }
        }
    };
    init();
  }, []);

  const refreshData = async (user: User = currentUser!) => {
    if (!user) return;

    try {
        // Set organization name from user object (comes from backend)
        if (user.organizationName) {
            setOrgName(user.organizationName);
        } else {
            setOrgName('Impact Flow');
        }

        // FETCH ALL DATA
        const [allTasks, allUsers, allTeams, allReqs, allOrgs] = await Promise.all([
            api.getTasks(),
            api.getUsers(),
            api.getTeams(),
            api.getJoinRequests().catch(err => {
                console.error('Failed to fetch join requests:', err);
                return []; // Return empty array on error
            }),
            api.getOrganizations().catch(err => {
                console.error('Failed to fetch organizations:', err);
                return []; // Return empty array on error
            })
        ]);

        console.log('DEBUG: Fetched join requests:', allReqs);
        console.log('DEBUG: User organizationId:', user.organizationId);
        console.log('DEBUG: User role:', user.role);

        const orgId = user.organizationId;

        // FILTER BY ORGANIZATION (Multi-Tenancy)
        if (user.role === UserRole.SYSTEM_ADMIN) return;

        const orgUsers = allUsers.filter(u => u.organizationId === orgId);
        const orgTeams = allTeams.filter(t => t.organizationId === orgId);

        // --- TASK VISIBILITY LOGIC ---
        let visibleTasks = allTasks.filter(t => t.organizationId === orgId);

        if (user.role === UserRole.OWNER || user.role === UserRole.ADMIN) {
            // 1. OWNERS / ORG ADMINS: See ALL tasks in the organization
        }
        else if (user.role === UserRole.TEAM_ADMIN) {
            // 2. TEAM ADMINS: See tasks assigned to themselves, tasks assigned to their team members, or tasks where they are admin
            const myTeamIds = user.teamIds || [];
            const usersInMyTeams = orgUsers
                .filter(u => u.teamIds.some(tid => myTeamIds.includes(tid)))
                .map(u => u.id);

            visibleTasks = visibleTasks.filter(t => {
                const isAssignedToMe = t.assigneeIds.includes(user.id);

                // Refined Visibility: Only see tasks in my team scope or assigned to me directly.
                // Hide tasks assigned to random users outside my team (even if I created them via generator)

                // Check if task is assigned to someone in my team (or unassigned and assigned to my team)
                const isAssignedToMyTeamUser = t.assigneeIds.some(aid => usersInMyTeams.includes(aid));
                const isAssignedToMyTeamDirectly = t.assignedTeamId ? myTeamIds.includes(t.assignedTeamId) : false;

                // Only allow admin access if the task falls within my scope
                const isRelevantAdmin = t.adminIds?.includes(user.id) && (
                    t.assigneeIds.length === 0 ||
                    t.assigneeIds.some(aid => usersInMyTeams.includes(aid) || aid === user.id)
                );

                return isAssignedToMe || isRelevantAdmin || isAssignedToMyTeamUser || isAssignedToMyTeamDirectly;
            });
        }
        else {
            // 3. STANDARD USERS: See only tasks assigned to them, created by them, or explicit admin
            visibleTasks = visibleTasks.filter(t => {
                const isAssignedToMe = t.assigneeIds.includes(user.id);
                const isCreator = t.creatorId === user.id;
                const isExplicitAdmin = t.adminIds?.includes(user.id);

                return isAssignedToMe || isCreator || isExplicitAdmin;
            });
        }

        // Auto-update OVERDUE status
        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];

        const processedTasks = visibleTasks.map(t => {
            // Only mark overdue if active. Failed and Postponed are considered handled states.
            if (t.status !== TaskStatus.COMPLETED && t.status !== TaskStatus.FAILED && t.status !== TaskStatus.POSTPONED && t.dueDate) {
                const dueStr = new Date(t.dueDate).toISOString().split('T')[0];
                if (dueStr < todayStr && t.status !== TaskStatus.OVERDUE) {
                    return { ...t, status: TaskStatus.OVERDUE };
                }
            }
            return t;
        });

        const orgReqs = allReqs.filter(r => r.organizationId === orgId);

        console.log('DEBUG: Filtered join requests for org:', orgReqs);
        console.log('DEBUG: Setting joinRequests state with', orgReqs.length, 'requests');

        setUsers(orgUsers);
        setTeams(orgTeams);
        setTasks(processedTasks);
        setJoinRequests(orgReqs);
    } catch (error) {
        console.error('Error refreshing data:', error);
    }
  };

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    localStorage.setItem('impactflow_current_user', JSON.stringify(user));
    
    if (user.role === UserRole.SYSTEM_ADMIN) {
        setView('PLATFORM_ADMIN');
    } else {
        setView('DASHBOARD');
        loadUserPreferences(user.id); 
        refreshData(user);
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('impactflow_current_user');
    setView('DASHBOARD');
    setOrgName('Impact Flow');
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

    // 3. Assignee Filter
    if (filterAssignee !== 'ALL') {
        result = result.filter(t => t.assigneeIds.includes(filterAssignee));
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
        // Show: Overdue OR (Active AND Future/NoDate) OR Postponed
        // Hide: Completed, Failed
        result = result.filter(t => {
            if (t.status === TaskStatus.OVERDUE) return true;
            if (t.status === TaskStatus.COMPLETED) return false; 
            if (t.status === TaskStatus.FAILED) return false; 
            // Show active/postponed tasks
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
  }, [tasks, filterStatus, filterPriority, filterDate, filterAssignee, sortOrder]);


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
         // Determine next date
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

    if (updatedTask.id) {
        await api.updateTask(updatedTask.id, updatedTask);
    } else {
        await api.createTask(updatedTask);
    }
    refreshData();
  };

  const handleCreateTeam = async () => {
      if(!newTeamName.trim() || !currentUser) return;
      const colors = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-orange-500', 'bg-pink-500'];
      const newTeam: Team = {
          id: crypto.randomUUID(),
          organizationId: currentUser.organizationId!,
          name: newTeamName,
          color: colors[Math.floor(Math.random() * colors.length)]
      };

      await api.createTeam(newTeam);

      const updatedUser = {
          ...currentUser,
          teamIds: [...currentUser.teamIds, newTeam.id],
          role: currentUser.role === UserRole.USER ? UserRole.ADMIN : currentUser.role
      };
      await api.updateUser(updatedUser.id, updatedUser);
      setCurrentUser(updatedUser);

      setNewTeamName('');
      setShowCreateTeamModal(false);
      refreshData(updatedUser);
  };

  const isWorkspaceAdmin = currentUser?.role === UserRole.ADMIN || currentUser?.role === UserRole.OWNER || currentUser?.role === UserRole.TEAM_ADMIN;

  if (!currentUser) {
    return <AuthScreen users={users} onLogin={handleLogin} />;
  }

  if (currentUser.role === UserRole.SYSTEM_ADMIN && view === 'PLATFORM_ADMIN') {
      return <PlatformAdminPanel currentUser={currentUser} onLogout={handleLogout} />;
  }
  
  if (currentUser.role !== UserRole.SYSTEM_ADMIN && !currentUser.organizationId) {
      return <Onboarding user={currentUser} onComplete={(u) => { setCurrentUser(u); refreshData(u); }} onLogout={handleLogout} />;
  }

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 font-sans overflow-hidden">
      
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
            className="fixed inset-0 bg-black/50 z-20 lg:hidden"
            onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-30 w-64 bg-slate-900 text-slate-300 transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0 flex flex-col
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center">
                <img
                    src={currentUser?.organizationBannerUrl || "/images/chart.png"}
                    alt="Organization Logo"
                    className="w-auto max-w-full object-contain"
                    style={{ height: '130.68px' }}
                />
            </div>
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
              
              {isWorkspaceAdmin && (
                  <button onClick={() => setView('ADMIN')} className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all ${view === 'ADMIN' ? 'bg-blue-600 text-white' : 'hover:bg-slate-800'}`}>
                    <div className="flex items-center gap-3"><Settings className="w-5 h-5" /> Org Admin</div>
                    {joinRequests.length > 0 && currentUser.role !== UserRole.TEAM_ADMIN && (
                        <span className="bg-amber-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{joinRequests.length}</span>
                    )}
                  </button>
              )}

              {!isWorkspaceAdmin && (
                  <button onClick={() => setShowCreateTeamModal(true)} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-800 text-slate-400">
                      <Plus className="w-5 h-5" /> Create Team
                  </button>
              )}
          </div>
        </nav>

        <div className="p-4 border-t border-slate-800">
            <div className="flex items-center gap-3 mb-4 px-2">
                <div className="w-10 h-10 bg-slate-700 rounded-full flex items-center justify-center font-bold text-white border-2 border-slate-600">
                    {currentUser.avatarInitials}
                </div>
                <div className="flex flex-col min-w-0">
                    <span className="font-bold text-white truncate">{currentUser.name}</span>
                    <span className="text-xs text-slate-500 truncate">{currentUser.role.replace('_', ' ')}</span>
                </div>
            </div>
            <button onClick={handleLogout} className="w-full py-2 bg-red-900/30 hover:bg-red-900/50 text-red-200 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors">
                <LogOut className="w-4 h-4" /> Sign Out
            </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 flex-shrink-0 z-10">
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
                 view === 'ADMIN' ? 'Organization Settings' :
                 view === 'REPORTS' ? 'System Reports' :
                 'Notifications'}
              </h1>
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Building2 className="w-3.5 h-3.5" />
                <span>{orgName}</span>
              </div>
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

        <div className="flex-1 overflow-y-auto p-4 lg:p-8">
            
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
                            value={filterAssignee}
                            onChange={(e) => setFilterAssignee(e.target.value)}
                            className="appearance-none bg-white border border-slate-200 text-black text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full px-4 py-2 pr-8 cursor-pointer font-medium"
                        >
                            <option value="ALL">Assignee: All</option>
                            {users.map(u => (
                                <option key={u.id} value={u.id}>{u.name}</option>
                            ))}
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
                        {filteredTasks.map(task => {
                            const assigneeId = task.assigneeIds && task.assigneeIds.length > 0 ? task.assigneeIds[0] : null;
                            const assignee = users.find(u => u.id === assigneeId);
                            const moreCount = task.assigneeIds && task.assigneeIds.length > 1 ? task.assigneeIds.length - 1 : 0;

                            return (
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
                                        <div className="flex items-center gap-2">
                                            <div className="flex -space-x-2">
                                                {assignee ? (
                                                    <div className="w-6 h-6 rounded-full bg-blue-100 border-2 border-white flex items-center justify-center text-[10px] font-bold text-blue-700" title={assignee.name}>
                                                        {assignee.avatarInitials}
                                                    </div>
                                                ) : (
                                                    <div className="w-6 h-6 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center text-[10px] text-slate-400">?</div>
                                                )}
                                                {moreCount > 0 && (
                                                    <div className="w-6 h-6 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center text-[9px] font-bold text-slate-500">+{moreCount}</div>
                                                )}
                                            </div>
                                            <span className="text-xs text-slate-500 truncate max-w-[80px]">
                                                {assignee ? assignee.name.split(' ')[0] : 'Unassigned'}
                                            </span>
                                        </div>
                                        <div className={`text-xs font-medium 
                                            ${task.status === TaskStatus.OVERDUE ? 'text-red-600 font-bold' : 
                                              task.status === TaskStatus.POSTPONED ? 'text-slate-500 italic' :
                                              task.status === TaskStatus.FAILED ? 'text-rose-600 font-bold' :
                                              'text-slate-400'}`}>
                                            {task.dueDate ? new Date(task.dueDate).toLocaleDateString('en-GB', {day:'numeric', month:'short', year:'numeric'}) : 'No Date'}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
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
                                    <th className="p-4">Assignees</th>
                                    <th className="p-4">Due Date</th>
                                    <th className="p-4">Impact</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredTasks.map(task => {
                                    const revenue = task.impactMetrics.find(m => m.type === 'Revenue');
                                    // Calculate last status change date, fallback to createdAt
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
                                        <td className="p-4">
                                            <div className="flex -space-x-2">
                                                {task.assigneeIds && task.assigneeIds.slice(0, 3).map(aid => {
                                                    const u = users.find(user => user.id === aid);
                                                    return (
                                                        <div key={aid} className="w-6 h-6 rounded-full bg-slate-200 border border-white flex items-center justify-center text-[9px] font-bold text-slate-600" title={u?.name}>
                                                            {u?.avatarInitials}
                                                        </div>
                                                    )
                                                })}
                                                {task.assigneeIds && task.assigneeIds.length > 3 && (
                                                    <div className="w-6 h-6 rounded-full bg-slate-100 border border-white flex items-center justify-center text-[9px] font-bold text-slate-500">+{task.assigneeIds.length - 3}</div>
                                                )}
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
                    <TimelineView tasks={filteredTasks} users={users} onTaskClick={(t) => { setTaskToEdit(t); setIsTaskModalOpen(true); }} />
                </div>
            )}
            
            {view === 'ADMIN' && isWorkspaceAdmin && (
                <div className="animate-in fade-in">
                    <AdminPanel
                        currentUser={currentUser}
                        users={users}
                        teams={teams}
                        joinRequests={joinRequests}
                        onAddUser={async (u, p) => { await api.createUser(u, p); refreshData(); }}
                        onRemoveUser={async (id) => { await api.deleteUser(id); refreshData(); }}
                        onUpdateUser={async (u) => { await api.updateUser(u.id, u); refreshData(); }}
                        onAddTeam={async (t) => { await api.createTeam(t); refreshData(); }}
                        onRemoveTeam={async (id) => { await api.deleteTeam(id); refreshData(); }}
                        onRefresh={() => refreshData()}
                    />
                </div>
            )}

            {view === 'REPORTS' && (
                <SystemReport tasks={tasks} users={users} teams={teams} />
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
        allTasks={tasks} // Pass all tasks for dependency selection
        currentUser={currentUser}
        users={users}
        teams={teams}
      />

      {/* Create Team Modal (Simple) */}
      {showCreateTeamModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
              <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-2xl">
                  <h3 className="text-lg font-bold mb-4">Create New Team</h3>
                  <input 
                      type="text" 
                      value={newTeamName} 
                      onChange={(e) => setNewTeamName(e.target.value)} 
                      placeholder="Team Name" 
                      className="w-full px-3 py-2 border border-slate-300 rounded mb-4 focus:ring-2 focus:ring-blue-500 outline-none bg-white text-black"
                  />
                  <div className="flex justify-end gap-2">
                      <button onClick={() => setShowCreateTeamModal(false)} className="px-4 py-2 text-slate-500 hover:bg-slate-100 rounded">Cancel</button>
                      <button onClick={handleCreateTeam} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Create</button>
                  </div>
              </div>
          </div>
      )}

    </div>
  );
}