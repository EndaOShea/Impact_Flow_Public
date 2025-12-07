

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
    X, Plus, Trash, Wand2, CheckCircle2, Circle, ChevronDown, ChevronRight,
    BarChart2, Upload, Paperclip,
    Calendar, Flag, Clock, Bell, Link as LinkIcon, MessageSquare,
    Zap, Target, History, GitGraph, ArrowUpDown, UserPlus
} from 'lucide-react';
import { Task, Subtask, ImpactMetric, TaskStatus, ImpactType, WorkCategory, Attachment, Priority, Comment, AutomationRule, User, UserRole, Team } from '../types';
import { generateDiagramCode } from '../services/gemini';
import { MermaidDiagram } from './MermaidDiagram';
import { TaskReport } from './TaskReport';

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (task: Task) => void;
  taskToEdit?: Task;
  allTasks?: Task[]; // For dependencies
  currentUser: User;
  users: User[];
  teams: Team[];
}

type ModalTab = 'DETAILS' | 'STRATEGY' | 'COLLAB' | 'REPORT';

// Helper to safely format dates for input fields
const toDateString = (date?: Date | string) => {
    if (!date) return '';
    try {
        const d = new Date(date);
        if (isNaN(d.getTime())) return '';
        return d.toISOString().split('T')[0];
    } catch (e) {
        return '';
    }
};

