import React, { useState } from 'react';
import { useAuth, useApp } from '../App';

// ── Traductions communes ─────────────────────────────────────────
const LANG = {
  fr: {
    valide: 'Validé', en_cours: 'En cours', en_attente: 'En attente', rejete: 'Rejeté',
    ajouter: 'Ajouter', modifier: 'Modifier', supprimer: 'Supprimer', fermer: 'Fermer',
    enregistrer: 'Enregistrer', annuler: 'Annuler', confirmer: 'Confirmer',
    rechercher: 'Rechercher', filtrer: 'Filtrer', exporter: 'Exporter',
    voir_tout: 'Voir tout', details: 'Détails', retour: '← Retour',
    chargement: 'Chargement…', aucun_resultat: 'Aucun résultat',
    nom: 'Nom', prenom: 'Prénom', date: 'Date', statut: 'Statut', actions: 'Actions',
    oui: 'Oui', non: 'Non', ref: 'Réf.', type: 'Type',
    tout: 'Tout', id: 'ID', icon: 'Icône', label: 'Libellé', categorie: 'Catégorie', citoyen: 'Citoyen',
  },
  mg: {
    valide: 'Voamarina', en_cours: 'Andalam-panatanterahana', en_attente: 'Miandry', rejete: 'Nolaniina',
    ajouter: 'Hanampy', modifier: 'Hanova', supprimer: 'Hamafa', fermer: 'Hanidy',
    enregistrer: 'Hitahiry', annuler: 'Hahafaka', confirmer: 'Hanamarina',
    rechercher: 'Hikaroka', filtrer: 'Hamboatra', exporter: 'Hamoaka',
    voir_tout: 'Jereo rehetra', details: 'Antsipirihana', retour: '← Hiverina',
    chargement: 'Mampiditra…', aucun_resultat: 'Tsy misy vokatra',
    nom: 'Anarana', prenom: 'Fanampiny', date: 'Daty', statut: 'Toe-javatra', actions: 'Hetsika',
    oui: 'Eny', non: 'Tsia', ref: 'Ref.', type: 'Karazana',
    tout: 'Rehetra', id: 'ID', icon: 'Sary', label: 'Anarana', categorie: 'Sokajy', citoyen: 'Olom-pirenena',
  },
};


