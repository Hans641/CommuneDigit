import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../App';
import { certificatsAPI, citoyensAPI } from '../services/api';

const LANG = {
  fr: { fermer: 'Fermer', annuler: 'Annuler', chargement: 'Chargement…', aucun_resultat: 'Aucun résultat' },
  mg: { fermer: 'Hanidy', annuler: 'Hahafaka', chargement: 'Mampiditra…', aucun_resultat: 'Tsy misy vokatra' },
};

const TYPES_CERT = [
  { type: 'Résidence', icon: '🏠', prix: 2000 },
  { type: 'Héritage',  icon: '⚖️', prix: 5000 },
  { type: 'Permis',    icon: '🔧', prix: 10000 },
  { type: 'Autre',     icon: '📄', prix: 0 },
];

function StatutBadge({ s }) {
  const m = { 'Délivré': 'badge-green', 'En cours': 'badge-orange', 'En attente': 'badge-gold', 'Annulé': 'badge-red' };
  return <span className={`badge ${m[s] || 'badge-gray'}`}>{s}</span>;
}

export default function Certificats() {
  const { lang } = useApp();
  const t = LANG[lang] || LANG.fr;

  const [certs,      setCerts]      = useState([]);
  const [citoyens,   setCitoyens]   = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [filterType, setFilterType] = useState('Tous');
  const [filterStat, setFilterStat] = useState('Tous');
  const [showModal,  setShowModal]  = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [saved,      setSaved]      = useState(false);
  const [form, setForm] = useState({ type_cert: 'Résidence', citoyen_id: '', motif: '', prix: 2000 });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filterType !== 'Tous') params.type_cert = filterType;
      if (filterStat !== 'Tous') params.statut    = filterStat;
      setCerts(await certificatsAPI.list(params));
    } catch {}
    setLoading(false);
  }, [filterType, filterStat]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { citoyensAPI.list({ limit: 200 }).then(setCitoyens).catch(() => {}); }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await certificatsAPI.create({ ...form, citoyen_id: parseInt(form.citoyen_id) });
      setSaved(true); load();
      setTimeout(() => {
        setSaved(false); setShowModal(false);
        setForm({ type_cert: 'Résidence', citoyen_id: '', motif: '', prix: 2000 });
      }, 1800);
    } catch (err) { alert(err?.response?.data?.detail || 'Erreur.'); }
    setSaving(false);
  };

  const handleDelivrer = async (id) => {
    try { await certificatsAPI.delivrer(id); load(); } catch {}
  };

  // Stats par type pour les cartes
  const countByType = {};
  TYPES_CERT.forEach(tc => { countByType[tc.type] = certs.filter(c => c.type_cert === tc.type && c.statut !== 'Délivré').length; });

  const filtered = certs.filter(c =>
    (filterType === 'Tous' || c.type_cert === filterType) &&
    (filterStat === 'Tous' || c.statut === filterStat)
  );

  return (
    <>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div className="breadcrumb">📜 <span>/</span> {lang === 'mg' ? 'Taratasy ofisialy' : 'Certificats'}</div>
          <h1 className="page-title">{lang === 'mg' ? 'Taratasy ofisialy' : 'Certificats'} & Autorisations</h1>
          <p className="page-subtitle">Délivrance de certificats de résidence, héritage et permis divers</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          + {lang === 'mg' ? 'Taratasy vaovao' : 'Nouveau certificat'}
        </button>
      </div>

      {/* Cartes types */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginBottom: 24 }}>
        {TYPES_CERT.map(tc => (
          <div key={tc.type} className={`glass-card ${filterType === tc.type ? 'active-card' : ''}`}
            style={{ padding: 20, textAlign: 'center', cursor: 'pointer', transition: 'transform 0.2s', border: filterType === tc.type ? '1px solid var(--emerald-500)' : undefined }}
            onClick={() => setFilterType(filterType === tc.type ? 'Tous' : tc.type)}
            onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-3px)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
            <div style={{ fontSize: '1.8rem', marginBottom: 8 }}>{tc.icon}</div>
            <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{tc.type}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--emerald-400)', margin: '4px 0' }}>
              {tc.prix === 0 ? 'Gratuit' : `${tc.prix.toLocaleString('fr-FR')} Ar`}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              {loading ? '…' : countByType[tc.type]} en cours
            </div>
          </div>
        ))}
      </div>

      {/* Filtres statut */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
        {['Tous', 'En attente', 'En cours', 'Délivré', 'Annulé'].map(s => (
          <button key={s} className={`chip chip-sm ${filterStat === s ? 'active' : ''}`}
            onClick={() => setFilterStat(s)}>{s}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="glass-card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--glass-border)', display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '1rem', marginRight: 'auto' }}>
            Registre — <span style={{ color: 'var(--emerald-400)', fontFamily: 'monospace' }}>{filtered.length}</span> certificat(s)
          </div>
        </div>
        <div className="glass-table-wrap">
          <table className="glass-table">
            <thead>
              <tr>
                <th>Réf.</th>
                <th>Type</th>
                <th>Citoyen</th>
                <th>Motif</th>
                <th>Tarif</th>
                <th>Date</th>
                <th>Statut</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>{t.chargement}</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>{t.aucun_resultat}</td></tr>
              ) : filtered.map(c => (
                <tr key={c.id}>
                  <td style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{c.reference || `CRT-${String(c.id).padStart(3,'0')}`}</td>
                  <td><span className="badge badge-blue">{c.type_cert}</span></td>
                  <td style={{ fontWeight: 600 }}>
                    {c.citoyen ? `${c.citoyen.nom} ${c.citoyen.prenom}` : `Citoyen #${c.citoyen_id}`}
                  </td>
                  <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.motif || '—'}
                  </td>
                  <td style={{ fontFamily: 'monospace', fontWeight: 700, color: c.prix === 0 ? 'var(--teal-400)' : 'var(--emerald-400)' }}>
                    {c.prix === 0 ? 'Gratuit' : `${(c.prix || 0).toLocaleString('fr-FR')} Ar`}
                  </td>
                  <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {c.created_at ? new Date(c.created_at).toLocaleDateString('fr-FR') : '—'}
                  </td>
                  <td><StatutBadge s={c.statut} /></td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {c.statut !== 'Délivré' && c.statut !== 'Annulé' && (
                        <button className="btn btn-primary btn-sm" onClick={() => handleDelivrer(c.id)}>✓ Délivrer</button>
                      )}
                      {c.statut === 'Délivré' && (
                        <button className="btn btn-glass btn-sm">🖨 Imprimer</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ padding: '14px 24px', borderTop: '1px solid var(--glass-border)', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          {certs.filter(c => c.statut === 'Délivré').length} {lang==='mg'?'natolotra':'délivré(s)'} · {certs.filter(c => c.statut === 'En attente').length} {lang==='mg'?'miandry':'en attente'}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">📜 Nouveau certificat</div>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            {saved ? (
              <div className="alert alert-success" style={{ textAlign: 'center', flexDirection: 'column', padding: 32 }}>
                <div style={{ fontSize: '2rem', marginBottom: 10 }}>✅</div>
                <div style={{ fontWeight: 700 }}>Certificat créé avec succès</div>
              </div>
            ) : (
              <form onSubmit={handleSave}>
                <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
                  {TYPES_CERT.map(tc => (
                    <button type="button" key={tc.type}
                      className={`chip ${form.type_cert === tc.type ? 'active' : ''}`}
                      onClick={() => setForm(f => ({ ...f, type_cert: tc.type, prix: tc.prix }))}>
                      {tc.icon} {tc.type}
                    </button>
                  ))}
                </div>
                <div className="form-grid" style={{ marginBottom: 16 }}>
                  <div className="form-group" style={{ gridColumn: '1/-1' }}>
                    <label className="form-label">Citoyen *</label>
                    <select className="form-input" value={form.citoyen_id}
                      onChange={e => setForm({...form, citoyen_id: e.target.value})} required>
                      <option value="">Sélectionner un citoyen…</option>
                      {citoyens.map(c => (
                        <option key={c.id} value={c.id}>{c.nom} {c.prenom} — CIN: {c.cin || 'non renseigné'}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Tarif (Ar)</label>
                    <input className="form-input" type="number" value={form.prix}
                      onChange={e => setForm({...form, prix: parseInt(e.target.value)})} min="0" />
                  </div>
                  <div className="form-group" style={{ gridColumn: '1/-1' }}>
                    <label className="form-label">Motif / Objet *</label>
                    <textarea className="form-textarea" value={form.motif}
                      onChange={e => setForm({...form, motif: e.target.value})} required
                      placeholder="Objet de la demande de certificat…" />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <button type="button" className="btn btn-glass" onClick={() => setShowModal(false)}>{t.annuler}</button>
                  <button type="submit" className="btn btn-primary" disabled={saving}>
                    {saving ? t.chargement : 'Créer le certificat →'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
