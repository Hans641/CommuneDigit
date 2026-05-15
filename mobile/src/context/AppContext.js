// ═══════════════════════════════════════════════════════════════
//  CommuneDigit Mobile — Contexte global (Thème + Langue + Auth)
//  Auth connectée au backend FastAPI via authAPI
// ═══════════════════════════════════════════════════════════════
import React, { createContext, useContext, useState, useCallback } from 'react';
import { darkTheme, lightTheme } from '../theme';
import { translations } from './i18n';
import { authAPI } from '../services/api';

// ── Contextes ──────────────────────────────────────────────────
const ThemeContext = createContext(null);
const LangContext  = createContext(null);
const AuthContext  = createContext(null);

// ── Hooks ──────────────────────────────────────────────────────
export const useTheme = () => useContext(ThemeContext);
export const useLang  = () => useContext(LangContext);
export const useAuth  = () => useContext(AuthContext);

// ── Provider principal ─────────────────────────────────────────
export function AppProvider({ children }) {
  const [isDark, setIsDark] = useState(true);
  const [lang,   setLang]   = useState('mg');   // Malagasy par défaut
  const [user,   setUser]   = useState(null);
  const [authError, setAuthError] = useState('');

  const theme = isDark ? darkTheme : lightTheme;

  const toggleTheme = useCallback(() => setIsDark(d => !d), []);
  const toggleLang  = useCallback(() => setLang(l => l === 'fr' ? 'mg' : 'fr'), []);

  const tr = useCallback((section, key) => {
    return translations[section]?.[lang]?.[key]
        ?? translations[section]?.fr?.[key]
        ?? key;
  }, [lang]);

  /**
   * Connexion réelle via API FastAPI
   * username = matricule (ex: AGT-0001) ou email
   * Retourne { success: true } ou { success: false, error: string }
   */
  const login = useCallback(async (username, password) => {
    setAuthError('');
    try {
      const { access_token, user: userData } = await authAPI.login(username, password);
      // Stocker le token pour les requêtes suivantes (déjà fait dans authAPI.login via _token)
      setUser(userData);
      return { success: true };
    } catch (err) {
      const msg = err.status === 401
        ? (lang === 'mg' ? 'Diso ny fanamarinana' : 'Identifiants incorrects')
        : (lang === 'mg' ? 'Tsy azo atrehina ny server' : 'Impossible de contacter le serveur');
      setAuthError(msg);
      return { success: false, error: msg };
    }
  }, [lang]);

  const logout = useCallback(() => {
    authAPI.logout();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout, authError }}>
      <ThemeContext.Provider value={{ theme, isDark, toggleTheme }}>
        <LangContext.Provider value={{ lang, setLang, toggleLang, tr }}>
          {children}
        </LangContext.Provider>
      </ThemeContext.Provider>
    </AuthContext.Provider>
  );
}
