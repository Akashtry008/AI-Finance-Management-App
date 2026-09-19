import React, { useState, useEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Bell, Menu, TrendingUp, ArrowLeftRight, Lock, WifiOff, Check, CheckCheck, Eye, EyeOff } from 'lucide-react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import Sidebar from './Sidebar';
import OnboardingTour from './OnboardingTour';
import AIChatWidget from './AIChatWidget';
import CurrencyConverter from './CurrencyConverter';
import SecurityLockModal from './SecurityLockModal';
import CursorGlow from './CursorGlow';
import LanguageSwitcher from './LanguageSwitcher';
import { isPrivacyModeActive, setPrivacyModeActive } from '../utils';
import { getAppLanguage, t } from '../i18n';
import './Layout.css';

export default function Layout() {
  const { user } = useAuth();
  const userKey = user?.username || 'user';
  const notifStorageKey = `finance-os-read-notifications-${userKey}`;

  const [mobileOpen, setMobileOpen] = useState(false);
  const [, setCurrentLang] = useState(getAppLanguage());
  const [, setCurrentCurrency] = useState(() => localStorage.getItem('finance-os-currency') || 'INR');
  const [notifications, setNotifications] = useState([]);
  const [readNotificationIds, setReadNotificationIds] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(notifStorageKey) || '[]');
    } catch {
      return [];
    }
  });
  const [notifFilter, setNotifFilter] = useState('all'); // 'all' | 'unread'
  const [secEnabled, setSecEnabled] = useState(
    () => localStorage.getItem('finance-os-security-enabled') === 'true'
  );
  const [showDropdown, setShowDropdown] = useState(false);
  const [showConverter, setShowConverter] = useState(false);
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [isPrivacy, setIsPrivacy] = useState(() => isPrivacyModeActive());
  const [showSecurityModal, setShowSecurityModal] = useState(false);
  const [isSetupMode, setIsSetupMode] = useState(false);
  const dropdownRef = useRef(null);
  const location = useLocation();

  const togglePrivacy = () => {
    const next = !isPrivacy;
    setIsPrivacy(next);
    setPrivacyModeActive(next);
  };

  useEffect(() => {
    const handleSecChange = (e) => {
      setSecEnabled(e.detail?.enabled ?? (localStorage.getItem('finance-os-security-enabled') === 'true'));
    };
    window.addEventListener('securitySettingsChange', handleSecChange);
    return () => window.removeEventListener('securitySettingsChange', handleSecChange);
  }, []);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    const handleLangChange = (e) => {
      setCurrentLang(e.detail?.language || getAppLanguage());
    };
    const handlePrivacy = (e) => {
      setIsPrivacy(e.detail?.isPrivacyMode ?? isPrivacyModeActive());
    };
    window.addEventListener('languageChange', handleLangChange);
    window.addEventListener('privacyModeChange', handlePrivacy);
    return () => {
      window.removeEventListener('languageChange', handleLangChange);
      window.removeEventListener('privacyModeChange', handlePrivacy);
    };
  }, []);

  useEffect(() => {
    setShowDropdown(false);
    setMobileOpen(false);
    const fetchNotifications = async () => {
      try {
        const res = await api.get('/notifications');
        setNotifications(res.data);
      } catch (err) {
        console.error(err);
      }
    };
    
    const fetchUserCurrency = async () => {
      try {
        const res = await api.get('/profile');
        if (res.data.currency) {
          localStorage.setItem('finance-os-currency', res.data.currency);
          setCurrentCurrency(res.data.currency);
        }
      } catch (err) {
        console.error("Failed to fetch user currency:", err);
      }
    };

    fetchNotifications();
    fetchUserCurrency();
  }, [location.pathname]);

  useEffect(() => {
    const handleCurrencyEvent = (e) => {
      const newCurr = e.detail?.currency || localStorage.getItem('finance-os-currency') || 'INR';
      setCurrentCurrency(newCurr);
    };

    window.addEventListener('currencyChange', handleCurrencyEvent);
    return () => window.removeEventListener('currencyChange', handleCurrencyEvent);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showDropdown]);



  useEffect(() => {
    try {
      setReadNotificationIds(JSON.parse(localStorage.getItem(notifStorageKey) || '[]'));
    } catch {
      setReadNotificationIds([]);
    }
  }, [notifStorageKey]);

  const markNotificationAsRead = (id, e) => {
    if (e) e.stopPropagation();
    setReadNotificationIds(prev => {
      if (prev.includes(id)) return prev;
      const next = [...prev, id];
      localStorage.setItem(notifStorageKey, JSON.stringify(next));
      return next;
    });
  };

  const markAllNotificationsAsRead = () => {
    const allIds = notifications.map(n => n.id);
    setReadNotificationIds(prev => {
      const merged = Array.from(new Set([...prev, ...allIds]));
      localStorage.setItem(notifStorageKey, JSON.stringify(merged));
      return merged;
    });
  };

  const unreadCount = notifications.filter(n => !readNotificationIds.includes(n.id)).length;
  const displayedNotifications = notifFilter === 'unread'
    ? notifications.filter(n => !readNotificationIds.includes(n.id))
    : notifications;

  const renderNotifications = () => (
    <div className="notification-container" ref={dropdownRef}>
      <button
        className="notification-bell"
        onClick={() => setShowDropdown(prev => !prev)}
        aria-label="Toggle notifications"
      >
        <Bell size={20} />
        {unreadCount > 0 && <span className="notification-badge">{unreadCount}</span>}
      </button>
      
      {showDropdown && (
        <div className="notification-dropdown glass-panel">
          <div className="notification-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <h4>Notifications</h4>
              {unreadCount > 0 && (
                <span className="notification-count-tag">{unreadCount} new</span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                className="mark-all-read-btn"
                onClick={markAllNotificationsAsRead}
                title="Mark all as read"
              >
                <CheckCheck size={13} />
                <span>Mark all read</span>
              </button>
            )}
          </div>

          <div className="notification-filter-tabs">
            <button
              type="button"
              className={`notif-tab-pill ${notifFilter === 'all' ? 'active' : ''}`}
              onClick={() => setNotifFilter('all')}
            >
              All ({notifications.length})
            </button>
            <button
              type="button"
              className={`notif-tab-pill ${notifFilter === 'unread' ? 'active' : ''}`}
              onClick={() => setNotifFilter('unread')}
            >
              Unread ({unreadCount})
            </button>
          </div>

          {displayedNotifications.length === 0 ? (
            <p className="no-notifications">
              {notifFilter === 'unread' ? "No unread notifications!" : "You're all caught up!"}
            </p>
          ) : (
            <div className="notification-list">
              {displayedNotifications.map(n => {
                const isRead = readNotificationIds.includes(n.id);
                return (
                  <div
                    key={n.id}
                    className={`notification-item notification-${n.type} ${isRead ? 'notification-item--read' : ''}`}
                  >
                    <div className="notification-item-content">
                      <strong>{n.title}</strong>
                      <p>{n.message}</p>
                    </div>
                    {!isRead ? (
                      <button
                        type="button"
                        className="notification-read-btn"
                        onClick={(e) => markNotificationAsRead(n.id, e)}
                        title="Mark as read"
                      >
                        <Check size={12} />
                        <span>Read</span>
                      </button>
                    ) : (
                      <span className="notification-read-status" title="Read">
                        <Check size={11} />
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="app-container">
      <CursorGlow />
      {/* Mobile Top Bar (sticky on small devices) */}
      <header className="mobile-topbar glass-panel">
        <div className="mobile-topbar-left">
          <button
            className="mobile-hamburger-btn"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation menu"
          >
            <Menu size={22} />
          </button>
          <div className="mobile-brand">
            <TrendingUp size={22} color="var(--accent-color)" />
            <span className="mobile-brand-name">FinanceOS</span>
          </div>
        </div>
        <div className="mobile-topbar-right">
          {!isOnline && (
            <span className="mobile-offline-badge" title="Offline Mode">
              <WifiOff size={14} color="#f87171" />
            </span>
          )}
          {secEnabled && (
            <button
              type="button"
              className="topbar-lock-icon-btn"
              onClick={() => {
                setIsSetupMode(false);
                setShowSecurityModal(true);
              }}
              title="Lock Screen Directly"
              aria-label="Lock Screen Directly"
            >
              <Lock size={17} />
            </button>
          )}
          <button
            type="button"
            className={`topbar-converter-icon-btn ${isPrivacy ? 'active-privacy' : ''}`}
            onClick={togglePrivacy}
            title={isPrivacy ? t('privacyDisable', 'Reveal Balances') : t('privacyEnable', 'Mask Balances (Privacy Mode)')}
            aria-label="Toggle Privacy Mode"
          >
            {isPrivacy ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
          <button
            type="button"
            className="topbar-converter-icon-btn"
            onClick={() => setShowConverter(true)}
            title="Open Currency Converter"
            aria-label="Open Currency Converter"
          >
            <ArrowLeftRight size={17} />
          </button>
          <LanguageSwitcher compact />
          {renderNotifications()}
        </div>
      </header>

      <Sidebar mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />

      <main className="main-content">
        {/* Desktop Topbar */}
        <div className="layout-topbar">
          <div className="layout-topbar-left">
            {!isOnline && (
              <div className="topbar-offline-pill" title="You are currently offline. Changes cached locally.">
                <WifiOff size={13} />
                <span>{t('offlineMode', 'Offline Mode')}</span>
              </div>
            )}
          </div>
          <div className="layout-topbar-right">
            {/* App Lock Screen Trigger Button - ONLY visible when enabled & set from settings */}
            {secEnabled && (
              <button
                type="button"
                className="topbar-lock-btn"
                onClick={() => {
                  setIsSetupMode(false);
                  setShowSecurityModal(true);
                }}
                title="Lock Screen Directly"
              >
                <Lock size={14} />
                <span>{t('lockScreen', 'Lock App')}</span>
              </button>
            )}

            <button
              type="button"
              className={`topbar-privacy-btn ${isPrivacy ? 'active' : ''}`}
              onClick={togglePrivacy}
              title={isPrivacy ? t('privacyDisable', 'Reveal Balances') : t('privacyEnable', 'Mask Balances (Privacy Mode)')}
            >
              {isPrivacy ? <EyeOff size={14} /> : <Eye size={14} />}
              <span>{isPrivacy ? t('privacyOn', 'Private') : t('privacyOff', 'Privacy')}</span>
            </button>

            {/* Currency Converter Trigger Button - beside notification icon */}
            <button
              type="button"
              className="topbar-converter-btn"
              onClick={() => setShowConverter(true)}
              title="Open Live Currency Converter"
            >
              <ArrowLeftRight size={14} />
              <span>{t('converter', 'Converter')}</span>
            </button>

            <LanguageSwitcher />
            {renderNotifications()}
          </div>
        </div>
        <Outlet />
      </main>

      <CurrencyConverter
        isOpen={showConverter}
        onClose={() => setShowConverter(false)}
      />

      <SecurityLockModal
        isOpen={showSecurityModal}
        isSetupMode={isSetupMode}
        onClose={() => setShowSecurityModal(false)}
        onUnlock={() => setShowSecurityModal(false)}
      />

      <OnboardingTour />
      <AIChatWidget />
    </div>
  );
}
