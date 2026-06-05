import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import api from '../api';
import { Target, Plus, Trash2, Calendar, TrendingUp, X, Check } from 'lucide-react';
import { formatCurrency, getCurrencySymbol } from '../utils';
import './Goals.css';

function Modal({ title, onClose, children }) {
  return ReactDOM.createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card glass-panel" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="btn btn-secondary modal-close" onClick={onClose}><X size={16} /></button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}

export default function Goals() {
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showFundModal, setShowFundModal] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({ name: '', target_amount: '', color: '#6366f1', deadline: '' });
  const [fundAmount, setFundAmount] = useState('');

  const fetchGoals = async () => {
    try {
      const res = await api.get('/goals');
      setGoals(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchGoals(); }, []);

  const openCreate = () => {
    setForm({ name: '', target_amount: '', color: '#6366f1', deadline: '' });
    setShowModal(true);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/goals', { ...form, target_amount: parseFloat(form.target_amount) });
      setShowModal(false);
      fetchGoals();
    } catch (err) {
      alert('Failed to create goal');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddFunds = async (e) => {
    e.preventDefault();
    if (!showFundModal) return;
    setSubmitting(true);
    try {
      await api.put(`/goals/${showFundModal.id}/add`, { amount: parseFloat(fundAmount) });
      setShowFundModal(null);
      setFundAmount('');
      fetchGoals();
    } catch (err) {
      alert('Failed to add funds');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this goal?')) return;
    await api.delete(`/goals/${id}`);
    fetchGoals();
  };

  if (loading) return <div className="page-loader"><div className="spinner"></div></div>;

  return (
    <div className="goals-page animate-fade-in">
      <div className="page-header">
        <div>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
            <Target size={24} color="var(--accent-color)" /> Savings Goals
          </h2>
          <p className="text-muted" style={{ margin: '0.25rem 0 0' }}>Track and achieve your financial targets</p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>
          <Plus size={16} /> New Goal
        </button>
      </div>

      <div className="goals-grid">
        {goals.length === 0 ? (
          <div className="goal-empty-state glass-panel">
            <Target size={48} opacity={0.4} />
            <h3>No active goals</h3>
            <p>Create a savings goal to start tracking your progress.</p>
          </div>
        ) : (
          goals.map(goal => {
            const current = parseFloat(goal.current_amount);
            const target = parseFloat(goal.target_amount);
            const progress = Math.min((current / target) * 100, 100);

            return (
              <div key={goal.id} className="goal-card glass-panel" style={{ borderTop: `4px solid ${goal.color}` }}>
                <div className="goal-card-header">
                  <div>
                    <h3 className="goal-card-title">{goal.name}</h3>
                    {goal.deadline && (
                      <span className="goal-card-deadline">
                        <Calendar size={12} /> {new Date(goal.deadline).toLocaleDateString('en-IN')}
                      </span>
                    )}
                  </div>
                  <button className="goal-delete-btn" onClick={() => handleDelete(goal.id)} title="Delete Goal">
                    <Trash2 size={16} />
                  </button>
                </div>

                <div className="goal-progress-section">
                  <div className="goal-amounts">
                    <span className="goal-current">{formatCurrency(current)}</span>
                    <span className="goal-target">of {formatCurrency(target)}</span>
                  </div>
                  <div className="goal-progress-bar-container">
                    <div
                      className="goal-progress-fill"
                      style={{ width: `${progress}%`, background: goal.color }}
                    />
                  </div>
                  <p className="text-muted" style={{ fontSize: '0.8rem', margin: '0.5rem 0 0', textAlign: 'right' }}>
                    {progress.toFixed(1)}% achieved
                  </p>
                </div>

                <button className="goal-add-funds-btn" onClick={() => { setShowFundModal(goal); setFundAmount(''); }}>
                  <TrendingUp size={14} /> Add Funds
                </button>
              </div>
            );
          })
        )}
      </div>

      {showModal && (
        <Modal title="Create Savings Goal" onClose={() => setShowModal(false)}>
          <form onSubmit={handleCreate} className="modal-form">
            <div className="form-group">
              <label>Goal Name</label>
              <input
                type="text"
                placeholder="e.g. Vacation Fund, New Laptop..."
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label>Target Amount ({getCurrencySymbol()})</label>
              <input
                type="number"
                step="0.01"
                min="1"
                placeholder="0.00"
                value={form.target_amount}
                onChange={e => setForm({ ...form, target_amount: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label>Theme Color</label>
              <input
                type="color"
                value={form.color}
                onChange={e => setForm({ ...form, color: e.target.value })}
                style={{ width: '100%', height: '40px', padding: '2px 4px', borderRadius: '8px', cursor: 'pointer' }}
              />
            </div>
            <div className="form-group">
              <label>Target Date (Optional)</label>
              <input
                type="date"
                value={form.deadline}
                onChange={e => setForm({ ...form, deadline: e.target.value })}
              />
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                <Check size={16} />
                {submitting ? 'Creating...' : 'Create Goal'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {showFundModal && (
        <Modal title={`Add Funds — ${showFundModal.name}`} onClose={() => setShowFundModal(null)}>
          <form onSubmit={handleAddFunds} className="modal-form">
            <div className="form-group">
              <label>Amount to Add ({getCurrencySymbol()})</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                value={fundAmount}
                onChange={e => setFundAmount(e.target.value)}
                required
              />
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setShowFundModal(null)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                <Check size={16} />
                {submitting ? 'Adding...' : 'Add Funds'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
