import React, { useEffect, useState, useRef } from 'react';
import ReactDOM from 'react-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import {
  Users, Plus, X, Check, Trash2, UserPlus,
  Receipt, ArrowLeftRight, ChevronRight, ChevronLeft,
  RotateCcw, ArrowRight, CheckCircle2, Wallet, Layers,
  MessageCircle, FileText, FileSpreadsheet, Copy, CheckCheck, Camera,
  Share2, AlertCircle, Sparkles, FileDown, QrCode, Download
} from 'lucide-react';
import QRCode from 'qrcode';
import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import {
  formatCurrency, getCurrencySymbol, buildWhatsAppShareUrl,
  exportTableToExcel, formatErrorMessage
} from '../utils';
import { useDialog } from '../context/DialogContext';
import InstantReceiptModal from '../components/InstantReceiptModal';
import ExportReportModal from '../components/ExportReportModal';
import { useTranslation } from '../i18n';
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
  const { showConfirm, showAlert } = useDialog();
  const { t, currentLang } = useTranslation();
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [members, setMembers] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [balances, setBalances] = useState([]);
  const [settlementPlan, setSettlementPlan] = useState(null);
  const [filterMode, setFilterMode] = useState('all'); // 'all' | 'unsettled' | 'settled'
  const [balanceViewMode, setBalanceViewMode] = useState('pending'); // 'pending' | 'lifetime'
  const [loading, setLoading] = useState(true);

  // Sharing & Exports state
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [scanningReceipt, setScanningReceipt] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
  const receiptInputRef = useRef(null);

  // Settlements & History
  const [settlements, setSettlements] = useState([]);
  const [showSettlementModal, setShowSettlementModal] = useState(false);
  const activeBaseCurr = localStorage.getItem('finance-os-currency') || 'INR';

  // Modals
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showMemberModal, setShowMemberModal] = useState(false);

  // Forms
  const [groupForm, setGroupForm] = useState({ name: '', description: '', target_budget: '' });
  const [expenseForm, setExpenseForm] = useState({
    description: '', amount: '', expense_date: new Date().toISOString().split('T')[0],
    paid_by: '', split_with: [],
    original_currency: activeBaseCurr,
    original_amount: '',
    exchange_rate: '1.0'
  });
  const [memberUsername, setMemberUsername] = useState('');
  const [candidates, setCandidates] = useState([]);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Advanced Unequal Split Mode States
  const [splitMode, setSplitMode] = useState('equal'); // 'equal' | 'exact' | 'percent' | 'shares'
  const [customAmounts, setCustomAmounts] = useState({});
  const [customPercents, setCustomPercents] = useState({});
  const [customSharesRatio, setCustomSharesRatio] = useState({});
  // QR Code Invite States
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrGroup, setQrGroup] = useState(null);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [copiedQrLink, setCopiedQrLink] = useState(false);
  const [qrInviteUrl, setQrInviteUrl] = useState('');

  // Handle join link / QR scan redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const joinGroupId = params.get('joinGroup');
    const joinGroupName = params.get('name') || 'Group';

    if (joinGroupId && user?.username) {
      const gid = parseInt(joinGroupId, 10);
      if (!isNaN(gid)) {
        api.post(`/split/groups/${gid}/members`, { username: user.username })
          .then(() => {
            showAlert({
              title: `Joined ${joinGroupName}!`,
              message: `You are now a member of "${joinGroupName}" and can live-manage expenses together.`,
              type: 'success',
            });
            fetchGroups().then(() => {
              api.get(`/split/groups`).then(res => {
                const found = res.data.find(g => g.id === gid);
                if (found) fetchGroupDetail(found);
              });
            });
          })
          .catch(() => {
            fetchGroups().then(() => {
              api.get(`/split/groups`).then(res => {
                const found = res.data.find(g => g.id === gid);
                if (found) {
                  fetchGroupDetail(found);
                  showAlert({
                    title: `Welcome to ${joinGroupName}`,
                    message: `Opened group "${joinGroupName}" for live expense management.`,
                    type: 'info',
                  });
                }
              });
            });
          })
          .finally(() => {
            window.history.replaceState({}, document.title, window.location.pathname);
          });
      }
    }
  }, [user?.username]);

  const handleOpenQrModal = async (grp, e) => {
    if (e) e.stopPropagation();
    const targetGroup = grp || selectedGroup;
    if (!targetGroup) return;
    setQrGroup(targetGroup);
    setCopiedQrLink(false);
    const inviteUrl = `${window.location.origin}/split?joinGroup=${targetGroup.id}&name=${encodeURIComponent(targetGroup.name)}`;
    setQrInviteUrl(inviteUrl);
    setShowQrModal(true);
    try {
      const url = await QRCode.toDataURL(inviteUrl, {
        width: 320,
        margin: 2,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
        errorCorrectionLevel: 'H'
      });
      setQrDataUrl(url);
    } catch (err) {
      console.error('Failed to generate group QR code:', err);
    }
  };

  const handleCopyQrLink = () => {
    navigator.clipboard.writeText(qrInviteUrl).then(() => {
      setCopiedQrLink(true);
      setTimeout(() => setCopiedQrLink(false), 2500);
    });
  };

  const handleShareQrWhatsApp = () => {
    const text = `Hey! Join our group "${qrGroup?.name}" on FinanceOS to live-manage and track shared trip expenses in real-time:\n${qrInviteUrl}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleDownloadQrImage = () => {
    if (!qrDataUrl) return;
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = `FinanceOS_Group_${(qrGroup?.name || 'Invite').replace(/\s+/g, '_')}_QR.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  useEffect(() => { fetchGroups(); }, []);

  async function fetchGroups() {
    setLoading(true);
    try {
      const res = await api.get('/split/groups');
      setGroups(res.data);
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  }

  async function fetchGroupDetail(group) {
    setSelectedGroup(group);
    try {
      const [membRes, expRes, balRes, planRes, setRes] = await Promise.all([
        api.get(`/split/groups/${group.id}/members`),
        api.get(`/split/groups/${group.id}/expenses`),
        api.get(`/split/groups/${group.id}/balances`),
        api.get(`/split/groups/${group.id}/settlement-plan`),
        api.get(`/split/groups/${group.id}/settlements`),
      ]);
      setMembers(membRes.data);
      setExpenses(expRes.data);
      setBalances(balRes.data);
      setSettlementPlan(planRes.data);
      setSettlements(setRes.data || []);
      const currentMember = membRes.data.find(m => m.username === user?.username) || membRes.data[0];
      setExpenseForm(f => ({
        ...f,
        paid_by: currentMember ? String(currentMember.id) : '',
        split_with: membRes.data.map(m => m.id),
        original_currency: activeBaseCurr,
        original_amount: '',
        exchange_rate: '1.0'
      }));
    } catch(e) { console.error(e); }
  };

  const openAddExpenseModal = () => {
    setError('');
    const currentMember = (members || []).find(m => m.username === user?.username) || (members || [])[0];
    setExpenseForm({
      description: '',
      amount: '',
      expense_date: new Date().toISOString().split('T')[0],
      paid_by: currentMember ? String(currentMember.id) : '',
      split_with: (members || []).map(m => m.id),
      original_currency: activeBaseCurr,
      original_amount: '',
      exchange_rate: '1.0'
    });
    setSplitMode('equal');
    setCustomAmounts({});
    setCustomPercents({});
    setCustomSharesRatio({});
    setShowExpenseModal(true);
  };

  const handleRecordSettlement = async (payerId, receiverId, amount, note = '') => {
    try {
      await api.post(`/split/groups/${selectedGroup.id}/settlements`, {
        payer_id: payerId,
        receiver_id: receiverId,
        amount: parseFloat(amount),
        currency: activeBaseCurr,
        note: note || 'Settled via Transfer Plan'
      });
      fetchGroupDetail(selectedGroup);
    } catch(err) {
      console.error(err);
      showAlert({
        title: 'Settlement Failed',
        message: formatErrorMessage(err),
        type: 'danger'
      });
    }
  };

  const openMemberModal = async () => {
    setError('');
    setMemberUsername('');
    setShowMemberModal(true);
    try {
      const res = await api.get(`/split/groups/${selectedGroup.id}/candidate-members`);
      setCandidates(res.data);
    } catch (e) {
      console.error(e);
      setCandidates([]);
    }
  };

  const toggleSplitWith = (memberId) => {
    setExpenseForm(prev => {
      const exists = prev.split_with.includes(memberId);
      const nextSplit = exists
        ? prev.split_with.filter(id => id !== memberId)
        : [...prev.split_with, memberId];

      if (exists) {
        setCustomAmounts(curr => {
          const c = { ...curr };
          delete c[memberId];
          return c;
        });
        setCustomPercents(curr => {
          const c = { ...curr };
          delete c[memberId];
          return c;
        });
        setCustomSharesRatio(curr => {
          const c = { ...curr };
          delete c[memberId];
          return c;
        });
      }
      return { ...prev, split_with: nextSplit };
    });
  };

  const handleCreateGroup = async (e) => {
    e.preventDefault(); setSubmitting(true); setError('');
    try {
      await api.post('/split/groups', {
        ...groupForm,
        target_budget: groupForm.target_budget ? parseFloat(groupForm.target_budget) : null
      });
      setShowGroupModal(false);
      setGroupForm({ name: '', description: '', target_budget: '' });
      fetchGroups();
    } catch(err) { setError(formatErrorMessage(err, 'Failed to create group')); }
    finally { setSubmitting(false); }
  };

  const handleAddMember = async (e) => {
    e.preventDefault(); setSubmitting(true); setError('');
    try {
      await api.post(`/split/groups/${selectedGroup.id}/members`, { username: memberUsername });
      setMemberUsername('');
      setShowMemberModal(false);
      fetchGroupDetail(selectedGroup);
    } catch(err) { setError(formatErrorMessage(err, 'Failed to add member')); }
    finally { setSubmitting(false); }
  };

  const handleQuickAddCandidate = async (uname) => {
    setSubmitting(true);
    setError('');
    try {
      await api.post(`/split/groups/${selectedGroup.id}/members`, { username: uname });
      setCandidates(prev => prev.filter(c => c.username !== uname));
      fetchGroupDetail(selectedGroup);
    } catch (err) {
      setError(formatErrorMessage(err, 'Failed to add member'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveMember = async (memberId, memberName) => {
    const confirmed = await showConfirm({
      title: 'Remove Group Member',
      message: `Remove ${memberName} from this group?`,
      confirmText: 'Remove',
      cancelText: 'Cancel',
      isDanger: true,
    });
    if (!confirmed) return;
    try {
      await api.delete(`/split/groups/${selectedGroup.id}/members/${memberId}`);
      fetchGroupDetail(selectedGroup);
    } catch (err) {
      showAlert({
        title: 'Cannot Remove Member',
        message: formatErrorMessage(err, 'Cannot remove member with active expenses.'),
        type: 'danger',
      });
    }
  };

  const handleAddExpense = async (e) => {
    e.preventDefault(); setSubmitting(true); setError('');
    const totalAmountNum = parseFloat(expenseForm.amount) || 0;

    if (!expenseForm.paid_by) {
      setError('Please select who paid for this expense.');
      setSubmitting(false);
      return;
    }

    if (expenseForm.split_with.length === 0) {
      setError('Please select at least one member to split with.');
      setSubmitting(false);
      return;
    }

    let calculatedShares = null;

    if (splitMode === 'exact') {
      const sumExact = expenseForm.split_with.reduce((sum, uid) => {
        return sum + (parseFloat(customAmounts[uid]) || 0);
      }, 0);
      const diff = totalAmountNum - sumExact;
      if (Math.abs(diff) > 0.05) {
        setError(`Exact amounts must sum to ${formatCurrency(totalAmountNum)}. Current total is ${formatCurrency(sumExact)} (difference: ${formatCurrency(Math.abs(diff))}).`);
        setSubmitting(false);
        return;
      }
      calculatedShares = {};
      expenseForm.split_with.forEach(uid => {
        calculatedShares[String(uid)] = parseFloat(customAmounts[uid]) || 0;
      });
    } else if (splitMode === 'percent') {
      const sumPercent = expenseForm.split_with.reduce((sum, uid) => {
        return sum + (parseFloat(customPercents[uid]) || 0);
      }, 0);
      const diff = 100 - sumPercent;
      if (Math.abs(diff) > 0.1) {
        setError(`Percentages must sum to 100%. Current total is ${sumPercent.toFixed(1)}% (difference: ${Math.abs(diff).toFixed(1)}%).`);
        setSubmitting(false);
        return;
      }
      calculatedShares = {};
      expenseForm.split_with.forEach(uid => {
        const pct = parseFloat(customPercents[uid]) || 0;
        calculatedShares[String(uid)] = Math.round(((totalAmountNum * pct) / 100) * 100) / 100;
      });
    } else if (splitMode === 'shares') {
      const sumShares = expenseForm.split_with.reduce((sum, uid) => {
        return sum + (parseFloat(customSharesRatio[uid]) || 1);
      }, 0);
      const tot = sumShares || 1;
      calculatedShares = {};
      expenseForm.split_with.forEach(uid => {
        const sh = parseFloat(customSharesRatio[uid]) || 1;
        calculatedShares[String(uid)] = Math.round(((totalAmountNum * sh) / tot) * 100) / 100;
      });
    }

    try {
      const resolvedPaidBy = parseInt(expenseForm.paid_by) || (members[0]?.id);
      const resolvedSplitWith = [...new Set((expenseForm.split_with || []).map(Number))];
      await api.post(`/split/groups/${selectedGroup.id}/expenses`, {
        description: expenseForm.description,
        expense_date: expenseForm.expense_date,
        amount: totalAmountNum,
        paid_by: resolvedPaidBy,
        split_with: resolvedSplitWith.length > 0 ? resolvedSplitWith : [resolvedPaidBy],
        custom_shares: splitMode === 'equal' ? null : calculatedShares,
        original_currency: expenseForm.original_currency || activeBaseCurr,
        original_amount: expenseForm.original_amount ? parseFloat(expenseForm.original_amount) : totalAmountNum,
        exchange_rate: parseFloat(expenseForm.exchange_rate) || 1.0
      });
      setShowExpenseModal(false);
      setSplitMode('equal');
      setCustomAmounts({});
      setCustomPercents({});
      setCustomSharesRatio({});
      fetchGroupDetail(selectedGroup);
    } catch(err) {
      setError(formatErrorMessage(err, 'Failed to add expense'));
    }
    finally { setSubmitting(false); }
  };

  const handleSettle = async (expenseId, userId) => {
    try {
      await api.post(`/split/expenses/${expenseId}/settle`, { user_id: userId });
      fetchGroupDetail(selectedGroup);
    } catch(e) { console.error(e); }
  };

  const handleUnsettle = async (expenseId, userId) => {
    try {
      await api.post(`/split/expenses/${expenseId}/unsettle`, { user_id: userId });
      fetchGroupDetail(selectedGroup);
    } catch(e) { console.error(e); }
  };

  const handleDeleteGroup = async (groupId) => {
    const confirmed = await showConfirm({
      title: 'Delete Split Group',
      message: 'Delete this group and all its expenses? This action cannot be undone.',
      confirmText: 'Delete Group',
      cancelText: 'Keep Group',
      isDanger: true,
    });
    if (!confirmed) return;
    try {
      await api.delete(`/split/groups/${groupId}`);
      setSelectedGroup(null);
      fetchGroups();
    } catch(e) {
      showAlert({
        title: 'Delete Failed',
        message: formatErrorMessage(e, 'Only the group owner can delete this group.'),
        type: 'danger',
      });
    }
  };

  const downloadBlob = (blob, fileName) => {
    try {
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
      showAlert({
        title: 'Download Failed',
        message: formatErrorMessage(err),
        type: 'danger',
      });
    }
  };

  const buildWhatsAppMessage = () => {
    let msg = `🌴 *${selectedGroup.name}* — Trip Settlement Summary\n`;
    if (selectedGroup.description) msg += `_${selectedGroup.description}_\n`;
    msg += `═══════════════════════════════\n`;
    msg += `💰 *Total Group Spending:* ${formatCurrency(settlementPlan?.total_spent || 0)}\n`;
    msg += `⏳ *Pending to Settle:* ${formatCurrency(settlementPlan?.pending_amount || 0)}\n`;
    msg += `👥 *Members:* ${members.length}  |  🧾 *Expenses:* ${expenses.length}\n`;
    msg += `═══════════════════════════════\n\n`;

    msg += `🤝 *WHO PAYS WHOM (Fewest Transfers):*\n`;
    if (settlementPlan?.is_fully_settled || !settlementPlan?.transfers?.length) {
      msg += `✅ All clear! Everyone in this group is fully settled up.\n\n`;
    } else {
      settlementPlan.transfers.forEach((t, i) => {
        msg += `${i + 1}. *${t.from_username}* ➔ *${t.to_username}*: ${formatCurrency(t.amount)}\n`;
      });
      msg += `\n`;
    }

    msg += `📊 *MEMBER BALANCES SUMMARY:*\n`;
    balances.forEach(b => {
      const net = b.balance;
      const status = net > 0 ? `gets back +${formatCurrency(net)}` : net < 0 ? `owes ${formatCurrency(Math.abs(net))}` : `settled`;
      msg += `• *${b.username}*: Paid ${formatCurrency(b.total_paid || 0)} | Share ${formatCurrency(b.total_share || 0)} (${status})\n`;
    });
    msg += `\n`;

    if (expenses.length > 0) {
      msg += `🧾 *EXPENSES:* (${expenses.length} total)\n`;
      expenses.slice(0, 6).forEach((e, idx) => {
        msg += `${idx + 1}. ${e.description} — ${formatCurrency(e.amount)} (Paid by ${e.paid_by_name})\n`;
      });
      if (expenses.length > 6) {
        msg += `... and ${expenses.length - 6} more\n`;
      }
      msg += `\n`;
    }

    msg += `⚡ *FinanceOS (Anti-Splitwise)* — Unlimited Free Group Splitting`;
    return msg;
  };

  const handleShareWhatsApp = () => {
    const msg = buildWhatsAppMessage();
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  const handleCopySummary = async () => {
    const msg = buildWhatsAppMessage();
    try {
      await navigator.clipboard.writeText(msg);
      setCopiedSummary(true);
      setTimeout(() => setCopiedSummary(false), 2500);
    } catch (err) {
      console.error('Failed to copy to clipboard', err);
    }
  };

  const handleRemindMemberWhatsApp = (t) => {
    const activeCurr = localStorage.getItem('finance-os-currency') || 'INR';
    const text = `👋 Hi *${t.from_username}*, here is a quick settlement reminder for *${selectedGroup?.name}*:
💰 You need to pay *${formatCurrency(t.amount, activeCurr)}* to *${t.to_username}*.
✅ Once paid, we will mark it settled in FinanceOS!
━━━━━━━━━━━━━━━━━━━━
✨ Tracked with *FinanceOS* (100% Free & Unlimited Alternative to Splitwise Pro)`;

    window.open(buildWhatsAppShareUrl(text), '_blank', 'noopener,noreferrer');
  };

  const exportGroupPDF = () => {
    if (!selectedGroup) return;
    setExportingPdf(true);
    try {
      const doc = new jsPDF();
      const activeCurr = localStorage.getItem('finance-os-currency') || 'INR';

      // Header Indigo Banner
      doc.setFillColor(79, 70, 229);
      doc.rect(0, 0, 210, 24, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16);
      doc.text("FinanceOS — Trip Expense & Settlement Report", 14, 16);

      // Meta info
      doc.setTextColor(30, 41, 59);
      doc.setFontSize(15);
      doc.text(`Group: ${selectedGroup.name}`, 14, 34);
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      let metaY = 41;
      if (selectedGroup.description) {
        doc.text(`Description: ${selectedGroup.description}`, 14, metaY);
        metaY += 6;
      }
      doc.text(`Generated: ${new Date().toLocaleString()} | Currency: ${activeCurr}`, 14, metaY);

      // Summary Box
      const boxY = metaY + 6;
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(14, boxY, 182, 20, 3, 3, 'FD');
      doc.setFontSize(9.5);
      doc.setTextColor(51, 65, 85);
      doc.text(`Total Group Spending: ${formatCurrency(settlementPlan?.total_spent || 0)}`, 18, boxY + 8);
      doc.text(`Pending Settlement: ${formatCurrency(settlementPlan?.pending_amount || 0)}`, 18, boxY + 15);
      doc.text(`Members: ${members.length}`, 110, boxY + 8);
      doc.text(`Status: ${settlementPlan?.is_fully_settled ? 'All Settled ✓' : `${settlementPlan?.transfers?.length || 0} Transfers Pending`}`, 110, boxY + 15);

      let currentY = boxY + 28;

      // Table 1: Optimal Settlement Plan (Who Pays Whom)
      doc.setFontSize(12);
      doc.setTextColor(15, 23, 42);
      doc.text("1. Optimal Settlement Plan (Who Pays Whom)", 14, currentY);

      const transferRows = (settlementPlan?.transfers && settlementPlan.transfers.length > 0)
        ? settlementPlan.transfers.map((t, idx) => [
            `#${idx + 1}`,
            t.from_username,
            'pays',
            t.to_username,
            formatCurrency(t.amount),
            'Pending Transfer'
          ])
        : [['—', 'All clear', '—', 'All clear', '0.00', 'Fully Settled ✓']];

      autoTable(doc, {
        startY: currentY + 4,
        head: [['#', 'Payer (From)', 'Action', 'Receiver (To)', 'Amount', 'Status']],
        body: transferRows,
        theme: 'grid',
        headStyles: { fillColor: [79, 70, 229] },
        styles: { fontSize: 9 }
      });

      currentY = doc.lastAutoTable.finalY + 12;

      // Table 2: Member Balances Breakdown
      doc.setFontSize(12);
      doc.setTextColor(15, 23, 42);
      doc.text("2. Member Balances & End-of-Trip Contributions", 14, currentY);

      const balanceRows = balances.map(b => [
        b.username,
        formatCurrency(b.total_paid || 0),
        formatCurrency(b.total_share || 0),
        (b.balance > 0 ? '+' : '') + formatCurrency(b.balance),
        (b.lifetime_balance > 0 ? '+' : '') + formatCurrency(b.lifetime_balance),
        b.balance > 0 ? 'Gets Back' : b.balance < 0 ? 'Needs to Pay' : 'Settled'
      ]);

      autoTable(doc, {
        startY: currentY + 4,
        head: [['Member', 'Total Contributed', 'Total Share', 'Current Pending', 'End-of-Trip Net', 'Status']],
        body: balanceRows,
        theme: 'grid',
        headStyles: { fillColor: [59, 130, 246] },
        styles: { fontSize: 9 }
      });

      currentY = doc.lastAutoTable.finalY + 12;

      if (currentY > 230) {
        doc.addPage();
        currentY = 20;
      }

      // Table 3: Itemized Expenses
      doc.setFontSize(12);
      doc.setTextColor(15, 23, 42);
      doc.text("3. Itemized Group Expense Register", 14, currentY);

      const expenseRows = expenses.map(e => [
        e.expense_date,
        e.description,
        e.paid_by_name,
        formatCurrency(e.amount),
        `${e.participants.length} members`,
        e.participants.every(p => p.settled) ? 'Settled ✓' : 'Unsettled'
      ]);

      autoTable(doc, {
        startY: currentY + 4,
        head: [['Date', 'Description', 'Paid By', 'Amount', 'Split With', 'Status']],
        body: expenseRows.length > 0 ? expenseRows : [['—', 'No expenses recorded', '—', '0.00', '—', '—']],
        theme: 'grid',
        headStyles: { fillColor: [16, 185, 129] },
        styles: { fontSize: 8.5 }
      });

      const cleanName = selectedGroup.name.replace(/[^a-zA-Z0-9_-]/g, '_');
      doc.save(`${cleanName}_Settlement_Report.pdf`);
      setShowExportModal(false);
    } catch (err) {
      console.error('PDF export failed:', err);
      showAlert({
        title: 'PDF Export Failed',
        message: formatErrorMessage(err),
        type: 'danger',
      });
    } finally {
      setExportingPdf(false);
    }
  };

  const exportGroupExcel = () => {
    if (!selectedGroup) return;
    setExportingExcel(true);
    try {
      const activeCurr = localStorage.getItem('finance-os-currency') || 'INR';

      const secSummary = {
        title: "1. GROUP TRIP OVERVIEW & SETTLEMENT STATUS",
        headers: ["Metric", "Details / Value", "Notes"],
        rows: [
          ["Group Name", selectedGroup.name, selectedGroup.description || 'N/A'],
          ["Total Group Spending", settlementPlan?.total_spent || 0, `All group expenses in ${activeCurr}`],
          ["Pending Settlement", settlementPlan?.pending_amount || 0, settlementPlan?.is_fully_settled ? 'All Settled' : 'Action Required'],
          ["Total Members", members.length, `${members.map(m => m.username).join(', ')}`],
          ["Total Expenses Count", expenses.length, `${expenses.filter(e => e.participants.every(p => p.settled)).length} settled`]
        ]
      };

      const secTransfers = {
        title: "2. OPTIMAL SETTLEMENT PLAN (WHO PAYS WHOM)",
        headers: ["From (Payer)", "Action", "To (Receiver)", `Amount (${activeCurr})`, "Status"],
        rows: (settlementPlan?.transfers && settlementPlan.transfers.length > 0)
          ? settlementPlan.transfers.map(t => [
              t.from_username,
              "pays",
              t.to_username,
              t.amount,
              "Pending Transfer"
            ])
          : [["All clear", "—", "All clear", 0, "Fully Settled ✓"]]
      };

      const secBalances = {
        title: "3. MEMBER BALANCES & END-OF-TRIP CONTRIBUTIONS",
        headers: ["Member", `Total Paid (${activeCurr})`, `Total Share (${activeCurr})`, `Pending Balance (${activeCurr})`, `Lifetime Net (${activeCurr})`, "Status"],
        rows: balances.map(b => [
          b.username,
          b.total_paid || 0,
          b.total_share || 0,
          b.balance,
          b.lifetime_balance,
          b.balance > 0 ? 'Gets Back' : b.balance < 0 ? 'Needs to Pay' : 'Settled'
        ])
      };

      const secExpenses = {
        title: "4. ITEMIZED GROUP EXPENSES REGISTER",
        headers: ["ID", "Date", "Description", "Paid By", `Amount (${activeCurr})`, "Split Between", "All Settled?"],
        rows: expenses.map(e => [
          e.id,
          e.expense_date,
          e.description,
          e.paid_by_name,
          e.amount,
          e.participants.map(p => p.username).join('; '),
          e.participants.every(p => p.settled) ? 'YES' : 'NO'
        ])
      };

      const cleanName = selectedGroup.name.replace(/[^a-zA-Z0-9_-]/g, '_');
      exportTableToExcel(`${cleanName}_Trip_Settlement_Report`, {
        title: `FinanceOS — Trip Settlement Report (${selectedGroup.name})`,
        subtitle: `Optimal Transfers, Member Balances & Expense Register`,
        sections: [secSummary, secTransfers, secBalances, secExpenses],
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

  const handleScanReceipt = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setScanningReceipt(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await api.post('/transactions/scan-receipt', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      const data = res.data;
      setExpenseForm(prev => ({
        ...prev,
        amount: data.amount ? data.amount.toString() : prev.amount,
        expense_date: data.date || prev.expense_date,
        description: data.description || data.merchant || prev.description || 'Group Receipt'
      }));
    } catch (err) {
      showAlert({
        title: 'Receipt Scan Failed',
        message: formatErrorMessage(err, 'Failed to scan receipt image.'),
        type: 'danger',
      });
    } finally {
      setScanningReceipt(false);
      e.target.value = null;
    }
  };

  if (loading) return <div className="loading-state">{t('loadingData', 'Loading groups...')}</div>;

  // Group list view
  if (!selectedGroup) return (
    <div className="split-page animate-fade-in">
      <div className="page-header">
        <div>
          <h2>{t('splitExpensesTitle', 'Split Expenses')}</h2>
          <p className="text-muted">{t('splitExpensesSubtitle', 'Share and settle expenses with friends')}</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setError(''); setShowGroupModal(true); }}>
          <Plus size={16}/> {t('newGroup', 'New Group')}
        </button>
      </div>

      {groups.length === 0 ? (
        <div className="split-empty glass-panel">
          <Users size={48} className="text-muted" style={{marginBottom:'1rem'}}/>
          <h3>{t('noGroupsYet', 'No groups yet')}</h3>
          <p className="text-muted">{t('createGroupDesc', 'Create a group to start splitting expenses with friends.')}</p>
          <button className="btn btn-primary" style={{marginTop:'1rem'}} onClick={() => setShowGroupModal(true)}>
            <Plus size={16}/> {t('createFirstGroup', 'Create First Group')}
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
                <span className="split-meta-badge"><Users size={12}/> {g.member_count} {t('membersCount', 'members')}</span>
                <span className="split-meta-badge"><Receipt size={12}/> {g.expense_count} {t('expensesCount', 'expenses')}</span>
              </div>
              {g.target_budget && (
                <div style={{ marginTop: '0.6rem', background: 'rgba(255,255,255,0.03)', padding: '0.45rem 0.6rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '4px' }}>
                    <span className="text-muted">{t('tripTarget', 'Trip Target')}:</span>
                    <span style={{ fontWeight: 600 }}>{formatCurrency(g.total_spent || 0)} / {formatCurrency(g.target_budget)}</span>
                  </div>
                  <div style={{ height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${Math.min(100, (((g.total_spent || 0) / g.target_budget) * 100))}%`,
                      background: (g.total_spent || 0) > g.target_budget ? 'var(--danger-color)' : 'var(--accent-color)'
                    }} />
                  </div>
                </div>
              )}
              <button
                type="button"
                className="split-card-qr-btn"
                onClick={(e) => handleOpenQrModal(g, e)}
                title="Invite Friends via QR Code"
              >
                <QrCode size={13} />
                <span>QR</span>
              </button>
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
            <div className="form-group">
              <label>Target Trip Budget (optional, {getCurrencySymbol()})</label>
              <input
                type="number"
                step="0.01"
                placeholder="e.g. 50000"
                value={groupForm.target_budget}
                onChange={e => setGroupForm({...groupForm, target_budget: e.target.value})}
              />
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

  // Group Detail View Calculations
  const filteredExpenses = expenses.filter(exp => {
    const isFullySettled = exp.participants.length > 0 && exp.participants.every(p => p.settled);
    if (filterMode === 'settled') return isFullySettled;
    if (filterMode === 'unsettled') return !isFullySettled;
    return true;
  });
  const unsettledExpensesCount = expenses.filter(exp => !exp.participants.every(p => p.settled)).length;
  const settledExpensesCount = expenses.filter(exp => exp.participants.length > 0 && exp.participants.every(p => p.settled)).length;

  return (
    <div className="split-page animate-fade-in">
      {/* Top Header */}
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
        <div className="split-top-actions">
          <button 
            type="button" 
            className="btn btn-whatsapp" 
            onClick={handleShareWhatsApp} 
            title="Share formatted settlement summary directly to WhatsApp"
          >
            <MessageCircle size={15} /> {t('shareWhatsApp', 'Share on WhatsApp')}
          </button>
          
          <button 
            type="button" 
            className="btn btn-secondary" 
            onClick={handleCopySummary} 
            title="Copy settlement summary to clipboard for Telegram/iMessage/Email"
          >
            {copiedSummary ? <CheckCheck size={15} color="#34d399" /> : <Copy size={15} />}
            <span>{copiedSummary ? t('copied', 'Copied!') : t('share', 'Copy')}</span>
          </button>

          <button 
            type="button" 
            className="btn btn-secondary split-qr-invite-btn" 
            onClick={() => handleOpenQrModal(selectedGroup)} 
            title="Invite Friends via Live QR Code"
          >
            <QrCode size={15} /> {t('inviteQr', 'Invite QR')}
          </button>

          <button 
            type="button" 
            className="btn btn-secondary" 
            onClick={() => setShowExportModal(true)} 
            title="Export Trip Report (PDF or Excel Table)"
          >
            <FileDown size={15} /> {t('export', 'Export Report')}
          </button>

          <button type="button" className="btn btn-secondary" onClick={openMemberModal}>
            <UserPlus size={15}/> {t('addMember', 'Add Member')}
          </button>
          <button type="button" className="btn btn-primary" onClick={openAddExpenseModal}>
            <Plus size={15}/> {t('addExpense', 'Add Expense')}
          </button>
          <button type="button" className="btn btn-danger" style={{padding:'0.55rem 0.85rem'}} onClick={() => handleDeleteGroup(selectedGroup.id)} title="Delete Group">
            <Trash2 size={15}/>
          </button>
        </div>
      </div>

      {/* Top Trip Summary Ribbon */}
      <div className="split-summary-ribbon glass-panel">
        <div className="summary-ribbon-item">
          <span className="ribbon-label text-muted">Total Group Spending</span>
          <span className="ribbon-value">{formatCurrency(settlementPlan?.total_spent || 0)}</span>
        </div>
        {selectedGroup.target_budget && (
          <>
            <div className="summary-ribbon-divider" />
            <div className="summary-ribbon-item">
              <span className="ribbon-label text-muted">Trip Target Budget</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span className="ribbon-value">{formatCurrency(selectedGroup.target_budget)}</span>
                <span className="split-meta-badge" style={{
                  background: (settlementPlan?.total_spent || 0) > selectedGroup.target_budget ? 'rgba(239, 68, 68, 0.2)' : 'rgba(99, 102, 241, 0.2)',
                  color: (settlementPlan?.total_spent || 0) > selectedGroup.target_budget ? '#f87171' : '#818cf8',
                }}>
                  {Math.round(((settlementPlan?.total_spent || 0) / selectedGroup.target_budget) * 100)}% used
                </span>
              </div>
            </div>
          </>
        )}
        <div className="summary-ribbon-divider" />
        <div className="summary-ribbon-item">
          <span className="ribbon-label text-muted">Pending to Settle</span>
          <span className={`ribbon-value ${(settlementPlan?.pending_amount || 0) > 0 ? 'text-warning' : 'text-success'}`}>
            {formatCurrency(settlementPlan?.pending_amount || 0)}
          </span>
        </div>
        <div className="summary-ribbon-divider" />
        <div className="summary-ribbon-item">
          <span className="ribbon-label text-muted">Settlement Status</span>
          <span className="ribbon-badge">
            {settlementPlan?.is_fully_settled ? (
              <span className="badge-settled"><CheckCircle2 size={13} /> Fully Settled</span>
            ) : (
              <span className="badge-pending"><AlertCircle size={13} /> {(settlementPlan?.transfers?.length || 0)} Payments Pending</span>
            )}
          </span>
        </div>
      </div>

      <div className="split-detail-grid">
        {/* Left Column: Settlement Plan & Balances */}
        <div className="split-left-column">
          {/* Who Pays Whom: Settlement Plan Card */}
          <div className="glass-panel split-settlement-card">
            <div className="split-card-header">
              <h3 className="split-section-title">
                <ArrowRight size={16} /> Who Pays Whom
              </h3>
              <span className="text-muted" style={{ fontSize: '0.72rem' }}>Optimal Settlement</span>
            </div>

            {settlementPlan?.is_fully_settled ? (
              <div className="settlement-all-clear">
                <CheckCircle2 size={24} className="text-success" />
                <div>
                  <h4 style={{ margin: 0, fontSize: '0.95rem' }}>All Clear!</h4>
                  <p className="text-muted" style={{ fontSize: '0.8rem', margin: 0 }}>
                    Every participant in this group is settled up. No transfers needed.
                  </p>
                </div>
              </div>
            ) : (
              <div className="settlement-transfers-list">
                <p className="settlement-hint text-muted">
                  Fewest transactions to settle all pending dues:
                </p>
                {settlementPlan?.transfers?.map((t, idx) => (
                  <div key={idx} className="settlement-transfer-card">
                    <div className="transfer-flow">
                      <div className="transfer-member from-member">
                        <span className="member-name">{t.from_username}</span>
                        <span className="member-role text-muted">pays</span>
                      </div>
                      <div className="transfer-arrow">
                        <ArrowRight size={15} />
                      </div>
                      <div className="transfer-member to-member">
                        <span className="member-name">{t.to_username}</span>
                        <span className="member-role text-muted">receives</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                      <div className="transfer-amount-tag">
                        {formatCurrency(t.amount)}
                      </div>
                      <button
                        type="button"
                        className="btn btn-primary"
                        style={{ padding: '0.35rem 0.65rem', fontSize: '0.78rem' }}
                        onClick={() => handleRecordSettlement(t.from_user_id, t.to_user_id, t.amount, `Settlement: ${t.from_username} to ${t.to_username}`)}
                        title="Record this settlement payment in history"
                      >
                        <CheckCircle2 size={13} /> Settle
                      </button>
                      <button
                        type="button"
                        className="btn btn-whatsapp"
                        style={{ padding: '0.35rem 0.65rem', fontSize: '0.78rem' }}
                        onClick={() => handleRemindMemberWhatsApp(t)}
                        title="Send WhatsApp payment reminder to payer"
                      >
                        <MessageCircle size={13} /> Remind
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary icon-btn receipt-btn"
                        style={{ width: '30px', height: '30px' }}
                        onClick={() => setSelectedReceipt({
                          id: `transfer-${t.from_username}-${t.to_username}`,
                          type: 'settlement',
                          category: 'Settlement Transfer',
                          description: `Group settlement transfer from ${t.from_username} to ${t.to_username}`,
                          amount: t.amount,
                          date: new Date().toISOString().split('T')[0],
                          paidBy: t.from_username,
                          paidTo: t.to_username,
                          groupName: selectedGroup.name,
                          currency: localStorage.getItem('finance-os-currency') || 'INR'
                        })}
                        title="View Settlement Receipt Voucher"
                      >
                        <Receipt size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Balances & End of Trip Contribution Table */}
          <div className="glass-panel split-balances-card">
            <div className="split-card-header">
              <h3 className="split-section-title">
                <ArrowLeftRight size={16} /> Balances & Totals
              </h3>
              <div className="balance-toggle-tabs">
                <button
                  type="button"
                  className={`balance-tab ${balanceViewMode === 'pending' ? 'active' : ''}`}
                  onClick={() => setBalanceViewMode('pending')}
                  title="Shows currently pending unsettled balances"
                >
                  Pending
                </button>
                <button
                  type="button"
                  className={`balance-tab ${balanceViewMode === 'lifetime' ? 'active' : ''}`}
                  onClick={() => setBalanceViewMode('lifetime')}
                  title="Shows total contributed vs consumed over all expenses"
                >
                  End of Trip Totals
                </button>
              </div>
            </div>

            {balances.length === 0 ? (
              <p className="text-muted" style={{ fontSize: '0.85rem' }}>No balances yet.</p>
            ) : (
              <div className="balance-list">
                {balances.map(b => {
                  const activeVal = balanceViewMode === 'pending' ? b.balance : b.lifetime_balance;
                  return (
                    <div key={b.user_id} className="balance-row-detailed">
                      <div className="balance-member-info">
                        <span className="balance-name">{b.username}</span>
                        <span className="balance-subtext text-muted">
                          Paid: {formatCurrency(b.total_paid || 0)} · Share: {formatCurrency(b.total_share || 0)}
                        </span>
                      </div>
                      <div className="balance-amount-col">
                        <span className={`balance-amount ${activeVal > 0 ? 'text-success' : activeVal < 0 ? 'text-danger' : 'text-muted'}`}>
                          {activeVal > 0 ? '+' : ''}{formatCurrency(Math.abs(activeVal))}
                        </span>
                        <span className="balance-hint text-muted">
                          {activeVal > 0 ? 'gets back' : activeVal < 0 ? 'needs to pay' : 'settled'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Members Section */}
            <h3 className="split-section-title" style={{ marginTop: '1.5rem' }}>
              <Users size={16} /> Members ({members.length})
            </h3>
            <div className="member-chips">
              {members.map(m => (
                <span key={m.id} className="member-chip">
                  <span>{m.username}</span>
                  {m.id !== selectedGroup.owner_id && (
                    <button
                      type="button"
                      className="member-chip-remove"
                      onClick={() => handleRemoveMember(m.id, m.username)}
                      title={`Remove ${m.username}`}
                    >
                      <X size={12} />
                    </button>
                  )}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Expenses Feed with Filter Tabs */}
        <div className="split-expenses-column">
          {/* Filter Bar */}
          <div className="expenses-filter-bar glass-panel">
            <div className="filter-tabs">
              <button
                type="button"
                className={`filter-tab ${filterMode === 'all' ? 'active' : ''}`}
                onClick={() => setFilterMode('all')}
              >
                All Expenses ({expenses.length})
              </button>
              <button
                type="button"
                className={`filter-tab ${filterMode === 'unsettled' ? 'active' : ''}`}
                onClick={() => setFilterMode('unsettled')}
              >
                Unsettled ({unsettledExpensesCount})
              </button>
              <button
                type="button"
                className={`filter-tab ${filterMode === 'settled' ? 'active' : ''}`}
                onClick={() => setFilterMode('settled')}
              >
                Settled ({settledExpensesCount})
              </button>
            </div>
          </div>

          {/* Expenses List */}
          <div className="split-expenses-list">
            {filteredExpenses.length === 0 ? (
              <div className="empty-state glass-panel">
                <Receipt size={36} className="text-muted" style={{ margin: '0 auto 0.75rem', display: 'block' }} />
                <p className="text-muted">
                  {filterMode === 'all'
                    ? 'No expenses recorded yet. Click "Add Expense" to get started.'
                    : `No ${filterMode} expenses found.`}
                </p>
              </div>
            ) : (
              filteredExpenses.map(exp => (
                <div key={exp.id} className="glass-panel split-expense-card">
                  <div className="split-expense-header">
                    <div>
                      <p className="split-expense-desc">{exp.description}</p>
                      <p className="text-muted" style={{ fontSize: '0.8rem' }}>
                        Paid by <strong>{exp.paid_by_name}</strong> · {new Date(exp.expense_date).toLocaleDateString('en-IN')}
                      </p>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.15rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                        <span className="split-expense-amount">{formatCurrency(exp.amount)}</span>
                        <button
                          type="button"
                          className="btn btn-secondary icon-btn receipt-btn"
                          style={{ width: '30px', height: '30px' }}
                          onClick={() => setSelectedReceipt({
                            id: exp.id,
                            type: 'expense',
                            category: 'Split Group Expense',
                            description: exp.description,
                            amount: exp.amount,
                            date: exp.expense_date,
                            paidBy: exp.paid_by_name,
                            groupName: selectedGroup.name,
                            currency: localStorage.getItem('finance-os-currency') || 'INR'
                          })}
                          title="View Digital Receipt Voucher & WhatsApp Share"
                        >
                          <Receipt size={14} />
                        </button>
                      </div>
                      {exp.original_currency && exp.original_amount && exp.original_currency !== activeBaseCurr && (
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                          {exp.original_currency} {Number(exp.original_amount).toFixed(2)} (@ {exp.exchange_rate})
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="split-participants">
                    {exp.participants.map(p => (
                      <div key={p.id} className={`split-participant ${p.settled ? 'settled' : ''}`}>
                        <span className="participant-name">{p.username}</span>
                        <span className="participant-share text-muted">{formatCurrency(p.share)}</span>
                        {p.settled ? (
                          <div className="settled-btn-group">
                            <span className="settled-badge">✓ Settled</span>
                            <button
                              type="button"
                              className="btn-unsettle"
                              onClick={() => handleUnsettle(exp.id, p.id)}
                              title="Mark this share as Unsettled"
                            >
                              <RotateCcw size={11} /> Unsettle
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="btn-settle"
                            onClick={() => handleSettle(exp.id, p.id)}
                          >
                            <Check size={12} /> Mark Settled
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
      </div>

      {/* Add Member Modal */}
      {showMemberModal && (
        <Modal title="Add Group Members" onClose={() => setShowMemberModal(false)}>
          <form onSubmit={handleAddMember} className="modal-form">
            {error && <div className="auth-error">{error}</div>}
            <div className="form-group">
              <label>Friend Name(s) or Username</label>
              <input
                placeholder="e.g. Alice, Bob, Charlie"
                value={memberUsername}
                onChange={e => setMemberUsername(e.target.value)}
                required
                autoFocus
              />
              <span className="text-muted" style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>
                💡 Tip: Type any friend's name, or multiple names separated by commas.
              </span>
            </div>

            {candidates.length > 0 && (
              <div className="candidates-container">
                <label style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                  Suggested registered users:
                </label>
                <div className="candidate-chips">
                  {candidates.map(c => (
                    <button
                      key={c.id}
                      type="button"
                      className="candidate-chip"
                      onClick={() => handleQuickAddCandidate(c.username)}
                      title={`Quick add ${c.username}`}
                    >
                      <Plus size={12} /> {c.username}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setShowMemberModal(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                <UserPlus size={16}/> {submitting ? 'Adding...' : 'Add Members'}
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

            {/* AI Receipt Scanner */}
            <div className="receipt-scan-banner">
              <input
                type="file"
                ref={receiptInputRef}
                style={{ display: 'none' }}
                accept="image/*"
                onChange={handleScanReceipt}
              />
              <button
                type="button"
                className="scan-receipt-btn"
                onClick={() => receiptInputRef.current?.click()}
                disabled={scanningReceipt}
              >
                <Camera size={16} />
                <span>{scanningReceipt ? 'AI Reading Receipt...' : 'Scan Receipt (Auto-Fill Amount & Date)'}</span>
              </button>
            </div>

            <div className="form-group">
              <label>Description</label>
              <input placeholder="e.g. Dinner at restaurant" value={expenseForm.description}
                onChange={e => setExpenseForm({...expenseForm, description: e.target.value})} required/>
            </div>
            {/* Multi-Currency Converter */}
            <div className="form-group" style={{ background: 'rgba(255,255,255,0.03)', padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                <label style={{ margin: 0, fontSize: '0.85rem' }}>Expense Currency</label>
                <select
                  value={expenseForm.original_currency}
                  onChange={e => {
                    const chosenCurr = e.target.value;
                    let defaultRate = 1.0;
                    if (chosenCurr !== activeBaseCurr) {
                      if (activeBaseCurr === 'INR') {
                        const inrRates = { USD: 83.5, EUR: 90.5, GBP: 105.0, AED: 22.7, CAD: 61.0, AUD: 54.0, SGD: 62.0, JPY: 0.55, THB: 2.3 };
                        defaultRate = inrRates[chosenCurr] || 1.0;
                      } else if (activeBaseCurr === 'USD') {
                        const usdRates = { INR: 0.012, EUR: 1.08, GBP: 1.26, AED: 0.27, CAD: 0.74, AUD: 0.65, SGD: 0.74, JPY: 0.0065, THB: 0.027 };
                        defaultRate = usdRates[chosenCurr] || 1.0;
                      }
                    }
                    const orig = parseFloat(expenseForm.original_amount) || parseFloat(expenseForm.amount) || 0;
                    const conv = orig > 0 ? (orig * defaultRate).toFixed(2) : expenseForm.amount;
                    setExpenseForm({
                      ...expenseForm,
                      original_currency: chosenCurr,
                      exchange_rate: String(defaultRate),
                      amount: chosenCurr === activeBaseCurr ? (expenseForm.original_amount || expenseForm.amount) : conv
                    });
                  }}
                  style={{ width: 'auto', padding: '0.25rem 0.5rem', fontSize: '0.82rem' }}
                >
                  {['INR', 'USD', 'EUR', 'GBP', 'AED', 'CAD', 'AUD', 'SGD', 'JPY', 'THB'].map(c => (
                    <option key={c} value={c}>{c} {c === activeBaseCurr ? '(Base)' : ''}</option>
                  ))}
                </select>
              </div>

              {expenseForm.original_currency !== activeBaseCurr && (
                <div className="form-row" style={{ marginTop: '0.4rem' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={{ fontSize: '0.75rem' }}>Amount in {expenseForm.original_currency}</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={expenseForm.original_amount}
                      onChange={e => {
                        const val = e.target.value;
                        const rate = parseFloat(expenseForm.exchange_rate) || 1.0;
                        const conv = val ? (parseFloat(val) * rate).toFixed(2) : '';
                        setExpenseForm({ ...expenseForm, original_amount: val, amount: conv });
                      }}
                      required
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={{ fontSize: '0.75rem' }}>Exchange Rate (1 {expenseForm.original_currency} = X {activeBaseCurr})</label>
                    <input
                      type="number"
                      step="0.0001"
                      placeholder="1.0"
                      value={expenseForm.exchange_rate}
                      onChange={e => {
                        const r = e.target.value;
                        const orig = parseFloat(expenseForm.original_amount) || 0;
                        const conv = orig > 0 && r ? (orig * parseFloat(r)).toFixed(2) : expenseForm.amount;
                        setExpenseForm({ ...expenseForm, exchange_rate: r, amount: conv });
                      }}
                      required
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>
                  {expenseForm.original_currency !== activeBaseCurr ? `Converted Amount (${activeBaseCurr})` : `Amount (${getCurrencySymbol()})`}
                </label>
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
            {/* Advanced Unequal Split Mode Selector */}
            <div className="form-group">
              <div className="split-mode-header">
                <label>Split Model</label>
                <span className="split-mode-tag">
                  {splitMode === 'equal' && 'Split evenly across selected'}
                  {splitMode === 'exact' && 'Exact currency amounts'}
                  {splitMode === 'percent' && 'By custom percentage (%)'}
                  {splitMode === 'shares' && 'By shares ratio (e.g. 1 : 2)'}
                </span>
              </div>
              <div className="split-mode-tabs">
                <button
                  type="button"
                  className={`split-mode-tab ${splitMode === 'equal' ? 'active' : ''}`}
                  onClick={() => setSplitMode('equal')}
                >
                  = Equal
                </button>
                <button
                  type="button"
                  className={`split-mode-tab ${splitMode === 'exact' ? 'active' : ''}`}
                  onClick={() => {
                    setSplitMode('exact');
                    // Pre-fill if empty
                    if (Object.keys(customAmounts).length === 0 && expenseForm.split_with.length > 0) {
                      const eq = Math.round(((parseFloat(expenseForm.amount) || 0) / expenseForm.split_with.length) * 100) / 100;
                      const initial = {};
                      expenseForm.split_with.forEach(id => { initial[id] = String(eq); });
                      setCustomAmounts(initial);
                    }
                  }}
                >
                  {getCurrencySymbol()} Exact
                </button>
                <button
                  type="button"
                  className={`split-mode-tab ${splitMode === 'percent' ? 'active' : ''}`}
                  onClick={() => {
                    setSplitMode('percent');
                    if (Object.keys(customPercents).length === 0 && expenseForm.split_with.length > 0) {
                      const eqPct = Math.round((100 / expenseForm.split_with.length) * 10) / 10;
                      const initial = {};
                      expenseForm.split_with.forEach(id => { initial[id] = String(eqPct); });
                      setCustomPercents(initial);
                    }
                  }}
                >
                  % Percent
                </button>
                <button
                  type="button"
                  className={`split-mode-tab ${splitMode === 'shares' ? 'active' : ''}`}
                  onClick={() => {
                    setSplitMode('shares');
                    if (Object.keys(customSharesRatio).length === 0 && expenseForm.split_with.length > 0) {
                      const initial = {};
                      expenseForm.split_with.forEach(id => { initial[id] = '1'; });
                      setCustomSharesRatio(initial);
                    }
                  }}
                >
                  ⚖ Shares
                </button>
              </div>
            </div>

            {/* Split With Participants & Dynamic Unequal Inputs */}
            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                <label style={{ margin: 0 }}>Split With</label>
                {splitMode === 'equal' && expenseForm.split_with.length > 0 && (
                  <span className="split-per-person-badge">
                    {formatCurrency((parseFloat(expenseForm.amount) || 0) / expenseForm.split_with.length)} / person
                  </span>
                )}
              </div>

              {splitMode === 'equal' ? (
                <div className="split-checkboxes">
                  {members.map(m => (
                    <label key={m.id} className="split-checkbox-item">
                      <input
                        type="checkbox"
                        checked={expenseForm.split_with.includes(m.id)}
                        onChange={() => toggleSplitWith(m.id)}
                      />
                      <span>{m.username}</span>
                    </label>
                  ))}
                </div>
              ) : (
                <div className="unequal-split-list">
                  {members.map(m => {
                    const isIncluded = expenseForm.split_with.includes(m.id);
                    const totalVal = parseFloat(expenseForm.amount) || 0;
                    const sumShares = expenseForm.split_with.reduce((s, uid) => s + (parseFloat(customSharesRatio[uid]) || 1), 0) || 1;

                    return (
                      <div key={m.id} className={`unequal-row ${isIncluded ? 'active' : 'disabled'}`}>
                        <label className="unequal-member-toggle">
                          <input
                            type="checkbox"
                            checked={isIncluded}
                            onChange={() => toggleSplitWith(m.id)}
                          />
                          <span className="unequal-member-name">{m.username}</span>
                        </label>

                        {isIncluded && (
                          <div className="unequal-input-wrap">
                            {splitMode === 'exact' && (
                              <div className="unequal-input-box">
                                <span className="input-prefix">{getCurrencySymbol()}</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  placeholder="0.00"
                                  value={customAmounts[m.id] ?? ''}
                                  onChange={e => setCustomAmounts({ ...customAmounts, [m.id]: e.target.value })}
                                  className="unequal-input"
                                />
                              </div>
                            )}

                            {splitMode === 'percent' && (
                              <div className="unequal-input-box">
                                <input
                                  type="number"
                                  step="0.1"
                                  min="0"
                                  max="100"
                                  placeholder="0"
                                  value={customPercents[m.id] ?? ''}
                                  onChange={e => setCustomPercents({ ...customPercents, [m.id]: e.target.value })}
                                  className="unequal-input"
                                />
                                <span className="input-suffix">%</span>
                                <span className="unequal-computed-val">
                                  ({formatCurrency((totalVal * (parseFloat(customPercents[m.id]) || 0)) / 100)})
                                </span>
                              </div>
                            )}

                            {splitMode === 'shares' && (
                              <div className="unequal-input-box">
                                <input
                                  type="number"
                                  step="0.5"
                                  min="0.5"
                                  placeholder="1"
                                  value={customSharesRatio[m.id] ?? '1'}
                                  onChange={e => setCustomSharesRatio({ ...customSharesRatio, [m.id]: e.target.value })}
                                  className="unequal-input"
                                />
                                <span className="input-suffix">share(s)</span>
                                <span className="unequal-computed-val">
                                  ({formatCurrency((totalVal * (parseFloat(customSharesRatio[m.id]) || 1)) / sumShares)})
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Real-time Running Balance Validator Pills */}
                  {splitMode === 'exact' && (() => {
                    const totalVal = parseFloat(expenseForm.amount) || 0;
                    const sumExact = expenseForm.split_with.reduce((sum, uid) => sum + (parseFloat(customAmounts[uid]) || 0), 0);
                    const diff = Math.round((totalVal - sumExact) * 100) / 100;
                    const isBalanced = Math.abs(diff) < 0.05;

                    return (
                      <div className={`split-validator-card ${isBalanced ? 'validator-balanced' : diff > 0 ? 'validator-under' : 'validator-over'}`}>
                        <div className="validator-info">
                          <span>Total Allocated: <strong>{formatCurrency(sumExact)}</strong> of {formatCurrency(totalVal)}</span>
                          {isBalanced ? (
                            <span className="validator-badge success">
                              <CheckCircle2 size={13} /> Balanced
                            </span>
                          ) : diff > 0 ? (
                            <span className="validator-badge warning">
                              <AlertCircle size={13} /> {formatCurrency(diff)} remaining
                            </span>
                          ) : (
                            <span className="validator-badge error">
                              <AlertCircle size={13} /> {formatCurrency(Math.abs(diff))} over
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {splitMode === 'percent' && (() => {
                    const sumPercent = expenseForm.split_with.reduce((sum, uid) => sum + (parseFloat(customPercents[uid]) || 0), 0);
                    const diff = Math.round((100 - sumPercent) * 10) / 10;
                    const isBalanced = Math.abs(diff) < 0.1;

                    return (
                      <div className={`split-validator-card ${isBalanced ? 'validator-balanced' : diff > 0 ? 'validator-under' : 'validator-over'}`}>
                        <div className="validator-info">
                          <span>Total Percent: <strong>{sumPercent.toFixed(1)}%</strong> of 100%</span>
                          {isBalanced ? (
                            <span className="validator-badge success">
                              <CheckCircle2 size={13} /> 100% Allocated
                            </span>
                          ) : diff > 0 ? (
                            <span className="validator-badge warning">
                              <AlertCircle size={13} /> {diff.toFixed(1)}% remaining
                            </span>
                          ) : (
                            <span className="validator-badge error">
                              <AlertCircle size={13} /> {Math.abs(diff).toFixed(1)}% over
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {splitMode === 'shares' && (() => {
                    const sumShares = expenseForm.split_with.reduce((s, uid) => s + (parseFloat(customSharesRatio[uid]) || 1), 0);
                    return (
                      <div className="split-validator-card validator-balanced">
                        <div className="validator-info">
                          <span>Total Ratio: <strong>{sumShares} total shares</strong></span>
                          <span className="validator-badge success">
                            <CheckCircle2 size={13} /> Proportional distribution
                          </span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
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

      {/* Instant Digital Receipt Modal */}
      {selectedReceipt && (
        <InstantReceiptModal
          receipt={selectedReceipt}
          onClose={() => setSelectedReceipt(null)}
        />
      )}

      {/* Export Report Format Options Modal */}
      {selectedGroup && (
        <ExportReportModal
          isOpen={showExportModal}
          onClose={() => setShowExportModal(false)}
          title={`Export Trip Report — ${selectedGroup.name}`}
          subtitle="Settlement Plan, Member Balances & Expense Register"
          onExportPdf={exportGroupPDF}
          onExportExcel={exportGroupExcel}
          onShareWhatsApp={handleShareWhatsApp}
          loadingPdf={exportingPdf}
          loadingExcel={exportingExcel}
          recordCount={expenses.length}
        />
      )}

      {/* Settlement History Log Modal */}
      {showSettlementModal && selectedGroup && (
        <Modal title={`Settlement History — ${selectedGroup.name}`} onClose={() => setShowSettlementModal(false)}>
          <div className="settlement-history-modal" style={{ padding: '0.5rem 0' }}>
            {settlements.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-secondary)' }}>
                <CheckCircle2 size={40} style={{ margin: '0 auto 0.75rem', opacity: 0.4 }} />
                <h4 style={{ margin: '0 0 0.25rem' }}>No Settlements Logged Yet</h4>
                <p style={{ fontSize: '0.85rem', maxWidth: '360px', margin: '0 auto' }}>
                  When members pay off their balances, click the "Settle" button on the Who Pays Whom cards to automatically record payments here.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', maxHeight: '360px', overflowY: 'auto', paddingRight: '4px' }}>
                {settlements.map(s => (
                  <div key={s.id} style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.75rem 1rem',
                    borderRadius: '8px',
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.08)'
                  }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                        <span style={{ color: 'var(--accent-color)' }}>{s.payer_name}</span> paid <span style={{ color: 'var(--success-color)' }}>{s.receiver_name}</span>
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '3px' }}>
                        {s.note ? `${s.note} · ` : ''}{s.settled_at ? new Date(s.settled_at).toLocaleDateString() : ''}
                      </div>
                    </div>
                    <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--success-color)' }}>
                      {formatCurrency(s.amount, s.currency)}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="modal-actions" style={{ marginTop: '1.25rem' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowSettlementModal(false)}>Close</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Live Group Invite QR Code Modal */}
      {showQrModal && qrGroup && (
        <Modal title={`Invite Friends — ${qrGroup.name}`} onClose={() => setShowQrModal(false)}>
          <div className="split-qr-modal">
            <p className="text-muted" style={{ fontSize: '0.86rem', margin: '0 0 0.85rem' }}>
              Friends can scan this QR code with any camera or phone to instantly join and live-manage expenses together.
            </p>

            <div className="split-qr-box">
              {qrDataUrl ? (
                <img src={qrDataUrl} alt="Group Invite QR Code" className="split-qr-canvas" width={240} height={240} />
              ) : (
                <div style={{ width: 240, height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div className="spinner"></div>
                </div>
              )}
            </div>

            <div style={{ fontSize: '0.82rem', fontWeight: 600, marginTop: '0.5rem', color: 'var(--text-color)' }}>
              Invite Link:
            </div>

            <div className="split-qr-link-row">
              <input
                type="text"
                readOnly
                value={qrInviteUrl}
                className="split-qr-link-input"
                onClick={e => e.target.select()}
              />
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleCopyQrLink}
                title="Copy Invite Link"
                style={{ flexShrink: 0, padding: '0.5rem 0.85rem' }}
              >
                {copiedQrLink ? <CheckCheck size={14} color="#34d399" /> : <Copy size={14} />}
                <span>{copiedQrLink ? 'Copied!' : 'Copy'}</span>
              </button>
            </div>

            <div className="split-qr-actions-row">
              <button
                type="button"
                className="btn btn-whatsapp"
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={handleShareQrWhatsApp}
              >
                <MessageCircle size={16} /> Share via WhatsApp
              </button>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ flex: 1, justifyContent: 'center' }}
                  onClick={handleDownloadQrImage}
                  disabled={!qrDataUrl}
                >
                  <Download size={14} /> Download QR PNG
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ flex: 1, justifyContent: 'center' }}
                  onClick={() => setShowQrModal(false)}
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
