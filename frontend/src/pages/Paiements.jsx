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


const TRANSACTIONS = [
  { id: 'TXN-001', citoyen: 'Rakoto Jean',    type: 'Taxe locale',     montant: 25000, statut: 'Confirmé',  date: '2026-05-03', ref: 'IDEM-a9f3' },
  { id: 'TXN-002', citoyen: 'Rasoa Marie',    type: 'Amende',          montant: 10000, statut: 'Confirmé',  date: '2026-05-01', ref: 'IDEM-b2c1' },
  { id: 'TXN-003', citoyen: 'Rabe Paul',      type: 'Redevance',       montant: 5000,  statut: 'En attente',date: '2026-04-30', ref: 'IDEM-c5d8' },
  { id: 'TXN-004', citoyen: 'Ravelo Soa',     type: 'Taxe locale',     montant: 25000, statut: 'Confirmé',  date: '2026-04-28', ref: 'IDEM-d4e2' },
  { id: 'TXN-005', citoyen: 'Andrianina',     type: 'Certificat',      montant: 2000,  statut: 'Confirmé',  date: '2026-04-26', ref: 'IDEM-e7f0' },
];

const TARIFS = [
  { categorie: 'État civil', nom: 'Acte de naissance', prix: 0 },
  { categorie: 'État civil', nom: 'Acte de mariage', prix: 0 },
  { categorie: 'Certificat', nom: 'Certificat de résidence', prix: 2000 },
  { categorie: 'Certificat', nom: "Certificat d'héritage", prix: 5000 },
  { categorie: 'Taxe', nom: 'Taxe locale annuelle', prix: 25000 },
  { categorie: 'Amende', nom: 'Amende voirie', prix: 10000 },
  { categorie: 'Redevance', nom: 'Redevance marché', prix: 5000 },
  { categorie: 'Permis', nom: 'Permis de construction', prix: 50000 },
];

