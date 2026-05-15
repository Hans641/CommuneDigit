import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../App';
import { citoyensAPI, fokontanyAPI } from '../services/api';

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

export default function Citoyens() {
  const { lang } = useApp();
  const t = LANG[lang] || LANG.fr;

  const [citoyens, setCitoyens]     = useState([]);
  const [fokontanys, setFokontanys] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [search, setSearch]         = useState('');
  const [filterFok, setFilterFok]   = useState('Tous');
  const [selected, setSelected]     = useState(null);
  const [showModal, setShowModal]   = useState(false);
  const [saving, setSaving]         = useState(false);
  const [saved, setSaved]           = useState(false);
  const [form, setForm]             = useState({ nom: '', prenom: '', cin: '', telephone: '', fokontany_id: '', adresse: '' });

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (search) params.q = search;
      if (filterFok !== 'Tous') {
        const fok = fokontanys.find(f => f.nom === filterFok);
        if (fok) params.fokontany_id = fok.id;
      }
      const data = await citoyensAPI.list(params);
      setCitoyens(data);
    } catch {
      setError(lang === 'mg' ? 'Tsy azo natao ny fampidirana' : 'Impossible de charger les citoyens');
    } finally {
      setLoading(false);
    }
  }, [search, filterFok, fokontanys, lang]);

  useEffect(() => {
    fokontanyAPI.list().then(setFokontanys).catch(() => {});
  }, []);

  useEffect(() => {
    const timer = setTimeout(load, 300);
    return () => clearTimeout(timer);
  }, [load]);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await citoyensAPI.create(form);
      setSaved(true);
      load();
      setTimeout(() => { setSaved(false); setShowModal(false); setForm({ nom: '', prenom: '', cin: '', telephone: '', fokontany_id: '', adresse: '' }); }, 1800);
    } catch {
      alert(lang === 'mg' ? 'Nisy hadisoana. Avereno.' : 'Erreur lors de l\'enregistrement.');
    } finally {
      setSaving(false);
    }
  };

  const foks = ['Tous', ...fokontanys.map(f => f.nom)];

  return (
    <>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div className="breadcrumb">👥 <span>/</span> {lang === 'mg' ? 'Olom-pirenena' : 'Citoyens'}</div>
          <h1 className="page-title">Annuaire des citoyens</h1>
          <p className="page-subtitle">Registre central des résidents — {citoyens.length} citoyens chargés</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Nouveau citoyen</button>
      </div>

      {/* Filtres */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="search-wrap" style={{ flex: '1 1 280px', maxWidth: 400 }}>
          <span style={{ color: 'var(--text-muted)' }}>🔍</span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher par nom, CIN..." />
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {foks.map(f => <button key={f} className={`chip ${filterFok === f ? 'active' : ''}`} onClick={() => setFilterFok(f)}>{f}</button>)}
        </div>
      </div>

      {error && <div className="alert alert-danger" style={{ marginBottom: 16 }}>{error}</div>}

      {/* Liste */}
      <div className="glass-card" style={{ overflow: 'hidden' }}>
        <div className="glass-table-wrap">
          <table className="glass-table">
            <thead>
              <tr>
                <th>Citoyen</th>
                <th>CIN</th>
                <th>Téléphone</th>
                <th>Fokontany</th>
                <th>Statut</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>{t.chargement}</td></tr>
              ) : citoyens.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>{t.aucun_resultat}</td></tr>
              ) : citoyens.map(c => (
                <tr key={c.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div className="avatar avatar-sm" style={{ background: `hsl(${c.id * 60}, 60%, 40%)` }}>{c.nom[0]}</div>
                      <div>
                        <div style={{ fontWeight: 600 }}>{c.nom} {c.prenom}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>ID #{c.id}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: c.cin ? 'var(--text-secondary)' : 'var(--text-disabled)' }}>
                    {c.cin || '—'}
                  </td>
                  <td style={{ fontSize: '0.83rem' }}>{c.telephone || '—'}</td>
                  <td>
                    <span className="badge badge-blue">{c.fokontany?.nom || c.fokontany_id || '—'}</span>
                  </td>
                  <td>
                    <span className={`badge ${c.is_active ? 'badge-green' : 'badge-gray'}`}>{c.is_active ? 'Actif' : 'Inactif'}</span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-glass btn-sm" onClick={() => setSelected(c)}>👁</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ padding: '14px 24px', borderTop: '1px solid var(--glass-border)', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          {citoyens.length} résultat(s)
        </div>
      </div>

      {/* Fiche citoyen */}
      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Fiche citoyen</div>
              <button className="modal-close" onClick={() => setSelected(null)}>✕</button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24, padding: '16px 0', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
              <div className="avatar avatar-lg" style={{ background: `hsl(${selected.id * 60}, 60%, 40%)` }}>{selected.nom[0]}</div>
              <div>
                <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '1.3rem' }}>{selected.nom} {selected.prenom}</div>
                <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                  <span className={`badge ${selected.is_active ? 'badge-green' : 'badge-gray'}`}>{selected.is_active ? 'Actif' : 'Inactif'}</span>
                  <span className="badge badge-blue">{selected.fokontany?.nom || '—'}</span>
                </div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {[
                { l: 'CIN',       v: selected.cin || 'Non renseigné' },
                { l: 'Téléphone', v: selected.telephone || '—' },
                { l: 'Email',     v: selected.email || '—' },
                { l: 'Adresse',   v: selected.adresse || '—' },
                { l: 'Date de naissance', v: selected.date_naissance ? new Date(selected.date_naissance).toLocaleDateString('fr-FR') : '—' },
              ].map(f => (
                <div key={f.l}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{f.l}</div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 500 }}>{f.v}</div>
                </div>
              ))}
            </div>
            <div className="divider" />
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn btn-glass" onClick={() => setSelected(null)}>{t.fermer}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal nouveau citoyen */}
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">👥 Enregistrer un citoyen</div>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            {saved ? (
              <div className="alert alert-success" style={{ textAlign: 'center', flexDirection: 'column', padding: 32 }}>
                <div style={{ fontSize: '2rem', marginBottom: 10 }}>✅</div>
                <div style={{ fontWeight: 700 }}>Citoyen enregistré avec succès</div>
              </div>
            ) : (
              <form onSubmit={handleSave}>
                <div className="form-grid" style={{ marginBottom: 16 }}>
                  <div className="form-group">
                    <label className="form-label">Nom *</label>
                    <input className="form-input" value={form.nom} onChange={e => setForm({...form, nom: e.target.value})} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Prénom(s) *</label>
                    <input className="form-input" value={form.prenom} onChange={e => setForm({...form, prenom: e.target.value})} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">CIN</label>
                    <input className="form-input" value={form.cin} onChange={e => setForm({...form, cin: e.target.value})} placeholder="Si disponible" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Téléphone</label>
                    <input className="form-input" value={form.telephone} onChange={e => setForm({...form, telephone: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Fokontany *</label>
                    <select className="form-input" value={form.fokontany_id} onChange={e => setForm({...form, fokontany_id: parseInt(e.target.value)})} required>
                      <option value="">Sélectionner…</option>
                      {fokontanys.map(f => <option key={f.id} value={f.id}>{f.nom}</option>)}
                    </select>
                  </div>
                  <div className="form-group" style={{ gridColumn: '1/-1' }}>
                    <label className="form-label">Adresse</label>
                    <textarea className="form-textarea" value={form.adresse} onChange={e => setForm({...form, adresse: e.target.value})} placeholder="Adresse complète" />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <button type="button" className="btn btn-glass" onClick={() => setShowModal(false)}>{t.annuler}</button>
                  <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? t.chargement : 'Enregistrer →'}</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
