import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import {
  Users, Plus, X, Check, Trash2, UserPlus,
  Receipt, ArrowLeftRight, ChevronRight, ChevronLeft
} from 'lucide-react';
import { formatCurrency, getCurrencySymbol } from '../utils';
import './Split.css';

function Modal({ title, onClose, children }) {
  return ReactDOM.createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card glass-panel" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="btn btn-secondary modal-close" onClick={onClose}><X size={16}/></button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}

export default function Split() {
  const { user } = useAuth();
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [members, setMembers] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [balances, setBalances] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showMemberModal, setShowMemberModal] = useState(false);

  // Forms
  const [groupForm, setGroupForm] = useState({ name: '', description: '' });
  const [expenseForm, setExpenseForm] = useState({
    description: '', amount: '', expense_date: new Date().toISOString().split('T')[0],
    paid_by: '', split_with: []
  });
  const [memberUsername, setMemberUsername] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { fetchGroups(); }, []);

  const fetchGroups = async () => {
    setLoading(true);
    try {
      const res = await api.get('/split/groups');
      setGroups(res.data);
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  };

  const fetchGroupDetail = async (group) => {
    setSelectedGroup(group);
    try {
      const [membRes, expRes, balRes] = await Promise.all([
        api.get(`/split/groups/${group.id}/members`),
        api.get(`/split/groups/${group.id}/expenses`),
        api.get(`/split/groups/${group.id}/balances`),
      ]);
      setMembers(membRes.data);
      setExpenses(expRes.data);
      setBalances(balRes.data);
      // Default paid_by to current user
      setExpenseForm(f => ({ ...f, paid_by: String(user?.id || ''), split_with: membRes.data.map(m => m.id) }));
    } catch(e) { console.error(e); }
  };

  const handleCreateGroup = async (e) => {
    e.preventDefault(); setSubmitting(true); setError('');
    try {
      await api.post('/split/groups', groupForm);
      setShowGroupModal(false);
      setGroupForm({ name: '', description: '' });
      fetchGroups();
    } catch(err) { setError(err.response?.data?.detail || 'Failed'); }
    finally { setSubmitting(false); }
  };

  const handleAddMember = async (e) => {
    e.preventDefault(); setSubmitting(true); setError('');
    try {
      await api.post(`/split/groups/${selectedGroup.id}/members`, { username: memberUsername });
      setMemberUsername('');
      setShowMemberModal(false);
      fetchGroupDetail(selectedGroup);
    } catch(err) { setError(err.response?.data?.detail || 'User not found'); }
    finally { setSubmitting(false); }
  };

  const handleAddExpense = async (e) => {
    e.preventDefault(); setSubmitting(true); setError('');
    try {
      await api.post(`/split/groups/${selectedGroup.id}/expenses`, {
        ...expenseForm,
        amount: parseFloat(expenseForm.amount),
        paid_by: parseInt(expenseForm.paid_by),
        split_with: expenseForm.split_with.map(Number),
      });
      setShowExpenseModal(false);
      fetchGroupDetail(selectedGroup);
    } catch(err) { setError(err.response?.data?.detail || 'Failed to add expense'); }
    finally { setSubmitting(false); }
  };

  const handleSettle = async (expenseId, userId) => {
    try {
      await api.post(`/split/expenses/${expenseId}/settle`, { user_id: userId });
      fetchGroupDetail(selectedGroup);
    } catch(e) { console.error(e); }
  };

  const handleDeleteGroup = async (groupId) => {
    if (!window.confirm('Delete this group and all its expenses?')) return;
    try {
      await api.delete(`/split/groups/${groupId}`);
      setSelectedGroup(null);
      fetchGroups();
    } catch(e) { alert('Only the group owner can delete.'); }
  };

  const toggleSplitWith = (uid) => {
    setExpenseForm(f => ({
      ...f,
      split_with: f.split_with.includes(uid)
        ? f.split_with.filter(id => id !== uid)
        : [...f.split_with, uid]
    }));
  };

  if (loading) return <div className="loading-state">Loading groups...</div>;

  // Group list view
  if (!selectedGroup) return (
    <div className="split-page animate-fade-in">
      <div className="page-header">
        <div>
          <h2>Split Expenses</h2>
          <p className="text-muted">Share and settle expenses with friends</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setError(''); setShowGroupModal(true); }}>
          <Plus size={16}/> New Group
        </button>
      </div>

      {groups.length === 0 ? (
        <div className="split-empty glass-panel">
          <Users size={48} className="text-muted" style={{marginBottom:'1rem'}}/>
          <h3>No groups yet</h3>
          <p className="text-muted">Create a group to start splitting expenses with friends.</p>
          <button className="btn btn-primary" style={{marginTop:'1rem'}} onClick={() => setShowGroupModal(true)}>
            <Plus size={16}/> Create First Group
          </button>
        </div>
      ) : (
        <div className="split-groups-grid">
          {groups.map(g => (
            <div key={g.id} className="split-group-card glass-panel" onClick={() => fetchGroupDetail(g)}>
              <div className="split-group-card-header">
                <div className="split-group-icon"><Users size={20}/></div>
                <h4>{g.name}</h4>
              </div>
              {g.description && <p className="text-muted split-group-desc">{g.description}</p>}
              <div className="split-group-meta">
                <span className="split-meta-badge"><Users size={12}/> {g.member_count} members</span>
                <span className="split-meta-badge"><Receipt size={12}/> {g.expense_count} expenses</span>
              </div>
              <div className="split-group-arrow"><ChevronRight size={18}/></div>
            </div>
          ))}
        </div>
      )}

      {showGroupModal && (
        <Modal title="Create Group" onClose={() => setShowGroupModal(false)}>
          <form onSubmit={handleCreateGroup} className="modal-form">
            {error && <div className="auth-error">{error}</div>}
            <div className="form-group">
              <label>Group Name</label>
              <input placeholder="e.g. Goa Trip 2026" value={groupForm.name}
                onChange={e => setGroupForm({...groupForm, name: e.target.value})} required/>
            </div>
            <div className="form-group">
              <label>Description (optional)</label>
              <input placeholder="What is this group for?" value={groupForm.description}
                onChange={e => setGroupForm({...groupForm, description: e.target.value})}/>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setShowGroupModal(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                <Check size={16}/> {submitting ? 'Creating...' : 'Create Group'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );

  // Group Detail View
  return (
    <div className="split-page animate-fade-in">
      <div className="page-header">
        <div style={{display:'flex', alignItems:'center', gap:'0.75rem'}}>
          <button className="btn btn-secondary" style={{padding:'0.5rem'}} onClick={() => setSelectedGroup(null)}>
            <ChevronLeft size={18}/>
          </button>
          <div>
            <h2>{selectedGroup.name}</h2>
            <p className="text-muted">{selectedGroup.description || 'Split group'}</p>
          </div>
        </div>
        <div style={{display:'flex', gap:'0.5rem', flexWrap:'wrap'}}>
          <button className="btn btn-secondary" onClick={() => { setError(''); setShowMemberModal(true); }}>
            <UserPlus size={15}/> Add Member
          </button>
          <button className="btn btn-primary" onClick={() => { setError(''); setShowExpenseModal(true); }}>
            <Plus size={15}/> Add Expense
          </button>
          <button className="btn btn-danger" style={{padding:'0.55rem 0.85rem'}} onClick={() => handleDeleteGroup(selectedGroup.id)}>
            <Trash2 size={15}/>
          </button>
        </div>
      </div>

      <div className="split-detail-grid">
        {/* Balances */}
        <div className="glass-panel split-balances-card">
          <h3 className="split-section-title"><ArrowLeftRight size={16}/> Balances</h3>
          {balances.length === 0 ? (
            <p className="text-muted" style={{fontSize:'0.85rem'}}>No balances yet.</p>
          ) : (
            <div className="balance-list">
              {balances.map(b => (
                <div key={b.user_id} className="balance-row">
                  <span className="balance-name">{b.username}</span>
                  <span className={`balance-amount ${b.balance >= 0 ? 'text-success' : 'text-danger'}`}>
                    {b.balance >= 0 ? '+' : ''}{formatCurrency(Math.abs(b.balance))}
                    <span className="balance-hint text-muted">
                      {b.balance > 0 ? ' gets back' : b.balance < 0 ? ' owes' : ' settled'}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          )}

          <h3 className="split-section-title" style={{marginTop:'1.5rem'}}><Users size={16}/> Members</h3>
          <div className="member-chips">
            {members.map(m => (
              <span key={m.id} className="member-chip">{m.username}</span>
            ))}
          </div>
        </div>

        {/* Expenses */}
        <div className="split-expenses-list">
          {expenses.length === 0 ? (
            <div className="empty-state glass-panel">
              <p className="text-muted">No expenses yet. Click "Add Expense" to get started.</p>
            </div>
          ) : (
            expenses.map(exp => (
              <div key={exp.id} className="glass-panel split-expense-card">
                <div className="split-expense-header">
                  <div>
                    <p className="split-expense-desc">{exp.description}</p>
                    <p className="text-muted" style={{fontSize:'0.8rem'}}>
                      Paid by <strong>{exp.paid_by_name}</strong> · {new Date(exp.expense_date).toLocaleDateString('en-IN')}
                    </p>
                  </div>
                  <span className="split-expense-amount">{formatCurrency(exp.amount)}</span>
                </div>
                <div className="split-participants">
                  {exp.participants.map(p => (
                    <div key={p.id} className={`split-participant ${p.settled ? 'settled' : ''}`}>
                      <span>{p.username}</span>
                      <span className="text-muted">{formatCurrency(p.share)}</span>
                      {p.settled ? (
                        <span className="settled-badge">✓ Settled</span>
                      ) : (
                        <button className="btn-settle" onClick={() => handleSettle(exp.id, p.id)}>
                          Mark Settled
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Add Member Modal */}
      {showMemberModal && (
        <Modal title="Add Member" onClose={() => setShowMemberModal(false)}>
          <form onSubmit={handleAddMember} className="modal-form">
            {error && <div className="auth-error">{error}</div>}
            <div className="form-group">
              <label>Username</label>
              <input placeholder="Enter username of registered user" value={memberUsername}
                onChange={e => setMemberUsername(e.target.value)} required/>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setShowMemberModal(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                <UserPlus size={16}/> {submitting ? 'Adding...' : 'Add Member'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Add Expense Modal */}
      {showExpenseModal && (
        <Modal title="Add Expense" onClose={() => setShowExpenseModal(false)}>
          <form onSubmit={handleAddExpense} className="modal-form">
            {error && <div className="auth-error">{error}</div>}
            <div className="form-group">
              <label>Description</label>
              <input placeholder="e.g. Dinner at restaurant" value={expenseForm.description}
                onChange={e => setExpenseForm({...expenseForm, description: e.target.value})} required/>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Amount ({getCurrencySymbol()})</label>
                <input type="number" step="0.01" min="0.01" placeholder="0.00"
                  value={expenseForm.amount}
                  onChange={e => setExpenseForm({...expenseForm, amount: e.target.value})} required/>
              </div>
              <div className="form-group">
                <label>Date</label>
                <input type="date" value={expenseForm.expense_date}
                  onChange={e => setExpenseForm({...expenseForm, expense_date: e.target.value})} required/>
              </div>
            </div>
            <div className="form-group">
              <label>Paid By</label>
              <select value={expenseForm.paid_by} onChange={e => setExpenseForm({...expenseForm, paid_by: e.target.value})} required>
                <option value="">Select who paid</option>
                {members.map(m => <option key={m.id} value={m.id}>{m.username}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Split With</label>
              <div className="split-checkboxes">
                {members.map(m => (
                  <label key={m.id} className="split-checkbox-item">
                    <input type="checkbox" checked={expenseForm.split_with.includes(m.id)}
                      onChange={() => toggleSplitWith(m.id)}/>
                    {m.username}
                  </label>
                ))}
              </div>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setShowExpenseModal(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                <Check size={16}/> {submitting ? 'Adding...' : 'Add Expense'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
