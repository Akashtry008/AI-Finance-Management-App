import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../api';
import { Lock, TrendingUp, CheckCircle } from 'lucide-react';
import FloatingNodes from '../components/FloatingNodes';
import LanguageSwitcher from '../components/LanguageSwitcher';
import { useTranslation } from '../i18n';
import './Auth.css';

export default function ResetPassword() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!token) {
      setError('Invalid or missing reset token.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setError('');
    setLoading(true);
    try {
      await api.post('/reset-password', { token, new_password: password });
      setSuccess(true);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to reset password. The link may have expired.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="auth-page">
        <div style={{ position: 'fixed', top: '1.25rem', right: '1.25rem', zIndex: 100 }}>
          <LanguageSwitcher compact />
        </div>
        <FloatingNodes count={30} />
        <div className="auth-card glass-panel animate-fade-in" style={{ textAlign: 'center', zIndex: 1 }}>
          <CheckCircle size={48} color="var(--success-color)" style={{ marginBottom: '1rem' }} />
          <h2>Password Reset Successful</h2>
          <p className="text-muted" style={{ marginBottom: '2rem' }}>You can now sign in with your new password.</p>
          <button className="btn btn-primary" onClick={() => navigate('/login')} style={{ width: '100%', justifyContent: 'center' }}>
            {t('signIn', 'Go to Login')}
          </button>
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
        <h2>{t('resetPassword', 'Create New Password')}</h2>
        <p className="text-muted">Please enter a new password for your account.</p>

        {error && <div className="auth-error">{error}</div>}
        {!token && !error && <div className="auth-error">Warning: No reset token found in URL.</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label><Lock size={14} /> {t('newPassword', 'New Password')}</label>
            <input
              type="password"
              placeholder={t('newPassword', 'Enter new password')}
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading || !token}>
            {loading ? t('loading', 'Resetting...') : t('resetPassword', 'Reset Password')}
          </button>
        </form>
        <p className="auth-footer text-muted">
          {t('back', 'Back to')} <Link to="/login">{t('signIn', 'Sign In')}</Link>
        </p>
      </div>
    </div>
  );
}
