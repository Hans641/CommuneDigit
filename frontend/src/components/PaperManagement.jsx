import React, { useState, useEffect } from 'react';

const PaperManagement = () => {
  const [papers, setPapers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchPapers();
  }, []);

  const fetchPapers = async () => {
    try {
      const response = await fetch('http://127.0.0.1:8000/papers/');
      if (response.ok) {
        const data = await response.json();
        setPapers(data);
      }
    } catch (error) {
      console.error("Erreur réseau :", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) return <div style={{ textAlign: 'center', padding: '50px', color: '#64748b', fontWeight: 'bold' }}>Chargement des données...</div>;

  return (
    <div style={{ 
      width: '100%', 
      maxWidth: '850px', 
      margin: '20px auto', 
      backgroundColor: 'white', 
      borderRadius: '12px', 
      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
      border: '1px solid #e2e8f0',
      overflow: 'hidden',
      textAlign: 'left'
    }}>
      
      {/* HEADER */}
      <div style={{ padding: '24px 40px', borderBottom: '2px solid #f8fafc' }}>
        <h3 style={{ margin: 0, fontSize: '22px', fontWeight: '900', color: '#0f172a', letterSpacing: '-0.025em' }}>
          Catalogue des prestations
        </h3>
        <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: '#64748b' }}>
          Consultation des tarifs officiels en vigueur
        </p>
      </div>

      {/* TABLEAU */}
      <div style={{ width: '100%', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ backgroundColor: '#f1f5f9' }}>
              <th style={{ padding: '14px 40px', fontSize: '11px', fontWeight: '800', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Catégorie</th>
              <th style={{ padding: '14px 40px', fontSize: '11px', fontWeight: '800', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Type de document</th>
              <th style={{ padding: '14px 40px', fontSize: '11px', fontWeight: '800', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.1em', textAlign: 'right' }}>Tarif Unitaire</th>
            </tr>
          </thead>
          <tbody>
            {papers.map((paper) => (
              <tr key={paper.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '18px 40px' }}>
                  <span style={{ padding: '4px 10px', borderRadius: '4px', backgroundColor: '#e2e8f0', color: '#475569', fontSize: '10px', fontWeight: '800', textTransform: 'uppercase' }}>
                    {paper.category}
                  </span>
                </td>
                <td style={{ padding: '18px 40px', fontSize: '15px', fontWeight: '600', color: '#1e293b' }}>
                  {paper.name}
                </td>
                <td style={{ padding: '18px 40px', textAlign: 'right' }}>
                  <span style={{ fontSize: '18px', fontWeight: '900', color: '#1d4ed8' }}>
                    {Number(paper.price).toLocaleString()}
                  </span>
                  {/* "Ar" rendu plus visible */}
                  <span style={{ 
                    fontSize: '13px', 
                    fontWeight: '800', 
                    color: '#1d4ed8', 
                    marginLeft: '6px',
                    padding: '2px 4px',
                    backgroundColor: '#eff6ff',
                    borderRadius: '4px'
                  }}>
                    Ar
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* NOTE DE CONFORMITÉ VISIBLE */}
      <div style={{ 
        margin: '20px 40px 30px 40px', 
        padding: '16px 20px', 
        backgroundColor: '#f0f9ff', 
        borderRadius: '8px', 
        borderLeft: '4px solid #3b82f6',
        display: 'flex',
        alignItems: 'center',
        gap: '12px'
      }}>
        <span style={{ fontSize: '20px' }}>ℹ️</span>
        <p style={{ margin: 0, fontSize: '13px', color: '#0369a1', lineHeight: '1.5' }}>
          <strong style={{ color: '#0c4a6e', textTransform: 'uppercase', fontSize: '11px' }}>Note de conformité :</strong><br />
          Ces montants sont fixés en interne par la commune. Toute modification nécessite un accès administrateur système.
        </p>
      </div>
    </div>
  );
};

export default PaperManagement;