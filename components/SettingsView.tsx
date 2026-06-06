import React, { useState } from 'react';
import { Sun, Moon, Lock, Eye, EyeOff, AlertTriangle, Trash2, Check, X } from 'lucide-react';
import { User } from '../types';
import { api } from '../services/api';
import { initials } from '../lib/display';

interface SettingsViewProps {
  user: User;
  theme: 'light' | 'dark';
  onSetTheme: (t: 'light' | 'dark') => void;
  onAccountDeleted: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ user, theme, onSetTheme, onAccountDeleted }) => {
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [pwError, setPwError] = useState('');
  const [pwOk, setPwOk] = useState(false);

  const [delOpen, setDelOpen] = useState(false);
  const [delPw, setDelPw] = useState('');
  const [delError, setDelError] = useState('');

  const changePassword = async () => {
    setPwError(''); setPwOk(false);
    if (!cur || !next || !confirm) { setPwError('All fields are required'); return; }
    if (next.length < 8) { setPwError('New password must be at least 8 characters'); return; }
    if (next !== confirm) { setPwError('New passwords do not match'); return; }
    try {
      await api.changePassword(cur, next);
      setPwOk(true); setCur(''); setNext(''); setConfirm('');
      setTimeout(() => setPwOk(false), 3000);
    } catch (e: any) {
      setPwError(e.message || 'Failed to change password');
    }
  };

  const deleteAccount = async () => {
    if (!delPw) { setDelError('Password is required'); return; }
    try {
      setDelError('');
      await api.deleteAccount(delPw);
      onAccountDeleted();
    } catch (e: any) {
      setDelError(e.message || 'Failed to delete account');
    }
  };

  return (
    <div className="body view-enter" style={{ maxWidth: 760 }}>
      <div className="panel">
        <h3 style={{ fontSize: 16, fontWeight: 800, margin: '0 0 16px' }}>Profile</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span className="ava" style={{ width: 60, height: 60, borderRadius: 16, fontSize: 20, color: '#fff', background: 'linear-gradient(135deg,var(--accent),#8b5cf6)', border: 'none' }}>{user.avatarInitials || initials(user.name)}</span>
          <div style={{ flex: 1 }}><div style={{ fontSize: 18, fontWeight: 800 }}>{user.name}</div><div style={{ fontSize: 13.5, color: 'var(--muted)', fontWeight: 600 }}>@{user.username}</div></div>
        </div>
      </div>

      <div className="panel">
        <h3 style={{ fontSize: 16, fontWeight: 800, margin: '0 0 4px' }}>Appearance</h3>
        <p style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 500, margin: '0 0 16px' }}>Customize how Impact Flow looks for you.</p>
        <div style={{ display: 'flex', gap: 12 }}>
          {([['light', <Sun className="w-[18px] h-[18px]" />, 'Light'], ['dark', <Moon className="w-[18px] h-[18px]" />, 'Dark']] as const).map(([t, ic, l]) => (
            <button key={t} onClick={() => onSetTheme(t)} style={{
              flex: 1, padding: 16, borderRadius: 'var(--radius)',
              border: `2px solid ${theme === t ? 'var(--accent)' : 'var(--line)'}`,
              background: theme === t ? 'var(--accent-softer)' : 'var(--panel)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 10, fontWeight: 700, fontSize: 14,
              color: theme === t ? 'var(--accent)' : 'var(--ink2)',
            }}>{ic} {l}</button>
          ))}
        </div>
      </div>

      <div className="panel">
        <h3 style={{ fontSize: 16, fontWeight: 800, margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 9 }}><Lock className="w-[18px] h-[18px]" /> Change Password</h3>
        {pwOk && <div style={{ background: 'var(--green-bg)', color: 'var(--green-ink)', padding: '11px 14px', borderRadius: 10, marginBottom: 14, fontWeight: 700, fontSize: 13.5, display: 'flex', alignItems: 'center', gap: 8 }}><Check className="w-4 h-4" /> Password updated successfully</div>}
        {pwError && <div style={{ background: 'var(--red-bg)', color: 'var(--red-ink)', padding: '11px 14px', borderRadius: 10, marginBottom: 14, fontWeight: 700, fontSize: 13.5 }}>{pwError}</div>}
        {[['Current password', cur, setCur], ['New password (min 8 characters)', next, setNext], ['Confirm new password', confirm, setConfirm]].map(([label, val, set]: any, i) => (
          <div className="field" key={i}>
            <label>{label.split(' (')[0]}</label>
            <div style={{ position: 'relative' }}>
              <input className="input" type={show ? 'text' : 'password'} value={val}
                onChange={e => set(e.target.value)} placeholder={'Enter ' + label.toLowerCase()} style={{ paddingRight: 44 }}
                onKeyDown={e => { if (e.key === 'Enter') changePassword(); }} />
              <button className="btn-ghost" type="button" onClick={() => setShow(s => !s)} style={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)', padding: 8 }}>
                {show ? <EyeOff className="w-[17px] h-[17px]" /> : <Eye className="w-[17px] h-[17px]" />}
              </button>
            </div>
          </div>
        ))}
        <button className="btn" style={{ width: '100%', justifyContent: 'center', marginTop: 4 }} onClick={changePassword}>Update Password</button>
      </div>

      <div className="panel" style={{ border: '1px solid color-mix(in srgb,var(--red) 35%,var(--line))' }}>
        <h3 style={{ fontSize: 16, fontWeight: 800, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 9, color: 'var(--red)' }}><AlertTriangle className="w-[18px] h-[18px]" /> Danger Zone</h3>
        <p style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 500, margin: '0 0 16px' }}>Irreversible actions that will permanently affect your account.</p>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
          <div><div style={{ fontWeight: 800, fontSize: 14 }}>Delete account</div><div style={{ fontSize: 12.5, color: 'var(--muted)', fontWeight: 600 }}>Permanently delete your account and all associated data.</div></div>
          <button className="btn" style={{ background: 'var(--red)', boxShadow: 'none', flex: '0 0 auto' }} onClick={() => setDelOpen(true)}><Trash2 className="w-4 h-4" /> Delete Account</button>
        </div>
      </div>

      {delOpen && (
        <div className="overlay" onMouseDown={e => { if (e.target === e.currentTarget) { setDelOpen(false); setDelPw(''); setDelError(''); } }}>
          <div className="modal" style={{ maxWidth: 460 }}>
            <div className="modal-h" style={{ paddingBottom: 16 }}>
              <span className="ndotmk" style={{ background: 'var(--red-bg)', color: 'var(--red-ink)' }}><AlertTriangle className="w-[18px] h-[18px]" /></span>
              <div className="modal-title" style={{ fontSize: 18 }}>Delete Account</div>
              <button className="icon-btn" onClick={() => { setDelOpen(false); setDelPw(''); setDelError(''); }}><X className="w-[18px] h-[18px]" /></button>
            </div>
            <div className="modal-body" style={{ background: 'var(--panel)' }}>
              <p style={{ fontSize: 13.5, color: 'var(--muted)', fontWeight: 500, marginTop: 0 }}>This cannot be undone. All tasks, projects, comments, attachments and analytics will be permanently deleted.</p>
              <div className="field" style={{ marginBottom: 0 }}>
                <label>Enter your password to confirm</label>
                <input className="input" type="password" value={delPw} autoFocus
                  onChange={e => setDelPw(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') deleteAccount(); }} placeholder="Your password" />
                {delError && <p style={{ fontSize: 13, color: 'var(--red-ink)', fontWeight: 700, marginTop: 8 }}>{delError}</p>}
              </div>
            </div>
            <div className="modal-foot">
              <button className="btn-g btn" onClick={() => { setDelOpen(false); setDelPw(''); setDelError(''); }}>Cancel</button>
              <button className="btn" style={{ background: 'var(--red)', boxShadow: 'none' }} onClick={deleteAccount}><Trash2 className="w-4 h-4" /> Delete My Account</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
