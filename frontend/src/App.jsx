import React, { useState, useEffect, createContext, useContext } from 'react';
import './index.css';
import { authAPI } from './services/api';

// ─── Agent Auth Context ───────────────────────────────────────────
const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

// ─── App State Context ────────────────────────────────────────────
const AppContext = createContext(null);
export const useApp = () => useContext(AppContext);

// ─── Pages ───────────────────────────────────────────────────────
import LoginPage        from './pages/LoginPage';
import PublicPage       from './pages/PublicPage';
import DashboardLayout  from './pages/DashboardLayout';
import CitoyenPortail   from './pages/CitoyenPortail';

export default function App() {
  // Agent session rehydration
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('cd_user');
    const token  = localStorage.getItem('cd_token');
    if (stored && token) {
      try { return JSON.parse(stored); } catch { return null; }
    }
    return null;
  });

  const [view, setView] = useState(() => {
    if (localStorage.getItem('cd_token'))         return 'dashboard';
    if (localStorage.getItem('cd_citoyen_token')) return 'citoyen';
    return 'public';
  });

  const [lang,  setLang]  = useState('mg');
  const [theme, setTheme] = useState('dark');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Agent 401
  useEffect(() => {
    const h = () => { setUser(null); setView('public'); };
    window.addEventListener('cd:unauthorized', h);
    return () => window.removeEventListener('cd:unauthorized', h);
  }, []);

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark');

  const login = (userData) => {
    setUser(userData);
    setView('dashboard');
  };

  const logout = () => {
    authAPI.logout();
    setUser(null);
    setView('public');
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      <AppContext.Provider value={{ lang, setLang, theme, toggleTheme }}>
        {view === 'public'    && <PublicPage onLogin={() => setView('login')} onCitoyen={() => setView('citoyen')} />}
        {view === 'login'     && <LoginPage  onBack={() => setView('public')} />}
        {view === 'dashboard' && user && <DashboardLayout />}
        {view === 'citoyen'   && <CitoyenPortail onBack={() => setView('public')} />}
      </AppContext.Provider>
    </AuthContext.Provider>
  );
}
