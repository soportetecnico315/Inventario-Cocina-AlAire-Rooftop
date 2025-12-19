import React from 'react';
import './Configuracion.css';
import ProfileEditor from './ProfileEditor';
import UserManagement from './UserManagement';
import RoleManagement from './RoleManagement';
import MovementHistory from './MovementHistory';

const Configuracion = ({ userData }) => {
  // La visibilidad de las secciones de administración ahora depende únicamente del rol.
  const canManageUsers = userData?.rol === 'Soporte Técnico';
  const canManageRoles = userData?.rol === 'Soporte Técnico';
  const canViewMovementHistory = userData?.rol === 'Soporte Técnico';

  return (
    <div className="config-container">
      <h2 className="config-title">Configuración General</h2>
      <ProfileEditor userData={userData} />

      {canManageUsers && <UserManagement />}
      {canManageRoles && <RoleManagement />}
      {canViewMovementHistory && <MovementHistory />}
    </div>
  );
};

export default Configuracion;