import React, { useState, useEffect } from 'react';
import api from '../api';
import {
  User, Lock, Save, Calendar, Check, AlertOctagon, Sparkles,
  CheckCircle2, ShieldCheck, Shield, KeyRound, Grid3X3,
  Download, Upload, FileArchive, Database, Camera, Trash2
} from 'lucide-react';
import { SUPPORTED_CURRENCIES, setPlatformCurrency, formatErrorMessage } from '../utils';
import { downloadFinanceOsZipArchive } from '../utils/zipExport';
import { useDialog } from '../context/DialogContext';
import SecurityLockModal from '../components/SecurityLockModal';
import './Profile.css';

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
];

export default function Profile() {
  const { showConfirm, showAlert } = useDialog();
  const [profile, setProfile] = useState({ username: '', email: '', display_name: '', theme: '', currency: 'INR', created_at: '' });
  const [passwords, setPasswords] = useState({ current_password: '', new_password: '', confirm_password: '' });
  
  const [profileMsg, setProfileMsg] = useState({ type: '', text: '' });
  const [passMsg, setPassMsg] = useState({ type: '', text: '' });
  
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPass, setSavingPass] = useState(false);

  const [securityModalOpen, setSecurityModalOpen] = useState(false);
  const [isSetupLock, setIsSetupLock] = useState(false);
  const [secEnabled, setSecEnabled] = useState(
    () => localStorage.getItem('finance-os-security-enabled') !== 'false'
  );
  const [secMode, setSecMode] = useState(
    () => localStorage.getItem('finance-os-security-mode') || 'pin'
  );

  const [backupMonth, setBackupMonth] = useState('all');
  const [backupYear, setBackupYear] = useState('all');
  const [exportingBackup, setExportingBackup] = useState(false);
  const [exportingZip, setExportingZip] = useState(false);
  const [restoringData, setRestoringData] = useState(false);
  const [restoreStatus, setRestoreStatus] = useState({ type: '', text: '' });

  const avatarInputRef = React.useRef(null);
  const [avatarUrl, setAvatarUrl] = useState(() => {
    return localStorage.getItem('finance-os-avatar') || '';
  });

  useEffect(() => {
    if (profile.username) {
      const saved = localStorage.getItem(`finance-os-avatar-${profile.username}`) || localStorage.getItem('finance-os-avatar') || '';
      setAvatarUrl(saved);
    }
  }, [profile.username]);

  const handleAvatarUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setProfileMsg({ type: 'error', text: 'Please select a valid image file (PNG, JPG, WebP).' });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setProfileMsg({ type: 'error', text: 'Image exceeds 5MB limit. Please choose a smaller photo.' });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const size = 256;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        const minDim = Math.min(img.width, img.height);
        const sx = (img.width - minDim) / 2;
        const sy = (img.height - minDim) / 2;
        ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size);
        const optimizedDataUrl = canvas.toDataURL('image/jpeg', 0.85);

        const storageKey = profile.username ? `finance-os-avatar-${profile.username}` : 'finance-os-avatar';
        localStorage.setItem(storageKey, optimizedDataUrl);
        localStorage.setItem('finance-os-avatar', optimizedDataUrl);
        setAvatarUrl(optimizedDataUrl);
        setProfileMsg({ type: 'success', text: 'Profile picture updated successfully!' });
        window.dispatchEvent(new CustomEvent('avatarChange', { detail: { avatar: optimizedDataUrl, username: profile.username } }));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleRemoveAvatar = () => {
    const storageKey = profile.username ? `finance-os-avatar-${profile.username}` : 'finance-os-avatar';
    localStorage.removeItem(storageKey);
    localStorage.removeItem('finance-os-avatar');
    setAvatarUrl('');
    setProfileMsg({ type: 'success', text: 'Profile picture removed.' });
    window.dispatchEvent(new CustomEvent('avatarChange', { detail: { avatar: '', username: profile.username } }));
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  async function fetchProfile() {
    try {
      const res = await api.get('/profile');
      setProfile({
        ...res.data,
        currency: res.data.currency || 'INR'
      });
      localStorage.setItem('finance-os-currency', res.data.currency || 'INR');
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileMsg({ type: '', text: '' });
    
    try {
      await api.put('/profile', {
        display_name: profile.display_name,
        email: profile.email,
        currency: profile.currency
      });
      setPlatformCurrency(profile.currency);
      setProfileMsg({ type: 'success', text: 'Profile updated successfully!' });
    } catch (err) {
      setProfileMsg({ type: 'error', text: formatErrorMessage(err, 'Failed to update profile.') });
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (passwords.new_password !== passwords.confirm_password) {
      setPassMsg({ type: 'error', text: 'New passwords do not match.' });
      return;
    }
    if (passwords.new_password.length < 6) {
      setPassMsg({ type: 'error', text: 'Password must be at least 6 characters.' });
      return;
    }
    
    setSavingPass(true);
    setPassMsg({ type: '', text: '' });
    
    try {
      await api.put('/profile/password', {
        current_password: passwords.current_password,
        new_password: passwords.new_password
      });
      setPassMsg({ type: 'success', text: 'Password changed successfully.' });
      setPasswords({ current_password: '', new_password: '', confirm_password: '' });
    } catch (err) {
      setPassMsg({ type: 'error', text: formatErrorMessage(err, 'Failed to change password.') });
    } finally {
      setSavingPass(false);
    }
  };

  const handleDownloadJsonBackup = async () => {
    setExportingBackup(true);
    setRestoreStatus({ type: '', text: '' });
    try {
      let url = '/profile/backup';
      const params = [];
      if (backupMonth !== 'all') params.push(`month=${backupMonth}`);
      if (backupYear !== 'all') params.push(`year=${backupYear}`);
      if (params.length > 0) url += `?${params.join('&')}`;

      const res = await api.get(url);
      const dataStr = JSON.stringify(res.data, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const filename = `FinanceOS_Backup_${backupYear !== 'all' ? backupYear : 'AllYears'}_${backupMonth !== 'all' ? String(backupMonth).padStart(2, '0') : 'AllMonths'}.json`;

      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);

      setRestoreStatus({
        type: 'success',
        text: `JSON Backup successfully downloaded (${res.data.transactions?.length || 0} transactions, ${res.data.budgets?.length || 0} budgets, ${res.data.goals?.length || 0} goals).`
      });
    } catch (err) {
      setRestoreStatus({ type: 'error', text: formatErrorMessage(err, 'Failed to download JSON backup.') });
    } finally {
      setExportingBackup(false);
    }
  };

  const handleDownloadZipArchive = async () => {
    setExportingZip(true);
    setRestoreStatus({ type: '', text: '' });
    try {
      let url = '/profile/backup';
      const params = [];
      if (backupMonth !== 'all') params.push(`month=${backupMonth}`);
      if (backupYear !== 'all') params.push(`year=${backupYear}`);
      if (params.length > 0) url += `?${params.join('&')}`;

      const res = await api.get(url);
      const backupData = res.data;

      const periodLabel = backupMonth !== 'all' && backupYear !== 'all'
        ? `${MONTHS[Number(backupMonth) - 1]} ${backupYear}`
        : (backupYear !== 'all' ? `Year ${backupYear}` : 'Full Account History');

      const zipFileName = `FinanceOS_Archive_${backupYear !== 'all' ? backupYear : 'All'}_${backupMonth !== 'all' ? backupMonth : 'All'}.zip`;

      await downloadFinanceOsZipArchive({
        zipFileName,
        periodLabel,
        backupData,
        activeCurr: profile.currency || 'INR'
      });

      setRestoreStatus({ type: 'success', text: 'ZIP Archive generated! Contains PDF statement, Excel ledger, and JSON data backup.' });
    } catch (err) {
      setRestoreStatus({ type: 'error', text: formatErrorMessage(err, 'Failed to generate ZIP archive.') });
    } finally {
      setExportingZip(false);
    }
  };

  const handleRestoreJsonFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch (pe) {
        showAlert({
          title: 'Invalid JSON File',
          message: 'The selected file is not a valid JSON document.',
          type: 'danger'
        });
        return;
      }

      const txnCount = parsed.transactions?.length || 0;
      const budgetCount = parsed.budgets?.length || 0;
      const goalCount = parsed.goals?.length || 0;

      const confirmed = await showConfirm({
        title: 'Restore Account Data',
        message: `This backup contains ${txnCount} transactions, ${budgetCount} budgets, and ${goalCount} savings goals. Existing duplicate IDs will be safely merged. Do you want to proceed?`,
        confirmText: 'Yes, Restore Now',
        cancelText: 'Cancel'
      });
      if (!confirmed) return;

      setRestoringData(true);
      setRestoreStatus({ type: '', text: '' });
      const res = await api.post('/profile/restore', { data: parsed });

      setRestoreStatus({
        type: 'success',
        text: `Data Restored: ${res.data.restored?.transactions || 0} transactions, ${res.data.restored?.budgets || 0} budgets, ${res.data.restored?.goals || 0} goals restored!`
      });
    } catch (err) {
      setRestoreStatus({
        type: 'error',
        text: formatErrorMessage(err, 'Failed to restore account data.')
      });
    } finally {
      setRestoringData(false);
      e.target.value = '';
    }
  };

  if (loading) return <div className="page-loader"><div className="spinner"></div></div>;

  return (
    <div className="profile-page animate-fade-in">
      <div className="profile-header">
        <div className="profile-avatar-container">
          <div
            className="profile-avatar"
            onClick={() => avatarInputRef.current?.click()}
            title="Click to change profile photo"
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" className="profile-avatar-img" />
            ) : (
              <span>{profile.display_name ? profile.display_name.charAt(0).toUpperCase() : profile.username.charAt(0).toUpperCase()}</span>
            )}
            <div className="profile-avatar-overlay">
              <Camera size={20} />
            </div>
          </div>
          <input
            type="file"
            ref={avatarInputRef}
            onChange={handleAvatarUpload}
            accept="image/*"
            style={{ display: 'none' }}
          />
        </div>
        <div className="profile-header-info">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flexWrap: 'wrap' }}>
            <h2 style={{ margin: 0 }}>{profile.display_name || profile.username}</h2>
            <div className="profile-avatar-actions">
              <button
                type="button"
                className="btn btn-secondary profile-avatar-btn"
                onClick={() => avatarInputRef.current?.click()}
                title="Upload custom profile photo"
              >
                <Camera size={13} />
                <span>Change Photo</span>
              </button>
              {avatarUrl && (
                <button
                  type="button"
                  className="btn btn-secondary profile-avatar-btn profile-avatar-btn--remove"
                  onClick={handleRemoveAvatar}
                  title="Remove custom photo"
                >
                  <Trash2 size={13} />
                  <span>Remove</span>
                </button>
              )}
            </div>
          </div>
          <p className="text-muted" style={{ margin: '0.25rem 0 0' }}>Manage your account settings & security</p>
        </div>
      </div>

      <div className="profile-content">
        <div className="profile-section glass-panel">
          <h3><User size={20} /> Personal Information</h3>
          <form onSubmit={handleProfileSubmit} className="profile-form">
            <div className="profile-form-group">
              <label>Username (Cannot be changed)</label>
              <input type="text" value={profile.username} disabled />
            </div>
            <div className="profile-form-group">
              <label>Display Name</label>
              <input 
                type="text" 
                value={profile.display_name} 
                onChange={e => setProfile({...profile, display_name: e.target.value})} 
                placeholder="e.g. John Doe"
              />
            </div>
            <div className="profile-form-group">
              <label>Email Address</label>
              <input 
                type="email" 
                value={profile.email} 
                onChange={e => setProfile({...profile, email: e.target.value})} 
                required 
              />
            </div>
            <div className="profile-form-group">
              <label>Preferred Currency (Global Platform)</label>
              <select 
                value={profile.currency} 
                onChange={e => setProfile({...profile, currency: e.target.value})}
                style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.1)', background: 'rgba(0, 0, 0, 0.2)', color: 'var(--text-color)' }}
              >
                {SUPPORTED_CURRENCIES.map(c => (
                  <option key={c.code} value={c.code}>
                    {c.flag} {c.code} — {c.name} ({c.symbol})
                  </option>
                ))}
              </select>
            </div>
            
            <button type="submit" className="btn btn-primary" disabled={savingProfile} style={{ marginTop: '0.5rem' }}>
              {savingProfile ? 'Saving...' : <><Save size={16} /> Save Changes</>}
            </button>
            
            {profileMsg.text && (
              <div className={`profile-message ${profileMsg.type}`}>
                {profileMsg.type === 'success' ? <Check size={16}/> : <AlertOctagon size={16}/>} 
                {profileMsg.text}
              </div>
            )}
          </form>
        </div>

        <div className="profile-section glass-panel">
          <h3><Lock size={20} /> Change Password</h3>
          <form onSubmit={handlePasswordSubmit} className="profile-form">
            <div className="profile-form-group">
              <label>Current Password</label>
              <input 
                type="password" 
                value={passwords.current_password} 
                onChange={e => setPasswords({...passwords, current_password: e.target.value})} 
                required 
              />
            </div>
            <div className="profile-form-group">
              <label>New Password</label>
              <input 
                type="password" 
                value={passwords.new_password} 
                onChange={e => setPasswords({...passwords, new_password: e.target.value})} 
                required 
              />
            </div>
            <div className="profile-form-group">
              <label>Confirm New Password</label>
              <input 
                type="password" 
                value={passwords.confirm_password} 
                onChange={e => setPasswords({...passwords, confirm_password: e.target.value})} 
                required 
              />
            </div>
            
            <button type="submit" className="btn btn-secondary" disabled={savingPass} style={{ marginTop: '0.5rem' }}>
              {savingPass ? 'Updating...' : <><Lock size={16} /> Update Password</>}
            </button>
            
            {passMsg.text && (
              <div className={`profile-message ${passMsg.type}`}>
                {passMsg.type === 'success' ? <Check size={16}/> : <AlertOctagon size={16}/>} 
                {passMsg.text}
              </div>
            )}
          </form>
        </div>

        {/* App Security & Privacy Lock Card */}
        <div className="profile-section glass-panel" style={{ gridColumn: '1 / -1' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Shield size={20} color="#6366f1" /> Security & App Lock Screen
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 600, color: secEnabled ? '#10b981' : 'var(--text-muted)' }}>
                {secEnabled ? 'Lock Enabled' : 'Lock Disabled'}
              </span>
              <label className="switch-toggle" style={{ margin: 0 }}>
                <input
                  type="checkbox"
                  checked={secEnabled}
                  onChange={e => {
                    const next = e.target.checked;
                    setSecEnabled(next);
                    localStorage.setItem('finance-os-security-enabled', String(next));
                    window.dispatchEvent(new CustomEvent('securitySettingsChange', { detail: { enabled: next } }));
                  }}
                />
                <span className="switch-slider" />
              </label>
            </div>
          </div>
          <p className="text-muted" style={{ fontSize: '0.86rem', margin: '0 0 1rem 0' }}>
            Configure your privacy lock to protect your financial records, budgets, and transactions from unauthorized viewing.
          </p>

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              {['pin', 'password', 'pattern'].map(mode => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => {
                    setSecMode(mode);
                    localStorage.setItem('finance-os-security-mode', mode);
                    window.dispatchEvent(new CustomEvent('securitySettingsChange', { detail: { mode, enabled: secEnabled } }));
                  }}
                  style={{
                    padding: '0.45rem 0.85rem',
                    borderRadius: '8px',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    border: '1px solid var(--glass-border)',
                    background: secMode === mode ? '#6366f1' : 'var(--bg-primary)',
                    color: secMode === mode ? '#ffffff' : 'var(--text-primary)',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem'
                  }}
                >
                  {mode === 'pin' && <KeyRound size={13} />}
                  {mode === 'password' && <Lock size={13} />}
                  {mode === 'pattern' && <Grid3X3 size={13} />}
                  {mode.toUpperCase()}
                </button>
              ))}
            </div>

            <button
              type="button"
              className="btn btn-secondary"
              style={{ fontSize: '0.82rem', padding: '0.45rem 0.85rem' }}
              onClick={() => {
                setIsSetupLock(true);
                setSecurityModalOpen(true);
              }}
            >
              Configure Credentials (PIN / Password / Pattern)
            </button>

            <button
              type="button"
              className="btn btn-primary"
              style={{ fontSize: '0.82rem', padding: '0.45rem 0.85rem' }}
              onClick={() => {
                setIsSetupLock(false);
                setSecurityModalOpen(true);
              }}
            >
              <Lock size={13} /> Lock App Now
            </button>
          </div>
        </div>

        <SecurityLockModal
          isOpen={securityModalOpen}
          isSetupMode={isSetupLock}
          allowClose={isSetupLock}
          onClose={() => setSecurityModalOpen(false)}
          onUnlock={() => setSecurityModalOpen(false)}
        />

        {/* Dedicated Data Backup, Archival & Restore Section */}
        <div className="profile-section glass-panel" style={{ gridColumn: '1 / -1' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Database size={20} color="var(--accent-color)" /> Data Backup & Archival Portability
            </h3>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              100% Client & Server Data Portability
            </span>
          </div>
          <p className="text-muted" style={{ fontSize: '0.86rem', margin: '0 0 1.25rem 0' }}>
            Export your virtual transactions, category budgets, and savings goals into standardized JSON or package them into a comprehensive ZIP archive containing a printable PDF Statement, formatted Excel Ledger (.xls), and raw JSON.
          </p>

          <div className="backup-controls-grid" style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '1.25rem',
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            borderRadius: '12px',
            padding: '1.25rem',
            marginBottom: '1rem'
          }}>
            {/* Left: Scope Selection */}
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-color)' }}>
                Select Export Period Scope
              </label>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <select
                  value={backupMonth}
                  onChange={e => setBackupMonth(e.target.value)}
                  style={{ flex: 1, minWidth: '120px', padding: '0.5rem', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.1)', background: 'rgba(0, 0, 0, 0.2)', color: 'var(--text-color)' }}
                >
                  <option value="all">All Months</option>
                  {MONTHS.map((m, i) => (
                    <option key={i} value={i + 1}>{m}</option>
                  ))}
                </select>

                <select
                  value={backupYear}
                  onChange={e => setBackupYear(e.target.value)}
                  style={{ flex: 1, minWidth: '100px', padding: '0.5rem', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.1)', background: 'rgba(0, 0, 0, 0.2)', color: 'var(--text-color)' }}
                >
                  <option value="all">All Years</option>
                  {[2023, 2024, 2025, 2026].map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
              <small className="text-muted" style={{ display: 'block', marginTop: '0.4rem', fontSize: '0.76rem' }}>
                Scope: {backupMonth === 'all' && backupYear === 'all' ? 'Entire Account Lifetime' : `${backupMonth !== 'all' ? MONTHS[Number(backupMonth)-1] : 'All Months'} ${backupYear !== 'all' ? backupYear : 'All Years'}`}
              </small>
            </div>

            {/* Right: Export Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', justifyContent: 'center' }}>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={exportingBackup}
                  onClick={handleDownloadJsonBackup}
                  style={{ flex: 1, minWidth: '150px', fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
                >
                  <Download size={14} />
                  {exportingBackup ? 'Exporting JSON...' : '1-Click JSON Backup'}
                </button>

                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={exportingZip}
                  onClick={handleDownloadZipArchive}
                  style={{ flex: 1, minWidth: '170px', fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
                >
                  <FileArchive size={14} />
                  {exportingZip ? 'Bundling ZIP...' : 'Download ZIP Archive (PDF + Excel + JSON)'}
                </button>
              </div>

              {/* Restore Section */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                <label className="btn btn-secondary" style={{
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.4rem 0.8rem',
                  margin: 0
                }}>
                  <Upload size={13} />
                  {restoringData ? 'Restoring...' : 'Restore from JSON Backup'}
                  <input
                    type="file"
                    accept=".json,application/json"
                    onChange={handleRestoreJsonFile}
                    disabled={restoringData}
                    style={{ display: 'none' }}
                  />
                </label>
                <span className="text-muted" style={{ fontSize: '0.75rem' }}>
                  Upload a previously exported .json file
                </span>
              </div>
            </div>
          </div>

          {restoreStatus.text && (
            <div className={`profile-message ${restoreStatus.type}`} style={{ margin: '0.5rem 0 0' }}>
              {restoreStatus.type === 'success' ? <Check size={16}/> : <AlertOctagon size={16}/>}
              {restoreStatus.text}
            </div>
          )}
        </div>

        {/* 100% Free Unlimited Tier Status Card */}
        <div className="profile-section glass-panel" style={{ gridColumn: '1 / -1' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Sparkles size={20} color="#818cf8" /> Platform Access Tier
            </h3>
            <span style={{ 
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(99, 102, 241, 0.2))',
              border: '1px solid rgba(16, 185, 129, 0.4)',
              color: '#34d399',
              padding: '0.35rem 0.85rem',
              borderRadius: '20px',
              fontSize: '0.8rem',
              fontWeight: 700
            }}>
              ✓ 100% Free Unlimited Tier Active
            </span>
          </div>
          <p className="text-muted" style={{ fontSize: '0.88rem', margin: '0 0 1rem 0' }}>
            Enjoy unrestricted, lifetime free access to all advanced FinanceOS features. No subscription required, zero paywalls, and no hidden limitations.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.84rem', color: 'var(--text-color)' }}>
              <CheckCircle2 size={16} color="#34d399" />
              <span>Unlimited Split Groups & Trips</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.84rem', color: 'var(--text-color)' }}>
              <CheckCircle2 size={16} color="#34d399" />
              <span>1-Click WhatsApp Settlement Share</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.84rem', color: 'var(--text-color)' }}>
              <CheckCircle2 size={16} color="#34d399" />
              <span>AI Live Streaming Financial Advisor</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.84rem', color: 'var(--text-color)' }}>
              <CheckCircle2 size={16} color="#34d399" />
              <span>Instant AI Receipt OCR Scanner</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.84rem', color: 'var(--text-color)' }}>
              <CheckCircle2 size={16} color="#34d399" />
              <span>Structured PDF & Excel Table Exports</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.84rem', color: 'var(--text-color)' }}>
              <CheckCircle2 size={16} color="#34d399" />
              <span>Instant Digital Receipt Vouchers</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.84rem', color: 'var(--text-color)' }}>
              <CheckCircle2 size={16} color="#34d399" />
              <span>20+ Global Currencies & Converter</span>
            </div>
          </div>
        </div>
      </div>
      
      <div className="profile-meta">
        <Calendar size={14} style={{ display: 'inline', verticalAlign: 'text-bottom', marginRight: '4px' }} />
        Account created on {new Date(profile.created_at).toLocaleDateString()}
      </div>
    </div>
  );
}
