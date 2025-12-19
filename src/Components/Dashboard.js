import React, { useState, useEffect } from 'react';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';
import './Dashboard.css'; // Importamos los nuevos estilos
import { useAuth } from '../context/AuthContext';
import logo from '../assets/Fto Al Aire Rooftop.jpg'; // Reutilizamos el logo

// Importamos los componentes de cada sección
import Inventario from './Inventario';
import Reporte from './Reporte';
import Configuracion from './Configuracion';

const Dashboard = () => {
  const { userProfile } = useAuth();
  const [activeView, setActiveView] = useState('Inventario'); // Estado para la vista activa

  const handleLogout = () => {
    signOut(auth).catch(error => console.error("Error al cerrar sesión:", error));
  }

  // Lógica para determinar la visibilidad de las pestañas de navegación
  const canViewConfiguracion = userProfile?.rol === 'Soporte Técnico';

  // Si la vista activa es 'Configuración' pero el usuario ya no tiene permiso, se cambia a 'Inventario'.
  useEffect(() => {
    if (activeView === 'Configuración' && !canViewConfiguracion) {
      setActiveView('Inventario');
    }
  }, [activeView, canViewConfiguracion]);

  return (
    <>
      <header className="dashboard-header">
        <div className="header-logo-section">
          <img src={logo} alt="Logo" className="header-logo" />
          <span className="header-title">Al Aire Rooftop</span>
        </div>
        <div className="header-user-section">
          <span className="welcome-message">Bienvenido, {userProfile?.nombre || 'Usuario'}</span>
          <button onClick={handleLogout} className="logout-button">Cerrar Sesión</button>
        </div>
      </header>
      <nav className="dashboard-nav">
        <div 
          className={`nav-option ${activeView === 'Inventario' ? 'nav-option-active' : ''}`}
          onClick={() => setActiveView('Inventario')}>
            Inventario
        </div>
        <div 
          className={`nav-option ${activeView === 'Reporte' ? 'nav-option-active' : ''}`}
          onClick={() => setActiveView('Reporte')}>
            Reporte
        </div>
        {canViewConfiguracion && <div 
          className={`nav-option ${activeView === 'Configuración' ? 'nav-option-active' : ''}`}
          onClick={() => setActiveView('Configuración')}>
            Configuración
        </div>}
      </nav>
      <main className="dashboard-body">
        {activeView === 'Inventario' && <Inventario userData={userProfile} />}
        {activeView === 'Reporte' && <Reporte />}
        {activeView === 'Configuración' && <Configuracion userData={userProfile} />}
      </main>
      <footer className="dashboard-footer">
        <p>&copy; {new Date().getFullYear()} Al Aire Rooftop | Contacto: (123) 456-7890 | info@alairerooftop.com</p>
      </footer>
    </>
  );
};

export default Dashboard;