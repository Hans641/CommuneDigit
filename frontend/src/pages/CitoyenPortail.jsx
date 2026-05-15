/**
 * CommuneDigit — Portail Citoyen
 * Espace numérique complet : Inscription · Login · Accueil · Documents
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { citoyenAuthAPI, citoyenEspaceAPI } from '../services/api';

// ── Palette & tokens ──────────────────────────────────────────────
const C = {
  emerald: '#10b981', teal: '#14b8a6', gold: '#f59e0b',
  red: '#ef4444', indigo: '#6366f1', purple: '#8b5cf6',
  bg: 'linear-gradient(135deg, #0a1628 0%, #0d2137 50%, #081520 100%)',
  glass: 'rgba(255,255,255,0.06)',
  glassBorder: 'rgba(255,255,255,0.12)',
  glassBorderHover: 'rgba(16,185,129,0.4)',
  text: '#f0fdf4',
  textMuted: 'rgba(240,253,244,0.55)',
  textDim: 'rgba(240,253,244,0.35)',
};

// ── Helpers UI ────────────────────────────────────────────────────
const Glass = ({ children, style = {}, onClick }) => (
  <div onClick={onClick} style={{
    background: C.glass, backdropFilter: 'blur(20px)',
    border: `1px solid ${C.glassBorder}`, borderRadius: 20,
    transition: 'all 0.25s ease', ...style
  }}>{children}</div>
);

const Btn = ({ children, variant = 'primary', onClick, disabled, style = {}, type = 'button' }) => {
  const base = {
    primary: { background: `linear-gradient(135deg,${C.emerald},${C.teal})`, color: '#fff', border: 'none', boxShadow: `0 4px 20px rgba(16,185,129,0.35)` },
    ghost:   { background: C.glass, border: `1px solid ${C.glassBorder}`, color: C.text },
    danger:  { background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5' },
    gold:    { background: `linear-gradient(135deg,${C.gold},#f97316)`, color: '#fff', border: 'none' },
  }[variant];
  return (
    <button type={type} onClick={onClick} disabled={disabled} style={{
      ...base, padding: '12px 24px', borderRadius: 12, fontFamily: 'inherit',
      fontWeight: 700, fontSize: '0.9rem', cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.6 : 1, transition: 'all 0.2s', width: '100%', ...style
    }}>{children}</button>
  );
};

const Input = ({ label, type = 'text', value, onChange, placeholder, required, icon }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
    {label && <label style={{ fontSize: '0.8rem', fontWeight: 600, color: C.textMuted, letterSpacing: '0.04em' }}>{label}</label>}
    <div style={{ position: 'relative' }}>
      {icon && <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: '1rem', opacity: 0.5 }}>{icon}</span>}
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} required={required}
        style={{
          width: '100%', background: 'rgba(255,255,255,0.05)', border: `1px solid ${C.glassBorder}`,
          borderRadius: 12, padding: icon ? '11px 14px 11px 42px' : '11px 14px',
          color: C.text, fontFamily: 'inherit', fontSize: '0.9rem', outline: 'none',
          boxSizing: 'border-box', transition: 'border-color 0.2s',
        }}
        onFocus={e => e.target.style.borderColor = C.emerald}
        onBlur={e => e.target.style.borderColor = C.glassBorder}
      />
    </div>
  </div>
);

const Badge = ({ label, color = C.emerald }) => (
  <span style={{
    background: `${color}22`, border: `1px solid ${color}55`,
    color, borderRadius: 99, padding: '3px 10px', fontSize: '0.72rem', fontWeight: 700,
  }}>{label}</span>
);

const StatusBadge = ({ statut }) => {
  const m = {
    'Soumise':      { bg: 'rgba(99,102,241,0.2)',  border: 'rgba(99,102,241,0.4)',  c: '#a5b4fc', txt: 'Soumise' },
    'En traitement':{ bg: 'rgba(245,158,11,0.2)',  border: 'rgba(245,158,11,0.4)',  c: '#fbbf24', txt: 'En traitement' },
    'Approuvée':    { bg: 'rgba(16,185,129,0.2)',   border: 'rgba(16,185,129,0.4)',  c: '#34d399', txt: 'Approuvée ✓' },
    'Prête':        { bg: 'rgba(16,185,129,0.25)',  border: 'rgba(16,185,129,0.5)',  c: '#10b981', txt: '✅ Prête' },
    'Rejetée':      { bg: 'rgba(239,68,68,0.15)',   border: 'rgba(239,68,68,0.3)',   c: '#fca5a5', txt: 'Rejetée' },
    'Brouillon':    { bg: 'rgba(255,255,255,0.08)', border: 'rgba(255,255,255,0.15)',c: '#94a3b8', txt: 'Brouillon' },
  };
  const s = m[statut] || m['Brouillon'];
  return <span style={{ background: s.bg, border: `1px solid ${s.border}`, color: s.c, borderRadius: 99, padding: '4px 12px', fontSize: '0.75rem', fontWeight: 700 }}>{s.txt}</span>;
};

// ══════════════════════════════════════════════════════════════════
//  ÉCRAN INSCRIPTION
// ══════════════════════════════════════════════════════════════════
function PageInscription({ onSuccess, onLogin }) {
  const [step, setStep] = useState(1); // 1=compte, 2=identité
  const [form, setForm] = useState({
    email: '', password: '', confirm: '',
    nom: '', prenom: '', telephone: '', cin: '', adresse: '', fokontany_id: '',
  });
  const [fokontanys, setFokontanys] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const f = (k) => (v) => setForm(prev => ({ ...prev, [k]: v }));

  useEffect(() => {
    citoyenEspaceAPI.fokontany().then(setFokontanys).catch(() => {});
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (step === 1) {
      if (form.password !== form.confirm) return setErr('Les mots de passe ne correspondent pas');
      if (form.password.length < 6) return setErr('Mot de passe trop court (min. 6 caractères)');
      setErr(''); setStep(2); return;
    }
    setLoading(true); setErr('');
    try {
      const res = await citoyenAuthAPI.inscription({
        email: form.email, password: form.password,
        nom: form.nom, prenom: form.prenom,
        telephone: form.telephone, cin: form.cin || undefined,
        adresse: form.adresse || undefined,
        fokontany_id: form.fokontany_id ? parseInt(form.fokontany_id) : undefined,
      });
      onSuccess(res.compte);
    } catch (e) {
      setErr(e.data?.detail || 'Erreur lors de l\'inscription');
    } finally { setLoading(false); }
  };

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: '0 16px' }}>
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <div style={{ fontSize: '3rem', marginBottom: 10 }}>🏛️</div>
        <h1 style={{ fontFamily: 'Syne, sans-serif', fontSize: '1.8rem', fontWeight: 900, color: C.text, margin: 0 }}>
          Créer mon compte
        </h1>
        <p style={{ color: C.textMuted, marginTop: 8, fontSize: '0.9rem' }}>
          Portail citoyen — CommuneDigit 🇲🇬
        </p>
        {/* Steps */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0, marginTop: 24 }}>
          {['Compte', 'Identité'].map((s, i) => (
            <React.Fragment key={i}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.8rem', fontWeight: 800,
                  background: step > i + 1 ? C.emerald : step === i + 1 ? `linear-gradient(135deg,${C.emerald},${C.teal})` : C.glass,
                  border: step === i + 1 ? 'none' : `1px solid ${C.glassBorder}`,
                  color: step >= i + 1 ? '#fff' : C.textMuted,
                }}>{step > i + 1 ? '✓' : i + 1}</div>
                <span style={{ fontSize: '0.78rem', color: step === i + 1 ? C.text : C.textMuted, fontWeight: step === i + 1 ? 700 : 400 }}>{s}</span>
              </div>
              {i < 1 && <div style={{ width: 40, height: 1, background: step > 1 ? C.emerald : C.glassBorder, margin: '0 8px' }} />}
            </React.Fragment>
          ))}
        </div>
      </div>

      <Glass style={{ padding: '32px 28px' }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {step === 1 && <>
            <Input label="Adresse email *" type="email" icon="📧" value={form.email} onChange={f('email')} placeholder="votre@email.mg" required />
            <Input label="Mot de passe *" type="password" icon="🔒" value={form.password} onChange={f('password')} placeholder="Min. 6 caractères" required />
            <Input label="Confirmer le mot de passe *" type="password" icon="🔒" value={form.confirm} onChange={f('confirm')} placeholder="Répétez le mot de passe" required />
          </>}

          {step === 2 && <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <Input label="Nom *" icon="👤" value={form.nom} onChange={f('nom')} placeholder="NOM" required />
              <Input label="Prénom(s) *" value={form.prenom} onChange={f('prenom')} placeholder="Prénom" required />
            </div>
            <Input label="Téléphone *" type="tel" icon="📱" value={form.telephone} onChange={f('telephone')} placeholder="+261 34 00 000 00" required />
            <Input label="CIN (optionnel)" icon="🪪" value={form.cin} onChange={f('cin')} placeholder="Numéro CIN si disponible" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: C.textMuted }}>Fokontany *</label>
              <select value={form.fokontany_id} onChange={e => f('fokontany_id')(e.target.value)} required
                style={{ background: 'rgba(255,255,255,0.05)', border: `1px solid ${C.glassBorder}`, borderRadius: 12, padding: '11px 14px', color: C.text, fontFamily: 'inherit', fontSize: '0.9rem', outline: 'none', width: '100%' }}>
                <option value="">Sélectionner votre fokontany…</option>
                {fokontanys.map(f => <option key={f.id} value={f.id} style={{ background: '#0d2137' }}>{f.nom}</option>)}
              </select>
            </div>
            <Input label="Adresse" icon="📍" value={form.adresse} onChange={f('adresse')} placeholder="Adresse complète" />
          </>}

          {err && <div style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '10px 14px', color: '#fca5a5', fontSize: '0.85rem' }}>{err}</div>}

          <div style={{ display: 'flex', gap: 10 }}>
            {step === 2 && <Btn variant="ghost" onClick={() => setStep(1)} style={{ width: 'auto', padding: '12px 20px' }}>← Retour</Btn>}
            <Btn type="submit" disabled={loading} style={{ flex: 1 }}>
              {loading ? 'Création…' : step === 1 ? 'Continuer →' : 'Créer mon compte ✓'}
            </Btn>
          </div>
        </form>
      </Glass>

      <p style={{ textAlign: 'center', color: C.textMuted, fontSize: '0.85rem', marginTop: 20 }}>
        Déjà inscrit ?{' '}
        <button onClick={onLogin} style={{ background: 'none', border: 'none', color: C.emerald, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.85rem' }}>
          Se connecter →
        </button>
      </p>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
//  ÉCRAN LOGIN
// ══════════════════════════════════════════════════════════════════
function PageLogin({ onSuccess, onInscription }) {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [err, setErr]           = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setErr('');
    try {
      const res = await citoyenAuthAPI.login(email, password);
      onSuccess(res.compte);
    } catch (e) {
      setErr(e.status === 401 ? 'Email ou mot de passe incorrect' : 'Impossible de contacter le serveur');
    } finally { setLoading(false); }
  };

  return (
    <div style={{ maxWidth: 420, margin: '0 auto', padding: '0 16px' }}>
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <div style={{ fontSize: '3rem', marginBottom: 10 }}>🏛️</div>
        <h1 style={{ fontFamily: 'Syne, sans-serif', fontSize: '1.8rem', fontWeight: 900, color: C.text, margin: 0 }}>
          Mon espace citoyen
        </h1>
        <p style={{ color: C.textMuted, marginTop: 8, fontSize: '0.9rem' }}>CommuneDigit · Madagascar 🇲🇬</p>
      </div>

      <Glass style={{ padding: '32px 28px' }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <Input label="Email" type="email" icon="📧" value={email} onChange={setEmail} placeholder="votre@email.mg" required />
          <Input label="Mot de passe" type="password" icon="🔒" value={password} onChange={setPassword} placeholder="Votre mot de passe" required />
          {err && <div style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '10px 14px', color: '#fca5a5', fontSize: '0.85rem' }}>{err}</div>}
          <Btn type="submit" disabled={loading}>{loading ? 'Connexion…' : 'Se connecter →'}</Btn>
        </form>
      </Glass>

      <p style={{ textAlign: 'center', color: C.textMuted, fontSize: '0.85rem', marginTop: 20 }}>
        Pas encore de compte ?{' '}
        <button onClick={onInscription} style={{ background: 'none', border: 'none', color: C.emerald, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.85rem' }}>
          S'inscrire gratuitement →
        </button>
      </p>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
//  ONGLET PROJETS
// ══════════════════════════════════════════════════════════════════
function OngletProjets() {
  const [projets, setProjets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState('Tous');

  useEffect(() => {
    citoyenEspaceAPI.projets().then(setProjets).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const STATUTS = ['Tous', 'En cours', 'Planifié', 'Terminé'];
  const STATUT_STYLE = {
    'En cours':  { color: C.emerald, bg: 'rgba(16,185,129,0.15)', dot: C.emerald },
    'Planifié':  { color: C.gold,    bg: 'rgba(245,158,11,0.15)', dot: C.gold },
    'Terminé':   { color: '#94a3b8', bg: 'rgba(148,163,184,0.15)', dot: '#94a3b8' },
  };
  const CAT_ICONS = { 'Infrastructure': '🏗️', 'Santé': '🏥', 'Éducation': '📚', 'Numérique': '💻', 'Eau': '💧', 'default': '📋' };

  const filtered = filter === 'Tous' ? projets : projets.filter(p => p.statut === filter);

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 900, fontSize: '1.6rem', color: C.text, margin: '0 0 8px' }}>
          Projets de la commune
        </h2>
        <p style={{ color: C.textMuted, fontSize: '0.9rem', margin: 0 }}>
          Suivez les travaux et investissements en cours dans votre quartier
        </p>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        {STATUTS.map(s => (
          <button key={s} onClick={() => setFilter(s)} style={{
            padding: '7px 16px', borderRadius: 99, fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer',
            background: filter === s ? `linear-gradient(135deg,${C.emerald},${C.teal})` : C.glass,
            border: `1px solid ${filter === s ? 'transparent' : C.glassBorder}`,
            color: filter === s ? '#fff' : C.textMuted, transition: 'all 0.2s', fontFamily: 'inherit',
          }}>{s}</button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: C.textMuted }}>Chargement…</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: C.textMuted }}>Aucun projet disponible</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
          {filtered.map(p => {
            const ss = STATUT_STYLE[p.statut] || STATUT_STYLE['Planifié'];
            const icon = CAT_ICONS[p.categorie] || CAT_ICONS.default;
            const pct = p.statut === 'Terminé' ? 100 : p.statut === 'En cours' ? 55 : 10;
            return (
              <Glass key={p.id} style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ fontSize: '2rem' }}>{icon}</div>
                  <div style={{ background: ss.bg, border: `1px solid ${ss.dot}55`, color: ss.color, borderRadius: 99, padding: '3px 10px', fontSize: '0.72rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: ss.dot, display: 'inline-block' }} />
                    {p.statut}
                  </div>
                </div>
                <div>
                  <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '1.05rem', color: C.text, lineHeight: 1.3, marginBottom: 8 }}>{p.titre}</div>
                  <div style={{ fontSize: '0.84rem', color: C.textMuted, lineHeight: 1.6 }}>{p.description}</div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <Badge label={p.categorie} color={C.teal} />
                  {p.fokontany && <Badge label={`📍 ${p.fokontany}`} color={C.indigo} />}
                </div>
                {p.budget_ar && (
                  <div style={{ fontSize: '0.82rem', color: C.textMuted }}>
                    Budget : <strong style={{ color: C.gold }}>{(p.budget_ar / 1_000_000).toFixed(1)} M Ar</strong>
                  </div>
                )}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: '0.72rem', color: C.textDim }}>
                    <span>Avancement</span><span>{pct}%</span>
                  </div>
                  <div style={{ height: 5, background: 'rgba(255,255,255,0.08)', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: `linear-gradient(90deg,${C.emerald},${C.teal})`, borderRadius: 99, transition: 'width 1s ease' }} />
                  </div>
                </div>
              </Glass>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
//  MODAL DEMANDE SERVICE — workflow documents
// ══════════════════════════════════════════════════════════════════
function ModalDemande({ service, mesDemandes, onClose, onSuccess }) {
  const [step, setStep] = useState(1); // 1=info, 2=docs, 3=confirmation
  const [attachments, setAttachments] = useState({});
  const [donnees, setDonnees] = useState({});
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const docs = service.documents_requis || [];
  const docsObligatoires = docs.filter(d => d.obligatoire !== false);
  const docsOptionnels   = docs.filter(d => d.obligatoire === false);

  // Vérifier si un doc peut être satisfait par une demande déjà complétée
  const demandeSatisfaisant = (docCode) => {
    if (!mesDemandes) return null;
    return mesDemandes.find(d => 
      d.statut === 'Prête' || d.statut === 'Approuvée'
    );
  };

  const handleFileChange = (docCode, file) => {
    if (!file) return;
    // Simuler upload — en prod, utiliser FormData + endpoint /upload
    const url = URL.createObjectURL(file);
    setAttachments(prev => ({ ...prev, [docCode]: { nom: file.name, url, type: docCode, taille: file.size, obtenu_ici: false } }));
  };

  const handleUseExisting = (docCode, demande) => {
    setAttachments(prev => ({ ...prev, [docCode]: {
      nom: `${demande.service_nom} (${demande.reference})`,
      url: demande.document_final || `demande:${demande.id}`,
      type: docCode, obtenu_ici: true, demande_ref: demande.reference,
    }}));
  };

  const allObligatoiresMet = docsObligatoires.every(d => attachments[d.code]);

  const handleSubmit = async () => {
    setLoading(true); setErr('');
    try {
      const pieces = Object.values(attachments);
      await citoyenEspaceAPI.soumettre({
        service_code: service.code,
        donnees,
        pieces_jointes: pieces,
      });
      onSuccess();
    } catch (e) {
      setErr(e.data?.detail || 'Erreur lors de la soumission');
    } finally { setLoading(false); }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)',
      zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <Glass style={{ width: '100%', maxWidth: 600, maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ padding: '24px 28px', borderBottom: `1px solid ${C.glassBorder}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '1.5rem', marginBottom: 4 }}>{service.icone}</div>
            <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '1.1rem', color: C.text }}>{service.nom}</div>
            <div style={{ fontSize: '0.8rem', color: C.textMuted, marginTop: 2 }}>
              {service.prix_ar === 0 ? 'Gratuit' : `${service.prix_ar.toLocaleString('fr-FR')} Ar`}
              {' · '}Délai : {service.delai_jours} jour(s)
            </div>
          </div>
          <button onClick={onClose} style={{ background: C.glass, border: `1px solid ${C.glassBorder}`, color: C.textMuted, width: 34, height: 34, borderRadius: 10, cursor: 'pointer', fontSize: '1rem' }}>✕</button>
        </div>

        {/* Steps */}
        <div style={{ padding: '16px 28px 0', display: 'flex', gap: 8 }}>
          {['Informations', 'Documents', 'Confirmation'].map((s, i) => (
            <div key={i} style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ height: 3, borderRadius: 99, marginBottom: 6, background: step > i + 1 ? C.emerald : step === i + 1 ? `linear-gradient(90deg,${C.emerald},${C.teal})` : 'rgba(255,255,255,0.1)' }} />
              <div style={{ fontSize: '0.7rem', color: step === i + 1 ? C.text : C.textDim, fontWeight: step === i + 1 ? 700 : 400 }}>{s}</div>
            </div>
          ))}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 28px' }}>

          {/* ÉTAPE 1 — Informations */}
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <p style={{ color: C.textMuted, fontSize: '0.9rem', lineHeight: 1.6, margin: 0 }}>
                {service.description}
              </p>
              <div style={{ background: 'rgba(16,185,129,0.08)', border: `1px solid rgba(16,185,129,0.2)`, borderRadius: 12, padding: '14px 18px' }}>
                <div style={{ fontWeight: 700, color: C.emerald, fontSize: '0.85rem', marginBottom: 8 }}>📋 Documents requis</div>
                {docs.length === 0 ? (
                  <div style={{ color: C.textMuted, fontSize: '0.85rem' }}>Aucun document requis</div>
                ) : docs.map(d => (
                  <div key={d.code} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                    <span style={{ color: d.obligatoire === false ? C.textDim : C.text, fontSize: '0.85rem', flex: 1 }}>
                      {d.obligatoire === false ? '○' : '•'} {d.label}
                      {d.obligatoire === false && <span style={{ color: C.textDim, fontSize: '0.75rem' }}> (optionnel)</span>}
                    </span>
                    {d.obtainable_here && (
                      <span style={{ background: 'rgba(16,185,129,0.15)', border: `1px solid rgba(16,185,129,0.3)`, color: C.emerald, borderRadius: 99, padding: '2px 8px', fontSize: '0.68rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
                        ✓ Disponible ici
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ÉTAPE 2 — Documents */}
          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {docs.map(doc => {
                const attached = attachments[doc.code];
                const existingDemande = doc.obtainable_here ? demandeSatisfaisant(doc.code) : null;
                return (
                  <div key={doc.code} style={{
                    background: attached ? 'rgba(16,185,129,0.06)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${attached ? 'rgba(16,185,129,0.3)' : C.glassBorder}`,
                    borderRadius: 14, padding: '16px 18px',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <div>
                        <div style={{ fontWeight: 700, color: C.text, fontSize: '0.9rem' }}>{doc.label}</div>
                        <div style={{ fontSize: '0.75rem', color: doc.obligatoire === false ? C.textDim : 'rgba(245,158,11,0.9)', marginTop: 2 }}>
                          {doc.obligatoire === false ? 'Optionnel' : '⚠ Obligatoire'}
                        </div>
                      </div>
                      {attached && <span style={{ color: C.emerald, fontSize: '1.2rem' }}>✓</span>}
                    </div>

                    {attached ? (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(16,185,129,0.1)', borderRadius: 8, padding: '8px 12px' }}>
                        <span style={{ fontSize: '0.82rem', color: C.emerald }}>📎 {attached.nom}</span>
                        <button onClick={() => setAttachments(p => { const n = {...p}; delete n[doc.code]; return n; })}
                          style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: '0.8rem' }}>Retirer</button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {existingDemande && (
                          <button onClick={() => handleUseExisting(doc.code, existingDemande)}
                            style={{
                              background: 'rgba(16,185,129,0.15)', border: `1px solid rgba(16,185,129,0.35)`,
                              color: C.emerald, borderRadius: 10, padding: '9px 14px', cursor: 'pointer',
                              fontSize: '0.82rem', fontWeight: 700, fontFamily: 'inherit', textAlign: 'left',
                            }}>
                            ✅ Utiliser ma demande approuvée : {existingDemande.reference}
                          </button>
                        )}
                        {doc.obtainable_here && !existingDemande && (
                          <div style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: 10, padding: '10px 14px', fontSize: '0.8rem', color: '#a5b4fc' }}>
                            💡 Ce document peut être demandé sur cette plateforme. Soumettez d'abord une demande de <strong>{doc.label}</strong>, puis revenez.
                          </div>
                        )}
                        <label style={{ display: 'block', cursor: 'pointer' }}>
                          <div style={{ background: 'rgba(255,255,255,0.05)', border: `1px dashed ${C.glassBorder}`, borderRadius: 10, padding: '12px', textAlign: 'center', fontSize: '0.82rem', color: C.textMuted }}>
                            📁 Glisser ou cliquer pour importer ({doc.obligatoire === false ? 'optionnel' : 'obligatoire'})
                          </div>
                          <input type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display: 'none' }} onChange={e => handleFileChange(doc.code, e.target.files[0])} />
                        </label>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ÉTAPE 3 — Confirmation */}
          {step === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ textAlign: 'center', padding: '10px 0' }}>
                <div style={{ fontSize: '3rem', marginBottom: 10 }}>{service.icone}</div>
                <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '1.2rem', color: C.text }}>{service.nom}</div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { l: 'Montant à payer', v: service.prix_ar === 0 ? 'Gratuit' : `${service.prix_ar.toLocaleString('fr-FR')} Ar` },
                  { l: 'Délai de traitement', v: `${service.delai_jours} jour(s) ouvrable(s)` },
                  { l: 'Documents fournis', v: `${Object.keys(attachments).length} / ${docs.length}` },
                ].map(r => (
                  <div key={r.l} style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: C.textMuted, fontSize: '0.85rem' }}>{r.l}</span>
                    <span style={{ color: C.text, fontWeight: 700, fontSize: '0.85rem' }}>{r.v}</span>
                  </div>
                ))}
              </div>
              {err && <div style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '10px 14px', color: '#fca5a5', fontSize: '0.85rem' }}>{err}</div>}
              <div style={{ background: 'rgba(16,185,129,0.08)', border: `1px solid rgba(16,185,129,0.2)`, borderRadius: 12, padding: '12px 16px', fontSize: '0.82rem', color: C.textMuted }}>
                📱 Après validation, vous serez notifié par SMS lorsque votre document sera prêt.
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div style={{ padding: '16px 28px', borderTop: `1px solid ${C.glassBorder}`, display: 'flex', gap: 10 }}>
          {step > 1 && <Btn variant="ghost" onClick={() => setStep(s => s - 1)} style={{ width: 'auto', padding: '12px 20px' }}>← Retour</Btn>}
          {step < 3 && (
            <Btn onClick={() => setStep(s => s + 1)} disabled={step === 2 && !allObligatoiresMet} style={{ flex: 1 }}>
              {step === 2 && !allObligatoiresMet ? `⚠ Joindre les documents obligatoires` : 'Continuer →'}
            </Btn>
          )}
          {step === 3 && <Btn onClick={handleSubmit} disabled={loading} style={{ flex: 1 }}>{loading ? 'Envoi…' : '✓ Soumettre la demande'}</Btn>}
        </div>
      </Glass>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
