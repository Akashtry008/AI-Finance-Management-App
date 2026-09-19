import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import { formatCurrency } from '../utils';

export function buildPdfStatementDoc({
  title = 'FinanceOS Account Statement',
  periodLabel = 'Full Account History',
  user = {},
  transactions = [],
  budgets = [],
  goals = [],
  activeCurr = 'INR',
}) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const primaryColor = [79, 70, 229]; // #4f46e5
  const darkTextColor = [30, 41, 59]; // #1e293b
  const mutedTextColor = [100, 116, 139]; // #64748b

  // ── Header ───────────────────────────────────────────
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, 210, 28, 'F');

  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('FinanceOS', 14, 14);

  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(224, 231, 255);
  doc.text('Virtual Expense & Wealth Management Platform', 14, 21);

  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text(`Statement Period: ${periodLabel}`, 200, 14, { align: 'right' });
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, 200, 21, { align: 'right' });

  // ── User Information Block ────────────────────────────
  doc.setFontSize(10);
  doc.setTextColor(...darkTextColor);
  doc.setFont('helvetica', 'bold');
  doc.text(`Account Holder: ${user.display_name || user.username || 'User'}`, 14, 38);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...mutedTextColor);
  doc.text(`Email: ${user.email || 'N/A'}  |  Base Currency: ${activeCurr}`, 14, 44);

  // ── Financial Summary ─────────────────────────────────
  let totalIncome = 0;
  let totalExpense = 0;
  transactions.forEach((t) => {
    const amt = Number(t.amount) || 0;
    if (t.category_type === 'income') totalIncome += amt;
    else totalExpense += amt;
  });
  const netSavings = totalIncome - totalExpense;
  const savingsRate = totalIncome > 0 ? ((netSavings / totalIncome) * 100).toFixed(1) : 0;

  autoTable(doc, {
    startY: 50,
    head: [['Total Inflow (Income)', 'Total Outflow (Expense)', 'Net Savings', 'Savings Rate', 'Transactions Logged']],
    body: [[
      formatCurrency(totalIncome, activeCurr),
      formatCurrency(totalExpense, activeCurr),
      formatCurrency(netSavings, activeCurr),
      `${savingsRate}%`,
      String(transactions.length),
    ]],
    theme: 'grid',
    headStyles: { fillColor: primaryColor, textColor: 255, fontStyle: 'bold', halign: 'center' },
    bodyStyles: { textColor: darkTextColor, halign: 'center', fontSize: 9.5, fontStyle: 'bold' },
    margin: { left: 14, right: 14 },
  });

  // ── Transactions Table ────────────────────────────────
  const txnRows = transactions.slice(0, 150).map((t) => [
    t.txn_date,
    (t.category_type || 'expense').toUpperCase(),
    t.category_name || 'General',
    t.tags || '—',
    t.description || '—',
    formatCurrency(t.amount, activeCurr),
  ]);

  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 10,
    head: [['Date', 'Type', 'Category', 'Tags', 'Description', 'Amount']],
    body: txnRows.length > 0 ? txnRows : [['—', '—', 'No transactions found', '—', '—', '—']],
    theme: 'striped',
    headStyles: { fillColor: [51, 65, 85], textColor: 255, fontStyle: 'bold' },
    styles: { fontSize: 8.5, cellPadding: 2.2 },
    columnStyles: {
      0: { cellWidth: 24 },
      1: { cellWidth: 20 },
      2: { cellWidth: 32 },
      3: { cellWidth: 28 },
      4: { cellWidth: 50 },
      5: { cellWidth: 32, halign: 'right' },
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 14, right: 14 },
  });

  // ── Category Breakdown Summary ────────────────────────
  const catMap = {};
  transactions.forEach((t) => {
    if (t.category_type === 'expense') {
      const c = t.category_name || 'Other';
      catMap[c] = (catMap[c] || 0) + (Number(t.amount) || 0);
    }
  });

  const catRows = Object.entries(catMap)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, amt]) => {
      const pct = totalExpense > 0 ? ((amt / totalExpense) * 100).toFixed(1) : 0;
      return [cat, formatCurrency(amt, activeCurr), `${pct}%`];
    });

  if (catRows.length > 0) {
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 10,
      head: [['Expense Category', 'Total Spent', '% of Total Expense']],
      body: catRows,
      theme: 'grid',
      headStyles: { fillColor: primaryColor, textColor: 255 },
      styles: { fontSize: 8.5 },
      columnStyles: {
        0: { cellWidth: 70 },
        1: { cellWidth: 60, halign: 'right' },
        2: { cellWidth: 56, halign: 'center' },
      },
      margin: { left: 14, right: 14 },
    });
  }

  // ── Footer with page numbers ──────────────────────────
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `FinanceOS • Virtual Expense Platform • Page ${i} of ${pageCount}`,
      105,
      290,
      { align: 'center' }
    );
  }

  return doc;
}

export function downloadPdfStatement(fileName, options) {
  const doc = buildPdfStatementDoc(options);
  doc.save(fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`);
}

export function getPdfStatementBlob(options) {
  const doc = buildPdfStatementDoc(options);
  return doc.output('blob');
}
