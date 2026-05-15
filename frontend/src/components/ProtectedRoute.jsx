import React from 'react';
import { Navigate } from 'react-router-dom';

const ProtectedRoute = ({ children }) => {
  // On vérifie si l'utilisateur est authentifié (via le localStorage)
  const isAuthenticated = localStorage.getItem('isAuthenticated') === 'true';

  if (!isAuthenticated) {
    // Si non connecté, redirection forcée vers la page de login
    return <Navigate to="/login" replace />;
  }

  // Si connecté, on affiche le composant demandé (ex: Admin)
  return children;
};

export default ProtectedRoute;