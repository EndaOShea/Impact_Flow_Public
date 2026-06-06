import React, { useEffect, useRef, useState } from 'react';
import { Filter, ChevronDown, ArrowUpDown } from 'lucide-react';
import { TaskStatus, Priority, Project } from '../types';

interface Opt { value: string; label: string; }

const ChipSelect: React.FC<{
  label: string;
  value: string;
  options: Opt[];
  onChange: (v: string) => void;
}> = ({ label, value, options, onChange }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);
  const current = options.find(o => o.value === value) || options[0];
  const active = value !== 'ALL';
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button className={'chip' + (active ? ' active' : '')} onClick={() => setOpen(o => !o)} type="button">
        <span className="lbl">{label}</span> {current?.label} <ChevronDown className="w-[15px] h-[15px]" />
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: '110%', left: 0, zIndex: 30, background: 'var(--panel)',
          border: '1px solid var(--line)', borderRadius: 12, padding: 6, minWidth: 170,
          boxShadow: 'var(--shadow-lg)', maxHeight: 280, overflowY: 'auto',
        }}>
          {options.map(o => (
            <div key={o.value} onClick={() => { onChange(o.value); setOpen(false); }}
              style={{
                padding: '9px 11px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                color: value === o.value ? 'var(--accent)' : 'var(--ink2)',
                background: value === o.value ? 'var(--accent-softer)' : 'transparent',
              }}>{o.label}</div>
          ))}
        </div>
      )}
    </div>
  );
};

interface FilterBarProps {
  filterStatus: string;
  setFilterStatus: (v: any) => void;
  filterPriority: string;
  setFilterPriority: (v: any) => void;
  filterDate: string;
  setFilterDate: (v: any) => void;
  filterProject?: string;
  setFilterProject?: (v: string) => void;
  projects?: Project[];
  sortOrder: 'ASC' | 'DESC';
  setSortOrder: (v: 'ASC' | 'DESC') => void;
  showProject?: boolean;
}

const STATUS_OPTS: Opt[] = [
  { value: 'ALL', label: 'All' },
  { value: TaskStatus.TODO, label: 'To Do' },
  { value: TaskStatus.IN_PROGRESS, label: 'In Progress' },
  { value: TaskStatus.REVIEW, label: 'Review' },
  { value: TaskStatus.COMPLETED, label: 'Completed' },
  { value: TaskStatus.OVERDUE, label: 'Overdue' },
  { value: TaskStatus.POSTPONED, label: 'Postponed' },
  { value: TaskStatus.FAILED, label: 'Failed' },
];
const PRIORITY_OPTS: Opt[] = [
  { value: 'ALL', label: 'All' },
  { value: Priority.CRITICAL, label: 'Critical' },
  { value: Priority.HIGH, label: 'High' },
  { value: Priority.MEDIUM, label: 'Medium' },
  { value: Priority.LOW, label: 'Low' },
];
const DATE_OPTS: Opt[] = [
  { value: 'ALL', label: 'All Time' },
  { value: 'UPCOMING', label: 'Active / Upcoming' },
  { value: 'TODAY', label: 'Due Today' },
  { value: 'WEEK', label: 'Due This Week' },
  { value: 'MONTH', label: 'Due This Month' },
];

export const FilterBar: React.FC<FilterBarProps> = ({
  filterStatus, setFilterStatus, filterPriority, setFilterPriority, filterDate, setFilterDate,
  filterProject, setFilterProject, projects, sortOrder, setSortOrder, showProject,
}) => {
  const projectOpts: Opt[] = [
    { value: 'ALL', label: 'All' },
    { value: 'NONE', label: 'No Project' },
    ...(projects || []).map(p => ({ value: p.id, label: p.title })),
  ];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      <span className="flbl"><Filter className="w-[15px] h-[15px]" /> FILTERS</span>
      <ChipSelect label="Status" value={filterStatus} options={STATUS_OPTS} onChange={setFilterStatus} />
      <ChipSelect label="Priority" value={filterPriority} options={PRIORITY_OPTS} onChange={setFilterPriority} />
      <ChipSelect label="Due" value={filterDate} options={DATE_OPTS} onChange={setFilterDate} />
      {showProject && setFilterProject && (
        <ChipSelect label="Project" value={filterProject || 'ALL'} options={projectOpts} onChange={setFilterProject} />
      )}
      <button className="chip" style={{ marginLeft: 'auto' }} type="button"
        onClick={() => setSortOrder(sortOrder === 'ASC' ? 'DESC' : 'ASC')}>
        <ArrowUpDown className="w-[15px] h-[15px]" /> {sortOrder === 'ASC' ? 'Oldest first' : 'Newest first'}
      </button>
    </div>
  );
};
