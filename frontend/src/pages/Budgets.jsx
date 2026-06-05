import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import api from '../api';
import { Plus, X, Check, AlertTriangle, CheckCircle } from 'lucide-react';
import { formatCurrency, getCurrencySymbol } from '../utils';
import './Transactions.css';
import './Budgets.css';

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
];

function BudgetCard({ cat, month, year }) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/budgets/status?category_id=${cat.id}&month=${month}&year=${year}`)
      .then(r => setStatus(r.data))
      .catch(() => setStatus(null))
      .finally(() => setLoading(false));
  }, [cat.id, month, year]);

  if (loading) return null;
  if (!status || status.budget === 0) return null;

  const pct = Math.min(100, (status.spent / status.budget) * 100);
  const isOver = status.exceeded;

  return (
    <div className={`budget-card glass-panel ${isOver ? 'budget-card--over' : ''}`}>
      <div className="budget-card-header">
        <div>
          <h4>{cat.name}</h4>
          <span className="text-muted" style={{fontSize:'0.8rem'}}>{MONTHS[month-1]} {year}</span>
        </div>
        {isOver
          ? <AlertTriangle size={20} color="var(--danger-color)" />
          : <CheckCircle size={20} color="var(--success-color)" />
        }
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
          <div className="text-muted" style={{fontSize:'0.75rem'}}>BUDGET</div>
          <div className="budget-amt">{formatCurrency(status.budget)}</div>
        </div>
      </div>

      {isOver && (
        <div className="budget-warning">
          ⚠ Budget exceeded by {formatCurrency(Math.abs(status.remaining))}
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

export default function Budgets() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [categories, setCategories] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ 
    category_id: '', 
    monthString: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`, 
    amount: '' 
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    api.get('/categories?ctype=expense').then(r => setCategories(r.data)).catch(console.error);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const [year, month] = form.monthString.split('-');
      await api.post('/budgets', {
        category_id: parseInt(form.category_id),
        month: parseInt(month),
        year: parseInt(year),
        amount: parseFloat(form.amount),
      });
      setShowModal(false);
      setRefreshKey(k => k + 1);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to set budget.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="budgets-page animate-fade-in">
      <div className="page-header">
        <div>
          <h2>Budgets</h2>
          <p className="text-muted">Set and monitor your spending limits</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setError(''); setShowModal(true); }}>
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
      </div>

      <div className="budget-grid" key={refreshKey}>
        {categories.length === 0 ? (
          <p className="text-muted">Loading categories...</p>
        ) : (
          categories.map(cat => (
            <BudgetCard key={`${cat.id}-${month}-${year}-${refreshKey}`} cat={cat} month={month} year={year} />
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

      {showModal && (
        <Modal title="Set Budget" onClose={() => setShowModal(false)}>
          <form onSubmit={handleSubmit} className="modal-form">
            {error && <div className="auth-error" style={{marginBottom:'1rem'}}>{error}</div>}
            <div className="form-group">
              <label>Expense Category</label>
              <select value={form.category_id} onChange={e => setForm({...form, category_id: e.target.value})} required>
                <option value="">Select category...</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Budget Month & Year</label>
              <input 
                type="month" 
                value={form.monthString} 
                onChange={e => setForm({...form, monthString: e.target.value})} 
                required 
              />
            </div>
            <div className="form-group">
              <label>Budget Amount ({getCurrencySymbol()})</label>
              <input type="number" step="0.01" min="0.01" placeholder="0.00"
                value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} required />
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                <Check size={16} />
                {submitting ? 'Saving...' : 'Set Budget'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
