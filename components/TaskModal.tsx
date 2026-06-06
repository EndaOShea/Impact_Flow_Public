import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
    X, Plus, Trash, Wand2, CheckCircle2, Circle, ChevronDown, ChevronUp, ChevronRight,
    BarChart2, Upload, Paperclip, Download, ExternalLink,
    Calendar, Flag, Clock, Bell, Link as LinkIcon, MessageSquare,
    Zap, Target, History, ArrowUpDown, Briefcase, Users, AlertCircle as AlertCircleIcon
} from 'lucide-react';
import { Task, Subtask, ImpactMetric, TaskStatus, ImpactType, WorkCategory, Attachment, Priority, Comment, AutomationRule, User, Project, TaskBlocker } from '../types';
import { TaskReport } from './TaskReport';
import { api } from '../services/api';
import { statusTagClass, statusLabel, priorityClass, currencySymbol } from '../lib/display';

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (task: Task) => void;
  taskToEdit?: Task;
  allTasks?: Task[];
  projects?: Project[];
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
    isOpen, onClose, onSave, taskToEdit, allTasks = [], projects = [], currentUser
}) => {
  const [activeTab, setActiveTab] = useState<ModalTab>('DETAILS');

  // Basic Info
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<TaskStatus>(TaskStatus.TODO);
  const [priority, setPriority] = useState<Priority>(Priority.MEDIUM);
  const [projectId, setProjectId] = useState<string>('');
  const [blockers, setBlockers] = useState<TaskBlocker[]>([]);

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
        setProjectId(taskToEdit.projectId || '');
        setBlockers([...(taskToEdit.blockers || [])]);
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
        setProjectId('');
        setBlockers([]);
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

  const handleMoveSubtaskUp = (id: string) => {
    const index = subtasks.findIndex(s => s.id === id);
    if (index <= 0) return;
    const updated = [...subtasks];
    [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
    setSubtasks(updated);
  };

  const handleMoveSubtaskDown = (id: string) => {
    const index = subtasks.findIndex(s => s.id === id);
    if (index === -1 || index >= subtasks.length - 1) return;
    const updated = [...subtasks];
    [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
    setSubtasks(updated);
  };

  const handleAddMetric = () => {
    const newMetric: ImpactMetric = {
      id: crypto.randomUUID(),
      type: ImpactType.REVENUE,
      value: 0,
      currency: 'EUR',
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

    // Validate dates
    if (startDate && dueDate) {
      const start = new Date(startDate);
      const due = new Date(dueDate);
      if (due < start) {
        alert('Due date cannot be before start date');
        return;
      }
    }

    // Validate task dates are within project dates
    if (projectId) {
      const selectedProject = projects.find(p => p.id === projectId);
      if (selectedProject) {
        if (startDate && selectedProject.startDate) {
          const taskStart = new Date(startDate);
          const projStart = new Date(selectedProject.startDate);
          if (taskStart < projStart) {
            alert(`Task start date cannot be before project start date (${projStart.toLocaleDateString()})`);
            return;
          }
        }

        if (dueDate && selectedProject.targetEndDate) {
          const taskDue = new Date(dueDate);
          const projEnd = new Date(selectedProject.targetEndDate);
          if (taskDue > projEnd) {
            alert(`Task due date cannot be after project end date (${projEnd.toLocaleDateString()})`);
            return;
          }
        }
      }
    }

    const newTask: Task = {
      id: taskToEdit?.id || '',
      title,
      description,
      status,
      priority,
      projectId: projectId || undefined,
      projectTitle: projectId ? projects.find(p => p.id === projectId)?.title : undefined,
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
      blockers,
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

  // Get team members from selected project
  const availableTeamMembers = useMemo(() => {
    if (!projectId) return [];
    const selectedProject = projects.find(p => p.id === projectId);
    return selectedProject?.teamMembers || [];
  }, [projectId, projects]);

  // Blocker handlers
  const handleAddBlocker = async (teamMemberId: string, reason: string) => {
    if (!taskToEdit?.id || !teamMemberId) return;

    try {
      const newBlocker = await api.addTaskBlocker(taskToEdit.id, teamMemberId, reason);
      setBlockers([...blockers, newBlocker]);
    } catch (error) {
      console.error('Failed to add blocker:', error);
      alert('Failed to add blocker. Please try again.');
    }
  };

  const handleRemoveBlocker = async (blockerId: string) => {
    if (!taskToEdit?.id) return;

    try {
      await api.deleteTaskBlocker(taskToEdit.id, blockerId);
      setBlockers(blockers.filter(b => b.id !== blockerId));
    } catch (error) {
      console.error('Failed to remove blocker:', error);
      alert('Failed to remove blocker. Please try again.');
    }
  };

  const handleResolveBlocker = async (blockerId: string) => {
    if (!taskToEdit?.id) return;

    try {
      const updatedBlocker = await api.resolveTaskBlocker(taskToEdit.id, blockerId);
      setBlockers(blockers.map(b => b.id === blockerId ? { ...b, resolvedAt: updatedBlocker.resolvedAt } : b));
    } catch (error) {
      console.error('Failed to resolve blocker:', error);
      alert('Failed to resolve blocker. Please try again.');
    }
  };

  if (!isOpen) return null;

  const currentTaskState: Task = {
      id: taskToEdit?.id || 'temp',
      title, description, status, priority,
      projectId: projectId || undefined,
      projectTitle: projectId ? projects.find(p => p.id === projectId)?.title : undefined,
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
      blockers,
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
    <div className="overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={{ width: 'min(94vw, 920px)', height: 'min(88vh, 720px)' }}>

        {/* Header */}
        <div className="modal-h">
            <span className="proj-badge" style={{ width: 36, height: 36, borderRadius: 11, fontSize: 13, background: 'var(--accent-soft)', color: 'var(--accent)', borderColor: 'transparent' }}>
                {taskToEdit ? <Target className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            </span>
            <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="modal-title"
                placeholder="Task Title"
            />
            <div className="seg" style={{ marginRight: 4 }}>
                <button
                    onClick={() => handleStatusChange(status)}
                    className="on"
                    style={{ cursor: 'default', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                    tabIndex={-1}
                    type="button"
                >
                    <span className={'tag ' + statusTagClass(status)} style={{ border: 'none', background: 'none', padding: 0 }}>{statusLabel(status)}</span>
                </button>
            </div>
            <button className="icon-btn" onClick={onClose}><X className="w-5 h-5" /></button>
        </div>

        {/* Inline classification controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '12px 24px 0' }}>
            <div className="field" style={{ marginBottom: 0, minWidth: 150 }}>
                <select
                    value={status}
                    onChange={(e) => handleStatusChange(e.target.value as TaskStatus)}
                    className="input"
                >
                    {availableStatuses.map(s => <option key={s} value={s}>{statusLabel(s)}</option>)}
                </select>
            </div>
            <div className="field" style={{ marginBottom: 0, minWidth: 130 }}>
                <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as Priority)}
                    className="input"
                >
                    {Object.values(Priority).map(p => <option key={p} value={p}>{p}</option>)}
                </select>
            </div>
            <div className="field" style={{ marginBottom: 0, minWidth: 160 }}>
                <select
                    value={projectId}
                    onChange={(e) => setProjectId(e.target.value)}
                    className="input"
                >
                    <option value="">No Project</option>
                    {projects.map(p => (
                        <option key={p.id} value={p.id}>{p.title}</option>
                    ))}
                </select>
            </div>
            <span className={'pri ' + priorityClass(priority)}>{priority}</span>
        </div>

        {/* Tabs */}
        <div className="modal-tabs">
            <button
                onClick={() => setActiveTab('DETAILS')}
                className={'modal-tab' + (activeTab === 'DETAILS' ? ' on' : '')}
            >
                Details
            </button>
            <button
                onClick={() => setActiveTab('STRATEGY')}
                className={'modal-tab' + (activeTab === 'STRATEGY' ? ' on' : '')}
            >
                Strategy
            </button>
            <button
                onClick={() => setActiveTab('COLLAB')}
                className={'modal-tab' + (activeTab === 'COLLAB' ? ' on' : '')}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
                Notes {comments.length > 0 && <span className="tag" style={{ padding: '2px 8px' }}>{comments.length}</span>}
            </button>
            <button
                onClick={() => setActiveTab('REPORT')}
                className={'modal-tab' + (activeTab === 'REPORT' ? ' on' : '')}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
                <BarChart2 className="w-4 h-4" /> Report
            </button>
        </div>

        {/* Content Scroll Area */}
        <div className="modal-body">

          {/* TAB: REPORT */}
          {activeTab === 'REPORT' && (
             <div style={{ maxWidth: 880, margin: '0 auto' }}>
                 <TaskReport task={currentTaskState} />
             </div>
          )}

          {/* TAB: NOTES/COLLAB */}
          {activeTab === 'COLLAB' && (
              <div style={{ maxWidth: 880, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
                 {/* Attachments Section */}
                 <div className="subpanel">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, gap: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div className="ph" style={{ marginBottom: 0, display: 'flex', alignItems: 'center', gap: 7 }}>
                                <Paperclip className="w-4 h-4" /> ATTACHMENTS
                            </div>
                            <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                                ({attachments.length}/3, max 5MB each)
                            </span>
                        </div>
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={attachments.length >= 3}
                            className="btn-g btn"
                            style={attachments.length >= 3 ? { opacity: .5, cursor: 'not-allowed' } : undefined}
                        >
                            <Upload className="w-3 h-3" /> Upload
                        </button>
                        <input type="file" ref={fileInputRef} style={{ display: 'none' }} multiple onChange={handleFileUpload} />
                    </div>
                    {attachmentError && (
                        <div className="animate-in fade-in slide-in-from-top-1" style={{ marginBottom: 12, padding: 12, background: 'var(--red-bg)', border: '1px solid var(--red)', borderRadius: 'var(--radius-sm)' }}>
                            <p style={{ fontSize: 12, color: 'var(--red-ink)', display: 'flex', alignItems: 'center', gap: 8 }}>
                                <Bell className="w-4 h-4" />
                                {attachmentError}
                            </p>
                        </div>
                    )}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        {attachments.length === 0 && <p style={{ color: 'var(--faint)', fontSize: 12, fontStyle: 'italic', gridColumn: '1 / -1' }}>No files attached.</p>}
                        {attachments.map(file => (
                          <div key={file.id} style={{ display: 'flex', alignItems: 'center', padding: 8, background: 'var(--inset)', border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)' }}>
                             <div style={{ padding: 6, background: 'var(--panel)', borderRadius: 8, marginRight: 8 }}><Paperclip className="w-4 h-4" style={{ color: 'var(--muted)' }} /></div>
                             <div style={{ flex: 1, minWidth: 0 }}>
                                <h4 style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--ink)' }}>{file.name}</h4>
                                <p style={{ fontSize: 12, color: 'var(--faint)' }}>{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                             </div>
                             <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <button
                                    onClick={() => handleDownloadAttachment(file)}
                                    className="icon-btn"
                                    style={{ width: 30, height: 30 }}
                                    title="Download file"
                                >
                                    <Download className="w-3.5 h-3.5" />
                                </button>
                                <button
                                    onClick={() => handleDeleteAttachment(file.id)}
                                    className="icon-btn"
                                    style={{ width: 30, height: 30, color: 'var(--red)' }}
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
                 <div className="subpanel">
                    <div className="ph" style={{ display: 'flex', alignItems: 'center', gap: 7 }}><LinkIcon className="w-4 h-4" /> RESOURCES</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {resourceLinks.map((link, idx) => (
                            <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                <input
                                    className="input"
                                    style={{ flex: 1 }}
                                    value={link.title}
                                    onChange={(e) => {
                                        const newLinks = [...resourceLinks];
                                        newLinks[idx].title = e.target.value;
                                        setResourceLinks(newLinks);
                                    }}
                                    placeholder="Resource Title"
                                />
                                <input
                                    className="input"
                                    style={{ flex: 1 }}
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
                                        className="icon-btn"
                                        style={{ flex: '0 0 auto', color: 'var(--accent)' }}
                                        title="Open in new tab"
                                    >
                                        <ExternalLink className="w-4 h-4" />
                                    </a>
                                )}
                                <button
                                    onClick={() => setResourceLinks(resourceLinks.filter((_, i) => i !== idx))}
                                    className="icon-btn"
                                    style={{ flex: '0 0 auto', color: 'var(--red)' }}
                                    title="Remove link"
                                >
                                    <Trash className="w-4 h-4"/>
                                </button>
                            </div>
                        ))}
                        <button onClick={() => setResourceLinks([...resourceLinks, {title: '', url: ''}])} className="btn-ghost btn" style={{ alignSelf: 'flex-start' }}>
                            <Plus className="w-3 h-3" /> Add Link
                        </button>
                    </div>
                 </div>

                 {/* Blockers */}
                 {projectId && taskToEdit && (
                   <div className="subpanel">
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                        <div className="ph" style={{ marginBottom: 0, display: 'flex', alignItems: 'center', gap: 7 }}>
                          <AlertCircleIcon className="w-4 h-4" style={{ color: 'var(--red)' }} /> BLOCKERS
                        </div>
                        {availableTeamMembers.length === 0 && (
                          <p style={{ fontSize: 12, color: 'var(--faint)', fontStyle: 'italic' }}>Add team members to the project first</p>
                        )}
                      </div>

                      {blockers.length === 0 && (
                        <p style={{ color: 'var(--faint)', fontSize: 13, fontStyle: 'italic', marginBottom: 14 }}>No blockers assigned.</p>
                      )}

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 14 }}>
                        {blockers.map(blocker => (
                          <div key={blocker.id} style={{ padding: 12, borderRadius: 'var(--radius-sm)', border: '1px solid', background: blocker.resolvedAt ? 'var(--green-bg)' : 'var(--red-bg)', borderColor: blocker.resolvedAt ? 'var(--green)' : 'var(--red)' }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                              <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                  <Users className="w-4 h-4" style={{ color: 'var(--ink2)' }} />
                                  <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--ink)' }}>{blocker.teamMemberName}</span>
                                  {blocker.resolvedAt && (
                                    <span className="tag t-done" style={{ background: 'var(--green)', color: '#fff', border: 'none' }}>Resolved</span>
                                  )}
                                </div>
                                {blocker.reason && (
                                  <p style={{ fontSize: 13, color: 'var(--ink2)', marginLeft: 24 }}>{blocker.reason}</p>
                                )}
                                <p style={{ fontSize: 12, color: 'var(--faint)', marginLeft: 24, marginTop: 4 }}>
                                  Added {new Date(blocker.createdAt).toLocaleDateString()}
                                  {blocker.resolvedAt && ` • Resolved ${new Date(blocker.resolvedAt).toLocaleDateString()}`}
                                </p>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                {!blocker.resolvedAt && (
                                  <button
                                    onClick={() => handleResolveBlocker(blocker.id)}
                                    className="icon-btn"
                                    style={{ width: 30, height: 30, color: 'var(--green)' }}
                                    title="Mark as resolved"
                                  >
                                    <CheckCircle2 className="w-4 h-4" />
                                  </button>
                                )}
                                <button
                                  onClick={() => handleRemoveBlocker(blocker.id)}
                                  className="icon-btn"
                                  style={{ width: 30, height: 30, color: 'var(--red)' }}
                                  title="Remove blocker"
                                >
                                  <Trash className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {availableTeamMembers.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <select
                            id="blocker-select"
                            className="input"
                            defaultValue=""
                            onChange={(e) => {
                              const memberId = e.target.value;
                              if (memberId) {
                                const reason = prompt('Reason for blocking (optional):');
                                handleAddBlocker(memberId, reason || '');
                                e.target.value = '';
                              }
                            }}
                          >
                            <option value="">+ Add Team Member as Blocker</option>
                            {availableTeamMembers
                              .filter(tm => !blockers.some(b => b.teamMemberId === tm.id && !b.resolvedAt))
                              .map(tm => (
                                <option key={tm.id} value={tm.id}>{tm.name} {tm.role && `(${tm.role})`}</option>
                              ))
                            }
                          </select>
                          <p style={{ fontSize: 12, color: 'var(--muted)', fontStyle: 'italic' }}>
                            Team members who are blocking this task from being completed
                          </p>
                        </div>
                      )}
                   </div>
                 )}

                 {/* Notes */}
                 <div className="subpanel">
                    <div className="ph" style={{ display: 'flex', alignItems: 'center', gap: 7 }}><MessageSquare className="w-4 h-4" /> NOTES</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 16, maxHeight: 300, overflowY: 'auto' }}>
                        {comments.length === 0 && <p style={{ color: 'var(--faint)', fontSize: 13, fontStyle: 'italic' }}>No notes yet.</p>}
                        {comments.map(c => (
                            <div key={c.id} style={{ display: 'flex', gap: 12 }}>
                                <span className="ava" style={{ background: 'var(--accent-soft)', color: 'var(--accent)', border: 'none' }}>
                                    {currentUser.avatarInitials}
                                </span>
                                <div style={{ flex: 1 }}>
                                    <div style={{ background: 'var(--inset)', padding: 12, borderRadius: 'var(--radius-sm)', borderTopLeftRadius: 0, border: '1px solid var(--line)' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink2)' }}>{currentUser.name}</span>
                                            <span style={{ fontSize: 10, color: 'var(--faint)' }}>{new Date(c.createdAt).toLocaleString()}</span>
                                        </div>
                                        <p style={{ fontSize: 13, color: 'var(--ink2)' }}>{c.text}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <input
                            type="text"
                            value={newCommentText}
                            onChange={(e) => setNewCommentText(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
                            placeholder="Add a note..."
                            className="input"
                            style={{ flex: 1 }}
                        />
                        <button onClick={handleAddComment} className="btn">Add</button>
                    </div>
                 </div>
              </div>
          )}

          {/* TAB: STRATEGY */}
          {activeTab === 'STRATEGY' && (
              <div style={{ maxWidth: 880, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>

                {/* KPI Section */}
                <div className="subpanel">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                        <div className="ph" style={{ marginBottom: 0, display: 'flex', alignItems: 'center', gap: 7 }}>
                            <BarChart2 className="w-4 h-4" style={{ color: 'var(--accent)' }} /> KEY PERFORMANCE INDICATORS (KPIS)
                        </div>
                        <button onClick={handleAddMetric} className="btn-g btn"><Plus className="w-3 h-3" /> Add Metric</button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {impactMetrics.map(metric => (
                            <div key={metric.id} className="animate-in fade-in" style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-start', background: 'var(--inset)', padding: 12, borderRadius: 'var(--radius-sm)', border: '1px solid var(--line)' }}>
                                <div className="field" style={{ marginBottom: 0, flex: '1 1 180px' }}>
                                    <label>Type</label>
                                    <select
                                        value={metric.type}
                                        onChange={(e) => handleUpdateMetric(metric.id, { type: e.target.value as ImpactType })}
                                        className="input"
                                    >
                                        {Object.values(ImpactType).map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                </div>
                                <div className="field" style={{ marginBottom: 0, flex: '1 1 100px' }}>
                                    <label>Target</label>
                                    <input
                                        type="number"
                                        value={metric.value}
                                        onChange={(e) => handleUpdateMetric(metric.id, { value: parseFloat(e.target.value) })}
                                        className="input"
                                    />
                                </div>
                                {taskToEdit && (
                                    <div className="field" style={{ marginBottom: 0, flex: '1 1 100px' }}>
                                        <label style={{ color: 'var(--green-ink)' }}>Achieved</label>
                                        <input
                                            type="number"
                                            value={metric.achievedValue ?? ''}
                                            onChange={(e) => {
                                                const value = e.target.value;
                                                handleUpdateMetric(metric.id, {
                                                    achievedValue: value === '' ? undefined : parseFloat(value)
                                                });
                                            }}
                                            className="input"
                                            style={{ background: 'var(--green-bg)', borderColor: 'var(--green)', fontWeight: 600 }}
                                            placeholder="0"
                                        />
                                    </div>
                                )}
                                {metric.type === ImpactType.REVENUE && (
                                    <div className="field" style={{ marginBottom: 0, flex: '1 1 100px' }}>
                                        <label>Currency</label>
                                        <select
                                           value={metric.currency}
                                           onChange={(e) => handleUpdateMetric(metric.id, { currency: e.target.value as any })}
                                           className="input"
                                        >
                                            <option value="USD">USD</option>
                                            <option value="EUR">EUR</option>
                                            <option value="GBP">GBP</option>
                                        </select>
                                    </div>
                                )}
                                <div className="field" style={{ marginBottom: 0, flex: '2 1 200px' }}>
                                    <label>Context</label>
                                    <input
                                        type="text"
                                        value={metric.description}
                                        onChange={(e) => handleUpdateMetric(metric.id, { description: e.target.value })}
                                        placeholder="e.g. Q3 Revenue Target"
                                        className="input"
                                    />
                                </div>
                                <button onClick={() => handleDeleteMetric(metric.id)} className="icon-btn" style={{ marginTop: 24, width: 34, height: 34, color: 'var(--red)' }}>
                                    <Trash className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                        {impactMetrics.length === 0 && (
                            <div style={{ textAlign: 'center', padding: '24px 12px', border: '2px dashed var(--line)', borderRadius: 'var(--radius-sm)', color: 'var(--faint)', fontSize: 12 }}>
                                No KPIs defined. Add metrics to track success.
                            </div>
                        )}
                    </div>
                </div>

                {/* OKRs */}
                <div className="subpanel">
                    <div className="ph" style={{ display: 'flex', alignItems: 'center', gap: 7 }}><Target className="w-4 h-4" style={{ color: 'var(--red)' }} /> STRATEGIC ALIGNMENT (OKRS)</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                        {okrs.map((okr, index) => (
                            <div key={index} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--inset)', padding: 8, borderRadius: 'var(--radius-sm)', border: '1px solid var(--line)' }}>
                                <span style={{ flex: 1, fontSize: 13, color: 'var(--ink2)' }}>{okr}</span>
                                <button onClick={() => handleRemoveOkr(index)} className="icon-btn" style={{ width: 28, height: 28, color: 'var(--red)' }}>
                                    <Trash className="w-3 h-3" />
                                </button>
                            </div>
                        ))}
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <input
                            type="text"
                            value={newOkrInput}
                            onChange={(e) => setNewOkrInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAddOkr()}
                            className="input"
                            style={{ flex: 1 }}
                            placeholder="Add new OKR (e.g. Increase Q3 Efficiency by 15%)..."
                        />
                        <button onClick={handleAddOkr} className="btn-g btn">
                            Add OKR
                        </button>
                    </div>
                </div>

                <div className="subpanel">
                    <div className="ph" style={{ display: 'flex', alignItems: 'center', gap: 7 }}><History className="w-4 h-4" /> IMPACT COMPARISON</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
                        <div className="field" style={{ marginBottom: 0 }}>
                            <label>Before Scenario</label>
                            <textarea
                                value={beforeScenario}
                                onChange={(e) => setBeforeScenario(e.target.value)}
                                className="textarea"
                                style={{ minHeight: 96 }}
                                placeholder="Describe the current state..."
                            />
                        </div>
                        <div className="field" style={{ marginBottom: 0 }}>
                            <label>Expected Outcome</label>
                            <textarea
                                value={afterScenario}
                                onChange={(e) => setAfterScenario(e.target.value)}
                                className="textarea"
                                style={{ minHeight: 96 }}
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
            <div style={{ maxWidth: 980, margin: '0 auto', display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(280px, 1fr)', gap: 22 }}>
              {/* Left Column: Main Content */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
                <div className="field" style={{ marginBottom: 0 }}>
                  <label>Description</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="textarea"
                    placeholder="Detailed description of the task..."
                  />
                </div>

                {/* Subtasks */}
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                        <div className="ph" style={{ marginBottom: 0 }}>WORK BREAKDOWN</div>
                        <button onClick={handleAddSubtask} className="btn-g btn">
                            <Plus className="w-3 h-3" /> Add Step
                        </button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {subtasks.map((subtask, index) => (
                            <div key={subtask.id} className="subpanel group" style={{ padding: 0, overflow: 'hidden' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, background: 'var(--inset)' }}>
                                    <button onClick={() => toggleSubtaskExpand(subtask.id)} className="icon-btn" style={{ width: 28, height: 28, border: 'none', background: 'none' }}>
                                        {expandedSubtaskId === subtask.id ? <ChevronDown className="w-4 h-4"/> : <ChevronRight className="w-4 h-4"/>}
                                    </button>
                                    <button onClick={() => handleUpdateSubtask(subtask.id, { completed: !subtask.completed })} className={'tcheck' + (subtask.completed ? ' done' : '')}>
                                        {subtask.completed ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Circle className="w-3.5 h-3.5" style={{ opacity: 0 }} />}
                                    </button>
                                    <input
                                        type="text"
                                        value={subtask.title}
                                        onChange={(e) => handleUpdateSubtask(subtask.id, { title: e.target.value })}
                                        className="modal-title"
                                        style={{ fontSize: 14, fontWeight: 500, flex: 1, textDecoration: subtask.completed ? 'line-through' : 'none', color: subtask.completed ? 'var(--faint)' : 'var(--ink)' }}
                                    />
                                    <button
                                        onClick={() => handleUpdateSubtask(subtask.id, { isMilestone: !subtask.isMilestone })}
                                        className="icon-btn"
                                        style={{ width: 28, height: 28, border: 'none', background: 'none', color: subtask.isMilestone ? 'var(--accent)' : 'var(--faint)' }}
                                        title={subtask.isMilestone ? "This is a milestone" : "Mark as Milestone"}
                                    >
                                        <Flag className="w-4 h-4" style={subtask.isMilestone ? { fill: 'var(--accent)' } : undefined} />
                                    </button>
                                    <button onClick={() => handleMoveSubtaskUp(subtask.id)} disabled={index === 0} className="icon-btn" style={{ width: 28, height: 28, border: 'none', background: 'none', opacity: index === 0 ? .3 : 1, cursor: index === 0 ? 'not-allowed' : 'pointer' }} title="Move up"><ChevronUp className="w-4 h-4" /></button>
                                    <button onClick={() => handleMoveSubtaskDown(subtask.id)} disabled={index === subtasks.length - 1} className="icon-btn" style={{ width: 28, height: 28, border: 'none', background: 'none', opacity: index === subtasks.length - 1 ? .3 : 1, cursor: index === subtasks.length - 1 ? 'not-allowed' : 'pointer' }} title="Move down"><ChevronDown className="w-4 h-4" /></button>
                                    <button onClick={() => handleDeleteSubtask(subtask.id)} className="icon-btn" style={{ width: 28, height: 28, border: 'none', background: 'none', color: 'var(--red)' }}><Trash className="w-4 h-4" /></button>
                                </div>
                                {expandedSubtaskId === subtask.id && (
                                    <div style={{ padding: 16, borderTop: '1px solid var(--line)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                            <div className="field" style={{ marginBottom: 0 }}>
                                                <label>Category</label>
                                                <select value={subtask.category} onChange={(e) => handleUpdateSubtask(subtask.id, { category: e.target.value as WorkCategory })} className="input">
                                                    {Object.values(WorkCategory).map(c => <option key={c} value={c}>{c}</option>)}
                                                </select>
                                            </div>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                                <div className="field" style={{ marginBottom: 0 }}>
                                                    <label>Est. Hours</label>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="0.5"
                                                        value={subtask.estimatedHours || 0}
                                                        onChange={(e) => handleUpdateSubtask(subtask.id, { estimatedHours: parseFloat(e.target.value) || 0 })}
                                                        disabled={!!taskToEdit}
                                                        className="input"
                                                        style={taskToEdit ? { background: 'var(--inset)', cursor: 'not-allowed' } : undefined}
                                                    />
                                                </div>
                                                <div className="field" style={{ marginBottom: 0 }}>
                                                    <label>Actual Hours</label>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="0.5"
                                                        value={subtask.hoursSpent}
                                                        onChange={(e) => handleUpdateSubtask(subtask.id, { hoursSpent: parseFloat(e.target.value) || 0 })}
                                                        disabled={!taskToEdit}
                                                        className="input"
                                                        style={{
                                                            ...(subtaskNeedingHours === subtask.id ? { borderColor: 'var(--red)', boxShadow: '0 0 0 3px var(--red-bg)' } : {}),
                                                            ...(!taskToEdit ? { background: 'var(--inset)', cursor: 'not-allowed' } : {})
                                                        }}
                                                    />
                                                    {subtaskNeedingHours === subtask.id && (
                                                        <p className="animate-in fade-in slide-in-from-top-1" style={{ fontSize: 12, color: 'var(--red-ink)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                                                            <Bell className="w-3 h-3" />
                                                            Please enter actual hours before completing
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 8 }}>
                                            <div className="field" style={{ flex: 1, marginBottom: 0 }}>
                                                <label>Notes</label>
                                                <textarea value={subtask.notes} onChange={(e) => handleUpdateSubtask(subtask.id, { notes: e.target.value })} className="textarea" style={{ minHeight: 80 }} placeholder="Details..." />
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    <input
                                                        type="checkbox"
                                                        id={`milestone-${subtask.id}`}
                                                        checked={subtask.isMilestone || false}
                                                        onChange={(e) => handleUpdateSubtask(subtask.id, { isMilestone: e.target.checked })}
                                                        style={{ width: 14, height: 14, accentColor: 'var(--accent)', cursor: 'pointer' }}
                                                    />
                                                    <label htmlFor={`milestone-${subtask.id}`} style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink2)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, userSelect: 'none' }}>
                                                        <Flag className="w-3 h-3" style={{ color: 'var(--accent)' }} /> Mark as Key Milestone
                                                    </label>
                                                </div>
                                                {subtask.isMilestone && (
                                                    <div className="animate-in fade-in slide-in-from-top-1" style={{ paddingLeft: 20 }}>
                                                        <input
                                                            type="text"
                                                            value={subtask.milestoneDescription || ''}
                                                            onChange={(e) => handleUpdateSubtask(subtask.id, { milestoneDescription: e.target.value })}
                                                            placeholder="e.g., Completed primary tasks, Setup stages complete..."
                                                            className="input"
                                                            style={{ background: 'var(--accent-softer)', borderColor: 'var(--accent-soft)' }}
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
                <div className="subpanel" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div className="ph" style={{ marginBottom: 0 }}>PLANNING</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div className="field" style={{ marginBottom: 0 }}>
                            <label>Start Date</label>
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
                                className="input"
                                style={{ cursor: 'pointer' }}
                            />
                        </div>
                        <div className="field" style={{ marginBottom: 0 }}>
                            <label>Due Date</label>
                            <input
                                type="date"
                                value={dueDate}
                                onChange={(e) => setDueDate(e.target.value)}
                                onClick={handleSafeShowPicker}
                                min={startDate || undefined}
                                className="input"
                                style={{ cursor: 'pointer' }}
                            />
                        </div>
                    </div>

                    {/* Recurring Task Configuration */}
                    <div style={{ borderTop: '1px solid var(--line)', paddingTop: 16 }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 700, color: 'var(--ink2)', marginBottom: 12, cursor: 'pointer' }}>
                            <input
                                type="checkbox"
                                checked={isRecurring}
                                onChange={(e) => setIsRecurring(e.target.checked)}
                                style={{ width: 16, height: 16, accentColor: 'var(--accent)' }}
                            />
                            <ArrowUpDown className="w-4 h-4" />
                            Make this a recurring task
                        </label>

                        {isRecurring && (
                            <div className="animate-in fade-in slide-in-from-top-2" style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingLeft: 24 }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                    <div className="field" style={{ marginBottom: 0 }}>
                                        <label>Frequency</label>
                                        <select
                                            value={recurrenceFrequency}
                                            onChange={(e) => setRecurrenceFrequency(e.target.value as any)}
                                            className="input"
                                        >
                                            <option value="DAILY">Daily</option>
                                            <option value="WEEKLY">Weekly</option>
                                            <option value="MONTHLY">Monthly</option>
                                            <option value="YEARLY">Yearly</option>
                                        </select>
                                    </div>
                                    <div className="field" style={{ marginBottom: 0 }}>
                                        <label>Every</label>
                                        <input
                                            type="number"
                                            min="1"
                                            max="99"
                                            value={recurrenceInterval}
                                            onChange={(e) => setRecurrenceInterval(parseInt(e.target.value) || 1)}
                                            className="input"
                                        />
                                    </div>
                                </div>

                                {recurrenceFrequency === 'WEEKLY' && (
                                    <div className="field" style={{ marginBottom: 0 }}>
                                        <label>Days of Week</label>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
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
                                                    className={recurrenceWeekDays.includes(index) ? 'btn' : 'btn-g btn'}
                                                    style={{ padding: '6px 0', justifyContent: 'center', fontSize: 12, boxShadow: 'none' }}
                                                >
                                                    {day}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <p style={{ fontSize: 10, color: 'var(--muted)', fontStyle: 'italic' }}>
                                    When completed, a new instance will be created automatically.
                                </p>
                            </div>
                        )}
                    </div>

                    <div className="field" style={{ marginBottom: 0 }}>
                         <label>Dependencies</label>
                         <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                             {dependencyIds.map(depId => {
                                 const depTask = allTasks.find(t => t.id === depId);
                                 return depTask ? (
                                     <div key={depId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--inset)', padding: '6px 8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--line)', fontSize: 12 }}>
                                         <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 120, color: 'var(--ink2)' }}>{depTask.title}</span>
                                         <button onClick={() => setDependencyIds(dependencyIds.filter(id => id !== depId))} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--red)', display: 'grid', placeItems: 'center' }}><X className="w-3 h-3"/></button>
                                     </div>
                                 ) : null;
                             })}
                             <select
                                onChange={(e) => {
                                    if(e.target.value && !dependencyIds.includes(e.target.value)) {
                                        setDependencyIds([...dependencyIds, e.target.value]);
                                    }
                                }}
                                className="input"
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
        <div className="modal-foot">
          <button onClick={onClose} className="btn-g btn">Cancel</button>
          <button onClick={handleSave} className="btn">Save Task</button>
        </div>
      </div>

      {/* KPI Achievement Modal */}
      {showKpiModal && (
        <div className="overlay" style={{ zIndex: 110 }} onMouseDown={e => { if (e.target === e.currentTarget) handleKpiModalCancel(); }}>
          <div className="modal animate-in fade-in slide-in-from-top-4" style={{ maxWidth: 640 }}>
            <div className="modal-h" style={{ paddingBottom: 16, borderBottom: '1px solid var(--line)', flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
              <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-.02em', display: 'flex', alignItems: 'center', gap: 8, color: 'var(--ink)' }}>
                <CheckCircle2 className="w-6 h-6" style={{ color: 'var(--green)' }} />
                Record KPI Achievements
              </div>
              <p style={{ fontSize: 13, color: 'var(--muted)' }}>Enter the actual results achieved for each KPI target</p>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {impactMetrics.map(metric => (
                <div key={metric.id} className="subpanel">
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div>
                      <h3 style={{ fontSize: 13, fontWeight: 800, color: 'var(--ink)' }}>{metric.type}</h3>
                      {metric.description && (
                        <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{metric.description}</p>
                      )}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 12, color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 600 }}>Target</div>
                      <div className="num" style={{ fontSize: 18, fontWeight: 800, color: 'var(--accent)' }}>
                        {metric.type === ImpactType.REVENUE && metric.currency && `${currencySymbol(metric.currency)} `}
                        {metric.value.toLocaleString()}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div className="field" style={{ flex: 1, marginBottom: 0 }}>
                      <label>
                        Actual Achieved {metric.type === ImpactType.REVENUE && `(${metric.currency})`}
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={metric.achievedValue ?? ''}
                        onChange={(e) => {
                          const value = e.target.value;
                          handleUpdateMetric(metric.id, {
                            achievedValue: value === '' ? undefined : parseFloat(value)
                          });
                        }}
                        className="input"
                        style={{ fontSize: 18, fontWeight: 600 }}
                        placeholder="0"
                        autoFocus={impactMetrics[0].id === metric.id}
                      />
                    </div>
                    <div style={{ paddingTop: 24 }}>
                      {metric.achievedValue !== undefined && metric.achievedValue >= metric.value ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--green-ink)', background: 'var(--green-bg)', padding: '8px 12px', borderRadius: 'var(--radius-sm)' }}>
                          <CheckCircle2 className="w-5 h-5" />
                          <span style={{ fontSize: 13, fontWeight: 700 }}>Target Met!</span>
                        </div>
                      ) : metric.achievedValue !== undefined && metric.achievedValue > 0 ? (
                        <div style={{ fontSize: 13, color: 'var(--ink2)' }}>
                          <span style={{ fontWeight: 600 }}>{((metric.achievedValue / metric.value) * 100).toFixed(0)}%</span>
                          <div style={{ fontSize: 12, color: 'var(--muted)' }}>of target</div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}

              {impactMetrics.length === 0 && (
                <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--faint)' }}>
                  <BarChart2 className="w-12 h-12" style={{ margin: '0 auto 8px', opacity: .5 }} />
                  <p style={{ fontSize: 13 }}>No KPIs to record</p>
                </div>
              )}
            </div>

            <div className="modal-foot">
              <button
                onClick={handleKpiModalCancel}
                className="btn-g btn"
              >
                Cancel
              </button>
              <button
                onClick={handleKpiModalSave}
                className="btn"
                style={{ background: 'var(--green)', boxShadow: 'none' }}
              >
                Save &amp; Mark Complete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
