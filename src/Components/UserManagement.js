import React, { useState, useEffect } from 'react';
import { rt_db } from '../firebase'; // Cambiamos a Realtime Database
import { ref, onValue, update } from 'firebase/database';
import { FaPencilAlt, FaTrash } from 'react-icons/fa';

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  // Nuevo estado para manejar los datos del formulario de edición
  const [formData, setFormData] = useState({
    nombre: '',
    apellidos: '',
    celular: '',
    rol: ''
  });

  // Cargar usuarios y roles
  useEffect(() => {
    const usersRef = ref(rt_db, 'users');
    const unsubscribeUsers = onValue(usersRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const usersList = Object.keys(data).map(key => ({ id: key, ...data[key] }));
        setUsers(usersList);
      } else {
        setUsers([]);
      }
      setLoading(false);
    });

    const rolesRef = ref(rt_db, 'roles');
    const unsubscribeRoles = onValue(rolesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const rolesList = Object.values(data).map(role => role.name);
        setRoles(rolesList);
      } else {
        setRoles([]);
      }
    });

    return () => {
      unsubscribeUsers();
      unsubscribeRoles();
    };
  }, []);

  const handleOpenEditModal = (user) => {
    setEditingUser(user);
    // Llenamos el formulario con los datos del usuario seleccionado
    setFormData({
      nombre: user.nombre || '',
      apellidos: user.apellidos || '',
      celular: user.celular || '',
      rol: user.rol || ''
    });
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingUser(null);
    setFormData({ nombre: '', apellidos: '', celular: '', rol: '' }); // Limpiar formulario
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSaveUser = async () => {
    if (!editingUser) return;

    const userRef = ref(rt_db, `users/${editingUser.id}`);
    try {
      await update(userRef, {
        nombre: formData.nombre.toLowerCase(),
        apellidos: formData.apellidos.toLowerCase(),
        celular: formData.celular,
        rol: formData.rol
      });
      alert(`El perfil de ${formData.nombre} ha sido actualizado.`);
      handleCloseModal();
    } catch (error) {
      console.error("Error al actualizar el rol del usuario: ", error);
      alert("Ocurrió un error al guardar los cambios.");
    }
  };

  // Placeholder para la función de eliminar
  const handleDeleteUser = (user) => {
    alert(`Funcionalidad para eliminar a ${user.nombre} aún no implementada.`);
  };

  return (
    <div className="config-section">
      <h3>Administración de Usuarios</h3>
      <div className="table-responsive-wrapper">
        {loading ? <p>Cargando usuarios...</p> : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Correo</th>
                <th>Rol</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user.id}>
                  <td>{`${user.nombre} ${user.apellidos}`}</td>
                  <td data-label="Correo">{user.email}</td>
                  <td>{user.rol}</td>
                  <td className="actions-cell">
                    <button className="icon-btn edit-btn" onClick={() => handleOpenEditModal(user)}>
                      <FaPencilAlt />
                    </button>
                    <button className="icon-btn delete-btn" onClick={() => handleDeleteUser(user)}>
                      <FaTrash />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {isModalOpen && editingUser && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3 className="modal-title">Editar Usuario</h3>
            <form onSubmit={(e) => { e.preventDefault(); handleSaveUser(); }} className="modal-form">
              <div className="form-row">
                <div className="form-group">
                  <label>Nombre</label>
                  <input type="text" name="nombre" value={formData.nombre} onChange={handleInputChange} required />
                </div>
                <div className="form-group">
                  <label>Apellidos</label>
                  <input type="text" name="apellidos" value={formData.apellidos} onChange={handleInputChange} required />
                </div>
              </div>
              <div className="form-group">
                <label>Celular</label>
                <input type="tel" name="celular" value={formData.celular} onChange={handleInputChange} required />
              </div>
              <div className="form-group">
                <label>Correo (no editable)</label>
                <input type="email" value={editingUser.email} disabled />
              </div>
              <div className="form-group">
                <label htmlFor="role-select">Rol</label>
                <select id="role-select" name="rol" className="modal-select" value={formData.rol} onChange={handleInputChange}>
                  {roles.map(role => (
                    <option key={role} value={role}>{role}</option>
                  ))}
                </select>
              </div>
              <div className="modal-actions">
                <button type="button" onClick={handleCloseModal} className="modal-button-cancel">Cancelar</button>
                <button type="submit" className="modal-button-confirm">Guardar Cambios</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;