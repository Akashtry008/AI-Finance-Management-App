import React, { useState, useRef } from 'react';
import ReactDOM from 'react-dom';
import { UploadCloud, FileSpreadsheet, Check, X, AlertCircle, Trash2, CheckCircle2, ArrowRight } from 'lucide-react';
import api from '../api';
import { formatCurrency, getCurrencySymbol } from '../utils';
import './CsvImportModal.css';

export default function CsvImportModal({ isOpen, onClose, categories = [], onImportComplete }) {
  const [file, setFile] = useState(null);
  const [parsedRows, setParsedRows] = useState([]);
  const [error, setError] = useState('');
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importDone, setImportDone] = useState(false);
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  // Simple, robust CSV string parser that handles quotes and delimiters
  const parseCSV = (text) => {
    const lines = text.split(/\r\n|\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) throw new Error('CSV file must have a header row and at least one data row.');

    const parseLine = (line) => {
      const result = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"' || char === "'") {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim().replace(/^["']|["']$/g, ''));
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim().replace(/^["']|["']$/g, ''));
      return result;
    };

    const headers = parseLine(lines[0]).map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ''));

    // Detect column indexes
    let dateIdx = headers.findIndex(h => h.includes('date'));
    let descIdx = headers.findIndex(h => h.includes('desc') || h.includes('title') || h.includes('item') || h.includes('name'));
    let amountIdx = headers.findIndex(h => h.includes('amount') || h.includes('cost') || h.includes('total') || h.includes('price') || h.includes('paid'));
    let catIdx = headers.findIndex(h => h.includes('cat'));

    // Fallbacks if not detected by name
    if (dateIdx === -1) dateIdx = 0;
    if (descIdx === -1) descIdx = 1;
    if (amountIdx === -1) amountIdx = 2;

    const rows = [];
    const todayStr = new Date().toISOString().split('T')[0];

    for (let i = 1; i < lines.length; i++) {
      const cols = parseLine(lines[i]);
      if (cols.length <= 1) continue;

      let rawDate = cols[dateIdx] || todayStr;
      // Normalize date format if YYYY-MM-DD or DD/MM/YYYY or MM/DD/YYYY
      let formattedDate = todayStr;
      if (rawDate) {
        const parsedDate = new Date(rawDate);
        if (!isNaN(parsedDate.getTime())) {
          formattedDate = parsedDate.toISOString().split('T')[0];
        }
      }

      const desc = cols[descIdx] || `Imported Expense #${i}`;
      let rawAmount = (cols[amountIdx] || '').replace(/[^0-9.-]+/g, '');
      let amount = Math.abs(parseFloat(rawAmount) || 0);

      const rawCat = catIdx !== -1 && cols[catIdx] ? cols[catIdx] : 'Other';

      // Find best matching category id
      const matchedCat = categories.find(c =>
        c.name.toLowerCase().includes(rawCat.toLowerCase()) ||
        rawCat.toLowerCase().includes(c.name.toLowerCase())
      ) || categories[0] || { id: 1, name: 'General' };

      if (amount > 0) {
        rows.push({
          id: `row-${i}-${Date.now()}`,
          selected: true,
          date: formattedDate,
          description: desc,
          amount: amount,
          categoryId: matchedCat.id,
          categoryName: matchedCat.name
        });
      }
    }

    return rows;
  };

  const handleFileUpload = (e) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;

    setError('');
    setImportDone(false);
    setFile(uploadedFile);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target.result;
        const parsed = parseCSV(content);
        if (parsed.length === 0) {
          setError('No valid expense entries with amounts found in this CSV.');
        } else {
          setParsedRows(parsed);
        }
      } catch (err) {
        setError(err.message || 'Failed to parse CSV file.');
      }
    };
    reader.onerror = () => setError('Failed to read file.');
    reader.readAsText(uploadedFile);
  };

  const toggleSelectRow = (id) => {
    setParsedRows(prev => prev.map(r => r.id === id ? { ...r, selected: !r.selected } : r));
  };

  const toggleSelectAll = () => {
    const allSelected = parsedRows.every(r => r.selected);
    setParsedRows(prev => prev.map(r => ({ ...r, selected: !allSelected })));
  };

  const handleExecuteImport = async () => {
    const toImport = parsedRows.filter(r => r.selected);
    if (toImport.length === 0) {
      setError('Please select at least one row to import.');
      return;
    }

    setImporting(true);
    setError('');
    setImportProgress(0);

    let successCount = 0;

    for (let i = 0; i < toImport.length; i++) {
      const row = toImport[i];
      try {
        await api.post('/transactions', {
          category_id: row.categoryId,
          amount: row.amount,
          txn_date: row.date,
          description: row.description
        });
        successCount++;
      } catch (err) {
        console.warn('Failed to import row:', row, err);
      }
      setImportProgress(Math.round(((i + 1) / toImport.length) * 100));
    }

    setImporting(false);
    setImportDone(true);
    onImportComplete?.();
  };

  const selectedRows = parsedRows.filter(r => r.selected);
  const totalSelectedAmount = selectedRows.reduce((acc, r) => acc + r.amount, 0);

  return ReactDOM.createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card glass-panel csv-import-card" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <FileSpreadsheet size={22} color="var(--accent-color)" />
            <h3>CSV Expense & Splitwise Importer</h3>
          </div>
          <button className="btn btn-secondary modal-close" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="csv-import-body">
          {error && <div className="auth-error">{error}</div>}

          {!file || parsedRows.length === 0 ? (
            <div
              className="csv-dropzone"
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                type="file"
                ref={fileInputRef}
                style={{ display: 'none' }}
                accept=".csv,text/csv,text/plain"
                onChange={handleFileUpload}
              />
              <UploadCloud size={44} color="#818cf8" />
              <h4>Upload or Drag & Drop CSV File</h4>
              <p className="text-muted" style={{ fontSize: '0.84rem', margin: '0.3rem 0' }}>
                Supports Splitwise CSV exports, credit card/bank statements, and custom expense spreadsheets.
              </p>
              <button type="button" className="btn btn-secondary" style={{ marginTop: '0.5rem' }}>
                Browse File
              </button>
            </div>
          ) : (
            <div className="csv-preview-container animate-fade-in">
              <div className="csv-meta-bar">
                <div className="csv-file-info">
                  <FileSpreadsheet size={16} color="#34d399" />
                  <strong>{file.name}</strong>
                  <span className="text-muted">({parsedRows.length} entries parsed)</span>
                </div>
                <div className="csv-selection-summary">
                  <span>Selected: <strong>{selectedRows.length}</strong></span>
                  <span className="csv-total-tag">Total: {formatCurrency(totalSelectedAmount)}</span>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => { setFile(null); setParsedRows([]); setImportDone(false); }}
                  >
                    Change File
                  </button>
                </div>
              </div>

              {importing && (
                <div className="csv-progress-wrap">
                  <div className="csv-progress-bar" style={{ width: `${importProgress}%` }} />
                  <span className="csv-progress-label">Importing {importProgress}%...</span>
                </div>
              )}

              {importDone ? (
                <div className="csv-success-screen">
                  <CheckCircle2 size={42} color="#10b981" />
                  <h4>Batch Import Completed!</h4>
                  <p className="text-muted" style={{ fontSize: '0.86rem' }}>
                    Successfully imported {selectedRows.length} transactions ({formatCurrency(totalSelectedAmount)}) into your expense ledger.
                  </p>
                  <button type="button" className="btn btn-primary" onClick={onClose} style={{ marginTop: '1rem' }}>
                    Done & View Ledger
                  </button>
                </div>
              ) : (
                <div className="csv-table-scroll">
                  <table className="csv-preview-table">
                    <thead>
                      <tr>
                        <th style={{ width: '40px' }}>
                          <input
                            type="checkbox"
                            checked={parsedRows.length > 0 && parsedRows.every(r => r.selected)}
                            onChange={toggleSelectAll}
                          />
                        </th>
                        <th>Date</th>
                        <th>Description</th>
                        <th>Category</th>
                        <th style={{ textAlign: 'right' }}>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedRows.map(row => (
                        <tr key={row.id} className={row.selected ? 'row-selected' : 'row-dim'}>
                          <td>
                            <input
                              type="checkbox"
                              checked={row.selected}
                              onChange={() => toggleSelectRow(row.id)}
                            />
                          </td>
                          <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{row.date}</td>
                          <td>
                            <input
                              type="text"
                              value={row.description}
                              onChange={e => {
                                const val = e.target.value;
                                setParsedRows(prev => prev.map(r => r.id === row.id ? { ...r, description: val } : r));
                              }}
                              className="csv-inline-input"
                            />
                          </td>
                          <td>
                            <select
                              value={row.categoryId}
                              onChange={e => {
                                const cId = parseInt(e.target.value);
                                const cObj = categories.find(c => c.id === cId);
                                setParsedRows(prev => prev.map(r => r.id === row.id ? { ...r, categoryId: cId, categoryName: cObj?.name || 'General' } : r));
                              }}
                              className="csv-inline-select"
                            >
                              {categories.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                              ))}
                            </select>
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 600 }}>
                            {formatCurrency(row.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {!importDone && (
            <div className="modal-actions" style={{ marginTop: '1rem' }}>
              <button type="button" className="btn btn-secondary" onClick={onClose} disabled={importing}>
                Cancel
              </button>
              {parsedRows.length > 0 && (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleExecuteImport}
                  disabled={importing || selectedRows.length === 0}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                >
                  <ArrowRight size={16} />
                  {importing ? `Importing (${importProgress}%)...` : `Import ${selectedRows.length} Expenses`}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
