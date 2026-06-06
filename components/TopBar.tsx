import React from 'react';
import { Sun, Moon, Bell, Menu } from 'lucide-react';

interface TopBarProps {
  title: string;
  subtitle: string;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onBell: () => void;
  onMenu: () => void;
  hasUnread?: boolean;
  primary?: React.ReactNode;
}

export const TopBar: React.FC<TopBarProps> = ({
  title, subtitle, theme, onToggleTheme, onBell, onMenu, hasUnread, primary,
}) => (
  <header className="top">
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
      <button className="icon-btn lg:hidden" onClick={onMenu} title="Menu"><Menu className="w-5 h-5" /></button>
      <div style={{ minWidth: 0 }}>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
    </div>
    <div className="top-r">
      <button className="icon-btn" onClick={onToggleTheme} title="Toggle theme">
        {theme === 'dark' ? <Sun className="w-[18px] h-[18px]" /> : <Moon className="w-[18px] h-[18px]" />}
      </button>
      <button className="icon-btn" onClick={onBell} title="Notifications">
        <Bell className="w-[18px] h-[18px]" />{hasUnread && <span className="ndot" />}
      </button>
      {primary}
    </div>
  </header>
);
