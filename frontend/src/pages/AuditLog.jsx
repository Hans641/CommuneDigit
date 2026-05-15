import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../App';
import { auditAPI } from '../services/api';

const ACTION_STYLE = {
  CREATE:   { badge: 'badge-green',  icon: '➕' },
  UPDATE:   { badge: 'badge-blue',   icon: '✏️' },
  VALIDATE: { badge: 'badge-gold',   icon: '✅' },
  DELETE:   { badge: 'badge-red',    icon: '🗑' },
  LOGIN:    { badge: 'badge-gray',   icon: '🔐' },
  EXPORT:   { badge: 'badge-orange', icon: '📤' },
  ALERT:    { badge: 'badge-orange', icon: '📡' },
};
const RISK_STYLE = { 'Faible': 'badge-green', 'Moyen': 'badge-orange', 'Élevé': 'badge-red' };

export default function AuditLog() {
  const { lang } = useApp();

  const [logs,          setLogs]          = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [filterAction,  setFilterAction]  = useState('Tous');
  const [filterRisque,  setFilterRisque]  = useState('Tous');
  const [search,        setSearch]        = useState('');
  const [selectedLog,   setSelectedLog]   = useState(null);
  const [dateDebut,     setDateDebut]     = useState('');
  const [dateFin,       setDateFin]       = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { limit: 200 };
      if (filterAction !== 'Tous') params.action        = filterAction;
      if (filterRisque !== 'Tous') params.niveau_risque = filterRisque;
      setLogs(await auditAPI.list(params));
    } catch {}
    setLoading(false);
  }, [filterAction, filterRisque]);

  useEffect(() => { load(); }, [load]);

  const filtered = logs.filter(l => {
    const q = search.toLowerCase();
    const matchSearch = ((l.detail || '') + (l.entite || '') + (l.ip_address || '')).toLowerCase().includes(q);
    const matchDate   = (!dateDebut || new Date(l.timestamp) >= new Date(dateDebut))
                     && (!dateFin   || new Date(l.timestamp) <= new Date(dateFin + 'T23:59:59'));
    return matchSearch && matchDate;
  });

  const riskHigh = logs.filter(l => l.niveau_risque === 'Élevé').length;
  const today    = new Date().toISOString().slice(0, 10);

  return (
    <>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div className="breadcrumb">🔍 <span>/</span> {lang === 'mg' ? 'Fitanana-kaonty' : "Journal d'audit"}</div>
          <h1 className="page-title">{lang === 'mg' ? 'Fitanana-kaonty' : "Journal d'audit"}</h1>
          <p className="page-subtitle">Traçabilité complète · Logs immuables SHA-256 · Loi 2014-038</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-glass btn-sm" onClick={() => {
            const blob = new Blob([JSON.stringify(filtered, null, 2)], { type: 'application/json' });
            const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
            a.download = `audit_${today}.json`; a.click();
          }}>⬇ Export JSON</button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 14, marginBottom: 24 }}>
        {[
          { l: lang==='mg'?'Fepetran-kevitra':'Total entrées', v: loading ? '…' : logs.length,                                       icon: '📋', color: 'var(--text-primary)' },
          { l: lang==='mg'?'Loza avo':'Risque élevé', v: loading ? '…' : riskHigh,                                          icon: '⚠️', color: '#f87171'             },
          { l: lang==='mg'?'Androany':"Aujourd'hui", v: loading ? '…' : logs.filter(l => l.timestamp?.startsWith(today)).length, icon: '📅', color: 'var(--teal-400)' },
          { l: lang==='mg'?'Mpiasam-panjakana':'Agents tracés', v: loading ? '…' : new Set(logs.map(l => l.agent_id).filter(Boolean)).size,  icon: '👔', color: '#a78bfa'    },
        ].map(s => (
          <div key={s.l} className="glass-card" style={{ padding: '16px 20px' }}>
            <div style={{ fontSize: '1.2rem', marginBottom: 4 }}>{s.icon}</div>
            <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '1.4rem', fontWeight: 800, color: s.color }}>{s.v}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* Alerte risque élevé */}
      {riskHigh > 0 && !loading && (
        <div className="alert alert-error" style={{ marginBottom: 20 }}>
          <span>⚠️</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.875rem' }}>Actions à risque élevé détectées</div>
            <div style={{ fontSize: '0.8rem', marginTop: 2, opacity: 0.8 }}>
              {riskHigh} action(s) nécessitent une vérification manuelle — entrées en rouge ci-dessous.
            </div>
          </div>
          <button className="btn btn-glass btn-sm" style={{ marginLeft: 'auto' }}
            onClick={() => setFilterRisque('Élevé')}>Filtrer →</button>
        </div>
      )}

      {/* Filtres */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="search-wrap" style={{ flex: '1 1 240px', maxWidth: 360 }}>
          <span style={{ color: 'var(--text-muted)' }}>🔍</span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher action, entité, IP…" />
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {['Tous', 'CREATE', 'UPDATE', 'VALIDATE', 'DELETE', 'LOGIN', 'EXPORT', 'ALERT'].map(a => (
            <button key={a} className={`chip chip-sm ${filterAction === a ? 'active' : ''}`}
              onClick={() => setFilterAction(a)}>
              {a !== 'Tous' && ACTION_STYLE[a]?.icon + ' '}{a}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 6 }}>
          {['Tous', 'Faible', 'Moyen', 'Élevé'].map(r => (
            <button key={r} className={`chip chip-sm ${filterRisque === r ? 'active' : ''}`}
              onClick={() => setFilterRisque(r)}>{r}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input className="form-input" type="date" value={dateDebut}
            onChange={e => setDateDebut(e.target.value)} style={{ padding: '6px 10px', fontSize: '0.78rem', width: 140 }} />
          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>→</span>
          <input className="form-input" type="date" value={dateFin}
            onChange={e => setDateFin(e.target.value)} style={{ padding: '6px 10px', fontSize: '0.78rem', width: 140 }} />
        </div>
      </div>

      {/* Table */}
      <div className="glass-card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '14px 24px', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '1rem' }}>
            Journal — <span style={{ color: 'var(--emerald-400)', fontFamily: 'monospace' }}>{loading ? '…' : filtered.length}</span> entrées
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>🔒 Append-only · SHA-256</div>
        </div>
        <div className="glass-table-wrap">
          <table className="glass-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Horodatage</th>
                <th>Action</th>
                <th>Entité</th>
                <th>Détail</th>
                <th>Agent</th>
                <th>IP</th>
                <th>Risque</th>
                <th>Hash</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>Chargement…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={9} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>Aucun résultat</td></tr>
              ) : filtered.map(l => {
                const as = ACTION_STYLE[l.action] || { badge: 'badge-gray', icon: '•' };
                return (
                  <tr key={l.id}
                    style={{ cursor: 'pointer', background: l.niveau_risque === 'Élevé' ? 'rgba(239,68,68,0.05)' : undefined }}
                    onClick={() => setSelectedLog(l)}>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      #{String(l.id).padStart(4, '0')}
                    </td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                      {l.timestamp ? new Date(l.timestamp).toLocaleString('fr-FR') : '—'}
                    </td>
                    <td><span className={`badge ${as.badge}`} style={{ fontSize: '0.68rem' }}>{as.icon} {l.action}</span></td>
                    <td style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{l.entite}</td>
                    <td style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {l.detail || '—'}
                    </td>
                    <td>
                      <div style={{ fontSize: '0.78rem', fontWeight: 600 }}>Agent #{l.agent_id || '—'}</div>
                    </td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.7rem', color: 'var(--text-muted)' }}>{l.ip_address || '—'}</td>
                    <td><span className={`badge ${RISK_STYLE[l.niveau_risque] || 'badge-gray'}`} style={{ fontSize: '0.68rem' }}>{l.niveau_risque}</span></td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.68rem', color: 'rgba(16,185,129,0.7)' }}>
                      {l.hash_sha256 ? `✓ ${l.hash_sha256.slice(0, 8)}…` : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div style={{ padding: '12px 24px', borderTop: '1px solid var(--glass-border)', fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
          <span>{filtered.length} {lang==='mg'?'sokajy':"entrée(s)"} {lang==='mg'?'aseho':'affichée(s)'} / {logs.length}</span>
          <span>{lang==='mg'?'Tantara voatahiry 5 taona · Vakiana fotsiny · Lalàna 2014-038':'Logs conservés 5 ans · Lecture seule · Conforme Loi 2014-038'}</span>
        </div>
      </div>

      {/* Modal détail */}
      {selectedLog && (
        <div className="modal-overlay" onClick={() => setSelectedLog(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 560 }}>
            <div className="modal-header">
              <div>
                <div className="modal-title">Détail #{String(selectedLog.id).padStart(4, '0')}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4, fontFamily: 'monospace' }}>
                  {selectedLog.timestamp ? new Date(selectedLog.timestamp).toLocaleString('fr-FR') : '—'}
                </div>
              </div>
              <button className="modal-close" onClick={() => setSelectedLog(null)}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                { l: 'Action',          v: selectedLog.action },
                { l: 'Entité',          v: selectedLog.entite },
                { l: 'Entité ID',       v: selectedLog.entite_id || '—' },
                { l: 'Détail',          v: selectedLog.detail || '—' },
                { l: 'Agent ID',        v: selectedLog.agent_id || '—' },
                { l: 'Adresse IP',      v: selectedLog.ip_address || '—' },
                { l: 'Niveau de risque',v: selectedLog.niveau_risque },
                { l: 'Empreinte SHA-256', v: selectedLog.hash_sha256 || 'Non disponible' },
              ].map(f => (
                <div key={f.l} style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', minWidth: 160, flexShrink: 0 }}>{f.l}</div>
                  <div style={{ fontSize: '0.875rem', fontWeight: 600, fontFamily: (f.l.includes('SHA') || f.l.includes('IP')) ? 'monospace' : 'inherit', color: f.l.includes('SHA') ? 'var(--emerald-400)' : '#fff', wordBreak: 'break-all' }}>{f.v}</div>
                </div>
              ))}
            </div>
            <div className="divider" />
            <div className="alert alert-info" style={{ marginTop: 0 }}>
              <span>🔒</span>
              <div style={{ fontSize: '0.78rem' }}>Cette entrée est immuable. Toute modification est techniquement impossible (append-only log).</div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
              <button className="btn btn-glass" onClick={() => setSelectedLog(null)}>Fermer</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
