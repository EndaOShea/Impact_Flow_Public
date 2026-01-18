import React, { useState } from 'react';
import {
    Briefcase, Calendar, Users, CheckCircle2, TrendingUp, Flag,
    Clock, Target, AlertCircle, ChevronDown, ChevronRight, Circle
} from 'lucide-react';
import { Project, ProjectStatus, Priority, Task, TaskStatus } from '../types';

interface ProjectsViewProps {
    projects: Project[];
    tasks: Task[];
    onProjectClick: (project: Project) => void;
    onTaskClick: (task: Task) => void;
}

export const ProjectsView: React.FC<ProjectsViewProps> = ({ projects, tasks, onProjectClick, onTaskClick }) => {
    const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null);

    const getTasksForProject = (projectId: string) => {
        return tasks.filter(t => t.projectId === projectId);
    };

    const getTaskStatusColor = (status: TaskStatus) => {
        switch (status) {
            case TaskStatus.COMPLETED:
                return 'text-green-600 bg-green-100';
            case TaskStatus.IN_PROGRESS:
                return 'text-blue-600 bg-blue-100';
            case TaskStatus.OVERDUE:
                return 'text-red-600 bg-red-100';
            case TaskStatus.TODO:
                return 'text-slate-600 bg-slate-100';
            default:
                return 'text-slate-500 bg-slate-100';
        }
    };

    const getStatusColor = (status: ProjectStatus) => {
        switch (status) {
            case ProjectStatus.PLANNING:
                return 'bg-blue-100 text-blue-700';
            case ProjectStatus.ACTIVE:
                return 'bg-green-100 text-green-700';
            case ProjectStatus.ON_HOLD:
                return 'bg-orange-100 text-orange-700';
            case ProjectStatus.COMPLETED:
                return 'bg-emerald-100 text-emerald-700';
            case ProjectStatus.CANCELLED:
                return 'bg-red-100 text-red-700';
            default:
                return 'bg-slate-100 text-slate-600';
        }
    };

    const getPriorityColor = (priority: Priority) => {
        switch (priority) {
            case Priority.CRITICAL:
                return 'text-red-600 bg-red-600';
            case Priority.HIGH:
                return 'text-orange-500 bg-orange-500';
            case Priority.MEDIUM:
                return 'text-blue-500 bg-blue-500';
            case Priority.LOW:
                return 'text-green-500 bg-green-500';
            default:
                return 'text-slate-400 bg-slate-400';
        }
    };

    const getDateRangeText = (project: Project) => {
        const start = project.startDate ? new Date(project.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : 'Not set';
        const end = project.targetEndDate ? new Date(project.targetEndDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : 'Not set';
        return `${start} → ${end}`;
    };

    const getProgressPercentage = (project: Project) => {
        if (!project.totalTasks || project.totalTasks === 0) return 0;
        return Math.round(((project.completedTasks || 0) / project.totalTasks) * 100);
    };

    return (
        <div className="animate-in fade-in">
            {projects.length === 0 ? (
                <div className="text-center py-20 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                    <Briefcase className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-500 font-medium mb-2">No projects found</p>
                    <p className="text-slate-400 text-sm">Create your first project to get started</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {projects.map(project => {
                        const progressPercentage = getProgressPercentage(project);
                        const teamMemberCount = project.teamMembers?.length || 0;
                        const totalTasks = project.totalTasks || 0;
                        const completedTasks = project.completedTasks || 0;
                        const inProgressTasks = totalTasks - completedTasks;

                        return (
                            <div
                                key={project.id}
                                onClick={() => onProjectClick(project)}
                                className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-lg hover:border-blue-300 transition-all cursor-pointer group"
                            >
                                {/* Header */}
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex items-center gap-2">
                                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                            <Briefcase className="w-5 h-5 text-blue-600" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-bold text-slate-800 truncate group-hover:text-blue-600 transition-colors">
                                                {project.title}
                                            </h3>
                                        </div>
                                    </div>
                                    <div className={`w-3 h-3 rounded-full flex-shrink-0 mt-1 ${getPriorityColor(project.priority).split(' ')[1]}`}></div>
                                </div>

                                {/* Description */}
                                {project.description && (
                                    <p className="text-sm text-slate-600 mb-4 line-clamp-2">
                                        {project.description}
                                    </p>
                                )}

                                {/* Stats Row */}
                                <div className="flex items-center gap-4 mb-4 text-xs text-slate-500">
                                    <div className="flex items-center gap-1">
                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                        <span>{totalTasks} {totalTasks === 1 ? 'task' : 'tasks'}</span>
                                    </div>
                                    {teamMemberCount > 0 && (
                                        <div className="flex items-center gap-1">
                                            <Users className="w-3.5 h-3.5" />
                                            <span>{teamMemberCount} {teamMemberCount === 1 ? 'member' : 'members'}</span>
                                        </div>
                                    )}
                                </div>

                                {/* Progress Bar */}
                                <div className="mb-4">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-xs font-medium text-slate-600">Progress</span>
                                        <span className="text-xs text-slate-400 font-medium">{progressPercentage}%</span>
                                    </div>
                                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all"
                                            style={{ width: `${progressPercentage}%` }}
                                        ></div>
                                    </div>
                                </div>

                                {/* Task Breakdown */}
                                {totalTasks > 0 && (
                                    <div className="flex items-center gap-2 mb-4 text-xs">
                                        <div className="flex items-center gap-1 text-green-600">
                                            <div className="w-2 h-2 bg-green-600 rounded-full"></div>
                                            <span>{completedTasks} done</span>
                                        </div>
                                        {inProgressTasks > 0 && (
                                            <div className="flex items-center gap-1 text-blue-600">
                                                <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                                                <span>{inProgressTasks} active</span>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Date Range */}
                                <div className="flex items-center gap-2 mb-4 text-xs text-slate-500">
                                    <Calendar className="w-3.5 h-3.5" />
                                    <span>{getDateRangeText(project)}</span>
                                </div>

                                {/* OKRs Badge */}
                                {project.okrs && project.okrs.length > 0 && (
                                    <div className="flex items-center gap-1 mb-4 text-xs text-purple-600">
                                        <Target className="w-3.5 h-3.5" />
                                        <span>{project.okrs.length} {project.okrs.length === 1 ? 'OKR' : 'OKRs'}</span>
                                    </div>
                                )}

                                {/* Aggregated Impact */}
                                {project.aggregatedImpact && (
                                    <div className="mb-4 p-3 bg-slate-50 rounded-lg">
                                        <div className="text-xs font-medium text-slate-600 mb-2">Impact Summary</div>
                                        <div className="grid grid-cols-2 gap-2 text-xs">
                                            {project.aggregatedImpact.revenue > 0 && (
                                                <div className="flex items-center gap-1">
                                                    <TrendingUp className="w-3 h-3 text-green-600" />
                                                    <span className="text-green-600 font-semibold">
                                                        €{project.aggregatedImpact.revenue.toLocaleString()}
                                                    </span>
                                                </div>
                                            )}
                                            {project.aggregatedImpact.timeSaved > 0 && (
                                                <div className="flex items-center gap-1">
                                                    <Clock className="w-3 h-3 text-blue-600" />
                                                    <span className="text-blue-600 font-semibold">
                                                        {project.aggregatedImpact.timeSaved.toFixed(0)}h
                                                    </span>
                                                </div>
                                            )}
                                            {project.aggregatedImpact.costReduction > 0 && (
                                                <div className="flex items-center gap-1">
                                                    <TrendingUp className="w-3 h-3 text-purple-600" />
                                                    <span className="text-purple-600 font-semibold">
                                                        -${project.aggregatedImpact.costReduction.toLocaleString()}
                                                    </span>
                                                </div>
                                            )}
                                            {project.aggregatedImpact.csat > 0 && (
                                                <div className="flex items-center gap-1">
                                                    <CheckCircle2 className="w-3 h-3 text-orange-600" />
                                                    <span className="text-orange-600 font-semibold">
                                                        {project.aggregatedImpact.csat.toFixed(1)}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Footer: Status */}
                                <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                                    <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${getStatusColor(project.status)}`}>
                                        {project.status.replace('_', ' ')}
                                    </span>
                                    <div className="flex items-center gap-1 text-xs font-medium text-slate-400">
                                        <Flag className={`w-3 h-3 ${getPriorityColor(project.priority).split(' ')[0]}`} />
                                        {project.priority}
                                    </div>
                                </div>

                                {/* View Tasks Button */}
                                {totalTasks > 0 && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setExpandedProjectId(expandedProjectId === project.id ? null : project.id);
                                        }}
                                        className="w-full mt-4 py-2 px-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 flex items-center justify-center gap-2 transition-colors"
                                    >
                                        {expandedProjectId === project.id ? (
                                            <>
                                                <ChevronDown className="w-4 h-4" />
                                                Hide Tasks
                                            </>
                                        ) : (
                                            <>
                                                <ChevronRight className="w-4 h-4" />
                                                View {totalTasks} {totalTasks === 1 ? 'Task' : 'Tasks'}
                                            </>
                                        )}
                                    </button>
                                )}

                                {/* Expanded Task List */}
                                {expandedProjectId === project.id && (
                                    <div className="mt-4 border-t border-slate-100 pt-4 space-y-2">
                                        {getTasksForProject(project.id).map(task => (
                                            <div
                                                key={task.id}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onTaskClick(task);
                                                }}
                                                className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-lg hover:border-blue-300 hover:shadow-sm cursor-pointer transition-all"
                                            >
                                                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                                                    task.status === TaskStatus.COMPLETED ? 'bg-green-500' :
                                                    task.status === TaskStatus.IN_PROGRESS ? 'bg-blue-500' :
                                                    task.status === TaskStatus.OVERDUE ? 'bg-red-500' :
                                                    'bg-slate-400'
                                                }`} />
                                                <div className="flex-1 min-w-0">
                                                    <div className={`text-sm font-medium truncate ${
                                                        task.status === TaskStatus.COMPLETED ? 'text-slate-400 line-through' : 'text-slate-800'
                                                    }`}>
                                                        {task.title}
                                                    </div>
                                                    {task.dueDate && (
                                                        <div className="text-xs text-slate-400">
                                                            Due: {new Date(task.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                                                        </div>
                                                    )}
                                                </div>
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${getTaskStatusColor(task.status)}`}>
                                                    {task.status.replace('_', ' ')}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};
