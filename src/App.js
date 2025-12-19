import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './Components/Login';
import Register from './Components/Register';
import Dashboard from './Components/Dashboard';
import './App.css';

// Este componente decide qué mostrar basado en el estado de autenticación.
// Debe estar dentro de AuthProvider para que useAuth() funcione.
function AppContent() {
  const { user, loading } = useAuth();
  const [showRegister, setShowRegister] = useState(false);

  if (loading) {
    // Muestra un loader mientras se verifica el estado de autenticación
    return <div style={{ color: 'white', textAlign: 'center', fontSize: '2rem', paddingTop: '5rem' }}>Cargando...</div>;
  }

  // Si hay un usuario, muestra el Dashboard
  if (user) {
    return <Dashboard />;
  }

  // Si no, muestra Login o Register
  return showRegister ? (
    <Register onSwitchToLogin={() => setShowRegister(false)} />
  ) : (
    <Login onSwitchToRegister={() => setShowRegister(true)} />
  );
}

// El componente principal de la App
function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;