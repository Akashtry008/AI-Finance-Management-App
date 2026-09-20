import React, { useEffect, useState, useMemo } from 'react';
import ReactDOM from 'react-dom';
import api from '../api';
import {
  Plus, Pencil, Trash2, X, Check, Camera,
  ArrowUpCircle, ArrowDownCircle, Filter, Download, FileText,
  Receipt, Sparkles, MessageCircle, FileDown, FileSpreadsheet,
  Car, Hash, Tag, Share2, CheckCircle2
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import {
  formatCurrency, getCurrencySymbol, buildWhatsAppShareUrl,
  exportTableToExcel, formatErrorMessage
} from '../utils';
import { useDialog } from '../context/DialogContext';
import InstantReceiptModal from '../components/InstantReceiptModal';
import ExportReportModal from '../components/ExportReportModal';
import CsvImportModal from '../components/CsvImportModal';
import MileageCalculatorModal from '../components/MileageCalculatorModal';
import './Transactions.css';

const ITEMS_PER_PAGE = 10;

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
];

const FALLBACK_CATEGORIES = [
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
  { id: 13, name: 'Salary & Wages', type: 'income' },
  { id: 14, name: 'Freelance & Consulting', type: 'income' },
  { id: 15, name: 'Investments & Dividends', type: 'income' },
  { id: 16, name: 'Other Income', type: 'income' },
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
  const { showConfirm, showAlert } = useDialog();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState(FALLBACK_CATEGORIES);
  const displayCategories = (categories && categories.length > 0) ? categories : FALLBACK_CATEGORIES;
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editTxn, setEditTxn] = useState(null);
  const [form, setForm] = useState({
    category_id: '', amount: '', txn_date: now.toISOString().split('T')[0], description: '', tags: '', split_group_id: ''
  });
  const [splitGroups, setSplitGroups] = useState([]);
  const [showMerchantSuggestions, setShowMerchantSuggestions] = useState(false);
  const [filterType, setFilterType] = useState('all');
  const [submitting, setSubmitting] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [selectedTag, setSelectedTag] = useState(null);
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [showMileageModal, setShowMileageModal] = useState(false);
  const [scanBanner, setScanBanner] = useState(null);
  const fileInputRef = React.useRef(null);

  useEffect(() => {
    fetchAll();
  }, [month, year]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filterType, selectedTag, month, year]);

  async function fetchAll() {
    setLoading(true);
    try {
      const [txnsRes, catsRes, groupsRes] = await Promise.all([
        api.get(`/transactions?month=${month}&year=${year}`),
        api.get('/categories').catch(() => ({ data: [] })),
        api.get('/split/groups').catch(() => ({ data: [] })),
      ]);
      setTransactions(txnsRes.data);
      if (catsRes.data && catsRes.data.length > 0) {
        setCategories(catsRes.data);
      } else {
        setCategories(FALLBACK_CATEGORIES);
      }
      setSplitGroups(groupsRes.data || []);
    } catch (e) {
      console.error(e);
      setCategories(FALLBACK_CATEGORIES);
    } finally {
      setLoading(false);
    }
  };

  const merchantStats = useMemo(() => {
    const map = {};
    transactions.forEach(t => {
      const desc = (t.description || '').trim();
      if (desc && !desc.startsWith('#') && desc.length > 1) {
        const key = desc.toLowerCase();
        if (!map[key]) {
          map[key] = { name: desc, count: 0, category_id: t.category_id, category_name: t.category_name, amount: t.amount };
        }
        map[key].count += 1;
        map[key].category_id = t.category_id;
        map[key].category_name = t.category_name;
        map[key].amount = t.amount;
      }
    });
    return Object.values(map).sort((a, b) => b.count - a.count);
  }, [transactions]);

  const matchedMerchants = useMemo(() => {
    if (!form.description || form.description.length < 1) return [];
    const q = form.description.toLowerCase().trim();
    return merchantStats.filter(m => m.name.toLowerCase().includes(q) && m.name.toLowerCase() !== q).slice(0, 5);
  }, [form.description, merchantStats]);

  const selectMerchant = (m) => {
    setForm(prev => ({
      ...prev,
      description: m.name,
      category_id: prev.category_id || String(m.category_id),
      amount: prev.amount ? prev.amount : String(m.amount)
    }));
    setShowMerchantSuggestions(false);
  };

  const addQuickTag = (tag) => {
    const clean = tag.replace('#', '');
    const currentTags = form.tags ? form.tags.split(',').map(s => s.trim()).filter(Boolean) : [];
    if (!currentTags.includes(clean)) {
      currentTags.push(clean);
      setForm(prev => ({ ...prev, tags: currentTags.join(', ') }));
    }
  };

  const openAdd = () => {
    setEditTxn(null);
    setForm({ category_id: '', amount: '', txn_date: now.toISOString().split('T')[0], description: '', tags: '', split_group_id: '' });
    setScanBanner(null);
    setError('');
    setShowMerchantSuggestions(false);
    setShowModal(true);
  };

  const openEdit = (t) => {
    setEditTxn(t);
    setForm({ category_id: t.category_id || '', amount: t.amount, txn_date: t.txn_date, description: t.description || '', tags: t.tags || '', split_group_id: '' });
    setScanBanner(null);
    setError('');
    setShowMerchantSuggestions(false);
    setShowModal(true);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setScanning(true);
    setError('');
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const res = await api.post('/transactions/scan-receipt', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      const data = res.data;
      
      let matchedCatId = data.category_id ? String(data.category_id) : '';
      if (!matchedCatId && data.category_name) {
        const found = displayCategories.find(c => 
          c.type === 'expense' && 
          (c.name.toLowerCase() === data.category_name.toLowerCase() || 
           c.name.toLowerCase().includes(data.category_name.toLowerCase()) ||
           data.category_name.toLowerCase().includes(c.name.toLowerCase()))
        );
        if (found) matchedCatId = String(found.id);
      }
      if (!matchedCatId) {
        const firstExpense = displayCategories.find(c => c.type === 'expense');
        if (firstExpense) matchedCatId = String(firstExpense.id);
      }

      setForm(prev => ({
        ...prev,
        category_id: matchedCatId,
        amount: data.amount ? data.amount.toString() : prev.amount,
        txn_date: data.date || prev.txn_date || new Date().toISOString().split('T')[0],
        description: data.description || data.merchant || prev.description || 'Receipt Scan',
        tags: data.tags || '#receipt-scan'
      }));
      setScanBanner({
        merchant: data.merchant || 'Detected Merchant',
        amount: data.amount,
        date: data.date,
        category: data.category_name || 'Expense'
      });
      setShowModal(true);
      
    } catch (err) {
      showAlert({
        title: 'Receipt Scan Failed',
        message: formatErrorMessage(err, "Failed to scan receipt. Please ensure it's a clear photo of a bill or invoice."),
        type: 'danger',
      });
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
      const payload = {
        amount: parseFloat(form.amount),
        category_id: parseInt(form.category_id),
        txn_date: form.txn_date,
        description: form.description || '',
        tags: form.tags || ''
      };
      if (editTxn) {
        await api.put(`/transactions/${editTxn.id}`, payload);
      } else if (form.split_group_id) {
        await api.post(`/split/groups/${form.split_group_id}/expenses`, {
          description: form.description || 'Group Expense',
          amount: parseFloat(form.amount),
          expense_date: form.txn_date,
        });
      } else {
        await api.post('/transactions', payload);
      }
      setShowModal(false);
      setForm({ category_id: '', amount: '', txn_date: now.toISOString().split('T')[0], description: '', tags: '', split_group_id: '' });
      fetchAll();
    } catch (err) {
      setError(formatErrorMessage(err, 'Something went wrong'));
    } finally {
      setSubmitting(false);
    }
  };

  const exportExcelTable = () => {
    if (filtered.length === 0) return;
    setExportingExcel(true);
    try {
      const activeCurr = localStorage.getItem('finance-os-currency') || 'INR';
      const totalIncome = filtered.filter(t => t.category_type === 'income').reduce((s, t) => s + Number(t.amount || 0), 0);
      const totalExpense = filtered.filter(t => t.category_type === 'expense').reduce((s, t) => s + Number(t.amount || 0), 0);
      const netCashflow = totalIncome - totalExpense;

      const secMeta = {
        title: "1. TRANSACTION LEDGER SUMMARY",
        headers: ["Reporting Period", "Filter Applied", "Total Records", "Active Currency"],
        rows: [[`${MONTHS[month-1]} ${year}`, filterType.toUpperCase(), filtered.length, activeCurr]]
      };

      const secLedger = {
        title: "2. ITEMIZED TRANSACTION REGISTER",
        headers: ["ID", "Date", "Type", "Category", "Description", `Amount (${activeCurr})`],
        rows: filtered.map(t => [
          t.id,
          t.txn_date,
          t.category_type.toUpperCase(),
          t.category_name,
          t.description || '—',
          t.amount
        ]),
        summary: ["TOTAL NET CASHFLOW", "—", "—", "—", `Income: +${totalIncome.toFixed(2)} | Expense: -${totalExpense.toFixed(2)}`, netCashflow]
      };

      exportTableToExcel(`FinanceOS_Transactions_${MONTHS[month-1]}_${year}`, {
        title: `FinanceOS — Transactions Ledger (${MONTHS[month-1]} ${year})`,
        subtitle: `Filter: ${filterType.toUpperCase()}`,
        sections: [secMeta, secLedger],
        activeCurr
      });
      setShowExportModal(false);
    } catch (err) {
      console.error('Excel export failed:', err);
      showAlert({
        title: 'Excel Export Failed',
        message: formatErrorMessage(err),
        type: 'danger',
      });
    } finally {
      setExportingExcel(false);
    }
  };

  const handleShareWhatsApp = () => {
    const activeCurr = localStorage.getItem('finance-os-currency') || 'INR';
    const totalIncome = filtered.filter(t => t.category_type === 'income').reduce((s, t) => s + Number(t.amount || 0), 0);
    const totalExpense = filtered.filter(t => t.category_type === 'expense').reduce((s, t) => s + Number(t.amount || 0), 0);
    const netCashflow = totalIncome - totalExpense;

    const text = `🧾 *FinanceOS Transactions Summary — ${MONTHS[month-1]} ${year}*
━━━━━━━━━━━━━━━━━━━━
📊 *Filter:* ${filterType.toUpperCase()}
📝 *Transactions Count:* ${filtered.length}
💵 *Total Income:* ${formatCurrency(totalIncome, activeCurr)}
💳 *Total Expenses:* ${formatCurrency(totalExpense, activeCurr)}
💰 *Net Cash Flow:* ${netCashflow >= 0 ? '+' : ''}${formatCurrency(netCashflow, activeCurr)}
━━━━━━━━━━━━━━━━━━━━
✨ Tracked with *FinanceOS* (100% Free & Unlimited Alternative to Splitwise & Mint)`;

    window.open(buildWhatsAppShareUrl(text), '_blank', 'noopener,noreferrer');
  };

  const handleDelete = async (id) => {
    const confirmed = await showConfirm({
      title: 'Delete Transaction',
      message: 'Are you sure you want to delete this transaction?',
      confirmText: 'Delete',
      cancelText: 'Keep',
      isDanger: true,
    });
    if (!confirmed) return;
    await api.delete(`/transactions/${id}`);
    fetchAll();
  };

  const extractedTags = useMemo(() => {
    const map = {};
    transactions.forEach(t => {
      const desc = t.description || '';
      const tagsField = t.tags || '';
      const combined = `${desc} ${tagsField}`;
      const descTags = combined.match(/#[\w\d_-]+/g) || [];
      const commaTags = tagsField.split(',').map(s => s.trim()).filter(Boolean).map(s => s.startsWith('#') ? s : `#${s}`);
      const allTags = Array.from(new Set([...descTags, ...commaTags]));

      allTags.forEach(rawTag => {
        const key = rawTag.toLowerCase();
        if (!map[key]) {
          map[key] = { key, displayTag: rawTag, count: 0, totalExpense: 0 };
        }
        map[key].count += 1;
        if (t.category_type === 'expense') {
          map[key].totalExpense += parseFloat(t.amount) || 0;
        }
      });
    });
    return Object.values(map);
  }, [transactions]);

  let filtered = filterType === 'all'
    ? transactions
    : transactions.filter(t => t.category_type === filterType);

  if (selectedTag) {
    const cleanTag = selectedTag.replace('#', '').toLowerCase();
    filtered = filtered.filter(t =>
      (t.description || '').toLowerCase().includes(selectedTag.toLowerCase()) ||
      (t.tags || '').toLowerCase().includes(cleanTag)
    );
  }

  const bundleTotal = filtered.reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
  const bundleAvg = filtered.length > 0 ? (bundleTotal / filtered.length) : 0;

  const handleShareEventBundleWhatsApp = () => {
    const activeCurr = localStorage.getItem('finance-os-currency') || 'INR';
    const text = `🎉 *Event Expense Bundle: ${selectedTag}*
━━━━━━━━━━━━━━━━━━━━
📊 *Total Spending:* ${formatCurrency(bundleTotal, activeCurr)}
📝 *Transactions Count:* ${filtered.length}
📈 *Average per Entry:* ${formatCurrency(bundleAvg, activeCurr)}
📅 *Period:* ${MONTHS[month-1]} ${year}

*Itemized Breakdown:*
${filtered.slice(0, 15).map((t, idx) => `${idx + 1}. ${t.description} — ${formatCurrency(t.amount, activeCurr)} (${t.txn_date})`).join('\n')}

━━━━━━━━━━━━━━━━━━━━
✨ Tracked with *FinanceOS* (100% Free & Unlimited Personal Finance Platform)`;
    window.open(buildWhatsAppShareUrl(text), '_blank', 'noopener,noreferrer');
  };

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paginated = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const exportPDF = () => {
    if (filtered.length === 0) return;
    setExportingPdf(true);
    try {
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

      doc.save(`financeos_report_${MONTHS[month-1]}_${year}.pdf`);
      setShowExportModal(false);
    } catch (err) {
      console.error('PDF save failed:', err);
      showAlert({
        title: 'PDF Export Failed',
        message: formatErrorMessage(err),
        type: 'danger',
      });
    } finally {
      setExportingPdf(false);
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
          <p className="text-muted">Track your income and expenses with instant digital vouchers</p>
        </div>
        <div className="txn-action-buttons">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setShowMileageModal(true)}
            title="Calculate distance reimbursement and auto-log travel (#Mileage)"
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <Car size={15} /> Mileage
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setShowCsvModal(true)}
            title="Batch import Splitwise, bank, or spreadsheet CSV"
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <FileSpreadsheet size={15} /> Import CSV
          </button>
          <button 
            className="btn btn-whatsapp" 
            onClick={handleShareWhatsApp} 
            disabled={filtered.length === 0} 
            title="Share Transactions Summary via WhatsApp"
          >
            <MessageCircle size={15} /> WhatsApp
          </button>
          <button 
            className="btn btn-secondary" 
            onClick={() => setShowExportModal(true)} 
            disabled={filtered.length === 0} 
            title="Export Report (PDF or Excel Table)"
          >
            <FileDown size={16} /> Export Report
          </button>
          <input 
            type="file" 
            accept="image/*" 
            ref={fileInputRef} 
            style={{ display: 'none' }} 
            onChange={handleFileUpload} 
          />
          <button className="btn btn-secondary" onClick={() => fileInputRef.current?.click()} disabled={scanning}>
            <Camera size={16} />
            {scanning ? 'Scanning...' : 'Scan Receipt'}
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

      {/* Feature 4: Hashtag & Event Expense Bundles Filter Bar */}
      {extractedTags.length > 0 && (
        <div className="hashtag-chips-bar glass-panel animate-fade-in">
          <div className="hashtag-chips-label">
            <Hash size={14} color="var(--accent-color)" />
            <span>Event Bundles:</span>
          </div>
          <div className="hashtag-chips-scroll">
            <button
              type="button"
              className={`hashtag-chip ${selectedTag === null ? 'active' : ''}`}
              onClick={() => setSelectedTag(null)}
            >
              All
            </button>
            {extractedTags.map(tagObj => (
              <button
                key={tagObj.key}
                type="button"
                className={`hashtag-chip ${selectedTag === tagObj.key ? 'active' : ''}`}
                onClick={() => setSelectedTag(selectedTag === tagObj.key ? null : tagObj.key)}
              >
                <span>{tagObj.displayTag}</span>
                <span className="hashtag-chip-count">{tagObj.count}</span>
                {tagObj.totalExpense > 0 && (
                  <span className="hashtag-chip-total">({formatCurrency(tagObj.totalExpense)})</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Event Bundle Highlight Card */}
      {selectedTag && (
        <div className="event-bundle-banner glass-panel animate-fade-in">
          <div className="bundle-banner-left">
            <div className="bundle-tag-pill">
              <Hash size={15} />
              <span>{selectedTag}</span>
            </div>
            <div className="bundle-stats">
              <span>Total: <strong>{formatCurrency(bundleTotal)}</strong></span>
              <span className="bundle-stat-dot">•</span>
              <span>Count: <strong>{filtered.length} entries</strong></span>
              <span className="bundle-stat-dot">•</span>
              <span>Avg: <strong>{formatCurrency(bundleAvg)}</strong></span>
            </div>
          </div>

          <div className="bundle-banner-right">
            <button
              type="button"
              className="btn btn-whatsapp btn-sm"
              onClick={handleShareEventBundleWhatsApp}
              title="Share event breakdown via WhatsApp"
              style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
            >
              <MessageCircle size={14} /> Share Bundle
            </button>
            <button
              type="button"
              className="bundle-close-btn"
              onClick={() => setSelectedTag(null)}
              title="Clear event filter"
            >
              <X size={15} />
            </button>
          </div>
        </div>
      )}

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
                  <td style={{ fontWeight: 600 }}>
                    {t.category_name || '—'}
                  </td>
                  <td className="text-muted txn-desc-cell">
                    <span>{t.description || '—'}</span>
                    {t.tags && (
                      <div className="txn-tags-row">
                        {t.tags.split(',').map(tag => tag.trim()).filter(Boolean).map(tag => {
                          const display = tag.startsWith('#') ? tag : `#${tag}`;
                          return (
                            <span
                              key={tag}
                              className="txn-tag-badge"
                              onClick={() => setSelectedTag(selectedTag === display.toLowerCase() ? null : display.toLowerCase())}
                              title="Filter by this tag"
                            >
                              {display}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </td>
                  <td className="text-muted" style={{ fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                    {t.txn_date}
                  </td>
                  <td className={t.category_type === 'income' ? 'text-success' : 'text-danger'} style={{fontWeight:600, whiteSpace: 'nowrap'}}>
                    {t.category_type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                  </td>
                  <td>
                    <div className="action-btns">
                      <button
                        className="btn btn-secondary icon-btn receipt-btn"
                        onClick={() => setSelectedReceipt({
                          id: t.id,
                          type: t.category_type,
                          category: t.category_name,
                          description: t.description,
                          amount: t.amount,
                          date: t.txn_date,
                          currency: localStorage.getItem('finance-os-currency') || 'INR'
                        })}
                        title="View Instant Digital Receipt & Share"
                      >
                        <Receipt size={14} />
                      </button>
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

            {!editTxn && (
              <div className="modal-scan-receipt-banner" style={{
                marginBottom: '1.25rem',
                padding: '0.85rem 1rem',
                background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(16, 185, 129, 0.1))',
                border: '1px dashed rgba(99, 102, 241, 0.4)',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '0.75rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <Sparkles size={18} color="#6366f1" />
                  <div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-color)' }}>
                      Auto-fill from Bill or Receipt
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      AI reads merchant, total amount, date & category
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ fontSize: '0.8rem', padding: '0.4rem 0.85rem' }}
                  onClick={() => fileInputRef.current?.click()}
                  disabled={scanning}
                >
                  <Camera size={14} />
                  <span>{scanning ? 'Scanning...' : 'Upload Bill Photo'}</span>
                </button>
              </div>
            )}

            {scanBanner && (
              <div style={{
                marginBottom: '1rem',
                padding: '0.7rem 0.9rem',
                background: 'rgba(16, 185, 129, 0.12)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                borderRadius: '8px',
                fontSize: '0.82rem',
                color: '#a7f3d0',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <CheckCircle2 size={16} color="#10b981" />
                <span>
                  Bill Scanned: Detected <strong>{getCurrencySymbol()}{scanBanner.amount}</strong> at <strong>{scanBanner.merchant}</strong> ({scanBanner.category}). Details auto-filled below!
                </span>
              </div>
            )}

            <div className="form-group">
              <label>Category</label>
              <select value={form.category_id} onChange={e => setForm({...form, category_id: e.target.value})} required>
                <option value="">Select category...</option>
                {['expense', 'income'].map(type => {
                  const items = displayCategories.filter(c => (c.type || 'expense').toLowerCase() === type);
                  if (items.length === 0) return null;
                  return (
                    <optgroup key={type} label={type === 'expense' ? 'Expenses' : 'Income'}>
                      {items.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </optgroup>
                  );
                })}
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
            <div className="form-group merchant-suggest-wrapper">
              <label>Description / Merchant (optional)</label>
              <input
                type="text"
                placeholder="e.g. Starbucks, Amazon, Groceries..."
                value={form.description}
                onFocus={() => setShowMerchantSuggestions(true)}
                onChange={e => {
                  setForm({...form, description: e.target.value});
                  setShowMerchantSuggestions(true);
                }}
              />
              {showMerchantSuggestions && matchedMerchants.length > 0 && (
                <div className="merchant-suggestions-dropdown">
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', padding: '0.2rem 0.5rem', fontWeight: 600 }}>
                    Recent & Frequent Merchants:
                  </div>
                  {matchedMerchants.map(m => (
                    <div
                      key={m.name}
                      className="merchant-item"
                      onClick={() => selectMerchant(m)}
                    >
                      <span style={{ fontWeight: 500 }}>{m.name}</span>
                      <div className="merchant-item-meta">
                        <span className="txn-tag-badge">{m.category_name || 'Auto'}</span>
                        <span>{formatCurrency(m.amount)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="form-group">
              <label>Custom Tags (optional, comma-separated)</label>
              <input
                type="text"
                placeholder="e.g. dining, trip, groceries, urgent"
                value={form.tags}
                onChange={e => setForm({...form, tags: e.target.value})}
              />
              <div className="quick-tags-container">
                <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', alignSelf: 'center' }}>Quick:</span>
                {['#dining', '#groceries', '#travel', '#shopping', '#bills', '#freelance', '#personal'].map(qt => (
                  <button
                    key={qt}
                    type="button"
                    className="quick-tag-pill"
                    onClick={() => addQuickTag(qt)}
                  >
                    {qt}
                  </button>
                ))}
              </div>
            </div>
            {splitGroups && splitGroups.length > 0 && !editTxn && (
              <div className="form-group">
                <label>Split with Group (Optional)</label>
                <select
                  value={form.split_group_id || ''}
                  onChange={e => setForm({...form, split_group_id: e.target.value})}
                >
                  <option value="">None (Personal Transaction)</option>
                  {splitGroups.map(g => (
                    <option key={g.id} value={g.id}>👥 {g.name}</option>
                  ))}
                </select>
                {form.split_group_id && (
                  <span style={{ fontSize: '0.78rem', color: 'var(--accent-color)', marginTop: '0.25rem', display: 'block' }}>
                    💡 This expense will be shared equally with members of {splitGroups.find(g => String(g.id) === String(form.split_group_id))?.name} and recorded in your transactions.
                  </span>
                )}
              </div>
            )}
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

      {/* Instant Digital Receipt Modal */}
      {selectedReceipt && (
        <InstantReceiptModal
          receipt={selectedReceipt}
          onClose={() => setSelectedReceipt(null)}
        />
      )}

      {/* Export Report Format Options Modal (PDF or Excel Table) */}
      <ExportReportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        title="Export Transactions Report"
        subtitle={`Period: ${MONTHS[month-1]} ${year} | Filter: ${filterType.toUpperCase()}`}
        onExportPdf={exportPDF}
        onExportExcel={exportExcelTable}
        onShareWhatsApp={handleShareWhatsApp}
        loadingPdf={exportingPdf}
        loadingExcel={exportingExcel}
        recordCount={filtered.length}
      />

      {/* CSV Batch Importer Modal */}
      <CsvImportModal
        isOpen={showCsvModal}
        onClose={() => setShowCsvModal(false)}
        categories={categories}
        onImportComplete={() => {
          setShowCsvModal(false);
          fetchAll();
        }}
      />

      {/* Mileage & Travel Calculator Modal */}
      <MileageCalculatorModal
        isOpen={showMileageModal}
        onClose={() => setShowMileageModal(false)}
        categories={categories}
        onExpenseLogged={() => {
          setShowMileageModal(false);
          fetchAll();
        }}
      />
    </div>
  );
}
