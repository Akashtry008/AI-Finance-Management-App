import React, { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Bell } from 'lucide-react';
import api from '../api';
import Sidebar from './Sidebar';
import OnboardingTour from './OnboardingTour';
import AIChatWidget from './AIChatWidget';
import './Layout.css';

export default function Layout() {
  const [notifications, setNotifications] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const location = useLocation();

  useEffect(() => {
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
        }
      } catch (err) {
        console.error("Failed to fetch user currency:", err);
      }
    };

    fetchNotifications();
    fetchUserCurrency();
  }, [location.pathname]); // Refresh on navigation

  return (
    <div className="app-container">
      <Sidebar />
      <main className="main-content">
        <div className="layout-topbar">
          <div className="notification-container">
            <button className="notification-bell" onClick={() => setShowDropdown(!showDropdown)}>
              <Bell size={20} />
              {notifications.length > 0 && <span className="notification-badge">{notifications.length}</span>}
            </button>
            
            {showDropdown && (
              <div className="notification-dropdown glass-panel">
                <h4>Notifications</h4>
                {notifications.length === 0 ? (
                  <p className="no-notifications">You're all caught up!</p>
                ) : (
                  <div className="notification-list">
                    {notifications.map(n => (
                      <div key={n.id} className={`notification-item notification-${n.type}`}>
                        <strong>{n.title}</strong>
                        <p>{n.message}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        <Outlet />
      </main>
      <OnboardingTour />
      <AIChatWidget />
    </div>
  );
}
