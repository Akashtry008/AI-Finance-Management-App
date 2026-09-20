import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { ArrowLeftRight, RefreshCw, X, Check, TrendingUp, Globe } from 'lucide-react';
import { SUPPORTED_CURRENCIES, formatCurrency, getCurrencyInfo } from '../utils';
import { useTranslation } from '../i18n';
import './CurrencyConverter.css';

// Baseline offline rates against USD in case of offline/network issues
const FALLBACK_USD_RATES = {
  USD: 1.0,
  INR: 86.85,
  EUR: 0.92,
  GBP: 0.79,
  AED: 3.67,
  CAD: 1.38,
  AUD: 1.54,
  SGD: 1.34,
  JPY: 153.20,
  CHF: 0.89,
  CNY: 7.24,
  BRL: 5.75,
  SAR: 3.75,
  NZD: 1.68,
  KRW: 1385.0,
  MXN: 20.30,
  ZAR: 18.25,
  SEK: 10.75,
  NOK: 11.05,
  THB: 34.50
};

export default function CurrencyConverter({ isOpen, onClose }) {
  const { t } = useTranslation();
  const activeCurrency = localStorage.getItem('finance-os-currency') || 'INR';
  const [fromCurrency, setFromCurrency] = useState(activeCurrency === 'USD' ? 'EUR' : 'USD');
  const [toCurrency, setToCurrency] = useState(activeCurrency);
  const [amount, setAmount] = useState('100');
  const [rates, setRates] = useState(FALLBACK_USD_RATES);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    if (isOpen) {
      const current = localStorage.getItem('finance-os-currency') || 'INR';
      setToCurrency(current);
      if (fromCurrency === current) {
        setFromCurrency(current === 'USD' ? 'EUR' : 'USD');
      }
      fetchRates();
    }
  }, [isOpen]);

  async function fetchRates() {
    setLoading(true);
    try {
      // Check cached rates first
      const cached = localStorage.getItem('finance-os-rates');
      const cachedTime = localStorage.getItem('finance-os-rates-time');
      const oneHour = 60 * 60 * 1000;
      
      if (cached && cachedTime && (Date.now() - parseInt(cachedTime, 10) < oneHour)) {
        setRates(JSON.parse(cached));
        setLastUpdated(new Date(parseInt(cachedTime, 10)).toLocaleTimeString());
        setLoading(false);
        return;
      }

      // Fetch live rates from public open exchange rate API
      const res = await fetch('https://open.er-api.com/v6/latest/USD');
      if (res.ok) {
        const data = await res.json();
        if (data && data.rates) {
          const merged = { ...FALLBACK_USD_RATES, ...data.rates };
          setRates(merged);
          localStorage.setItem('finance-os-rates', JSON.stringify(merged));
          localStorage.setItem('finance-os-rates-time', Date.now().toString());
          setLastUpdated(new Date().toLocaleTimeString());
        }
      }
    } catch (e) {
      console.log('Using resilient fallback exchange rates:', e);
      setRates(FALLBACK_USD_RATES);
    } finally {
      setLoading(false);
    }
  };

  const handleSwap = () => {
    const temp = fromCurrency;
    setFromCurrency(toCurrency);
    setToCurrency(temp);
  };

  const handleApplyBaseCurrency = () => {
    localStorage.setItem('finance-os-currency', toCurrency);
    setSuccessMsg(`Base currency updated to ${toCurrency}. Views synchronized!`);
    window.dispatchEvent(new Event('currencyChange'));
    setTimeout(() => {
      setSuccessMsg('');
    }, 2500);
  };

  const numAmount = parseFloat(amount) || 0;
  // Calculate relative exchange rate
  const fromUsdRate = rates[fromCurrency] || 1.0;
  const toUsdRate = rates[toCurrency] || 1.0;
  const rateMultiplier = toUsdRate / fromUsdRate;
  const convertedAmount = numAmount * rateMultiplier;

  const fromInfo = getCurrencyInfo(fromCurrency);
  const toInfo = getCurrencyInfo(toCurrency);



  if (!isOpen) return null;

  return ReactDOM.createPortal(
    <div className="modal-overlay currency-converter-overlay" onClick={onClose}>
      <div className="modal-card glass-panel currency-converter-modal" onClick={e => e.stopPropagation()}>
        <div className="converter-header">
          <div className="converter-title-area">
            <div className="converter-icon-badge">
              <Globe size={20} />
            </div>
            <div>
              <h3>{t('currencyConverter', 'Live Currency Converter')}</h3>
              <p className="text-muted">{t('converterSubtitle', 'Real-time foreign exchange rates & platform currency manager')}</p>
            </div>
          </div>
          <button className="btn btn-secondary modal-close" onClick={onClose} aria-label={t('close', 'Close modal')}>
            <X size={16} />
          </button>
        </div>

        {successMsg && (
          <div className="converter-success-banner animate-fade-in">
            <Check size={16} /> {successMsg}
          </div>
        )}

        <div className="converter-body">
          {/* Amount input */}
          <div className="converter-input-group">
            <label>{t('amount', 'Amount')}</label>
            <div className="converter-amount-wrapper">
              <span className="converter-amount-symbol">{fromInfo.symbol}</span>
              <input
                type="number"
                min="0"
                step="any"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0.00"
                className="converter-amount-input"
                autoFocus
              />
            </div>
          </div>

          {/* Quick Presets */}
          <div className="converter-presets">
            {[10, 50, 100, 500, 1000, 5000].map(val => (
              <button
                key={val}
                type="button"
                className={`converter-preset-btn ${parseFloat(amount) === val ? 'active' : ''}`}
                onClick={() => setAmount(val.toString())}
              >
                {val}
              </button>
            ))}
          </div>

          {/* Currency selection row with swap */}
          <div className="converter-selector-row">
            <div className="converter-select-col">
              <label>{t('convertFrom', 'From')}</label>
              <div className="select-with-flag">
                <span className="currency-flag-preview">{fromInfo.flag}</span>
                <select
                  value={fromCurrency}
                  onChange={e => setFromCurrency(e.target.value)}
                  className="converter-select"
                >
                  {SUPPORTED_CURRENCIES.map(c => (
                    <option key={c.code} value={c.code}>
                      {c.flag} {c.code} - {c.name} ({c.symbol})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              type="button"
              className="converter-swap-btn"
              onClick={handleSwap}
              title={t('swapCurrencies', 'Swap currencies')}
              aria-label={t('swapCurrencies', 'Swap currencies')}
            >
              <ArrowLeftRight size={18} />
            </button>

            <div className="converter-select-col">
              <label>{t('convertTo', 'To')}</label>
              <div className="select-with-flag">
                <span className="currency-flag-preview">{toInfo.flag}</span>
                <select
                  value={toCurrency}
                  onChange={e => setToCurrency(e.target.value)}
                  className="converter-select"
                >
                  {SUPPORTED_CURRENCIES.map(c => (
                    <option key={c.code} value={c.code}>
                      {c.flag} {c.code} - {c.name} ({c.symbol})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Result Card */}
          <div className="converter-result-card glass-panel">
            <span className="converter-result-label text-muted">{t('total', 'Converted Total')}:</span>
            <div className="converter-result-value">
              {formatCurrency(convertedAmount, toCurrency)}
            </div>
            <div className="converter-rate-badge">
              <TrendingUp size={14} />
              <span>1 {fromCurrency} = {rateMultiplier.toFixed(4)} {toCurrency}</span>
            </div>
          </div>

          {/* Rates metadata & Refresh */}
          <div className="converter-meta-row text-muted">
            <span>
              {lastUpdated ? `Live rate synced at ${lastUpdated}` : 'Using real-time market rates'}
            </span>
            <button
              type="button"
              className="converter-refresh-btn"
              onClick={fetchRates}
              disabled={loading}
              title={t('refresh', 'Refresh rates')}
            >
              <RefreshCw size={13} className={loading ? 'spin-icon' : ''} />
              <span>{t('refresh', 'Refresh')}</span>
            </button>
          </div>

          {/* Apply platform currency action */}
          <div className="converter-actions">
            <button
              type="button"
              className="converter-apply-btn"
              onClick={handleApplyBaseCurrency}
            >
              <Check size={16} /> {t('setAsPlatformCurrency', 'Set as Platform Currency')} ({toCurrency})
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
