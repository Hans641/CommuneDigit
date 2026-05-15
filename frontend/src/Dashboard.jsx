import { useEffect, useState } from 'react';
import api from './services/api';
import { UserPlus, Users, LayoutDashboard, Search, Database } from 'lucide-react';

function App() {
  const [citoyens, setCitoyens] = useState([]);
  const [formData, setFormData] = useState({ nom: '', prenom: '', fokontany: '' });

  useEffect(() => { refreshList(); }, []);

  const refreshList = () => {
    api.get('/citoyens')
      .then(res => setCitoyens(res.data))
      .catch(err => console.error("Erreur Registre:", err));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/citoyens', formData);
      setFormData({ nom: '', prenom: '', fokontany: '' });
      refreshList();
    } catch (err) { alert("Erreur d'enregistrement"); }
  };

  return (
    <div style={containerStyle}>
      {/* Barre de Navigation Supérieure */}
      <nav style={navStyle}>
        <div style={navContent}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Database size={28} color="#fff" />
            <span style={{ fontWeight: '800', fontSize: '1.2rem', letterSpacing: '1px' }}>MINISTÈRE DE L'INTÉRIEUR</span>
          </div>
          <div style={{ display: 'flex', gap: '20px' }}>
            <small>Session: Agent 001</small>
            <div style={badgeStyle}>Portail National</div>
          </div>
        </div>
      </nav>

      <main style={mainContent}>
        <header style={{ marginBottom: '40px' }}>
          <h1 style={titleStyle}>Digitalisation des Services Communaux</h1>
          <p style={subtitleStyle}>Système de gestion dématérialisée pour les Communes et Fokontany</p>
        </header>

        <div style={gridStyle}>
          {/* Section Saisie */}
          <section style={cardStyle}>
            <div style={cardHeader}>
              <UserPlus size={22} color="#2563eb" />
              <h2 style={cardTitle}>Nouvel Enregistrement</h2>
            </div>
            <form onSubmit={handleSubmit} style={formStyle}>
              <div style={inputGroup}>
                <label style={labelStyle}>Nom de famille</label>
                <input 
                  type="text" required value={formData.nom} 
                  onChange={e => setFormData({...formData, nom: e.target.value})}
                  style={inputStyle} placeholder="Ex: Ravelo"
                />
              </div>
              <div style={inputGroup}>
                <label style={labelStyle}>Prénom(s)</label>
                <input 
                  type="text" required value={formData.prenom} 
                  onChange={e => setFormData({...formData, prenom: e.target.value})}
                  style={inputStyle} placeholder="Ex: Jean"
                />
              </div>
              <div style={inputGroup}>
                <label style={labelStyle}>Fokontany de résidence</label>
                <input 
                  type="text" required value={formData.fokontany} 
                  onChange={e => setFormData({...formData, fokontany: e.target.value})}
                  style={inputStyle} placeholder="Ex: Sabotsy Namehana"
                />
              </div>
              <button type="submit" style={buttonStyle}>Valider l'inscription</button>
            </form>
          </section>

          {/* Section Liste */}
          <section style={cardStyle}>
            <div style={cardHeader}>
              <Users size={22} color="#059669" />
              <h2 style={cardTitle}>Registre National</h2>
            </div>
            <div style={{ marginBottom: '15px', position: 'relative' }}>
               <Search size={18} style={searchIcon} />
               <input type="text" placeholder="Rechercher un citoyen..." style={searchBar} />
            </div>
            <div style={listScroll}>
              {citoyens.length > 0 ? citoyens.map(c => (
                <div key={c.id} style={itemStyle}>
                  <div style={avatarStyle}>{c.nom[0]}</div>
                  <div style={{ flex: 1 }}>
                    <div style={itemName}>{c.nom} {c.prenom}</div>
                    <div style={itemSub}>{c.fokontany || 'Sans Fokontany'}</div>
                  </div>
                  <div style={statusBadge}>Actif</div>
                </div>
              )) : <p style={{ textAlign: 'center', color: '#94a3b8' }}>Aucun citoyen enregistré.</p>}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

// --- STYLES ---
const containerStyle = { minHeight: '100vh', backgroundColor: '#f1f5f9', fontFamily: "'Inter', sans-serif", color: '#1e293b' };
const navStyle = { backgroundColor: '#1e293b', color: 'white', padding: '15px 0', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' };
const navContent = { maxWidth: '1100px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 20px' };
const mainContent = { maxWidth: '1100px', margin: '0 auto', padding: '40px 20px' };
const titleStyle = { fontSize: '2.5rem', fontWeight: '800', marginBottom: '8px', color: '#0f172a' };
const subtitleStyle = { fontSize: '1.1rem', color: '#64748b', fontWeight: '400' };
const gridStyle = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '30px' };
const cardStyle = { backgroundColor: '#ffffff', borderRadius: '16px', padding: '30px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0' };
const cardHeader = { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '25px', borderBottom: '1px solid #f1f5f9', paddingBottom: '15px' };
const cardTitle = { fontSize: '1.25rem', fontWeight: '700', color: '#1e293b' };
const formStyle = { display: 'flex', flexDirection: 'column', gap: '20px' };
const inputGroup = { display: 'flex', flexDirection: 'column', gap: '8px' };
const labelStyle = { fontSize: '0.9rem', fontWeight: '600', color: '#475569' };
const inputStyle = { padding: '12px 16px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '1rem', transition: 'border 0.2s', outline: 'none' };
const buttonStyle = { marginTop: '10px', padding: '14px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '700', fontSize: '1rem', transition: 'background 0.2s' };
const listScroll = { maxHeight: '450px', overflowY: 'auto', paddingRight: '10px' };
const itemStyle = { display: 'flex', alignItems: 'center', gap: '15px', padding: '15px', borderRadius: '12px', marginBottom: '10px', backgroundColor: '#f8fafc', border: '1px solid #f1f5f9' };
const avatarStyle = { width: '40px', height: '40px', backgroundColor: '#e2e8f0', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: '#475569' };
const itemName = { fontWeight: '700', fontSize: '1rem', color: '#0f172a' };
const itemSub = { fontSize: '0.85rem', color: '#64748b' };
const statusBadge = { backgroundColor: '#dcfce7', color: '#166534', padding: '4px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '700' };
const badgeStyle = { backgroundColor: '#334155', padding: '4px 12px', borderRadius: '6px', fontSize: '0.8rem' };
const searchBar = { width: '100%', padding: '10px 10px 10px 40px', borderRadius: '8px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc' };
const searchIcon = { position: 'absolute', left: '12px', top: '11px', color: '#94a3b8' };

export default App;