export default function Parametres() {
  const { lang } = useApp();
  const t = LANG[lang] || LANG.fr;
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('compte');
  const [saved, setSaved] = useState('');

  const save = (section) => {
    setSaved(section);
    setTimeout(() => setSaved(''), 2000);
  };

  const sections = {
    compte: (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '20px', background: 'var(--glass-bg)', borderRadius: 16, marginBottom: 4 }}>
          <div className="avatar avatar-lg" style={{ background: 'linear-gradient(135deg,#10b981,#14b8a6)' }}>{user?.avatar || '?'}</div>
          <div>
            <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '1.1rem' }}>{user?.name}</div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.83rem' }}>{user?.role}</div>
          </div>
          <button className="btn btn-glass btn-sm" style={{ marginLeft: 'auto' }}>Changer photo</button>
        </div>
        <div className="form-grid">
          <div className="form-group">
            <label className="form-label">Prénom</label>
            <input className="form-input" defaultValue={user?.name?.split(' ')[0]} />
          </div>
          <div className="form-group">
            <label className="form-label">Nom</label>
            <input className="form-input" defaultValue={user?.name?.split(' ')[1]} />
          </div>
          <div className="form-group">
            <label className="form-label">Matricule agent</label>
            <input className="form-input" defaultValue="AGT-0042" />
          </div>
          <div className="form-group">
            <label className="form-label">Téléphone</label>
            <input className="form-input" defaultValue="034 12 345 67" />
          </div>
          <div className="form-group" style={{ gridColumn: '1/-1' }}>
            <label className="form-label">Fokontany d'affectation</label>
            <input className="form-input" defaultValue="Sabotsy Namehana" />
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn btn-primary" onClick={() => save('compte')}>
            {saved === 'compte' ? '✅ Sauvegardé !' : 'Sauvegarder les modifications'}
          </button>
        </div>
      </div>
    ),
    securite: (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div className="alert alert-info">
          <span>🔐</span>
          <div style={{ fontSize: '0.875rem', lineHeight: 1.5 }}>Les mots de passe sont chiffrés avec bcrypt. La session expire après 8h d'inactivité (JWT).</div>
        </div>
        <div className="form-group">
          <label className="form-label">Mot de passe actuel</label>
          <input className="form-input" type="password" placeholder="••••••••" />
        </div>
        <div className="form-grid">
          <div className="form-group">
            <label className="form-label">Nouveau mot de passe</label>
            <input className="form-input" type="password" placeholder="••••••••" />
          </div>
          <div className="form-group">
            <label className="form-label">Confirmer</label>
            <input className="form-input" type="password" placeholder="••••••••" />
          </div>
        </div>
        <div className="divider" />
        <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, marginBottom: 12 }}>Sessions actives</div>
        {[
          { app: 'Portail Web Chrome', ip: '192.168.1.42', time: 'Maintenant', current: true },
          { app: 'App Mobile Android', ip: '10.0.0.15', time: 'il y a 2h', current: false },
        ].map((s, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'var(--glass-bg)', borderRadius: 10 }}>
            <div>
              <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>{s.app}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{s.ip} · {s.time}</div>
            </div>
            {s.current ? <span className="badge badge-green">Session actuelle</span> : <button className="btn btn-danger btn-sm">Révoquer</button>}
          </div>
        ))}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn btn-primary" onClick={() => save('securite')}>
            {saved === 'securite' ? '✅ Sauvegardé !' : 'Changer le mot de passe'}
          </button>
        </div>
      </div>
    ),
    systeme: (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, marginBottom: 4 }}>Préférences affichage</div>
        {[
          { l: 'Langue interface', options: ['Français', 'Malagasy'] },
          { l: 'Mode hors-ligne automatique', options: ['Activé', 'Désactivé'] },
          { l: 'Fréquence synchronisation', options: ['Temps réel', '5 min', '15 min', '30 min'] },
          { l: 'Notifications push', options: ['Toutes', 'Importantes seulement', 'Désactivées'] },
        ].map(s => (
          <div key={s.l} className="form-group">
            <label className="form-label">{s.l}</label>
            <select className="form-select">
              {s.options.map(o => <option key={o}>{o}</option>)}
            </select>
          </div>
        ))}
        <div className="divider" />
        <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, marginBottom: 4 }}>Informations système</div>
        <div className="glass-table-wrap">
          <table className="glass-table">
            <tbody>
              {[
                ['Version', 'CommuneDigit v1.0.2'],
                ['Backend', 'FastAPI + PostgreSQL 15'],
                ['Offline', 'WatermelonDB · LWW sync'],
                ['Sécurité', 'JWT + AES-256 + SHA-256'],
                ['Conformité', 'Loi 2014-038 · Convention Malabo'],
              ].map(([k, v]) => (
                <tr key={k}>
                  <td style={{ color: 'var(--text-muted)', width: '40%', fontSize: '0.83rem' }}>{k}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: '0.83rem', color: 'var(--emerald-400)' }}>{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn btn-primary" onClick={() => save('systeme')}>
            {saved === 'systeme' ? '✅ Sauvegardé !' : 'Appliquer les paramètres'}
          </button>
        </div>
      </div>
    ),
  };

  return (
    <>
      <div className="page-header">
        <div className="breadcrumb">⚙️ <span>/</span> {lang === 'mg' ? 'Fanamboarana' : 'Paramètres'}</div>
        <h1 className="page-title">{lang === 'mg' ? 'Fanamboarana' : 'Paramètres'}</h1>
        <p className="page-subtitle">Gestion du compte, sécurité et configuration système</p>
      </div>

      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
        {/* Sidebar tabs */}
        <div className="glass-card" style={{ padding: 8, width: 200, flexShrink: 0 }}>
          {[
            { id: 'compte', icon: '👤', label: 'Mon compte' },
            { id: 'securite', icon: '🔐', label: 'Sécurité' },
            { id: 'systeme', icon: '⚙️', label: 'Système' },
          ].map(t => (
            <button
              key={t.id}
              className={`nav-item ${activeTab === t.id ? 'active' : ''}`}
              onClick={() => setActiveTab(t.id)}
              style={{ width: '100%' }}
            >
              <span className="nav-icon">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="glass-card" style={{ flex: 1, padding: 28 }}>
          <div className="slide-up">
            {sections[activeTab]}
          </div>
        </div>
      </div>
    </>
  );
}
