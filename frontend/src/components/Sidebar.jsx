import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  TrendingUp, LayoutDashboard, ArrowLeftRight,
  PiggyBank, LogOut, User, ShieldCheck, Users, Menu, X, Target,
  ChevronLeft, ChevronRight
} from 'lucide-react';
import './Sidebar.css';
import ThemeToggle from './ThemeToggle';
import { useTranslation } from '../i18n';

export default function Sidebar({ mobileOpen: controlledOpen, setMobileOpen: setControlledOpen }) {
  const { user, logout } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [internalOpen, setInternalOpen] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem('finance-os-sidebar-width');
    const width = saved ? parseInt(saved, 10) : 240;
    return isNaN(width) ? 240 : Math.min(Math.max(width, 72), 360);
  });
  const [isCollapsed, setIsCollapsed] = useState(
    () => localStorage.getItem('finance-os-sidebar-collapsed') === 'true' || (sidebarWidth < 120)
  );
  const [isResizing, setIsResizing] = useState(false);

  const mobileOpen = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setMobileOpen = setControlledOpen || setInternalOpen;

  const [customAvatar, setCustomAvatar] = useState(() => {
    return localStorage.getItem(`finance-os-avatar-${user?.username}`) || localStorage.getItem('finance-os-avatar') || '';
  });

  useEffect(() => {
    const handleAvatar = (e) => {
      setCustomAvatar(e.detail?.avatar || '');
    };
    window.addEventListener('avatarChange', handleAvatar);
    return () => window.removeEventListener('avatarChange', handleAvatar);
  }, []);

  useEffect(() => {
    if (user?.username) {
      setCustomAvatar(
        localStorage.getItem(`finance-os-avatar-${user.username}`) || localStorage.getItem('finance-os-avatar') || ''
      );
    }
  }, [user?.username]);

  const toggleCollapse = () => {
    setIsCollapsed(prev => {
      const next = !prev;
      const targetWidth = next ? 72 : (sidebarWidth > 120 ? sidebarWidth : 240);
      if (!next && sidebarWidth < 120) {
        setSidebarWidth(240);
        localStorage.setItem('finance-os-sidebar-width', '240');
      }
      localStorage.setItem('finance-os-sidebar-collapsed', String(next));
      window.dispatchEvent(new CustomEvent('sidebarCollapse', { detail: { collapsed: next } }));
      return next;
    });
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Drag-to-resize handler for desktop
  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e) => {
      const rawWidth = e.clientX;
      if (rawWidth < 110) {
        setSidebarWidth(72);
        setIsCollapsed(true);
      } else {
        const clamped = Math.min(Math.max(rawWidth, 140), 360);
        setSidebarWidth(clamped);
        setIsCollapsed(false);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      localStorage.setItem('finance-os-sidebar-width', String(sidebarWidth));
      localStorage.setItem('finance-os-sidebar-collapsed', String(sidebarWidth <= 80));
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing, sidebarWidth]);

  const startResizing = (e) => {
    e.preventDefault();
    setIsResizing(true);
  };

  const navItems = user?.isAdmin
    ? [{ to: '/admin', label: t('dashboard', 'System Overview'), icon: LayoutDashboard, exact: true }]
    : [
        { to: '/', label: t('dashboard', 'Dashboard'), icon: LayoutDashboard, exact: true },
        { to: '/transactions', label: t('transactions', 'Transactions'), icon: ArrowLeftRight },
        { to: '/budgets', label: t('budgets', 'Budgets'), icon: PiggyBank },
        { to: '/goals', label: t('goals', 'Savings Goals'), icon: Target },
        { to: '/split', label: t('split', 'Split Expenses'), icon: Users },
        { to: '/profile', label: t('profile', 'Profile'), icon: User },
      ];

  const closeMobile = () => setMobileOpen(false);

  const currentWidth = isCollapsed ? 72 : sidebarWidth;

  return (
    <>
      {/* Standalone mobile hamburger fallback if uncontrolled */}
      {controlledOpen === undefined && (
        <button className="sidebar-hamburger" onClick={() => setMobileOpen(true)} aria-label="Open menu">
          <Menu size={22} />
        </button>
      )}

      {/* Overlay */}
      {mobileOpen && <div className="sidebar-overlay" onClick={closeMobile} />}

      <aside
        className={`sidebar ${mobileOpen ? 'sidebar--open' : ''} ${isCollapsed ? 'sidebar--collapsed' : ''} ${isResizing ? 'sidebar--resizing' : ''}`}
        style={{ width: `${currentWidth}px` }}
      >
        {/* Desktop adjustable drag border handle */}
        <div
          className={`sidebar-resizer ${isResizing ? 'resizing' : ''}`}
          onMouseDown={startResizing}
          title="Drag to adjust sidebar width"
        />
        <div className="sidebar-top">
          <div className="sidebar-logo">
            <TrendingUp size={24} color="var(--accent-color)" />
            <span className="sidebar-logo-text">FinanceOS</span>
          </div>
          <div className="sidebar-top-controls">
            <button
              type="button"
              className="sidebar-toggle-btn desktop-only"
              onClick={toggleCollapse}
              title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {isCollapsed ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}
            </button>
            <button className="sidebar-close-btn" onClick={closeMobile} aria-label="Close menu">
              <X size={20}/>
            </button>
          </div>
        </div>

        <nav className="sidebar-nav">
          {navItems.map(({ to, label, icon: Icon, exact }) => (
            <NavLink
              key={to} to={to} end={exact}
              className={({ isActive }) => `sidebar-link ${isActive ? 'sidebar-link--active' : ''}`}
              onClick={closeMobile}
              title={isCollapsed ? label : undefined}
            >
              <Icon size={18} className="sidebar-link-icon" />
              <span className="sidebar-link-text">{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div
            className="sidebar-user"
            title={isCollapsed ? `${user?.username || ''} (${user?.isAdmin ? 'Admin' : 'Member'})` : undefined}
          >
            <div className={`sidebar-user-avatar ${user?.isAdmin ? 'sidebar-user-avatar--admin' : ''}`}>
              {customAvatar ? (
                <img src={customAvatar} alt={user?.username || 'User'} className="sidebar-user-avatar-img" />
              ) : user?.isAdmin ? (
                <ShieldCheck size={16}/>
              ) : (
                <User size={16}/>
              )}
            </div>
            <div className="sidebar-user-info">
              <span className="sidebar-user-name">{user?.username}</span>
              {user?.isAdmin
                ? <span className="sidebar-user-role sidebar-role-admin">{t('administrator', 'Administrator')}</span>
                : <span className="sidebar-user-role text-muted">{t('member', 'Member')}</span>
              }
            </div>
          </div>
          <div className="sidebar-bottom-actions">
            <ThemeToggle />
            <button
              className="btn btn-secondary sidebar-logout"
              onClick={handleLogout}
              title={isCollapsed ? t('logout', "Logout") : undefined}
            >
              <LogOut size={16}/>
              <span className="sidebar-logout-text">{t('logout', 'Logout')}</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
