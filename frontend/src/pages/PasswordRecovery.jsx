import React, { useState, useEffect } from 'react';
import { citoyenAuthAPI } from '../services/api';

export default function PasswordRecovery() {
  const [token] = useState(() => {
    return new URLSearchParams(window.location.hash.slice(1)).get('token');
  });
  useEffect(() => {
    if (token) window.history.replaceState(null, '', window.location.pathname);
  }, [token]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const reset = window.location.pathname === '/reset-password';
  async function submit(event) {
    event.preventDefault();
    setError('');
    if (reset && password !== confirmation) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }
    setBusy(true);
    try {
      const result = reset
        ? await citoyenAuthAPI.resetPassword({ token, nouveau_password: password, confirmer_password: confirmation })
        : await citoyenAuthAPI.forgotPassword(email);
      setMessage(result.message);
      setDone(true);
      if (reset) citoyenAuthAPI.logout();
    } catch (e) { setError(typeof e.data?.detail === 'string' ? e.data.detail : 'Impossible de traiter cette demande.'); }
    finally { setBusy(false); }
  }
  return (
    <main style={{ maxWidth: 480, margin: '8vh auto', padding: 24 }}>
      <h1>{reset ? 'Nouveau mot de passe' : 'Mot de passe oublié'}</h1>
      {reset && !token ? <p role="alert">Lien incomplet. Demandez un nouveau lien de réinitialisation.</p> : !done && (
        <form onSubmit={submit} style={{ display: 'grid', gap: 16 }}>
          {reset ? <>
            <label>Nouveau mot de passe (8 caractères minimum)
              <input className="form-input" type="password" autoComplete="new-password" minLength={8} maxLength={256} required value={password} onChange={e => setPassword(e.target.value)} />
            </label>
            <label>Confirmer le mot de passe
              <input className="form-input" type="password" autoComplete="new-password" minLength={8} maxLength={256} required value={confirmation} onChange={e => setConfirmation(e.target.value)} />
            </label>
          </> : <label>Adresse email du compte citoyen
            <input className="form-input" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} />
          </label>}
          <button className="btn btn-primary" disabled={busy}>{busy ? 'Traitement…' : reset ? 'Changer le mot de passe' : 'Recevoir un lien'}</button>
        </form>
      )}
      {message && <p role="status">{message}</p>}
      {error && <p role="alert">{error}</p>}
      <p><a href="/forgot-password">Demander un nouveau lien</a></p>
      <a href="/">Retour à l’accueil et à la connexion</a>
    </main>
  );
}
