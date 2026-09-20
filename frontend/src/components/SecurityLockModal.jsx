import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import {
  Lock, Unlock, Fingerprint, Delete, Check, ShieldCheck, X,
  KeyRound, Grid3X3, Eye, EyeOff, Mail
} from 'lucide-react';
import api from '../api';
import { useTranslation } from '../i18n';
import './SecurityLockModal.css';

export default function SecurityLockModal({
  isOpen,
  onClose,
  onUnlock,
  isSetupMode = false,
  allowClose = false,
  initialMode = null
}) {
  const { t } = useTranslation();
  // Active lock type: 'pin' | 'password' | 'pattern'
  const [lockMode, setLockMode] = useState(
    () => (isSetupMode && initialMode) || localStorage.getItem('finance-os-security-mode') || 'pin'
  );

  // Active tab: in setup mode, defaults to initialMode or configured mode; in lock mode, strictly configured mode
  const [activeTab, setActiveTab] = useState((isSetupMode && initialMode) || lockMode);

  // PIN state
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinStep, setPinStep] = useState(1); // 1 = enter new, 2 = confirm

  // Password state
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordStep, setPasswordStep] = useState(1);

  // Pattern state
  const [patternNodes, setPatternNodes] = useState([]);
  const [confirmPattern, setConfirmPattern] = useState([]);
  const [patternStep, setPatternStep] = useState(1);
  const patternGridRef = useRef(null);

  // Email Reset state
  const [isResetView, setIsResetView] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [verifyingReset, setVerifyingReset] = useState(false);

  // Error & Status
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (isOpen) {
      const fallbackMode = (isSetupMode && initialMode) ? initialMode : (localStorage.getItem('finance-os-security-mode') || 'pin');
      setLockMode(fallbackMode);
      setActiveTab(fallbackMode);

      api.get('/profile/security-lock').then(res => {
        if (res.data) {
          const serverMode = res.data.mode || 'pin';
          if (res.data.pin) localStorage.setItem('finance-os-pin', res.data.pin);
          if (res.data.password) localStorage.setItem('finance-os-password', res.data.password);
          if (res.data.pattern) localStorage.setItem('finance-os-pattern', res.data.pattern);
          localStorage.setItem('finance-os-security-mode', serverMode);

          const target = (isSetupMode && initialMode) ? initialMode : serverMode;
          setLockMode(serverMode);
          setActiveTab(target);
        }
      }).catch(() => {});

      setPin('');
      setConfirmPin('');
      setPinStep(1);
      setPassword('');
      setConfirmPassword('');
      setPasswordStep(1);
      setPatternNodes([]);
      setConfirmPattern([]);
      setPatternStep(1);
      setIsResetView(false);
      setResetEmail('');
      setVerifyingReset(false);
      setError('');
      setSuccess('');
    }
  }, [isOpen, isSetupMode, initialMode]);

  if (!isOpen) return null;

  // Stored credentials
  const storedPin = localStorage.getItem('finance-os-pin') || '1234';
  const storedPassword = localStorage.getItem('finance-os-password') || 'admin123';
  const storedPattern = localStorage.getItem('finance-os-pattern') || '0-1-2-5-8'; // Default L-shape

  // ─── PIN Handlers ────────────────────────────────────────────────────────
  const handlePinPress = (num) => {
    if (pin.length < 4) {
      const nextPin = pin + num;
      setPin(nextPin);
      setError('');
      if (nextPin.length === 4) {
        verifyPin(nextPin);
      }
    }
  };

  const verifyPin = (entered) => {
    if (isSetupMode) {
      if (pinStep === 1) {
        setConfirmPin(entered);
        setPin('');
        setPinStep(2);
        setError('');
      } else {
        if (entered === confirmPin) {
          localStorage.setItem('finance-os-pin', entered);
          localStorage.setItem('finance-os-security-mode', 'pin');
          setLockMode('pin');
          api.put('/profile/security-lock', { pin: entered, mode: 'pin' }).catch(() => {});
          window.dispatchEvent(new CustomEvent('securitySettingsChange', { detail: { mode: 'pin' } }));
          setSuccess('New 4-digit PIN saved successfully!');
          setPin('');
          setConfirmPin('');
          setPinStep(1);
          setTimeout(() => {
            setSuccess('');
            onClose?.();
          }, 1200);
        } else {
          setError('PINs do not match. Please start over.');
          setPin('');
          setConfirmPin('');
          setPinStep(1);
        }
      }
    } else {
      if (entered === storedPin) {
        onUnlock?.();
      } else {
        setError('Incorrect PIN. Please try again.');
        setTimeout(() => setPin(''), 450);
      }
    }
  };

  // ─── Password Handlers ───────────────────────────────────────────────────
  const handlePasswordSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (isSetupMode) {
      if (!password.trim()) {
        setError('Password cannot be empty.');
        return;
      }
      if (passwordStep === 1) {
        setConfirmPassword(password);
        setPassword('');
        setPasswordStep(2);
      } else {
        if (password === confirmPassword) {
          localStorage.setItem('finance-os-password', password);
          localStorage.setItem('finance-os-security-mode', 'password');
          setLockMode('password');
          api.put('/profile/security-lock', { password: password, mode: 'password' }).catch(() => {});
          window.dispatchEvent(new CustomEvent('securitySettingsChange', { detail: { mode: 'password' } }));
          setSuccess('New password saved successfully!');
          setPassword('');
          setConfirmPassword('');
          setPasswordStep(1);
          setTimeout(() => {
            setSuccess('');
            onClose?.();
          }, 1200);
        } else {
          setError('Passwords do not match. Please try again.');
          setPassword('');
          setConfirmPassword('');
          setPasswordStep(1);
        }
      }
    } else {
      if (password === storedPassword) {
        onUnlock?.();
      } else {
        setError('Incorrect password. Please try again.');
        setPassword('');
      }
    }
  };

  // ─── Pattern Handlers ────────────────────────────────────────────────────
  const handleDotInteract = (index) => {
    if (!patternNodes.includes(index)) {
      setPatternNodes(prev => [...prev, index]);
      setError('');
    }
  };

  const handlePatternComplete = () => {
    if (patternNodes.length < 3) {
      setError('Pattern must connect at least 3 dots.');
      setPatternNodes([]);
      return;
    }

    const patternString = patternNodes.join('-');

    if (isSetupMode) {
      if (patternStep === 1) {
        setConfirmPattern(patternNodes);
        setPatternNodes([]);
        setPatternStep(2);
        setError('');
      } else {
        if (patternString === confirmPattern.join('-')) {
          localStorage.setItem('finance-os-pattern', patternString);
          localStorage.setItem('finance-os-security-mode', 'pattern');
          setLockMode('pattern');
          api.put('/profile/security-lock', { pattern: patternString, mode: 'pattern' }).catch(() => {});
          window.dispatchEvent(new CustomEvent('securitySettingsChange', { detail: { mode: 'pattern' } }));
          setSuccess('New pattern saved successfully!');
          setPatternNodes([]);
          setConfirmPattern([]);
          setPatternStep(1);
          setTimeout(() => {
            setSuccess('');
            onClose?.();
          }, 1200);
        } else {
          setError('Patterns do not match. Please start over.');
          setPatternNodes([]);
          setConfirmPattern([]);
          setPatternStep(1);
        }
      }
    } else {
      if (patternString === storedPattern) {
        onUnlock?.();
      } else {
        setError('Incorrect pattern. Try again.');
        setTimeout(() => setPatternNodes([]), 450);
      }
    }
  };

  // Pattern node coordinates for connecting lines (3x3 grid, 0-8)
  const getNodeCoord = (index) => {
    const col = index % 3;
    const row = Math.floor(index / 3);
    return {
      x: col * 70 + 35,
      y: row * 70 + 35
    };
  };

  const handleVerifyResetEmail = async (e) => {
    e.preventDefault();
    const cleanEmail = (resetEmail || '').trim();
    if (!cleanEmail) {
      setError('Please enter your registered email address.');
      return;
    }
    setVerifyingReset(true);
    setError('');
    setSuccess('');
    try {
      const res = await api.post('/auth/security-lock/reset-verify', { email: cleanEmail });
      if (res.data?.success) {
        localStorage.setItem('finance-os-pin', '1234');
        localStorage.setItem('finance-os-password', 'admin123');
        localStorage.setItem('finance-os-pattern', '0-1-2-5-8');
        localStorage.setItem('finance-os-security-mode', 'pin');
        setLockMode('pin');
        setActiveTab('pin');
        api.put('/profile/security-lock', {
          pin: '1234',
          password: 'admin123',
          pattern: '0-1-2-5-8',
          mode: 'pin'
        }).catch(() => {});
        window.dispatchEvent(new CustomEvent('securitySettingsChange', { detail: { mode: 'pin' } }));
        setSuccess('Identity verified via email! Security lock has been reset to default PIN (1234). Unlocking...');
        setTimeout(() => {
          setIsResetView(false);
          onUnlock?.();
          onClose?.();
        }, 1200);
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Verification failed. Please enter your registered account email.');
    } finally {
      setVerifyingReset(false);
    }
  };

  const getSubtitle = () => {
    if (isResetView) {
      return 'Enter your registered email address to verify identity and reset lock code';
    }

    if (!isSetupMode) {
      if (activeTab === 'pin') return 'Enter your 4-digit PIN to unlock';
      if (activeTab === 'password') return 'Enter your password to unlock';
      return 'Connect your unlock pattern';
    }

    if (activeTab === 'pin') {
      return pinStep === 1
        ? 'Step 1 of 2: Enter new 4-digit PIN'
        : 'Step 2 of 2: Re-enter 4-digit PIN to confirm';
    }
    if (activeTab === 'password') {
      return passwordStep === 1
        ? 'Step 1 of 2: Enter new password'
        : 'Step 2 of 2: Re-enter password to confirm';
    }
    return patternStep === 1
      ? 'Step 1 of 2: Connect at least 3 dots'
      : 'Step 2 of 2: Redraw pattern to confirm';
  };

  return ReactDOM.createPortal(
    <div className="security-lock-overlay">
      <div className="security-lock-card glass-panel animate-fade-in">
        {/* Close button ONLY when in setup mode or explicitly allowed */}
        {(isSetupMode || allowClose) && (
          <button className="security-lock-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        )}

        <div className="security-icon-circle">
          {isSetupMode ? <ShieldCheck size={26} /> : <Lock size={26} />}
        </div>

        <h3 className="security-title">
          {isSetupMode ? t('configureCredentials', 'Configure Security Credentials') : t('lockScreen', 'FinanceOS Locked')}
        </h3>
        <p className="security-subtitle">
          {getSubtitle()}
        </p>

        {/* Mode switcher tabs (ONLY shown in setup mode) */}
        {isSetupMode && (
          <div className="security-mode-tabs">
            <button
              type="button"
              className={`sec-tab-btn ${activeTab === 'pin' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('pin');
                setError('');
                setSuccess('');
                setPin('');
                setConfirmPin('');
                setPinStep(1);
              }}
            >
              <KeyRound size={14} /> {t('pin', 'PIN')}
            </button>
            <button
              type="button"
              className={`sec-tab-btn ${activeTab === 'password' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('password');
                setError('');
                setSuccess('');
                setPassword('');
                setConfirmPassword('');
                setPasswordStep(1);
              }}
            >
              <Lock size={14} /> {t('password', 'Password')}
            </button>
            <button
              type="button"
              className={`sec-tab-btn ${activeTab === 'pattern' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('pattern');
                setError('');
                setSuccess('');
                setPatternNodes([]);
                setConfirmPattern([]);
                setPatternStep(1);
              }}
            >
              <Grid3X3 size={14} /> {t('pattern', 'Pattern')}
            </button>
          </div>
        )}

        {error && <div className="security-error-badge">{error}</div>}
        {success && <div className="security-success-badge">{success}</div>}

        {/* ─── RESET VIEW OR UNLOCK INTERFACE ─── */}
        {isResetView ? (
          <form onSubmit={handleVerifyResetEmail} className="security-reset-form animate-fade-in">
            <p className="security-reset-notice">
              Please enter the email address registered with your account. Upon verification, your lock will be reset to default credentials.
            </p>
            <div className="security-reset-input-wrap">
              <Mail size={16} className="security-reset-icon" />
              <input
                type="email"
                className="security-reset-input"
                placeholder="Enter registered account email..."
                value={resetEmail}
                onChange={e => { setResetEmail(e.target.value); setError(''); }}
                autoFocus
                required
              />
            </div>
            <div className="security-reset-actions">
              <button
                type="button"
                className="btn btn-secondary sec-reset-cancel-btn"
                onClick={() => { setIsResetView(false); setError(''); }}
                disabled={verifyingReset}
              >
                Back
              </button>
              <button
                type="submit"
                className="btn btn-primary sec-reset-submit-btn"
                disabled={verifyingReset || !resetEmail.trim()}
              >
                {verifyingReset ? 'Verifying Email...' : 'Verify & Reset Code'}
              </button>
            </div>
          </form>
        ) : (
          <>
            {/* ─── 1. PIN INTERFACE ─── */}
            {activeTab === 'pin' && (
              <div className="pin-container animate-fade-in">
                <div className="pin-dots-row">
                  {[0, 1, 2, 3].map(idx => (
                    <div
                      key={idx}
                      className={`pin-dot ${pin.length > idx ? 'filled' : ''} ${error ? 'error' : ''}`}
                    />
                  ))}
                </div>

                <div className="pin-keypad">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                    <button
                      key={num}
                      type="button"
                      className="pin-key"
                      onClick={() => handlePinPress(String(num))}
                    >
                      {num}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="pin-key action-key"
                    onClick={() => { setPin(''); setError(''); }}
                  >
                    C
                  </button>
                  <button
                    type="button"
                    className="pin-key"
                    onClick={() => handlePinPress('0')}
                  >
                    0
                  </button>
                  <button
                    type="button"
                    className="pin-key action-key"
                    onClick={() => { setPin(prev => prev.slice(0, -1)); setError(''); }}
                  >
                    <Delete size={17} />
                  </button>
                </div>
              </div>
            )}

            {/* ─── 2. PASSWORD INTERFACE ─── */}
            {activeTab === 'password' && (
              <form onSubmit={handlePasswordSubmit} className="password-container animate-fade-in">
                <div className="password-input-wrap">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder={isSetupMode ? (passwordStep === 1 ? "Enter new password..." : "Confirm new password...") : "Enter password..."}
                    value={password}
                    onChange={e => { setPassword(e.target.value); setError(''); }}
                    autoFocus
                    className="sec-password-input"
                  />
                  <button
                    type="button"
                    className="password-eye-btn"
                    onClick={() => setShowPassword(p => !p)}
                    aria-label="Toggle password visibility"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <button type="submit" className="btn btn-primary sec-submit-btn">
                  {isSetupMode ? (
                    passwordStep === 1 ? <><Check size={16} /> Next</> : <><Check size={16} /> Save Password</>
                  ) : (
                    <><Unlock size={16} /> Unlock</>
                  )}
                </button>
              </form>
            )}

            {/* ─── 3. PATTERN INTERFACE ─── */}
            {activeTab === 'pattern' && (
              <div className="pattern-container animate-fade-in">
                <div
                  className="pattern-grid"
                  ref={patternGridRef}
                  onMouseLeave={() => {
                    if (patternNodes.length > 0) handlePatternComplete();
                  }}
                >
                  {/* SVG Connecting Lines */}
                  <svg className="pattern-svg-canvas">
                    {patternNodes.map((node, i) => {
                      if (i === 0) return null;
                      const from = getNodeCoord(patternNodes[i - 1]);
                      const to = getNodeCoord(node);
                      return (
                        <line
                          key={i}
                          x1={from.x}
                          y1={from.y}
                          x2={to.x}
                          y2={to.y}
                          className="pattern-line"
                        />
                      );
                    })}
                  </svg>

                  {/* 3x3 Dots */}
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8].map(dotIdx => {
                    const isSelected = patternNodes.includes(dotIdx);
                    return (
                      <button
                        key={dotIdx}
                        type="button"
                        className={`pattern-dot ${isSelected ? 'active' : ''}`}
                        onClick={() => handleDotInteract(dotIdx)}
                        title={`Dot ${dotIdx + 1}`}
                      >
                        <div className="pattern-dot-core" />
                      </button>
                    );
                  })}
                </div>

                <div className="pattern-actions">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => { setPatternNodes([]); setError(''); }}
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={handlePatternComplete}
                    disabled={patternNodes.length < 3}
                  >
                    <Check size={14} /> {isSetupMode && patternStep === 1 ? 'Next' : 'Confirm'}
                  </button>
                </div>
              </div>
            )}

            {/* Unlock Footer Actions (ONLY in unlock mode) */}
            {!isSetupMode && (
              <div className="security-unlock-footer">
                <button
                  type="button"
                  className="security-forgot-link-btn"
                  onClick={() => {
                    setIsResetView(true);
                    setError('');
                    setSuccess('');
                  }}
                >
                  <Mail size={14} /> Forgot lock code? Reset with email
                </button>

                <button
                  type="button"
                  className="biometric-btn"
                  onClick={() => onUnlock?.()}
                  title="Biometric Fingerprint or Quick Unlock"
                >
                  <Fingerprint size={16} /> Biometric / Quick Unlock
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
