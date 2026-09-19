export const SUPPORTED_CURRENCIES = [
  { code: 'INR', symbol: '₹', name: 'Indian Rupee', locale: 'en-IN', flag: '🇮🇳', decimals: 2 },
  { code: 'USD', symbol: '$', name: 'US Dollar', locale: 'en-US', flag: '🇺🇸', decimals: 2 },
  { code: 'EUR', symbol: '€', name: 'Euro', locale: 'de-DE', flag: '🇪🇺', decimals: 2 },
  { code: 'GBP', symbol: '£', name: 'British Pound', locale: 'en-GB', flag: '🇬🇧', decimals: 2 },
  { code: 'AED', symbol: 'AED', name: 'UAE Dirham', locale: 'en-AE', flag: '🇦🇪', decimals: 2 },
  { code: 'CAD', symbol: 'CA$', name: 'Canadian Dollar', locale: 'en-CA', flag: '🇨🇦', decimals: 2 },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar', locale: 'en-AU', flag: '🇦🇺', decimals: 2 },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar', locale: 'en-SG', flag: '🇸🇬', decimals: 2 },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen', locale: 'ja-JP', flag: '🇯🇵', decimals: 0 },
  { code: 'CHF', symbol: 'CHF', name: 'Swiss Franc', locale: 'de-CH', flag: '🇨🇭', decimals: 2 },
  { code: 'CNY', symbol: '¥', name: 'Chinese Yuan', locale: 'zh-CN', flag: '🇨🇳', decimals: 2 },
  { code: 'BRL', symbol: 'R$', name: 'Brazilian Real', locale: 'pt-BR', flag: '🇧🇷', decimals: 2 },
  { code: 'SAR', symbol: 'SAR', name: 'Saudi Riyal', locale: 'en-SA', flag: '🇸🇦', decimals: 2 },
  { code: 'NZD', symbol: 'NZ$', name: 'New Zealand Dollar', locale: 'en-NZ', flag: '🇳🇿', decimals: 2 },
  { code: 'KRW', symbol: '₩', name: 'South Korean Won', locale: 'ko-KR', flag: '🇰🇷', decimals: 0 },
  { code: 'MXN', symbol: 'MX$', name: 'Mexican Peso', locale: 'es-MX', flag: '🇲🇽', decimals: 2 },
  { code: 'ZAR', symbol: 'R', name: 'South African Rand', locale: 'en-ZA', flag: '🇿🇦', decimals: 2 },
  { code: 'SEK', symbol: 'kr', name: 'Swedish Krona', locale: 'sv-SE', flag: '🇸🇪', decimals: 2 },
  { code: 'NOK', symbol: 'kr', name: 'Norwegian Krone', locale: 'nb-NO', flag: '🇳🇴', decimals: 2 },
  { code: 'THB', symbol: '฿', name: 'Thai Baht', locale: 'th-TH', flag: '🇹🇭', decimals: 2 },
];

export function getCurrencyInfo(code) {
  const c = code || localStorage.getItem('finance-os-currency') || 'INR';
  return SUPPORTED_CURRENCIES.find(item => item.code.toUpperCase() === c.toUpperCase()) || {
    code: c,
    symbol: c,
    name: c,
    locale: 'en-US',
    flag: '🌐',
    decimals: 2
  };
}

export function isPrivacyModeActive() {
  return localStorage.getItem('finance-os-privacy-mode') === 'true';
}

export function setPrivacyModeActive(active) {
  localStorage.setItem('finance-os-privacy-mode', active ? 'true' : 'false');
  if (active) {
    document.body.classList.add('privacy-mode');
  } else {
    document.body.classList.remove('privacy-mode');
  }
  window.dispatchEvent(new CustomEvent('privacyModeChange', { detail: { isPrivacyMode: active } }));
}

export function formatCurrency(amount, customCode, bypassPrivacy = false) {
  const curr = getCurrencyInfo(customCode);
  if (!bypassPrivacy && isPrivacyModeActive()) {
    return `${curr.symbol} ••••••`;
  }
  const num = Number(amount) || 0;
  
  try {
    return new Intl.NumberFormat(curr.locale, {
      style: 'currency',
      currency: curr.code,
      minimumFractionDigits: curr.decimals,
      maximumFractionDigits: curr.decimals
    }).format(num);
  } catch {
    return `${curr.symbol} ${num.toFixed(curr.decimals)}`;
  }
}

