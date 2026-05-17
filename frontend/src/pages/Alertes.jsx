import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../App';
import Icon from '../components/Icon';
import { alertesAPI } from '../services/api';

const LANG = {
  fr: {
    fermer: 'Fermer', enregistrer: 'Enregistrer', annuler: 'Annuler',
    chargement: 'Chargement…', aucun_resultat: 'Aucun résultat',
  },
  mg: {
    fermer: 'Hanidy', enregistrer: 'Hitahiry', annuler: 'Hahafaka',
    chargement: 'Mampiditra…', aucun_resultat: 'Tsy misy vokatra',
  },
};

const TYPE_COLORS = { Santé: 'badge-red', Sécurité: 'badge-orange', Admin: 'badge-blue', Infos: 'badge-green' };
const URG_COLORS  = { Haute: 'badge-red', Normale: 'badge-gold' };

export default function Alertes() {
  const { lang } = useApp();
  const t = LANG[lang] || LANG.fr;

  const [alertes,    setAlertes]    = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [showModal,  setShowModal]  = useState(false);
  const [filter,     setFilter]     = useState('Tous');
  const [saving,     setSaving]     = useState(false);
  const [saved,      setSaved]      = useState(false);
  const [form, setForm] = useState({ type: 'Santé', urgence: 'Normale', titre: '', corps: '', destinataires: 'Tous les Fokontany', fokontany_id: null });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await alertesAPI.list({ limit: 100 });
      setAlertes(data);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await alertesAPI.create(form);
      setSaved(true);
      load();
      setTimeout(() => { setSaved(false); setShowModal(false); setForm({ type: 'Santé', urgence: 'Normale', titre: '', corps: '', destinataires: 'Tous les Fokontany', fokontany_id: null }); }, 1800);
    } catch { alert('Erreur lors de la publication.'); }
    setSaving(false);
  };

  const handleDesactiver = async (id) => {
    if (!confirm('Désactiver cette alerte ?')) return;
    try { await alertesAPI.desactiver(id); load(); } catch {}
  };

  const filtered = alertes.filter(a => filter === 'Tous' || a.type === filter);
  const counts = { Active: 0, Planifiée: 0, Expirée: 0 };
  alertes.forEach(a => { if (counts[a.statut] !== undefined) counts[a.statut]++; });

  return (
    <>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div className="breadcrumb"><Icon name="alert" size={16} /> <span>/</span> {lang === 'mg' ? 'Filazana' : 'Alertes'}</div>
          <h1 className="page-title">{lang === 'mg' ? 'Filazana' : 'Alertes'} & Communications</h1>
          <p className="page-subtitle">Diffusion d'annonces officielles — SMS, push, USSD</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}><Icon name="alert" size={14} />&nbsp;Publier une alerte</button>
      </div>

      {/* Filtres */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {['Tous', 'Santé', 'Sécurité', 'Admin', 'Infos'].map(f => (
          <button key={f} className={`chip ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>{f}</button>
        ))}
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 14, marginBottom: 24 }}>
        {[
          { l: lang==='mg'?'Miasa':'Actives',      v: counts.Active,    icon: 'alert', color: '#f87171' },
          { l: lang==='mg'?'Nolaminina':'Planifiées', v: counts.Planifiée, icon: 'clock', color: 'var(--gold-400)' },
          { l: lang==='mg'?'Lany':'Expirées',         v: counts.Expirée,   icon: 'x', color: 'var(--text-muted)' },
          { l: lang==='mg'?'Fepetran-kevitra':'Total', v: alertes.length,  icon: 'chart', color: 'var(--text-primary)' },
        ].map(s => (
          <div key={s.l} className="glass-card" style={{ padding: '18px 20px' }}>
            <div style={{ fontSize: '1.3rem', marginBottom: 6 }}><Icon name={s.icon} size={20} /></div>
            <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '1.5rem', fontWeight: 800, color: s.color }}>{loading ? '…' : s.v}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* Liste alertes */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>{t.chargement}</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>{t.aucun_resultat}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {filtered.map(a => (
            <div key={a.id} className="glass-card" style={{ padding: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span className={`badge ${TYPE_COLORS[a.type] || 'badge-gray'}`}>{a.type}</span>
                  <span className={`badge ${URG_COLORS[a.urgence] || 'badge-gray'}`}><Icon name="zap" size={12} /> {a.urgence}</span>
                  <span className={`badge ${a.is_active ? 'badge-green' : 'badge-gray'}`}>{a.is_active ? 'Active' : 'Inactive'}</span>
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {a.date_creation ? new Date(a.date_creation).toLocaleDateString('fr-FR') : '—'}
                </span>
              </div>
              <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '1rem', marginBottom: 8 }}>{a.titre}</div>
              <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 14 }}>{a.corps || a.message}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  <Icon name="pin" size={12} /> {lang === 'mg' ? 'Mpandray' : 'Destinataires'} : <strong style={{ color: 'var(--text-secondary)' }}>{a.destinataires || 'Tous'}</strong>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {a.is_active && (
                    <button className="btn btn-danger btn-sm" onClick={() => handleDesactiver(a.id)}><Icon name="x" size={14} /> Désactiver</button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title"><Icon name="alert" size={18} /> Publier une alerte</div>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            {saved ? (
              <div className="alert alert-success" style={{ textAlign: 'center', flexDirection: 'column', padding: 32 }}>
                <div style={{ fontSize: '2rem', marginBottom: 10 }}><Icon name="alert" size={32} /></div>
                <div style={{ fontWeight: 700 }}>Alerte publiée avec succès</div>
                <div style={{ fontSize: '0.8rem', opacity: 0.7, marginTop: 4 }}>Diffusion SMS + Push en cours…</div>
              </div>
            ) : (
              <form onSubmit={handleSave}>
                <div className="form-grid" style={{ marginBottom: 16 }}>
                  <div className="form-group">
                    <label className="form-label">Type *</label>
                    <select className="form-select" value={form.type} onChange={e => setForm({...form, type: e.target.value})}>
                      <option>Santé</option><option>Sécurité</option><option>Admin</option><option>Infos</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Urgence *</label>
                    <select className="form-select" value={form.urgence} onChange={e => setForm({...form, urgence: e.target.value})}>
                      <option>Haute</option><option>Normale</option>
                    </select>
                  </div>
                  <div className="form-group" style={{ gridColumn: '1/-1' }}>
                    <label className="form-label">Titre *</label>
                    <input className="form-input" value={form.titre} onChange={e => setForm({...form, titre: e.target.value})} required placeholder="Titre de l'alerte" />
                  </div>
                  <div className="form-group" style={{ gridColumn: '1/-1' }}>
                    <label className="form-label">Message *</label>
                    <textarea className="form-textarea" value={form.corps} onChange={e => setForm({...form, corps: e.target.value})} required placeholder="Corps du message..." style={{ minHeight: 100 }} />
                  </div>
                  <div className="form-group" style={{ gridColumn: '1/-1' }}>
                    <label className="form-label">Destinataires</label>
                    <select className="form-select" value={form.destinataires} onChange={e => setForm({...form, destinataires: e.target.value})}>
                      <option>Tous les Fokontany</option>
                      <option>Agents uniquement</option>
                      <option>Fokontany Nord</option>
                      <option>Fokontany Sud</option>
                    </select>
                  </div>
                </div>
                <div className="alert alert-warn" style={{ marginBottom: 20 }}>
                  <span><Icon name="zap" size={16} /></span>
                  <div style={{ fontSize: '0.78rem' }}>{lang==='mg'?"Haparitaka amin\'ny SMS (Africa\'s Talking) sy push notification ity filazana ity. Ny olom-pirenena tsy manana smartphone dia handray USSD.":"Cette alerte sera diffusée par SMS (Africa's Talking) et notifications push. Les citoyens sans smartphone recevront un USSD."}</div>
                </div>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <button type="button" className="btn btn-glass" onClick={() => setShowModal(false)}>{t.annuler}</button>
                  <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? t.chargement : <><Icon name="alert" size={14} />&nbsp;Diffuser →</>}</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
