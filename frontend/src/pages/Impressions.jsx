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


const TEMPLATES = [
  {
    id: 'acte-naissance', label: 'Acte de naissance', icon: '👶', categorie: 'État civil',
    champs: ['Nom', 'Prénom', 'Date de naissance', 'Lieu de naissance', 'Père', 'Mère', 'Fokontany'],
  },
  {
    id: 'acte-mariage', label: 'Acte de mariage', icon: '💍', categorie: 'État civil',
    champs: ['Époux (Nom, Prénom)', 'Épouse (Nom, Prénom)', 'Date de mariage', 'Lieu'],
  },
  {
    id: 'cert-residence', label: 'Certificat de résidence', icon: '🏠', categorie: 'Certificat',
    champs: ['Nom', 'Prénom', 'Adresse', 'Fokontany', 'Durée de résidence', 'Motif'],
  },
  {
    id: 'cert-heritage', label: "Certificat d'héritage", icon: '⚖️', categorie: 'Certificat',
    champs: ['Défunt (Nom)', 'Héritier(s)', 'Biens concernés', 'Date de décès'],
  },
  {
    id: 'recu-paiement', label: 'Reçu de paiement', icon: '🧾', categorie: 'Finance',
    champs: ['Nom citoyen', 'Montant (Ar)', 'Type de taxe', 'Référence transaction'],
  },
  {
    id: 'convocation', label: 'Convocation officielle', icon: '📨', categorie: 'Admin',
    champs: ['Destinataire', 'Objet', 'Date & heure', 'Lieu', 'Motif'],
  },
];

