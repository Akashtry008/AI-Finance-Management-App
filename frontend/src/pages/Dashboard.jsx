import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import confetti from 'canvas-confetti';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import {
  TrendingUp, TrendingDown, PiggyBank, Calendar,
  ArrowUpCircle, ArrowDownCircle, FileDown, MessageCircle, Sparkles,
  Flame, ShieldCheck, AlertTriangle, Gauge, BellRing, CheckCircle2,
  ArrowRight, Clock, Sliders, CalendarRange, ArrowUpRight, ArrowDownRight,
  Store, X, Activity, RefreshCw
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, PieChart, Pie, Cell
} from 'recharts';
import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import {
  formatCurrency, formatCurrencyNoDecimals, exportSvgToPng,
  buildWhatsAppShareUrl, exportTableToExcel, formatErrorMessage
} from '../utils';
import { useDialog } from '../context/DialogContext';
import { getRecurringBills, getBillDueStatus, markBillAsPaid, syncRecurringBillsWithBackend } from '../recurringBillsStore';
import ExportReportModal from '../components/ExportReportModal';
import FinancialHealthCard from '../components/FinancialHealthCard';
import { useTranslation, formatMonthName } from '../i18n';
import './Dashboard.css';

const PIE_COLORS = ['#10b981','#3b82f6','#f59e0b','#ef4444','#8b5cf6','#ec4899','#06b6d4','#84cc16'];

