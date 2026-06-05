import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import { LogIn, User, Lock, TrendingUp, ShieldCheck, Mail } from 'lucide-react';
import FloatingNodes from '../components/FloatingNodes';
import './Auth.css';

export default function Login() {
  const [form, setForm] = useState({ username: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [isForgotMode, setIsForgotMode] = useState(false);
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
    setLoading(true);
    try {
      const res = await api.post('/forgot-password', { email: form.email });
      setSuccess(res.data.msg);
    } catch (err) {
      setError('Failed to send reset link.');
    } finally {
      setLoading(false);
    }
  };

  const fillAdmin = () => setForm({ username: 'admin', password: 'admin123' });

  if (isForgotMode) {
    return (
      <div className="auth-page">
        <FloatingNodes count={30} />
        <div className="auth-card glass-panel animate-fade-in" style={{ zIndex: 1 }}>
          <div className="auth-logo">
            <TrendingUp size={32} color="#6366f1" />
            <h1>FinanceOS</h1>
          </div>
          <h2>Reset Password</h2>
          <p className="text-muted">Enter your email to receive a secure reset link.</p>

          {error && <div className="auth-error">{error}</div>}
          {success && <div className="auth-success" style={{ color: 'var(--success-color)', background: 'rgba(16, 185, 129, 0.1)', padding: '0.75rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.85rem' }}>{success}</div>}

          <form onSubmit={handleForgotSubmit} className="auth-form">
            <div className="form-group">
              <label><Mail size={14} /> Email Address</label>
              <input
                type="email"
                placeholder="Enter your email"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                required
              />
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>
          </form>
          <p className="auth-footer text-muted">
            Remembered your password? <a href="#" onClick={(e) => { e.preventDefault(); setIsForgotMode(false); setSuccess(''); setError(''); }}>Sign in</a>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <FloatingNodes count={30} />
      <div className="auth-card glass-panel animate-fade-in" style={{ zIndex: 1 }}>
        <div className="auth-logo">
          <TrendingUp size={32} color="#6366f1" />
          <h1>FinanceOS</h1>
        </div>
        <h2>Welcome back</h2>
        <p className="text-muted">Sign in to manage your finances</p>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label><User size={14} /> Username</label>
            <input
              type="text"
              placeholder="Enter your username"
              value={form.username}
              onChange={e => setForm({ ...form, username: e.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label><Lock size={14} /> Password</label>
              <a href="#" onClick={(e) => { e.preventDefault(); setIsForgotMode(true); setError(''); }} style={{ fontSize: '0.75rem', color: 'var(--accent-color)', textDecoration: 'none' }}>Forgot password?</a>
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
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
        <p className="auth-footer text-muted">
          Don't have an account? <Link to="/register">Create one</Link>
        </p>
      </div>
    </div>
  );
}
