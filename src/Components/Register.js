import React, { useState, useEffect } from 'react';
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth, rt_db } from '../firebase'; // Cambiamos a Realtime Database
import { ref, onValue, set } from 'firebase/database';
import './Login.css'; // Reutilizaremos los estilos del Login
import { FiUser, FiPhone, FiMail, FiLock, FiBriefcase } from 'react-icons/fi';

const Register = ({ onSwitchToLogin }) => {
  const [nombre, setNombre] = useState('');
  const [apellidos, setApellidos] = useState('');
  const [celular, setCelular] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rol, setRol] = useState(''); // El rol se seleccionará del dropdown
  const [availableRoles, setAvailableRoles] = useState([]); // Ahora guardará objetos de rol
  const [roleCounts, setRoleCounts] = useState({}); // Para contar usuarios por rol
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  // useEffect para cargar los roles y contar los usuarios
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
        setAvailableRoles(rolesList);
      } else {
        setAvailableRoles([]);
      }
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
  }, []); // El array vacío asegura que esto se ejecute solo una vez

  const handleRegister = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (!email || !password || !nombre || !apellidos || !celular || !rol) {
      setError("Por favor, completa todos los campos.");
      setLoading(false);
      return;
    }

    try {
      // 1. Crear el usuario en Firebase Authentication
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // 2. Guardar la información adicional en Realtime Database
      // Usamos el UID del usuario como clave para enlazar ambos
      await set(ref(rt_db, `users/${user.uid}`), {
        uid: user.uid,
        nombre: nombre.toLowerCase(), // Guardamos en minúsculas
        apellidos: apellidos.toLowerCase(), // Guardamos en minúsculas
        celular, // El celular no necesita cambios
        email,
        rol,
      });

      console.log('Usuario registrado y datos guardados en Realtime Database!');
      // Aquí podrías redirigir al usuario a la página de login o directamente a la app

    } catch (error) {
      console.error("Error al registrar:", error.code);
      switch (error.code) {
        case 'auth/email-already-in-use':
          setError('Este correo electrónico ya está en uso.');
          break;
        case 'auth/weak-password':
          setError('La contraseña debe tener al menos 6 caracteres.');
          break;
        case 'auth/invalid-email':
          setError('El formato del correo electrónico no es válido.');
          break;
        default:
          setError('Ocurrió un error al intentar registrar el usuario.');
          break;
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <h2>Crear Cuenta</h2>
      <p className="subtitle">Únete para gestionar el inventario</p>
      <form onSubmit={handleRegister} className="login-form">
        <div className="form-row">
          <div className="input-group">
            <FiUser className="input-icon" />
            <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre" required />
          </div>
          <div className="input-group">
            <FiUser className="input-icon" />
            <input type="text" value={apellidos} onChange={(e) => setApellidos(e.target.value)} placeholder="Apellidos" required />
          </div>
        </div>
        <div className="form-row">
          <div className="input-group">
            <FiPhone className="input-icon" />
            <input type="tel" value={celular} onChange={(e) => setCelular(e.target.value)} placeholder="Celular" required />
          </div>
          <div className="input-group">
            <FiMail className="input-icon" />
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Correo electrónico" required />
          </div>
        </div>
        <div className="form-row">
          <div className="input-group">
            <FiLock className="input-icon" />
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Contraseña" required />
          </div>
          <div className="input-group">
            <FiBriefcase className="input-icon" />
            <select value={rol} onChange={(e) => setRol(e.target.value)} required>
              <option value="" disabled>Selecciona tu rol</option>
              {availableRoles
                .filter(role => {
                  const maxUsers = role.name === 'Soporte Técnico' ? 1 : role.max_users;
                  const currentCount = roleCounts[role.name] || 0;
                  return currentCount < maxUsers;
                })
                .map((role) => (
                  <option key={role.id} value={role.name}>{role.name}</option>
                ))}
            </select>
          </div>
        </div>
        <button type="submit" disabled={loading}>
          {loading ? 'Registrando...' : 'Crear Cuenta'}
        </button>
        {error && <p className="error-message">{error}</p>}
      </form>
      <p className="form-switch-text">
        ¿Ya tienes una cuenta? <button onClick={onSwitchToLogin} className="form-switch-button">Inicia sesión</button>
      </p>
    </div>
  );
};

export default Register;