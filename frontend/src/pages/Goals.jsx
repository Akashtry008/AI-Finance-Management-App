import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import confetti from 'canvas-confetti';
import api from '../api';
import { Target, Plus, Trash2, Calendar, TrendingUp, X, Check, Award, Sparkles, Coins } from 'lucide-react';
import { formatCurrency, getCurrencySymbol, formatErrorMessage } from '../utils';
import { useDialog } from '../context/DialogContext';
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
  const { showConfirm, showAlert } = useDialog();
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showFundModal, setShowFundModal] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({ name: '', target_amount: '', color: '#6366f1', deadline: '', monthly_allocation: '' });
  const [fundAmount, setFundAmount] = useState('');

  const triggerCelebration = () => {
    try {
      confetti({
        particleCount: 90,
        spread: 70,
        origin: { y: 0.6 }
      });
    } catch(e) {
      console.log('Confetti error:', e);
    }
  };

  const getMilestone = (progress) => {
    if (progress >= 100) return { tier: 'platinum', label: '100% Achieved', icon: '🚀' };
    if (progress >= 75) return { tier: 'gold', label: '75% Milestone', icon: '🏆' };
    if (progress >= 50) return { tier: 'silver', label: '50% Halfway', icon: '🧱' };
    if (progress >= 25) return { tier: 'bronze', label: '25% Seedling', icon: '🌱' };
    return null;
  };

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
    setForm({ name: '', target_amount: '', color: '#6366f1', deadline: '', monthly_allocation: '' });
    setShowModal(true);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/goals', {
        ...form,
        target_amount: parseFloat(form.target_amount),
        monthly_allocation: form.monthly_allocation ? parseFloat(form.monthly_allocation) : null
      });
      setShowModal(false);
      fetchGoals();
    } catch (err) {
      showAlert({
        title: 'Goal Creation Failed',
        message: formatErrorMessage(err, 'Failed to create goal.'),
        type: 'danger',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDepositMonthly = async (goal) => {
    if (!goal.monthly_allocation || goal.monthly_allocation <= 0) return;
    const target = parseFloat(goal.target_amount) || 0;
    const current = Math.min(parseFloat(goal.current_amount || 0), target);
    const needed = Math.max(0, target - current);
    const toDeposit = Math.min(parseFloat(goal.monthly_allocation), needed);
    if (toDeposit <= 0) return;

    try {
      await api.put(`/goals/${goal.id}/add`, { amount: toDeposit });
      if (current + toDeposit >= target) {
        triggerCelebration();
      }
      fetchGoals();
    } catch (err) {
      showAlert({
        title: 'Deposit Failed',
        message: formatErrorMessage(err),
        type: 'danger'
      });
    }
  };

  const handleAddFunds = async (e) => {
    e.preventDefault();
    if (!showFundModal) return;
    const target = parseFloat(showFundModal.target_amount) || 0;
    const current = Math.min(parseFloat(showFundModal.current_amount || 0), target);
    const remainingNeeded = Math.max(0, target - current);

    const inputVal = parseFloat(fundAmount);
    if (isNaN(inputVal) || inputVal <= 0) {
      showAlert({
        title: 'Invalid Amount',
        message: 'Please enter a valid contribution amount greater than 0.',
        type: 'warning',
      });
      return;
    }

    // Strictly clamp addition so it never exceeds target
    const finalAmount = Math.min(inputVal, remainingNeeded);

    setSubmitting(true);
    try {
      await api.put(`/goals/${showFundModal.id}/add`, { amount: finalAmount });
      if (current + finalAmount >= target) {
        triggerCelebration();
      }
      setShowFundModal(null);
      setFundAmount('');
      fetchGoals();
    } catch (err) {
      showAlert({
        title: 'Contribution Failed',
        message: formatErrorMessage(err, 'Failed to add funds to goal.'),
        type: 'danger',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    const confirmed = await showConfirm({
      title: 'Delete Savings Goal',
      message: 'Are you sure you want to delete this savings goal?',
      confirmText: 'Delete Goal',
      cancelText: 'Keep Goal',
      isDanger: true,
    });
    if (!confirmed) return;
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
            const target = parseFloat(goal.target_amount) || 0;
            // Strictly cap current amount so it NEVER exceeds target amount
            const current = Math.min(parseFloat(goal.current_amount || 0), target);
            const isCompleted = target > 0 && current >= target;
            const progress = target > 0 ? Math.min((current / target) * 100, 100) : 0;
            const remainingNeeded = Math.max(0, target - current);

            return (
              <div
                key={goal.id}
                className={`goal-card glass-panel ${isCompleted ? 'goal-card-completed' : ''}`}
                style={{ borderTop: `4px solid ${isCompleted ? '#10b981' : goal.color}` }}
              >
                <div className="goal-card-header">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <h3 className="goal-card-title">{goal.name}</h3>
                      {isCompleted ? (
                        <span className="goal-badge-paid">
                          <Check size={11} strokeWidth={3} /> Paid
                        </span>
                      ) : (
                        (() => {
                          const milestone = getMilestone(progress);
                          if (milestone) {
                            return (
                              <span className={`goal-milestone-badge ${milestone.tier}`} title={milestone.label}>
                                <span>{milestone.icon}</span> {milestone.label}
                              </span>
                            );
                          }
                          return null;
                        })()
                      )}
                    </div>
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
                      className={`goal-progress-fill ${isCompleted ? 'goal-progress-fill-paid' : ''}`}
                      style={{
                        width: `${progress}%`,
                        background: isCompleted ? 'linear-gradient(90deg, #10b981, #059669)' : goal.color
                      }}
                    />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.4rem' }}>
                    <span className="text-muted" style={{ fontSize: '0.78rem' }}>
                      {isCompleted ? (
                        <span style={{ color: '#10b981', fontWeight: 600 }}>Target reached!</span>
                      ) : (
                        `Remaining: ${formatCurrency(remainingNeeded)}`
                      )}
                    </span>
                    <span className="text-muted" style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                      {progress.toFixed(1)}% achieved
                    </span>
                  </div>
                </div>

                {goal.monthly_allocation > 0 && !isCompleted && (
                  <div className="goal-auto-save-box">
                    <span className="text-muted" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <Coins size={13} color="var(--accent-color)" /> Auto-Save Target:
                    </span>
                    <strong>{formatCurrency(goal.monthly_allocation)}/mo</strong>
                  </div>
                )}

                {isCompleted ? (
                  <div className="goal-paid-state">
                    <Check size={15} /> Goal Completed & Paid
                  </div>
                ) : (
                  <div className="goal-card-actions">
                    <button
                      className="goal-add-funds-btn"
                      onClick={() => { setShowFundModal(goal); setFundAmount(''); }}
                    >
                      <TrendingUp size={14} /> Add Funds
                    </button>
                    {goal.monthly_allocation > 0 && (
                      <button
                        className="goal-deposit-monthly-btn"
                        onClick={() => handleDepositMonthly(goal)}
                        title={`Deposit monthly allocation (${formatCurrency(Math.min(goal.monthly_allocation, remainingNeeded))})`}
                      >
                        <Sparkles size={13} /> Deposit Monthly ({formatCurrency(Math.min(goal.monthly_allocation, remainingNeeded))})
                      </button>
                    )}
                  </div>
                )}
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
              <label>Virtual Monthly Allocation ({getCurrencySymbol()}) (Optional)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="e.g. 500.00"
                value={form.monthly_allocation}
                onChange={e => setForm({ ...form, monthly_allocation: e.target.value })}
              />
              <small className="text-muted" style={{ fontSize: '0.75rem', marginTop: '0.2rem', display: 'block' }}>
                Set a planned monthly auto-save target to fast-deposit into this goal anytime.
              </small>
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

      {showFundModal && (() => {
        const mTarget = parseFloat(showFundModal.target_amount) || 0;
        const mCurrent = Math.min(parseFloat(showFundModal.current_amount || 0), mTarget);
        const mRemaining = Math.max(0, mTarget - mCurrent);

        return (
          <Modal title={`Add Funds — ${showFundModal.name}`} onClose={() => setShowFundModal(null)}>
            <form onSubmit={handleAddFunds} className="modal-form">
              <div className="goal-fund-summary" style={{
                background: 'rgba(99, 102, 241, 0.08)',
                border: '1px solid rgba(99, 102, 241, 0.2)',
                borderRadius: '8px',
                padding: '0.75rem',
                marginBottom: '1rem',
                fontSize: '0.84rem',
                display: 'flex',
                justifyContent: 'space-between'
              }}>
                <div>
                  <span className="text-muted">Target:</span> <strong>{formatCurrency(mTarget)}</strong>
                </div>
                <div>
                  <span className="text-muted">Saved:</span> <strong>{formatCurrency(mCurrent)}</strong>
                </div>
                <div>
                  <span className="text-muted">Remaining:</span> <strong style={{ color: '#10b981' }}>{formatCurrency(mRemaining)}</strong>
                </div>
              </div>

              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                  <label style={{ margin: 0 }}>Amount to Add ({getCurrencySymbol()})</label>
                  {mRemaining > 0 && (
                    <button
                      type="button"
                      onClick={() => setFundAmount(mRemaining.toFixed(2))}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--accent-color)',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        textDecoration: 'underline'
                      }}
                    >
                      Fill Max ({formatCurrency(mRemaining)})
                    </button>
                  )}
                </div>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={mRemaining}
                  placeholder={`Max ${mRemaining.toFixed(2)}`}
                  value={fundAmount}
                  onChange={e => setFundAmount(e.target.value)}
                  required
                />
                <small className="text-muted" style={{ display: 'block', marginTop: '0.25rem', fontSize: '0.75rem' }}>
                  Goal additions are capped at {formatCurrency(mRemaining)}. Cannot exceed target amount.
                </small>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowFundModal(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  <Check size={16} />
                  {submitting ? 'Adding...' : 'Confirm & Save'}
                </button>
              </div>
            </form>
          </Modal>
        );
      })()}
    </div>
  );
}
