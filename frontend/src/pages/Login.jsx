import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import { LogIn, User, Lock, TrendingUp, Mail, Sparkles } from 'lucide-react';
import FloatingNodes from '../components/FloatingNodes';
import LanguageSwitcher from '../components/LanguageSwitcher';
import { useTranslation } from '../i18n';
import './Auth.css';

export default function Login() {
  const { t } = useTranslation();
  const [form, setForm] = useState({ username: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [isForgotMode, setIsForgotMode] = useState(false);
  const [devResetLink, setDevResetLink] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('username', form.username);
      params.append('password', form.password);
      const res = await api.post('/token', params);
      login(res.data.access_token, res.data.username, res.data.is_admin);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.detail || 'Login failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setDevResetLink('');
    setLoading(true);
    try {
      const res = await api.post('/forgot-password', { email: form.email });
      setSuccess(res.data.msg);
      if (res.data.dev_reset_link) {
        setDevResetLink(res.data.dev_reset_link);
      }
    } catch (err) {
      setError('Failed to send reset link. Please verify the email address.');
    } finally {
      setLoading(false);
    }
  };



  if (isForgotMode) {
    return (
      <div className="auth-page">
        <div style={{ position: 'fixed', top: '1.25rem', right: '1.25rem', zIndex: 100 }}>
          <LanguageSwitcher compact />
        </div>
        <FloatingNodes count={30} />
        <div className="auth-card glass-panel animate-fade-in" style={{ zIndex: 1 }}>
          <div className="auth-logo">
            <TrendingUp size={32} color="#6366f1" />
            <h1>FinanceOS</h1>
          </div>
          <h2>{t('resetPassword', 'Reset Password')}</h2>
          <p className="text-muted">{t('sendResetLinkSubtitle', 'Enter your email to receive a secure reset link.')}</p>

          {error && <div className="auth-error">{error}</div>}
          {success && (
            <div className="auth-success" style={{ color: 'var(--success-color)', background: 'rgba(16, 185, 129, 0.1)', padding: '0.85rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.85rem' }}>
              <div>{success}</div>
              {devResetLink && (
                <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px dashed rgba(16, 185, 129, 0.3)' }}>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
                    Local Testing / SMTP Fallback:
                  </div>
                  <a
                    href={devResetLink}
                    className="btn btn-secondary"
                    style={{ display: 'inline-block', fontSize: '0.8rem', padding: '0.4rem 0.8rem', textDecoration: 'none' }}
                  >
                    Click Here to Reset Password Directly
                  </a>
                </div>
              )}
            </div>
          )}

          <form onSubmit={handleForgotSubmit} className="auth-form">
            <div className="form-group">
              <label><Mail size={14} /> {t('emailAddress', 'Email Address')}</label>
              <input
                type="email"
                placeholder={t('emailAddress', 'Enter your email')}
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                required
              />
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
              {loading ? t('loading', 'Sending...') : t('sendResetLink', 'Send Reset Link')}
            </button>
          </form>
          <p className="auth-footer text-muted">
            {t('alreadyHaveAccount', 'Remembered your password?')} <a href="#" onClick={(e) => { e.preventDefault(); setIsForgotMode(false); setSuccess(''); setError(''); setDevResetLink(''); }}>{t('signIn', 'Sign in')}</a>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div style={{ position: 'fixed', top: '1.25rem', right: '1.25rem', zIndex: 100 }}>
        <LanguageSwitcher compact />
      </div>
      <FloatingNodes count={30} />
      <div className="auth-card glass-panel animate-fade-in" style={{ zIndex: 1 }}>
        <div className="auth-logo">
          <TrendingUp size={32} color="#6366f1" />
          <h1>FinanceOS</h1>
        </div>

        <h2>{t('welcomeBack', 'Welcome back')}</h2>
        <p className="text-muted">{t('signInSubtitle', 'Sign in to manage your finances')}</p>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label><User size={14} /> {t('username', 'Username')}</label>
            <input
              type="text"
              placeholder={t('username', 'Enter your username')}
              value={form.username}
              onChange={e => setForm({ ...form, username: e.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label><Lock size={14} /> {t('currentPassword', 'Password')}</label>
              <a href="#" onClick={(e) => { e.preventDefault(); setIsForgotMode(true); setError(''); }} style={{ fontSize: '0.75rem', color: 'var(--accent-color)', textDecoration: 'none' }}>{t('forgotPassword', 'Forgot password?')}</a>
            </div>
            <input
              type="password"
              placeholder="Enter your password"
              value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
              required
            />
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
            <LogIn size={16} />
            {loading ? t('loading', 'Signing in...') : t('signIn', 'Sign In')}
          </button>
        </form>
        <p className="auth-footer text-muted">
          {t('dontHaveAccount', "Don't have an account?")} <Link to="/register">{t('createAccount', 'Create one')}</Link>
        </p>
      </div>
    </div>
  );
}