export const TaskModal: React.FC<TaskModalProps> = ({ 
    isOpen, onClose, onSave, taskToEdit, allTasks = [], currentUser, users, teams 
}) => {
  const [activeTab, setActiveTab] = useState<ModalTab>('DETAILS');
  
  // Basic Info
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<TaskStatus>(TaskStatus.TODO);
  const [priority, setPriority] = useState<Priority>(Priority.MEDIUM);
  
  // Scheduling & People
  const [startDate, setStartDate] = useState<string>('');
  const [dueDate, setDueDate] = useState<string>('');
  const [assigneeId, setAssigneeId] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceFrequency, setRecurrenceFrequency] = useState<'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY'>('WEEKLY');
  const [recurrenceInterval, setRecurrenceInterval] = useState(1);
  const [recurrenceWeekDays, setRecurrenceWeekDays] = useState<number[]>([]);
  
  // Lists
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [impactMetrics, setImpactMetrics] = useState<ImpactMetric[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [dependencyIds, setDependencyIds] = useState<string[]>([]);
  const [automations, setAutomations] = useState<AutomationRule[]>([]);
  
  // Strategy
  const [okrs, setOkrs] = useState<string[]>([]);
  const [newOkrInput, setNewOkrInput] = useState('');
  const [milestone, setMilestone] = useState(false);
  const [beforeScenario, setBeforeScenario] = useState('');
  const [afterScenario, setAfterScenario] = useState('');
  const [impactNarrative, setImpactNarrative] = useState('');
  const [resourceLinks, setResourceLinks] = useState<{title: string, url: string}[]>([]);

  // Diagram
  const [diagramCode, setDiagramCode] = useState<string>('');
  const [diagramPrompt, setDiagramPrompt] = useState('');
  const [isGeneratingDiagram, setIsGeneratingDiagram] = useState(false);
  
  // UI States
  const [expandedSubtaskId, setExpandedSubtaskId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [newCommentText, setNewCommentText] = useState('');

  // Permission Logic
  // Owners, Org Admins, and Team Admins can edit sensitive fields.
  // Anyone creating a NEW task can also set these fields initially.
  const isPrivileged = currentUser.role === UserRole.OWNER || currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.TEAM_ADMIN;
  const canEditSensitive = isPrivileged || !taskToEdit;
  
  // Filter Assignable Users based on Team and Permissions
  const assignableUsers = useMemo(() => {
    const myTeamIds = currentUser.teamIds || [];

    // Rank Helper: Higher number = Higher Rank
    const getRank = (r: UserRole) => {
        if (r === UserRole.OWNER) return 3;
        if (r === UserRole.ADMIN) return 2;
        if (r === UserRole.TEAM_ADMIN) return 1;
        return 0; // USER
    };

    const myRank = getRank(currentUser.role);

    return users.filter(u => {
        // Always include self
        if (u.id === currentUser.id) return true;

        // Must be in one of my teams
        const userTeams = u.teamIds || [];
        const inMyTeam = userTeams.some(tid => myTeamIds.includes(tid));
        if (!inMyTeam) return false;

        // Owners/Admins can assign to anyone in their teams
        if (currentUser.role === UserRole.OWNER || currentUser.role === UserRole.ADMIN) {
            return true;
        }

        // Must have rank <= my rank (Can assign to peers or subordinates)
        return getRank(u.role) <= myRank;
    });
  }, [users, currentUser]);

  // Filter teams to only show teams the current user belongs to
  const assignableTeams = useMemo(() => {
    const myTeamIds = currentUser.teamIds || [];
    return teams.filter(team => myTeamIds.includes(team.id));
  }, [teams, currentUser]);

  // Determine available statuses
  // "When creating a new task only TODO and IN PROGRESS should be available."
  const availableStatuses = useMemo(() => {
      if (taskToEdit) {
          return Object.values(TaskStatus);
      }
      return [TaskStatus.TODO, TaskStatus.IN_PROGRESS];
  }, [taskToEdit]);

  useEffect(() => {
    if (isOpen) {
      setActiveTab('DETAILS');
      if (taskToEdit) {
        setTitle(taskToEdit.title);
        setDescription(taskToEdit.description);
        setStatus(taskToEdit.status);
        setPriority(taskToEdit.priority);
        
        // Use safe date parsing
        setStartDate(toDateString(taskToEdit.startDate));
        setDueDate(toDateString(taskToEdit.dueDate));
        
        // Safe assignee check
        const assignees = Array.isArray(taskToEdit.assigneeIds) ? taskToEdit.assigneeIds : [];
        setAssigneeId(assignees[0] || '');
        
        setIsRecurring(taskToEdit.isRecurring);
        if (taskToEdit.recurrenceConfig) {
            setRecurrenceFrequency(taskToEdit.recurrenceConfig.frequency);
            setRecurrenceInterval(taskToEdit.recurrenceConfig.interval);
            setRecurrenceWeekDays(taskToEdit.recurrenceConfig.weekDays || []);
        }
        setSubtasks([...(taskToEdit.subtasks || [])]);
        setImpactMetrics([...(taskToEdit.impactMetrics || []).map(m => ({ ...m, currency: m.currency || 'USD' }))]);
        setAttachments([...(taskToEdit.attachments || [])]);
        setComments([...(taskToEdit.comments || [])]);
        setDependencyIds([...(taskToEdit.dependencyIds || [])]);
        setAutomations([...(taskToEdit.automations || [])]);
        
        // Load OKRs: Use new array or fallback to old string (defensive check)
        const rawOkrs = taskToEdit.okrs;
        const loadedOkrs = Array.isArray(rawOkrs) && rawOkrs.length > 0 
            ? rawOkrs 
            : (taskToEdit.okrAlignment ? [taskToEdit.okrAlignment] : []);
        setOkrs(loadedOkrs);
        setNewOkrInput('');

        setMilestone(taskToEdit.milestone || false);
        setBeforeScenario(taskToEdit.beforeScenario || '');
        setAfterScenario(taskToEdit.afterScenario || '');
        setImpactNarrative(taskToEdit.impactNarrative || '');
        setResourceLinks([...(taskToEdit.resourceLinks || [])]);
        setDiagramCode(taskToEdit.diagramCode || '');
      } else {
        // Reset for new task
        setTitle('');
        setDescription('');
        setStatus(TaskStatus.TODO);
        setPriority(Priority.MEDIUM);
        setStartDate(new Date().toISOString().split('T')[0]);
        setDueDate('');
        setAssigneeId(currentUser.id); // Default to self
        setIsRecurring(false);
        setRecurrenceFrequency('WEEKLY');
        setRecurrenceInterval(1);
        setRecurrenceWeekDays([]);
        setSubtasks([]);
        setImpactMetrics([]);
        setAttachments([]);
        setComments([]);
        setDependencyIds([]);
        setAutomations([
            { id: '1', trigger: 'Status to Review', action: 'Notify Designer', active: false },
            { id: '2', trigger: 'Due Date Passed', action: 'Escalate Priority', active: false }
        ]);
        setOkrs([]);
        setNewOkrInput('');
        setMilestone(false);
        setBeforeScenario('');
        setAfterScenario('');
        setImpactNarrative('');
        setResourceLinks([]);
        setDiagramCode('');
        setDiagramPrompt('');
      }
    }
  }, [isOpen, taskToEdit, currentUser]);

  const toggleSubtaskExpand = (id: string) => {
    setExpandedSubtaskId(expandedSubtaskId === id ? null : id);
  };

  const handleAddSubtask = () => {
    const newSubtask: Subtask = {
      id: crypto.randomUUID(),
      title: 'New Task Step',
      completed: false,
      hoursSpent: 0,
      estimatedHours: 0,
      category: WorkCategory.DEVELOPMENT,
      notes: ''
    };
    setSubtasks([...subtasks, newSubtask]);
    setExpandedSubtaskId(newSubtask.id);
  };

  const handleUpdateSubtask = (id: string, updates: Partial<Subtask>) => {
    // If trying to complete a subtask, ensure actual hours are entered
    if (updates.completed === true && taskToEdit) {
      const subtask = subtasks.find(s => s.id === id);
      if (subtask && (!subtask.hoursSpent || subtask.hoursSpent === 0)) {
        alert('Please enter Actual Hours before marking this step as completed.');
        return;
      }
    }
    setSubtasks(subtasks.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  const handleDeleteSubtask = (id: string) => {
    setSubtasks(subtasks.filter(s => s.id !== id));
  };

  const handleAddMetric = () => {
    const newMetric: ImpactMetric = {
      id: crypto.randomUUID(),
      type: ImpactType.REVENUE,
      value: 0,
      currency: 'USD',
      description: ''
    };
    setImpactMetrics([...impactMetrics, newMetric]);
  };

  const handleUpdateMetric = (id: string, updates: Partial<ImpactMetric>) => {
    setImpactMetrics(impactMetrics.map(m => m.id === id ? { ...m, ...updates } : m));
  };

  const handleDeleteMetric = (id: string) => {
    setImpactMetrics(impactMetrics.filter(m => m.id !== id));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      Array.from(e.target.files).forEach(file => {
        const reader = new FileReader();
        reader.onload = (event) => {
          if (event.target?.result) {
            const newAttachment: Attachment = {
              id: crypto.randomUUID(),
              name: file.name,
              type: file.type,
              size: file.size,
              url: event.target.result as string,
              createdAt: new Date()
            };
            setAttachments(prev => [...prev, newAttachment]);
          }
        };
        reader.readAsDataURL(file);
      });
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDeleteAttachment = (id: string) => {
    setAttachments(attachments.filter(a => a.id !== id));
  };
  
  const handleAddComment = () => {
      if(!newCommentText.trim()) return;
      const comment: Comment = {
          id: crypto.randomUUID(),
          authorId: currentUser.id,
          text: newCommentText,
          createdAt: new Date()
      };
      setComments([...comments, comment]);
      setNewCommentText('');
  };

  const handleAddOkr = () => {
      if (!newOkrInput.trim()) return;
      setOkrs([...okrs, newOkrInput.trim()]);
      setNewOkrInput('');
  };

  const handleRemoveOkr = (index: number) => {
      setOkrs(okrs.filter((_, i) => i !== index));
  };

  const handleGenerateDiagram = async () => {
    if (!diagramPrompt.trim()) return;
    setIsGeneratingDiagram(true);
    const code = await generateDiagramCode(diagramPrompt, currentUser.id);
    setDiagramCode(code);
    setIsGeneratingDiagram(false);
  };

  const handleSafeShowPicker = (e: React.MouseEvent<HTMLInputElement>) => {
      try {
          if (typeof e.currentTarget.showPicker === 'function') {
              e.currentTarget.showPicker();
          }
      } catch (err) {
          // Ignore if not supported or failed
      }
  };

  const handleSave = () => {
    if (!title.trim()) return;

    // Validate that all subtasks have estimated hours when creating a new task
    if (!taskToEdit && subtasks.length > 0) {
      const missingEstimates = subtasks.filter(s => !s.estimatedHours || s.estimatedHours === 0);
      if (missingEstimates.length > 0) {
        alert(`Please enter Estimated Hours for all subtasks before creating the task. ${missingEstimates.length} step(s) missing estimates.`);
        return;
      }
    }

    const newTask: Task = {
      id: taskToEdit ? taskToEdit.id : crypto.randomUUID(),
      organizationId: taskToEdit?.organizationId || currentUser.organizationId || 'temp',
      title,
      description,
      status,
      priority,
      startDate: startDate ? new Date(startDate) : undefined,
      dueDate: dueDate ? new Date(dueDate) : undefined,
      assigneeIds: assigneeId ? [assigneeId] : [],
      creatorId: taskToEdit?.creatorId || currentUser.id,
      adminIds: taskToEdit?.adminIds || [currentUser.id],
      isRecurring,
      recurrenceConfig: isRecurring ? {
        frequency: recurrenceFrequency,
        interval: recurrenceInterval,
        weekDays: recurrenceFrequency === 'WEEKLY' ? recurrenceWeekDays : undefined
      } : undefined,
      dependencyIds,
      createdAt: taskToEdit ? taskToEdit.createdAt : new Date(),
      completedAt: status === TaskStatus.COMPLETED && (!taskToEdit || taskToEdit.status !== TaskStatus.COMPLETED) ? new Date() : undefined,
      subtasks,
      impactMetrics,
      attachments,
      comments,
      automations,
      okrAlignment: okrs.length > 0 ? okrs[0] : '', // Backward compat
      okrs,
      milestone,
      beforeScenario,
      afterScenario,
      impactNarrative,
      resourceLinks,
      diagramCode,
      activityLog: taskToEdit?.activityLog || []
    };
    
    onSave(newTask);
    onClose();
  };

  if (!isOpen) return null;

  const currentTaskState: Task = {
      id: taskToEdit?.id || 'temp',
      organizationId: currentUser.organizationId || 'temp',
      title, description, status, priority,
      startDate: startDate ? new Date(startDate) : undefined,
      dueDate: dueDate ? new Date(dueDate) : undefined,
      assigneeIds: assigneeId ? [assigneeId] : [],
      creatorId: currentUser.id,
      adminIds: [currentUser.id],
      isRecurring,
      recurrenceConfig: isRecurring ? {
        frequency: recurrenceFrequency,
        interval: recurrenceInterval,
        weekDays: recurrenceFrequency === 'WEEKLY' ? recurrenceWeekDays : undefined
      } : undefined,
      dependencyIds,
      createdAt: new Date(),
      subtasks, impactMetrics, attachments, comments,
      automations, 
      okrAlignment: okrs[0] || '', 
      okrs,
      milestone,
      beforeScenario, afterScenario, impactNarrative,
      resourceLinks, diagramCode,
      activityLog: []
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[95vh] overflow-hidden flex flex-col border border-slate-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 bg-white z-10">
            <div className="flex justify-between items-start mb-4">
                <input 
                    type="text" 
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    // Only admins can rename EXISTING tasks, but ANYONE can name a NEW task
                    disabled={!canEditSensitive && taskToEdit !== undefined} 
                    className={`text-2xl font-bold text-slate-800 placeholder-slate-300 border-none focus:ring-0 p-0 w-full bg-transparent ${!canEditSensitive && taskToEdit ? 'cursor-not-allowed opacity-80' : ''}`}
                    placeholder="Task Title"
                />
                <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors">
                    <X className="w-6 h-6" />
                </button>
            </div>
            
            <div className="flex items-center gap-4 flex-wrap">
                {/* Status Dropdown */}
                <div className="relative group">
                    <select 
                        value={status}
                        onChange={(e) => setStatus(e.target.value as TaskStatus)}
                        className={`text-sm font-semibold pl-3 pr-8 py-1.5 rounded-full border-none focus:ring-2 focus:ring-offset-1 outline-none appearance-none cursor-pointer
                            ${status === TaskStatus.COMPLETED ? 'bg-green-100 text-green-700 focus:ring-green-500' :
                              status === TaskStatus.IN_PROGRESS ? 'bg-amber-100 text-amber-700 focus:ring-amber-500' :
                              status === TaskStatus.REVIEW ? 'bg-purple-100 text-purple-700 focus:ring-purple-500' :
                              'bg-slate-100 text-slate-700 focus:ring-slate-500'}`}
                    >
                        {availableStatuses.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-current opacity-50 pointer-events-none" />
                </div>
                
                 {/* Priority Dropdown */}
                 <div className="relative group">
                    <select 
                        value={priority}
                        onChange={(e) => setPriority(e.target.value as Priority)}
                        disabled={!canEditSensitive}
                        className={`text-sm font-semibold pl-3 pr-8 py-1.5 rounded-full border-none focus:ring-2 focus:ring-offset-1 outline-none appearance-none cursor-pointer disabled:cursor-not-allowed disabled:opacity-70
                            ${priority === Priority.CRITICAL ? 'bg-red-100 text-red-700 focus:ring-red-500' :
                              priority === Priority.HIGH ? 'bg-orange-100 text-orange-700 focus:ring-orange-500' :
                              priority === Priority.MEDIUM ? 'bg-blue-50 text-blue-700 focus:ring-blue-500' :
                              'bg-green-100 text-green-700 focus:ring-green-500'}`}
                    >
                        {Object.values(Priority).map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-current opacity-50 pointer-events-none" />
                </div>

                <div className="h-6 w-px bg-slate-200"></div>

                <div className="flex bg-slate-100 p-1 rounded-lg overflow-x-auto">
                    <button 
                        onClick={() => setActiveTab('DETAILS')}
                        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all whitespace-nowrap ${activeTab === 'DETAILS' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Details
                    </button>
                    <button 
                        onClick={() => setActiveTab('STRATEGY')}
                        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all whitespace-nowrap ${activeTab === 'STRATEGY' ? 'bg-white text-purple-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Strategy
                    </button>
                    <button 
                        onClick={() => setActiveTab('COLLAB')}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all whitespace-nowrap ${activeTab === 'COLLAB' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Collab {comments.length > 0 && <span className="bg-blue-100 text-blue-700 text-xs px-1.5 rounded-full">{comments.length}</span>}
                    </button>
                    <button 
                        onClick={() => setActiveTab('REPORT')}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all whitespace-nowrap ${activeTab === 'REPORT' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <BarChart2 className="w-4 h-4" /> Report
                    </button>
                </div>
            </div>
        </div>

        {/* Content Scroll Area */}
        <div className="flex-1 overflow-y-auto bg-slate-50/50">
          
          {/* TAB: REPORT */}
          {activeTab === 'REPORT' && (
             <div className="p-8">
                 <TaskReport task={currentTaskState} />
             </div>
          )}

          {/* TAB: COLLABORATION */}
          {activeTab === 'COLLAB' && (
              <div className="p-8 max-w-4xl mx-auto space-y-6">
                 {/* Attachments Section Moved Here */}
                 <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                            <Paperclip className="w-4 h-4" /> Attachments
                        </h3>
                        <button onClick={() => fileInputRef.current?.click()} className="text-blue-600 hover:text-blue-700 text-xs font-medium flex items-center bg-blue-50 px-3 py-1 rounded-full"><Upload className="w-3 h-3 mr-1" /> Upload</button>
                        <input type="file" ref={fileInputRef} className="hidden" multiple onChange={handleFileUpload} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        {attachments.length === 0 && <p className="text-slate-400 text-xs italic col-span-2">No files attached.</p>}
                        {attachments.map(file => (
                          <div key={file.id} className="flex items-center p-2 bg-slate-50 border border-slate-200 rounded-lg group">
                             <div className="p-1.5 bg-white rounded mr-2"><Paperclip className="w-4 h-4 text-slate-500" /></div>
                             <div className="flex-1 min-w-0"><h4 className="text-xs font-medium truncate">{file.name}</h4></div>
                             <button onClick={() => handleDeleteAttachment(file.id)} className="p-1 text-slate-400 hover:text-red-500"><Trash className="w-3 h-3" /></button>
                          </div>
                        ))}
                    </div>
                 </div>

                 {/* Links */}
                 <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2"><LinkIcon className="w-4 h-4" /> Workspace Resources</h3>
                    <div className="space-y-2">
                        {resourceLinks.map((link, idx) => (
                            <div key={idx} className="flex gap-2">
                                <input className="flex-1 border border-slate-200 rounded px-2 py-1 text-sm bg-white" value={link.title} onChange={(e) => {
                                    const newLinks = [...resourceLinks]; newLinks[idx].title = e.target.value; setResourceLinks(newLinks);
                                }} placeholder="Resource Title" />
                                <input className="flex-1 border border-slate-200 rounded px-2 py-1 text-sm text-blue-600 bg-white" value={link.url} onChange={(e) => {
                                    const newLinks = [...resourceLinks]; newLinks[idx].url = e.target.value; setResourceLinks(newLinks);
                                }} placeholder="URL" />
                                <button onClick={() => setResourceLinks(resourceLinks.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-500"><Trash className="w-4 h-4"/></button>
                            </div>
                        ))}
                        <button onClick={() => setResourceLinks([...resourceLinks, {title: '', url: ''}])} className="text-sm text-blue-600 hover:underline flex items-center gap-1">
                            <Plus className="w-3 h-3" /> Add Link
                        </button>
                    </div>
                 </div>

                 {/* Comments */}
                 <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2"><MessageSquare className="w-4 h-4" /> Team Discussion</h3>
                    <div className="space-y-4 mb-6 max-h-[300px] overflow-y-auto">
                        {comments.length === 0 && <p className="text-slate-400 text-sm italic">No comments yet.</p>}
                        {comments.map(c => {
                            const author = users.find(u => u.id === c.authorId);
                            return (
                                <div key={c.id} className="flex gap-3">
                                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-xs font-bold flex-shrink-0">
                                        {author?.avatarInitials || '??'}
                                    </div>
                                    <div className="flex-1">
                                        <div className="bg-slate-50 p-3 rounded-lg rounded-tl-none border border-slate-100">
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="text-xs font-bold text-slate-700">{author?.name || 'Unknown'}</span>
                                                <span className="text-[10px] text-slate-400">{new Date(c.createdAt).toLocaleString()}</span>
                                            </div>
                                            <p className="text-sm text-slate-600">{c.text}</p>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    <div className="flex gap-2">
                        <input 
                            type="text" 
                            value={newCommentText}
                            onChange={(e) => setNewCommentText(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
                            placeholder="Write a comment..."
                            className="flex-1 border border-slate-300 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                        />
                        <button onClick={handleAddComment} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Send</button>
                    </div>
                 </div>
              </div>
          )}

          {/* TAB: STRATEGY */}
          {activeTab === 'STRATEGY' && (
              <div className="p-8 max-w-4xl mx-auto space-y-6">
                
                {/* KPI Section */}
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                            <BarChart2 className="w-4 h-4 text-blue-500" /> Key Performance Indicators (KPIs)
                        </h3>
                        <button onClick={handleAddMetric} className="text-blue-600 text-xs font-bold hover:underline bg-blue-50 px-3 py-1.5 rounded-full">+ Add Metric</button>
                    </div>
                    <div className="space-y-3">
                        {impactMetrics.map(metric => (
                            <div key={metric.id} className="flex flex-wrap md:flex-nowrap gap-3 items-start bg-slate-50 p-3 rounded-lg border border-slate-100 animate-in fade-in">
                                {/* Type Select */}
                                <div className="w-full md:w-1/4">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Type</label>
                                    <select 
                                        value={metric.type}
                                        onChange={(e) => handleUpdateMetric(metric.id, { type: e.target.value as ImpactType })}
                                        className="w-full text-xs border border-slate-200 rounded px-2 py-1.5 bg-white outline-none focus:border-blue-500"
                                    >
                                        {Object.values(ImpactType).map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                </div>
                                {/* Value Input */}
                                <div className="w-1/2 md:w-1/5">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Target</label>
                                    <input 
                                        type="number" 
                                        value={metric.value}
                                        onChange={(e) => handleUpdateMetric(metric.id, { value: parseFloat(e.target.value) })}
                                        className="w-full text-xs border border-slate-200 rounded px-2 py-1.5 bg-white outline-none focus:border-blue-500"
                                    />
                                </div>
                                {/* Currency (Conditional) */}
                                {metric.type === ImpactType.REVENUE && (
                                    <div className="w-1/2 md:w-1/6">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Currency</label>
                                        <select 
                                           value={metric.currency}
                                           onChange={(e) => handleUpdateMetric(metric.id, { currency: e.target.value as any })}
                                           className="w-full text-xs border border-slate-200 rounded px-2 py-1.5 bg-white outline-none focus:border-blue-500"
                                        >
                                            <option value="USD">USD</option>
                                            <option value="EUR">EUR</option>
                                            <option value="GBP">GBP</option>
                                        </select>
                                    </div>
                                )}
                                {/* Description */}
                                <div className="flex-1 min-w-[200px]">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Context</label>
                                    <input 
                                        type="text" 
                                        value={metric.description}
                                        onChange={(e) => handleUpdateMetric(metric.id, { description: e.target.value })}
                                        placeholder="e.g. Q3 Revenue Target"
                                        className="w-full text-xs border border-slate-200 rounded px-2 py-1.5 bg-white outline-none focus:border-blue-500"
                                    />
                                </div>
                                {/* Delete */}
                                <button onClick={() => handleDeleteMetric(metric.id)} className="mt-6 text-slate-400 hover:text-red-500 hover:bg-red-50 p-1 rounded transition-colors">
                                    <Trash className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                        {impactMetrics.length === 0 && (
                            <div className="text-center py-6 border-2 border-dashed border-slate-100 rounded-lg text-slate-400 text-xs">
                                No KPIs defined. Add metrics to track success.
                            </div>
                        )}
                    </div>
                </div>

                {/* OKRs */}
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2"><Target className="w-4 h-4 text-red-500" /> Strategic Alignment (OKRs)</label>
                    <div className="space-y-2 mb-3">
                        {okrs.map((okr, index) => (
                            <div key={index} className="flex items-center gap-2 bg-slate-50 p-2 rounded border border-slate-200">
                                <span className="flex-1 text-sm text-slate-700">{okr}</span>
                                <button onClick={() => handleRemoveOkr(index)} className="text-slate-400 hover:text-red-500 p-1 rounded">
                                    <Trash className="w-3 h-3" />
                                </button>
                            </div>
                        ))}
                    </div>
                    <div className="flex gap-2">
                        <input 
                            type="text" 
                            value={newOkrInput}
                            onChange={(e) => setNewOkrInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAddOkr()}
                            className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white"
                            placeholder="Add new OKR (e.g. Increase Q3 Efficiency by 15%)..."
                        />
                        <button onClick={handleAddOkr} className="px-3 py-2 bg-blue-50 text-blue-600 rounded-lg font-bold text-xs hover:bg-blue-100">
                            Add OKR
                        </button>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2"><History className="w-4 h-4" /> Impact Comparison</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Before Scenario</label>
                            <textarea 
                                value={beforeScenario}
                                onChange={(e) => setBeforeScenario(e.target.value)}
                                className="w-full h-24 p-3 bg-white border border-slate-200 rounded-lg text-sm resize-none focus:ring-2 focus:ring-blue-500 outline-none"
                                placeholder="Describe the current state..."
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Expected Outcome</label>
                            <textarea 
                                value={afterScenario}
                                onChange={(e) => setAfterScenario(e.target.value)}
                                className="w-full h-24 p-3 bg-white border border-emerald-100 rounded-lg text-sm resize-none focus:ring-2 focus:ring-emerald-500 outline-none"
                                placeholder="Describe the desired future state..."
                            />
                        </div>
                    </div>
                </div>

                {/* AI Flowchart Section Restored */}
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <GitGraph className="w-4 h-4 text-blue-500" /> Process Diagram (AI)
                    </h3>
                    <div className="flex gap-2 mb-4">
                        <input 
                            type="text" 
                            value={diagramPrompt}
                            onChange={(e) => setDiagramPrompt(e.target.value)}
                            placeholder="Describe a process (e.g., 'A user logs in, checks email, then logs out')..."
                            className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none bg-white"
                        />
                        <button 
                            onClick={handleGenerateDiagram}
                            disabled={isGeneratingDiagram || !diagramPrompt}
                            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2 whitespace-nowrap"
                        >
                            <Wand2 className="w-4 h-4" /> 
                            {isGeneratingDiagram ? 'Generating...' : 'Generate'}
                        </button>
                    </div>
                    {diagramCode && (
                        <div className="border border-slate-100 rounded-lg p-2 bg-slate-50">
                            <MermaidDiagram code={diagramCode} />
                            <div className="flex justify-end mt-2">
                                <button onClick={() => setDiagramCode('')} className="text-xs text-red-500 hover:underline">Clear Diagram</button>
                            </div>
                        </div>
                    )}
                </div>
              </div>
          )}

          {/* TAB: DETAILS (Main Edit) */}
          {activeTab === 'DETAILS' && (
            <div className="p-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Left Column: Main Content */}
              <div className="lg:col-span-2 space-y-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                  <textarea 
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    disabled={!canEditSensitive && taskToEdit !== undefined}
                    className={`w-full px-4 py-3 bg-white text-slate-900 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all h-32 resize-none shadow-sm ${!canEditSensitive && taskToEdit ? 'bg-slate-50 cursor-not-allowed' : ''}`}
                    placeholder="Detailed description of the task..."
                  />
                </div>

                {/* Subtasks */}
                <div>
                    <div className="flex items-center justify-between mb-3">
                        <label className="block text-sm font-bold text-slate-800">Work Breakdown</label>
                        <button onClick={handleAddSubtask} className="text-blue-600 hover:text-blue-700 text-xs font-bold flex items-center bg-blue-50 px-3 py-1.5 rounded-full transition-colors">
                            <Plus className="w-3 h-3 mr-1" /> Add Step
                        </button>
                    </div>
                    <div className="space-y-3">
                        {subtasks.map(subtask => (
                            <div key={subtask.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm transition-all hover:border-blue-300 group">
                                <div className="flex items-center gap-3 p-3 cursor-pointer bg-slate-50/50 hover:bg-white transition-colors" onClick={() => toggleSubtaskExpand(subtask.id)}>
                                    <button onClick={(e) => { e.stopPropagation(); toggleSubtaskExpand(subtask.id); }} className="text-slate-400 hover:text-slate-600">
                                        {expandedSubtaskId === subtask.id ? <ChevronDown className="w-4 h-4"/> : <ChevronRight className="w-4 h-4"/>}
                                    </button>
                                    <button onClick={(e) => { e.stopPropagation(); handleUpdateSubtask(subtask.id, { completed: !subtask.completed }); }} className={`${subtask.completed ? 'text-green-500' : 'text-slate-300 hover:text-slate-400'}`}>
                                        {subtask.completed ? <CheckCircle2 className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
                                    </button>
                                    <input 
                                        type="text" 
                                        value={subtask.title}
                                        onClick={(e) => e.stopPropagation()}
                                        onChange={(e) => handleUpdateSubtask(subtask.id, { title: e.target.value })}
                                        className={`bg-transparent border-none focus:ring-0 p-0 text-sm font-medium w-full ${subtask.completed ? 'line-through text-slate-400' : 'text-slate-700'}`}
                                    />
                                    {/* Milestone Toggle on Subtask */}
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); handleUpdateSubtask(subtask.id, { isMilestone: !subtask.isMilestone }); }}
                                        className={`p-1 rounded hover:bg-slate-100 transition-colors ${subtask.isMilestone ? 'bg-white' : 'bg-white'}`}
                                        title={subtask.isMilestone ? "This is a milestone" : "Mark as Milestone"}
                                    >
                                        <Flag className={`w-4 h-4 ${subtask.isMilestone ? 'fill-purple-600 text-purple-600' : 'text-slate-300 hover:text-purple-400'}`} />
                                    </button>
                                    <button onClick={(e) => {e.stopPropagation(); handleDeleteSubtask(subtask.id);}} className="text-slate-300 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100"><Trash className="w-4 h-4" /></button>
                                </div>
                                {expandedSubtaskId === subtask.id && (
                                    <div className="p-4 border-t border-slate-100 bg-white grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-3">
                                            <div>
                                                <label className="text-xs font-medium text-slate-500">Category</label>
                                                <select value={subtask.category} onChange={(e) => handleUpdateSubtask(subtask.id, { category: e.target.value as WorkCategory })} className="w-full text-xs border border-slate-200 rounded px-2 py-1.5 bg-slate-50">
                                                    {Object.values(WorkCategory).map(c => <option key={c} value={c}>{c}</option>)}
                                                </select>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2">
                                                <div>
                                                    <label className="text-xs font-medium text-slate-500">Est. Hours</label>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="0.5"
                                                        value={subtask.estimatedHours || 0}
                                                        onChange={(e) => handleUpdateSubtask(subtask.id, { estimatedHours: parseFloat(e.target.value) || 0 })}
                                                        disabled={!!taskToEdit}
                                                        className={`w-full text-xs border border-slate-200 rounded px-2 py-1.5 ${taskToEdit ? 'bg-slate-50 cursor-not-allowed' : 'bg-white'}`}
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-xs font-medium text-slate-500">Actual Hours</label>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="0.5"
                                                        value={subtask.hoursSpent}
                                                        onChange={(e) => handleUpdateSubtask(subtask.id, { hoursSpent: parseFloat(e.target.value) || 0 })}
                                                        disabled={!taskToEdit}
                                                        className={`w-full text-xs border border-slate-200 rounded px-2 py-1.5 ${!taskToEdit ? 'bg-slate-50 cursor-not-allowed' : 'bg-white'}`}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex flex-col h-full space-y-2">
                                            <div className="flex-1">
                                                <label className="text-xs font-medium text-slate-500 mb-1 block">Notes</label>
                                                <textarea value={subtask.notes} onChange={(e) => handleUpdateSubtask(subtask.id, { notes: e.target.value })} className="w-full text-xs border border-slate-200 rounded px-2 py-1.5 bg-slate-50 h-20 resize-none" placeholder="Details..." />
                                            </div>
                                            <div className="space-y-2">
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="checkbox"
                                                        id={`milestone-${subtask.id}`}
                                                        checked={subtask.isMilestone || false}
                                                        onChange={(e) => handleUpdateSubtask(subtask.id, { isMilestone: e.target.checked })}
                                                        className="w-3 h-3 text-purple-600 rounded border-slate-300 focus:ring-purple-500 cursor-pointer bg-white"
                                                    />
                                                    <label htmlFor={`milestone-${subtask.id}`} className="text-xs font-medium text-slate-600 cursor-pointer flex items-center gap-1 select-none">
                                                        <Flag className="w-3 h-3 text-purple-600" /> Mark as Key Milestone
                                                    </label>
                                                </div>
                                                {subtask.isMilestone && (
                                                    <div className="pl-5 animate-in fade-in slide-in-from-top-1">
                                                        <input
                                                            type="text"
                                                            value={subtask.milestoneDescription || ''}
                                                            onChange={(e) => handleUpdateSubtask(subtask.id, { milestoneDescription: e.target.value })}
                                                            placeholder="e.g., Completed primary tasks, Setup stages complete..."
                                                            className="w-full text-xs border border-purple-200 rounded px-2 py-1.5 bg-purple-50 focus:ring-2 focus:ring-purple-500 outline-none"
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
              </div>

              {/* Right Column: Meta Data */}
              <div className="space-y-6">
                <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 space-y-4">
                    <h3 className="text-xs font-bold uppercase text-slate-500 tracking-wider mb-2">Planning</h3>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs font-medium text-slate-600 mb-1 block">Start Date</label>
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => {
                                    setStartDate(e.target.value);
                                    // If due date is before new start date, adjust it
                                    if (dueDate && e.target.value && dueDate < e.target.value) {
                                        setDueDate(e.target.value);
                                    }
                                }}
                                onClick={handleSafeShowPicker}
                                disabled={!canEditSensitive}
                                className="w-full text-xs border border-slate-300 rounded bg-white px-3 py-2 disabled:opacity-70 disabled:bg-slate-100 cursor-pointer focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-slate-600 mb-1 block">Due Date</label>
                            <input
                                type="date"
                                value={dueDate}
                                onChange={(e) => setDueDate(e.target.value)}
                                onClick={handleSafeShowPicker}
                                min={startDate || undefined}
                                disabled={!canEditSensitive}
                                className="w-full text-xs border border-slate-300 rounded bg-white px-3 py-2 disabled:opacity-70 disabled:bg-slate-100 cursor-pointer focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>
                    </div>

                    <div>
                         <label className="text-xs font-medium text-slate-600 mb-1 block flex items-center gap-1">
                            <UserPlus className="w-3.5 h-3.5" />
                            Assignee
                         </label>
                         <div className="flex items-center gap-2 bg-white border border-slate-300 rounded p-1.5 relative">
                            <select
                                value={assigneeId}
                                onChange={(e) => setAssigneeId(e.target.value)}
                                disabled={!canEditSensitive}
                                className="bg-transparent text-sm w-full outline-none disabled:cursor-not-allowed disabled:text-slate-500 p-1 cursor-pointer"
                            >
                                <option value="">Select User...</option>
                                {assignableTeams.map(team => (
                                    <optgroup key={team.id} label={team.name}>
                                        {assignableUsers.filter(u => u.teamIds && u.teamIds.includes(team.id)).map(user => (
                                            <option key={user.id} value={user.id}>{user.name}</option>
                                        ))}
                                    </optgroup>
                                ))}
                                <optgroup label="Unassigned">
                                    {assignableUsers.filter(u => !u.teamIds || u.teamIds.length === 0).map(user => (
                                        <option key={user.id} value={user.id}>{user.name}</option>
                                    ))}
                                </optgroup>
                            </select>
                         </div>
                         {!canEditSensitive && <p className="text-[10px] text-slate-400 mt-1">Only Admins can change assignees on existing tasks.</p>}
                    </div>

                    {/* Recurring Task Configuration */}
                    <div className="border-t border-slate-200 pt-4">
                        <label className="flex items-center gap-2 text-xs font-medium text-slate-600 mb-3 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={isRecurring}
                                onChange={(e) => setIsRecurring(e.target.checked)}
                                disabled={!canEditSensitive}
                                className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                            />
                            <ArrowUpDown className="w-4 h-4" />
                            Make this a recurring task
                        </label>

                        {isRecurring && (
                            <div className="space-y-3 pl-6 animate-in fade-in slide-in-from-top-2">
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="text-xs text-slate-500 mb-1 block">Frequency</label>
                                        <select
                                            value={recurrenceFrequency}
                                            onChange={(e) => setRecurrenceFrequency(e.target.value as any)}
                                            disabled={!canEditSensitive}
                                            className="w-full text-xs border border-slate-300 rounded bg-white px-2 py-1.5 focus:ring-2 focus:ring-blue-500 outline-none"
                                        >
                                            <option value="DAILY">Daily</option>
                                            <option value="WEEKLY">Weekly</option>
                                            <option value="MONTHLY">Monthly</option>
                                            <option value="YEARLY">Yearly</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-xs text-slate-500 mb-1 block">Every</label>
                                        <input
                                            type="number"
                                            min="1"
                                            max="99"
                                            value={recurrenceInterval}
                                            onChange={(e) => setRecurrenceInterval(parseInt(e.target.value) || 1)}
                                            disabled={!canEditSensitive}
                                            className="w-full text-xs border border-slate-300 rounded bg-white px-2 py-1.5 focus:ring-2 focus:ring-blue-500 outline-none"
                                        />
                                    </div>
                                </div>

                                {recurrenceFrequency === 'WEEKLY' && (
                                    <div>
                                        <label className="text-xs text-slate-500 mb-2 block">Days of Week</label>
                                        <div className="grid grid-cols-7 gap-1">
                                            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
                                                <button
                                                    key={index}
                                                    type="button"
                                                    onClick={() => {
                                                        if (recurrenceWeekDays.includes(index)) {
                                                            setRecurrenceWeekDays(recurrenceWeekDays.filter(d => d !== index));
                                                        } else {
                                                            setRecurrenceWeekDays([...recurrenceWeekDays, index].sort());
                                                        }
                                                    }}
                                                    disabled={!canEditSensitive}
                                                    className={`text-xs py-1.5 rounded font-medium transition-colors ${
                                                        recurrenceWeekDays.includes(index)
                                                            ? 'bg-blue-600 text-white'
                                                            : 'bg-white border border-slate-300 text-slate-600 hover:bg-slate-50'
                                                    }`}
                                                >
                                                    {day}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <p className="text-[10px] text-slate-500 italic">
                                    When completed, a new instance will be created automatically.
                                </p>
                            </div>
                        )}
                    </div>

                    <div>
                         <label className="text-xs font-medium text-slate-600 mb-1 block">Dependencies</label>
                         <div className="space-y-1">
                             {dependencyIds.map(depId => {
                                 const depTask = allTasks.find(t => t.id === depId);
                                 return depTask ? (
                                     <div key={depId} className="flex justify-between items-center bg-white px-2 py-1 rounded border border-slate-200 text-xs">
                                         <span className="truncate max-w-[120px]">{depTask.title}</span>
                                         <button onClick={() => setDependencyIds(dependencyIds.filter(id => id !== depId))}><X className="w-3 h-3 text-slate-400 hover:text-red-500"/></button>
                                     </div>
                                 ) : null;
                             })}
                             <select 
                                onChange={(e) => {
                                    if(e.target.value && !dependencyIds.includes(e.target.value)) {
                                        setDependencyIds([...dependencyIds, e.target.value]);
                                    }
                                }}
                                className="w-full text-xs border border-slate-300 rounded bg-white px-2 py-1.5 mt-1 outline-none focus:border-blue-500"
                                value=""
                             >
                                <option value="">+ Add Dependency</option>
                                {allTasks.filter(t => t.id !== (taskToEdit?.id)).map(t => (
                                    <option key={t.id} value={t.id}>{t.title}</option>
                                ))}
                             </select>
                         </div>
                    </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 z-10">
          <button onClick={onClose} className="px-6 py-2 border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-100 transition-colors">Cancel</button>
          <button onClick={handleSave} className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 shadow-md shadow-blue-600/20">Save Task</button>
        </div>
      </div>
    </div>
  );
};
