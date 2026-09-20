import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api';
import { UserPlus, User, Lock, TrendingUp, Mail, Sparkles } from 'lucide-react';
import FloatingNodes from '../components/FloatingNodes';
import LanguageSwitcher from '../components/LanguageSwitcher';
import { useTranslation } from '../i18n';
import './Auth.css';

export default function Register() {
  const { t } = useTranslation();
  const [form, setForm] = useState({ username: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const res = await api.post('/register', form);
      setSuccess(res.data?.msg || 'Account created! Welcome email dispatched. Redirecting to login...');
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

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

        <h2>{t('createAccount', 'Create Account')}</h2>
        <p className="text-muted">{t('createAccountSubtitle', 'Start your unrestricted financial journey today')}</p>

        {error && <div className="auth-error">{error}</div>}
        {success && <div className="auth-success">{success}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label><User size={14} /> {t('username', 'Username')}</label>
            <input
              type="text"
              placeholder={t('username', 'Choose a username')}
              value={form.username}
              onChange={e => setForm({ ...form, username: e.target.value })}
              required
            />
          </div>
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
          <div className="form-group">
            <label><Lock size={14} /> {t('currentPassword', 'Password')}</label>
            <input
              type="password"
              placeholder={t('currentPassword', 'Create a password')}
              value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
              required
            />
          </div>
          <button type="submit" className="btn btn-primary" style={{width:'100%'}} disabled={loading}>
            <UserPlus size={16} />
            {loading ? t('loading', 'Creating Account...') : t('createAccount', 'Create Account')}
          </button>
        </form>
        <p className="auth-footer text-muted">
          {t('alreadyHaveAccount', 'Already have an account?')} <Link to="/login">{t('signIn', 'Sign In')}</Link>
        </p>
      </div>
    </div>
  );
}
