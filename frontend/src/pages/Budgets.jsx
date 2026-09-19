import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import api from '../api';
import {
  Plus, X, Check, AlertTriangle, CheckCircle, BellRing,
  Trash2, Calendar, CheckCircle2, Sparkles, Clock, Pencil
} from 'lucide-react';
import { formatCurrency, getCurrencySymbol, formatErrorMessage } from '../utils';
import { useDialog } from '../context/DialogContext';
import {
  getRecurringBills, addRecurringBill, deleteRecurringBill,
  markBillAsPaid, getBillDueStatus
} from '../recurringBillsStore';
import { useTranslation } from '../i18n';
import './Transactions.css';
import './Budgets.css';

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
];

export function getKakeiboPillar(catName = '') {
  const name = (catName || '').toLowerCase();
  if (/rent|grocer|utilit|electric|water|gas|transit|fuel|commute|medic|health|insuran|food|bill/.test(name)) {
    return { name: 'Survival', icon: '🍲', color: '#3b82f6', rule: 'Essential Needs' };
  }
  if (/book|course|study|educat|theat|museum|gym|learn|culture|mind/.test(name)) {
    return { name: 'Culture', icon: '📚', color: '#8b5cf6', rule: 'Personal Growth' };
  }
  if (/repair|emergenc|gift|tax|fine|penalty|shock/.test(name)) {
    return { name: 'Extra', icon: '⚡', color: '#f59e0b', rule: 'Unforeseen Shocks' };
  }
  return { name: 'Optional', icon: '🛍️', color: '#ec4899', rule: 'Lifestyle Wants' };
}

export function getGoldenPillar(catName = '') {
  const name = (catName || '').toLowerCase();
  if (/rent|grocer|utilit|electric|water|gas|transit|fuel|commute|medic|insuran|food|bill/.test(name)) {
    return { name: '50% Needs', color: '#3b82f6', target: 'Core Living' };
  }
  if (/saving|invest|goal|fund|debt|loan/.test(name)) {
    return { name: '20% Savings', color: '#10b981', target: 'Future Wealth' };
  }
  return { name: '30% Wants', color: '#8b5cf6', target: 'Lifestyle & Fun' };
}

