import React, { useState, useEffect } from 'react';
import { rt_db } from '../firebase'; // Cambiamos a Realtime Database
import { ref, onValue, push, set, remove, update, query, orderByChild, equalTo, get } from 'firebase/database';
import { FaTrash, FaEye, FaPencilAlt } from 'react-icons/fa';

const ALL_PERMISSIONS = [
  { id: 'addProduct', label: 'Agregar Productos' },
  { id: 'editProduct', label: 'Editar Productos' },
  { id: 'deleteProduct', label: 'Borrar Productos' },
  { id: 'registerMovement', label: 'Registrar Movimiento' },
  { id: 'viewReports', label: 'Ver Reportes' },
  { id: 'editRole', label: 'Editar Roles y Permisos' },
  { id: 'viewUserManagement', label: 'Ver Administración de Usuarios' },
  { id: 'viewRoleManagement', label: 'Ver Administración de Roles' },
  { id: 'viewMovementHistory', label: 'Ver Historial de Movimientos' },
];

const RoleManagement = () => {
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [roleCounts, setRoleCounts] = useState({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingRole, setEditingRole] = useState(null); // Para saber si estamos editando
  const [viewingPermissions, setViewingPermissions] = useState(null); // Para ver permisos de un rol
  const [newRole, setNewRole] = useState({
    name: '',
    max_users: '',
    permissions: ALL_PERMISSIONS.reduce((acc, perm) => ({ ...acc, [perm.id]: false }), {})
  });

  useEffect(() => {
    // 1. Escuchar cambios en los roles
    const rolesRef = ref(rt_db, 'roles');
    const unsubscribeRoles = onValue(rolesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const rolesList = Object.keys(data).map(key => ({
          id: key,
          ...data[key]
        }));
        setRoles(rolesList);
      } else {
        setRoles([]);
      }
      setLoading(false);
    });

    // 2. Escuchar cambios en los usuarios para contar los roles
    const usersRef = ref(rt_db, 'users');
    const unsubscribeUsers = onValue(usersRef, (snapshot) => {
      const counts = {};
      const usersData = snapshot.val();
      if (usersData) {
        Object.values(usersData).forEach(user => {
          const userRole = user.rol;
        if (userRole) {
          counts[userRole] = (counts[userRole] || 0) + 1;
        }
      });
      }
      setRoleCounts(counts);
    });

    // Limpiar ambos listeners al desmontar el componente
    return () => {
      unsubscribeRoles();
      unsubscribeUsers();
    };
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewRole(prev => ({ ...prev, [name]: value }));
  };

  const handlePermissionChange = (e) => {
    const { name, checked } = e.target;
    setNewRole(prev => ({
      ...prev,
      permissions: { ...prev.permissions, [name]: checked }
    }));
  };

  const handleOpenEditModal = (role) => {
    setEditingRole(role);
    setNewRole({
      name: role.name,
      max_users: role.max_users,
      // Aseguramos que todos los permisos posibles estén en el estado, marcando los que ya tiene el rol
      permissions: { ...ALL_PERMISSIONS.reduce((acc, perm) => ({ ...acc, [perm.id]: false }), {}), ...role.permissions }
    });
    setIsModalOpen(true);
  };

  const handleOpenAddModal = () => {
    setEditingRole(null);
    setNewRole({ // Limpiar formulario para añadir uno nuevo
      name: '',
      max_users: '',
      permissions: ALL_PERMISSIONS.reduce((acc, perm) => ({ ...acc, [perm.id]: false }), {})
    });
    setIsModalOpen(true);
  };

  const handleSaveRole = async (e) => {
    e.preventDefault();
    if (!newRole.name.trim() || !newRole.max_users) {
      alert("Por favor, completa el nombre y la cantidad.");
      return;
    }
    setIsSaving(true);
    const dataToSave = {
      name: newRole.name.trim(),
      max_users: Number(newRole.max_users),
      permissions: newRole.permissions
    };

    try {
      if (editingRole) {
        // Actualizar rol existente en RTDB
        const roleRef = ref(rt_db, `roles/${editingRole.id}`);
        await update(roleRef, dataToSave);
        alert(`Rol "${dataToSave.name}" actualizado con éxito.`);
      } else {
        // Añadir nuevo rol en RTDB (con verificación de duplicados)
        const rolesRef = ref(rt_db, 'roles');
        const q = query(rolesRef, orderByChild('name'), equalTo(dataToSave.name));
        const snapshot = await get(q);
        if (snapshot.exists()) {
          alert(`El rol "${dataToSave.name}" ya existe.`);
          setIsSaving(false);
          return;
        }
        const newRoleRef = push(rolesRef);
        await set(newRoleRef, dataToSave);
        alert(`Rol "${dataToSave.name}" añadido con éxito.`);
      }
      setIsModalOpen(false); // Cerrar modal al guardar
    } catch (error) {
      console.error("Error al guardar el rol: ", error);
      alert("Ocurrió un error al guardar el rol.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteRole = async (roleId, roleName) => {
    if (window.confirm(`¿Estás seguro de que quieres eliminar el rol "${roleName}"?`)) {
      try {
        const roleRef = ref(rt_db, `roles/${roleId}`);
        await remove(roleRef);
        alert(`Rol "${roleName}" eliminado con éxito.`);
      } catch (error) {
        console.error("Error al eliminar el rol: ", error);
        alert("Ocurrió un error al eliminar el rol.");
      }
    }
  };

  return (
    <div className="config-section">
      <h3>Administración de Roles</h3>
      <div className="section-header">
        <p>Define los roles y los permisos de acceso para los usuarios.</p>
        <button onClick={handleOpenAddModal} className="footer-btn save-btn">Añadir Rol</button>
      </div>

      {loading ? <p>Cargando roles...</p> : (
        <div className="table-responsive-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Nombre del Rol</th>
                <th>Permisos</th>
                <th>Usuarios</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {roles.map(role => {
                const maxUsers = role.name === 'Soporte Técnico' ? 1 : (role.max_users ?? '∞');
                return (
                  <tr key={role.id}>
                    <td data-label="Rol">{role.name}</td>
                    <td className="actions-cell">
                      <button onClick={() => setViewingPermissions(role)} className="icon-btn view-btn">
                        <FaEye />
                      </button>
                    </td>
                    <td data-label="Usuarios">{roleCounts[role.name] || 0} / {maxUsers}</td>
                    <td className="actions-cell">
                      <button onClick={() => handleOpenEditModal(role)} className="icon-btn edit-btn">
                        <FaPencilAlt />
                      </button>
                      <button onClick={() => handleDeleteRole(role.id, role.name)} className="icon-btn delete-btn" disabled={roleCounts[role.name] > 0 || role.name === 'Soporte Técnico'}><FaTrash /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3 className="modal-title">{editingRole ? 'Editar Rol' : 'Añadir Nuevo Rol'}</h3>
            <form onSubmit={handleSaveRole} className="modal-form" noValidate>
              <div className="form-row">
                <div className="form-group">
                  <label>Nombre del Rol</label>
                  <input type="text" name="name" value={newRole.name} onChange={handleInputChange} placeholder="Ej: Cocinero" required disabled={editingRole?.name === 'Soporte Técnico'} />
                </div>
                <div className="form-group">
                  <label>Máximo de Usuarios</label>
                  <input type="number" name="max_users" value={newRole.max_users} onChange={handleInputChange} placeholder="Ej: 5" min="1" required />
                </div>
              </div>
              <div className="permissions-grid">
                <h4>Permisos del Rol</h4>
                {ALL_PERMISSIONS.map(perm => (
                  <div key={perm.id} className="permission-checkbox">
                    <input
                      type="checkbox"
                      id={perm.id}
                      name={perm.id}
                      checked={newRole.permissions[perm.id] || false}
                      onChange={handlePermissionChange}
                      disabled={editingRole?.name === 'Soporte Técnico'}
                    />
                    <label htmlFor={perm.id}>{perm.label}</label>
                  </div>
                ))}
              </div>
              <div className="modal-actions">
                <button type="button" onClick={() => setIsModalOpen(false)} className="modal-button-cancel" disabled={isSaving}>
                  Cancelar
                </button>
                <button type="submit" className="modal-button-confirm" disabled={isSaving}>
                  {isSaving ? 'Guardando...' : 'Guardar Rol'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {viewingPermissions && (
        <div className="modal-overlay" onClick={() => setViewingPermissions(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Permisos para: {viewingPermissions.name}</h3>
            <ul className="permissions-view-list">
              {ALL_PERMISSIONS.map(perm => (
                <li key={perm.id} className={viewingPermissions.permissions?.[perm.id] ? 'permission-enabled' : 'permission-disabled'}>
                  {perm.label}
                </li>
              ))}
            </ul>
            <div className="modal-actions">
              <button onClick={() => setViewingPermissions(null)} className="modal-button-confirm">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RoleManagement;