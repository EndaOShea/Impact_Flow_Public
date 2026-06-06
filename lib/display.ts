/* Shared display helpers for the redesigned UI (status/priority → design classes). */
import { TaskStatus, Priority } from '../types';

/** Map a task status to the design's tag dot class. */
export function statusTagClass(status: TaskStatus | string): string {
  switch (status) {
    case TaskStatus.COMPLETED: return 't-done';
    case TaskStatus.IN_PROGRESS: return 't-plan';
    case TaskStatus.REVIEW: return 't-plan';
    case TaskStatus.OVERDUE: return 't-block';
    case TaskStatus.FAILED: return 't-block';
    case TaskStatus.POSTPONED: return 't-todo';
    case TaskStatus.TODO: return 't-todo';
    default: return 't-todo';
  }
}

/** Map a project status string to a tag dot class. */
export function projectStatusTagClass(status: string): string {
  switch (status) {
    case 'ACTIVE': return 't-track';
    case 'COMPLETED': return 't-done';
    case 'ON_HOLD': return 't-risk';
    case 'CANCELLED': return 't-block';
    case 'PLANNING': return 't-plan';
    default: return 't-plan';
  }
}

/** Map a priority to the design's pri class. */
export function priorityClass(priority: Priority | string): string {
  switch (priority) {
    case Priority.CRITICAL: return 'crit';
    case Priority.HIGH: return 'high';
    case Priority.MEDIUM: return 'med';
    case Priority.LOW: return 'low';
    default: return 'med';
  }
}

const STATUS_LABELS: Record<string, string> = {
  TODO: 'To Do',
  IN_PROGRESS: 'In Progress',
  REVIEW: 'Review',
  COMPLETED: 'Completed',
  OVERDUE: 'Overdue',
  POSTPONED: 'Postponed',
  FAILED: 'Failed',
};
export const statusLabel = (s: string): string => STATUS_LABELS[s] || s.replace(/_/g, ' ');

const PROJECT_STATUS_LABELS: Record<string, string> = {
  PLANNING: 'Planning',
  ACTIVE: 'Active',
  ON_HOLD: 'On Hold',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};
export const projectStatusLabel = (s: string): string => PROJECT_STATUS_LABELS[s] || s.replace(/_/g, ' ');

export const titleCase = (s: string): string =>
  s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

/** Currency symbol for an ImpactMetric currency code. */
export function currencySymbol(c?: string): string {
  switch (c) {
    case 'USD': return '$';
    case 'GBP': return '£';
    case 'EUR': return '€';
    default: return '';
  }
}

const PALETTE = ['#6366f1', '#0d9488', '#f59e0b', '#ef4444', '#8b5cf6', '#3b82f6', '#ec4899', '#14b8a6'];
/** Deterministic fallback color for a project without an explicit color. */
export function colorForId(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

/** Up-to-3-char code from a title (for project badges). */
export function codeFor(title: string): string {
  const words = (title || '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '–';
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  return words.slice(0, 3).map(w => w[0]).join('').toUpperCase();
}

/** Initials from a name. */
export function initials(name: string): string {
  const words = (name || '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

export const fmtDate = (d?: Date | string | null): string => {
  if (!d) return '—';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '—';
  return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};