export default function Impressions() {  const { lang } = useApp();
  const t = LANG[lang] || LANG.fr;
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [filterCat, setFilterCat] = useState('Tous');
  const [formData, setFormData] = useState({});
  const [previewing, setPreviewing] = useState(false);
  const [printed, setPrinted] = useState(false);

  const cats = ['Tous', ...new Set(TEMPLATES.map(t => t.categorie))];
  const filtered = TEMPLATES.filter(t => filterCat === 'Tous' || t.categorie === filterCat);

  const handlePrint = (e) => {
    e.preventDefault();
    setPreviewing(true);
  };

  const confirmPrint = () => {
    setPrinted(true);
    setTimeout(() => {
      setPrinted(false);
      setPreviewing(false);
      setSelectedTemplate(null);
      setFormData({});
    }, 2200);
  };

  const today = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div className="breadcrumb">🖨️ <span>/</span> {lang === 'mg' ? 'Fiprintan-taratasy' : 'Impressions'}</div>
          <h1 className="page-title">Documents & {lang === 'mg' ? 'Fiprintan-taratasy' : 'Impressions'}</h1>
          <p className="page-subtitle">Génération et impression des actes officiels, certificats et reçus</p>
        </div>
      </div>

      {/* Filtres catégorie */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        {cats.map(c => (
          <button key={c} className={`chip ${filterCat === c ? 'active' : ''}`} onClick={() => setFilterCat(c)}>{c}</button>
        ))}
      </div>

      {/* Grille templates */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16, marginBottom: 28 }}>
        {filtered.map(t => (
          <button
            key={t.id}
            className="glass-card"
            style={{ padding: 24, text: 'left', border: selectedTemplate?.id === t.id ? '1px solid var(--emerald-500)' : undefined, cursor: 'pointer', transition: 'all 0.2s', textAlign: 'left', background: selectedTemplate?.id === t.id ? 'rgba(16,185,129,0.1)' : undefined }}
            onClick={() => { setSelectedTemplate(t); setFormData({}); setPreviewing(false); }}
            onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-3px)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <div style={{ fontSize: '2rem', marginBottom: 12, color: 'var(--text-primary)' }}>{t.icon}</div>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 4, color: 'var(--text-primary)' }}>{t.label}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{t.champs.length} champs requis</div>
            <div style={{ marginTop: 10 }}>
              <span className="badge badge-blue" style={{ fontSize: '0.65rem' }}>{t.categorie}</span>
            </div>
          </button>
        ))}
      </div>

      {/* Formulaire + Aperçu */}
      {selectedTemplate && (
        <div className="grid-2" style={{ alignItems: 'start' }}>
          {/* Formulaire */}
          <div className="glass-card" style={{ padding: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
              <span style={{ fontSize: '1.6rem' }}>{selectedTemplate.icon}</span>
              <div>
                <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '1rem', color: 'var(--text-primary)' }}>{selectedTemplate.label}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>Remplissez les informations du document</div>
              </div>
            </div>
            <form onSubmit={handlePrint}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 24 }}>
                {selectedTemplate.champs.map(champ => (
                  <div key={champ} className="form-group">
                    <label className="form-label">{champ} *</label>
                    <input
                      className="form-input"
                      value={formData[champ] || ''}
                      onChange={e => setFormData({ ...formData, [champ]: e.target.value })}
                      placeholder={`Ex: ${champ}...`}
                      required
                    />
                  </div>
                ))}
              </div>
              <div className="alert alert-info" style={{ marginBottom: 16 }}>
                <span>🖊️</span>
                <div style={{ fontSize: '0.78rem' }}>Le document sera généré avec la signature et le cachet officiel de votre commune. Un numéro de registre unique sera attribué.</div>
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                👁 Prévisualiser le document
              </button>
            </form>
          </div>

          {/* Aperçu document */}
          <div className="glass-card" style={{ padding: 28 }}>
            <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '1rem', marginBottom: 20 }}>
              {previewing ? '📄 Aperçu du document' : '📄 Aperçu'}
            </div>

            {!previewing ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
                <div style={{ fontSize: '3rem', marginBottom: 12 }}>📄</div>
                <div style={{ fontWeight: 600 }}>Remplissez le formulaire</div>
                <div style={{ fontSize: '0.8rem', marginTop: 4 }}>L'aperçu apparaîtra ici</div>
              </div>
            ) : printed ? (
              <div className="alert alert-success" style={{ flexDirection: 'column', textAlign: 'center', padding: 40 }}>
                <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🖨️</div>
                <div style={{ fontWeight: 700, fontSize: '1rem' }}>Document envoyé à l'impression</div>
                <div style={{ fontSize: '0.8rem', opacity: 0.7, marginTop: 6 }}>Numéro registre : REG-{Math.floor(Math.random()*9000)+1000} · Enregistré dans l'audit log</div>
              </div>
            ) : (
              <>
                {/* Document simulé */}
                <div style={{
                  background: 'rgba(255,255,255,0.96)',
                  borderRadius: 8, padding: '28px 24px',
                  color: '#1e293b', fontFamily: 'serif',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                  fontSize: '0.82rem', lineHeight: 1.7,
                }}>
                  {/* En-tête */}
                  <div style={{ textAlign: 'center', borderBottom: '2px solid #1e293b', paddingBottom: 14, marginBottom: 14 }}>
                    <div style={{ fontWeight: 900, fontSize: '0.7rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#064e3b' }}>
                      République de Madagascar
                    </div>
                    <div style={{ fontWeight: 700, fontSize: '0.75rem', marginTop: 2 }}>Commune Urbaine d'Antananarivo</div>
                    <div style={{ fontSize: '0.68rem', color: '#475569', marginTop: 1 }}>Fokontany — Digitalisation des Services</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 900, marginTop: 10, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#064e3b' }}>
                      {selectedTemplate.label}
                    </div>
                    <div style={{ fontSize: '0.65rem', color: '#64748b', marginTop: 2 }}>
                      N° Registre : REG-{Math.floor(Math.random()*9000)+1000}
                    </div>
                  </div>

                  {/* Corps */}
                  <div style={{ marginBottom: 16 }}>
                    {selectedTemplate.champs.map(champ => (
                      <div key={champ} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                        <span style={{ fontWeight: 700, minWidth: 140, fontSize: '0.75rem', color: '#374151' }}>{champ} :</span>
                        <span style={{ color: '#1e293b', fontSize: '0.8rem' }}>
                          {formData[champ] || <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>Non renseigné</span>}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Pied */}
                  <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 12, marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                    <div style={{ fontSize: '0.68rem', color: '#64748b' }}>
                      Fait à Antananarivo<br />Le {today}
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ width: 60, height: 60, border: '2px solid #064e3b', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto', fontSize: '0.55rem', fontWeight: 700, color: '#064e3b', textAlign: 'center', lineHeight: 1.2 }}>
                        CACHET<br />OFFICIEL
                      </div>
                      <div style={{ fontSize: '0.65rem', color: '#64748b', marginTop: 4 }}>L'Agent habilité</div>
                    </div>
                    <div style={{ fontSize: '0.68rem', color: '#64748b', textAlign: 'right' }}>
                      CommuneDigit v1.0<br />
                      <span style={{ fontFamily: 'monospace', fontSize: '0.6rem', color: '#10b981' }}>✓ SHA-256 vérifié</span>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                  <button className="btn btn-glass" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setPreviewing(false)}>
                    ✏️ Modifier
                  </button>
                  <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={confirmPrint}>
                    🖨️ {lang === 'mg' ? 'Printy' : 'Imprimer'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
