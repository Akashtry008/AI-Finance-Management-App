import React, { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import './ThemeToggle.css';

export default function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    // Fallback to local storage
    const savedTheme = localStorage.getItem('finance-os-theme');
    if (savedTheme === 'dark') {
      setIsDark(true);
      document.body.classList.add('dark-theme');
    }
    
    // If logged in, fetch from DB
    if (user) {
      api.get('/profile').then(res => {
        const dbTheme = res.data.theme;
        if (dbTheme === 'dark') {
          setIsDark(true);
          document.body.classList.add('dark-theme');
          localStorage.setItem('finance-os-theme', 'dark');
        } else if (dbTheme === 'light') {
          setIsDark(false);
          document.body.classList.remove('dark-theme');
          localStorage.setItem('finance-os-theme', 'light');
        }
      }).catch(err => console.error("Failed to load theme from profile"));
    }
  }, [user]);

  const toggleTheme = async () => {
    const newTheme = isDark ? 'light' : 'dark';
    
    if (newTheme === 'dark') {
      document.body.classList.add('dark-theme');
      setIsDark(true);
    } else {
      document.body.classList.remove('dark-theme');
      setIsDark(false);
    }
    
    localStorage.setItem('finance-os-theme', newTheme);
    
    if (user) {
      try {
        await api.put('/profile', { theme: newTheme });
      } catch (e) {
        console.error("Failed to save theme to DB");
      }
    }
  };

  return (
    <button className="theme-toggle-btn glass-panel" onClick={toggleTheme} title="Toggle Dark/Light Mode">
      {isDark ? (
        <>
          <Sun size={16} className="text-warning" /> <span className="theme-toggle-label">Light Mode</span>
        </>
      ) : (
        <>
          <Moon size={16} className="text-primary" /> <span className="theme-toggle-label">Dark Mode</span>
        </>
      )}
    </button>
  );
}
