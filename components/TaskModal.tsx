import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
    X, Plus, Trash, Wand2, CheckCircle2, Circle, ChevronDown, ChevronRight,
    BarChart2, Upload, Paperclip, Download, ExternalLink,
    Calendar, Flag, Clock, Bell, Link as LinkIcon, MessageSquare,
    Zap, Target, History, ArrowUpDown
} from 'lucide-react';
import { Task, Subtask, ImpactMetric, TaskStatus, ImpactType, WorkCategory, Attachment, Priority, Comment, AutomationRule, User } from '../types';
import { TaskReport } from './TaskReport';

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (task: Task) => void;
  taskToEdit?: Task;
  allTasks?: Task[];
  currentUser: User;
}

type ModalTab = 'DETAILS' | 'STRATEGY' | 'COLLAB' | 'REPORT';

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
    isOpen, onClose, onSave, taskToEdit, allTasks = [], currentUser
}) => {
  const [activeTab, setActiveTab] = useState<ModalTab>('DETAILS');

  // Basic Info
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<TaskStatus>(TaskStatus.TODO);
  const [priority, setPriority] = useState<Priority>(Priority.MEDIUM);

  // Scheduling
  const [startDate, setStartDate] = useState<string>('');
  const [dueDate, setDueDate] = useState<string>('');
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

  // UI States
  const [expandedSubtaskId, setExpandedSubtaskId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [newCommentText, setNewCommentText] = useState('');
  const [showKpiModal, setShowKpiModal] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<TaskStatus | null>(null);
  const [subtaskNeedingHours, setSubtaskNeedingHours] = useState<string | null>(null);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);

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
        setStartDate(toDateString(taskToEdit.startDate));
        setDueDate(toDateString(taskToEdit.dueDate));
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
      } else {
        // Reset for new task
        setTitle('');
        setDescription('');
        setStatus(TaskStatus.TODO);
        setPriority(Priority.MEDIUM);
        setStartDate(new Date().toISOString().split('T')[0]);
        setDueDate('');
        setIsRecurring(false);
        setRecurrenceFrequency('WEEKLY');
        setRecurrenceInterval(1);
        setRecurrenceWeekDays([]);
        setSubtasks([]);
        setImpactMetrics([]);
        setAttachments([]);
        setComments([]);
        setDependencyIds([]);
        setAutomations([]);
        setOkrs([]);
        setNewOkrInput('');
        setMilestone(false);
        setBeforeScenario('');
        setAfterScenario('');
        setImpactNarrative('');
        setResourceLinks([]);
      }
    }
  }, [isOpen, taskToEdit]);

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
    if (updates.completed === true && taskToEdit) {
      const subtask = subtasks.find(s => s.id === id);
      if (subtask && (!subtask.hoursSpent || subtask.hoursSpent === 0)) {
        setSubtaskNeedingHours(id);
        setExpandedSubtaskId(id);
        return;
      }
    }
    // Clear the warning if completing successfully or updating hours
    if (updates.hoursSpent && updates.hoursSpent > 0) {
      setSubtaskNeedingHours(null);
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
    setAttachmentError(null); // Clear any previous errors

    if (e.target.files && e.target.files.length > 0) {
      const filesArray = Array.from(e.target.files);
      const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB in bytes
      const MAX_ATTACHMENTS = 3;

      // Whitelist of allowed file types (security measure)
      const ALLOWED_TYPES = [
        // Documents
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'text/plain',
        'text/csv',
        // Images (safe formats only, excluding SVG for XSS protection)
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
      ];

      const ALLOWED_EXTENSIONS = [
        '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
        '.txt', '.csv', '.jpg', '.jpeg', '.png', '.gif', '.webp'
      ];

      // Check if adding these files would exceed the limit
      if (attachments.length + filesArray.length > MAX_ATTACHMENTS) {
        setAttachmentError(`Maximum ${MAX_ATTACHMENTS} attachments allowed per task. You currently have ${attachments.length}.`);
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }

      // Validate files
      const validFiles: File[] = [];
      const oversizedFiles: string[] = [];
      const invalidTypeFiles: string[] = [];

      filesArray.forEach(file => {
        // Check file size
        if (file.size > MAX_FILE_SIZE) {
          oversizedFiles.push(file.name);
          return;
        }

        // Check file type (MIME type)
        if (!ALLOWED_TYPES.includes(file.type)) {
          invalidTypeFiles.push(file.name);
          return;
        }

        // Check file extension (defense in depth)
        const hasValidExtension = ALLOWED_EXTENSIONS.some(ext =>
          file.name.toLowerCase().endsWith(ext)
        );
        if (!hasValidExtension) {
          invalidTypeFiles.push(file.name);
          return;
        }

        validFiles.push(file);
      });

      // Show errors if any
      if (oversizedFiles.length > 0) {
        setAttachmentError(`File(s) too large (max 5MB): ${oversizedFiles.join(', ')}`);
      } else if (invalidTypeFiles.length > 0) {
        setAttachmentError(`Invalid file type(s): ${invalidTypeFiles.join(', ')}. Allowed: PDF, Word, Excel, PowerPoint, Text, CSV, Images (JPG/PNG/GIF/WEBP)`);
      }

      // Process valid files
      validFiles.forEach(file => {
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
            setAttachments(prev => {
              // Double-check limit in case of race condition
              if (prev.length >= MAX_ATTACHMENTS) {
                setAttachmentError(`Maximum ${MAX_ATTACHMENTS} attachments allowed per task.`);
                return prev;
              }
              return [...prev, newAttachment];
            });
          }
        };
        reader.readAsDataURL(file);
      });
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDeleteAttachment = (id: string) => {
    setAttachments(attachments.filter(a => a.id !== id));
    setAttachmentError(null); // Clear error when file is removed
  };

  const handleDownloadAttachment = (attachment: Attachment) => {
    try {
      // Sanitize filename to prevent path traversal
      const sanitizedFilename = attachment.name.replace(/[^a-zA-Z0-9._-]/g, '_');

      // Create a temporary anchor element for download
      const link = document.createElement('a');
      link.href = attachment.url; // Data URI
      link.download = sanitizedFilename;
      link.style.display = 'none';

      // Trigger download
      document.body.appendChild(link);
      link.click();

      // Cleanup
      setTimeout(() => {
        document.body.removeChild(link);
      }, 100);
    } catch (error) {
      console.error('Download failed:', error);
      setAttachmentError('Failed to download file. Please try again.');
    }
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

  const handleSafeShowPicker = (e: React.MouseEvent<HTMLInputElement>) => {
      try {
          if (typeof e.currentTarget.showPicker === 'function') {
              e.currentTarget.showPicker();
          }
      } catch (err) {
          // Ignore if not supported
      }
  };

  const handleStatusChange = (newStatus: TaskStatus) => {
    // If marking as COMPLETED and there are impact metrics, show KPI modal
    if (newStatus === TaskStatus.COMPLETED &&
        status !== TaskStatus.COMPLETED &&
        impactMetrics.length > 0) {
      setPendingStatus(newStatus);
      setShowKpiModal(true);
    } else {
      setStatus(newStatus);
    }
  };

  const handleKpiModalSave = () => {
    if (pendingStatus) {
      setStatus(pendingStatus);
      setPendingStatus(null);
    }
    setShowKpiModal(false);
  };

  const handleKpiModalCancel = () => {
    setPendingStatus(null);
    setShowKpiModal(false);
  };

  const handleSave = () => {
    if (!title.trim()) return;

    if (!taskToEdit && subtasks.length > 0) {
      const missingEstimates = subtasks.filter(s => !s.estimatedHours || s.estimatedHours === 0);
      if (missingEstimates.length > 0) {
        alert(`Please enter Estimated Hours for all subtasks before creating the task. ${missingEstimates.length} step(s) missing estimates.`);
        return;
      }
    }

    const newTask: Task = {
      id: taskToEdit?.id || '',
      title,
      description,
      status,
      priority,
      startDate: startDate ? new Date(startDate) : undefined,
      dueDate: dueDate ? new Date(dueDate) : undefined,
      creatorId: taskToEdit?.creatorId || currentUser.id,
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
      okrAlignment: okrs.length > 0 ? okrs[0] : '',
      okrs,
      milestone,
      beforeScenario,
      afterScenario,
      impactNarrative,
      resourceLinks,
      activityLog: taskToEdit?.activityLog || []
    };

    onSave(newTask);
    onClose();
  };

  if (!isOpen) return null;

  const currentTaskState: Task = {
      id: taskToEdit?.id || 'temp',
      title, description, status, priority,
      startDate: startDate ? new Date(startDate) : undefined,
      dueDate: dueDate ? new Date(dueDate) : undefined,
      creatorId: currentUser.id,
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
      resourceLinks,
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
                    className="text-2xl font-bold text-slate-800 placeholder-slate-300 border-none focus:ring-0 p-0 w-full bg-transparent"
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
                        onChange={(e) => handleStatusChange(e.target.value as TaskStatus)}
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
                        className={`text-sm font-semibold pl-3 pr-8 py-1.5 rounded-full border-none focus:ring-2 focus:ring-offset-1 outline-none appearance-none cursor-pointer
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
                        Notes {comments.length > 0 && <span className="bg-blue-100 text-blue-700 text-xs px-1.5 rounded-full">{comments.length}</span>}
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

          {/* TAB: NOTES/COLLAB */}
          {activeTab === 'COLLAB' && (
              <div className="p-8 max-w-4xl mx-auto space-y-6">
                 {/* Attachments Section */}
                 <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                <Paperclip className="w-4 h-4" /> Attachments
                            </h3>
                            <span className="text-xs text-slate-500">
                                ({attachments.length}/3, max 5MB each)
                            </span>
                        </div>
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={attachments.length >= 3}
                            className={`text-xs font-medium flex items-center px-3 py-1 rounded-full transition-colors ${
                                attachments.length >= 3
                                    ? 'text-slate-400 bg-slate-100 cursor-not-allowed'
                                    : 'text-blue-600 hover:text-blue-700 bg-blue-50'
                            }`}
                        >
                            <Upload className="w-3 h-3 mr-1" /> Upload
                        </button>
                        <input type="file" ref={fileInputRef} className="hidden" multiple onChange={handleFileUpload} />
                    </div>
                    {attachmentError && (
                        <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg animate-in fade-in slide-in-from-top-1">
                            <p className="text-xs text-red-600 flex items-center gap-2">
                                <Bell className="w-4 h-4" />
                                {attachmentError}
                            </p>
                        </div>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                        {attachments.length === 0 && <p className="text-slate-400 text-xs italic col-span-2">No files attached.</p>}
                        {attachments.map(file => (
                          <div key={file.id} className="flex items-center p-2 bg-slate-50 border border-slate-200 rounded-lg group hover:bg-slate-100 transition-colors">
                             <div className="p-1.5 bg-white rounded mr-2"><Paperclip className="w-4 h-4 text-slate-500" /></div>
                             <div className="flex-1 min-w-0">
                                <h4 className="text-xs font-medium truncate">{file.name}</h4>
                                <p className="text-xs text-slate-400">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                             </div>
                             <div className="flex items-center gap-1">
                                <button
                                    onClick={() => handleDownloadAttachment(file)}
                                    className="p-1 text-slate-400 hover:text-blue-600 transition-colors"
                                    title="Download file"
                                >
                                    <Download className="w-3.5 h-3.5" />
                                </button>
                                <button
                                    onClick={() => handleDeleteAttachment(file.id)}
                                    className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                                    title="Delete file"
                                >
                                    <Trash className="w-3.5 h-3.5" />
                                </button>
                             </div>
                          </div>
                        ))}
                    </div>
                 </div>

                 {/* Links */}
                 <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2"><LinkIcon className="w-4 h-4" /> Resources</h3>
                    <div className="space-y-2">
                        {resourceLinks.map((link, idx) => (
                            <div key={idx} className="flex gap-2 items-center">
                                <input
                                    className="flex-1 border border-slate-200 rounded px-2 py-1 text-sm bg-white"
                                    value={link.title}
                                    onChange={(e) => {
                                        const newLinks = [...resourceLinks];
                                        newLinks[idx].title = e.target.value;
                                        setResourceLinks(newLinks);
                                    }}
                                    placeholder="Resource Title"
                                />
                                <input
                                    className="flex-1 border border-slate-200 rounded px-2 py-1 text-sm bg-white"
                                    value={link.url}
                                    onChange={(e) => {
                                        const newLinks = [...resourceLinks];
                                        newLinks[idx].url = e.target.value;
                                        setResourceLinks(newLinks);
                                    }}
                                    placeholder="https://example.com"
                                />
                                {link.url && link.url.trim() && (
                                    <a
                                        href={link.url.startsWith('http') ? link.url : `https://${link.url}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="p-1.5 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors"
                                        title="Open in new tab"
                                    >
                                        <ExternalLink className="w-4 h-4" />
                                    </a>
                                )}
                                <button
                                    onClick={() => setResourceLinks(resourceLinks.filter((_, i) => i !== idx))}
                                    className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
                                    title="Remove link"
                                >
                                    <Trash className="w-4 h-4"/>
                                </button>
                            </div>
                        ))}
                        <button onClick={() => setResourceLinks([...resourceLinks, {title: '', url: ''}])} className="text-sm text-blue-600 hover:underline flex items-center gap-1">
                            <Plus className="w-3 h-3" /> Add Link
                        </button>
                    </div>
                 </div>

                 {/* Notes */}
                 <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2"><MessageSquare className="w-4 h-4" /> Notes</h3>
                    <div className="space-y-4 mb-6 max-h-[300px] overflow-y-auto">
                        {comments.length === 0 && <p className="text-slate-400 text-sm italic">No notes yet.</p>}
                        {comments.map(c => (
                            <div key={c.id} className="flex gap-3">
                                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-xs font-bold flex-shrink-0">
                                    {currentUser.avatarInitials}
                                </div>
                                <div className="flex-1">
                                    <div className="bg-slate-50 p-3 rounded-lg rounded-tl-none border border-slate-100">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="text-xs font-bold text-slate-700">{currentUser.name}</span>
                                            <span className="text-[10px] text-slate-400">{new Date(c.createdAt).toLocaleString()}</span>
                                        </div>
                                        <p className="text-sm text-slate-600">{c.text}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={newCommentText}
                            onChange={(e) => setNewCommentText(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
                            placeholder="Add a note..."
                            className="flex-1 border border-slate-300 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                        />
                        <button onClick={handleAddComment} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Add</button>
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
                                <div className="w-1/2 md:w-1/6">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Target</label>
                                    <input
                                        type="number"
                                        value={metric.value}
                                        onChange={(e) => handleUpdateMetric(metric.id, { value: parseFloat(e.target.value) })}
                                        className="w-full text-xs border border-slate-200 rounded px-2 py-1.5 bg-white outline-none focus:border-blue-500"
                                    />
                                </div>
                                {taskToEdit && (
                                    <div className="w-1/2 md:w-1/6">
                                        <label className="text-[10px] font-bold text-emerald-600 uppercase mb-1 block">Achieved</label>
                                        <input
                                            type="number"
                                            value={metric.achievedValue || 0}
                                            onChange={(e) => handleUpdateMetric(metric.id, { achievedValue: parseFloat(e.target.value) || 0 })}
                                            className="w-full text-xs border border-emerald-200 rounded px-2 py-1.5 bg-emerald-50 outline-none focus:border-emerald-500 font-semibold"
                                            placeholder="0"
                                        />
                                    </div>
                                )}
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

                {/* AI Flowchart Section */}
              </div>
          )}

          {/* TAB: DETAILS */}
          {activeTab === 'DETAILS' && (
            <div className="p-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Left Column: Main Content */}
              <div className="lg:col-span-2 space-y-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full px-4 py-3 bg-white text-slate-900 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all h-32 resize-none shadow-sm"
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
                                <div className="flex items-center gap-3 p-3 bg-slate-50/50 hover:bg-white transition-colors">
                                    <button onClick={() => toggleSubtaskExpand(subtask.id)} className="text-slate-400 hover:text-slate-600">
                                        {expandedSubtaskId === subtask.id ? <ChevronDown className="w-4 h-4"/> : <ChevronRight className="w-4 h-4"/>}
                                    </button>
                                    <button onClick={() => handleUpdateSubtask(subtask.id, { completed: !subtask.completed })} className={`${subtask.completed ? 'text-green-500' : 'text-slate-300 hover:text-slate-400'}`}>
                                        {subtask.completed ? <CheckCircle2 className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
                                    </button>
                                    <input
                                        type="text"
                                        value={subtask.title}
                                        onChange={(e) => handleUpdateSubtask(subtask.id, { title: e.target.value })}
                                        className={`bg-transparent border-none focus:ring-0 p-0 text-sm font-medium w-full ${subtask.completed ? 'line-through text-slate-400' : 'text-slate-700'}`}
                                    />
                                    <button
                                        onClick={() => handleUpdateSubtask(subtask.id, { isMilestone: !subtask.isMilestone })}
                                        className={`p-1 rounded hover:bg-slate-100 transition-colors ${subtask.isMilestone ? 'bg-white' : 'bg-white'}`}
                                        title={subtask.isMilestone ? "This is a milestone" : "Mark as Milestone"}
                                    >
                                        <Flag className={`w-4 h-4 ${subtask.isMilestone ? 'fill-purple-600 text-purple-600' : 'text-slate-300 hover:text-purple-400'}`} />
                                    </button>
                                    <button onClick={() => handleDeleteSubtask(subtask.id)} className="text-slate-300 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100"><Trash className="w-4 h-4" /></button>
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
                                                        className={`w-full text-xs border ${subtaskNeedingHours === subtask.id ? 'border-red-400 ring-2 ring-red-200' : 'border-slate-200'} rounded px-2 py-1.5 ${!taskToEdit ? 'bg-slate-50 cursor-not-allowed' : 'bg-white'}`}
                                                    />
                                                    {subtaskNeedingHours === subtask.id && (
                                                        <p className="text-xs text-red-600 mt-1 animate-in fade-in slide-in-from-top-1 flex items-center gap-1">
                                                            <Bell className="w-3 h-3" />
                                                            Please enter actual hours before completing
                                                        </p>
                                                    )}
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
                                    if (dueDate && e.target.value && dueDate < e.target.value) {
                                        setDueDate(e.target.value);
                                    }
                                }}
                                onClick={handleSafeShowPicker}
                                className="w-full text-xs border border-slate-300 rounded bg-white px-3 py-2 cursor-pointer focus:ring-2 focus:ring-blue-500 outline-none"
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
                                className="w-full text-xs border border-slate-300 rounded bg-white px-3 py-2 cursor-pointer focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>
                    </div>

                    {/* Recurring Task Configuration */}
                    <div className="border-t border-slate-200 pt-4">
                        <label className="flex items-center gap-2 text-xs font-medium text-slate-600 mb-3 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={isRecurring}
                                onChange={(e) => setIsRecurring(e.target.checked)}
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

      {/* KPI Achievement Modal */}
      {showKpiModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col border border-slate-200 animate-in fade-in slide-in-from-top-4">
            <div className="px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-green-50 to-emerald-50">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <CheckCircle2 className="w-6 h-6 text-green-600" />
                Record KPI Achievements
              </h2>
              <p className="text-sm text-slate-600 mt-1">Enter the actual results achieved for each KPI target</p>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {impactMetrics.map(metric => (
                <div key={metric.id} className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="text-sm font-bold text-slate-800">{metric.type}</h3>
                      {metric.description && (
                        <p className="text-xs text-slate-500 mt-0.5">{metric.description}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-slate-500 uppercase font-medium">Target</div>
                      <div className="text-lg font-bold text-blue-600">
                        {metric.type === ImpactType.REVENUE && metric.currency && `${metric.currency} `}
                        {metric.value.toLocaleString()}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <label className="text-xs font-medium text-slate-700 mb-1 block">
                        Actual Achieved {metric.type === ImpactType.REVENUE && `(${metric.currency})`}
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={metric.achievedValue || 0}
                        onChange={(e) => handleUpdateMetric(metric.id, { achievedValue: parseFloat(e.target.value) || 0 })}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none text-lg font-semibold"
                        placeholder="0"
                        autoFocus={impactMetrics[0].id === metric.id}
                      />
                    </div>
                    <div className="pt-6">
                      {metric.achievedValue !== undefined && metric.achievedValue >= metric.value ? (
                        <div className="flex items-center gap-1 text-green-600 bg-green-50 px-3 py-2 rounded-lg">
                          <CheckCircle2 className="w-5 h-5" />
                          <span className="text-sm font-bold">Target Met!</span>
                        </div>
                      ) : metric.achievedValue !== undefined && metric.achievedValue > 0 ? (
                        <div className="text-sm text-slate-600">
                          <span className="font-semibold">{((metric.achievedValue / metric.value) * 100).toFixed(0)}%</span>
                          <div className="text-xs text-slate-500">of target</div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}

              {impactMetrics.length === 0 && (
                <div className="text-center py-8 text-slate-400">
                  <BarChart2 className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No KPIs to record</p>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-3">
              <button
                onClick={handleKpiModalCancel}
                className="px-6 py-2 border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleKpiModalSave}
                className="px-6 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 shadow-md shadow-green-600/20 transition-colors"
              >
                Save & Mark Complete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
