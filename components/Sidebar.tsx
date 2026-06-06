import React from 'react';
import {
  LayoutDashboard, Briefcase, CheckSquare, Calendar as CalendarIcon, GitGraph,
  BarChart2, Bell, Settings as SettingsIcon, Zap, LogOut,
} from 'lucide-react';
import { User, ViewState } from '../types';
import { initials } from '../lib/display';

interface SidebarProps {
  view: ViewState;
  go: (v: ViewState) => void;
  user: User;
  unreadCount: number;
  onLogout: () => void;
}

const NAV: [ViewState, React.ReactNode, string][] = [
  ['DASHBOARD', <LayoutDashboard className="w-[18px] h-[18px]" />, 'Dashboard'],
  ['PROJECTS', <Briefcase className="w-[18px] h-[18px]" />, 'Projects'],
  ['TASKS', <CheckSquare className="w-[18px] h-[18px]" />, 'Tasks'],
  ['CALENDAR', <CalendarIcon className="w-[18px] h-[18px]" />, 'Calendar'],
  ['TIMELINE', <GitGraph className="w-[18px] h-[18px]" />, 'Timeline'],
  ['REPORTS', <BarChart2 className="w-[18px] h-[18px]" />, 'Reports'],
];

export const Sidebar: React.FC<SidebarProps> = ({ view, go, user, unreadCount, onLogout }) => (
  <aside className="sb">
    <div className="sb-logo"><span className="mk"><Zap className="w-[18px] h-[18px]" /></span> Impact Flow</div>
    <nav className="sb-nav">
      {NAV.map(([v, icon, label]) => (
        <button key={v} className={'sb-item' + (view === v ? ' on' : '')} onClick={() => go(v)}>
          {icon}{label}
        </button>
      ))}
    </nav>
    <div className="sb-sec">WORKSPACE</div>
    <nav className="sb-nav">
      <button className={'sb-item' + (view === 'NOTIFICATIONS' ? ' on' : '')} onClick={() => go('NOTIFICATIONS')}>
        <Bell className="w-[18px] h-[18px]" />Notifications
        {unreadCount > 0 && <span className="badge">{unreadCount}</span>}
      </button>
      <button className={'sb-item' + (view === 'SETTINGS' ? ' on' : '')} onClick={() => go('SETTINGS')}>
        <SettingsIcon className="w-[18px] h-[18px]" />Settings
      </button>
    </nav>
    <div className="sb-foot">
      <button className="sb-user" onClick={() => go('SETTINGS')}>
        <div className="sb-ava">{user.avatarInitials || initials(user.name)}</div>
        <div><b>{user.name}</b><span>@{user.username}</span></div>
      </button>
      <button className="sb-signout" onClick={onLogout}><LogOut className="w-4 h-4" />Sign Out</button>
    </div>
  </aside>
);
