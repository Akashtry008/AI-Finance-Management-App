import JSZip from 'jszip';
import { getPdfStatementBlob } from './pdfStatement';
import { downloadBlob, formatCurrency } from '../utils';

/**
 * Builds an Excel compatible HTML workbook for transactions and budgets.
 */
function buildExcelXml({ title, subtitle, user, transactions = [], budgets = [], goals = [], activeCurr = 'INR' }) {
  let html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta http-equiv="content-type" content="application/vnd.ms-excel; charset=UTF-8">
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
    .title { font-size: 16pt; font-weight: bold; color: #1e1b4b; background-color: #e0e7ff; height: 36px; }
    .sub { font-size: 9.5pt; color: #475569; font-style: italic; }
    .head { font-size: 10.5pt; font-weight: bold; color: #ffffff; background-color: #4f46e5; height: 26px; }
    .th { font-weight: bold; background-color: #f1f5f9; color: #1e293b; border: 1px solid #cbd5e1; }
    .td { border: 1px solid #e2e8f0; font-size: 9pt; }
    .td-r { border: 1px solid #e2e8f0; font-size: 9pt; text-align: right; }
  </style>
</head>
<body>
  <table border="0">
    <tr><td colspan="6" class="title">${title || 'FinanceOS Financial Ledger'}</td></tr>
    <tr><td colspan="6" class="sub">${subtitle || ''} | Account: ${user?.username || 'User'} | Currency: ${activeCurr} | Exported: ${new Date().toLocaleString()}</td></tr>
    <tr><td colspan="6"></td></tr>

    <tr><td colspan="6" class="head">Transactions Ledger</td></tr>
    <tr>
      <th class="th">ID</th>
      <th class="th">Date</th>
      <th class="th">Type</th>
      <th class="th">Category</th>
      <th class="th">Tags</th>
      <th class="th">Description</th>
      <th class="th">Amount (${activeCurr})</th>
    </tr>`;

  transactions.forEach((t) => {
    html += `<tr>
      <td class="td">${t.id ?? '—'}</td>
      <td class="td">${t.txn_date ?? '—'}</td>
      <td class="td">${(t.category_type || '').toUpperCase()}</td>
      <td class="td">${t.category_name ?? '—'}</td>
      <td class="td">${t.tags ?? ''}</td>
      <td class="td">${t.description ?? ''}</td>
      <td class="td-r">${Number(t.amount || 0).toFixed(2)}</td>
    </tr>`;
  });

  if (budgets && budgets.length > 0) {
    html += `<tr><td colspan="6"></td></tr>
    <tr><td colspan="6" class="head">Budget Allocations</td></tr>
    <tr>
      <th class="th">Category ID</th>
      <th class="th">Month</th>
      <th class="th">Year</th>
      <th class="th">Limit (${activeCurr})</th>
      <th class="th">Rollover Enabled</th>
    </tr>`;
    budgets.forEach((b) => {
      html += `<tr>
        <td class="td">${b.category_id}</td>
        <td class="td">${b.month}</td>
        <td class="td">${b.year}</td>
        <td class="td-r">${Number(b.amount || 0).toFixed(2)}</td>
        <td class="td">${b.rollover ? 'Yes' : 'No'}</td>
      </tr>`;
    });
  }

  if (goals && goals.length > 0) {
    html += `<tr><td colspan="6"></td></tr>
    <tr><td colspan="6" class="head">Savings Goals</td></tr>
    <tr>
      <th class="th">Goal Name</th>
      <th class="th">Target (${activeCurr})</th>
      <th class="th">Current Saved (${activeCurr})</th>
      <th class="th">Deadline</th>
      <th class="th">Monthly Allocation</th>
    </tr>`;
    goals.forEach((g) => {
      html += `<tr>
        <td class="td">${g.name}</td>
        <td class="td-r">${Number(g.target_amount || 0).toFixed(2)}</td>
        <td class="td-r">${Number(g.current_amount || 0).toFixed(2)}</td>
        <td class="td">${g.deadline || '—'}</td>
        <td class="td-r">${g.monthly_allocation ? Number(g.monthly_allocation).toFixed(2) : '—'}</td>
      </tr>`;
    });
  }

  html += `</table></body></html>`;
  return html;
}

/**
 * Creates and downloads a complete ZIP archive with PDF statement, Excel ledger, and JSON backup.
 */
export async function downloadFinanceOsZipArchive({
  zipFileName = 'FinanceOS_Archive.zip',
  periodLabel = 'Full Account History',
  backupData = {},
  activeCurr = 'INR',
}) {
  const zip = new JSZip();

  const user = backupData.user || {};
  const transactions = backupData.transactions || [];
  const budgets = backupData.budgets || [];
  const goals = backupData.goals || [];

  // 1. PDF Statement
  const pdfBlob = getPdfStatementBlob({
    title: 'FinanceOS Virtual Expense Statement',
    periodLabel,
    user,
    transactions,
    budgets,
    goals,
    activeCurr,
  });
  zip.file('Account_Statement.pdf', pdfBlob);

  // 2. Excel Ledger (.xls)
  const excelXml = buildExcelXml({
    title: 'FinanceOS Financial Ledger',
    subtitle: `Statement Period: ${periodLabel}`,
    user,
    transactions,
    budgets,
    goals,
    activeCurr,
  });
  zip.file('Financial_Ledger.xls', excelXml);

  // 3. Raw JSON Data Backup (Full Portability)
  const jsonString = JSON.stringify(backupData, null, 2);
  zip.file('Data_Backup.json', jsonString);

  // Generate zip blob & download
  const content = await zip.generateAsync({ type: 'blob' });
  downloadBlob(content, zipFileName);
}
