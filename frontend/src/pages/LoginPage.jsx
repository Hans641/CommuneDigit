import React, { useState, useEffect } from 'react';
import { useAuth, useApp } from '../App';
import { authAPI } from '../services/api';

const LANG = {
  fr: {
    titre: 'Connexion',
    sous_titre: "Entrez vos identifiants d'agent",
    identifiant: 'Identifiant (matricule ou email)',
    motdepasse: 'Mot de passe',
    connexion: 'Se connecter',
    chargement: 'Connexion…',
    erreur: 'Identifiants incorrects. Vérifiez vos accès.',
    erreur_reseau: 'Impossible de contacter le serveur. Vérifiez la connexion.',
    acces_rapide: 'Accès rapide',
  },
  mg: {
    titre: 'Fidirana',
    sous_titre: 'Ampidiro ny mombamomba anao',
    identifiant: 'Anarana (matricule na email)',
    motdepasse: 'Tenimiafina',
    connexion: 'Miditra',
    chargement: 'Mampiditra…',
    erreur: 'Diso ny fanamarinana. Jereo ny fidiranareo.',
    erreur_reseau: 'Tsy azo atrehina ny mpizarazara. Jereo ny fampifandraisana.',
    acces_rapide: 'Fidirana haingana',
  },
};

const QUICK_USERS = [
  { label: 'Admin Hans',    username: 'AGT-0001', password: 'admin123',  role: 'Administrateur',  avatar: 'AH', color: '#10b981' },
  { label: 'Rakoto Jean',   username: 'AGT-0002', password: 'agent123',  role: 'Agent Fokontany', avatar: 'RJ', color: '#14b8a6' },
  { label: 'Rabe Ministre', username: 'AGT-0003', password: 'mid2024',   role: 'Ministère MID',   avatar: 'RM', color: '#8b5cf6' },
];

export default function LoginPage({ onBack }) {
  const { lang } = useApp();
  const t = LANG[lang] || LANG.fr;
  const { login } = useAuth();

  const [creds, setCreds] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { user } = await authAPI.login(creds.username, creds.password);
      login(user);
    } catch (err) {
      if (err.response?.status === 401) {
        setError(t.erreur);
      } else {
        setError(t.erreur_reseau);
      }
    } finally {
      setLoading(false);
    }
  };

  const quickLogin = async (u) => {
    setCreds({ username: u.username, password: u.password });
    setError('');
    setLoading(true);
    try {
      const { user } = await authAPI.login(u.username, u.password);
      login(user);
    } catch (err) {
      setError(t.erreur_reseau);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-bg">
      {/* Panel gauche */}
      <div className="auth-left">
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>🏛️</div>
          <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 900, fontSize: '1.6rem', color: 'var(--text-primary)' }}>
            CommuneDigit
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: 4 }}>
            {lang === 'mg' ? 'Serivisy Kaominaly Nomerika' : 'Services Communaux Numériques'}
          </div>
        </div>

        {onBack && (
          <button className="btn btn-ghost btn-sm" style={{ marginBottom: 24, width: 'fit-content' }} onClick={onBack}>
            ← {lang === 'mg' ? 'Hiverina' : 'Retour au portail'}
          </button>
        )}

        <div className="glass-card" style={{ padding: 20 }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
            {t.acces_rapide}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {QUICK_USERS.map(u => (
              <button
                key={u.username}
                className="btn btn-glass btn-sm"
                style={{ justifyContent: 'flex-start', gap: 10 }}
                onClick={() => quickLogin(u)}
                disabled={loading}
              >
                <span style={{ width: 28, height: 28, borderRadius: '50%', background: u.color, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 800, color: '#fff', flexShrink: 0 }}>
                  {u.avatar}
                </span>
                <span style={{ fontSize: '0.82rem' }}>
                  {u.label} <span style={{ opacity: 0.45 }}>· {u.role}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Panel droit — Formulaire */}
      <div className="glass-card auth-card" style={{ flex: '0 0 380px', padding: '44px 36px' }}>
        <div className="auth-logo">
          <div style={{ width: 56, height: 56, borderRadius: 16, background: 'linear-gradient(135deg,#10b981,#14b8a6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.6rem', margin: '0 auto', boxShadow: '0 8px 24px rgba(16,185,129,0.35)' }}>🔐</div>
        </div>
        <div className="auth-title">{t.titre}</div>
        <div className="auth-sub">{t.sous_titre}</div>

        <form className="auth-form" onSubmit={handleLogin}>
          <div className="form-group">
            <label className="form-label">{t.identifiant}</label>
            <input
              className="form-input"
              type="text"
              value={creds.username}
              onChange={e => setCreds({ ...creds, username: e.target.value })}
              placeholder="AGT-0001 ou email"
              required
              autoComplete="username"
            />
          </div>
          <div className="form-group">
            <label className="form-label">{t.motdepasse}</label>
            <input
              className="form-input"
              type="password"
              value={creds.password}
              onChange={e => setCreds({ ...creds, password: e.target.value })}
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 14px', color: '#f87171', fontSize: '0.84rem', marginBottom: 4 }}>
              {error}
            </div>
          )}

          <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: '100%', marginTop: 8 }}>
            {loading ? t.chargement : t.connexion}
          </button>
        </form>
      </div>
    </div>
  );
}
