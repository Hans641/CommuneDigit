import React, { useState, useEffect } from 'react';
import { useAuth, useApp } from '../App';
import { dashboardAPI, alertesAPI, actesAPI } from '../services/api';

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


// Stats et données récentes sont chargées depuis l'API (voir useEffect dans le composant)

// Activité récente chargée dynamiquement depuis le backend (audit log)

const PHASE_DATA = [
  { label_fr: 'Phase 1 — Préparation',  label_mg: 'Dingana 1 — Fiombonanana', pct: 100, color: 'var(--emerald-500)' },
  { label_fr: 'Phase 2 — MVP Dev',      label_mg: 'Dingana 2 — Fampandrosoana', pct: 85,  color: 'var(--teal-400)'   },
  { label_fr: 'Phase 3 — Pilote',       label_mg: 'Dingana 3 — Ditsaka',       pct: 40,  color: '#a78bfa'           },
  { label_fr: 'Phase 4 — Déploiement',  label_mg: 'Dingana 4 — Fampiharana',   pct: 0,   color: 'var(--gold-400)'   },
  { label_fr: 'Phase 5 — Pérennisation',label_mg: 'Dingana 5 — Faharetana',    pct: 0,   color: '#f87171'           },
];

function StatusBadge({ s }) {
  const map = { 'Validé': 'badge-green', 'En cours': 'badge-orange', 'En attente': 'badge-gold', 'Rejeté': 'badge-red' };
  return <span className={`badge ${map[s] || 'badge-gray'}`}>{s}</span>;
}

function AnimCounter({ target }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    const n = parseInt(target, 10);
    if (isNaN(n)) return;
    let cur = 0;
    const step = Math.ceil(n / 40);
    const t = setInterval(() => {
      cur = Math.min(cur + step, n);
      setVal(cur);
      if (cur >= n) clearInterval(t);
    }, 25);
    return () => clearInterval(t);
  }, [target]);
  if (parseInt(target) >= 1000000) return <span>{(val / 1000000).toFixed(1)}M</span>;
  if (parseInt(target) >= 1000)    return <span>{val.toLocaleString('fr-FR')}</span>;
  return <span>{val}</span>;
}

export default function DashboardHome({ onNavigate }) {
  const { lang } = useApp();
  const t = LANG[lang] || LANG.fr;
  const { user } = useAuth();
  const hour = new Date().getHours();
  const greeting = hour < 12 ? lang === 'mg' ? 'Manao ahoana' : 'Bonjour' : hour < 18 ? lang === 'mg' ? 'Arahaba' : 'Bon après-midi' : lang === 'mg' ? 'Hariva soa' : 'Bonsoir';
  const [activityTab, setActivityTab] = useState('recent');

  // ── Données réelles depuis l'API ────────────────────────────────
  const [apiStats, setApiStats]   = useState(null);
  const [recentActes, setRecentActes] = useState([]);
  const [activeAlertes, setActiveAlertes] = useState([]);
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    dashboardAPI.stats().then(setApiStats).catch(() => {}).finally(() => setLoadingStats(false));
    actesAPI.list({ limit: 5 }).then(setRecentActes).catch(() => {});
    alertesAPI.list({ is_active: true, limit: 1 }).then(setActiveAlertes).catch(() => {});
  }, []);

  const STATS = [
    { icon: '👥', value: String(apiStats?.total_citoyens ?? '—'), label_fr: 'Citoyens enregistrés', label_mg: 'Olom-pirenena voasoratra', up: true,  page: 'citoyens'  },
    { icon: '📋', value: String(apiStats?.actes_ce_mois ?? '—'), label_fr: 'Actes ce mois',         label_mg: 'Taratasy ity volana',     up: true,  page: 'etatcivil' },
    { icon: '⏳', value: String(apiStats?.dossiers_en_attente ?? '—'), label_fr: 'En attente',       label_mg: 'Rakitra miandry',         up: false, page: 'etatcivil' },
    { icon: '💳', value: String(apiStats?.total_taxes ?? '—'),    label_fr: 'Taxes collectées (Ar)', label_mg: 'Hetra voangona (Ar)',     up: true,  page: 'paiements' },
  ];

  return (
    <>
      {/* Header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div className="breadcrumb">🏠 <span>/</span> {lang === 'mg' ? 'Fikirakirana' : 'Tableau de bord'}</div>
          <h1 className="page-title">{greeting}, {user?.name?.split(' ')[0]} 👋</h1>
          <p className="page-subtitle">
            {new Date().toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            &nbsp;·&nbsp;<span style={{ color: 'var(--emerald-400)' }}>{lang === 'mg' ? '✓ Voatomombana rehetra' : '✓ Tout synchronisé'}</span>
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="btn btn-glass btn-sm" onClick={() => onNavigate('etatcivil')}>{lang === 'mg' ? '📋 Taratasy vaovao' : '📋 Nouvel acte'}</button>
          <button className="btn btn-glass btn-sm" onClick={() => onNavigate('impressions')}>{lang === 'mg' ? '🖨️ Printy' : '🖨️ Imprimer'}</button>
          <button className="btn btn-primary btn-sm" onClick={() => onNavigate('certificats')}>{lang === 'mg' ? '+ Taratasy' : '+ Certificat'}</button>
        </div>
      </div>

      {/* Alertes banner dynamique */}
      {activeAlertes.length > 0 && (
        <div className="alert alert-error" style={{ marginBottom: 10 }}>
          <span style={{ fontSize: '1.1rem' }}>{activeAlertes[0].icon || '📡'}</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.875rem' }}>{activeAlertes[0].titre}</div>
            <div style={{ fontSize: '0.8rem', opacity: 0.8, marginTop: 2 }}>{activeAlertes[0].message}</div>
          </div>
          <button className="btn btn-glass btn-sm" style={{ marginLeft: 'auto' }} onClick={() => onNavigate('alertes')}>{lang === 'mg' ? 'Antsipirihana →' : 'Détails →'}</button>
        </div>
      )}
      {apiStats?.dossiers_en_attente > 0 && (
        <div className="alert alert-warn" style={{ marginBottom: 20 }}>
          <span style={{ fontSize: '1.1rem' }}>⚠️</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.875rem' }}>{lang === 'mg' ? `${apiStats.dossiers_en_attente} rakitra miandry` : `${apiStats.dossiers_en_attente} dossiers en attente`}</div>
            <div style={{ fontSize: '0.8rem', opacity: 0.8, marginTop: 2 }}>{lang === 'mg' ? 'Ataovy voalohany ireo efa mitohitohy' : 'Traiter en priorité les dossiers non validés'}</div>
          </div>
          <button className="btn btn-glass btn-sm" style={{ marginLeft: 'auto' }} onClick={() => onNavigate('etatcivil')}>{lang === 'mg' ? 'Karakarao →' : 'Traiter →'}</button>
        </div>
      )}

      {/* Stats */}
      <div className="stats-grid" style={{ marginBottom: 20 }}>
        {STATS.map(s => (
          <div key={s.label_fr} className="glass-card stat-card"
            style={{ cursor: 'pointer', transition: 'transform 0.2s' }}
            onClick={() => onNavigate(s.page)}
            onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-4px)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <span className="stat-icon">{s.icon}</span>
            <div className="stat-value">{loadingStats ? '…' : <AnimCounter target={s.value} />}</div>
            <div className="stat-label">{lang === 'mg' ? s.label_mg : s.label_fr}</div>
            <div className={`stat-trend ${s.up ? 'up' : 'down'}`}>{s.up ? '↑' : '↓'} {lang === 'mg' ? 'ity volana ity' : 'ce mois'}</div>
          </div>
        ))}
      </div>

      {/* Row 2 */}
      <div className="grid-2" style={{ marginBottom: 20 }}>
        {/* Dossiers récents */}
        <div className="glass-card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '1rem' }}>{lang === 'mg' ? 'Rakitra farany' : 'Derniers dossiers'}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>{lang === 'mg' ? 'Havaozina ara-potoana' : 'Mis à jour en temps réel'}</div>
            </div>
            <button className="btn btn-glass btn-sm" onClick={() => onNavigate('etatcivil')}>{lang === 'mg' ? 'Jereo rehetra →' : 'Tout voir →'}</button>
          </div>
          <div className="glass-table-wrap">
            <table className="glass-table">
              <thead><tr><th>Réf.</th><th>Citoyen</th><th>Type</th><th>Statut</th><th>Date</th></tr></thead>
              <tbody>
                {recentActes.length === 0 ? (
                  <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 20 }}>{t.chargement}</td></tr>
                ) : recentActes.map(r => (
                  <tr key={r.id} style={{ cursor: 'pointer' }}>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--text-muted)' }}>#{r.id}</td>
                    <td style={{ fontWeight: 600 }}>{r.citoyen?.nom} {r.citoyen?.prenom}</td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: '0.83rem' }}>{r.type_acte}</td>
                    <td><StatusBadge s={r.statut} /></td>
                    <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{r.date_acte ? new Date(r.date_acte).toLocaleDateString('fr-FR') : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* {lang === 'mg' ? "Fihetsehan'asa" : "Flux d'activité"} */}
        <div className="glass-card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '1rem' }}>{lang === 'mg' ? "Fihetsehan'asa" : "Flux d'activité"}</div>
            <div className="tabs" style={{ padding: 3 }}>
              <button className={`tab-btn ${activityTab === 'recent' ? 'active' : ''}`} onClick={() => setActivityTab('recent')}>{lang === 'mg' ? 'Vao haingana' : 'Récent'}</button>
              <button className={`tab-btn ${activityTab === 'all' ? 'active' : ''}`} onClick={() => setActivityTab('all')}>{t.tout}</button>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {(activityTab === 'recent' ? ACTIVITY.slice(0, 4) : ACTIVITY).map((a, i, arr) => (
              <div key={i} style={{ display: 'flex', gap: 12, paddingBottom: 14, position: 'relative' }}>
                {i < arr.length - 1 && <div style={{ position: 'absolute', left: 13, top: 28, width: 1, height: 'calc(100% - 14px)', background: 'var(--glass-bg)' }} />}
                <div style={{ width: 26, height: 26, borderRadius: '50%', background: `${a.color}22`, border: `1px solid ${a.color}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', flexShrink: 0, zIndex: 1 }}>
                  {a.icon}
                </div>
                <div style={{ flex: 1, paddingTop: 2 }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>{lang === 'mg' ? a.text_mg : a.text_fr}</div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 3 }}>{lang === 'mg' ? a.time_mg : a.time_fr}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 3 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20 }}>
        {/* Sync */}
        <div className="glass-card" style={{ padding: 24 }}>
          <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '1rem', marginBottom: 16 }}>{lang === 'mg' ? '📡 Fampifandraisana' : '📡 Synchronisation'}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { label_fr: 'Données locales',  label_mg: 'Angon-drakitra eto',   pct: 100, color: 'var(--emerald-500)' },
              { label_fr: 'Sync serveur',     label_mg: 'Sync mpizara',         pct: 87,  color: 'var(--teal-400)'   },
              { label_fr: 'Cache hors-ligne', label_mg: 'Cache tsy misy tambo', pct: 94,  color: '#a78bfa'           },
              { label_fr: 'Intégrité SHA-256',label_mg: 'Fahamendrehana SHA-256',pct: 100, color: 'var(--gold-400)'  },
            ].map(s => (
              <div key={s.label_fr}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  <span>{lang === 'mg' ? s.label_mg : s.label_fr}</span><span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{s.pct}%</span>
                </div>
                <div className="progress-bar-wrap"><div className="progress-bar" style={{ width: `${s.pct}%`, background: s.color }} /></div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 14, fontSize: '0.7rem', color: 'var(--text-muted)' }}>{lang === 'mg' ? 'Algoritma LWW · Sync farany : 3 min' : 'Algorithme LWW · Dernière sync : 3 min'}</div>
        </div>

        {/* Actions rapides */}
        <div className="glass-card" style={{ padding: 24 }}>
          <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '1rem', marginBottom: 16 }}>{lang === 'mg' ? '⚡ Asa haingana' : '⚡ Actions rapides'}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { icon: '👶', label_fr: 'Enregistrer naissance', label_mg: "Masoratra fahaterahan'ny zaza", page: 'etatcivil' },                { icon: '📜', label_fr: 'Délivrer certificat',    label_mg: 'Manome taratasy ofisialy',      page: 'certificats'  },
              { icon: '💳', label_fr: 'Encaisser paiement',     label_mg: 'Mandray fandoavana',            page: 'paiements'    },
              { icon: '🖨️', label_fr: 'Imprimer un document',  label_mg: 'Printy antontan-taratasy',      page: 'impressions'  },
              { icon: '📡', label_fr: 'Publier une alerte',     label_mg: 'Hamoaka filazana',              page: 'alertes'      },
              { icon: '📊', label_fr: 'Voir les statistiques',  label_mg: 'Jereo ny statistika',           page: 'statistiques' },
            ].map(a => (
              <button key={a.label_fr} className="btn btn-glass" style={{ justifyContent: 'flex-start', padding: '9px 14px', gap: 10, fontSize: '0.82rem' }} onClick={() => onNavigate(a.page)}>
                <span style={{ width: 20, textAlign: 'center' }}>{a.icon}</span> {lang === 'mg' ? a.label_mg : a.label_fr}
              </button>
            ))}
          </div>
        </div>

        {/* Plan */}
        <div className="glass-card" style={{ padding: 24 }}>
          <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '1rem', marginBottom: 16 }}>{lang === 'mg' ? '🗓️ Drafitry ny fampiharana' : '🗓️ Plan de déploiement'}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {PHASE_DATA.map((p, i) => (
              <div key={i}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: '0.75rem' }}>
                  <span style={{ color: p.pct === 100 ? 'var(--text-primary)' : p.pct > 0 ? 'var(--text-secondary)' : 'var(--text-disabled)' }}>{p.label}</span>
                  <span style={{ fontWeight: 700, color: p.color }}>{p.pct}%</span>
                </div>
                <div className="progress-bar-wrap"><div className="progress-bar" style={{ width: `${p.pct}%`, background: p.color }} /></div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 14, padding: '10px 14px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 8, fontSize: '0.72rem', color: 'var(--emerald-400)' }}>
            {lang === 'mg' ? '🚀 Ditsaka : Fokontany 5 · Mpiasam-panjakana 200' : '🚀 Pilote : 5 Fokontany · 200 agents formés'}
          </div>
        </div>
      </div>
    </>
  );
}
