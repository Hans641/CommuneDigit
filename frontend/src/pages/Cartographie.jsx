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


const FOKONTANY = [
  { id: 1, nom: 'Sabotsy Namehana', commune: 'Antananarivo', lat: -18.87, lng: 47.55, pop: 12400, actes: 89, statut: 'Connecté' },
  { id: 2, nom: 'Ambohimanga',      commune: 'Antananarivo', lat: -18.77, lng: 47.53, pop: 8200,  actes: 45, statut: 'Connecté' },
  { id: 3, nom: 'Ivandry',          commune: 'Antananarivo', lat: -18.88, lng: 47.50, pop: 15600, actes: 120, statut: 'Connecté' },
  { id: 4, nom: 'Ankorondrano',     commune: 'Antananarivo', lat: -18.90, lng: 47.52, pop: 9800,  actes: 62,  statut: 'Hors-ligne' },
  { id: 5, nom: 'Ambodivona',       commune: 'Antananarivo', lat: -18.91, lng: 47.54, pop: 7300,  actes: 34,  statut: 'Connecté' },
];

export default function CartographiePage() {  const { lang } = useApp();
  const t = LANG[lang] || LANG.fr;
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState('Tous');

  const filtered = FOKONTANY.filter(f => filter === 'Tous' || f.statut === filter);

  return (
    <>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div className="breadcrumb">🗺️ <span>/</span> {lang === 'mg' ? 'Sarintany' : 'Cartographie'}</div>
          <h1 className="page-title">{lang === 'mg' ? 'Sarintany' : 'Cartographie'} des Fokontany</h1>
          <p className="page-subtitle">Géolocalisation et statistiques territoriales via PostGIS</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {['Tous', 'Connecté', 'Hors-ligne'].map(s => (
            <button key={s} className={`chip ${filter === s ? 'active' : ''}`} onClick={() => setFilter(s)}>{s}</button>
          ))}
        </div>
      </div>

      <div className="grid-2" style={{ marginBottom: 20 }}>
        {/* Map placeholder */}
        <div style={{ gridColumn: '1/-1' }}>
          <div className="glass-card map-container" style={{ height: 380 }}>
            <div className="map-grid" />
            {/* Simulated map points */}
            {filtered.map(f => (
              <button
                key={f.id}
                onClick={() => setSelected(f)}
                style={{
                  position: 'absolute',
                  left: `${(f.lng - 47.48) * 600 + 45}%`,
                  top: `${(f.lat + 18.75) * -500 + 88}%`,
                  background: selected?.id === f.id ? 'var(--emerald-500)' : f.statut === 'Hors-ligne' ? 'rgba(245,158,11,0.8)' : 'rgba(16,185,129,0.8)',
                  border: `2px solid ${selected?.id === f.id ? '#fff' : 'rgba(255,255,255,0.3)'}`,
                  borderRadius: '50%',
                  width: 14, height: 14,
                  cursor: 'pointer',
                  zIndex: 10,
                  transition: 'all 0.2s',
                  transform: selected?.id === f.id ? 'scale(1.6)' : 'scale(1)',
                  boxShadow: '0 0 12px rgba(16,185,129,0.5)',
                }}
                title={f.nom}
              />
            ))}

            {/* Map label */}
            <div style={{ position: 'absolute', bottom: 16, left: 16, background: 'rgba(0,0,0,0.5)', borderRadius: 8, padding: '8px 14px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              🗺️ Antananarivo · Simulation PostGIS · {filtered.length} Fokontany affichés
            </div>

            {/* Legend */}
            <div style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(0,0,0,0.5)', borderRadius: 8, padding: '10px 14px', fontSize: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--emerald-400)' }} /> Connecté
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--gold-400)' }} /> Hors-ligne
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid-2">
        {/* Liste Fokontany */}
        <div className="glass-card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--glass-border)' }}>
            <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '1rem' }}>Liste des Fokontany</div>
          </div>
          <div style={{ padding: '8px 0' }}>
            {filtered.map(f => (
              <button
                key={f.id}
                onClick={() => setSelected(f)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 14,
                  padding: '14px 24px', background: selected?.id === f.id ? 'rgba(16,185,129,0.1)' : 'transparent',
                  border: 'none', cursor: 'pointer', transition: 'background 0.2s',
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                }}
              >
                <div style={{
                  width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
                  background: f.statut === 'Connecté' ? 'var(--emerald-400)' : 'var(--gold-400)',
                  boxShadow: f.statut === 'Connecté' ? '0 0 8px rgba(16,185,129,0.6)' : 'none',
                }} />
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)' }}>{f.nom}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{f.pop.toLocaleString()} habitants</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, color: 'var(--emerald-400)', fontSize: '0.9rem' }}>{f.actes}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>actes</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Fiche sélectionnée */}
        <div className="glass-card" style={{ padding: 24 }}>
          {selected ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                <div>
                  <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '1.2rem' }}>{selected.nom}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 3 }}>Commune {selected.commune}</div>
                </div>
                <span className={`badge ${selected.statut === 'Connecté' ? 'badge-green' : 'badge-orange'}`}>{selected.statut}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
                {[
                  { l: 'Population', v: selected.pop.toLocaleString() },
                  { l: 'Actes enregistrés', v: selected.actes },
                  { l: 'Latitude', v: selected.lat },
                  { l: 'Longitude', v: selected.lng },
                ].map(s => (
                  <div key={s.l} className="glass-card" style={{ padding: '14px 16px' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{s.l}</div>
                    <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '1.1rem' }}>{s.v}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn btn-glass" style={{ flex: 1, justifyContent: 'center' }}>📊 Stats</button>
                <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }}>👥 Citoyens</button>
              </div>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: '3rem', marginBottom: 12 }}>📍</div>
              <div style={{ fontWeight: 600 }}>Sélectionnez un Fokontany</div>
              <div style={{ fontSize: '0.8rem', marginTop: 4 }}>Cliquez sur un point ou dans la liste pour afficher les détails</div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
