export function formatCurrency(amount) {
  const currencyCode = localStorage.getItem('finance-os-currency') || 'INR';
  
  let locale = 'en-IN';
  if (currencyCode === 'USD') locale = 'en-US';
  if (currencyCode === 'EUR') locale = 'en-IE'; // or de-DE, etc.
  if (currencyCode === 'GBP') locale = 'en-GB';

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currencyCode,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
}

export function formatCurrencyNoDecimals(amount) {
  const currencyCode = localStorage.getItem('finance-os-currency') || 'INR';
  
  let locale = 'en-IN';
  if (currencyCode === 'USD') locale = 'en-US';
  if (currencyCode === 'EUR') locale = 'en-IE';
  if (currencyCode === 'GBP') locale = 'en-GB';

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currencyCode,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}

export function getCurrencySymbol() {
  const currencyCode = localStorage.getItem('finance-os-currency') || 'INR';
  if (currencyCode === 'USD') return '$';
  if (currencyCode === 'EUR') return '€';
  if (currencyCode === 'GBP') return '£';
  return '₹';
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
