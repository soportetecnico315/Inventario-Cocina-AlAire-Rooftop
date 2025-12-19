import React, { useState, useEffect } from 'react';
import { rt_db } from '../firebase'; // Cambiamos a Realtime Database
import { ref, update } from 'firebase/database';

const ProfileEditor = ({ userData }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    nombre: '',
    apellidos: '',
    celular: ''
  });

  // Cuando los datos del usuario se cargan, llenamos el formulario
  useEffect(() => {
    if (userData) {
      setFormData({
        nombre: userData.nombre || '',
        apellidos: userData.apellidos || '',
        celular: userData.celular || ''
      });
    }
  }, [userData]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setIsSaving(true);

    if (!userData?.uid) {
      alert("Error: No se pudo identificar al usuario.");
      setIsSaving(false);
      return;
    }

    const userRef = ref(rt_db, `users/${userData.uid}`);

    try {
      const updatedData = {
        nombre: formData.nombre.toLowerCase(),
        apellidos: formData.apellidos.toLowerCase(),
        celular: formData.celular
      };

      await update(userRef, updatedData);

      alert("Perfil actualizado con éxito.");
      setIsEditing(false);
    } catch (error) {
      console.error("Error al actualizar el perfil: ", error);
      alert("Ocurrió un error al guardar los cambios.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="config-section profile-section">
      <h3>Mi Perfil</h3>
      <p>Aquí puedes editar tu información personal como nombre y número de celular.</p>
      <button onClick={() => setIsEditing(true)} className="footer-btn save-btn">Editar Perfil</button>

      {isEditing && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3 className="modal-title">Editar Mi Perfil</h3>
            <form onSubmit={handleSaveProfile} className="modal-form">
              <div className="form-row">
                <div className="form-group">
                  <label>Nombre</label>
                  <input type="text" name="nombre" value={formData.nombre} onChange={handleInputChange} placeholder="Nombre" required />
                </div>
                <div className="form-group">
                  <label>Apellidos</label>
                  <input type="text" name="apellidos" value={formData.apellidos} onChange={handleInputChange} placeholder="Apellidos" required />
                </div>
              </div>
              <div className="form-group">
                <label>Celular</label>
                <input type="tel" name="celular" value={formData.celular} onChange={handleInputChange} placeholder="Celular" required />
              </div>
              <div className="form-group">
                <label>Correo Electrónico (no editable)</label>
                <input type="email" value={userData?.email || ''} disabled />
              </div>
              <div className="form-group">
                <label>Rol (no editable)</label>
                <input type="text" value={userData?.rol || ''} disabled />
              </div>
              <div className="modal-actions">
                <button type="button" onClick={() => setIsEditing(false)} className="modal-button-cancel">Cancelar</button>
                <button type="submit" className="modal-button-confirm" disabled={isSaving}>
                  {isSaving ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfileEditor;