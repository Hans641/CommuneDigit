import React, { useState } from 'react';
import { useApp } from '../App';

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
  },
};


const ACTES = [
  { id: 'EC-0091', type: 'Naissance', nom: 'Rakoto Mialy', date: '2026-05-01', statut: 'Validé',     hash: 'a3f9e...', agent: 'Agent Nivo' },
  { id: 'EC-0090', type: 'Mariage',   nom: 'Rasoa & Bodo', date: '2026-04-28', statut: 'Validé',     hash: 'b1c2d...', agent: 'Agent Bodo' },
  { id: 'EC-0089', type: 'Décès',     nom: 'Rabe Germain', date: '2026-04-25', statut: 'En attente', hash: 'pending', agent: '—' },
  { id: 'EC-0088', type: 'Naissance', nom: 'Andriana Lova', date: '2026-04-22', statut: 'Validé',    hash: 'c4e5f...', agent: 'Agent Nivo' },
  { id: 'EC-0087', type: 'Naissance', nom: 'Ravelo Zo',    date: '2026-04-20', statut: 'En cours',   hash: 'pending', agent: 'Agent Bodo' },
];

function TypeBadge({ t }) {
  const m = { Naissance: 'badge-green', Mariage: 'badge-blue', Décès: 'badge-gray' };
  return <span className={`badge ${m[t] || 'badge-gray'}`}>{t === 'Naissance' ? '👶' : t === 'Mariage' ? '💍' : '🕊️'} {t}</span>;
}
function StatusBadge({ s }) {
  const m = { Validé: 'badge-green', 'En attente': 'badge-gold', 'En cours': 'badge-orange' };
  return <span className={`badge ${m[s] || 'badge-gray'}`}>{s}</span>;
}

const TYPES = ['Naissance', 'Mariage', 'Décès'];

export default function EtatCivil() {
  const { lang } = useApp();
  const t = LANG[lang] || LANG.fr;
  const [activeType, setActiveType] = useState('Naissance');
  const [showModal, setShowModal] = useState(false);
  const [filterStatut, setFilterStatut] = useState('Tous');
  const [form, setForm] = useState({ nom: '', prenom: '', date_evenement: '', lieu: '', fokontany: '', pere: '', mere: '', notes: '' });
  const [saved, setSaved] = useState(false);

  const filtered = ACTES.filter(a =>
    (filterStatut === 'Tous' || a.statut === filterStatut) &&
    a.type === activeType
  );

  const handleSave = (e) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => { setSaved(false); setShowModal(false); }, 1800);
  };

  return (
    <>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div className="breadcrumb">📋 <span>/</span> {lang === 'mg' ? 'Toe-piainana' : 'État Civil'}</div>
          <h1 className="page-title">Registre d'{lang === 'mg' ? 'Toe-piainana' : 'État Civil'}</h1>
          <p className="page-subtitle">Enregistrement des naissances, mariages et décès — avec hachage SHA-256</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ {lang === 'mg' ? 'Taratasy vaovao' : 'Nouvel acte'}</button>
      </div>

      {/* Tabs type */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="tabs">
          {TYPES.map(t => (
            <button key={t} className={`tab-btn ${activeType === t ? 'active' : ''}`} onClick={() => setActiveType(t)}>
              {t === 'Naissance' ? '👶' : t === 'Mariage' ? '💍' : '🕊️'} {t}
            </button>
          ))}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          {['Tous', 'Validé', 'En cours', 'En attente'].map(s => (
            <button key={s} className={`chip ${filterStatut === s ? 'active' : ''}`} onClick={() => setFilterStatut(s)}>{s}</button>
          ))}
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>
        {[
          { l: 'Total', v: ACTES.filter(a => a.type === activeType).length, color: 'var(--text-primary)' },
          { l: 'Validés', v: ACTES.filter(a => a.type === activeType && a.statut === 'Validé').length, color: 'var(--emerald-400)' },
          { l: 'En cours', v: ACTES.filter(a => a.type === activeType && a.statut === 'En cours').length, color: 'var(--gold-400)' },
          { l: 'En attente', v: ACTES.filter(a => a.type === activeType && a.statut === 'En attente').length, color: '#f87171' },
        ].map(s => (
          <div key={s.l} className="glass-card" style={{ padding: '16px 20px' }}>
            <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '1.6rem', fontWeight: 800, color: s.color }}>{s.v}</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 3 }}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '1rem' }}>Registre — {activeType}s</div>
          <button className="btn btn-glass btn-sm">⬇ Exporter CSV</button>
        </div>
        <div className="glass-table-wrap">
          <table className="glass-table">
            <thead>
              <tr>
                <th>Réf.</th>
                <th>Concerné(s)</th>
                <th>Date événement</th>
                <th>Statut</th>
                <th>Hash SHA-256</th>
                <th>Agent</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {(filtered.length ? filtered : ACTES.filter(a => a.type === activeType)).map(a => (
                <tr key={a.id}>
                  <td style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: 'var(--text-muted)' }}>{a.id}</td>
                  <td style={{ fontWeight: 600 }}>{a.nom}</td>
                  <td style={{ fontSize: '0.83rem', color: 'var(--text-secondary)' }}>{a.date}</td>
                  <td><StatusBadge s={a.statut} /></td>
                  <td>
                    <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: a.hash === 'pending' ? 'var(--text-disabled)' : 'var(--emerald-400)' }}>
                      {a.hash === 'pending' ? '⏳ En attente' : `✓ ${a.hash}`}
                    </span>
                  </td>
                  <td style={{ fontSize: '0.83rem', color: 'var(--text-secondary)' }}>{a.agent}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-glass btn-sm">👁 Voir</button>
                      {a.statut === 'En attente' && <button className="btn btn-primary btn-sm">✓ Valider</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── MODAL ── */}
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal" style={{ maxWidth: 620 }}>
            <div className="modal-header">
              <div>
                <div className="modal-title">📋 {lang === 'mg' ? 'Taratasy vaovao' : 'Nouvel acte'} — {activeType}</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4 }}>Les données seront hachées SHA-256 avant enregistrement</div>
              </div>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>

            {saved ? (
              <div className="alert alert-success" style={{ textAlign: 'center', flexDirection: 'column', padding: 32 }}>
                <div style={{ fontSize: '2rem', marginBottom: 10 }}>✅</div>
                <div style={{ fontWeight: 700 }}>Acte enregistré avec succès</div>
                <div style={{ fontSize: '0.8rem', opacity: 0.7, marginTop: 4 }}>Synchronisation en cours…</div>
              </div>
            ) : (
              <form onSubmit={handleSave}>
                <div className="form-grid" style={{ marginBottom: 16 }}>
                  <div className="form-group">
                    <label className="form-label">Nom *</label>
                    <input className="form-input" value={form.nom} onChange={e => setForm({...form, nom: e.target.value})} placeholder="Nom de famille" required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Prénom(s) *</label>
                    <input className="form-input" value={form.prenom} onChange={e => setForm({...form, prenom: e.target.value})} placeholder="Prénom(s)" required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Date de l'événement *</label>
                    <input className="form-input" type="date" value={form.date_evenement} onChange={e => setForm({...form, date_evenement: e.target.value})} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Lieu</label>
                    <input className="form-input" value={form.lieu} onChange={e => setForm({...form, lieu: e.target.value})} placeholder="Lieu de l'événement" />
                  </div>
                  {activeType === 'Naissance' && <>
                    <div className="form-group">
                      <label className="form-label">Père</label>
                      <input className="form-input" value={form.pere} onChange={e => setForm({...form, pere: e.target.value})} placeholder="Nom du père" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Mère</label>
                      <input className="form-input" value={form.mere} onChange={e => setForm({...form, mere: e.target.value})} placeholder="Nom de la mère" />
                    </div>
                  </>}
                  <div className="form-group" style={{ gridColumn: '1/-1' }}>
                    <label className="form-label">Fokontany</label>
                    <input className="form-input" value={form.fokontany} onChange={e => setForm({...form, fokontany: e.target.value})} placeholder="Fokontany concerné" />
                  </div>
                </div>
                <div className="form-group" style={{ marginBottom: 24 }}>
                  <label className="form-label">Notes</label>
                  <textarea className="form-textarea" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} placeholder="Observations supplémentaires..." />
                </div>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <button type="button" className="btn btn-glass" onClick={() => setShowModal(false)}>{t.annuler}</button>
                  <button type="submit" className="btn btn-primary">Enregistrer l'acte →</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
