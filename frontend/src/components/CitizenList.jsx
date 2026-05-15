import React, { useState, useEffect } from 'react';
import axios from 'axios';

const CitizenList = () => {
  const [citizens, setCitizens] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCitizens();
  }, []);

  const fetchCitizens = async () => {
    try {
      const res = await axios.get('http://127.0.0.1:8000/citizens/');
      setCitizens(res.data);
    } catch (err) {
      console.error("Erreur de chargement", err);
    } finally {
      setLoading(false);
    }
  };

  const deleteCitizen = async (id) => {
    if (window.confirm("Voulez-vous vraiment supprimer cette inscription ?")) {
      try {
        await axios.delete(`http://127.0.0.1:8000/citizens/${id}`);
        setCitizens(citizens.filter(c => c.id !== id));
      } catch (err) {
        alert("Erreur lors de la suppression.");
      }
    }
  };

  const filteredCitizens = citizens.filter(c => {
    const search = searchTerm.toLowerCase();
    return (
      (c.last_name || '').toLowerCase().includes(search) ||
      (c.first_name || '').toLowerCase().includes(search) ||
      (c.address || '').toLowerCase().includes(search)
    );
  });

  if (loading) return <p>Chargement des données...</p>;

  return (
    <div className="citizen-list-container">
      <div className="table-header-actions">
        <input 
          type="text" 
          placeholder="Rechercher un citoyen..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-bar"
        />
      </div>

      <table className="admin-table">
        <thead>
          <tr>
            <th>Nom</th>
            <th>Prénom</th>
            <th>Quartier</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filteredCitizens.map(c => (
            <tr key={c.id}>
              <td>{c.last_name}</td>
              <td>{c.first_name}</td>
              <td>{c.address}</td>
              <td>
                <button onClick={() => deleteCitizen(c.id)} className="delete-btn">
                  Supprimer
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default CitizenList;