function BudgetCard({ cat, month, year, onEdit, framework = 'standard' }) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  const kakeibo = getKakeiboPillar(cat.name);
  const golden = getGoldenPillar(cat.name);

  useEffect(() => {
    api.get(`/budgets/status?category_id=${cat.id}&month=${month}&year=${year}`)
      .then(r => setStatus(r.data))
      .catch(() => setStatus(null))
      .finally(() => setLoading(false));
  }, [cat.id, month, year]);

  if (loading) return null;
  if (!status || status.budget === 0) return null;

  const targetLimit = status.effective_budget || status.budget;
  const pct = Math.min(100, targetLimit > 0 ? (status.spent / targetLimit) * 100 : 0);
  const isOver = status.exceeded;

  return (
    <div className={`budget-card glass-panel ${isOver ? 'budget-card--over' : ''}`}>
      <div className="budget-card-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
            <h4>{cat.name}</h4>
            {framework === 'kakeibo' && (
              <span
                className="framework-tag-pill"
                style={{ color: kakeibo.color, borderColor: `${kakeibo.color}44`, background: `${kakeibo.color}15` }}
              >
                {kakeibo.icon} {kakeibo.name}
              </span>
            )}
            {framework === 'golden' && (
              <span
                className="framework-tag-pill"
                style={{ color: golden.color, borderColor: `${golden.color}44`, background: `${golden.color}15` }}
              >
                {golden.name}
              </span>
            )}
            {status.rollover_amount > 0 && (
              <span
                style={{
                  fontSize: '0.72rem',
                  padding: '0.15rem 0.5rem',
                  borderRadius: '12px',
                  background: 'rgba(16, 185, 129, 0.15)',
                  color: '#34d399',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  fontWeight: 600
                }}
                title="Unspent surplus rolled over from previous month"
              >
                +{formatCurrency(status.rollover_amount)} Rollover
              </span>
            )}
          </div>
          <span className="text-muted" style={{fontSize:'0.8rem'}}>{MONTHS[month-1]} {year}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
          <button
            type="button"
            className="budget-card-edit-btn"
            onClick={() => onEdit(cat, status)}
            title="Edit Budget Limit"
          >
            <Pencil size={12} />
            <span>Edit</span>
          </button>
          {isOver
            ? <AlertTriangle size={20} color="var(--danger-color)" />
            : <CheckCircle size={20} color="var(--success-color)" />
          }
        </div>
      </div>

      <div className="budget-progress-bar-wrap">
        <div className="budget-progress-bar" style={{
          width: `${pct}%`,
          background: isOver
            ? 'linear-gradient(90deg, #ef4444, #dc2626)'
            : 'linear-gradient(90deg, #6366f1, #10b981)'
        }} />
      </div>

      <div className="budget-stats">
        <div>
          <div className="text-muted" style={{fontSize:'0.75rem'}}>SPENT</div>
          <div className={`budget-amt ${isOver ? 'text-danger' : 'text-success'}`}>
            {formatCurrency(status.spent)}
          </div>
        </div>
        <div style={{textAlign:'center'}}>
          <div className="text-muted" style={{fontSize:'0.75rem'}}>REMAINING</div>
          <div className={`budget-amt ${isOver ? 'text-danger' : ''}`}>
            {formatCurrency(Math.abs(status.remaining))}
            {isOver && <span style={{fontSize:'0.7rem'}}> over</span>}
          </div>
        </div>
        <div style={{textAlign:'right'}}>
          <div className="text-muted" style={{fontSize:'0.75rem'}}>
            {status.rollover_amount > 0 ? 'EFFECTIVE LIMIT' : 'BUDGET'}
          </div>
          <div
            className="budget-amt"
            title={status.rollover_amount > 0 ? `Base: ${formatCurrency(status.budget)} + Rollover: ${formatCurrency(status.rollover_amount)}` : undefined}
          >
            {formatCurrency(status.effective_budget || status.budget)}
          </div>
        </div>
      </div>

      {isOver && (
        <div className="budget-warning-block">
          <div className="budget-warning">
            ⚠ Budget exceeded by {formatCurrency(Math.abs(status.remaining))}
          </div>
          <button
            type="button"
            className="budget-warning-adjust-btn"
            onClick={() => onEdit(cat, status)}
          >
            <Pencil size={12} /> Adjust / Increase Budget
          </button>
        </div>
      )}
    </div>
  );
}

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

const FALLBACK_EXPENSE_CATEGORIES = [
  { id: 1, name: 'Food & Dining', type: 'expense' },
  { id: 2, name: 'Groceries', type: 'expense' },
  { id: 3, name: 'Transportation', type: 'expense' },
  { id: 4, name: 'Housing & Rent', type: 'expense' },
  { id: 5, name: 'Utilities & Bills', type: 'expense' },
  { id: 6, name: 'Entertainment & Leisure', type: 'expense' },
  { id: 7, name: 'Shopping & Lifestyle', type: 'expense' },
  { id: 8, name: 'Healthcare & Medical', type: 'expense' },
  { id: 9, name: 'Education & Learning', type: 'expense' },
  { id: 10, name: 'Travel & Vacation', type: 'expense' },
  { id: 11, name: 'Personal Care', type: 'expense' },
  { id: 12, name: 'Miscellaneous', type: 'expense' },
];

