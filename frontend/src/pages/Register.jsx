import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api';
import { UserPlus, User, Lock, TrendingUp, Mail, Sparkles } from 'lucide-react';
import FloatingNodes from '../components/FloatingNodes';
import './Auth.css';

export default function Register() {
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
      <FloatingNodes count={30} />
      <div className="auth-card glass-panel animate-fade-in" style={{ zIndex: 1 }}>
        <div className="auth-logo">
          <TrendingUp size={32} color="#6366f1" />
          <h1>FinanceOS</h1>
        </div>

        <h2>Create Account</h2>
        <p className="text-muted">Start your unrestricted financial journey today</p>

        {error && <div className="auth-error">{error}</div>}
        {success && <div className="auth-success">{success}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label><User size={14} /> Username</label>
            <input
              type="text"
              placeholder="Choose a username"
              value={form.username}
              onChange={e => setForm({ ...form, username: e.target.value })}
              required
            />
          </div>
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
          <div className="form-group">
            <label><Lock size={14} /> Password</label>
            <input
              type="password"
              placeholder="Create a password"
              value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
              required
            />
          </div>
          <button type="submit" className="btn btn-primary" style={{width:'100%'}} disabled={loading}>
            <UserPlus size={16} />
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>
        <p className="auth-footer text-muted">
          Already have an account? <Link to="/login">Sign In</Link>
        </p>
      </div>
    </div>
  );
}
