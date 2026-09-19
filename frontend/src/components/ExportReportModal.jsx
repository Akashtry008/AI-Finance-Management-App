import React from 'react';
import ReactDOM from 'react-dom';
import {
  FileText, FileSpreadsheet, X, Check,
  Download, MessageCircle, Sparkles
} from 'lucide-react';
import './ExportReportModal.css';

export default function ExportReportModal({
  isOpen,
  onClose,
  title = "Export Financial Report",
  subtitle = "Choose your preferred export format",
  onExportPdf,
  onExportExcel,
  onShareWhatsApp,
  loadingPdf = false,
  loadingExcel = false,
  recordCount = null,
}) {
  if (!isOpen) return null;

  return ReactDOM.createPortal(
    <div className="export-modal-overlay" onClick={onClose}>
      <div className="export-modal-card animate-fade-in" onClick={e => e.stopPropagation()}>
        <div className="export-modal-header">
          <div>
            <h3 className="export-modal-title">
              <Sparkles size={18} color="#818cf8" /> {title}
            </h3>
            <p className="export-modal-subtitle">
              {subtitle} {recordCount != null ? `• ${recordCount} item${recordCount === 1 ? '' : 's'}` : ''}
            </p>
          </div>
          <button className="export-modal-close" onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        <div className="export-options-grid">
          {/* PDF Format Option Card */}
          <div className="export-option-card pdf-option">
            <div>
              <div className="export-option-icon pdf-icon-bg">
                <FileText size={24} />
              </div>
              <span className="export-badge badge-pdf">Executive Document</span>
              <h4 className="export-card-title">PDF Visual Report</h4>
              <p className="export-card-desc">
                High-fidelity, styled PDF document ideal for printing, audit filings, and executive sharing.
              </p>
              <ul className="export-features-list">
                <li><Check size={13} /> Visual header & KPI metric cards</li>
                <li><Check size={13} /> Clean autoTable layout with striping</li>
                <li><Check size={13} /> Branded audit footer & page numbers</li>
              </ul>
            </div>
            <button
              type="button"
              className="export-btn export-btn-pdf"
              onClick={onExportPdf}
              disabled={loadingPdf}
            >
              <Download size={15} />
              {loadingPdf ? 'Generating PDF...' : 'Download PDF Report'}
            </button>
          </div>

          {/* Excel Table Option Card */}
          <div className="export-option-card excel-option">
            <div>
              <div className="export-option-icon excel-icon-bg">
                <FileSpreadsheet size={24} />
              </div>
              <span className="export-badge badge-excel">Structured Spreadsheet</span>
              <h4 className="export-card-title">Table Format (Excel)</h4>
              <p className="export-card-desc">
                Multi-section formatted spreadsheet ready for Excel, Google Sheets, or Apple Numbers calculations.
              </p>
              <ul className="export-features-list">
                <li><Check size={13} /> Native numeric cells for =SUM() formulas</li>
                <li><Check size={13} /> Multi-section tables & breakdown headers</li>
                <li><Check size={13} /> UTF-8 encoding (no corrupted symbols)</li>
              </ul>
            </div>
            <button
              type="button"
              className="export-btn export-btn-excel"
              onClick={onExportExcel}
              disabled={loadingExcel}
            >
              <Download size={15} />
              {loadingExcel ? 'Building Spreadsheet...' : 'Download Excel Table'}
            </button>
          </div>
        </div>

        {onShareWhatsApp && (
          <div className="export-modal-footer">
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Need to share highlights instantly?
            </span>
            <button
              type="button"
              className="btn btn-whatsapp"
              onClick={onShareWhatsApp}
              style={{ fontSize: '0.85rem', padding: '0.45rem 0.9rem' }}
            >
              <MessageCircle size={15} /> Share on WhatsApp
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
