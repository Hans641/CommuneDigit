import React, { useState, useEffect } from 'react';
import { citoyenEspaceAPI, citoyenAuthAPI } from '../services/api';

export default function Register() {
  const [fokontanyList, setFokontanyList] = useState([]);
  const [loadingFokontany, setLoadingFokontany] = useState(true);
  const [errorFokontany, setErrorFokontany] = useState(null);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    nom: '',
    prenom: '',
    telephone: '',
    cin: '',
    fokontany_id: '', // Pour stocker l'ID sélectionné
    adresse: '',
  });

  useEffect(() => {
    const fetchFokontany = async () => {
      try {
        const data = await citoyenEspaceAPI.fokontany();
        console.log('Fokontany récupérés:', data);
        setFokontanyList(data);
      } catch (error) {
        console.error('Erreur lors du chargement des fokontany:', error);
        setErrorFokontany('Impossible de charger la liste des fokontany.');
      } finally {
        setLoadingFokontany(false);
      }
    };

    fetchFokontany();
  }, []); // Le tableau vide assure que l'effet ne s'exécute qu'une fois au montage

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      console.log('Données d'inscription:', formData);
      await citoyenAuthAPI.inscription(formData);
      alert('Inscription réussie !');
    } catch (error) {
      console.error('Erreur d\'inscription:', error);
      alert(`Erreur: ${error.message}`);
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <h2>Créer mon compte citoyen</h2>
        <form onSubmit={handleSubmit}>
          {/* ... autres champs du formulaire (email, password, nom, prenom, etc.) ... */}

          <div className="input-group">
            <label htmlFor="fokontany_id">Sélectionner votre Fokontany</label>
            <select
              id="fokontany_id"
              name="fokontany_id"
              value={formData.fokontany_id}
              onChange={handleChange}
              disabled={loadingFokontany || errorFokontany}
            >
              <option value="">{loadingFokontany ? "Chargement..." : "Sélectionnez un Fokontany"}</option>
              {errorFokontany && <option value="" disabled>{errorFokontany}</option>}
              {fokontanyList.map((fokontany) => (
                <option key={fokontany.id} value={fokontany.id}>
                  {fokontany.nom}
                </option>
              ))}
            </select>
          </div>

          <button type="submit" className="submit-btn">S'inscrire</button>
        </form>
      </div>
    </div>
  );
}
