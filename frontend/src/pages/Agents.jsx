import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../App';
import Icon from '../components/Icon';
import { agentsAPI } from '../services/api';

const LANG = {
  fr: { fermer: 'Fermer', annuler: 'Annuler', chargement: 'Chargement…', aucun_resultat: 'Aucun résultat' },
  mg: { fermer: 'Hanidy', annuler: 'Hahafaka', chargement: 'Mampiditra…', aucun_resultat: 'Tsy misy vokatra' },
};

const ROLE_COLORS = { 'Administrateur': 'badge-blue', 'Superviseur': 'badge-gold', 'Agent Fokontany': 'badge-green', 'Ministère MID': 'badge-orange' };

export default function Agents() {
  const { lang } = useApp();
  const t = LANG[lang] || LANG.fr;

  const [agents,    setAgents]    = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selected,  setSelected]  = useState(null);
  const [saving,    setSaving]    = useState(false);
  const [saved,     setSaved]     = useState(false);
  const [form, setForm] = useState({ nom: '', prenom: '', role: 'Agent Fokontany', fokontany: '', email: '', telephone: '', password: 'changeme123' });

  const load = useCallback(async () => {
    setLoading(true);
    try { setAgents(await agentsAPI.list()); } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = agents.filter(a => {
    const q = search.toLowerCase();
    return (a.nom + ' ' + a.prenom + ' ' + a.matricule + ' ' + a.fokontany).toLowerCase().includes(q);
  });

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await agentsAPI.create(form);
      setSaved(true);
      load();
      setTimeout(() => { setSaved(false); setShowModal(false); setForm({ nom: '', prenom: '', role: 'Agent Fokontany', fokontany: '', email: '', telephone: '', password: 'changeme123' }); }, 1800);
    } catch (err) {
      alert(err.response?.data?.detail || 'Erreur lors de la création.');
    }
    setSaving(false);
  };

  const handleDisable = async (id) => {
    if (!confirm('Désactiver cet agent ?')) return;
    try { await agentsAPI.disable(id); setSelected(null); load(); } catch {}
  };

  const maxActes = Math.max(...agents.map(a => a._count?.actes || 0), 1);

  return (
    <>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div className="breadcrumb"><Icon name="users" size={16} /> <span>/</span> {lang === 'mg' ? 'Mpiasam-panjakana' : 'Agents'}</div>
          <h1 className="page-title">Gestion des {lang === 'mg' ? 'Mpiasam-panjakana' : 'Agents'}</h1>
          <p className="page-subtitle">Administration des comptes agents, rôles et affectations Fokontany</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}><Icon name="user" size={14} />&nbsp;Nouvel agent</button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14, marginBottom: 24 }}>
        {[
          { l: lang==='mg'?'Mpiasam-panjakana rehetra':'Total agents', v: agents.length,                                      icon: 'users', color: 'var(--text-primary)' },
          { l: lang==='mg'?'Miasa':'Actifs', v: agents.filter(a => a.is_active).length,              icon: 'check', color: 'var(--emerald-400)' },
          { l: lang==='mg'?'Fokontany voakasika':'Fokontany couverts', v: new Set(agents.map(a => a.fokontany)).size,          icon: 'pin', color: '#a78bfa' },
          { l: lang==='mg'?'Andraikitra samy hafa':'Rôles distincts', v: new Set(agents.map(a => a.role)).size,               icon: 'settings', color: 'var(--teal-400)' },
        ].map(s => (
          <div key={s.l} className="glass-card" style={{ padding: '18px 20px' }}>
            <div style={{ fontSize: '1.3rem', marginBottom: 6 }}><Icon name={s.icon} size={20} /></div>
            <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '1.5rem', fontWeight: 800, color: s.color }}>{loading ? '…' : s.v}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* Recherche */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center' }}>
        <div className="search-wrap" style={{ flex: '1 1 280px', maxWidth: 400 }}>
          <span style={{ color: 'var(--text-muted)' }}><Icon name="search" size={16} /></span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un agent..." />
        </div>
      </div>

      {/* Cards agents */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>{t.chargement}</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>{t.aucun_resultat}</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16, marginBottom: 24 }}>
          {filtered.map(a => {
            const avatar = (a.nom?.[0] || '') + (a.prenom?.[0] || '');
            return (
              <div key={a.id} className="glass-card" style={{ padding: 22, cursor: 'pointer', transition: 'transform 0.2s' }}
                onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-3px)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                onClick={() => setSelected(a)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
                  <div className="avatar avatar-md" style={{ background: `hsl(${a.id * 70}, 55%, 40%)`, fontSize: '0.85rem' }}>{avatar.toUpperCase()}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>{a.nom} {a.prenom}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{a.matricule}</div>
                  </div>
                  <span className={`badge ${a.is_active ? 'badge-green' : 'badge-gray'}`}>{a.is_active ? 'Actif' : 'Inactif'}</span>
                </div>
                <div className="divider" style={{ margin: '12px 0' }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Rôle</span>
                    <span className={`badge ${ROLE_COLORS[a.role] || 'badge-gray'}`} style={{ fontSize: '0.68rem' }}>{a.role}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Fokontany</span>
                    <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>{a.fokontany}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Email</span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{a.email}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Fiche agent */}
      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Fiche agent</div>
              <button className="modal-close" onClick={() => setSelected(null)}>✕</button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24, padding: '16px 0', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
              <div className="avatar avatar-lg" style={{ background: `hsl(${selected.id * 70}, 55%, 40%)` }}>{((selected.nom?.[0] || '') + (selected.prenom?.[0] || '')).toUpperCase()}</div>
              <div>
                <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '1.3rem' }}>{selected.nom} {selected.prenom}</div>
                <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                  <span className={`badge ${selected.is_active ? 'badge-green' : 'badge-gray'}`}>{selected.is_active ? 'Actif' : 'Inactif'}</span>
                  <span className={`badge ${ROLE_COLORS[selected.role] || 'badge-gray'}`}>{selected.role}</span>
                </div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
              {[
                { l: 'Matricule',  v: selected.matricule },
                { l: 'Fokontany', v: selected.fokontany },
                { l: 'Email',     v: selected.email },
                { l: 'Téléphone', v: selected.telephone || '—' },
                { l: 'Dernière connexion', v: selected.last_login ? new Date(selected.last_login).toLocaleDateString('fr-FR') : '—' },
              ].map(f => (
                <div key={f.l} className="glass-card" style={{ padding: '14px 16px' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{f.l}</div>
                  <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>{f.v}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn btn-glass" onClick={() => setSelected(null)}>{t.fermer}</button>
              {selected.is_active && <button className="btn btn-danger" onClick={() => handleDisable(selected.id)}><Icon name="x" size={14} /> Désactiver</button>}
            </div>
          </div>
        </div>
      )}

      {/* Modal nouvel agent */}
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal" style={{ maxWidth: 580 }}>
            <div className="modal-header">
              <div className="modal-title"><Icon name="user" size={18} /> Nouvel agent</div>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            {saved ? (
              <div className="alert alert-success" style={{ textAlign: 'center', flexDirection: 'column', padding: 32 }}>
                <div style={{ fontSize: '2rem', marginBottom: 10 }}><Icon name="check" size={32} /></div>
                <div style={{ fontWeight: 700 }}>Agent créé avec succès</div>
                <div style={{ fontSize: '0.8rem', opacity: 0.7, marginTop: 4 }}>Identifiants envoyés par SMS</div>
              </div>
            ) : (
              <form onSubmit={handleSave}>
                <div className="form-grid" style={{ marginBottom: 16 }}>
                  <div className="form-group">
                    <label className="form-label">Nom *</label>
                    <input className="form-input" value={form.nom} onChange={e => setForm({...form, nom: e.target.value})} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Prénom *</label>
                    <input className="form-input" value={form.prenom} onChange={e => setForm({...form, prenom: e.target.value})} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Rôle *</label>
                    <select className="form-select" value={form.role} onChange={e => setForm({...form, role: e.target.value})}>
                      <option>Agent Fokontany</option>
                      <option>Superviseur</option>
                      <option>Administrateur</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Fokontany *</label>
                    <input className="form-input" value={form.fokontany} onChange={e => setForm({...form, fokontany: e.target.value})} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Email *</label>
                    <input className="form-input" type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} required placeholder="agent@commune.mg" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Téléphone *</label>
                    <input className="form-input" value={form.telephone} onChange={e => setForm({...form, telephone: e.target.value})} required />
                  </div>
                  <div className="form-group" style={{ gridColumn: '1/-1' }}>
                    <label className="form-label">Mot de passe initial *</label>
                    <input className="form-input" type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} required />
                  </div>
                </div>
                <div className="alert alert-info" style={{ marginBottom: 20 }}>
                  <span><Icon name="phone" size={16} /></span>
                  <div style={{ fontSize: '0.78rem' }}>{lang==='mg'?"Hamorona ho azy ny matricule. Ny mpiasam-panjakana dia tsy maintsy hanova ny tenimiafiny amin\'ny fidirana voalohany.":"Un matricule sera généré automatiquement. L'agent devra changer son mot de passe à la première connexion."}</div>
                </div>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <button type="button" className="btn btn-glass" onClick={() => setShowModal(false)}>{t.annuler}</button>
                  <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? t.chargement : "Créer l'agent →"}</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