function StatCard({ label, value, icon: Icon, colorClass, subtitle }) {
  return (
    <div className={`stat-card glass-panel ${colorClass}`}>
      <div className="stat-card-header">
        <span className="stat-label">{label}</span>
        <div className="stat-icon-wrap"><Icon size={20} /></div>
      </div>
      <div className="stat-value">{formatCurrency(value || 0)}</div>
      {subtitle && <div className="stat-subtitle text-muted">{subtitle}</div>}
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="chart-tooltip">
        <p className="chart-tooltip-label">{label}</p>
        {payload.map((p, i) => (
          <p key={i} style={{ color: p.color }}>
            {p.name}: {formatCurrencyNoDecimals(p.value)}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function Dashboard() {
  const { user } = useAuth();
  const { showAlert } = useDialog();
  const { t, currentLang } = useTranslation();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [report, setReport] = useState({ income: 0, expense: 0, savings: 0 });
  const [yearlyReport, setYearlyReport] = useState({ income: 0, expense: 0, savings: 0 });
  const [recentTxns, setRecentTxns] = useState([]);
  const [pieData, setPieData] = useState([]);
  const [trendData, setTrendData] = useState([]);
  const [categories, setCategories] = useState([]);
  const [goals, setGoals] = useState([]);
  const [budgetsSummary, setBudgetsSummary] = useState([]);
  const [pendingDebt, setPendingDebt] = useState(0);
  const [recurringBills, setRecurringBills] = useState(() => getRecurringBills());
  const [simDailySpend, setSimDailySpend] = useState(null);
  const [simActive, setSimActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);

  const [viewMode, setViewMode] = useState('month');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [isRangeApplied, setIsRangeApplied] = useState(false);
  const [comparison, setComparison] = useState(null);
  const [compTab, setCompTab] = useState('mom');
  const [showWrapped, setShowWrapped] = useState(false);
  const [wrappedYear, setWrappedYear] = useState(() => (new Date().getFullYear() - 1));
  const [wrappedData, setWrappedData] = useState(null);
  const [loadingWrapped, setLoadingWrapped] = useState(false);
  const cardConfettiRef = useRef(null);

  useEffect(() => {
    syncRecurringBillsWithBackend().catch(() => {});
    const handleBillsUpdate = (e) => {
      setRecurringBills(e.detail || getRecurringBills());
    };
    window.addEventListener('recurringBillsUpdated', handleBillsUpdate);
    return () => window.removeEventListener('recurringBillsUpdated', handleBillsUpdate);
  }, []);

  useEffect(() => { fetchData(); }, [month, year]);

  const exportDashboardPDF = async () => {
    setExportingPdf(true);
    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageW = doc.internal.pageSize.getWidth();
      const monthName = months[month - 1];

      // ── Header ──────────────────────────────────────────────────────────
      doc.setFillColor(16, 185, 129);
      doc.rect(0, 0, pageW, 28, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(20);
      doc.setTextColor(255, 255, 255);
      doc.text('FinanceOS', 14, 12);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.text(`Monthly Financial Report — ${monthName} ${year}`, 14, 21);
      doc.setTextColor(40, 40, 40);

      // ── Summary Stats Row ────────────────────────────────────────────────
      let y = 36;
      const stats = [
        { label: 'Income',  value: report.income,  color: [16, 185, 129] },
        { label: 'Expenses', value: report.expense, color: [239, 68, 68] },
        { label: 'Savings', value: report.savings,  color: report.savings >= 0 ? [59, 130, 246] : [239, 68, 68] },
      ];
      const colW = (pageW - 28) / 3;
      stats.forEach((s, i) => {
        const x = 14 + i * (colW + 3);
        doc.setFillColor(...s.color);
        doc.roundedRect(x, y, colW, 16, 2, 2, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(255, 255, 255);
        doc.text(s.label.toUpperCase(), x + 3, y + 6);
        doc.setFontSize(12);
        doc.text(formatCurrency(s.value), x + 3, y + 13);
      });
      y += 22;

      // ── Spending Chart (SVG → PNG) ───────────────────────────────────────
      const isDark = document.documentElement.classList.contains('dark') ||
        document.body.dataset.theme === 'dark';
      const pieImg = await exportSvgToPng('dashboard-pie-chart', isDark);
      if (pieImg) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(40, 40, 40);
        doc.text(`Spending by Category — ${monthName}`, 14, y + 6);
        y += 9;
        const imgH = 65;
        const imgW = pageW - 28;
        doc.addImage(pieImg, 'PNG', 14, y, imgW, imgH);
        y += imgH + 6;
      }

      // ── Category Breakdown Table ─────────────────────────────────────────
      if (pieData.length > 0) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(40, 40, 40);
        doc.text('Category Breakdown', 14, y + 5);
        y += 8;
        autoTable(doc, {
          startY: y,
          head: [['Category', 'Amount', '% of Total']],
          body: pieData.map(p => {
            const total = pieData.reduce((a, b) => a + b.value, 0);
            return [p.name, formatCurrency(p.value), `${((p.value / total) * 100).toFixed(1)}%`];
          }),
          theme: 'grid',
          headStyles: { fillColor: [16, 185, 129], textColor: 255 },
          alternateRowStyles: { fillColor: [245, 245, 245] },
          styles: { fontSize: 9 },
          margin: { left: 14, right: 14 },
        });
        y = doc.lastAutoTable.finalY + 8;
      }

      // ── Recent Transactions Table ────────────────────────────────────────
      if (recentTxns.length > 0) {
        if (y > 220) { doc.addPage(); y = 14; }
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(40, 40, 40);
        doc.text('Recent Transactions', 14, y + 5);
        y += 8;
        autoTable(doc, {
          startY: y,
          head: [['Date', 'Type', 'Category', 'Description', 'Amount']],
          body: recentTxns.map(t => [
            new Date(t.txn_date).toLocaleDateString(),
            t.category_type.toUpperCase(),
            t.category_name,
            t.description || '—',
            formatCurrency(t.amount),
          ]),
          theme: 'striped',
          headStyles: { fillColor: [59, 130, 246], textColor: 255 },
          styles: { fontSize: 9 },
          margin: { left: 14, right: 14 },
        });
      }

      // ── Footer ───────────────────────────────────────────────────────────
      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(160, 160, 160);
        doc.text(
          `FinanceOS Report — Generated ${new Date().toLocaleString()} — Page ${i} of ${pageCount}`,
          pageW / 2, doc.internal.pageSize.getHeight() - 8,
          { align: 'center' }
        );
      }

      doc.save(`FinanceOS_${monthName}_${year}_Report.pdf`);
      setShowExportModal(false);
    } catch (err) {
      console.error('PDF export failed:', err);
    } finally {
      setExportingPdf(false);
    }
  };

  const exportDashboardExcel = () => {
    setExportingExcel(true);
    try {
      const monthName = months[month - 1];
      const activeCurr = localStorage.getItem('finance-os-currency') || 'INR';
      const savingsRate = report.income > 0 ? ((report.savings / report.income) * 100).toFixed(1) : '0.0';

      const secKPI = {
        title: "1. MONTHLY FINANCIAL EXECUTIVE SUMMARY",
        headers: ["Metric Description", "Amount", "Currency", "Performance Indicator"],
        rows: [
          ["Total Monthly Income", report.income, activeCurr, `${monthName} ${year} inflow`],
          ["Total Monthly Expenses", report.expense, activeCurr, "All expense categories combined"],
          ["Net Monthly Savings", report.savings, activeCurr, report.savings >= 0 ? "Positive Net Cashflow" : "Budget Deficit"],
          ["Savings Rate Percentage", `${savingsRate}%`, "%", "Portion of income saved"],
          ["Full Year Income", yearlyReport.income, activeCurr, `Calendar year ${year} cumulative`]
        ]
      };

      const totalPie = pieData.reduce((acc, p) => acc + p.value, 0);
      const secCategories = {
        title: "2. CATEGORY SPENDING BREAKDOWN",
        headers: ["Category Name", `Spent (${activeCurr})`, "% of Total Monthly Outflow"],
        rows: pieData.map(p => [
          p.name,
          p.value,
          totalPie > 0 ? `${((p.value / totalPie) * 100).toFixed(1)}%` : '0%'
        ]),
        summary: ["Total Expense Categories", totalPie, "100.0%"]
      };

      const secRecent = {
        title: "3. RECENT TRANSACTIONS REGISTER",
        headers: ["Date", "Type", "Category", "Description", `Amount (${activeCurr})`],
        rows: recentTxns.map(t => [
          t.txn_date,
          t.category_type.toUpperCase(),
          t.category_name,
          t.description || '—',
          t.amount
        ])
      };

      exportTableToExcel(`FinanceOS_${monthName}_${year}_Financial_Report`, {
        title: `FinanceOS — Monthly Financial Statement (${monthName} ${year})`,
        subtitle: `Executive Overview, Category Breakdown & Transaction Ledger`,
        sections: [secKPI, secCategories, secRecent],
        activeCurr
      });
      setShowExportModal(false);
    } catch (err) {
      console.error('Excel export error:', err);
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
    const monthName = months[month - 1];
    const activeCurr = localStorage.getItem('finance-os-currency') || 'INR';
    const savingsRate = report.income > 0 ? ((report.savings / report.income) * 100).toFixed(1) : '0.0';

    const text = `📊 *Monthly Financial Report — ${monthName} ${year}*
━━━━━━━━━━━━━━━━━━━━
💵 *Income:* ${formatCurrency(report.income, activeCurr)}
💳 *Expenses:* ${formatCurrency(report.expense, activeCurr)}
💰 *Net Savings:* ${report.savings >= 0 ? '+' : ''}${formatCurrency(report.savings, activeCurr)} (${savingsRate}% saved)
📈 *Yearly Income:* ${formatCurrency(yearlyReport.income, activeCurr)}

━━━━━━━━━━━━━━━━━━━━
✨ Tracked with *FinanceOS* (100% Free & Unlimited Alternative to Splitwise & Mint)`;

    window.open(buildWhatsAppShareUrl(text), '_blank', 'noopener,noreferrer');
  };

  async function fetchData() {
    setLoading(true);
    try {
      const [monthlyRes, yearlyRes, txnsRes, pieRes, trendRes, catsRes, compRes, goalsRes, budgetsRes, debtRes] = await Promise.all([
        api.get(`/reports/monthly?month=${month}&year=${year}`),
        api.get(`/reports/yearly?year=${year}`),
        api.get(`/transactions?month=${month}&year=${year}`),
        api.get(`/reports/category-breakdown?month=${month}&year=${year}`),
        api.get(`/reports/monthly-trend?year=${year}`),
        api.get('/categories').catch(() => ({ data: [] })),
        api.get(`/reports/comparison?month=${month}&year=${year}`).catch(() => ({ data: null })),
        api.get('/goals').catch(() => ({ data: [] })),
        api.get(`/budgets/summary?month=${month}&year=${year}`).catch(() => ({ data: [] })),
        api.get('/split/debt-summary').catch(() => ({ data: { pending_group_debt: 0 } })),
      ]);
      setReport(monthlyRes.data);
      setYearlyReport(yearlyRes.data);
      setRecentTxns(txnsRes.data.slice(0, 6));
      setPieData(pieRes.data);
      setTrendData(trendRes.data);
      setCategories(catsRes.data || []);
      setComparison(compRes?.data || null);
      setGoals(goalsRes?.data || []);
      setBudgetsSummary(budgetsRes.data || []);
      setPendingDebt(debtRes.data?.pending_group_debt || 0);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleApplyRange = async (e) => {
    if (e) e.preventDefault();
    if (!startDate || !endDate) return;
    setLoading(true);
    try {
      const [rangeRes, txnsRes] = await Promise.all([
        api.get(`/reports/range?start_date=${startDate}&end_date=${endDate}`),
        api.get(`/transactions?start_date=${startDate}&end_date=${endDate}`),
      ]);
      setReport({
        income: rangeRes.data.income || 0,
        expense: rangeRes.data.expense || 0,
        savings: rangeRes.data.savings || 0
      });
      setPieData(rangeRes.data.categories?.map(c => ({ name: c.category, value: c.spent })) || []);
      setRecentTxns(txnsRes.data.slice(0, 8));
      setIsRangeApplied(true);
    } catch (err) {
      showAlert({
        title: 'Range Filter Error',
        message: formatErrorMessage(err, 'Failed to fetch range data.'),
        type: 'danger'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResetToMonth = () => {
    setIsRangeApplied(false);
    setViewMode('month');
    fetchData();
  };

  const triggerCardConfetti = () => {
    if (!cardConfettiRef.current) return;
    try {
      const myConfetti = confetti.create(cardConfettiRef.current, {
        resize: true,
        useWorker: false
      });
      myConfetti({
        particleCount: 85,
        spread: 75,
        origin: { y: 0.35 }
      });
    } catch (e) {
      console.error('In-card confetti error:', e);
    }
  };

  const openWrapped = async (targetYear) => {
    const yr = Number(targetYear || (year - 1));
    setWrappedYear(yr);
    setShowWrapped(true);
    setLoadingWrapped(true);
    try {
      const res = await api.get(`/reports/wrapped?year=${yr}`);
      setWrappedData(res.data);
      setTimeout(() => {
        triggerCardConfetti();
      }, 150);
    } catch (err) {
      showAlert({
        title: 'Year in Review Error',
        message: formatErrorMessage(err, 'Failed to load year in review.'),
        type: 'danger'
      });
      setShowWrapped(false);
    } finally {
      setLoadingWrapped(false);
    }
  };

  const handlePayRecurringBill = async (bill) => {
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
      markBillAsPaid(bill.id, month, year);
      fetchData();
    } catch (err) {
      console.warn('Could not post txn to backend, marking in store:', err);
      markBillAsPaid(bill.id, month, year);
      fetchData();
    }
  };

  const months = Array.from({ length: 12 }, (_, i) => formatMonthName(i + 1, currentLang));

  return (
    <div className="dashboard animate-fade-in">
      <div className="dashboard-header">
        <div>
          <h2>{t('dashboard', 'Dashboard')}</h2>
          <p className="text-muted">{t('welcomeBackUser', 'Welcome back')}, <strong>{user?.username}</strong> — {t('financialOverview', 'Financial overview & insights')}</p>
        </div>
        <div className="dashboard-filters">
          <div className="view-mode-pill">
            <button
              type="button"
              className={`view-mode-btn ${viewMode === 'month' ? 'active' : ''}`}
              onClick={handleResetToMonth}
            >
              {t('monthly', 'Monthly')}
            </button>
            <button
              type="button"
              className={`view-mode-btn ${viewMode === 'range' ? 'active' : ''}`}
              onClick={() => setViewMode('range')}
            >
              <CalendarRange size={13} style={{ display: 'inline', marginRight: '4px' }} />
              {t('customRange', 'Custom Range')}
            </button>
          </div>

          {viewMode === 'month' ? (
            <>
              <select value={month} onChange={e => { setMonth(Number(e.target.value)); setIsRangeApplied(false); }}>
                {months.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>
              <select value={year} onChange={e => { setYear(Number(e.target.value)); setIsRangeApplied(false); }}>
                {[2023, 2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              <button
                className="btn btn-wrapped"
                onClick={() => openWrapped(year - 1)}
                title={t('celebrateData', `Celebrate Previous Year Data`)}
                style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}
              >
                <Sparkles size={14} />
                {t('celebrateData', 'Celebrate')} {year - 1}
              </button>
            </>
          ) : (
            <form onSubmit={handleApplyRange} className="custom-range-row">
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                required
                title="Start Date"
              />
              <span className="text-muted" style={{ fontSize: '0.8rem' }}>{t('to', 'to')}</span>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                required
                title="End Date"
              />
              <button
                type="submit"
                className="btn btn-primary"
                style={{ fontSize: '0.82rem', padding: '0.4rem 0.75rem' }}
              >
                {t('apply', 'Apply')}
              </button>
              {isRangeApplied && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleResetToMonth}
                  style={{ fontSize: '0.82rem', padding: '0.4rem 0.65rem' }}
                  title="Reset to Monthly View"
                >
                  <RefreshCw size={13} />
                </button>
              )}
            </form>
          )}

          <button
            className="btn btn-whatsapp"
            onClick={handleShareWhatsApp}
            disabled={loading}
            title="Share Monthly Financial Summary via WhatsApp"
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <MessageCircle size={15} />
            {t('shareWhatsApp', 'Share')}
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => setShowExportModal(true)}
            disabled={loading}
            title="Export Monthly Report (PDF or Excel Table)"
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <FileDown size={15} />
            {t('export', 'Export')}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="loading-state text-muted">{t('loadingData', 'Loading data...')}</div>
      ) : (
        <>
          {isRangeApplied && (
            <div className="range-active-banner animate-fade-in">
              <div>
                <strong>📅 {t('customRangeActive', 'Custom Date Range Active')}:</strong> {startDate} &rarr; {endDate}
              </div>
              <button
                className="btn btn-secondary"
                onClick={handleResetToMonth}
                style={{ fontSize: '0.78rem', padding: '0.25rem 0.6rem' }}
              >
                Back to Monthly View
              </button>
            </div>
          )}

          <div className="stat-grid">
            <StatCard
              label={isRangeApplied ? t('rangeIncome', "Range Income") : t('income', "Monthly Income")}
              value={report.income}
              icon={TrendingUp}
              colorClass="stat-income"
              subtitle={isRangeApplied ? `${startDate} to ${endDate}` : `${months[month-1]} ${year}`}
            />
            <StatCard
              label={isRangeApplied ? t('rangeExpenses', "Range Expenses") : t('expense', "Monthly Expenses")}
              value={report.expense}
              icon={TrendingDown}
              colorClass="stat-expense"
              subtitle={isRangeApplied ? `${startDate} to ${endDate}` : `${months[month-1]} ${year}`}
            />
            <StatCard
              label={isRangeApplied ? t('rangeSavings', "Range Savings") : t('savings', "Monthly Savings")}
              value={report.savings}
              icon={PiggyBank}
              colorClass={report.savings >= 0 ? 'stat-savings' : 'stat-expense'}
              subtitle={t('incomeMinusExpenses', "Income − Expenses")}
            />
            <StatCard
              label={t('yearlyIncome', "Yearly Income")}
              value={yearlyReport.income}
              icon={Calendar}
              colorClass="stat-yearly"
              subtitle={`Full year ${year}`}
            />
          </div>

          {/* Proprietary Financial Health Index (0–1000 Score) */}
          <FinancialHealthCard
            report={report}
            budgets={budgetsSummary}
            goals={goals}
            recurringBills={recurringBills}
            pendingGroupDebt={pendingDebt}
          />

          {/* Daily "Safe-to-Spend" Burn Rate & Subscription Radar Highlights */}
          {(() => {
            const today = new Date();
            const isCurrentMonth = today.getFullYear() === year && (today.getMonth() + 1) === month;
            const daysInMonth = new Date(year, month, 0).getDate();
            const daysElapsed = isCurrentMonth
              ? today.getDate()
              : (year < today.getFullYear() || (year === today.getFullYear() && month < (today.getMonth() + 1)) ? daysInMonth : 0);
            const daysRemaining = isCurrentMonth
              ? Math.max(1, daysInMonth - today.getDate() + 1)
              : (daysElapsed === 0 ? daysInMonth : 0);

            const safeDaily = daysRemaining > 0 && report.savings > 0
              ? (report.savings / daysRemaining)
              : 0;

            const actualDailyBurn = daysElapsed > 0
              ? (report.expense / daysElapsed)
              : 0;

            let burnHealth = 'safe';
            if (report.savings < 0) {
              burnHealth = 'deficit';
            } else if (actualDailyBurn > safeDaily * 1.25 && safeDaily > 0) {
              burnHealth = 'warning';
            }

            const activeSpendToTest = simDailySpend !== null ? simDailySpend : Math.round(safeDaily || 500);
            const daysSimulatedFundsLast = activeSpendToTest > 0 && report.savings > 0
              ? Math.min(daysInMonth * 2, Math.floor(report.savings / activeSpendToTest))
              : 0;

            const billsWithStatus = recurringBills.map(b => ({
              ...b,
              statusInfo: getBillDueStatus(b, month, year)
            }));
            const unpaidBillsCount = billsWithStatus.filter(b => b.statusInfo.status !== 'paid').length;
            const totalRecurringMonthly = recurringBills.reduce((acc, b) => acc + (parseFloat(b.amount) || 0), 0);

            return (
              <div className="dashboard-highlight-row">
                {/* 1. Daily "Safe-to-Spend" Burn Rate Card */}
                <div className="glass-panel burn-rate-card">
                  <div className="burn-rate-header">
                    <div className="burn-rate-title-wrap">
                      <div className="burn-icon-circle">
                        <Gauge size={20} />
                      </div>
                      <div>
                        <h4>{t('dailySafePace', 'Daily "Safe-to-Spend" Pace')}</h4>
                        <span className="text-muted" style={{ fontSize: '0.78rem' }}>
                          {t('burnVelocityGauge', 'Burn velocity gauge for')} {months[month - 1]} {year}
                        </span>
                      </div>
                    </div>

                    <div className={`burn-health-badge ${burnHealth}`}>
                      {burnHealth === 'safe' && <><ShieldCheck size={13} /> {t('safeSustainable', 'Safe & Sustainable')}</>}
                      {burnHealth === 'warning' && <><Flame size={13} /> {t('highVelocityBurn', 'High Velocity Burn')}</>}
                      {burnHealth === 'deficit' && <><AlertTriangle size={13} /> {t('budgetDeficit', 'Budget Deficit')}</>}
                    </div>
                  </div>

                  <div className="burn-rate-body">
                    <div className="burn-main-metric">
                      <span className={`burn-number ${burnHealth === 'deficit' ? 'burn-number-deficit' : ''}`}>
                        {formatCurrency(safeDaily > 0 ? safeDaily : 0)}
                      </span>
                      <span className="burn-unit">{t('perDay', '/ day')}</span>
                    </div>
                    <p className="burn-explanation text-muted">
                      {report.savings > 0 ? (
                        <>You have <strong>{formatCurrency(report.savings)}</strong> remaining across <strong>{daysRemaining} day{daysRemaining > 1 ? 's' : ''}</strong> left this month.</>
                      ) : (
                        <>Expenses exceed income by <strong className="text-danger">{formatCurrency(Math.abs(report.savings))}</strong>. Halt non-essential spending.</>
                      )}
                    </p>

                    <div className="burn-progress-container">
                      <div className="burn-progress-meta">
                        <span>{t('actualBurn', 'Actual Burn')}: <strong>{formatCurrency(actualDailyBurn)}/day</strong> ({daysElapsed} {t('daysPassed', 'days passed')})</span>
                        <span>{t('safeTarget', 'Safe Target')}: <strong>{formatCurrency(safeDaily)}/day</strong></span>
                      </div>
                      <div className="burn-progress-track">
                        <div
                          className={`burn-progress-fill ${burnHealth}`}
                          style={{
                            width: `${Math.min(100, Math.max(10, safeDaily > 0 ? (actualDailyBurn / safeDaily) * 60 : 100))}%`
                          }}
                        />
                      </div>
                    </div>

                    {/* Interactive Pace Simulator */}
                    <div className="burn-simulator-box">
                      <button
                        type="button"
                        className="burn-sim-toggle"
                        onClick={() => setSimActive(prev => !prev)}
                      >
                        <Sliders size={13} />
                        <span>{simActive ? 'Hide Pace Simulator' : 'Simulate Custom Daily Spend Pace'}</span>
                      </button>

                      {simActive && (
                        <div className="burn-sim-panel animate-fade-in">
                          <div className="burn-sim-slider-row">
                            <label>Test Daily Spend: <strong>{formatCurrency(activeSpendToTest)}</strong></label>
                            <input
                              type="range"
                              min={Math.max(50, Math.round(safeDaily * 0.2) || 100)}
                              max={Math.max(5000, Math.round(safeDaily * 3) || 10000)}
                              step={50}
                              value={activeSpendToTest}
                              onChange={e => setSimDailySpend(Number(e.target.value))}
                              className="burn-range-slider"
                            />
                          </div>
                          <div className="burn-sim-result">
                            <Clock size={13} />
                            <span>
                              At {formatCurrency(activeSpendToTest)}/day, funds will last <strong>{daysSimulatedFundsLast} days</strong>
                              {daysSimulatedFundsLast < daysRemaining ? ' (depletes before month ends!)' : ' (safe through month-end)'}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* 2. Recurring Bill & Subscription Radar Mini-Widget */}
                <div className="glass-panel recurring-radar-card">
                  <div className="radar-card-header">
                    <div className="radar-title-wrap">
                      <div className="radar-icon-circle">
                        <BellRing size={20} />
                      </div>
                      <div>
                        <h4>Subscription & Bill Radar</h4>
                        <span className="text-muted" style={{ fontSize: '0.78rem' }}>
                          {unpaidBillsCount > 0 ? `${unpaidBillsCount} upcoming bills` : 'All bills settled for this month!'}
                        </span>
                      </div>
                    </div>
                    <span className="radar-commitment-tag" title="Total monthly committed recurring bills">
                      {formatCurrency(totalRecurringMonthly)}/mo
                    </span>
                  </div>

                  <div className="radar-bills-list">
                    {billsWithStatus.slice(0, 3).map(bill => (
                      <div key={bill.id} className="radar-bill-item">
                        <div className="radar-bill-left">
                          <span className="radar-bill-name">{bill.name}</span>
                          <span className={`radar-due-badge ${bill.statusInfo.badgeClass}`}>
                            {bill.statusInfo.label}
                          </span>
                        </div>
                        <div className="radar-bill-right">
                          <span className="radar-bill-amount">{formatCurrency(bill.amount)}</span>
                          {bill.statusInfo.status !== 'paid' ? (
                            <button
                              type="button"
                              className="radar-pay-btn"
                              onClick={() => handlePayRecurringBill(bill)}
                              title={`Log ${bill.name} as paid in transactions`}
                            >
                              <CheckCircle2 size={12} /> Pay
                            </button>
                          ) : (
                            <span className="radar-paid-pill">Paid</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="radar-footer">
                    <Link to="/budgets" className="radar-view-all-link">
                      <span>Manage All Recurring Bills in Radar</span>
                      <ArrowRight size={13} />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Period Comparison Card (MoM & YoY) */}
          {viewMode === 'month' && !isRangeApplied && comparison && (
            <div className="glass-panel period-comparison-card">
              <div className="period-comp-header">
                <h4>
                  <Activity size={18} color="var(--accent-color)" /> Period Performance Comparison
                </h4>
                <div className="period-comp-tabs">
                  <button
                    type="button"
                    className={`period-comp-tab ${compTab === 'mom' ? 'active' : ''}`}
                    onClick={() => setCompTab('mom')}
                  >
                    MoM vs Last Month ({comparison.mom?.period})
                  </button>
                  <button
                    type="button"
                    className={`period-comp-tab ${compTab === 'yoy' ? 'active' : ''}`}
                    onClick={() => setCompTab('yoy')}
                  >
                    YoY vs Last Year ({comparison.yoy?.period})
                  </button>
                </div>
              </div>

              {(() => {
                const activeData = compTab === 'mom' ? comparison.mom : comparison.yoy;
                if (!activeData) return null;

                const incDiff = activeData.income?.diff || 0;
                const incPct = activeData.income?.pct_change || 0;
                const expDiff = activeData.expense?.diff || 0;
                const expPct = activeData.expense?.pct_change || 0;
                const savDiff = activeData.savings?.diff || 0;
                const savPct = activeData.savings?.pct_change || 0;

                return (
                  <>
                    <div className="comp-metrics-grid">
                      <div className="comp-metric-box">
                        <div className="comp-metric-title">Income Shift</div>
                        <div className="comp-metric-values">
                          <span>{formatCurrency(activeData.income?.current || 0)}</span>
                          <span className={`comp-delta-badge ${incDiff >= 0 ? 'pos-good' : 'neg-bad'}`}>
                            {incDiff >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
                            {incDiff >= 0 ? '+' : ''}{incPct.toFixed(1)}% ({formatCurrency(incDiff)})
                          </span>
                        </div>
                      </div>

                      <div className="comp-metric-box">
                        <div className="comp-metric-title">Expense Shift</div>
                        <div className="comp-metric-values">
                          <span>{formatCurrency(activeData.expense?.current || 0)}</span>
                          <span className={`comp-delta-badge ${expDiff <= 0 ? 'pos-good' : 'neg-bad'}`}>
                            {expDiff <= 0 ? <ArrowDownRight size={13} /> : <ArrowUpRight size={13} />}
                            {expDiff > 0 ? '+' : ''}{expPct.toFixed(1)}% ({formatCurrency(expDiff)})
                          </span>
                        </div>
                      </div>

                      <div className="comp-metric-box">
                        <div className="comp-metric-title">Net Savings Shift</div>
                        <div className="comp-metric-values">
                          <span>{formatCurrency(activeData.savings?.current || 0)}</span>
                          <span className={`comp-delta-badge ${savDiff >= 0 ? 'pos-good' : 'neg-bad'}`}>
                            {savDiff >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
                            {savDiff >= 0 ? '+' : ''}{savPct.toFixed(1)}% ({formatCurrency(savDiff)})
                          </span>
                        </div>
                      </div>
                    </div>

                    {comparison.category_changes && comparison.category_changes.length > 0 && compTab === 'mom' && (
                      <div className="comp-shifts-row">
                        <span className="text-muted" style={{ fontWeight: 600 }}>Top Category Shifts:</span>
                        {comparison.category_changes.slice(0, 4).map((cc, i) => (
                          <div key={i} className="comp-shift-pill">
                            <span>{cc.category}:</span>
                            <strong style={{ color: cc.difference <= 0 ? '#10b981' : '#ef4444' }}>
                              {cc.difference > 0 ? '+' : ''}{cc.difference} ({cc.pct_change > 0 ? '+' : ''}{cc.pct_change}%)
                            </strong>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          )}

          {/* Charts Row */}
          <div className="charts-grid">
            {/* Bar Chart */}
            <div className="glass-panel chart-card">
              <h3 className="chart-title">Income vs Expenses — {year}</h3>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={trendData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--glass-border)" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} width={50}
                    tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: '0.8rem' }} />
                  <Bar dataKey="income" name="Income" fill="#10b981" radius={[4,4,0,0]} />
                  <Bar dataKey="expense" name="Expense" fill="#ef4444" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Pie Chart */}
            <div className="glass-panel chart-card">
              <h3 className="chart-title">Spending by Category — {months[month-1]}</h3>
              {pieData.length === 0 ? (
                <div className="chart-empty text-muted">No expense data for this month.</div>
              ) : (
                <div id="dashboard-pie-chart">
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart margin={{ top: 12, right: 35, bottom: 12, left: 35 }}>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="45%"
                        innerRadius={45}
                        outerRadius={70}
                        dataKey="value"
                        nameKey="name"
                        paddingAngle={3}
                        label={({ name, percent }) => `${name.length > 11 ? name.slice(0, 9) + '…' : name} ${(percent * 100).toFixed(0)}%`}
                        labelLine={true}
                      >
                        {pieData.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v) => formatCurrencyNoDecimals(v)} />
                      <Legend
                        verticalAlign="bottom"
                        height={32}
                        iconType="circle"
                        wrapperStyle={{ fontSize: '11px', paddingTop: '4px' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>

          {/* Recent Transactions */}
          <div className="dashboard-section">
            <h3>{t('recentTransactions', 'Recent Transactions')}</h3>
            {recentTxns.length === 0 ? (
              <div className="empty-state glass-panel">
                <p className="text-muted">{t('noTransactionsPeriod', 'No transactions recorded for this period.')}</p>
              </div>
            ) : (
              <div className="glass-panel recent-txn-table">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{t('type', 'Type')}</th><th>{t('category', 'Category')}</th><th>{t('description', 'Description')}</th><th>{t('date', 'Date')}</th><th>{t('amount', 'Amount')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentTxns.map(t => (
                      <tr key={t.id}>
                        <td>
                          <span className={`txn-badge ${t.category_type === 'income' ? 'badge-income' : 'badge-expense'}`}>
                            {t.category_type === 'income' ? <ArrowUpCircle size={14}/> : <ArrowDownCircle size={14}/>}
                            {t.category_type}
                          </span>
                        </td>
                        <td>{t.category_name}</td>
                        <td className="text-muted">{t.description || '—'}</td>
                        <td className="text-muted">{new Date(t.txn_date).toLocaleDateString('en-IN')}</td>
                        <td className={t.category_type === 'income' ? 'text-success' : 'text-danger'}>
                          {t.category_type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Export Report Format Options Modal (PDF or Excel Table) */}
      <ExportReportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        title="Export Monthly Financial Statement"
        subtitle={`Report for ${months[month - 1]} ${year}`}
        onExportPdf={exportDashboardPDF}
        onExportExcel={exportDashboardExcel}
        onShareWhatsApp={handleShareWhatsApp}
        loadingPdf={exportingPdf}
        loadingExcel={exportingExcel}
        recordCount={recentTxns.length}
      />

      {/* Financial Wrapped (Year in Review) Modal */}
      {showWrapped && (
        <div className="wrapped-overlay" onClick={() => setShowWrapped(false)}>
          <div className="wrapped-modal" onClick={e => e.stopPropagation()}>
            {/* Scoped In-Card Confetti Canvas */}
            <canvas ref={cardConfettiRef} className="wrapped-card-canvas" />

            {/* Accessible Contrasted Close Button */}
            <button
              type="button"
              className="wrapped-close-btn"
              onClick={() => setShowWrapped(false)}
              aria-label="Close celebration modal"
            >
              <X size={18} />
            </button>

            <div className="wrapped-modal-body">
              {/* Year Switcher Pills */}
              <div className="wrapped-year-switcher">
                {[year - 1, year - 2, year].filter(y => y >= 2020).map(y => (
                  <button
                    key={y}
                    type="button"
                    className={`wrapped-year-pill ${wrappedYear === y ? 'active' : ''}`}
                    onClick={() => openWrapped(y)}
                  >
                    {y} {y === year - 1 ? '★ Previous Year' : ''}
                  </button>
                ))}
              </div>

              {loadingWrapped ? (
                <div style={{ textAlign: 'center', padding: '3rem' }}>
                  <div className="spinner" style={{ margin: '0 auto 1rem' }}></div>
                  <p>Unwrapping your {wrappedYear} financial journey...</p>
                </div>
              ) : wrappedData ? (
                <>
                  <div className="wrapped-hero">
                    <Sparkles size={36} color="#ec4899" style={{ margin: '0 auto' }} />
                    <h2>{wrappedYear} Financial Celebration</h2>
                    <p className="text-muted" style={{ margin: 0 }}>
                      A complete breakdown of your {wrappedYear} spending, savings & milestones
                    </p>
                  </div>

                  <div className="wrapped-stats-grid">
                    <div className="wrapped-stat-box">
                      <div className="text-muted" style={{ fontSize: '0.75rem' }}>TOTAL INFLOW</div>
                      <div className="wrapped-stat-val" style={{ color: '#10b981' }}>{formatCurrency(wrappedData.total_income || 0)}</div>
                    </div>
                    <div className="wrapped-stat-box">
                      <div className="text-muted" style={{ fontSize: '0.75rem' }}>TOTAL SPENT</div>
                      <div className="wrapped-stat-val" style={{ color: '#ef4444' }}>{formatCurrency(wrappedData.total_expense || 0)}</div>
                    </div>
                    <div className="wrapped-stat-box">
                      <div className="text-muted" style={{ fontSize: '0.75rem' }}>NET SAVED</div>
                      <div className="wrapped-stat-val" style={{ color: '#38bdf8' }}>{formatCurrency(wrappedData.net_savings || 0)}</div>
                    </div>
                    <div className="wrapped-stat-box">
                      <div className="text-muted" style={{ fontSize: '0.75rem' }}>SAVINGS RATE</div>
                      <div className="wrapped-stat-val" style={{ color: '#facc15' }}>{wrappedData.savings_rate}%</div>
                    </div>
                  </div>

                  <div className="wrapped-highlights">
                    <div className="wrapped-highlight-card">
                      <h5 style={{ margin: '0 0 0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#c084fc' }}>
                        <Calendar size={15} /> Monthly Extremes
                      </h5>
                      <div style={{ fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span className="text-muted">Peak Spending Month:</span>
                          <strong>{wrappedData.highest_month?.[0]} ({formatCurrency(wrappedData.highest_month?.[1] || 0)})</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span className="text-muted">Most Frugal Month:</span>
                          <strong style={{ color: '#10b981' }}>{wrappedData.lowest_month?.[0]} ({formatCurrency(wrappedData.lowest_month?.[1] || 0)})</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span className="text-muted">Total Transactions:</span>
                          <strong>{wrappedData.total_transactions} logged</strong>
                        </div>
                      </div>
                    </div>

                    {wrappedData.top_merchant && (
                      <div className="wrapped-highlight-card">
                        <h5 style={{ margin: '0 0 0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#38bdf8' }}>
                          <Store size={15} /> Top Spot / Merchant
                        </h5>
                        <div style={{ fontSize: '0.85rem' }}>
                          <div className="wrapped-merchant-name">
                            {wrappedData.top_merchant.name}
                          </div>
                          <div className="text-muted">
                            Visited <strong>{wrappedData.top_merchant.visits} times</strong> with a total spend of <strong>{formatCurrency(wrappedData.top_merchant.total_spent || 0)}</strong>.
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {wrappedData.top_categories && wrappedData.top_categories.length > 0 && (
                    <div className="wrapped-highlight-card" style={{ marginBottom: '1.5rem' }}>
                      <h5 style={{ margin: '0 0 0.75rem', color: '#f472b6' }}>Top Spending Categories</h5>
                      <div className="wrapped-top-cats">
                        {wrappedData.top_categories.map((c, i) => (
                          <div key={i} className="wrapped-cat-row">
                            <span>{i + 1}. {c.category}</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                              <span className="text-muted">{c.percentage}%</span>
                              <strong>{formatCurrency(c.spent)}</strong>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', marginTop: '1.25rem' }}>
                    <button
                      type="button"
                      className="btn btn-wrapped"
                      onClick={triggerCardConfetti}
                    >
                      🎉 Celebrate Again
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setShowWrapped(false)}
                    >
                      Close
                    </button>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
