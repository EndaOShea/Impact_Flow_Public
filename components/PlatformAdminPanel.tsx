



import React, { useState, useEffect } from 'react';
import { User, Team, Task, SupportTicket, UserRole, Organization } from '../types';
import { Users, Briefcase, Activity, Server, Shield, MessageSquare, CheckCircle, BarChart2, Plus, Trash, ShieldAlert, AlertCircle, Search, Settings, Database, Lock, LogOut } from 'lucide-react';
import { db } from '../services/db';
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts';

interface PlatformAdminPanelProps {
  currentUser: User;
  onLogout: () => void;
}

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export const PlatformAdminPanel: React.FC<PlatformAdminPanelProps> = ({ currentUser, onLogout }) => {
  const [activeView, setActiveView] = useState<'OVERVIEW' | 'USERS' | 'TEAMS' | 'TICKETS' | 'SYSTEM'>('OVERVIEW');
  
  // Data State
  const [users, setUsers] = useState<User[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [taskCount, setTaskCount] = useState<number>(0); // Only store count, not content
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  
  // User Management State
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<UserRole>(UserRole.USER);
  const [userError, setUserError] = useState('');

  // Team Mgmt State
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamOrgId, setNewTeamOrgId] = useState('');

  useEffect(() => {
    refreshData();
  }, []);

  const refreshData = async () => {
    // We fetch tasks ONLY to count them for system load monitoring.
    // The actual content is not stored in a way that can be rendered to the admin.
    const [u, tm, tk, tix, o] = await Promise.all([
        db.getUsers(),
        db.getTeams(),
        db.getTasks(),
        db.getTickets(),
        db.getOrganizations()
    ]);
    // Filter out System Admin from list so they can't delete themselves or see themselves in user list
    setUsers(u.filter(user => user.role !== UserRole.SYSTEM_ADMIN));
    setTeams(tm);
    setTaskCount(tk.length); 
    setTickets(tix);
    setOrgs(o);
    
    // Initialize default org for team creation if needed
    if (!newTeamOrgId && o.length > 0) {
        setNewTeamOrgId(o[0].id);
    }
  };

  const handleResolveTicket = async (id: string) => {
      await db.resolveTicket(id);
      refreshData();
  };

  const handleCreateUser = async () => {
    setUserError('');
    if (!newUserName || !newUserEmail || !newUserPassword) return;

    if (!PASSWORD_REGEX.test(newUserPassword)) {
        setUserError('Password too weak (Min 8 chars, 1 upper, 1 lower, 1 number, 1 symbol)');
        return;
    }

    const initials = newUserName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    
    const userPayload: Partial<User> = {
      username: newUserName.toLowerCase().replace(/\s/g, ''),
      name: newUserName,
      email: newUserEmail,
      role: newUserRole,
      avatarInitials: initials,
    };

    try {
        await db.createUser(userPayload, newUserPassword);
        setNewUserName('');
        setNewUserEmail('');
        setNewUserPassword('');
        refreshData();
    } catch (e: any) {
        setUserError(e.message);
    }
  };

  const handleDeleteUser = async (id: string) => {
      if (confirm('Are you sure? This cannot be undone.')) {
          await db.deleteUser(id);
          refreshData();
      }
  };

  const handleToggleAdmin = async (user: User) => {
      const newRole = user.role === UserRole.ADMIN ? UserRole.USER : UserRole.ADMIN;
      await db.updateUser({ ...user, role: newRole });
      refreshData();
  };

  const handleCreateTeam = async () => {
    if (!newTeamName || !newTeamOrgId) return;
    const colors = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-orange-500', 'bg-pink-500'];
    await db.createTeam({
      id: crypto.randomUUID(),
      organizationId: newTeamOrgId,
      name: newTeamName,
      color: colors[Math.floor(Math.random() * colors.length)]
    });
    setNewTeamName('');
    refreshData();
  };

  const handleDeleteTeam = async (id: string) => {
    await db.deleteTeam(id);
    refreshData();
  };

  // --- STATS CALCULATION ---
  const stats = {
      totalUsers: users.length,
      activeTeams: teams.length,
      totalTasks: taskCount, // Count only
      openTickets: tickets.filter(t => t.status === 'OPEN').length,
      resolvedTickets: tickets.filter(t => t.status === 'RESOLVED').length,
      storageUsed: '2.4 GB', // Mock
      uptime: '99.98%'
  };

  // Chart Data: Users per Team
  const teamDistribution = teams.map(t => ({
      name: t.name,
      value: users.filter(u => u.teamIds.includes(t.id)).length
  }));

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans flex">
      {/* Sidebar */}
      <div className="w-64 bg-slate-950 border-r border-slate-800 flex flex-col">
          <div className="p-6 border-b border-slate-800 flex items-center gap-2">
              <Shield className="w-6 h-6 text-purple-500" />
              <div className="flex flex-col">
                <span className="font-bold text-base leading-tight">Platform Admin</span>
                <span className="text-[10px] text-slate-500">System Control</span>
              </div>
          </div>
          
          <nav className="flex-1 p-4 space-y-2">
              <button onClick={() => setActiveView('OVERVIEW')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${activeView === 'OVERVIEW' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}>
                  <Activity className="w-5 h-5" /> Monitor
              </button>
              <button onClick={() => setActiveView('USERS')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${activeView === 'USERS' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}>
                  <Users className="w-5 h-5" /> User Base
              </button>
              <button onClick={() => setActiveView('TEAMS')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${activeView === 'TEAMS' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}>
                  <Briefcase className="w-5 h-5" /> Teams
              </button>
              <button onClick={() => setActiveView('TICKETS')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${activeView === 'TICKETS' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}>
                  <MessageSquare className="w-5 h-5" /> Support Desk
                  {stats.openTickets > 0 && <span className="ml-auto bg-red-500 text-white text-xs px-2 rounded-full">{stats.openTickets}</span>}
              </button>
              <button onClick={() => setActiveView('SYSTEM')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${activeView === 'SYSTEM' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}>
                  <Settings className="w-5 h-5" /> System Config
              </button>
          </nav>

          <div className="p-4 border-t border-slate-800">
              <button onClick={onLogout} className="w-full py-2 bg-red-900/50 hover:bg-red-900 rounded text-sm font-medium text-red-200 flex items-center justify-center gap-2">
                  <LogOut className="w-4 h-4"/> Log Out
              </button>
          </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto bg-slate-900 p-8">
          
          {activeView === 'OVERVIEW' && (
              <div className="space-y-8 animate-in fade-in">
                  <div className="flex justify-between items-center">
                    <h1 className="text-3xl font-bold">Platform Monitor</h1>
                    <div className="flex items-center gap-2 text-sm text-green-400 bg-green-900/30 px-3 py-1 rounded-full border border-green-800">
                        <Activity className="w-4 h-4" /> Systems Operational
                    </div>
                  </div>
                  
                  {/* High Level Metrics - Privacy Safe */}
                  <div className="grid grid-cols-4 gap-6">
                      <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 relative overflow-hidden">
                          <div className="absolute top-0 right-0 p-4 opacity-10"><Users className="w-16 h-16" /></div>
                          <h3 className="text-slate-400 text-xs font-bold uppercase mb-2">Registered Users</h3>
                          <p className="text-3xl font-bold">{stats.totalUsers}</p>
                      </div>
                      <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 relative overflow-hidden">
                          <div className="absolute top-0 right-0 p-4 opacity-10"><Database className="w-16 h-16" /></div>
                          <h3 className="text-slate-400 text-xs font-bold uppercase mb-2">Total DB Records</h3>
                          <p className="text-3xl font-bold">{stats.totalTasks}</p>
                          <p className="text-xs text-slate-500 mt-1">Encrypted Tasks Stored</p>
                      </div>
                      <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 relative overflow-hidden">
                          <div className="absolute top-0 right-0 p-4 opacity-10"><MessageSquare className="w-16 h-16" /></div>
                          <h3 className="text-slate-400 text-xs font-bold uppercase mb-2">Support Queue</h3>
                          <p className="text-3xl font-bold flex items-center gap-2">
                              {stats.openTickets} <span className="text-sm font-normal text-slate-500">pending</span>
                          </p>
                      </div>
                       <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 relative overflow-hidden">
                          <div className="absolute top-0 right-0 p-4 opacity-10"><Server className="w-16 h-16" /></div>
                          <h3 className="text-slate-400 text-xs font-bold uppercase mb-2">Server Uptime</h3>
                          <p className="text-3xl font-bold text-green-400">{stats.uptime}</p>
                      </div>
                  </div>

                  {/* System Health Charts - No Business Data */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                      <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
                          <h3 className="font-bold text-lg mb-6 flex items-center gap-2">
                              <BarChart2 className="w-5 h-5 text-blue-500" /> User Distribution by Team
                          </h3>
                          <div className="h-64">
                             <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={teamDistribution} layout="vertical" margin={{ left: 20 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#334155" />
                                    <XAxis type="number" hide />
                                    <YAxis dataKey="name" type="category" width={100} tick={{fill: '#94a3b8', fontSize: 12}} />
                                    <Tooltip contentStyle={{backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc'}} />
                                    <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={20} />
                                </BarChart>
                             </ResponsiveContainer>
                          </div>
                      </div>

                      <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
                           <h3 className="font-bold text-lg mb-6 flex items-center gap-2">
                              <Shield className="w-5 h-5 text-purple-500" /> Support Resolution Status
                          </h3>
                          <div className="h-64 flex items-center justify-center">
                             <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={[
                                            { name: 'Resolved', value: stats.resolvedTickets },
                                            { name: 'Open', value: stats.openTickets }
                                        ]}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        <Cell key="cell-resolved" fill="#10b981" />
                                        <Cell key="cell-open" fill="#ef4444" />
                                    </Pie>
                                    <Tooltip contentStyle={{backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc'}} />
                                    <Legend />
                                </PieChart>
                             </ResponsiveContainer>
                          </div>
                      </div>
                  </div>
              </div>
          )}

          {activeView === 'USERS' && (
              <div className="space-y-8 animate-in fade-in">
                  <div className="flex justify-between items-center">
                    <h1 className="text-3xl font-bold">User Database</h1>
                  </div>

                  <div className="grid grid-cols-3 gap-8">
                      {/* Add User */}
                      <div className="col-span-1 bg-slate-800 p-6 rounded-xl border border-slate-700 h-fit">
                          <h3 className="text-lg font-bold mb-4">Provision New User</h3>
                          {userError && <div className="mb-4 bg-red-900/50 text-red-200 p-2 rounded text-xs flex items-center gap-1"><AlertCircle className="w-3 h-3"/> {userError}</div>}
                          <div className="space-y-3">
                              <input className="w-full bg-white border border-slate-300 rounded p-2 text-sm text-slate-900 focus:border-purple-500 outline-none" placeholder="Full Name" value={newUserName} onChange={e => setNewUserName(e.target.value)} />
                              <input className="w-full bg-white border border-slate-300 rounded p-2 text-sm text-slate-900 focus:border-purple-500 outline-none" placeholder="Email" value={newUserEmail} onChange={e => setNewUserEmail(e.target.value)} />
                              <input className="w-full bg-white border border-slate-300 rounded p-2 text-sm text-slate-900 focus:border-purple-500 outline-none" type="password" placeholder="Temporary Password" value={newUserPassword} onChange={e => setNewUserPassword(e.target.value)} />
                              <select className="w-full bg-white border border-slate-300 rounded p-2 text-sm text-slate-900 focus:border-purple-500 outline-none" value={newUserRole} onChange={(e) => setNewUserRole(e.target.value as UserRole)}>
                                  <option value={UserRole.USER}>Standard User</option>
                                  <option value={UserRole.ADMIN}>Workspace Admin</option>
                              </select>
                              <button onClick={handleCreateUser} className="w-full py-2 bg-purple-600 hover:bg-purple-700 rounded font-medium flex items-center justify-center gap-2">
                                  <Plus className="w-4 h-4" /> Create User
                              </button>
                          </div>
                      </div>

                      {/* User List */}
                      <div className="col-span-2 space-y-3">
                          {users.map(u => (
                              <div key={u.id} className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex justify-between items-center">
                                  <div className="flex items-center gap-3">
                                      <div className="w-10 h-10 bg-slate-700 rounded-full flex items-center justify-center font-bold">{u.avatarInitials}</div>
                                      <div>
                                          <p className="font-bold">{u.name}</p>
                                          <p className="text-xs text-slate-400">@{u.username} • {u.role}</p>
                                      </div>
                                  </div>
                                  <div className="flex gap-2">
                                      <button onClick={() => handleToggleAdmin(u)} className="p-2 bg-slate-700 hover:bg-purple-900/50 text-slate-400 hover:text-purple-400 rounded" title="Toggle Admin">
                                          {u.role === UserRole.ADMIN ? <ShieldAlert className="w-4 h-4" /> : <Shield className="w-4 h-4" />}
                                      </button>
                                      <button onClick={() => handleDeleteUser(u.id)} className="p-2 bg-slate-700 hover:bg-red-900/50 text-slate-400 hover:text-red-400 rounded" title="Delete User">
                                          <Trash className="w-4 h-4" />
                                      </button>
                                  </div>
                              </div>
                          ))}
                      </div>
                  </div>
              </div>
          )}

          {activeView === 'TICKETS' && (
              <div className="space-y-6 animate-in fade-in">
                  <h1 className="text-3xl font-bold">Support Queries</h1>
                  <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                      <table className="w-full text-left text-sm">
                          <thead className="bg-slate-950 text-slate-400 uppercase font-bold">
                              <tr>
                                  <th className="p-4">User</th>
                                  <th className="p-4">Subject</th>
                                  <th className="p-4">Message</th>
                                  <th className="p-4">Status</th>
                                  <th className="p-4">Action</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-700">
                              {tickets.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-slate-500">No support tickets found.</td></tr>}
                              {tickets.map(t => (
                                  <tr key={t.id} className="hover:bg-slate-700/50">
                                      <td className="p-4 font-bold">{users.find(u => u.id === t.userId)?.name || 'Unknown'}</td>
                                      <td className="p-4 text-purple-300">{t.subject}</td>
                                      <td className="p-4 text-slate-400">{t.message}</td>
                                      <td className="p-4">
                                          <span className={`px-2 py-1 rounded text-xs font-bold ${t.status === 'RESOLVED' ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'}`}>
                                              {t.status}
                                          </span>
                                      </td>
                                      <td className="p-4">
                                          {t.status === 'OPEN' && (
                                              <button onClick={() => handleResolveTicket(t.id)} className="flex items-center gap-1 text-green-400 hover:underline">
                                                  <CheckCircle className="w-4 h-4" /> Resolve
                                              </button>
                                          )}
                                      </td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                  </div>
              </div>
          )}

          {activeView === 'SYSTEM' && (
              <div className="space-y-8 animate-in fade-in">
                  <h1 className="text-3xl font-bold">System Configuration</h1>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                       <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
                           <h3 className="font-bold mb-4 flex items-center gap-2"><Lock className="w-4 h-4 text-slate-400"/> Security Policies</h3>
                           <div className="space-y-4">
                               <div className="flex items-center justify-between">
                                   <span className="text-sm text-slate-400">Password Complexity</span>
                                   <span className="text-sm font-mono bg-slate-900 px-2 py-1 rounded border border-slate-600">High (Argon2)</span>
                               </div>
                               <div className="flex items-center justify-between">
                                   <span className="text-sm text-slate-400">Session Timeout</span>
                                   <span className="text-sm font-mono bg-slate-900 px-2 py-1 rounded border border-slate-600">60 mins</span>
                               </div>
                               <div className="flex items-center justify-between">
                                   <span className="text-sm text-slate-400">Recovery Keys</span>
                                   <span className="text-sm font-mono bg-slate-900 px-2 py-1 rounded border border-slate-600">Enabled</span>
                               </div>
                           </div>
                       </div>
                       
                       <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
                           <h3 className="font-bold mb-4 flex items-center gap-2"><Database className="w-4 h-4 text-slate-400"/> Data Management</h3>
                           <div className="space-y-4">
                               <div className="flex items-center justify-between">
                                   <span className="text-sm text-slate-400">Total Storage</span>
                                   <span className="text-sm text-white">2.4 GB / 5 TB</span>
                               </div>
                               <div className="w-full bg-slate-700 rounded-full h-2">
                                   <div className="bg-blue-500 h-2 rounded-full w-[1%]"></div>
                               </div>
                               <div className="pt-4">
                                   <button className="text-xs text-red-400 hover:text-red-300 border border-red-900 bg-red-950/30 px-3 py-2 rounded">
                                       Flush Temp Cache
                                   </button>
                               </div>
                           </div>
                       </div>
                  </div>
              </div>
          )}

           {activeView === 'TEAMS' && (
              <div className="space-y-6 animate-in fade-in">
                  <h1 className="text-3xl font-bold">Team Structures</h1>
                  <div className="grid grid-cols-2 gap-8">
                       <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 h-fit">
                          <h3 className="text-lg font-bold mb-4">Add Team</h3>
                          <div className="space-y-3">
                             <div>
                                <select 
                                    value={newTeamOrgId}
                                    onChange={(e) => setNewTeamOrgId(e.target.value)}
                                    className="w-full bg-white border border-slate-300 rounded p-2 text-sm text-slate-900 focus:border-purple-500 outline-none"
                                >
                                    {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                                </select>
                             </div>
                             <div className="flex gap-2">
                                <input className="flex-1 bg-white border border-slate-300 rounded p-2 text-sm text-slate-900 focus:border-purple-500 outline-none" placeholder="Team Name" value={newTeamName} onChange={e => setNewTeamName(e.target.value)} />
                                <button onClick={handleCreateTeam} className="px-4 py-2 bg-purple-600 rounded font-medium hover:bg-purple-700">Add</button>
                             </div>
                          </div>
                       </div>
                       <div className="space-y-2">
                           {teams.map(team => (
                               <div key={team.id} className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex justify-between items-center">
                                   <div className="flex items-center gap-3">
                                       <div className={`w-4 h-4 rounded-full ${team.color}`}></div>
                                       <div>
                                            <div className="font-bold leading-tight">{team.name}</div>
                                            <div className="text-xs text-slate-500">{orgs.find(o => o.id === team.organizationId)?.name || 'Unknown Org'}</div>
                                       </div>
                                   </div>
                                   <div className="flex items-center gap-3">
                                       <span className="text-xs bg-slate-900 px-2 py-1 rounded text-slate-400">
                                            {users.filter(u => u.teamIds.includes(team.id)).length} members
                                       </span>
                                       <button onClick={() => handleDeleteTeam(team.id)} className="text-slate-500 hover:text-red-400"><Trash className="w-4 h-4" /></button>
                                   </div>
                               </div>
                           ))}
                       </div>
                  </div>
              </div>
           )}
      </div>
    </div>
  );
};