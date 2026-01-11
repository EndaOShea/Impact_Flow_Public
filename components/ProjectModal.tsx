import React, { useState, useEffect, useRef } from 'react';
import {
    X, Plus, Trash, CheckCircle2, Briefcase, Calendar, Flag,
    Paperclip, Download, ExternalLink, Link as LinkIcon, MessageSquare,
    Target, Users, BarChart2, TrendingUp, Clock, AlertCircle, Upload,
    ChevronDown, ChevronRight
} from 'lucide-react';
import { Project, ProjectStatus, Priority, TeamMember, Attachment, Comment, User } from '../types';
import { api } from '../services/api';
import { validateFile, validateAttachmentCount } from '../services/fileValidation';

interface ProjectModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (project: Project) => void;
    projectToEdit?: Project;
    currentUser: User;
}

type ModalTab = 'DETAILS' | 'STRATEGY' | 'TEAM' | 'COLLAB' | 'ANALYTICS';

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

export const ProjectModal: React.FC<ProjectModalProps> = ({
    isOpen, onClose, onSave, projectToEdit, currentUser
}) => {
    const [activeTab, setActiveTab] = useState<ModalTab>('DETAILS');

    // Basic Info
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [status, setStatus] = useState<ProjectStatus>(ProjectStatus.PLANNING);
    const [priority, setPriority] = useState<Priority>(Priority.MEDIUM);
    const [color, setColor] = useState<string>('#8b5cf6'); // Default purple

    // Dates
    const [startDate, setStartDate] = useState<string>('');
    const [targetEndDate, setTargetEndDate] = useState<string>('');
    const [actualEndDate, setActualEndDate] = useState<string>('');

    // Strategy
    const [okrs, setOkrs] = useState<string[]>([]);
    const [newOkrInput, setNewOkrInput] = useState('');
    const [vision, setVision] = useState('');
    const [successCriteria, setSuccessCriteria] = useState('');
    const [notes, setNotes] = useState('');

    // Lists
    const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
    const [attachments, setAttachments] = useState<Attachment[]>([]);
    const [comments, setComments] = useState<Comment[]>([]);
    const [resourceLinks, setResourceLinks] = useState<{title: string, url: string}[]>([]);

    // Analytics
    const [analytics, setAnalytics] = useState<any>(null);
    const [loadingAnalytics, setLoadingAnalytics] = useState(false);

    // UI States
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [newCommentText, setNewCommentText] = useState('');
    const [attachmentError, setAttachmentError] = useState<string | null>(null);
    const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
    const [expandedMemberIds, setExpandedMemberIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (isOpen) {
            setActiveTab('DETAILS');
            if (projectToEdit) {
                setTitle(projectToEdit.title);
                setDescription(projectToEdit.description || '');
                setStatus(projectToEdit.status);
                setPriority(projectToEdit.priority);
                setColor(projectToEdit.color || '#8b5cf6');
                setStartDate(toDateString(projectToEdit.startDate));
                setTargetEndDate(toDateString(projectToEdit.targetEndDate));
                setActualEndDate(toDateString(projectToEdit.actualEndDate));
                setOkrs([...(projectToEdit.okrs || [])]);
                setNewOkrInput('');
                setVision(projectToEdit.vision || '');
                setSuccessCriteria(projectToEdit.successCriteria || '');
                setNotes(projectToEdit.notes || '');
                setTeamMembers([...(projectToEdit.teamMembers || [])]);
                setAttachments([...(projectToEdit.attachments || [])]);
                setComments([...(projectToEdit.comments || [])]);
                setResourceLinks([...(projectToEdit.resourceLinks || [])]);
            } else {
                // Reset for new project
                setTitle('');
                setDescription('');
                setStatus(ProjectStatus.PLANNING);
                setPriority(Priority.MEDIUM);
                setColor('#8b5cf6');
                setStartDate(new Date().toISOString().split('T')[0]);
                setTargetEndDate('');
                setActualEndDate('');
                setOkrs([]);
                setNewOkrInput('');
                setVision('');
                setSuccessCriteria('');
                setNotes('');
                setTeamMembers([]);
                setAttachments([]);
                setComments([]);
                setResourceLinks([]);
            }
            setAnalytics(null);
        }
    }, [isOpen, projectToEdit]);

    // Load analytics when switching to analytics tab
    useEffect(() => {
        if (activeTab === 'ANALYTICS' && projectToEdit?.id && !analytics) {
            loadAnalytics();
        }
    }, [activeTab, projectToEdit]);

    const loadAnalytics = async () => {
        if (!projectToEdit?.id) return;
        setLoadingAnalytics(true);
        try {
            const data = await api.getProjectAnalytics(projectToEdit.id);
            setAnalytics(data);
        } catch (error) {
            console.error('Failed to load analytics:', error);
        } finally {
            setLoadingAnalytics(false);
        }
    };

    const handleAddOkr = () => {
        if (newOkrInput.trim()) {
            setOkrs([...okrs, newOkrInput.trim()]);
            setNewOkrInput('');
        }
    };

    const handleDeleteOkr = (index: number) => {
        setOkrs(okrs.filter((_, i) => i !== index));
    };

    const handleAddTeamMember = () => {
        const newMember: TeamMember = {
            id: crypto.randomUUID(),
            projectId: projectToEdit?.id || '',
            name: '',
            role: '',
            email: '',
            notes: '',
            createdAt: new Date()
        };
        setTeamMembers([...teamMembers, newMember]);
        setEditingMemberId(newMember.id);
        // Auto-expand new member
        setExpandedMemberIds(prev => new Set(prev).add(newMember.id));
    };

    const toggleMemberExpanded = (memberId: string) => {
        setExpandedMemberIds(prev => {
            const next = new Set(prev);
            if (next.has(memberId)) {
                next.delete(memberId);
            } else {
                next.add(memberId);
            }
            return next;
        });
    };

    const handleUpdateTeamMember = (id: string, updates: Partial<TeamMember>) => {
        setTeamMembers(teamMembers.map(m => m.id === id ? { ...m, ...updates } : m));
    };

    const handleDeleteTeamMember = (id: string) => {
        setTeamMembers(teamMembers.filter(m => m.id !== id));
        if (editingMemberId === id) setEditingMemberId(null);
    };

    const handleAddComment = () => {
        if (!newCommentText.trim()) return;
        const newComment: Comment = {
            id: crypto.randomUUID(),
            authorId: currentUser.id,
            text: newCommentText.trim(),
            createdAt: new Date()
        };
        setComments([newComment, ...comments]);
        setNewCommentText('');
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        setAttachmentError(null);
        const file = e.target.files?.[0];
        if (!file) return;

        const countValidation = validateAttachmentCount(attachments.length, 1);
        if (!countValidation.valid) {
            setAttachmentError(countValidation.error);
            return;
        }

        const reader = new FileReader();
        reader.onload = async (event) => {
            const dataUrl = event.target?.result as string;

            const fileValidation = validateFile({
                name: file.name,
                type: file.type,
                url: dataUrl,
                size: file.size
            });

            if (!fileValidation.valid) {
                setAttachmentError(fileValidation.error);
                return;
            }

            const newAttachment: Attachment = {
                id: crypto.randomUUID(),
                name: fileValidation.sanitizedName || file.name,
                type: file.type,
                url: dataUrl,
                size: file.size,
                createdAt: new Date()
            };

            setAttachments([...attachments, newAttachment]);
        };
        reader.readAsDataURL(file);

        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleDownloadAttachment = (attachment: Attachment) => {
        const a = document.createElement('a');
        a.href = attachment.url;
        a.download = attachment.name;
        a.click();
    };

    const handleDeleteAttachment = (id: string) => {
        setAttachments(attachments.filter(a => a.id !== id));
        setAttachmentError(null);
    };

    const handleSave = () => {
        if (!title.trim()) {
            alert('Project title is required');
            return;
        }

        // Validate dates
        if (startDate && targetEndDate) {
            const start = new Date(startDate);
            const end = new Date(targetEndDate);
            if (end < start) {
                alert('Target end date cannot be before start date');
                return;
            }
        }

        if (startDate && actualEndDate) {
            const start = new Date(startDate);
            const actual = new Date(actualEndDate);
            if (actual < start) {
                alert('Actual end date cannot be before start date');
                return;
            }
        }

        const newProject: Project = {
            id: projectToEdit?.id || '',
            title: title.trim(),
            description,
            status,
            priority,
            color,
            creatorId: projectToEdit?.creatorId || currentUser.id,
            startDate: startDate ? new Date(startDate) : undefined,
            targetEndDate: targetEndDate ? new Date(targetEndDate) : undefined,
            actualEndDate: actualEndDate ? new Date(actualEndDate) : undefined,
            createdAt: projectToEdit?.createdAt || new Date(),
            updatedAt: new Date(),
            completedAt: status === ProjectStatus.COMPLETED && projectToEdit?.status !== ProjectStatus.COMPLETED ? new Date() : projectToEdit?.completedAt,
            okrs,
            vision,
            successCriteria,
            notes,
            teamMembers,
            attachments,
            comments,
            resourceLinks,
            activityLog: projectToEdit?.activityLog || []
        };

        onSave(newProject);
        onClose();
    };

    if (!isOpen) return null;

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
                            className="text-2xl font-bold bg-transparent border-none focus:ring-0 p-0 text-slate-900 w-full outline-none"
                            placeholder="Project Title"
                            autoFocus
                        />
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-slate-100 rounded-lg transition-colors ml-4"
                        >
                            <X className="w-5 h-5 text-slate-400" />
                        </button>
                    </div>

                    {/* Tabs */}
                    <div className="flex gap-2 overflow-x-auto">
                        {(['DETAILS', 'STRATEGY', 'TEAM', 'COLLAB', 'ANALYTICS'] as ModalTab[]).map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`px-4 py-2 text-sm font-bold rounded-lg transition-colors whitespace-nowrap ${
                                    activeTab === tab
                                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                                        : 'text-slate-500 hover:bg-slate-100'
                                }`}
                            >
                                {tab === 'COLLAB' ? 'Collaboration' : tab.charAt(0) + tab.slice(1).toLowerCase()}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Content */}
                <div className="overflow-y-auto bg-slate-50/50 h-[650px]">

                    {/* TAB: DETAILS */}
                    {activeTab === 'DETAILS' && (
                        <div className="p-8 max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
                            {/* Left Column: Main Content */}
                            <div className="lg:col-span-2 space-y-6">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                                    <textarea
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        className="w-full px-4 py-3 bg-white text-slate-900 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all h-32 resize-none shadow-sm"
                                        placeholder="Detailed description of the project..."
                                    />
                                </div>

                                {/* Project Info Card */}
                                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                                    <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                                        <Briefcase className="w-4 h-4" /> Project Information
                                    </h3>
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                        <div>
                                            <span className="text-slate-500">Status:</span>
                                            <span className="ml-2 font-medium text-slate-900">{status}</span>
                                        </div>
                                        <div>
                                            <span className="text-slate-500">Priority:</span>
                                            <span className="ml-2 font-medium text-slate-900">{priority}</span>
                                        </div>
                                        <div>
                                            <span className="text-slate-500">Start Date:</span>
                                            <span className="ml-2 font-medium text-slate-900">
                                                {startDate ? new Date(startDate).toLocaleDateString('en-GB') : 'Not set'}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="text-slate-500">Target End:</span>
                                            <span className="ml-2 font-medium text-slate-900">
                                                {targetEndDate ? new Date(targetEndDate).toLocaleDateString('en-GB') : 'Not set'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Right Column: Settings */}
                            <div className="space-y-6">
                                {/* Status & Priority */}
                                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
                                    <h3 className="text-xs font-bold uppercase text-slate-500 tracking-wider mb-2">Classification</h3>

                                    <div>
                                        <label className="text-xs font-medium text-slate-600 mb-1 block">Status</label>
                                        <select
                                            value={status}
                                            onChange={(e) => setStatus(e.target.value as ProjectStatus)}
                                            className="w-full text-sm border border-slate-300 rounded-lg bg-white px-3 py-2 cursor-pointer focus:ring-2 focus:ring-blue-500 outline-none"
                                        >
                                            {Object.values(ProjectStatus).map(s => (
                                                <option key={s} value={s}>{s}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="text-xs font-medium text-slate-600 mb-1 block">Priority</label>
                                        <select
                                            value={priority}
                                            onChange={(e) => setPriority(e.target.value as Priority)}
                                            className="w-full text-sm border border-slate-300 rounded-lg bg-white px-3 py-2 cursor-pointer focus:ring-2 focus:ring-blue-500 outline-none"
                                        >
                                            {Object.values(Priority).map(p => (
                                                <option key={p} value={p}>{p}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="text-xs font-medium text-slate-600 mb-1 block">Calendar Color</label>
                                        <div className="flex gap-2 flex-wrap">
                                            {[
                                                { name: 'Purple', value: '#8b5cf6' },
                                                { name: 'Blue', value: '#3b82f6' },
                                                { name: 'Green', value: '#10b981' },
                                                { name: 'Orange', value: '#f59e0b' },
                                                { name: 'Red', value: '#ef4444' },
                                                { name: 'Pink', value: '#ec4899' },
                                                { name: 'Teal', value: '#14b8a6' },
                                                { name: 'Indigo', value: '#6366f1' },
                                                { name: 'Yellow', value: '#fbbf24' },
                                                { name: 'Brown', value: '#a16207' }
                                            ].map(c => (
                                                <button
                                                    key={c.value}
                                                    type="button"
                                                    onClick={() => setColor(c.value)}
                                                    className={`w-8 h-8 rounded-lg border-2 transition-all ${
                                                        color === c.value ? 'border-slate-800 scale-110' : 'border-slate-300 hover:scale-105'
                                                    }`}
                                                    style={{ backgroundColor: c.value }}
                                                    title={c.name}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* Dates */}
                                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
                                    <h3 className="text-xs font-bold uppercase text-slate-500 tracking-wider mb-2">Timeline</h3>
                                    <div className="space-y-3">
                                        <div>
                                            <label className="text-xs font-medium text-slate-600 mb-1 block">Start Date</label>
                                            <input
                                                type="date"
                                                value={startDate}
                                                onChange={(e) => setStartDate(e.target.value)}
                                                className="w-full text-xs border border-slate-300 rounded bg-white px-2 py-2 cursor-pointer focus:ring-2 focus:ring-blue-500 outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-medium text-slate-600 mb-1 block">Target End Date</label>
                                            <input
                                                type="date"
                                                value={targetEndDate}
                                                onChange={(e) => setTargetEndDate(e.target.value)}
                                                className="w-full text-xs border border-slate-300 rounded bg-white px-2 py-2 cursor-pointer focus:ring-2 focus:ring-blue-500 outline-none"
                                            />
                                        </div>
                                        {status === ProjectStatus.COMPLETED && (
                                            <div>
                                                <label className="text-xs font-medium text-slate-600 mb-1 block">Actual End Date</label>
                                                <input
                                                    type="date"
                                                    value={actualEndDate}
                                                    onChange={(e) => setActualEndDate(e.target.value)}
                                                    className="w-full text-xs border border-slate-300 rounded bg-white px-2 py-2 cursor-pointer focus:ring-2 focus:ring-blue-500 outline-none"
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TAB: STRATEGY */}
                    {activeTab === 'STRATEGY' && (
                        <div className="p-8 max-w-4xl mx-auto space-y-6">

                            {/* Vision */}
                            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                                <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                                    <Target className="w-4 h-4 text-purple-500" /> Vision
                                </h3>
                                <textarea
                                    value={vision}
                                    onChange={(e) => setVision(e.target.value)}
                                    className="w-full px-4 py-3 bg-slate-50 text-slate-900 border border-slate-200 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none transition-all h-24 resize-none"
                                    placeholder="What is the long-term vision for this project?"
                                />
                            </div>

                            {/* Success Criteria */}
                            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                                <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-green-500" /> Success Criteria
                                </h3>
                                <textarea
                                    value={successCriteria}
                                    onChange={(e) => setSuccessCriteria(e.target.value)}
                                    className="w-full px-4 py-3 bg-slate-50 text-slate-900 border border-slate-200 rounded-lg focus:ring-2 focus:ring-green-500 outline-none transition-all h-24 resize-none"
                                    placeholder="How will success be measured? What are the key outcomes?"
                                />
                            </div>

                            {/* OKRs */}
                            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                                <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                                    <Flag className="w-4 h-4 text-blue-500" /> Objectives & Key Results
                                </h3>
                                <div className="space-y-2 mb-4">
                                    {okrs.map((okr, index) => (
                                        <div key={index} className="flex items-center gap-2 bg-slate-50 p-3 rounded-lg">
                                            <span className="text-sm text-slate-700 flex-1">{okr}</span>
                                            <button
                                                onClick={() => handleDeleteOkr(index)}
                                                className="text-slate-400 hover:text-red-500 transition-colors"
                                            >
                                                <Trash className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))}
                                    {okrs.length === 0 && (
                                        <p className="text-slate-400 text-sm italic">No OKRs defined yet.</p>
                                    )}
                                </div>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={newOkrInput}
                                        onChange={(e) => setNewOkrInput(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleAddOkr()}
                                        placeholder="Add an objective or key result..."
                                        className="flex-1 border border-slate-300 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                    <button
                                        onClick={handleAddOkr}
                                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
                                    >
                                        Add
                                    </button>
                                </div>
                            </div>

                            {/* Notes */}
                            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                                <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                                    <MessageSquare className="w-4 h-4 text-slate-500" /> Notes
                                </h3>
                                <textarea
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    className="w-full px-4 py-3 bg-slate-50 text-slate-900 border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-500 outline-none transition-all h-32 resize-none"
                                    placeholder="Additional notes, considerations, or context..."
                                />
                            </div>
                        </div>
                    )}

                    {/* TAB: TEAM */}
                    {activeTab === 'TEAM' && (
                        <div className="p-8 max-w-4xl mx-auto space-y-6">
                            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                        <Users className="w-4 h-4 text-blue-500" /> Team Members
                                    </h3>
                                    <button
                                        onClick={handleAddTeamMember}
                                        className="text-blue-600 text-xs font-bold hover:underline bg-blue-50 px-3 py-1.5 rounded-full flex items-center gap-1"
                                    >
                                        <Plus className="w-3 h-3" /> Add Member
                                    </button>
                                </div>

                                <div className="space-y-2">
                                    {teamMembers.length === 0 && (
                                        <p className="text-slate-400 text-sm italic text-center py-8">No team members added yet.</p>
                                    )}
                                    {teamMembers.map(member => {
                                        const isExpanded = expandedMemberIds.has(member.id);
                                        return (
                                            <div key={member.id} className="bg-slate-50 rounded-lg border border-slate-200 overflow-hidden">
                                                {/* Collapsed Header - Always Visible */}
                                                <div
                                                    className="flex items-center justify-between p-3 cursor-pointer hover:bg-slate-100 transition-colors"
                                                    onClick={() => toggleMemberExpanded(member.id)}
                                                >
                                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 text-xs font-bold flex-shrink-0">
                                                            {member.name ? member.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : '?'}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="font-medium text-slate-800 truncate">
                                                                {member.name || <span className="text-slate-400 italic">Unnamed</span>}
                                                            </div>
                                                            {member.role && (
                                                                <div className="text-xs text-slate-500 truncate">{member.role}</div>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleDeleteTeamMember(member.id); }}
                                                            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                                                            title="Remove member"
                                                        >
                                                            <Trash className="w-4 h-4" />
                                                        </button>
                                                        {isExpanded ? (
                                                            <ChevronDown className="w-5 h-5 text-slate-400" />
                                                        ) : (
                                                            <ChevronRight className="w-5 h-5 text-slate-400" />
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Expanded Details */}
                                                {isExpanded && (
                                                    <div className="p-4 pt-0 space-y-3 border-t border-slate-200 bg-white">
                                                        <div className="grid grid-cols-2 gap-3 pt-3">
                                                            <div>
                                                                <label className="text-xs font-medium text-slate-600 mb-1 block">Name *</label>
                                                                <input
                                                                    type="text"
                                                                    value={member.name}
                                                                    onChange={(e) => handleUpdateTeamMember(member.id, { name: e.target.value })}
                                                                    onClick={(e) => e.stopPropagation()}
                                                                    className="w-full text-sm border border-slate-300 rounded px-3 py-2 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                                                                    placeholder="Full name"
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="text-xs font-medium text-slate-600 mb-1 block">Role</label>
                                                                <input
                                                                    type="text"
                                                                    value={member.role || ''}
                                                                    onChange={(e) => handleUpdateTeamMember(member.id, { role: e.target.value })}
                                                                    onClick={(e) => e.stopPropagation()}
                                                                    className="w-full text-sm border border-slate-300 rounded px-3 py-2 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                                                                    placeholder="e.g., Designer, Developer"
                                                                />
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <label className="text-xs font-medium text-slate-600 mb-1 block">Email</label>
                                                            <input
                                                                type="email"
                                                                value={member.email || ''}
                                                                onChange={(e) => handleUpdateTeamMember(member.id, { email: e.target.value })}
                                                                onClick={(e) => e.stopPropagation()}
                                                                className="w-full text-sm border border-slate-300 rounded px-3 py-2 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                                                                placeholder="email@example.com"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="text-xs font-medium text-slate-600 mb-1 block">Notes</label>
                                                            <textarea
                                                                value={member.notes || ''}
                                                                onChange={(e) => handleUpdateTeamMember(member.id, { notes: e.target.value })}
                                                                onClick={(e) => e.stopPropagation()}
                                                                className="w-full text-sm border border-slate-300 rounded px-3 py-2 bg-white focus:ring-2 focus:ring-blue-500 outline-none resize-none h-20"
                                                                placeholder="Additional information about this team member..."
                                                            />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TAB: COLLAB */}
                    {activeTab === 'COLLAB' && (
                        <div className="p-8 max-w-4xl mx-auto space-y-6">

                            {/* Attachments */}
                            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                                <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                                    <Paperclip className="w-4 h-4" /> Attachments
                                    <span className="text-xs font-normal text-slate-400">({attachments.length}/3)</span>
                                </h3>

                                {attachmentError && (
                                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                                        <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                                        <span className="text-xs text-red-700">{attachmentError}</span>
                                    </div>
                                )}

                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    onChange={handleFileUpload}
                                    className="hidden"
                                    disabled={attachments.length >= 3}
                                />
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={attachments.length >= 3}
                                    className={`mb-4 flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                                        attachments.length >= 3
                                            ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                            : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                                    }`}
                                >
                                    <Upload className="w-4 h-4" /> Upload File
                                </button>

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

                            {/* Resource Links */}
                            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                                <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                                    <LinkIcon className="w-4 h-4" /> Resource Links
                                </h3>
                                <div className="space-y-2">
                                    {resourceLinks.map((link, idx) => (
                                        <div key={idx} className="flex gap-2 items-center">
                                            <input
                                                className="flex-1 border border-slate-200 rounded px-2 py-1 text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                                                value={link.title}
                                                onChange={(e) => {
                                                    const newLinks = [...resourceLinks];
                                                    newLinks[idx].title = e.target.value;
                                                    setResourceLinks(newLinks);
                                                }}
                                                placeholder="Resource Title"
                                            />
                                            <input
                                                className="flex-1 border border-slate-200 rounded px-2 py-1 text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
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
                                    <button
                                        onClick={() => setResourceLinks([...resourceLinks, {title: '', url: ''}])}
                                        className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                                    >
                                        <Plus className="w-3 h-3" /> Add Link
                                    </button>
                                </div>
                            </div>

                            {/* Comments */}
                            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                                <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                                    <MessageSquare className="w-4 h-4" /> Comments
                                </h3>
                                <div className="space-y-4 mb-6 max-h-[300px] overflow-y-auto">
                                    {comments.length === 0 && <p className="text-slate-400 text-sm italic">No comments yet.</p>}
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
                                        placeholder="Add a comment..."
                                        className="flex-1 border border-slate-300 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                                    />
                                    <button
                                        onClick={handleAddComment}
                                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                                    >
                                        Add
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TAB: ANALYTICS */}
                    {activeTab === 'ANALYTICS' && (
                        <div className="p-8 max-w-4xl mx-auto space-y-6">
                            {!projectToEdit ? (
                                <div className="bg-white p-12 rounded-xl border border-slate-200 shadow-sm text-center">
                                    <BarChart2 className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                                    <p className="text-slate-500">Analytics will be available after saving the project and adding tasks.</p>
                                </div>
                            ) : loadingAnalytics ? (
                                <div className="bg-white p-12 rounded-xl border border-slate-200 shadow-sm text-center">
                                    <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
                                    <p className="text-slate-500">Loading analytics...</p>
                                </div>
                            ) : analytics ? (
                                <>
                                    {/* Task Summary */}
                                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                                        <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                                            <TrendingUp className="w-4 h-4 text-blue-500" /> Task Summary
                                        </h3>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                            <div className="text-center">
                                                <div className="text-2xl font-bold text-slate-900">{analytics.taskSummary.totalTasks}</div>
                                                <div className="text-xs text-slate-500">Total Tasks</div>
                                            </div>
                                            <div className="text-center">
                                                <div className="text-2xl font-bold text-green-600">{analytics.taskSummary.completedTasks}</div>
                                                <div className="text-xs text-slate-500">Completed</div>
                                            </div>
                                            <div className="text-center">
                                                <div className="text-2xl font-bold text-blue-600">{analytics.taskSummary.inProgressTasks}</div>
                                                <div className="text-xs text-slate-500">In Progress</div>
                                            </div>
                                            <div className="text-center">
                                                <div className="text-2xl font-bold text-orange-600">{analytics.taskSummary.overdueTasks}</div>
                                                <div className="text-xs text-slate-500">Overdue</div>
                                            </div>
                                        </div>
                                        <div className="mt-4 p-3 bg-slate-50 rounded-lg">
                                            <div className="flex justify-between items-center">
                                                <span className="text-sm font-medium text-slate-700">Progress</span>
                                                <span className="text-sm font-bold text-blue-600">{analytics.taskSummary.progressPercentage}%</span>
                                            </div>
                                            <div className="mt-2 h-2 bg-slate-200 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-blue-600 rounded-full transition-all"
                                                    style={{ width: `${analytics.taskSummary.progressPercentage}%` }}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Time Tracking */}
                                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                                        <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                                            <Clock className="w-4 h-4 text-purple-500" /> Time Tracking
                                        </h3>
                                        <div className="grid grid-cols-3 gap-4">
                                            <div className="text-center">
                                                <div className="text-2xl font-bold text-slate-900">{analytics.timeTracking.totalEstimatedHours.toFixed(1)}h</div>
                                                <div className="text-xs text-slate-500">Estimated</div>
                                            </div>
                                            <div className="text-center">
                                                <div className="text-2xl font-bold text-blue-600">{analytics.timeTracking.totalHoursSpent.toFixed(1)}h</div>
                                                <div className="text-xs text-slate-500">Spent</div>
                                            </div>
                                            <div className="text-center">
                                                <div className="text-2xl font-bold text-purple-600">{analytics.timeTracking.hoursRemaining.toFixed(1)}h</div>
                                                <div className="text-xs text-slate-500">Remaining</div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Impact Metrics */}
                                    {analytics.aggregatedImpact && Object.keys(analytics.aggregatedImpact).length > 0 && (
                                        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                                            <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                                                <BarChart2 className="w-4 h-4 text-green-500" /> Aggregated Impact
                                            </h3>
                                            <div className="grid grid-cols-2 gap-4">
                                                {analytics.aggregatedImpact['Revenue'] && analytics.aggregatedImpact['Revenue'].target > 0 && (
                                                    <div className="p-3 bg-green-50 rounded-lg">
                                                        <div className="text-xs text-green-600 mb-1">Revenue</div>
                                                        <div className="text-lg font-bold text-green-700">${analytics.aggregatedImpact['Revenue'].target.toLocaleString()}</div>
                                                        {analytics.aggregatedImpact['Revenue'].achieved > 0 && (
                                                            <div className="text-xs text-green-600">Achieved: ${analytics.aggregatedImpact['Revenue'].achieved.toLocaleString()}</div>
                                                        )}
                                                    </div>
                                                )}
                                                {analytics.aggregatedImpact['Time Saved (Hours)'] && analytics.aggregatedImpact['Time Saved (Hours)'].target > 0 && (
                                                    <div className="p-3 bg-blue-50 rounded-lg">
                                                        <div className="text-xs text-blue-600 mb-1">Time Saved</div>
                                                        <div className="text-lg font-bold text-blue-700">{analytics.aggregatedImpact['Time Saved (Hours)'].target.toFixed(1)}h</div>
                                                        {analytics.aggregatedImpact['Time Saved (Hours)'].achieved > 0 && (
                                                            <div className="text-xs text-blue-600">Achieved: {analytics.aggregatedImpact['Time Saved (Hours)'].achieved.toFixed(1)}h</div>
                                                        )}
                                                    </div>
                                                )}
                                                {analytics.aggregatedImpact['Cost Reduction'] && analytics.aggregatedImpact['Cost Reduction'].target > 0 && (
                                                    <div className="p-3 bg-purple-50 rounded-lg">
                                                        <div className="text-xs text-purple-600 mb-1">Cost Reduction</div>
                                                        <div className="text-lg font-bold text-purple-700">${analytics.aggregatedImpact['Cost Reduction'].target.toLocaleString()}</div>
                                                        {analytics.aggregatedImpact['Cost Reduction'].achieved > 0 && (
                                                            <div className="text-xs text-purple-600">Achieved: ${analytics.aggregatedImpact['Cost Reduction'].achieved.toLocaleString()}</div>
                                                        )}
                                                    </div>
                                                )}
                                                {analytics.aggregatedImpact['CSAT Score'] && analytics.aggregatedImpact['CSAT Score'].target > 0 && (
                                                    <div className="p-3 bg-orange-50 rounded-lg">
                                                        <div className="text-xs text-orange-600 mb-1">CSAT Score</div>
                                                        <div className="text-lg font-bold text-orange-700">{analytics.aggregatedImpact['CSAT Score'].target.toFixed(1)}/10</div>
                                                        {analytics.aggregatedImpact['CSAT Score'].achieved > 0 && (
                                                            <div className="text-xs text-orange-600">Achieved: {analytics.aggregatedImpact['CSAT Score'].achieved.toFixed(1)}</div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* Blockers */}
                                    {analytics.blockers && analytics.blockers.totalBlockers > 0 && (
                                        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                                            <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                                                <AlertCircle className="w-4 h-4 text-red-500" /> Blockers
                                            </h3>
                                            <div className="grid grid-cols-2 gap-4 mb-4">
                                                <div className="text-center p-3 bg-red-50 rounded-lg">
                                                    <div className="text-2xl font-bold text-red-600">{analytics.blockers.activeBlockers}</div>
                                                    <div className="text-xs text-red-700">Active</div>
                                                </div>
                                                <div className="text-center p-3 bg-green-50 rounded-lg">
                                                    <div className="text-2xl font-bold text-green-600">{analytics.blockers.resolvedBlockers}</div>
                                                    <div className="text-xs text-green-700">Resolved</div>
                                                </div>
                                            </div>
                                            {analytics.blockers.blockersByMember && Object.keys(analytics.blockers.blockersByMember).length > 0 && (
                                                <div>
                                                    <div className="text-xs font-medium text-slate-600 mb-2">By Team Member</div>
                                                    <div className="space-y-2">
                                                        {Object.entries(analytics.blockers.blockersByMember).map(([memberName, counts]: [string, any]) => (
                                                            <div key={memberName} className="flex justify-between items-center text-sm">
                                                                <span className="text-slate-700">{memberName}</span>
                                                                <span className="font-medium text-slate-900">
                                                                    <span className="text-red-600">{counts.active}</span>
                                                                    {counts.resolved > 0 && <span className="text-slate-400"> / {counts.resolved} resolved</span>}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className="bg-white p-12 rounded-xl border border-slate-200 shadow-sm text-center">
                                    <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                                    <p className="text-slate-500">Failed to load analytics. Please try again.</p>
                                    <button
                                        onClick={loadAnalytics}
                                        className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                                    >
                                        Retry
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 z-10">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-100 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 shadow-md shadow-blue-600/20"
                    >
                        Save Project
                    </button>
                </div>
            </div>
        </div>
    );
};