export default function Budgets() {
  const { showConfirm } = useDialog();
  const now = new Date();
  const { t } = useTranslation();
  const [categories, setCategories] = useState([]);
  const displayCategories = (categories && categories.length > 0) ? categories : FALLBACK_EXPENSE_CATEGORIES;
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [framework, setFramework] = useState(() => localStorage.getItem('finance-os-budget-framework') || 'standard');
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState({ category_id: '', monthString: '', amount: '', exceeded: false });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  // Recurring Bills & Subscriptions Radar State
  const [recurringBills, setRecurringBills] = useState(() => getRecurringBills());
  const [showRecurringModal, setShowRecurringModal] = useState(false);
  const [recurringForm, setRecurringForm] = useState({
    name: '',
    amount: '',
    day: 1,
    category: 'Utilities',
    cycle: 'Monthly'
  });

  useEffect(() => {
    const handleUpdate = (e) => {
      setRecurringBills(e.detail || getRecurringBills());
    };
    window.addEventListener('recurringBillsUpdated', handleUpdate);
    return () => window.removeEventListener('recurringBillsUpdated', handleUpdate);
  }, []);

  useEffect(() => {
    api.get('/categories?ctype=expense')
      .then(r => {
        if (r.data && r.data.length > 0) {
          setCategories(r.data);
        } else {
          setCategories(FALLBACK_EXPENSE_CATEGORIES);
        }
      })
      .catch(() => setCategories(FALLBACK_EXPENSE_CATEGORIES));
  }, []);

  const handleOpenEdit = (cat, status) => {
    setIsEditing(true);
    setError('');
    const monthStr = `${year}-${String(month).padStart(2, '0')}`;
    setForm({
      category_id: String(cat.id),
      monthString: monthStr,
      amount: String(status.budget || ''),
      exceeded: !!status.exceeded,
    });
    setShowModal(true);
  };

  const handleOpenCreate = () => {
    setIsEditing(false);
    setError('');
    const monthStr = `${year}-${String(month).padStart(2, '0')}`;
    const effectiveCats = categories.length > 0 ? categories : FALLBACK_EXPENSE_CATEGORIES;
    setForm({
      category_id: effectiveCats.length > 0 ? String(effectiveCats[0].id) : '1',
      monthString: monthStr,
      amount: '',
      exceeded: false,
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const [yr, mo] = form.monthString.split('-');
      await api.post('/budgets', {
        category_id: parseInt(form.category_id),
        month: parseInt(mo),
        year: parseInt(yr),
        amount: parseFloat(form.amount),
      });
      setShowModal(false);
      setMonth(parseInt(mo));
      setYear(parseInt(yr));
      setRefreshKey(k => k + 1);
    } catch (err) {
      setError(formatErrorMessage(err, 'Failed to set budget.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddRecurring = (e) => {
    e.preventDefault();
    if (!recurringForm.name || !recurringForm.amount) return;
    addRecurringBill(recurringForm);
    setRecurringForm({ name: '', amount: '', day: 1, category: 'Utilities', cycle: 'Monthly' });
    setShowRecurringModal(false);
  };

  const handleDeleteRecurring = async (id) => {
    const confirmed = await showConfirm({
      title: 'Delete Subscription / Bill',
      message: 'Delete this subscription/recurring bill from radar?',
      confirmText: 'Delete Bill',
      cancelText: 'Keep Bill',
      isDanger: true,
    });
    if (confirmed) {
      deleteRecurringBill(id);
    }
  };

  const handlePayBill = async (bill) => {
    try {
      const cat = categories.find(c => c.name.toLowerCase().includes(bill.category.toLowerCase())) || categories[0];
      const catId = cat ? cat.id : 1;
      const todayStr = new Date().toISOString().split('T')[0];
      await api.post('/transactions', {
        category_id: catId,
        amount: parseFloat(bill.amount),
        txn_date: todayStr,
        description: `Recurring: ${bill.name}`
      });
    } catch (err) {
      console.warn('Could not post txn to backend:', err);
    }
    markBillAsPaid(bill.id, month, year);
    setRefreshKey(k => k + 1);
  };

  return (
    <div className="budgets-page animate-fade-in">
      <div className="page-header">
        <div>
          <h2>Budgets</h2>
          <p className="text-muted">Set and monitor your spending limits</p>
        </div>
        <button className="btn btn-primary" onClick={handleOpenCreate}>
          <Plus size={16} /> Set Budget
        </button>
      </div>

      <div className="txn-controls glass-panel" style={{marginBottom:'1.5rem'}}>
        <div className="txn-filters">
          <span className="text-muted" style={{fontSize:'0.9rem'}}>Viewing:</span>
          <select value={month} onChange={e => setMonth(Number(e.target.value))}>
            {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <select value={year} onChange={e => setYear(Number(e.target.value))}>
            {[2023, 2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        {/* Global Budget Philosophy Selector */}
        <div className="budget-framework-selector">
          <button
            type="button"
            className={`framework-pill-btn ${framework === 'standard' ? 'active' : ''}`}
            onClick={() => {
              setFramework('standard');
              localStorage.setItem('finance-os-budget-framework', 'standard');
            }}
          >
            📊 {t('standardView', 'Standard')}
          </button>
          <button
            type="button"
            className={`framework-pill-btn ${framework === 'golden' ? 'active' : ''}`}
            onClick={() => {
              setFramework('golden');
              localStorage.setItem('finance-os-budget-framework', 'golden');
            }}
          >
            ⚖️ {t('goldenView', '50/30/20 Balance')}
          </button>
          <button
            type="button"
            className={`framework-pill-btn ${framework === 'kakeibo' ? 'active' : ''}`}
            onClick={() => {
              setFramework('kakeibo');
              localStorage.setItem('finance-os-budget-framework', 'kakeibo');
            }}
          >
            {t('kakeiboView', '🇯🇵 Kakeibo Method')}
          </button>
        </div>
      </div>

      {/* Philosophy Explainer Banners */}
      {framework === 'kakeibo' && (
        <div className="framework-banner kakeibo-banner glass-panel animate-fade-in">
          <div className="framework-banner-top">
            <div className="framework-banner-title" style={{ color: '#ec4899' }}>
              <span>🇯🇵</span>
              <span>Kakeibo Household Ledger Philosophy (家計簿)</span>
            </div>
            <span className="text-muted" style={{ fontSize: '0.78rem' }}>Mindful Japanese Accounting</span>
          </div>
          <p className="text-muted" style={{ fontSize: '0.82rem', margin: 0 }}>
            Categorizes every expense into 4 intentional pillars to eliminate emotional spending and foster gratitude.
          </p>

          <div className="framework-pillars-preview">
            <span className="framework-chip" style={{ color: '#3b82f6', borderColor: 'rgba(59, 130, 246, 0.4)', background: 'rgba(59, 130, 246, 0.1)' }}>
              🍲 <strong>Survival (Needs)</strong>: Food, Commute, Shelter, Health
            </span>
            <span className="framework-chip" style={{ color: '#ec4899', borderColor: 'rgba(236, 72, 153, 0.4)', background: 'rgba(236, 72, 153, 0.1)' }}>
              🛍️ <strong>Optional (Wants)</strong>: Dining out, Fashion, Hobbies
            </span>
            <span className="framework-chip" style={{ color: '#8b5cf6', borderColor: 'rgba(139, 92, 246, 0.4)', background: 'rgba(139, 92, 246, 0.1)' }}>
              📚 <strong>Culture (Mind)</strong>: Books, Courses, Self-growth
            </span>
            <span className="framework-chip" style={{ color: '#f59e0b', borderColor: 'rgba(245, 158, 11, 0.4)', background: 'rgba(245, 158, 11, 0.1)' }}>
              ⚡ <strong>Extra (Shocks)</strong>: Emergency repairs, Medical, Gifts
            </span>
          </div>

          <div className="kakeibo-questions-list">
            <div className="kakeibo-q-box">1. How much money do you have?</div>
            <div className="kakeibo-q-box">2. How much would you like to save?</div>
            <div className="kakeibo-q-box">3. How much are you spending?</div>
            <div className="kakeibo-q-box">4. How will you improve next month?</div>
          </div>
        </div>
      )}

      {framework === 'golden' && (
        <div className="framework-banner golden-banner glass-panel animate-fade-in">
          <div className="framework-banner-top">
            <div className="framework-banner-title" style={{ color: '#3b82f6' }}>
              <span>⚖️</span>
              <span>50/30/20 Golden Balance Allocation</span>
            </div>
            <span className="text-muted" style={{ fontSize: '0.78rem' }}>CFPB Wealth Framework</span>
          </div>
          <p className="text-muted" style={{ fontSize: '0.82rem', margin: 0 }}>
            Allocates net income into 50% essential needs, 30% lifestyle wants, and 20% future wealth creation.
          </p>

          <div className="framework-pillars-preview">
            <span className="framework-chip" style={{ color: '#3b82f6', borderColor: 'rgba(59, 130, 246, 0.4)', background: 'rgba(59, 130, 246, 0.1)' }}>
              🔵 <strong>50% Needs</strong>: Mandatory living costs & bills
            </span>
            <span className="framework-chip" style={{ color: '#8b5cf6', borderColor: 'rgba(139, 92, 246, 0.4)', background: 'rgba(139, 92, 246, 0.1)' }}>
              🟣 <strong>30% Wants</strong>: Discretionary lifestyle & leisure
            </span>
            <span className="framework-chip" style={{ color: '#10b981', borderColor: 'rgba(16, 185, 129, 0.4)', background: 'rgba(16, 185, 129, 0.1)' }}>
              🟢 <strong>20% Savings</strong>: Emergency buffer & debt clearance
            </span>
          </div>
        </div>
      )}

      <div className="budget-grid" key={refreshKey}>
        {categories.length === 0 ? (
          <p className="text-muted">Loading categories...</p>
        ) : (
          categories.map(cat => (
            <BudgetCard
              key={`${cat.id}-${month}-${year}-${refreshKey}`}
              cat={cat}
              month={month}
              year={year}
              onEdit={handleOpenEdit}
              framework={framework}
            />
          ))
        )}
      </div>

      {categories.length > 0 && (
        <div className="budget-hint glass-panel">
          <p className="text-muted" style={{fontSize:'0.85rem', textAlign:'center'}}>
            Only categories with budgets set are shown above. Click "Set Budget" to add a budget for a category.
          </p>
        </div>
      )}

      {/* Recurring Bills & Subscription Radar Section */}
      <div className="radar-section animate-fade-in" style={{ marginTop: '2.5rem' }}>
        <div className="radar-section-header">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <BellRing size={22} color="var(--accent-color)" />
              <h3 style={{ margin: 0, fontSize: '1.4rem' }}>Recurring Bills & Subscription Radar</h3>
            </div>
            <p className="text-muted" style={{ margin: '0.25rem 0 0 0', fontSize: '0.88rem' }}>
              Track fixed monthly commitments, renewal dates, and log payments with 1-click
            </p>
          </div>
          <button
            className="btn btn-primary"
            onClick={() => setShowRecurringModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <Plus size={16} /> Add Subscription / Bill
          </button>
        </div>

        {/* Radar Summary KPI row */}
        <div className="radar-kpi-row">
          <div className="radar-kpi-card glass-panel">
            <span className="text-muted" style={{ fontSize: '0.78rem' }}>TOTAL MONTHLY COMMITMENT</span>
            <div className="radar-kpi-val" style={{ color: '#fbbf24' }}>
              {formatCurrency(recurringBills.reduce((acc, b) => acc + (parseFloat(b.amount) || 0), 0))}
            </div>
          </div>
          <div className="radar-kpi-card glass-panel">
            <span className="text-muted" style={{ fontSize: '0.78rem' }}>ACTIVE SUBSCRIPTIONS</span>
            <div className="radar-kpi-val">
              {recurringBills.length} active
            </div>
          </div>
          <div className="radar-kpi-card glass-panel">
            <span className="text-muted" style={{ fontSize: '0.78rem' }}>STATUS THIS MONTH</span>
            <div className="radar-kpi-val" style={{ color: '#34d399' }}>
              {recurringBills.filter(b => getBillDueStatus(b, month, year).status === 'paid').length} Paid / {recurringBills.length} Total
            </div>
          </div>
        </div>

        {/* Radar Bills Grid */}
        <div className="radar-full-grid">
          {recurringBills.map(bill => {
            const dueInfo = getBillDueStatus(bill, month, year);
            return (
              <div key={bill.id} className="radar-full-card glass-panel">
                <div className="radar-full-top">
                  <div>
                    <h4 className="radar-card-title">{bill.name}</h4>
                    <span className="radar-card-cat">{bill.category} • {bill.cycle}</span>
                  </div>
                  <span className={`radar-due-badge ${dueInfo.badgeClass}`}>
                    {dueInfo.label}
                  </span>
                </div>

                <div className="radar-full-middle">
                  <div className="radar-due-date-text text-muted">
                    <Calendar size={13} />
                    <span>Renews on the <strong>{bill.day}th</strong> of every month</span>
                  </div>
                  <div className="radar-card-amount">
                    {formatCurrency(bill.amount)}
                  </div>
                </div>

                <div className="radar-full-actions">
                  {dueInfo.status !== 'paid' ? (
                    <button
                      type="button"
                      className="radar-action-pay-btn"
                      onClick={() => handlePayBill(bill)}
                      title="Log as paid expense in transactions"
                    >
                      <CheckCircle2 size={14} /> Log as Paid
                    </button>
                  ) : (
                    <div className="radar-paid-confirmed">
                      <CheckCircle size={14} color="#10b981" /> Paid for {MONTHS[month - 1]}
                    </div>
                  )}
                  <button
                    type="button"
                    className="radar-action-del-btn"
                    onClick={() => handleDeleteRecurring(bill.id)}
                    title="Remove from recurring radar"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Add Recurring Bill Modal */}
      {showRecurringModal && (
        <Modal title="Add Subscription / Recurring Bill" onClose={() => setShowRecurringModal(false)}>
          <form onSubmit={handleAddRecurring} className="modal-form">
            <div className="form-group">
              <label>Subscription / Bill Name</label>
              <input
                placeholder="e.g. Netflix, Gym Membership, Internet"
                value={recurringForm.name}
                onChange={e => setRecurringForm({ ...recurringForm, name: e.target.value })}
                required
              />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Amount ({getCurrencySymbol()})</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  value={recurringForm.amount}
                  onChange={e => setRecurringForm({ ...recurringForm, amount: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Billing Day of Month (1 - 31)</label>
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={recurringForm.day}
                  onChange={e => setRecurringForm({ ...recurringForm, day: e.target.value })}
                  required
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Category</label>
                <select
                  value={recurringForm.category}
                  onChange={e => setRecurringForm({ ...recurringForm, category: e.target.value })}
                >
                  <option value="Entertainment">Entertainment</option>
                  <option value="Utilities">Utilities</option>
                  <option value="Housing">Housing / Rent</option>
                  <option value="Software">Software & Cloud</option>
                  <option value="Health">Health & Fitness</option>
                  <option value="Insurance">Insurance</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div className="form-group">
                <label>Billing Cycle</label>
                <select
                  value={recurringForm.cycle}
                  onChange={e => setRecurringForm({ ...recurringForm, cycle: e.target.value })}
                >
                  <option value="Monthly">Monthly</option>
                  <option value="Quarterly">Quarterly</option>
                  <option value="Yearly">Yearly</option>
                </select>
              </div>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setShowRecurringModal(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary">
                <Check size={16} /> Save Subscription
              </button>
            </div>
          </form>
        </Modal>
      )}

      {showModal && (
        <Modal
          title={isEditing ? (form.exceeded ? "Adjust / Increase Budget" : "Edit Budget Limit") : "Set Budget"}
          onClose={() => setShowModal(false)}
        >
          <form onSubmit={handleSubmit} className="modal-form">
            {error && <div className="auth-error" style={{marginBottom:'1rem'}}>{error}</div>}
            <div className="form-group">
              <label>Expense Category</label>
              <select
                value={form.category_id}
                onChange={e => setForm({...form, category_id: e.target.value})}
                required
                disabled={isEditing}
              >
                <option value="">Select category...</option>
                {displayCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Budget Month & Year</label>
              <input 
                type="month" 
                value={form.monthString} 
                onChange={e => setForm({...form, monthString: e.target.value})} 
                required 
                disabled={isEditing}
              />
            </div>
            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ margin: 0 }}>Budget Amount ({getCurrencySymbol()})</label>
                {isEditing && (
                  <span className="text-muted" style={{ fontSize: '0.75rem' }}>
                    Adjust limit for this category
                  </span>
                )}
              </div>
              <input
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                value={form.amount}
                onChange={e => setForm({...form, amount: e.target.value})}
                required
              />
              <div className="budget-quick-adjust-row">
                <span className="text-muted" style={{ fontSize: '0.75rem' }}>Quick Bump:</span>
                {[500, 1000, 2000, 5000].map(bump => (
                  <button
                    key={bump}
                    type="button"
                    className="budget-quick-bump-btn"
                    onClick={() => {
                      const curr = parseFloat(form.amount) || 0;
                      setForm(f => ({ ...f, amount: String(Math.round(curr + bump)) }));
                    }}
                  >
                    +{getCurrencySymbol()}{bump.toLocaleString()}
                  </button>
                ))}
              </div>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                <Check size={16} />
                {submitting ? 'Saving...' : (isEditing ? 'Update Budget' : 'Set Budget')}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