export default function PaiementsPage() {  const { lang } = useApp();
  const t = LANG[lang] || LANG.fr;
  const [activeTab, setActiveTab] = useState('transactions');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ citoyen: '', type: 'Taxe locale', montant: '' });
  const [saved, setSaved] = useState(false);

  const total = TRANSACTIONS.filter(t => t.statut === 'Confirmé').reduce((s, t) => s + t.montant, 0);

  const handleSave = (e) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => { setSaved(false); setShowModal(false); }, 1800);
  };

  return (
    <>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div className="breadcrumb">💳 <span>/</span> {lang === 'mg' ? 'Fandoavana' : 'Paiements'}</div>
          <h1 className="page-title">{lang === 'mg' ? 'Fandoavana' : 'Paiements'} & Transactions</h1>
          <p className="page-subtitle">Taxes, amendes, redevances — avec idempotence ACID</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Encaisser paiement</button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 24 }}>
        {[
          { l: 'Total encaissé', v: `${total.toLocaleString()} Ar`, color: 'var(--emerald-400)', icon: '💰' },
          { l: 'Confirmées', v: TRANSACTIONS.filter(t => t.statut === 'Confirmé').length, color: 'var(--text-primary)', icon: '✅' },
          { l: 'En attente', v: TRANSACTIONS.filter(t => t.statut === 'En attente').length, color: 'var(--gold-400)', icon: '⏳' },
          { l: 'Ce mois', v: TRANSACTIONS.length, color: 'var(--text-primary)', icon: '📅' },
        ].map(s => (
          <div key={s.l} className="glass-card" style={{ padding: '20px 24px' }}>
            <div style={{ fontSize: '1.3rem', marginBottom: 6 }}>{s.icon}</div>
            <div style={{ fontFamily: 'Syne, sans-serif', fontSize: '1.5rem', fontWeight: 800, color: s.color }}>{s.v}</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 3 }}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="tabs" style={{ marginBottom: 20, display: 'inline-flex' }}>
        <button className={`tab-btn ${activeTab === 'transactions' ? 'active' : ''}`} onClick={() => setActiveTab('transactions')}>💳 Transactions</button>
        <button className={`tab-btn ${activeTab === 'tarifs' ? 'active' : ''}`} onClick={() => setActiveTab('tarifs')}>📋 Catalogue tarifs</button>
      </div>

      {activeTab === 'transactions' ? (
        <div className="glass-card" style={{ overflow: 'hidden' }}>
          <div className="glass-table-wrap">
            <table className="glass-table">
              <thead><tr><th>ID</th><th>Citoyen</th><th>Type</th><th>Montant</th><th>Statut</th><th>Date</th><th>Idempotence</th></tr></thead>
              <tbody>
                {TRANSACTIONS.map(t => (
                  <tr key={t.id}>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: 'var(--text-muted)' }}>{t.id}</td>
                    <td style={{ fontWeight: 600 }}>{t.citoyen}</td>
                    <td><span className="badge badge-blue">{t.type}</span></td>
                    <td style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, color: 'var(--emerald-400)' }}>{t.montant.toLocaleString()} Ar</td>
                    <td><span className={`badge ${t.statut === 'Confirmé' ? 'badge-green' : 'badge-gold'}`}>{t.statut}</span></td>
                    <td style={{ fontSize: '0.83rem', color: 'var(--text-secondary)' }}>{t.date}</td>
                    <td><span style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: 'var(--text-muted)' }}>{t.ref}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="glass-card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--glass-border)' }}>
            <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '1rem' }}>Catalogue des prestations</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>Tarifs officiels en vigueur — fixés par la commune</div>
          </div>
          <div className="glass-table-wrap">
            <table className="glass-table">
              <thead><tr><th>Catégorie</th><th>Prestation</th><th style={{ textAlign: 'right' }}>Tarif</th></tr></thead>
              <tbody>
                {TARIFS.map((t, i) => (
                  <tr key={i}>
                    <td><span className="badge badge-gray">{t.categorie}</span></td>
                    <td style={{ fontWeight: 600 }}>{t.nom}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'Syne, sans-serif', fontWeight: 700, color: t.prix === 0 ? 'var(--emerald-400)' : '#fff' }}>
                      {t.prix === 0 ? 'Gratuit' : `${t.prix.toLocaleString()} Ar`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="alert alert-info" style={{ margin: 20 }}>
            <span>ℹ️</span>
            <div style={{ fontSize: '0.8rem' }}>Ces montants sont fixés en interne par la commune. Toute modification nécessite un accès administrateur.</div>
          </div>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">💳 Encaisser un paiement</div>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            {saved ? (
              <div className="alert alert-success" style={{ textAlign: 'center', flexDirection: 'column', padding: 32 }}>
                <div style={{ fontSize: '2rem', marginBottom: 10 }}>✅</div>
                <div style={{ fontWeight: 700 }}>Paiement enregistré</div>
                <div style={{ fontSize: '0.8rem', opacity: 0.7, marginTop: 4 }}>Clé d'idempotence générée · Transaction ACID</div>
              </div>
            ) : (
              <form onSubmit={handleSave}>
                <div className="form-group" style={{ marginBottom: 16 }}>
                  <label className="form-label">Citoyen *</label>
                  <input className="form-input" value={form.citoyen} onChange={e => setForm({...form, citoyen: e.target.value})} required />
                </div>
                <div className="form-group" style={{ marginBottom: 16 }}>
                  <label className="form-label">Type de paiement *</label>
                  <select className="form-select" value={form.type} onChange={e => setForm({...form, type: e.target.value})}>
                    {TARIFS.map(t => <option key={t.nom}>{t.nom}</option>)}
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: 24 }}>
                  <label className="form-label">Montant (Ar) *</label>
                  <input className="form-input" type="number" value={form.montant} onChange={e => setForm({...form, montant: e.target.value})} required />
                </div>
                <div className="alert alert-info" style={{ marginBottom: 20 }}>
                  <span>🔒</span>
                  <div style={{ fontSize: '0.78rem' }}>Une clé d'idempotence unique sera générée pour éviter les doublons. Transaction ACID PostgreSQL.</div>
                </div>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <button type="button" className="btn btn-glass" onClick={() => setShowModal(false)}>{t.annuler}</button>
                  <button type="submit" className="btn btn-primary">Valider le paiement →</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
