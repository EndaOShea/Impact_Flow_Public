
import React, { useState, useEffect, useRef } from 'react';
import { User, Team, UserRole, JoinRequest, Organization, TaskAssignmentRequest } from '../types';
import { Plus, Trash, Shield, ShieldAlert, Users, Briefcase, AlertCircle, Search, UserPlus, Inbox, Check, X, Building2, Key, Copy, CheckCircle2, ClipboardCheck, Eye, EyeOff, ChevronDown, ChevronUp } from 'lucide-react';
import { api } from '../services/api';
import { ApiKeySettings } from './ApiKeySettings';

interface AdminPanelProps {
  currentUser: User;
  users: User[];
  teams: Team[];
  joinRequests: JoinRequest[];
  onAddUser: (user: User, passwordPlain: string) => void;
  onRemoveUser: (id: string) => void;
  onUpdateUser: (user: User) => void;
  onAddTeam: (team: Team) => void;
  onRemoveTeam: (id: string) => void;
  onRefresh: () => void;
}

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

export const AdminPanel: React.FC<AdminPanelProps> = ({ 
  currentUser, users, teams, joinRequests, onAddUser, onRemoveUser, onUpdateUser, onAddTeam, onRemoveTeam, onRefresh 
}) => {
  const [activeTab, setActiveTab] = useState<'INBOX' | 'USERS' | 'TEAMS' | 'API_KEY'>('INBOX');
  const [taskRequests, setTaskRequests] = useState<TaskAssignmentRequest[]>([]);
  
  // User Form State
  const [newUserName, setNewUserName] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<UserRole>(UserRole.USER);
  const [newUserTeam, setNewUserTeam] = useState<string>(''); // For initial optional single team add
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Success State for User Creation
  const [createdUser, setCreatedUser] = useState<{name: string, key: string} | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  // Team Form State
  const [newTeamName, setNewTeamName] = useState('');
  const [expandedTeamId, setExpandedTeamId] = useState<string | null>(null);

  // Dropdown States
  const [activeAddTeamDropdown, setActiveAddTeamDropdown] = useState<string | null>(null);
  const [activeRoleDropdown, setActiveRoleDropdown] = useState<string | null>(null);

  // Permission Checks
  const isOwner = currentUser.role === UserRole.OWNER;
  const isAdmin = currentUser.role === UserRole.ADMIN;
  const isTeamAdmin = currentUser.role === UserRole.TEAM_ADMIN;
  
  // Owners can create Admins. Admins can create Team Admins.
  const canCreateAdmin = isOwner; 
  const canCreateTeamAdmin = isOwner || isAdmin;
  const canCreateTeam = isOwner || isAdmin; // Team Admin cannot create teams, only manage members
  const canManageRoles = isOwner || isAdmin;

  // Filtered Lists for Team Admins
  const filteredUsers = users.filter(u => {
      if (u.role === UserRole.SYSTEM_ADMIN) return false;
      
      if (isOwner || isAdmin) return true; // See everyone
      
      if (isTeamAdmin) {
          // Show users in my teams
          const inMyTeam = u.teamIds?.some(tid => currentUser.teamIds?.includes(tid));
          // Show floating users (no team) if they are USER rank (below me)
          const isFloating = (u.teamIds?.length === 0) && u.role === UserRole.USER;
          
          return inMyTeam || isFloating;
      }
      return false;
  });

  const availableTeamsForAdd = teams.filter(t => {
      if (isOwner || isAdmin) return true;
      if (isTeamAdmin) return currentUser.teamIds?.includes(t.id);
      return false;
  });

  // Click Outside Handler
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        const target = event.target as HTMLElement;
        if (!target.closest('.dropdown-trigger')) {
            setActiveAddTeamDropdown(null);
            setActiveRoleDropdown(null);
        }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
      const loadRequests = async () => {
          try {
              const reqs = await api.getTaskAssignmentRequests();
              // Filter logic:
              // If Owner/Admin -> See all pending
              // If Team Admin -> See pending requests where targetUser is in MY team
              const filtered = reqs.filter(r => r.status === 'PENDING').filter(r => {
                  if (isOwner || isAdmin) return true;
                  return currentUser.teamIds?.includes(r.targetTeamId);
              });
              setTaskRequests(filtered);
          } catch (err) {
              console.error('Failed to load task assignment requests:', err);
          }
      };
      loadRequests();
  }, [activeTab, currentUser]);

  const generateRecoveryKey = () => {
    const segment = () => Math.random().toString(36).substring(2, 6).toUpperCase();
    return `RK-${segment()}-${segment()}-${segment()}`;
  };

  const handleCreateUser = () => {
    setError('');
    setCreatedUser(null);

    if (!newUserName || !newUserPassword || !confirmPassword) return;

    if (!PASSWORD_REGEX.test(newUserPassword)) {
        setError('Password too weak (Min 8 chars, 1 upper, 1 lower, 1 number, 1 symbol)');
        return;
    }

    if (newUserPassword !== confirmPassword) {
        setError('Passwords do not match');
        return;
    }

    const initials = newUserName.substring(0, 2).toUpperCase();
    const recoveryKey = generateRecoveryKey();
    
    // Using newUserName as the Username (and Name) since email is removed
    const userPayload: User = {
      id: '', 
      organizationId: currentUser.organizationId, // Enforce Org
      username: newUserName.trim(),
      name: newUserName.trim(), // Use username as display name initially
      email: '', // Email removed
      role: newUserRole,
      teamIds: newUserTeam ? [newUserTeam] : [], // Use teamIds array
      avatarInitials: initials,
      recoveryKey: recoveryKey
    };

    onAddUser(userPayload, newUserPassword);
    
    // Show Success Modal with Key
    setCreatedUser({ name: newUserName, key: recoveryKey });

    // Reset Form
    setNewUserName('');
    setNewUserPassword('');
    setConfirmPassword('');
    setNewUserTeam('');
    setError('');
  };

  const handleCreateTeam = () => {
    if (!newTeamName) return;
    const colors = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-orange-500', 'bg-pink-500'];
    onAddTeam({
      id: crypto.randomUUID(),
      organizationId: currentUser.organizationId!,
      name: newTeamName,
      color: colors[Math.floor(Math.random() * colors.length)]
    });
    setNewTeamName('');
  };

  const handleProcessRequest = async (reqId: string, status: 'APPROVED' | 'REJECTED') => {
      try {
          await api.processJoinRequest(reqId, status);
          onRefresh(); // Replaces reload
      } catch (err) {
          console.error('Failed to process join request:', err);
      }
  };

  const handleProcessTaskRequest = async (reqId: string, status: 'APPROVED' | 'REJECTED') => {
      try {
          await api.processTaskAssignmentRequest(reqId, status);
          // Refresh list
          setTaskRequests(taskRequests.filter(r => r.id !== reqId));
      } catch (err) {
          console.error('Failed to process task assignment request:', err);
      }
  };

  const handleAddUserToTeam = async (user: User, teamId: string) => {
      if (!teamId) return;
      if (user.teamIds.includes(teamId)) return;
      const updatedUser = { ...user, teamIds: [...user.teamIds, teamId] };
      onUpdateUser(updatedUser);
      setActiveAddTeamDropdown(null);
  };

  const handleRemoveUserFromTeam = async (user: User, teamIdToRemove: string) => {
      const updatedUser = { ...user, teamIds: user.teamIds.filter(id => id !== teamIdToRemove) };
      onUpdateUser(updatedUser);
  };

  const handleChangeUserRole = async (user: User, newRole: UserRole) => {
      if (user.id === currentUser.id) return; // Prevent changing own role here to avoid lockout
      const updatedUser = { ...user, role: newRole };
      onUpdateUser(updatedUser);
      setActiveRoleDropdown(null);
  };

  const copyKey = () => {
      if(createdUser) {
          navigator.clipboard.writeText(createdUser.key);
          setCopiedKey(true);
          setTimeout(() => setCopiedKey(false), 2000);
      }
  };

  const getRoleBadge = (role: UserRole) => {
      switch(role) {
          case UserRole.OWNER: return 'bg-amber-100 text-amber-800 border-amber-200';
          case UserRole.ADMIN: return 'bg-purple-100 text-purple-800 border-purple-200';
          case UserRole.TEAM_ADMIN: return 'bg-blue-100 text-blue-800 border-blue-200';
          default: return 'bg-slate-100 text-slate-600 border-slate-200';
      }
  };

  const totalInbox = joinRequests.length + taskRequests.length;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
      <div className="flex gap-4 border-b border-slate-200 pb-4">
        <button 
          onClick={() => setActiveTab('INBOX')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${activeTab === 'INBOX' ? 'bg-amber-100 text-amber-700' : 'text-slate-500 hover:bg-slate-100'}`}
        >
          <Inbox className="w-4 h-4" /> Requests & Approval
          {totalInbox > 0 && <span className="bg-red-500 text-white text-xs px-2 rounded-full">{totalInbox}</span>}
        </button>
        <button 
          onClick={() => setActiveTab('USERS')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${activeTab === 'USERS' ? 'bg-blue-100 text-blue-700' : 'text-slate-500 hover:bg-slate-100'}`}
        >
          <Users className="w-4 h-4" /> {isTeamAdmin ? 'Team Members' : 'User Hierarchy'}
        </button>
        <button
          onClick={() => setActiveTab('TEAMS')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${activeTab === 'TEAMS' ? 'bg-purple-100 text-purple-700' : 'text-slate-500 hover:bg-slate-100'}`}
        >
          <Briefcase className="w-4 h-4" /> Team Structure
        </button>
        <button
          onClick={() => setActiveTab('API_KEY')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${activeTab === 'API_KEY' ? 'bg-green-100 text-green-700' : 'text-slate-500 hover:bg-slate-100'}`}
        >
          <Key className="w-4 h-4" /> My API Key
        </button>
      </div>

      {activeTab === 'INBOX' && (
          <div className="space-y-8">
              {/* JOIN REQUESTS */}
              {/* Team Admins usually don't approve Org Join requests unless specified, limiting to Owner/Admin */}
              {(isOwner || isAdmin) && (
              <div>
                <h3 className="text-sm font-bold text-slate-500 uppercase mb-3 flex items-center gap-2">
                    <UserPlus className="w-4 h-4" /> Organization Join Requests
                </h3>
                {joinRequests.length === 0 && (
                    <div className="p-4 text-center bg-slate-50 rounded-xl border border-slate-100 text-slate-400 text-sm italic mb-6">
                        No pending join requests.
                    </div>
                )}
                <div className="space-y-2 mb-8">
                    {joinRequests.map(req => {
                        return (
                            <div key={req.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                                <div>
                                    <p className="font-bold text-slate-800">Request from User ID: {req.userId}</p>
                                    <p className="text-xs text-slate-500">{new Date(req.createdAt).toLocaleString()}</p>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => handleProcessRequest(req.id, 'APPROVED')} className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 text-sm">
                                        <Check className="w-4 h-4" /> Approve
                                    </button>
                                    <button onClick={() => handleProcessRequest(req.id, 'REJECTED')} className="flex items-center gap-1 px-3 py-1.5 bg-red-100 text-red-600 rounded hover:bg-red-200 text-sm">
                                        <X className="w-4 h-4" /> Reject
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
              </div>
              )}

              {/* TASK ASSIGNMENT REQUESTS */}
              <div>
                <h3 className="text-sm font-bold text-slate-500 uppercase mb-3 flex items-center gap-2">
                    <ClipboardCheck className="w-4 h-4" /> Cross-Team Assignments
                </h3>
                {taskRequests.length === 0 && (
                    <div className="p-4 text-center bg-slate-50 rounded-xl border border-slate-100 text-slate-400 text-sm italic">
                        No pending task assignments.
                    </div>
                )}
                <div className="space-y-2">
                    {taskRequests.map(req => {
                        const requester = users.find(u => u.id === req.requesterId)?.name || 'Unknown';
                        const target = users.find(u => u.id === req.targetUserId)?.name || 'Unknown';
                        const targetTeam = teams.find(t => t.id === req.targetTeamId)?.name || 'Unknown Team';

                        return (
                            <div key={req.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div>
                                    <p className="font-bold text-slate-800">{req.taskTitle}</p>
                                    <p className="text-sm text-slate-600 mt-1">
                                        <span className="font-bold text-slate-700">{requester}</span> wants to assign this to <span className="font-bold text-blue-600">{target}</span> ({targetTeam}).
                                    </p>
                                    <p className="text-xs text-slate-400 mt-1">{new Date(req.createdAt).toLocaleString()}</p>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => handleProcessTaskRequest(req.id, 'APPROVED')} className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 text-sm">
                                        <Check className="w-4 h-4" /> Allow
                                    </button>
                                    <button onClick={() => handleProcessTaskRequest(req.id, 'REJECTED')} className="flex items-center gap-1 px-3 py-1.5 bg-red-100 text-red-600 rounded hover:bg-red-200 text-sm">
                                        <X className="w-4 h-4" /> Deny
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
              </div>
          </div>
      )}

      {activeTab === 'USERS' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          <div className="lg:col-span-1 space-y-8">
              {/* SECTION: CREATE NEW USER */}
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm h-fit">
                <h3 className="text-lg font-bold text-slate-800 mb-4">Provision New User</h3>
                {error && <div className="mb-3 text-xs text-red-600 bg-red-50 p-2 rounded flex items-center gap-1"><AlertCircle className="w-3 h-3"/> {error}</div>}
                
                {createdUser ? (
                    <div className="bg-green-50 border border-green-200 rounded-xl p-4 animate-in zoom-in-95">
                        <div className="flex items-center gap-2 text-green-700 font-bold mb-2">
                            <CheckCircle2 className="w-5 h-5" /> User Created!
                        </div>
                        <p className="text-sm text-slate-600 mb-4">
                            Please share this Recovery Key with <strong>{createdUser.name}</strong> immediately. It will not be shown again.
                        </p>
                        <div className="bg-white border border-green-200 rounded p-2 mb-3 font-mono text-xs font-bold text-slate-800 break-all relative group">
                            {createdUser.key}
                            <button onClick={copyKey} className="absolute right-1 top-1 p-1 bg-slate-100 hover:bg-slate-200 rounded text-slate-500">
                                {copiedKey ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                            </button>
                        </div>
                        <button 
                            onClick={() => setCreatedUser(null)}
                            className="w-full py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700"
                        >
                            Done
                        </button>
                    </div>
                ) : (
                    <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Username</label>
                        <input 
                        type="text" 
                        value={newUserName}
                        onChange={(e) => setNewUserName(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white text-black focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Temp Password</label>
                        <div className="relative">
                            <input 
                            type={showPassword ? "text" : "password"}
                            value={newUserPassword}
                            onChange={(e) => setNewUserPassword(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white text-black focus:ring-2 focus:ring-blue-500 outline-none pr-10"
                            />
                            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-2 top-2.5 text-slate-400 hover:text-slate-600">
                                {showPassword ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
                            </button>
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Confirm Password</label>
                        <input 
                        type={showPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white text-black focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Role</label>
                        <select 
                            value={newUserRole}
                            onChange={(e) => setNewUserRole(e.target.value as UserRole)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white text-black"
                            disabled={isTeamAdmin} // Team Admin can only create Users
                        >
                            <option value={UserRole.USER}>User</option>
                            {canCreateTeamAdmin && <option value={UserRole.TEAM_ADMIN}>Team Admin</option>}
                            {canCreateAdmin && <option value={UserRole.ADMIN}>Org Admin</option>}
                        </select>
                        </div>
                        <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Initial Team</label>
                        <select 
                            value={newUserTeam}
                            onChange={(e) => setNewUserTeam(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white text-black"
                        >
                            <option value="">{isTeamAdmin ? 'Select managed team...' : 'No Team'}</option>
                            {availableTeamsForAdd.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                        </div>
                    </div>
                    <button 
                        onClick={handleCreateUser}
                        disabled={isTeamAdmin && !newUserTeam}
                        className="w-full py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                        title={isTeamAdmin && !newUserTeam ? "Select a team to add user to" : ""}
                    >
                        <Plus className="w-4 h-4" /> Create User
                    </button>
                    </div>
                )}
              </div>
          </div>

          {/* User List */}
          <div className="lg:col-span-2 space-y-4">
             <h3 className="text-lg font-bold text-slate-800">
                 {isTeamAdmin ? 'My Team Members' : 'Organization Members'}
             </h3>
             {filteredUsers.map(user => {
               const userTeams = teams.filter(t => user.teamIds?.includes(t.id));
               // Permission logic for editing this row
               // Owner edits everyone including self. Admin edits Users. Team Admin edits Users in their team or Floating Users.
               let canEdit = false;
               if (isOwner) canEdit = true;
               else if (isAdmin) canEdit = user.role === UserRole.USER || user.role === UserRole.TEAM_ADMIN;
               else if (isTeamAdmin) canEdit = user.role === UserRole.USER;

               return (
                 <div key={user.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm group relative">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-sm font-bold text-slate-600">
                                {user.avatarInitials}
                            </div>
                            <div>
                                <h4 className="font-bold text-slate-800">{user.name} {user.id === currentUser.id && '(You)'}</h4>
                                
                                {/* ROLE DROPDOWN */}
                                <div className="relative dropdown-trigger mt-1">
                                    <button 
                                        onClick={() => canEdit && canManageRoles && user.id !== currentUser.id && setActiveRoleDropdown(activeRoleDropdown === user.id ? null : user.id)}
                                        className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded font-bold border ${getRoleBadge(user.role)} ${canEdit && canManageRoles && user.id !== currentUser.id ? 'cursor-pointer hover:ring-2 hover:ring-offset-1 hover:ring-blue-200' : 'cursor-default'}`}
                                        title={canEdit && canManageRoles && user.id !== currentUser.id ? "Click to change role" : ""}
                                    >
                                        {user.role}
                                        {canEdit && canManageRoles && user.id !== currentUser.id && <ChevronDown className="w-3 h-3 ml-1 opacity-50" />}
                                    </button>
                                    
                                    {/* Role Selection Dropdown */}
                                    {activeRoleDropdown === user.id && canEdit && canManageRoles && (
                                        <div className="absolute top-full left-0 mt-2 w-48 bg-white border border-slate-200 shadow-xl rounded-lg py-1 z-20 animate-in zoom-in-95">
                                            <div className="px-3 py-2 text-[10px] uppercase font-bold text-slate-400 bg-slate-50 border-b border-slate-100">Change Role</div>
                                            <button onClick={() => handleChangeUserRole(user, UserRole.USER)} className={`w-full text-left px-4 py-2 text-xs hover:bg-slate-50 ${user.role === UserRole.USER ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-700'}`}>User</button>
                                            {canCreateTeamAdmin && <button onClick={() => handleChangeUserRole(user, UserRole.TEAM_ADMIN)} className={`w-full text-left px-4 py-2 text-xs hover:bg-slate-50 ${user.role === UserRole.TEAM_ADMIN ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-700'}`}>Team Admin</button>}
                                            {canCreateAdmin && <button onClick={() => handleChangeUserRole(user, UserRole.ADMIN)} className={`w-full text-left px-4 py-2 text-xs hover:bg-slate-50 ${user.role === UserRole.ADMIN ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-700'}`}>Org Admin</button>}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                        {canEdit && !isTeamAdmin && user.id !== currentUser.id && (
                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button 
                                    onClick={() => onRemoveUser(user.id)}
                                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                    title="Delete User"
                                >
                                    <Trash className="w-4 h-4" />
                                </button>
                            </div>
                        )}
                    </div>
                    
                    {/* Teams List with Add/Remove */}
                    <div className="flex flex-wrap gap-2 pl-14">
                        {userTeams.map(team => {
                            // Can remove from this team if Admin OR (TeamAdmin AND matches managed team)
                            const canRemoveFromTeam = canEdit || (isTeamAdmin && currentUser.teamIds?.includes(team.id));
                            
                            return (
                                <span key={team.id} className="flex items-center gap-1 bg-slate-100 text-slate-600 text-xs px-2 py-1 rounded-full border border-slate-200">
                                    <span className={`w-2 h-2 rounded-full ${team.color}`}></span>
                                    {team.name}
                                    {canRemoveFromTeam && (
                                        <button 
                                            onClick={() => handleRemoveUserFromTeam(user, team.id)} 
                                            className="ml-1 text-slate-400 hover:text-red-500 rounded-full hover:bg-red-50 p-0.5"
                                            title="Remove from Team"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    )}
                                </span>
                            );
                        })}
                        
                        {/* Add to Team Button */}
                        {(canEdit || isTeamAdmin) && (
                            <div className="relative dropdown-trigger">
                                <button 
                                    onClick={() => setActiveAddTeamDropdown(activeAddTeamDropdown === user.id ? null : user.id)}
                                    className={`flex items-center gap-1 bg-white border border-dashed border-slate-300 text-slate-400 text-xs px-3 py-1 rounded-full transition-colors ${activeAddTeamDropdown === user.id ? 'bg-slate-50 text-blue-600 border-blue-300' : 'hover:bg-slate-50 hover:text-blue-600 hover:border-blue-300'}`}
                                >
                                    <Plus className="w-3 h-3" /> Add Team
                                </button>
                                
                                {/* Add Team Dropdown - Click Activated */}
                                {activeAddTeamDropdown === user.id && (
                                    <div className="absolute top-full left-0 mt-2 w-48 bg-white border border-slate-200 shadow-xl rounded-lg py-1 z-20 animate-in zoom-in-95">
                                        <div className="px-3 py-2 text-[10px] uppercase font-bold text-slate-400 bg-slate-50 border-b border-slate-100 flex justify-between">
                                            <span>Select Team</span>
                                            <button onClick={() => setActiveAddTeamDropdown(null)}><X className="w-3 h-3 hover:text-red-500"/></button>
                                        </div>
                                        
                                        {availableTeamsForAdd.filter(t => !user.teamIds?.includes(t.id)).length === 0 ? (
                                            <div className="px-3 py-3 text-xs text-slate-400 italic text-center">No other teams available</div>
                                        ) : (
                                            availableTeamsForAdd.filter(t => !user.teamIds?.includes(t.id)).map(t => (
                                                <button 
                                                    key={t.id}
                                                    onClick={() => handleAddUserToTeam(user, t.id)}
                                                    className="w-full text-left px-3 py-2 text-xs hover:bg-blue-50 text-slate-700 flex items-center gap-2 transition-colors"
                                                >
                                                    <span className={`w-2 h-2 rounded-full ${t.color}`}></span>
                                                    {t.name}
                                                </button>
                                            ))
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                 </div>
               );
             })}
          </div>
        </div>
      )}

      {activeTab === 'TEAMS' && (
         <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {canCreateTeam && (
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm h-fit">
              <h3 className="text-lg font-bold text-slate-800 mb-4">Create Team</h3>
              <div className="flex gap-2">
                <input 
                  type="text"
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white text-black focus:ring-2 focus:ring-purple-500 outline-none"
                  placeholder="Team Name (e.g. Design)"
                />
                <button 
                  onClick={handleCreateTeam}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                >
                  Add
                </button>
              </div>
            </div>
            )}

            <div className="space-y-3">
              {/* Show All Teams if Admin/Owner. Show My Teams if Team Admin */}
              {teams.filter(t => (isTeamAdmin ? currentUser.teamIds?.includes(t.id) : true)).map(team => (
                <div key={team.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm transition-all">
                   <div className="flex justify-between items-center cursor-pointer" onClick={() => setExpandedTeamId(expandedTeamId === team.id ? null : team.id)}>
                        <div className="flex items-center gap-3">
                            <div className={`w-4 h-4 rounded-full ${team.color}`}></div>
                            <div>
                                <div className="font-bold leading-tight flex items-center gap-2">
                                    {team.name}
                                    <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${expandedTeamId === team.id ? 'rotate-180' : ''}`} />
                                </div>
                                <div className="text-xs text-slate-500">{users.filter(u => u.teamIds?.includes(team.id)).length} members</div>
                            </div>
                        </div>
                        {canCreateTeam && (
                            <button onClick={(e) => { e.stopPropagation(); onRemoveTeam(team.id); }} className="text-slate-400 hover:text-red-500 p-2">
                                <Trash className="w-4 h-4" />
                            </button>
                        )}
                   </div>

                   {/* Expandable Members List */}
                   {expandedTeamId === team.id && (
                       <div className="mt-4 pt-4 border-t border-slate-100 animate-in slide-in-from-top-2">
                           <h4 className="text-xs font-bold text-slate-400 uppercase mb-3">Team Members</h4>
                           {users.filter(u => u.teamIds?.includes(team.id)).length === 0 ? (
                               <p className="text-sm text-slate-400 italic">No members assigned.</p>
                           ) : (
                               <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                   {users.filter(u => u.teamIds?.includes(team.id)).map(member => (
                                       <div key={member.id} className="flex items-center gap-2 p-2 bg-slate-50 rounded border border-slate-100">
                                            <div className="w-6 h-6 bg-slate-200 rounded-full flex items-center justify-center text-[10px] font-bold text-slate-600">
                                                {member.avatarInitials}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-bold text-slate-700 truncate">{member.name}</p>
                                                <p className="text-[10px] text-slate-500 truncate">{member.username}</p>
                                            </div>
                                            <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${member.role === UserRole.TEAM_ADMIN ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-500'}`}>
                                                {member.role === UserRole.TEAM_ADMIN ? 'Admin' : 'Member'}
                                            </span>
                                       </div>
                                   ))}
                               </div>
                           )}
                       </div>
                   )}
                </div>
              ))}
              {isTeamAdmin && teams.length === 0 && <p className="text-slate-400 text-sm">You are not assigned to any teams.</p>}
            </div>
         </div>
      )}

      {activeTab === 'API_KEY' && (
        <div className="max-w-2xl">
          <ApiKeySettings
            userId={currentUser.id}
            onApiKeyChange={() => {
              // Optionally trigger a refresh or notification
              console.log('API key updated');
            }}
          />
        </div>
      )}
    </div>
  );
};
