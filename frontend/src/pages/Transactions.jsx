import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import api from '../api';
import {
  Plus, Pencil, Trash2, X, Check, Camera,
  ArrowUpCircle, ArrowDownCircle, Filter, Download, FileText
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import { formatCurrency, getCurrencySymbol } from '../utils';
import './Transactions.css';

const ITEMS_PER_PAGE = 10;

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
];

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

export default function Transactions() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editTxn, setEditTxn] = useState(null);
  const [form, setForm] = useState({
    category_id: '', amount: '', txn_date: now.toISOString().split('T')[0], description: ''
  });
  const [filterType, setFilterType] = useState('all');
  const [submitting, setSubmitting] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const fileInputRef = React.useRef(null);

  useEffect(() => {
    fetchAll();
  }, [month, year]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filterType, month, year]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [txnsRes, catsRes] = await Promise.all([
        api.get(`/transactions?month=${month}&year=${year}`),
        api.get('/categories'),
      ]);
      setTransactions(txnsRes.data);
      setCategories(catsRes.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const openAdd = () => {
    setEditTxn(null);
    setForm({ category_id: '', amount: '', txn_date: now.toISOString().split('T')[0], description: '' });
    setError('');
    setShowModal(true);
  };

  const openEdit = (t) => {
    setEditTxn(t);
    setForm({ category_id: t.category_id || '', amount: t.amount, txn_date: t.txn_date, description: t.description || '' });
    setError('');
    setShowModal(true);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setScanning(true);
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      // Use standard fetch or api instance if it handles FormData well
      const token = localStorage.getItem('token');
      const res = await fetch('http://127.0.0.1:8000/transactions/scan-receipt', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      
      if (!res.ok) throw new Error("Failed to scan");
      
      const data = await res.json();
      
      setForm({
        category_id: '',
        amount: data.amount ? data.amount.toString() : '',
        txn_date: data.date,
        description: 'Receipt Scan'
      });
      setShowModal(true);
      
    } catch (err) {
      alert("Failed to scan receipt. Please ensure it's a valid image.");
    } finally {
      setScanning(false);
      e.target.value = null; // reset input
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const payload = { ...form, amount: parseFloat(form.amount), category_id: parseInt(form.category_id) };
      if (editTxn) {
        await api.put(`/transactions/${editTxn.id}`, payload);
      } else {
        await api.post('/transactions', payload);
      }
      setShowModal(false);
      fetchAll();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save transaction.');
    } finally {
      setSubmitting(false);
    }
  };

  const exportCSV = () => {
    if (filtered.length === 0) return;
    const headers = ['ID', 'Type', 'Category', 'Description', 'Date', 'Amount (INR)'];
    const rows = filtered.map(t => [
      t.id,
      escapeCsvValue(t.category_type),
      escapeCsvValue(t.category_name),
      escapeCsvValue(t.description),
      escapeCsvValue(t.txn_date),
      escapeCsvValue(t.amount)
    ]);
    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.join(','))
    ].join('\r\n');
    // Prepend UTF-8 BOM so Excel recognizes encoding
    const blob = new Blob(['\uFEFF', csvContent], { type: 'text/csv;charset=utf-8;' });
    downloadBlob(blob, `transactions_${MONTHS[month-1]}_${year}.csv`);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this transaction?')) return;
    await api.delete(`/transactions/${id}`);
    fetchAll();
  };

  const downloadBlob = (blob, fileName) => {
    try {
      // IE / Edge fallback
      if (window.navigator && window.navigator.msSaveOrOpenBlob) {
        window.navigator.msSaveOrOpenBlob(blob, fileName);
        return;
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.style.display = 'none';
      link.href = url;
      link.download = fileName;
      link.target = '_blank';
      document.body.appendChild(link);
      if (typeof link.click === 'function') {
        link.click();
      } else {
        link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
      }
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 100);
    } catch (err) {
      console.error('downloadBlob error:', err);
      alert('Download failed: ' + (err?.message || err));
    }
  };

  const escapeCsvValue = (value) => {
    const stringValue = value == null ? '' : String(value);
    return `"${stringValue.replace(/"/g, '""')}"`;
  };

  const filtered = filterType === 'all'
    ? transactions
    : transactions.filter(t => t.category_type === filterType);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paginated = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const exportPDF = () => {
    if (filtered.length === 0) return;
    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.text("FinanceOS - Transactions Report", 14, 22);
    
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Period: ${MONTHS[month-1]} ${year} | Filter: ${filterType.toUpperCase()}`, 14, 30);
    
    const tableData = filtered.map(t => [
      t.txn_date,
      t.category_type.toUpperCase(),
      t.category_name,
      t.description || '—',
      formatCurrency(t.amount)
    ]);

    autoTable(doc, {
      startY: 36,
      head: [['Date', 'Type', 'Category', 'Description', 'Amount']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [99, 102, 241] },
      alternateRowStyles: { fillColor: [250, 250, 250] },
      styles: { fontSize: 9 }
    });

    try {
      doc.save(`financeos_report_${MONTHS[month-1]}_${year}.pdf`);
    } catch (err) {
      console.error('PDF save failed, falling back to blob download:', err);
      try {
        const pdfBlob = doc.output('blob');
        downloadBlob(pdfBlob, `financeos_report_${MONTHS[month-1]}_${year}.pdf`);
      } catch (err2) {
        console.error('PDF blob fallback failed:', err2);
        alert('PDF export failed: ' + (err2?.message || err2));
      }
    }
  };

  const getCatType = (catId) => {
    const cat = categories.find(c => c.id === parseInt(catId));
    return cat?.type || 'expense';
  };

  return (
    <div className="transactions-page animate-fade-in">
      <div className="page-header">
        <div>
          <h2>Transactions</h2>
          <p className="text-muted">Track your income and expenses</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-secondary" onClick={exportPDF} disabled={filtered.length === 0} title="Export PDF">
            <FileText size={16} /> PDF
          </button>
          <button className="btn btn-secondary" onClick={exportCSV} disabled={filtered.length === 0} title="Export CSV">
            <Download size={16} /> CSV
          </button>
          <input 
            type="file" 
            accept="image/*" 
            ref={fileInputRef} 
            style={{ display: 'none' }} 
            onChange={handleFileUpload} 
          />
          <button className="btn btn-secondary" onClick={() => fileInputRef.current?.click()} disabled={scanning}>
            <Camera size={16} /> {scanning ? 'Scanning...' : 'Scan Receipt'}
          </button>
          <button className="btn btn-primary" onClick={openAdd}>
            <Plus size={16} /> Add Transaction
          </button>
        </div>
      </div>

      <div className="txn-controls glass-panel">
        <div className="txn-filters">
          <Filter size={16} className="text-muted" />
          <select value={month} onChange={e => setMonth(Number(e.target.value))}>
            {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <select value={year} onChange={e => setYear(Number(e.target.value))}>
            {[2023, 2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <div className="type-filter">
            {['all','income','expense'].map(t => (
              <button key={t} className={`type-btn ${filterType === t ? 'type-btn--active' : ''}`}
                onClick={() => setFilterType(t)}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <span className="text-muted" style={{fontSize:'0.85rem'}}>
          {filtered.length} record{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {loading ? (
        <div className="loading-state text-muted">Loading transactions...</div>
      ) : filtered.length === 0 ? (
        <div className="empty-state glass-panel">
          <p className="text-muted">No transactions found. Click "Add Transaction" to get started.</p>
        </div>
      ) : (
        <div className="glass-panel txn-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Category</th>
                <th>Description</th>
                <th>Date</th>
                <th>Amount</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map(t => (
                <tr key={t.id}>
                  <td>
                    <span className={`txn-badge ${t.category_type === 'income' ? 'badge-income' : 'badge-expense'}`}>
                      {t.category_type === 'income'
                        ? <ArrowUpCircle size={13} />
                        : <ArrowDownCircle size={13} />}
                      {t.category_type}
                    </span>
                  </td>
                  <td>{t.category_name}</td>
                  <td className="text-muted">{t.description || '—'}</td>
                  <td className="text-muted">{t.txn_date}</td>
                  <td className={t.category_type === 'income' ? 'text-success' : 'text-danger'} style={{fontWeight:600}}>
                    {t.category_type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                  </td>
                  <td>
                    <div className="action-btns">
                      <button className="btn btn-secondary icon-btn" onClick={() => openEdit(t)} title="Edit">
                        <Pencil size={14} />
                      </button>
                      <button className="btn btn-danger icon-btn" onClick={() => handleDelete(t.id)} title="Delete">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {totalPages > 1 && (
            <div className="pagination-controls">
              <button 
                className="btn btn-secondary" 
                disabled={currentPage === 1} 
                onClick={() => setCurrentPage(p => p - 1)}
              >
                Prev
              </button>
              <span className="text-muted" style={{ fontSize: '0.9rem' }}>
                Page {currentPage} of {totalPages}
              </span>
              <button 
                className="btn btn-secondary" 
                disabled={currentPage === totalPages} 
                onClick={() => setCurrentPage(p => p + 1)}
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}

      {showModal && (
        <Modal title={editTxn ? 'Edit Transaction' : 'Add Transaction'} onClose={() => setShowModal(false)}>
          <form onSubmit={handleSubmit} className="modal-form">
            {error && <div className="auth-error" style={{marginBottom:'1rem'}}>{error}</div>}
            <div className="form-group">
              <label>Category</label>
              <select value={form.category_id} onChange={e => setForm({...form, category_id: e.target.value})} required>
                <option value="">Select category...</option>
                {['income','expense'].map(type => (
                  <optgroup key={type} label={type.charAt(0).toUpperCase() + type.slice(1)}>
                    {categories.filter(c => c.type === type).map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Amount ({getCurrencySymbol()})</label>
              <input type="number" step="0.01" min="0.01" placeholder="0.00"
                value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} required />
            </div>
            <div className="form-group">
              <label>Date</label>
              <input type="date" value={form.txn_date}
                onChange={e => setForm({...form, txn_date: e.target.value})} required />
            </div>
            <div className="form-group">
              <label>Description (optional)</label>
              <input type="text" placeholder="Add a note..."
                value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                <Check size={16} />
                {submitting ? 'Saving...' : editTxn ? 'Update' : 'Add Transaction'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
