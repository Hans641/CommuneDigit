import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../App';
import api from '../services/api';

const STATUTS = ['Tous', 'Soumise', 'En traitement', 'Approuvée', 'Prête', 'Rejetée'];
const STATUT_BADGE = {
  'Soumise':       'badge-blue',
  'En traitement': 'badge-gold',
  'Approuvée':     'badge-green',
  'Prête':         'badge-green',
  'Rejetée':       'badge-red',
};

const LANG = {
  fr: { chargement: 'Chargement…', aucun: 'Aucune demande', fermer: 'Fermer', annuler: 'Annuler', valider: 'Valider', rejeter: 'Rejeter' },
  mg: { chargement: 'Mampiditra…', aucun: 'Tsy misy fangatahana', fermer: 'Hanidy', annuler: 'Hahafaka', valider: 'Hanamarina', rejeter: 'Handà' },
};

export default function DemandesCitoyens() {
  const { lang } = useApp();
  const t = LANG[lang] || LANG.fr;

  const [demandes,  setDemandes]  = useState([]);
  const [stats,     setStats]     = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [filter,    setFilter]    = useState('Tous');
  const [selected,  setSelected]  = useState(null);
  const [saving,    setSaving]    = useState(false);
  const [note,      setNote]      = useState('');
  const [docFinal,  setDocFinal]  = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filter !== 'Tous') params.statut = filter;
      const [d, s] = await Promise.all([
        api.get('/demandes-citoyens', { params }).then(r => r.data),
        api.get('/demandes-citoyens/stats').then(r => r.data),
      ]);
      setDemandes(d);
      setStats(s);
    } catch {}
    setLoading(false);
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const handleTraiter = async (statut) => {
    if (!selected) return;
    setSaving(true);
    try {
      await api.patch(`/demandes-citoyens/${selected.id}`, {
        statut,
        note_agent: note || undefined,
        document_final: docFinal || undefined,
      });
      setSelected(null); setNote(''); setDocFinal('');
      load();
    } catch {}
    setSaving(false);
  };

  const STATS_DISPLAY = stats ? [
    { l: lang === 'mg' ? 'Fangatahana tonga' : 'Soumises',       v: stats.soumises,      icon: '📥', color: 'var(--teal-400)' },
    { l: lang === 'mg' ? 'Am-panadihiana' : 'En traitement',     v: stats.en_traitement, icon: '⚙️', color: 'var(--gold-400)' },
    { l: lang === 'mg' ? 'Vonona hatolotra' : 'Prêtes',          v: stats.pretes,        icon: '✅', color: 'var(--emerald-400)' },
    { l: lang === 'mg' ? 'Fangatahana rehetra' : 'Total',        v: stats.total,         icon: '📊', color: 'var(--text-primary)' },
  ] : [];

  return (
    <>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div className="breadcrumb">📥 <span>/</span> {lang === 'mg' ? 'Fangatahana Olom-pirenena' : 'Demandes Citoyens'}</div>
          <h1 className="page-title">{lang === 'mg' ? 'Fangatahana Olom-pirenena' : 'Demandes Citoyens'}</h1>
          <p className="page-subtitle">
            {lang === 'mg'
              ? 'Karakarao ny fangatahana avy amin\'ny olom-pirenena voasoratra'
              : 'Traitement des demandes soumises par les citoyens inscrits'}
          </p>
        </div>
        <button className="btn btn-glass btn-sm" onClick={load}>↻ {lang === 'mg' ? 'Manavao' : 'Actualiser'}</button>
      </div>

      {/* Stats */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 14, marginBottom: 24 }}>
          {STATS_DISPLAY.map(s => (
            <div key={s.l} className="glass-card" style={{ padding: '18px 20px' }}>
              <div style={{ fontSize: '1.3rem', marginBottom: 6 }}>{s.icon}</div>
              <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '1.6rem', fontWeight: 800, color: s.color }}>{s.v}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>{s.l}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filtres statut */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
        {STATUTS.map(s => (
          <button key={s} className={`chip ${filter === s ? 'active' : ''}`} onClick={() => setFilter(s)}>{s}</button>
        ))}
      </div>

      {/* Table */}
      <div className="glass-card" style={{ overflow: 'hidden' }}>
        <div className="glass-table-wrap">
          <table className="glass-table">
            <thead>
              <tr>
                <th>Référence</th>
                <th>Service</th>
                <th>Citoyen</th>
                <th>Pièces jointes</th>
                <th>Montant</th>
                <th>Paiement</th>
                <th>Statut</th>
                <th>Soumise le</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>{t.chargement}</td></tr>
              ) : demandes.length === 0 ? (
                <tr><td colSpan={9} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>{t.aucun}</td></tr>
              ) : demandes.map(d => (
                <tr key={d.id}>
                  <td style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{d.reference}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: '1.2rem' }}>{d.service_icone}</span>
                      <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{d.service_nom}</span>
                    </div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{d.citoyen_nom}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{d.citoyen_tel}</div>
                  </td>
                  <td>
                    {(d.pieces_jointes || []).length === 0 ? (
                      <span style={{ color: 'var(--text-disabled)', fontSize: '0.78rem' }}>Aucune</span>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        {(d.pieces_jointes || []).slice(0, 2).map((pj, i) => (
                          <div key={i} style={{ fontSize: '0.72rem', color: pj.obtenu_ici ? 'var(--emerald-400)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                            {pj.obtenu_ici ? '✓ ' : '📎 '}{pj.nom?.slice(0, 25)}{pj.nom?.length > 25 ? '…' : ''}
                          </div>
                        ))}
                        {(d.pieces_jointes || []).length > 2 && (
                          <div style={{ fontSize: '0.68rem', color: 'var(--text-disabled)' }}>+{d.pieces_jointes.length - 2} autre(s)</div>
                        )}
                      </div>
                    )}
                  </td>
                  <td style={{ fontFamily: 'monospace', fontWeight: 700, color: d.montant_ar === 0 ? 'var(--emerald-400)' : 'var(--teal-400)' }}>
                    {d.montant_ar === 0 ? 'Gratuit' : `${(d.montant_ar||0).toLocaleString('fr-FR')} Ar`}
                  </td>
                  <td>
                    <span className={`badge ${d.statut_paiement === 'Payé' ? 'badge-green' : 'badge-gold'}`}>{d.statut_paiement}</span>
                  </td>
                  <td>
                    <span className={`badge ${STATUT_BADGE[d.statut] || 'badge-gray'}`}>{d.statut}</span>
                  </td>
                  <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    {d.soumise_at ? new Date(d.soumise_at).toLocaleDateString('fr-FR') : '—'}
                  </td>
                  <td>
                    <button className="btn btn-primary btn-sm" onClick={() => { setSelected(d); setNote(d.note_agent || ''); setDocFinal(d.document_final || ''); }}>
                      ✏ Traiter
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ padding: '12px 24px', borderTop: '1px solid var(--glass-border)', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          {demandes.length} demande(s)
        </div>
      </div>

      {/* Modal traitement */}
      {selected && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setSelected(null)}>
          <div className="modal" style={{ maxWidth: 560 }}>
            <div className="modal-header">
              <div>
                <div className="modal-title">
                  {selected.service_icone} Traiter la demande
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: 4 }}>{selected.reference}</div>
              </div>
              <button className="modal-close" onClick={() => setSelected(null)}>✕</button>
            </div>

            {/* Infos */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
              {[
                { l: 'Service',  v: selected.service_nom },
                { l: 'Citoyen', v: selected.citoyen_nom },
                { l: 'Montant', v: selected.montant_ar === 0 ? 'Gratuit' : `${(selected.montant_ar||0).toLocaleString('fr-FR')} Ar` },
                { l: 'Paiement', v: selected.statut_paiement },
              ].map(f => (
                <div key={f.l} className="glass-card" style={{ padding: '12px 14px' }}>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{f.l}</div>
                  <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)' }}>{f.v}</div>
                </div>
              ))}
            </div>

            {/* Pièces jointes */}
            {(selected.pieces_jointes || []).length > 0 && (
              <div className="glass-card" style={{ padding: '14px 16px', marginBottom: 16 }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
                  📎 Pièces jointes ({selected.pieces_jointes.length})
                </div>
                {selected.pieces_jointes.map((pj, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderTop: i > 0 ? '1px solid var(--glass-border)' : 'none' }}>
                    <span style={{ fontSize: '0.82rem', color: pj.obtenu_ici ? 'var(--emerald-400)' : 'var(--text-secondary)' }}>
                      {pj.obtenu_ici ? '✓ ' : '📄 '}{pj.nom}
                      {pj.obtenu_ici && <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}> (obtenu via portail)</span>}
                    </span>
                    {pj.url && !pj.url.startsWith('demande:') && (
                      <a href={pj.url} target="_blank" rel="noopener noreferrer" className="btn btn-glass btn-sm" style={{ fontSize: '0.72rem', padding: '3px 10px' }}>Voir</a>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Note & doc */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 20 }}>
              <div className="form-group">
                <label className="form-label">Message au citoyen</label>
                <textarea className="form-textarea" value={note} onChange={e => setNote(e.target.value)}
                  placeholder="Note optionnelle envoyée au citoyen…" style={{ minHeight: 80 }} />
              </div>
              <div className="form-group">
                <label className="form-label">URL du document final (si prêt)</label>
                <input className="form-input" value={docFinal} onChange={e => setDocFinal(e.target.value)}
                  placeholder="https://… ou laisser vide" />
              </div>
            </div>

            {/* Boutons */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn btn-glass" onClick={() => setSelected(null)} style={{ flex: '0 0 auto' }}>{t.annuler}</button>
              <button className="btn btn-glass" disabled={saving} onClick={() => handleTraiter('En traitement')} style={{ flex: 1, background: 'rgba(245,158,11,0.15)', borderColor: 'rgba(245,158,11,0.3)', color: '#fbbf24' }}>
                ⚙ Prendre en charge
              </button>
              <button className="btn btn-danger" disabled={saving} onClick={() => handleTraiter('Rejetée')} style={{ flex: '0 0 auto' }}>
                ✕ Rejeter
              </button>
              <button className="btn btn-primary" disabled={saving} onClick={() => handleTraiter('Prête')}>
                ✓ Marquer Prête
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
