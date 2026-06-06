import React, { useState } from 'react';
import { Briefcase, ChevronRight } from 'lucide-react';
import { Project, Task, ImpactType } from '../types';
import {
    projectStatusTagClass, projectStatusLabel, priorityClass,
    currencySymbol, colorForId, codeFor
} from '../lib/display';

interface ProjectsViewProps {
    projects: Project[];
    tasks: Task[];
    onProjectClick: (project: Project) => void;
    onTaskClick: (task: Task) => void;
}

export const ProjectsView: React.FC<ProjectsViewProps> = ({ projects, tasks, onProjectClick, onTaskClick }) => {
    const [view, setView] = useState<'grid' | 'list'>('grid');

    const computeProject = (p: Project) => {
        const color = p.color || colorForId(p.id);
        const pTasks = tasks.filter(t => t.projectId === p.id);
        const total = p.totalTasks ?? pTasks.length;
        const completed = p.completedTasks ?? 0;
        const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
        const members = p.teamMembers?.length || 0;

        let impact = 0;
        let firstRevCurrency: string | undefined;
        for (const t of pTasks) {
            for (const m of (t.impactMetrics || [])) {
                if (m.type === ImpactType.REVENUE) {
                    impact += m.achievedValue || 0;
                    if (firstRevCurrency === undefined) firstRevCurrency = m.currency;
                }
            }
        }
        const impactLabel = `${currencySymbol(firstRevCurrency)}${impact >= 1000 ? (impact / 1000).toFixed(1) + 'K' : impact}`;

        return { color, pTasks, total, completed, progress, members, impactLabel };
    };

    return (
        <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span className="chip"><span className="lbl">Status</span> All</span>
                    <span className="chip"><span className="lbl">Priority</span> All</span>
                </div>
                <div className="seg">
                    <button className={view === 'grid' ? 'on' : ''} onClick={() => setView('grid')}>Grid</button>
                    <button className={view === 'list' ? 'on' : ''} onClick={() => setView('list')}>List</button>
                </div>
            </div>

            {projects.length === 0 ? (
                <div className="empty">
                    <div className="ic"><Briefcase size={28} /></div>
                    <h4>No projects found</h4>
                    <p>Create your first project to get started</p>
                </div>
            ) : view === 'grid' ? (
                <div className="grid-3">
                    {projects.map(p => {
                        const { color, total, completed, progress, members, impactLabel } = computeProject(p);
                        return (
                            <div
                                key={p.id}
                                className="panel"
                                style={{ cursor: 'pointer', padding: 0, overflow: 'hidden' }}
                                onClick={() => onProjectClick(p)}
                            >
                                <div style={{ height: 5, background: color }} />
                                <div style={{ padding: 'var(--card-pad)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                                        <span className="proj-badge" style={{ ['--pc' as any]: color, width: 40, height: 40, borderRadius: 12, fontSize: 13 }}>{codeFor(p.title)}</span>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontSize: 15.5, fontWeight: 800, letterSpacing: '-.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</div>
                                            <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>{completed}/{total} tasks · {members} members</div>
                                        </div>
                                        <span className={'pri ' + priorityClass(p.priority)}>{p.priority}</span>
                                    </div>

                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, marginBottom: 7 }}>
                                        <span style={{ color: 'var(--muted)' }}>Progress</span>
                                        <span className="num">{progress}%</span>
                                    </div>
                                    <div className="bar"><i style={{ width: progress + '%', background: color }} /></div>

                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 }}>
                                        <span className={'tag ' + projectStatusTagClass(p.status)}>{projectStatusLabel(p.status)}</span>
                                        <span className="num" style={{ fontSize: 13, fontWeight: 800, color: 'var(--ink)' }}>{impactLabel} impact</span>
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--line-soft)' }}>
                                        <div className="ava-stack">
                                            {(p.teamMembers || []).slice(0, 4).map(m => (
                                                <span key={m.id} className="ava sm" style={{ background: 'var(--inset)', color: 'var(--ink)' }} title={m.name}>{(m.name || '').slice(0, 2).toUpperCase()}</span>
                                            ))}
                                        </div>
                                        <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 4 }}>Open <ChevronRight size={14} /></span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="panel flush">
                    <table className="tbl">
                        <thead>
                            <tr>
                                <th style={{ paddingLeft: 'var(--card-pad)' }}>Project</th>
                                <th>Status</th>
                                <th>Priority</th>
                                <th style={{ width: 200 }}>Progress</th>
                                <th>Team</th>
                                <th style={{ textAlign: 'right', paddingRight: 'var(--card-pad)' }}>Impact</th>
                            </tr>
                        </thead>
                        <tbody>
                            {projects.map(p => {
                                const { color, progress, members, impactLabel } = computeProject(p);
                                return (
                                    <tr key={p.id} onClick={() => onProjectClick(p)} style={{ cursor: 'pointer' }}>
                                        <td style={{ paddingLeft: 'var(--card-pad)' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                <span className="proj-badge" style={{ ['--pc' as any]: color }}>{codeFor(p.title)}</span>
                                                <b style={{ color: 'var(--ink)' }}>{p.title}</b>
                                            </div>
                                        </td>
                                        <td><span className={'tag ' + projectStatusTagClass(p.status)}>{projectStatusLabel(p.status)}</span></td>
                                        <td><span className={'pri ' + priorityClass(p.priority)}>{p.priority}</span></td>
                                        <td>
                                            <span className="mini-bar"><i style={{ width: progress + '%', background: color }} /></span>{' '}
                                            <span className="num" style={{ fontWeight: 800, color: 'var(--ink)' }}>{progress}%</span>
                                        </td>
                                        <td>
                                            <div className="ava-stack">
                                                {(p.teamMembers || []).slice(0, 4).map(m => (
                                                    <span key={m.id} className="ava sm" style={{ background: 'var(--inset)', color: 'var(--ink)' }} title={m.name}>{(m.name || '').slice(0, 2).toUpperCase()}</span>
                                                ))}
                                                {members === 0 && <span style={{ fontSize: 12, color: 'var(--muted)' }}>—</span>}
                                            </div>
                                        </td>
                                        <td className="num" style={{ textAlign: 'right', fontWeight: 800, color: 'var(--ink)', paddingRight: 'var(--card-pad)' }}>{impactLabel}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </>
    );
};