//  ONGLET CATALOGUE DES SERVICES
// ══════════════════════════════════════════════════════════════════
function OngletServices({ mesDemandes, onDemandeSuccess }) {
  const [catalogue,  setCatalogue]  = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [filter,     setFilter]     = useState('Tous');
  const [selected,   setSelected]   = useState(null);
  const [success,    setSuccess]    = useState(false);

  useEffect(() => {
    citoyenEspaceAPI.catalogue().then(setCatalogue).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const categories = ['Tous', ...new Set(catalogue.map(s => s.categorie))];
  const filtered = filter === 'Tous' ? catalogue : catalogue.filter(s => s.categorie === filter);

  const CAT_COLORS = { 'État civil': C.teal, 'Certificat': C.emerald, 'Permis': C.gold, 'Taxe': C.purple };

  if (success) return (
    <div style={{ textAlign: 'center', padding: '80px 20px' }}>
      <div style={{ fontSize: '4rem', marginBottom: 20 }}>🎉</div>
      <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 900, fontSize: '1.5rem', color: C.text, marginBottom: 12 }}>
        Demande soumise avec succès !
      </div>
      <p style={{ color: C.textMuted, marginBottom: 32 }}>Vous serez notifié par SMS dès que votre dossier sera traité.</p>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
        <Btn onClick={() => setSuccess(false)} variant="ghost" style={{ width: 'auto', padding: '12px 24px' }}>
          Nouveau document
        </Btn>
        <Btn onClick={() => { setSuccess(false); onDemandeSuccess && onDemandeSuccess(); }} style={{ width: 'auto', padding: '12px 24px' }}>
          Voir mes demandes →
        </Btn>
      </div>
    </div>
  );

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 900, fontSize: '1.6rem', color: C.text, margin: '0 0 8px' }}>
          Demander un document
        </h2>
        <p style={{ color: C.textMuted, fontSize: '0.9rem', margin: 0 }}>
          Sélectionnez un service — le système vous guidera étape par étape
        </p>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        {categories.map(cat => (
          <button key={cat} onClick={() => setFilter(cat)} style={{
            padding: '7px 16px', borderRadius: 99, fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer',
            background: filter === cat ? `linear-gradient(135deg,${C.emerald},${C.teal})` : C.glass,
            border: `1px solid ${filter === cat ? 'transparent' : C.glassBorder}`,
            color: filter === cat ? '#fff' : C.textMuted, transition: 'all 0.2s', fontFamily: 'inherit',
          }}>{cat}</button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: C.textMuted }}>Chargement du catalogue…</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 18 }}>
          {filtered.map(svc => (
            <Glass key={svc.code} style={{ padding: 22, cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 12, transition: 'all 0.25s' }}
              onClick={() => setSelected(svc)}
              onMouseEnter={e => { e.currentTarget.style.borderColor = C.glassBorderHover; e.currentTarget.style.transform = 'translateY(-3px)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = C.glassBorder; e.currentTarget.style.transform = 'translateY(0)'; }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ fontSize: '2rem' }}>{svc.icone}</div>
                <Badge label={svc.categorie} color={CAT_COLORS[svc.categorie] || C.teal} />
              </div>
              <div>
                <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '0.95rem', color: C.text, marginBottom: 6 }}>{svc.nom}</div>
                {svc.nom_mg && <div style={{ fontSize: '0.78rem', color: C.textDim, fontStyle: 'italic' }}>{svc.nom_mg}</div>}
              </div>
              {svc.description && <div style={{ fontSize: '0.8rem', color: C.textMuted, lineHeight: 1.5 }}>{svc.description.slice(0, 90)}{svc.description.length > 90 ? '…' : ''}</div>}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: 8, borderTop: `1px solid rgba(255,255,255,0.06)` }}>
                <span style={{ fontFamily: 'Syne, sans-serif', fontWeight: 900, fontSize: '1.1rem', color: svc.prix_ar === 0 ? C.emerald : C.gold }}>
                  {svc.prix_ar === 0 ? 'Gratuit' : `${svc.prix_ar.toLocaleString('fr-FR')} Ar`}
                </span>
                <span style={{ fontSize: '0.75rem', color: C.textDim }}>⏱ {svc.delai_jours}j</span>
              </div>
              {(svc.documents_requis || []).length > 0 && (
                <div style={{ fontSize: '0.72rem', color: C.textDim }}>
                  📎 {(svc.documents_requis || []).length} document(s) requis
                </div>
              )}
            </Glass>
          ))}
        </div>
      )}

      {selected && (
        <ModalDemande
          service={selected}
          mesDemandes={mesDemandes}
          onClose={() => setSelected(null)}
          onSuccess={() => { setSelected(null); setSuccess(true); onDemandeSuccess && onDemandeSuccess(); }}
        />
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
//  ONGLET MES DEMANDES
// ══════════════════════════════════════════════════════════════════
function OngletMesDemandes({ demandes, loading, onRefresh, error }) {
  const [selected, setSelected] = useState(null);

  if (loading) return <div style={{ textAlign: 'center', padding: 60, color: C.textMuted }}>Chargement des demandes…</div>;
  if (error) return (
    <div style={{ textAlign: 'center', padding: '60px 20px' }}>
      <div style={{ fontSize: '2rem', marginBottom: 16 }}>⚠️</div>
      <div style={{ color: '#fca5a5', fontSize: '0.9rem', marginBottom: 20 }}>{error}</div>
      <Btn onClick={onRefresh} style={{ width: 'auto', margin: '0 auto', padding: '10px 24px' }}>Réessayer</Btn>
    </div>
  );
  if (demandes.length === 0) return (
    <div style={{ textAlign: 'center', padding: '80px 20px' }}>
      <div style={{ fontSize: '3rem', marginBottom: 16 }}>📭</div>
      <div style={{ color: C.textMuted, fontSize: '1rem' }}>Vous n'avez encore aucune demande</div>
    </div>
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 900, fontSize: '1.6rem', color: C.text, margin: 0 }}>Mes demandes</h2>
        <button onClick={onRefresh} style={{ background: C.glass, border: `1px solid ${C.glassBorder}`, color: C.textMuted, padding: '8px 14px', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.82rem' }}>↻ Actualiser</button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {demandes.map(d => (
          <Glass key={d.id} style={{ padding: '18px 22px', cursor: 'pointer' }}
            onClick={() => setSelected(selected?.id === d.id ? null : d)}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <span style={{ fontSize: '1.6rem' }}>{d.service_icone}</span>
                <div>
                  <div style={{ fontWeight: 700, color: C.text, fontSize: '0.95rem' }}>{d.service_nom}</div>
                  <div style={{ fontSize: '0.75rem', color: C.textDim, fontFamily: 'monospace', marginTop: 3 }}>{d.reference}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <StatusBadge statut={d.statut} />
                <span style={{ fontSize: '0.78rem', color: C.textDim }}>
                  {new Date(d.created_at).toLocaleDateString('fr-FR')}
                </span>
              </div>
            </div>
            {selected?.id === d.id && (
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${C.glassBorder}`, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {[
                    { l: 'Montant', v: d.montant_ar === 0 ? 'Gratuit' : `${(d.montant_ar||0).toLocaleString('fr-FR')} Ar` },
                    { l: 'Paiement', v: d.statut_paiement },
                    { l: 'Pièces jointes', v: `${(d.pieces_jointes||[]).length} fichier(s)` },
                    { l: 'Soumise le', v: d.soumise_at ? new Date(d.soumise_at).toLocaleDateString('fr-FR') : 'En cours' },
                  ].map(r => (
                    <div key={r.l} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '10px 12px' }}>
                      <div style={{ fontSize: '0.7rem', color: C.textDim, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{r.l}</div>
                      <div style={{ fontWeight: 700, color: C.text, fontSize: '0.85rem' }}>{r.v}</div>
                    </div>
                  ))}
                </div>
                {d.note_agent && (
                  <div style={{ background: 'rgba(16,185,129,0.08)', border: `1px solid rgba(16,185,129,0.2)`, borderRadius: 10, padding: '12px 14px' }}>
                    <div style={{ fontSize: '0.72rem', color: C.emerald, fontWeight: 700, marginBottom: 6 }}>MESSAGE DE L'AGENT</div>
                    <div style={{ fontSize: '0.85rem', color: C.text }}>{d.note_agent}</div>
                  </div>
                )}
                {d.document_final && (
                  <a href={d.document_final} download style={{ display: 'block' }}>
                    <Btn variant="gold" style={{ gap: 8 }}>⬇ Télécharger mon document</Btn>
                  </a>
                )}
              </div>
            )}
          </Glass>
        ))}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
//  TABLEAU DE BORD CITOYEN (après login)
// ══════════════════════════════════════════════════════════════════
function DashboardCitoyen({ compte, onLogout }) {
  const [onglet, setOnglet] = useState('accueil');
  const [demandes, setDemandes] = useState([]);
  const [loadingDemandes, setLoadingDemandes] = useState(true);
  const [alertes, setAlertes] = useState([]);

  const [demandesError, setDemandesError] = useState('');
  const loadDemandes = useCallback(async () => {
    setLoadingDemandes(true);
    setDemandesError('');
    try {
      const data = await citoyenEspaceAPI.mesDemandes();
      setDemandes(Array.isArray(data) ? data : []);
    } catch (e) {
      setDemandesError(e?.message || 'Erreur de chargement des demandes');
    }
    setLoadingDemandes(false);
  }, []);

  useEffect(() => {
    loadDemandes();
    citoyenEspaceAPI.alertes().then(setAlertes).catch(() => {});
  }, [loadDemandes]);

  const handleOnglet = (id) => { setOnglet(id); if (id === 'suivi') loadDemandes(); };
  const ONGLETS = [
    { id: 'accueil',  icon: '🏘️', label: 'Projets commune' },
    { id: 'services', icon: '📋', label: 'Demander un document' },
    { id: 'suivi',    icon: '📁', label: `Mes demandes${demandes.length > 0 ? ` (${demandes.length})` : ''}` },
  ];

  return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      {/* Topbar */}
      <div style={{ background: 'rgba(10,22,40,0.85)', backdropFilter: 'blur(20px)', borderBottom: `1px solid ${C.glassBorder}`, position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px', display: 'flex', alignItems: 'center', gap: 20, height: 64 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, background: `linear-gradient(135deg,${C.emerald},${C.teal})`, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem' }}>🏛️</div>
            <div>
              <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 900, fontSize: '0.95rem', color: C.text }}>CommuneDigit</div>
              <div style={{ fontSize: '0.65rem', color: C.textDim }}>Espace Citoyen</div>
            </div>
          </div>

          {/* Nav onglets */}
          <div style={{ display: 'flex', gap: 4, flex: 1, justifyContent: 'center', flexWrap: 'wrap' }}>
            {ONGLETS.map(o => (
              <button key={o.id} onClick={() => handleOnglet(o.id)} style={{
                padding: '7px 14px', borderRadius: 10, fontFamily: 'inherit', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer',
                background: onglet === o.id ? `linear-gradient(135deg,${C.emerald},${C.teal})` : 'transparent',
                border: onglet === o.id ? 'none' : '1px solid transparent',
                color: onglet === o.id ? '#fff' : C.textMuted,
                transition: 'all 0.2s',
              }}>{o.icon} {o.label}</button>
            ))}
          </div>

          {/* User */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ textAlign: 'right', display: 'none' }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: C.text }}>{compte.prenom} {compte.nom}</div>
            </div>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: `linear-gradient(135deg,${C.emerald},${C.teal})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.85rem', color: '#fff' }}>
              {(compte.prenom?.[0] || '') + (compte.nom?.[0] || '')}
            </div>
            <button onClick={onLogout} style={{ background: 'none', border: `1px solid ${C.glassBorder}`, color: C.textMuted, padding: '6px 12px', borderRadius: 8, cursor: 'pointer', fontSize: '0.78rem', fontFamily: 'inherit' }}>
              Déconnexion
            </button>
          </div>
        </div>
      </div>

      {/* Alertes banner */}
      {alertes.length > 0 && (
        <div style={{ background: 'rgba(239,68,68,0.12)', borderBottom: '1px solid rgba(239,68,68,0.25)', padding: '10px 24px' }}>
          <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12, fontSize: '0.84rem', color: '#fca5a5' }}>
            <span>📡</span>
            <span><strong>{alertes[0].titre}</strong> — {alertes[0].corps?.slice(0, 100)}</span>
          </div>
        </div>
      )}

      {/* Bienvenue */}
      {onglet === 'accueil' && (
        <div style={{ background: `linear-gradient(135deg, rgba(16,185,129,0.08) 0%, rgba(20,184,166,0.05) 100%)`, borderBottom: `1px solid rgba(16,185,129,0.12)`, padding: '32px 24px' }}>
          <div style={{ maxWidth: 1100, margin: '0 auto' }}>
            <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '1.5rem', fontWeight: 900, color: C.text }}>
              Bienvenue, {compte.prenom || compte.nom} 👋
            </div>
            <div style={{ color: C.textMuted, marginTop: 6, fontSize: '0.9rem' }}>
              Fokontany : <strong style={{ color: C.emerald }}>{compte.fokontany || 'Non renseigné'}</strong>
              {' · '}Demandes en cours : <strong style={{ color: C.gold }}>{demandes.filter(d => ['Soumise','En traitement'].includes(d.statut)).length}</strong>
            </div>
          </div>
        </div>
      )}

      {/* Contenu */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '36px 24px' }}>
        {onglet === 'accueil'  && <OngletProjets />}
        {onglet === 'services' && <OngletServices mesDemandes={demandes} onDemandeSuccess={loadDemandes} />}
        {onglet === 'suivi'    && <OngletMesDemandes demandes={demandes} loading={loadingDemandes} onRefresh={loadDemandes} error={demandesError} />}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
//  COMPOSANT RACINE — CitoyenPortail
// ══════════════════════════════════════════════════════════════════
export default function CitoyenPortail({ onBack }) {
  const [view, setView] = useState(() => {
    const stored = localStorage.getItem('cd_citoyen');
    return stored ? 'dashboard' : 'login';
  });
  const [compte, setCompte] = useState(() => {
    const stored = localStorage.getItem('cd_citoyen');
    try { return stored ? JSON.parse(stored) : null; } catch { return null; }
  });

  useEffect(() => {
    const handle = () => { setCompte(null); setView('login'); };
    window.addEventListener('cd:citoyen_unauthorized', handle);
    return () => window.removeEventListener('cd:citoyen_unauthorized', handle);
  }, []);

  const handleAuth = (compteData) => {
    setCompte(compteData);
    setView('dashboard');
  };

  const handleLogout = () => {
    citoyenAuthAPI.logout();
    setCompte(null);
    setView('login');
  };

  if (view === 'dashboard' && compte) {
    return <DashboardCitoyen compte={compte} onLogout={handleLogout} />;
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: "'Plus Jakarta Sans', sans-serif", display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 0', position: 'relative' }}>
      {/* Orbs */}
      <div style={{ position: 'fixed', width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle, rgba(16,185,129,0.12) 0%, transparent 70%)', top: -200, left: -200, pointerEvents: 'none' }} />
      <div style={{ position: 'fixed', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.10) 0%, transparent 70%)', bottom: -150, right: -150, pointerEvents: 'none' }} />

      {onBack && (
        <button onClick={onBack} style={{ position: 'absolute', top: 24, left: 24, background: 'rgba(255,255,255,0.06)', border: `1px solid ${C.glassBorder}`, color: C.textMuted, padding: '8px 16px', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.82rem', zIndex: 10 }}>
          ← Portail principal
        </button>
      )}

      <div style={{ width: '100%', position: 'relative', zIndex: 1 }}>
        {view === 'login' && <PageLogin onSuccess={handleAuth} onInscription={() => setView('inscription')} />}
        {view === 'inscription' && <PageInscription onSuccess={handleAuth} onLogin={() => setView('login')} />}
      </div>
    </div>
  );
}
