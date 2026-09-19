import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import {
  CheckCircle2, Printer, Download, Copy, Check, X,
  TrendingUp, MessageCircle, FileText, Sparkles
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import { formatCurrency, getCurrencyInfo, buildWhatsAppShareUrl, generateReceiptRef, formatErrorMessage } from '../utils';
import { useDialog } from '../context/DialogContext';
import './InstantReceiptModal.css';

export default function InstantReceiptModal({ receipt, onClose }) {
  const { showAlert } = useDialog();
  const [copied, setCopied] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  if (!receipt) return null;

  const activeCurr = receipt.currency || localStorage.getItem('finance-os-currency') || 'INR';
  const currInfo = getCurrencyInfo(activeCurr);
  const isIncome = receipt.type === 'income';
  const refId = receipt.refId || generateReceiptRef(isIncome ? 'INC' : 'EXP', receipt.id, receipt.date);
  const formattedDate = receipt.date ? new Date(receipt.date).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric'
  }) : new Date().toLocaleDateString();

  const handleCopy = async () => {
    const text = `🧾 FinanceOS Digital Receipt\n━━━━━━━━━━━━━━━━━━━━\nRef: ${refId}\nDate: ${formattedDate}\nCategory: ${receipt.category || 'General'}\nDescription: ${receipt.description || 'Transaction'}\nAmount: ${formatCurrency(receipt.amount, activeCurr)}\nStatus: Verified & Recorded ✓\n━━━━━━━━━━━━━━━━━━━━\n100% Free Unlimited FinanceOS`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy receipt:', err);
    }
  };

  const handleShareWhatsApp = () => {
    const message = `🧾 *Official Payment Receipt — FinanceOS*
━━━━━━━━━━━━━━━━━━━━
🔖 *Reference:* \`${refId}\`
📅 *Date:* ${formattedDate}
🏷️ *Category:* ${receipt.category || 'General'}
📝 *Description:* ${receipt.description || 'Transaction'}
${receipt.paidBy ? `👤 *Paid By:* ${receipt.paidBy}\n` : ''}${receipt.paidTo ? `👥 *Paid To:* ${receipt.paidTo}\n` : ''}${receipt.groupName ? `🏖️ *Group:* ${receipt.groupName}\n` : ''}💰 *Total Amount:* *${formatCurrency(receipt.amount, activeCurr)}*
✅ *Status:* Verified & Recorded
━━━━━━━━━━━━━━━━━━━━
✨ Tracked with *FinanceOS* (100% Free & Unlimited Financial OS)`;
    
    window.open(buildWhatsAppShareUrl(message), '_blank', 'noopener,noreferrer');
  };

  const handleDownloadPdf = () => {
    setExportingPdf(true);
    try {
      const doc = new jsPDF({ unit: 'mm', format: [105, 170] });
      
      // Top indigo banner
      doc.setFillColor(79, 70, 229);
      doc.rect(0, 0, 105, 22, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.text('FinanceOS', 52.5, 9, { align: 'center' });
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'normal');
      doc.text('INSTANT DIGITAL TRANSACTION RECEIPT', 52.5, 16, { align: 'center' });

      // Metadata block
      doc.setTextColor(51, 65, 85);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text(`REF: ${refId}`, 10, 29);
      doc.setFont('helvetica', 'normal');
      doc.text(`Date: ${formattedDate}`, 10, 34);

      // Verified pill
      doc.setFillColor(240, 253, 244);
      doc.setDrawColor(34, 197, 94);
      doc.roundedRect(65, 25, 30, 10, 2, 2, 'FD');
      doc.setTextColor(22, 101, 52);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.text('✓ VERIFIED', 80, 31, { align: 'center' });

      // Divider
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.3);
      doc.line(10, 39, 95, 39);

      // Details Table
      const body = [
        ['Type', (receipt.type || 'Expense').toUpperCase()],
        ['Category', receipt.category || 'General'],
        ['Description', receipt.description || 'Transaction'],
        ...(receipt.paidBy ? [['Paid By', receipt.paidBy]] : []),
        ...(receipt.paidTo ? [['Paid To', receipt.paidTo]] : []),
        ...(receipt.groupName ? [['Group', receipt.groupName]] : []),
        ['Currency', `${currInfo.code} (${currInfo.symbol})`],
        ['Record Status', 'Permanent Ledger Entry']
      ];

      autoTable(doc, {
        startY: 42,
        body: body,
        theme: 'plain',
        styles: { fontSize: 8, cellPadding: 2.2 },
        columnStyles: {
          0: { fontStyle: 'bold', textColor: [100, 116, 139], cellWidth: 32 },
          1: { textColor: [15, 23, 42], cellWidth: 53 }
        },
        margin: { left: 10, right: 10 }
      });

      const finalY = doc.lastAutoTable.finalY + 4;

      // Amount Box
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(203, 213, 225);
      doc.roundedRect(10, finalY, 85, 20, 2.5, 2.5, 'FD');

      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text('TOTAL TRANSACTION AMOUNT', 15, finalY + 6.5);

      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      if (isIncome) {
        doc.setTextColor(16, 185, 129);
      } else {
        doc.setTextColor(15, 23, 42);
      }
      doc.text(formatCurrency(receipt.amount, activeCurr), 15, finalY + 15);

      // Footer
      const footerY = finalY + 30;
      doc.setFont('courier', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(148, 163, 184);
      doc.text(`* ${refId} *`, 52.5, footerY, { align: 'center' });

      doc.setFont('helvetica', 'italic');
      doc.setFontSize(6.5);
      doc.text('FinanceOS — 100% Free Unlimited Financial OS', 52.5, footerY + 5, { align: 'center' });

      doc.save(`${refId}_Receipt.pdf`);
    } catch (err) {
      console.error('PDF receipt generation failed:', err);
      showAlert({
        title: 'PDF Receipt Failed',
        message: formatErrorMessage(err, 'Failed to generate PDF receipt.'),
        type: 'danger',
      });
    } finally {
      setExportingPdf(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return ReactDOM.createPortal(
    <div className="receipt-modal-overlay" onClick={onClose}>
      <div className="receipt-dialog" onClick={e => e.stopPropagation()}>
        <div className="receipt-card animate-fade-in">
          <button className="receipt-close-btn" onClick={onClose} aria-label="Close receipt">
            <X size={16} />
          </button>

          <div className="receipt-header">
            <div className="receipt-brand">
              <TrendingUp size={20} />
              <span>FinanceOS</span>
            </div>
            <div className="receipt-type-title">Instant Digital Receipt</div>
            <span className="receipt-ref-badge">{refId}</span>
          </div>

          <div className="receipt-status-banner">
            <CheckCircle2 size={15} />
            <span>Verified Transaction</span>
          </div>

          <div className="receipt-amount-box">
            <div className="receipt-amount-label">Amount Transacted</div>
            <div className={`receipt-amount-value ${isIncome ? 'income' : 'expense'}`}>
              {isIncome ? '+' : ''}{formatCurrency(receipt.amount, activeCurr)}
            </div>
          </div>

          <div className="receipt-details-list">
            <div className="receipt-detail-row">
              <span className="receipt-detail-label">Type</span>
              <span className={`receipt-detail-badge ${isIncome ? 'income' : 'expense'}`}>
                {receipt.type ? receipt.type.toUpperCase() : 'EXPENSE'}
              </span>
            </div>
            <div className="receipt-detail-row">
              <span className="receipt-detail-label">Category</span>
              <span className="receipt-detail-val">{receipt.category || 'General'}</span>
            </div>
            <div className="receipt-detail-row">
              <span className="receipt-detail-label">Description</span>
              <span className="receipt-detail-val">{receipt.description || '—'}</span>
            </div>
            {receipt.paidBy && (
              <div className="receipt-detail-row">
                <span className="receipt-detail-label">Paid By</span>
                <span className="receipt-detail-val">{receipt.paidBy}</span>
              </div>
            )}
            {receipt.paidTo && (
              <div className="receipt-detail-row">
                <span className="receipt-detail-label">Paid To</span>
                <span className="receipt-detail-val">{receipt.paidTo}</span>
              </div>
            )}
            {receipt.groupName && (
              <div className="receipt-detail-row">
                <span className="receipt-detail-label">Split Group</span>
                <span className="receipt-detail-val">{receipt.groupName}</span>
              </div>
            )}
            <div className="receipt-detail-row">
              <span className="receipt-detail-label">Date</span>
              <span className="receipt-detail-val">{formattedDate}</span>
            </div>
          </div>

          {/* Barcode simulation */}
          <div className="receipt-barcode">
            {[4,2,6,1,5,3,7,2,4,6,1,3,5,2,7,4,2,6,3,5,1,4].map((w, idx) => (
              <div key={idx} className="receipt-barcode-line" style={{ width: `${w}px` }} />
            ))}
          </div>

          <div className="receipt-footer-note">
            100% Free Unlimited Financial Operating System • Official Audit Trail
          </div>
        </div>

        {/* Action buttons */}
        <div className="receipt-actions">
          <button
            type="button"
            className="btn btn-whatsapp"
            onClick={handleShareWhatsApp}
            title="Share verified receipt directly to WhatsApp"
          >
            <MessageCircle size={16} /> Share via WhatsApp
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleDownloadPdf}
            disabled={exportingPdf}
            title="Download PDF Receipt Voucher"
          >
            <Download size={15} /> {exportingPdf ? 'Exporting...' : 'PDF Receipt'}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handlePrint}
            title="Print Receipt Voucher"
          >
            <Printer size={15} /> Print
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleCopy}
            title="Copy receipt details to clipboard"
            style={{ gridColumn: '1 / -1' }}
          >
            {copied ? <Check size={15} color="#10b981" /> : <Copy size={15} />}
            <span>{copied ? 'Copied Receipt Details!' : 'Copy Receipt Summary'}</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
