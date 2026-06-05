import React, { useEffect, useState } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import {
  TrendingUp, TrendingDown, PiggyBank, Calendar,
  ArrowUpCircle, ArrowDownCircle, FileDown
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, PieChart, Pie, Cell
} from 'recharts';
import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import { formatCurrency, formatCurrencyNoDecimals, exportSvgToPng } from '../utils';
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
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [report, setReport] = useState({ income: 0, expense: 0, savings: 0 });
  const [yearlyReport, setYearlyReport] = useState({ income: 0, expense: 0, savings: 0 });
  const [recentTxns, setRecentTxns] = useState([]);
  const [pieData, setPieData] = useState([]);
  const [trendData, setTrendData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exportingPdf, setExportingPdf] = useState(false);

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
    } catch (err) {
      console.error('PDF export failed:', err);
    } finally {
      setExportingPdf(false);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [monthlyRes, yearlyRes, txnsRes, pieRes, trendRes] = await Promise.all([
        api.get(`/reports/monthly?month=${month}&year=${year}`),
        api.get(`/reports/yearly?year=${year}`),
        api.get(`/transactions?month=${month}&year=${year}`),
        api.get(`/reports/category-breakdown?month=${month}&year=${year}`),
        api.get(`/reports/monthly-trend?year=${year}`),
      ]);
      setReport(monthlyRes.data);
      setYearlyReport(yearlyRes.data);
      setRecentTxns(txnsRes.data.slice(0, 6));
      setPieData(pieRes.data);
      setTrendData(trendRes.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const months = ['January','February','March','April','May','June',
    'July','August','September','October','November','December'];

  return (
    <div className="dashboard animate-fade-in">
      <div className="dashboard-header">
        <div>
          <h2>Dashboard</h2>
          <p className="text-muted">Welcome back, <strong>{user?.username}</strong></p>
        </div>
        <div className="dashboard-filters">
          <select value={month} onChange={e => setMonth(Number(e.target.value))}>
            {months.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <select value={year} onChange={e => setYear(Number(e.target.value))}>
            {[2023, 2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button
            className="btn btn-secondary"
            onClick={exportDashboardPDF}
            disabled={exportingPdf || loading}
            title="Export Visual PDF Report"
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <FileDown size={15} />
            {exportingPdf ? 'Generating...' : 'Export PDF'}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="loading-state text-muted">Loading data...</div>
      ) : (
        <>
          <div className="stat-grid">
            <StatCard label="Monthly Income" value={report.income} icon={TrendingUp} colorClass="stat-income" subtitle={`${months[month-1]} ${year}`} />
            <StatCard label="Monthly Expenses" value={report.expense} icon={TrendingDown} colorClass="stat-expense" subtitle={`${months[month-1]} ${year}`} />
            <StatCard label="Monthly Savings" value={report.savings} icon={PiggyBank} colorClass={report.savings >= 0 ? 'stat-savings' : 'stat-expense'} subtitle="Income − Expenses" />
            <StatCard label="Yearly Income" value={yearlyReport.income} icon={Calendar} colorClass="stat-yearly" subtitle={`Full year ${year}`} />
          </div>

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
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={90}
                        dataKey="value" nameKey="name" paddingAngle={3}
                        label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`}
                        labelLine={false}>
                        {pieData.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v) => formatCurrencyNoDecimals(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>

          {/* Recent Transactions */}
          <div className="dashboard-section">
            <h3>Recent Transactions</h3>
            {recentTxns.length === 0 ? (
              <div className="empty-state glass-panel">
                <p className="text-muted">No transactions this month. Add one from the Transactions page!</p>
              </div>
            ) : (
              <div className="glass-panel recent-txn-table">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Type</th><th>Category</th><th>Description</th><th>Date</th><th>Amount</th>
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
    </div>
  );
}
