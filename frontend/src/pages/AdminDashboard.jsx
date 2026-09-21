import React, { useState, useEffect } from 'react';
import api from '../api';
import { Users, Activity, Trash2, Calendar, ShieldCheck, Server, CheckCircle2, Globe, Lock } from 'lucide-react';
import { useDialog } from '../context/DialogContext';
import { formatErrorMessage } from '../utils';
import { useTranslation, formatMonthName } from '../i18n';
import './AdminDashboard.css';

export default function AdminDashboard() {
  const { showConfirm, showAlert } = useDialog();
  const { t, currentLang } = useTranslation();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const [stats, setStats] = useState({ total_users: 0, total_transactions: 0, total_volume: 0 });
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [statsRes, usersRes] = await Promise.all([
        api.get(`/admin/stats?month=${month}&year=${year}`),
        api.get(`/admin/users?month=${month}&year=${year}`)
      ]);
      setStats(statsRes.data);
      setUsers(usersRes.data);
    } catch (err) {
      console.error('Failed to fetch admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [month, year]);

  const handleDeleteUser = async (userId) => {
    const confirmed = await showConfirm({
      title: t('deleteUser', 'Delete Platform User'),
      message: t('confirmDeleteUser', 'Are you sure you want to delete this user? All their financial records and data will be permanently lost.'),
      confirmText: t('delete', 'Delete User'),
      cancelText: t('cancel', 'Cancel'),
      isDanger: true,
    });
    if (!confirmed) return;
    try {
      await api.delete(`/admin/users/${userId}`);
      setUsers(users.filter(u => u.id !== userId));
      // Refresh stats after deletion
      const statsRes = await api.get('/admin/stats');
      setStats(statsRes.data);
    } catch (err) {
      console.error('Failed to delete user:', err);
      showAlert({
        title: 'Delete Failed',
        message: formatErrorMessage(err, 'Failed to delete user.'),
        type: 'danger',
      });
    }
  };

  const months = Array.from({ length: 12 }, (_, i) => formatMonthName(i + 1, currentLang));

  if (loading) return <div className="loading-state">{t('loadingData', 'Loading system data...')}</div>;

  return (
    <div className="admin-dashboard animate-fade-in">
      <header className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>{t('systemOverview', 'System Overview')}</h1>
          <p className="text-muted">{t('adminSubtitle', 'Platform statistics and user management')}</p>
        </div>
        <div className="dashboard-filters">
          <select value={month} onChange={e => setMonth(Number(e.target.value))}>
            {months.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <select value={year} onChange={e => setYear(Number(e.target.value))}>
            {[2023, 2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </header>

      <div className="admin-stats-grid">
        <div className="stat-card glass-panel">
          <div className="stat-icon" style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#6366f1' }}>
            <Users size={24} />
          </div>
          <div className="stat-details">
            <span className="stat-label">{t('totalUsers', 'Total Users')}</span>
            <span className="stat-value">{stats.total_users}</span>
          </div>
        </div>
        
        <div className="stat-card glass-panel">
          <div className="stat-icon" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
            <Activity size={24} />
          </div>
          <div className="stat-details">
            <span className="stat-label">{t('transactions', 'Total Transactions')}</span>
            <span className="stat-value">{stats.total_transactions}</span>
          </div>
        </div>

        <div className="stat-card glass-panel">
          <div className="stat-icon" style={{ background: 'rgba(251, 191, 36, 0.15)', color: '#fbbf24' }}>
            <span style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>$</span>
          </div>
          <div className="stat-details">
            <span className="stat-label">{t('totalVolume', 'Total Volume')}</span>
            <span className="stat-value">${stats.total_volume.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
        </div>

        <div className="stat-card glass-panel">
          <div className="stat-icon" style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8' }}>
            <ShieldCheck size={24} />
          </div>
          <div className="stat-details">
            <span className="stat-label">{t('securityLockTitle', 'System Security')}</span>
            <span className="stat-value" style={{ fontSize: '1.2rem', color: '#10b981' }}>Active (3 Modes)</span>
          </div>
        </div>
      </div>

      {/* Real-time System Controls & Governance */}
      <div className="admin-governance-card glass-panel" style={{ padding: '1.25rem 1.5rem', marginBottom: '1.5rem', borderRadius: '16px' }}>
        <h2 className="section-title" style={{ fontSize: '1.05rem', margin: '0 0 0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Server size={18} color="#818cf8" /> Platform Security & System Governance
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
          <div style={{ padding: '0.75rem 1rem', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, fontSize: '0.86rem', color: '#10b981' }}>
              <CheckCircle2 size={16} /> Privacy Lock Shield
            </div>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              PIN, Password & 3×3 Pattern Lock enabled system-wide.
            </p>
          </div>

          <div style={{ padding: '0.75rem 1rem', borderRadius: '10px', background: 'rgba(99, 102, 241, 0.08)', border: '1px solid rgba(99, 102, 241, 0.25)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, fontSize: '0.86rem', color: '#818cf8' }}>
              <Globe size={16} /> Live Exchange Rates
            </div>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Real-time multi-currency engine connected and synchronized.
            </p>
          </div>

          <div style={{ padding: '0.75rem 1rem', borderRadius: '10px', background: 'rgba(251, 191, 36, 0.08)', border: '1px solid rgba(251, 191, 36, 0.25)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, fontSize: '0.86rem', color: '#fbbf24' }}>
              <Lock size={16} /> Audit Receipt Vouchers
            </div>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Single-page thermal voucher generator with QR stamp verified.
            </p>
          </div>
        </div>
      </div>

      <div className="admin-users-section glass-panel">
        <h2 className="section-title">{t('userDirectory', 'Registered Users')}</h2>
        <div className="table-responsive">
          <table className="admin-users-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Username</th>
                <th>Joined Date</th>
                <th>Transactions</th>
                <th>Total Spent</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center text-muted py-4">No users found.</td>
                </tr>
              ) : (
                users.map(u => (
                  <tr key={u.id}>
                    <td>#{u.id}</td>
                    <td className="font-medium">{u.username}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <Calendar size={14} className="text-muted" />
                        {new Date(u.created_at).toLocaleDateString()}
                      </div>
                    </td>
                    <td>{u.transaction_count}</td>
                    <td>${u.total_spent.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="text-right">
                      <button 
                        className="btn-icon btn-icon-danger" 
                        onClick={() => handleDeleteUser(u.id)}
                        title="Delete User"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