export function formatCurrencyNoDecimals(amount, customCode, bypassPrivacy = false) {
  const curr = getCurrencyInfo(customCode);
  if (!bypassPrivacy && isPrivacyModeActive()) {
    return `${curr.symbol} ••••`;
  }
  const num = Number(amount) || 0;

  try {
    return new Intl.NumberFormat(curr.locale, {
      style: 'currency',
      currency: curr.code,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(num);
  } catch {
    return `${curr.symbol} ${Math.round(num)}`;
  }
}

export function getCurrencySymbol(customCode) {
  return getCurrencyInfo(customCode).symbol;
}

export function setPlatformCurrency(currencyCode) {
  localStorage.setItem('finance-os-currency', currencyCode);
  window.dispatchEvent(new CustomEvent('currencyChange', { detail: { currency: currencyCode } }));
}

export const exportSvgToPng = (containerId, isDarkTheme = true) => {
  const container = document.getElementById(containerId);
  if (!container) return Promise.resolve(null);
  const svgEl = container.querySelector('svg');
  if (!svgEl) return Promise.resolve(null);

  // Clone SVG
  const clonedSvg = svgEl.cloneNode(true);
  
  // Set text color explicitly for serialization
  clonedSvg.querySelectorAll('text').forEach(t => {
    t.style.fill = isDarkTheme ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)';
    t.style.fontFamily = 'inherit';
  });

  const svgString = new XMLSerializer().serializeToString(clonedSvg);
  const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const URL = window.URL || window.webkitURL || window;
  const blobURL = URL.createObjectURL(svgBlob);

  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = svgEl.clientWidth * 2; // high res scale
      canvas.height = svgEl.clientHeight * 2;
      const context = canvas.getContext('2d');
      
      // Draw background matching theme
      context.fillStyle = isDarkTheme ? '#1e1e2f' : '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      
      const png = canvas.toDataURL('image/png');
      URL.revokeObjectURL(blobURL);
      resolve(png);
    };
    image.src = blobURL;
  });
};

export function downloadBlob(blob, fileName) {
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
    setTimeout(() => URL.revokeObjectURL(url), 200);
  } catch (err) {
    console.error('downloadBlob error:', err);
  }
}

export function formatErrorMessage(err, fallback = 'Operation failed') {
  if (!err) return fallback;
  if (typeof err === 'string') return err;
  const detail = err.response?.data?.detail ?? err.message ?? err;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail
      .map(d => {
        if (typeof d === 'object' && d !== null) {
          return d.msg || d.message || JSON.stringify(d);
        }
        return String(d);
      })
      .join(', ');
  }
  if (typeof detail === 'object' && detail !== null) {
    return detail.msg || detail.message || JSON.stringify(detail);
  }
  return String(detail || fallback);
}

export function buildWhatsAppShareUrl(text) {
  return `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
}

export function generateReceiptRef(prefix = 'TX', id = '', dateStr = '') {
  const d = dateStr ? new Date(dateStr) : new Date();
  const yr = d.getFullYear() || new Date().getFullYear();
  const mo = String((d.getMonth() || 0) + 1).padStart(2, '0');
  const safeId = String(id || Math.floor(1000 + Math.random() * 9000)).slice(-5);
  return `FOS-${prefix.toUpperCase()}-${yr}${mo}-${safeId}`;
}

export function exportTableToExcel(fileName, { title, subtitle, sections = [], activeCurr = 'INR' }) {
  let html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta http-equiv="content-type" content="application/vnd.ms-excel; charset=UTF-8">
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
    .title-row { font-size: 15pt; font-weight: bold; color: #1e1b4b; background-color: #e0e7ff; height: 35px; }
    .subtitle-row { font-size: 9.5pt; color: #475569; font-style: italic; }
    .section-header { font-size: 11.5pt; font-weight: bold; color: #ffffff; background-color: #4f46e5; height: 26px; }
    .th-header { font-weight: bold; background-color: #f1f5f9; color: #1e293b; border: 1px solid #cbd5e1; height: 24px; text-align: left; }
    .td-cell { border: 1px solid #e2e8f0; font-size: 9pt; color: #334155; }
    .td-num { border: 1px solid #e2e8f0; font-size: 9pt; color: #0f172a; text-align: right; }
    .td-total { font-weight: bold; background-color: #f8fafc; border-top: 2px solid #6366f1; border-bottom: 2px solid #6366f1; }
  </style>
</head>
<body>
  <table border="0">
    <tr><td colspan="6" class="title-row">${title || 'FinanceOS Financial Report'}</td></tr>
    ${subtitle ? `<tr><td colspan="6" class="subtitle-row">${subtitle} | Currency: ${activeCurr} | Exported: ${new Date().toLocaleString()}</td></tr>` : ''}
    <tr><td colspan="6"></td></tr>`;

  sections.forEach((sec) => {
    const colCount = Math.max((sec.headers || []).length, 4);
    if (sec.title) {
      html += `<tr><td colspan="${colCount}" class="section-header">${sec.title}</td></tr>`;
    }
    if (sec.headers && sec.headers.length > 0) {
      html += `<tr>`;
      sec.headers.forEach(h => {
        html += `<th class="th-header">${h}</th>`;
      });
      html += `</tr>`;
    }
    if (sec.rows && sec.rows.length > 0) {
      sec.rows.forEach(r => {
        html += `<tr>`;
        r.forEach((cell, idx) => {
          const isNumeric = typeof cell === 'number' || (!isNaN(cell) && cell !== '' && typeof cell !== 'boolean' && idx === r.length - 1);
          if (isNumeric && typeof cell === 'number') {
            html += `<td class="td-num">${cell.toFixed(2)}</td>`;
          } else {
            html += `<td class="td-cell">${cell ?? '—'}</td>`;
          }
        });
        html += `</tr>`;
      });
    }
    if (sec.summary && sec.summary.length > 0) {
      html += `<tr>`;
      sec.summary.forEach(cell => {
        html += `<td class="td-cell td-total">${cell}</td>`;
      });
      html += `</tr>`;
    }
    html += `<tr><td colspan="${colCount}"></td></tr>`;
  });

  html += `  </table>
</body>
</html>`;

  const blob = new Blob(['\uFEFF', html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const cleanBase = fileName.replace(/\.[^/.]+$/, "");
  downloadBlob(blob, `${cleanBase}.xls`);
}
