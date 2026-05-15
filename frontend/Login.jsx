import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');

    try {
      // Appel à la nouvelle route du backend
          const response = await axios.post('[http://127.0.0.1:8000/login](http://127.0.0.1:8000/login)', {
            username: username.trim(),
            password: password.trim()
          });

      if (response.data.message === "Connexion réussie") {
        // Stockage d'une petite info de session (optionnel pour l'instant)
        localStorage.setItem('isAuthenticated', 'true');
        // Redirection vers l'espace administration
        navigate('/admin');
      }
    } catch (err) {
      // Gestion des erreurs (401 Unauthorized, etc.)
      if (err.response && err.response.status === 401) {
        setError('Identifiants incorrects. Veuillez réessayer.');
      } else {
        setError('Erreur de connexion au serveur.');
      }
    }
  };

  return (
    <div style={{ maxWidth: '400px', margin: '100px auto', padding: '20px', border: '1px solid #ccc', borderRadius: '8px' }}>
      <h2>Connexion - Lovan’ny Tanàna</h2>
      <form onSubmit={handleLogin}>
        <div style={{ marginBottom: '15px' }}>
          <label>Utilisateur :</label>
          <input 
            type="text" 
            value={username} 
            onChange={(e) => setUsername(e.target.value)} 
            style={{ width: '100%', padding: '8px', marginTop: '5px' }}
            required
          />
        </div>
        <div style={{ marginBottom: '15px' }}>
          <label>Mot de passe :</label>
          <input 
            type="password" 
            value={password} 
            onChange={(e) => setPassword(e.target.value)} 
            style={{ width: '100%', padding: '8px', marginTop: '5px' }}
            required
          />
        </div>
        {error && <p style={{ color: 'red', fontSize: '0.9em' }}>{error}</p>}
        <button type="submit" style={{ width: '100%', padding: '10px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
          Se connecter
        </button>
      </form>
    </div>
  );
};

export default Login;