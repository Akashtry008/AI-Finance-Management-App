import React, { useState, useEffect } from 'react';
import api from '../api';
import { User, Lock, Save, Calendar, Check, AlertOctagon } from 'lucide-react';
import './Profile.css';

export default function Profile() {
  const [profile, setProfile] = useState({ username: '', email: '', display_name: '', theme: '', currency: 'INR', created_at: '' });
  const [passwords, setPasswords] = useState({ current_password: '', new_password: '', confirm_password: '' });
  
  const [profileMsg, setProfileMsg] = useState({ type: '', text: '' });
  const [passMsg, setPassMsg] = useState({ type: '', text: '' });
  
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPass, setSavingPass] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const res = await api.get('/profile');
      setProfile({
        ...res.data,
        display_name: res.data.display_name || '',
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
      localStorage.setItem('finance-os-currency', profile.currency);
      // Trigger a custom event so other components can re-render if they listen to it
      window.dispatchEvent(new Event('currencyChange'));
      setProfileMsg({ type: 'success', text: 'Profile updated successfully.' });
    } catch (err) {
      setProfileMsg({ type: 'error', text: err.response?.data?.detail || 'Failed to update profile.' });
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
      setPassMsg({ type: 'error', text: err.response?.data?.detail || 'Failed to change password.' });
    } finally {
      setSavingPass(false);
    }
  };

  if (loading) return <div className="page-loader"><div className="spinner"></div></div>;

  return (
    <div className="profile-page animate-fade-in">
      <div className="profile-header">
        <div className="profile-avatar">
          {profile.display_name ? profile.display_name.charAt(0).toUpperCase() : profile.username.charAt(0).toUpperCase()}
        </div>
        <div>
          <h2 style={{ margin: 0 }}>{profile.display_name || profile.username}</h2>
          <p className="text-muted" style={{ margin: 0 }}>Manage your account settings</p>
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
              <label>Preferred Currency</label>
              <select 
                value={profile.currency} 
                onChange={e => setProfile({...profile, currency: e.target.value})}
                style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.1)', background: 'rgba(0, 0, 0, 0.2)', color: 'var(--text-color)' }}
              >
                <option value="INR">₹ INR (Indian Rupee)</option>
                <option value="USD">$ USD (US Dollar)</option>
                <option value="EUR">€ EUR (Euro)</option>
                <option value="GBP">£ GBP (British Pound)</option>
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
      </div>
      
      <div className="profile-meta">
        <Calendar size={14} style={{ display: 'inline', verticalAlign: 'text-bottom', marginRight: '4px' }} />
        Account created on {new Date(profile.created_at).toLocaleDateString()}
      </div>
    </div>
  );
}
