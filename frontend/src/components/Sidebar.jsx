import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  TrendingUp, LayoutDashboard, ArrowLeftRight,
  PiggyBank, LogOut, User, ShieldCheck, Users, Menu, X, Target
} from 'lucide-react';
import './Sidebar.css';
import ThemeToggle from './ThemeToggle';



export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = user?.isAdmin
    ? [{ to: '/admin', label: 'System Overview', icon: LayoutDashboard, exact: true }]
    : [
        { to: '/', label: 'Dashboard', icon: LayoutDashboard, exact: true },
        { to: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
        { to: '/budgets', label: 'Budgets', icon: PiggyBank },
        { to: '/goals', label: 'Savings Goals', icon: Target },
        { to: '/split', label: 'Split Expenses', icon: Users },
        { to: '/profile', label: 'Profile', icon: User },
      ];

  const closeMobile = () => setMobileOpen(false);

  return (
    <>
      {/* Mobile hamburger */}
      <button className="sidebar-hamburger" onClick={() => setMobileOpen(true)} aria-label="Open menu">
        <Menu size={22} />
      </button>

      {/* Overlay */}
      {mobileOpen && <div className="sidebar-overlay" onClick={closeMobile} />}

      <aside className={`sidebar ${mobileOpen ? 'sidebar--open' : ''}`}>
        <div className="sidebar-top">
          <div className="sidebar-logo">
            <TrendingUp size={24} color="var(--accent-color)" />
            <span className="sidebar-logo-text">FinanceOS</span>
          </div>
          <button className="sidebar-close-btn" onClick={closeMobile}><X size={20}/></button>
        </div>

        <nav className="sidebar-nav">
          {navItems.map(({ to, label, icon: Icon, exact }) => (
            <NavLink
              key={to} to={to} end={exact}
              className={({ isActive }) => `sidebar-link ${isActive ? 'sidebar-link--active' : ''}`}
              onClick={closeMobile}
            >
              <Icon size={18} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className={`sidebar-user-avatar ${user?.isAdmin ? 'sidebar-user-avatar--admin' : ''}`}>
              {user?.isAdmin ? <ShieldCheck size={16}/> : <User size={16}/>}
            </div>
            <div className="sidebar-user-info">
              <span className="sidebar-user-name">{user?.username}</span>
              {user?.isAdmin
                ? <span className="sidebar-user-role sidebar-role-admin">Administrator</span>
                : <span className="sidebar-user-role text-muted">Member</span>
              }
            </div>
          </div>
          <div className="sidebar-bottom-actions">
            <ThemeToggle />
            <button className="btn btn-secondary sidebar-logout" onClick={handleLogout}>
              <LogOut size={16}/> Logout
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
