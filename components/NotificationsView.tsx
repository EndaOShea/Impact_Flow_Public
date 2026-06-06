import React, { useState } from 'react';
import { Flag, Clock, Bell, Check } from 'lucide-react';
import { Task, TaskStatus } from '../types';
import { fmtDate } from '../lib/display';

interface NotificationsViewProps {
  notifications: Task[];
  mutedTaskIds: string[];
  onView: (t: Task) => void;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
}

export const NotificationsView: React.FC<NotificationsViewProps> = ({
  notifications, mutedTaskIds, onView, onMarkRead, onMarkAllRead,
}) => {
  const [tab, setTab] = useState<'All' | 'Unread'>('All');
  const unreadCount = notifications.filter(n => !mutedTaskIds.includes(n.id)).length;
  const shown = tab === 'Unread' ? notifications.filter(n => !mutedTaskIds.includes(n.id)) : notifications;

  return (
    <div className="body view-enter" style={{ maxWidth: 720 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div className="seg">
          {(['All', 'Unread'] as const).map(t => (
            <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>
              {t}{t === 'Unread' ? ` · ${unreadCount}` : ''}
            </button>
          ))}
        </div>
        <button className="btn-g btn" onClick={onMarkAllRead}><Check className="w-4 h-4" /> Mark all read</button>
      </div>
      <div className="panel flush">
        {shown.map(t => {
          const overdue = t.status === TaskStatus.OVERDUE || (t.dueDate && new Date(t.dueDate) < new Date());
          const unread = !mutedTaskIds.includes(t.id);
          const color = overdue ? 'var(--red)' : 'var(--amber)';
          return (
            <div key={t.id} className={'nrow' + (unread ? ' unread' : '')}
              onClick={() => { onMarkRead(t.id); onView(t); }}>
              <span className="ndotmk" style={{ background: `color-mix(in srgb, ${color} 14%, transparent)`, color }}>
                {overdue ? <Flag className="w-[18px] h-[18px]" /> : <Clock className="w-[18px] h-[18px]" />}
              </span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13.5, lineHeight: 1.45 }}>
                  <span style={{ color: 'var(--ink2)', fontWeight: 600 }}>{overdue ? 'Overdue since' : 'Due'} {fmtDate(t.dueDate)} ·</span>{' '}
                  <b style={{ color: 'var(--ink)' }}>{t.title}</b>
                </div>
                <div style={{ fontSize: 12, color: 'var(--faint)', fontWeight: 600, marginTop: 3 }}>
                  {overdue ? 'Overdue' : 'Due soon'}
                </div>
              </div>
              {unread && <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', flex: '0 0 auto', marginTop: 6 }} />}
            </div>
          );
        })}
        {shown.length === 0 && (
          <div className="empty"><span className="ic"><Bell className="w-7 h-7" /></span><h4>You're all caught up</h4><p>No {tab === 'Unread' ? 'unread ' : ''}reminders right now.</p></div>
        )}
      </div>
    </div>
  );
};
