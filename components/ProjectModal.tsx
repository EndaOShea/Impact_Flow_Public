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
import { projectStatusLabel } from '../lib/display';

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

const codeFor = (name: string) => {
    const t = (name || '').trim();
    if (!t) return 'NP';
    return t.slice(0, 3).toUpperCase();
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
            actualEndDate: actualEndDate ? new Date(actualEndDate) :
                          (status === ProjectStatus.COMPLETED && !projectToEdit?.actualEndDate ? new Date() : projectToEdit?.actualEndDate),
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

    const tabLabel = (tab: ModalTab) =>
        tab === 'COLLAB' ? 'Collaboration' : tab.charAt(0) + tab.slice(1).toLowerCase();

    return (
        <div
            className="overlay"
            onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div className="modal" style={{ width: 'min(94vw, 920px)', height: 'min(88vh, 720px)' }}>

                {/* Header */}
                <div className="modal-h">
                    <span
                        className="proj-badge"
                        style={{ ['--pc' as any]: color, width: 36, height: 36, borderRadius: 11, fontSize: 13 }}
                    >
                        {codeFor(title)}
                    </span>
                    <input
                        className="modal-title"
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Project name…"
                        autoFocus
                    />
                    <button className="icon-btn" onClick={onClose} title="Close">
                        <X size={18} />
                    </button>
                </div>

                {/* Tabs */}
                <div className="modal-tabs">
                    {(['DETAILS', 'STRATEGY', 'TEAM', 'COLLAB', 'ANALYTICS'] as ModalTab[]).map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={'modal-tab' + (activeTab === tab ? ' on' : '')}
                        >
                            {tabLabel(tab)}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="modal-body">

                    {/* TAB: DETAILS */}
                    {activeTab === 'DETAILS' && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 22 }}>
                            {/* Left Column: Main Content */}
                            <div>
                                <div className="field">
                                    <label>Description</label>
                                    <textarea
                                        className="textarea"
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        placeholder="Detailed description of the project..."
                                    />
                                </div>

                                {/* Project Info Card */}
                                <div className="subpanel">
                                    <div className="ph"><Briefcase size={13} /> PROJECT INFORMATION</div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 20px', fontSize: 13.5 }}>
                                        <div>
                                            <div style={{ color: 'var(--muted)', fontWeight: 600, marginBottom: 3 }}>Status</div>
                                            <b>{projectStatusLabel(status)}</b>
                                        </div>
                                        <div>
                                            <div style={{ color: 'var(--muted)', fontWeight: 600, marginBottom: 3 }}>Priority</div>
                                            <b>{priority}</b>
                                        </div>
                                        <div>
                                            <div style={{ color: 'var(--muted)', fontWeight: 600, marginBottom: 3 }}>Start date</div>
                                            <b>{startDate ? new Date(startDate).toLocaleDateString('en-GB') : 'Not set'}</b>
                                        </div>
                                        <div>
                                            <div style={{ color: 'var(--muted)', fontWeight: 600, marginBottom: 3 }}>Target end</div>
                                            <b>{targetEndDate ? new Date(targetEndDate).toLocaleDateString('en-GB') : 'Not set'}</b>
                                        </div>
                                    </div>
                                </div>

                                <div className="subpanel" style={{ marginTop: 16 }}>
                                    <div className="ph">CALENDAR COLOR</div>
                                    <div className="swatches">
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
                                            <div
                                                key={c.value}
                                                className={'swatch' + (color === c.value ? ' on' : '')}
                                                style={{ background: c.value }}
                                                onClick={() => setColor(c.value)}
                                                title={c.name}
                                            />
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Right Column: Settings */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                {/* Status & Priority */}
                                <div className="subpanel">
                                    <div className="ph">CLASSIFICATION</div>
                                    <div className="field">
                                        <label>Status</label>
                                        <select
                                            className="input"
                                            value={status}
                                            onChange={(e) => setStatus(e.target.value as ProjectStatus)}
                                        >
                                            {Object.values(ProjectStatus).map(s => (
                                                <option key={s} value={s}>{projectStatusLabel(s)}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="field" style={{ marginBottom: 0 }}>
                                        <label>Priority</label>
                                        <select
                                            className="input"
                                            value={priority}
                                            onChange={(e) => setPriority(e.target.value as Priority)}
                                        >
                                            {Object.values(Priority).map(p => (
                                                <option key={p} value={p}>{p}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                {/* Dates */}
                                <div className="subpanel">
                                    <div className="ph">TIMELINE</div>
                                    <div className="field">
                                        <label>Start date</label>
                                        <input
                                            className="input"
                                            type="date"
                                            value={startDate}
                                            onChange={(e) => setStartDate(e.target.value)}
                                        />
                                    </div>
                                    <div className="field" style={{ marginBottom: status === ProjectStatus.COMPLETED ? 16 : 0 }}>
                                        <label>Target end date</label>
                                        <input
                                            className="input"
                                            type="date"
                                            value={targetEndDate}
                                            onChange={(e) => setTargetEndDate(e.target.value)}
                                        />
                                    </div>
                                    {status === ProjectStatus.COMPLETED && (
                                        <div className="field" style={{ marginBottom: 0 }}>
                                            <label>Actual end date</label>
                                            <input
                                                className="input"
                                                type="date"
                                                value={actualEndDate}
                                                onChange={(e) => setActualEndDate(e.target.value)}
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TAB: STRATEGY */}
                    {activeTab === 'STRATEGY' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                            {/* Vision */}
                            <div className="subpanel">
                                <div className="ph"><Target size={13} /> VISION</div>
                                <textarea
                                    className="textarea"
                                    value={vision}
                                    onChange={(e) => setVision(e.target.value)}
                                    placeholder="What is the long-term vision for this project?"
                                />
                            </div>

                            {/* Success Criteria */}
                            <div className="subpanel">
                                <div className="ph"><CheckCircle2 size={13} /> SUCCESS CRITERIA</div>
                                <textarea
                                    className="textarea"
                                    value={successCriteria}
                                    onChange={(e) => setSuccessCriteria(e.target.value)}
                                    placeholder="How will success be measured? What are the key outcomes?"
                                />
                            </div>

                            {/* OKRs */}
                            <div className="subpanel">
                                <div className="ph"><Flag size={13} /> OBJECTIVES &amp; KEY RESULTS</div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
                                    {okrs.map((okr, index) => (
                                        <div
                                            key={index}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: 10,
                                                background: 'var(--inset)', padding: '11px 13px', borderRadius: 'var(--radius-sm)'
                                            }}
                                        >
                                            <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600, color: 'var(--ink2)' }}>{okr}</span>
                                            <button
                                                className="icon-btn"
                                                style={{ width: 30, height: 30 }}
                                                onClick={() => handleDeleteOkr(index)}
                                                title="Remove"
                                            >
                                                <Trash size={14} />
                                            </button>
                                        </div>
                                    ))}
                                    {okrs.length === 0 && (
                                        <p style={{ color: 'var(--faint)', fontSize: 13, fontStyle: 'italic' }}>No OKRs defined yet.</p>
                                    )}
                                </div>
                                <div style={{ display: 'flex', gap: 10 }}>
                                    <input
                                        className="input"
                                        type="text"
                                        value={newOkrInput}
                                        onChange={(e) => setNewOkrInput(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleAddOkr()}
                                        placeholder="Add an objective or key result..."
                                    />
                                    <button className="btn" onClick={handleAddOkr}>
                                        <Plus size={15} /> Add
                                    </button>
                                </div>
                            </div>

                            {/* Notes */}
                            <div className="subpanel">
                                <div className="ph"><MessageSquare size={13} /> NOTES</div>
                                <textarea
                                    className="textarea"
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    placeholder="Additional notes, considerations, or context..."
                                />
                            </div>
                        </div>
                    )}

                    {/* TAB: TEAM */}
                    {activeTab === 'TEAM' && (
                        <div className="subpanel">
                            <div className="card-h" style={{ marginBottom: 14 }}>
                                <div>
                                    <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15 }}>
                                        <Users size={16} /> Team Members
                                    </h3>
                                </div>
                                <button className="btn-g btn" onClick={handleAddTeamMember}>
                                    <Plus size={15} /> Add Member
                                </button>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                {teamMembers.length === 0 && (
                                    <p style={{ color: 'var(--faint)', fontSize: 13, fontStyle: 'italic', textAlign: 'center', padding: '32px 0' }}>
                                        No team members added yet.
                                    </p>
                                )}
                                {teamMembers.map(member => {
                                    const isExpanded = expandedMemberIds.has(member.id);
                                    return (
                                        <div
                                            key={member.id}
                                            style={{ background: 'var(--inset)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--line)', overflow: 'hidden' }}
                                        >
                                            {/* Collapsed Header - Always Visible */}
                                            <div
                                                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 13px', cursor: 'pointer' }}
                                                onClick={() => toggleMemberExpanded(member.id)}
                                            >
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 11, flex: 1, minWidth: 0 }}>
                                                    <span className="ava">
                                                        {member.name ? member.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : '?'}
                                                    </span>
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        <div style={{ fontWeight: 700, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                            {member.name || <span style={{ color: 'var(--faint)', fontStyle: 'italic' }}>Unnamed</span>}
                                                        </div>
                                                        {member.role && (
                                                            <div style={{ fontSize: 12, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{member.role}</div>
                                                        )}
                                                    </div>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                    <button
                                                        className="icon-btn"
                                                        style={{ width: 30, height: 30 }}
                                                        onClick={(e) => { e.stopPropagation(); handleDeleteTeamMember(member.id); }}
                                                        title="Remove member"
                                                    >
                                                        <Trash size={14} />
                                                    </button>
                                                    {isExpanded
                                                        ? <ChevronDown size={18} style={{ color: 'var(--muted)' }} />
                                                        : <ChevronRight size={18} style={{ color: 'var(--muted)' }} />}
                                                </div>
                                            </div>

                                            {/* Expanded Details */}
                                            {isExpanded && (
                                                <div style={{ padding: '14px 13px', borderTop: '1px solid var(--line)', background: 'var(--panel)' }}>
                                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                                                        <div className="field" style={{ marginBottom: 0 }}>
                                                            <label>Name *</label>
                                                            <input
                                                                className="input"
                                                                type="text"
                                                                value={member.name}
                                                                onChange={(e) => handleUpdateTeamMember(member.id, { name: e.target.value })}
                                                                onClick={(e) => e.stopPropagation()}
                                                                placeholder="Full name"
                                                            />
                                                        </div>
                                                        <div className="field" style={{ marginBottom: 0 }}>
                                                            <label>Role</label>
                                                            <input
                                                                className="input"
                                                                type="text"
                                                                value={member.role || ''}
                                                                onChange={(e) => handleUpdateTeamMember(member.id, { role: e.target.value })}
                                                                onClick={(e) => e.stopPropagation()}
                                                                placeholder="e.g., Designer, Developer"
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="field" style={{ marginTop: 14, marginBottom: 0 }}>
                                                        <label>Email</label>
                                                        <input
                                                            className="input"
                                                            type="email"
                                                            value={member.email || ''}
                                                            onChange={(e) => handleUpdateTeamMember(member.id, { email: e.target.value })}
                                                            onClick={(e) => e.stopPropagation()}
                                                            placeholder="email@example.com"
                                                        />
                                                    </div>
                                                    <div className="field" style={{ marginTop: 14, marginBottom: 0 }}>
                                                        <label>Notes</label>
                                                        <textarea
                                                            className="textarea"
                                                            style={{ minHeight: 80 }}
                                                            value={member.notes || ''}
                                                            onChange={(e) => handleUpdateTeamMember(member.id, { notes: e.target.value })}
                                                            onClick={(e) => e.stopPropagation()}
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
                    )}

                    {/* TAB: COLLAB */}
                    {activeTab === 'COLLAB' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                            {/* Attachments */}
                            <div className="subpanel">
                                <div className="ph">
                                    <Paperclip size={13} /> ATTACHMENTS
                                    <span style={{ color: 'var(--muted)', fontWeight: 700, marginLeft: 6 }}>({attachments.length}/3)</span>
                                </div>

                                {attachmentError && (
                                    <div style={{
                                        marginBottom: 14, padding: 11, background: 'var(--red-bg)',
                                        border: '1px solid color-mix(in srgb, var(--red) 30%, transparent)', borderRadius: 'var(--radius-sm)',
                                        display: 'flex', alignItems: 'flex-start', gap: 8
                                    }}>
                                        <AlertCircle size={15} style={{ color: 'var(--red)', flex: '0 0 auto', marginTop: 1 }} />
                                        <span style={{ fontSize: 12.5, color: 'var(--red-ink)', fontWeight: 600 }}>{attachmentError}</span>
                                    </div>
                                )}

                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    onChange={handleFileUpload}
                                    style={{ display: 'none' }}
                                    disabled={attachments.length >= 3}
                                />
                                <button
                                    className="btn-g btn"
                                    style={{ marginBottom: 14 }}
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={attachments.length >= 3}
                                >
                                    <Upload size={15} /> Upload File
                                </button>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                                    {attachments.length === 0 && (
                                        <p style={{ gridColumn: '1 / -1', color: 'var(--faint)', fontSize: 12.5, fontStyle: 'italic' }}>No files attached.</p>
                                    )}
                                    {attachments.map(file => (
                                        <div
                                            key={file.id}
                                            style={{
                                                display: 'flex', alignItems: 'center', padding: 9,
                                                background: 'var(--inset)', border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)'
                                            }}
                                        >
                                            <div style={{ padding: 6, background: 'var(--panel)', borderRadius: 7, marginRight: 9, display: 'grid', placeItems: 'center' }}>
                                                <Paperclip size={15} style={{ color: 'var(--muted)' }} />
                                            </div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <h4 style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>{file.name}</h4>
                                                <p style={{ fontSize: 11.5, color: 'var(--faint)', margin: 0 }}>{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                                <button
                                                    className="icon-btn"
                                                    style={{ width: 28, height: 28 }}
                                                    onClick={() => handleDownloadAttachment(file)}
                                                    title="Download file"
                                                >
                                                    <Download size={14} />
                                                </button>
                                                <button
                                                    className="icon-btn"
                                                    style={{ width: 28, height: 28 }}
                                                    onClick={() => handleDeleteAttachment(file.id)}
                                                    title="Delete file"
                                                >
                                                    <Trash size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Resource Links */}
                            <div className="subpanel">
                                <div className="ph"><LinkIcon size={13} /> RESOURCE LINKS</div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                    {resourceLinks.map((link, idx) => (
                                        <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                            <input
                                                className="input"
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
                                                    style={{ width: 38, height: 38, flex: '0 0 auto' }}
                                                    title="Open in new tab"
                                                >
                                                    <ExternalLink size={15} />
                                                </a>
                                            )}
                                            <button
                                                className="icon-btn"
                                                style={{ flex: '0 0 auto' }}
                                                onClick={() => setResourceLinks(resourceLinks.filter((_, i) => i !== idx))}
                                                title="Remove link"
                                            >
                                                <Trash size={15} />
                                            </button>
                                        </div>
                                    ))}
                                    <button
                                        className="btn-ghost btn"
                                        style={{ alignSelf: 'flex-start' }}
                                        onClick={() => setResourceLinks([...resourceLinks, {title: '', url: ''}])}
                                    >
                                        <Plus size={14} /> Add Link
                                    </button>
                                </div>
                            </div>

                            {/* Comments */}
                            <div className="subpanel">
                                <div className="ph"><MessageSquare size={13} /> COMMENTS</div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 16, maxHeight: 300, overflowY: 'auto' }}>
                                    {comments.length === 0 && (
                                        <p style={{ color: 'var(--faint)', fontSize: 13, fontStyle: 'italic' }}>No comments yet.</p>
                                    )}
                                    {comments.map(c => (
                                        <div key={c.id} style={{ display: 'flex', gap: 11 }}>
                                            <span className="ava">{currentUser.avatarInitials}</span>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ background: 'var(--inset)', padding: 11, borderRadius: 'var(--radius-sm)', border: '1px solid var(--line)' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                                        <span style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--ink)' }}>{currentUser.name}</span>
                                                        <span style={{ fontSize: 10.5, color: 'var(--faint)', fontWeight: 600 }}>{new Date(c.createdAt).toLocaleString()}</span>
                                                    </div>
                                                    <p style={{ fontSize: 13.5, color: 'var(--ink2)', margin: 0 }}>{c.text}</p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div style={{ display: 'flex', gap: 10 }}>
                                    <input
                                        className="input"
                                        type="text"
                                        value={newCommentText}
                                        onChange={(e) => setNewCommentText(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
                                        placeholder="Add a comment..."
                                    />
                                    <button className="btn" onClick={handleAddComment}>
                                        <MessageSquare size={15} /> Add
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TAB: ANALYTICS */}
                    {activeTab === 'ANALYTICS' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            {!projectToEdit ? (
                                <div className="subpanel" style={{ textAlign: 'center', padding: '48px 20px' }}>
                                    <BarChart2 size={48} style={{ color: 'var(--faint)', margin: '0 auto 16px' }} />
                                    <p style={{ color: 'var(--muted)' }}>Analytics will be available after saving the project and adding tasks.</p>
                                </div>
                            ) : loadingAnalytics ? (
                                <div className="subpanel" style={{ textAlign: 'center', padding: '48px 20px' }}>
                                    <div
                                        style={{
                                            width: 32, height: 32, borderRadius: '50%', margin: '0 auto 16px',
                                            border: '4px solid var(--accent-soft)', borderTopColor: 'var(--accent)',
                                            animation: 'spin 0.8s linear infinite'
                                        }}
                                    />
                                    <p style={{ color: 'var(--muted)' }}>Loading analytics...</p>
                                </div>
                            ) : analytics ? (
                                <>
                                    {/* Task Summary */}
                                    <div className="subpanel">
                                        <div className="ph"><TrendingUp size={13} /> TASK SUMMARY</div>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
                                            <div style={{ textAlign: 'center' }}>
                                                <div className="num" style={{ fontSize: 24, fontWeight: 800, color: 'var(--ink)' }}>{analytics.taskSummary.totalTasks}</div>
                                                <div style={{ fontSize: 11.5, color: 'var(--muted)', fontWeight: 600 }}>Total Tasks</div>
                                            </div>
                                            <div style={{ textAlign: 'center' }}>
                                                <div className="num" style={{ fontSize: 24, fontWeight: 800, color: 'var(--green-ink)' }}>{analytics.taskSummary.completedTasks}</div>
                                                <div style={{ fontSize: 11.5, color: 'var(--muted)', fontWeight: 600 }}>Completed</div>
                                            </div>
                                            <div style={{ textAlign: 'center' }}>
                                                <div className="num" style={{ fontSize: 24, fontWeight: 800, color: 'var(--accent)' }}>{analytics.taskSummary.inProgressTasks}</div>
                                                <div style={{ fontSize: 11.5, color: 'var(--muted)', fontWeight: 600 }}>In Progress</div>
                                            </div>
                                            <div style={{ textAlign: 'center' }}>
                                                <div className="num" style={{ fontSize: 24, fontWeight: 800, color: 'var(--amber-ink)' }}>{analytics.taskSummary.overdueTasks}</div>
                                                <div style={{ fontSize: 11.5, color: 'var(--muted)', fontWeight: 600 }}>Overdue</div>
                                            </div>
                                        </div>
                                        <div style={{ marginTop: 16, padding: 11, background: 'var(--inset)', borderRadius: 'var(--radius-sm)' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink2)' }}>Progress</span>
                                                <span className="num" style={{ fontSize: 13, fontWeight: 800, color: 'var(--accent)' }}>{analytics.taskSummary.progressPercentage}%</span>
                                            </div>
                                            <div className="bar">
                                                <i style={{ width: `${analytics.taskSummary.progressPercentage}%`, background: 'var(--accent)' }} />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Time Tracking */}
                                    <div className="subpanel">
                                        <div className="ph"><Clock size={13} /> TIME TRACKING</div>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
                                            <div style={{ textAlign: 'center' }}>
                                                <div className="num" style={{ fontSize: 24, fontWeight: 800, color: 'var(--ink)' }}>{analytics.timeTracking.totalEstimatedHours.toFixed(1)}h</div>
                                                <div style={{ fontSize: 11.5, color: 'var(--muted)', fontWeight: 600 }}>Estimated</div>
                                            </div>
                                            <div style={{ textAlign: 'center' }}>
                                                <div className="num" style={{ fontSize: 24, fontWeight: 800, color: 'var(--accent)' }}>{analytics.timeTracking.totalHoursSpent.toFixed(1)}h</div>
                                                <div style={{ fontSize: 11.5, color: 'var(--muted)', fontWeight: 600 }}>Spent</div>
                                            </div>
                                            <div style={{ textAlign: 'center' }}>
                                                <div className="num" style={{ fontSize: 24, fontWeight: 800, color: '#8b5cf6' }}>{analytics.timeTracking.hoursRemaining.toFixed(1)}h</div>
                                                <div style={{ fontSize: 11.5, color: 'var(--muted)', fontWeight: 600 }}>Remaining</div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Impact Metrics */}
                                    {analytics.aggregatedImpact && Object.keys(analytics.aggregatedImpact).length > 0 && (
                                        <div className="subpanel">
                                            <div className="ph"><BarChart2 size={13} /> AGGREGATED IMPACT</div>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                                {analytics.aggregatedImpact['Revenue'] && analytics.aggregatedImpact['Revenue'].target > 0 && (
                                                    <div style={{ padding: 11, background: 'var(--green-bg)', borderRadius: 'var(--radius-sm)' }}>
                                                        <div style={{ fontSize: 11.5, color: 'var(--green-ink)', fontWeight: 700, marginBottom: 4 }}>Revenue</div>
                                                        <div className="num" style={{ fontSize: 18, fontWeight: 800, color: 'var(--green-ink)' }}>€{analytics.aggregatedImpact['Revenue'].target.toLocaleString()}</div>
                                                        {analytics.aggregatedImpact['Revenue'].achieved > 0 && (
                                                            <div style={{ fontSize: 11.5, color: 'var(--green-ink)' }}>Achieved: €{analytics.aggregatedImpact['Revenue'].achieved.toLocaleString()}</div>
                                                        )}
                                                    </div>
                                                )}
                                                {analytics.aggregatedImpact['Time Saved (Hours)'] && analytics.aggregatedImpact['Time Saved (Hours)'].target > 0 && (
                                                    <div style={{ padding: 11, background: 'var(--accent-soft)', borderRadius: 'var(--radius-sm)' }}>
                                                        <div style={{ fontSize: 11.5, color: 'var(--accent)', fontWeight: 700, marginBottom: 4 }}>Time Saved</div>
                                                        <div className="num" style={{ fontSize: 18, fontWeight: 800, color: 'var(--accent)' }}>{analytics.aggregatedImpact['Time Saved (Hours)'].target.toFixed(1)}h</div>
                                                        {analytics.aggregatedImpact['Time Saved (Hours)'].achieved > 0 && (
                                                            <div style={{ fontSize: 11.5, color: 'var(--accent)' }}>Achieved: {analytics.aggregatedImpact['Time Saved (Hours)'].achieved.toFixed(1)}h</div>
                                                        )}
                                                    </div>
                                                )}
                                                {analytics.aggregatedImpact['Cost Reduction'] && analytics.aggregatedImpact['Cost Reduction'].target > 0 && (
                                                    <div style={{ padding: 11, background: 'color-mix(in srgb, #8b5cf6 14%, transparent)', borderRadius: 'var(--radius-sm)' }}>
                                                        <div style={{ fontSize: 11.5, color: '#8b5cf6', fontWeight: 700, marginBottom: 4 }}>Cost Reduction</div>
                                                        <div className="num" style={{ fontSize: 18, fontWeight: 800, color: '#8b5cf6' }}>${analytics.aggregatedImpact['Cost Reduction'].target.toLocaleString()}</div>
                                                        {analytics.aggregatedImpact['Cost Reduction'].achieved > 0 && (
                                                            <div style={{ fontSize: 11.5, color: '#8b5cf6' }}>Achieved: ${analytics.aggregatedImpact['Cost Reduction'].achieved.toLocaleString()}</div>
                                                        )}
                                                    </div>
                                                )}
                                                {analytics.aggregatedImpact['CSAT Score'] && analytics.aggregatedImpact['CSAT Score'].target > 0 && (
                                                    <div style={{ padding: 11, background: 'var(--amber-bg)', borderRadius: 'var(--radius-sm)' }}>
                                                        <div style={{ fontSize: 11.5, color: 'var(--amber-ink)', fontWeight: 700, marginBottom: 4 }}>CSAT Score</div>
                                                        <div className="num" style={{ fontSize: 18, fontWeight: 800, color: 'var(--amber-ink)' }}>{analytics.aggregatedImpact['CSAT Score'].target.toFixed(1)}/10</div>
                                                        {analytics.aggregatedImpact['CSAT Score'].achieved > 0 && (
                                                            <div style={{ fontSize: 11.5, color: 'var(--amber-ink)' }}>Achieved: {analytics.aggregatedImpact['CSAT Score'].achieved.toFixed(1)}</div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* Blockers */}
                                    {analytics.blockers && analytics.blockers.totalBlockers > 0 && (
                                        <div className="subpanel">
                                            <div className="ph"><AlertCircle size={13} /> BLOCKERS</div>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                                                <div style={{ textAlign: 'center', padding: 11, background: 'var(--red-bg)', borderRadius: 'var(--radius-sm)' }}>
                                                    <div className="num" style={{ fontSize: 24, fontWeight: 800, color: 'var(--red-ink)' }}>{analytics.blockers.activeBlockers}</div>
                                                    <div style={{ fontSize: 11.5, color: 'var(--red-ink)', fontWeight: 600 }}>Active</div>
                                                </div>
                                                <div style={{ textAlign: 'center', padding: 11, background: 'var(--green-bg)', borderRadius: 'var(--radius-sm)' }}>
                                                    <div className="num" style={{ fontSize: 24, fontWeight: 800, color: 'var(--green-ink)' }}>{analytics.blockers.resolvedBlockers}</div>
                                                    <div style={{ fontSize: 11.5, color: 'var(--green-ink)', fontWeight: 600 }}>Resolved</div>
                                                </div>
                                            </div>
                                            {analytics.blockers.blockersByMember && Object.keys(analytics.blockers.blockersByMember).length > 0 && (
                                                <div>
                                                    <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--muted)', marginBottom: 8 }}>By Team Member</div>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                                        {Object.entries(analytics.blockers.blockersByMember).map(([memberName, counts]: [string, any]) => (
                                                            <div key={memberName} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
                                                                <span style={{ color: 'var(--ink2)', fontWeight: 600 }}>{memberName}</span>
                                                                <span style={{ fontWeight: 700 }}>
                                                                    <span style={{ color: 'var(--red-ink)' }}>{counts.active}</span>
                                                                    {counts.resolved > 0 && <span style={{ color: 'var(--faint)' }}> / {counts.resolved} resolved</span>}
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
                                <div className="subpanel" style={{ textAlign: 'center', padding: '48px 20px' }}>
                                    <AlertCircle size={48} style={{ color: 'var(--faint)', margin: '0 auto 16px' }} />
                                    <p style={{ color: 'var(--muted)' }}>Failed to load analytics. Please try again.</p>
                                    <button className="btn" style={{ marginTop: 16 }} onClick={loadAnalytics}>
                                        Retry
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="modal-foot">
                    <button className="btn-g btn" onClick={onClose}>
                        Cancel
                    </button>
                    <button className="btn" onClick={handleSave}>
                        Save Project
                    </button>
                </div>
            </div>
        </div>
    );
};
