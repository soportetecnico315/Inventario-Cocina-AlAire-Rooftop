import React, { useState } from 'react';
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from '../firebase'; // Importamos solo auth
import './Login.css'; // Importamos los estilos
import { FiMail, FiLock } from 'react-icons/fi'; // Importamos iconos
import logo from '../assets/Fto Al Aire Rooftop.jpg'; // Asegúrate de que la ruta y el nombre del archivo son correctos

const Login = ({ onSwitchToRegister }) => {
  const [email, setEmail] = useState(''); // Volvemos a usar 'email'
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (!email || !password) {
      setError("Por favor, completa todos los campos.");
      setLoading(false);
      return;
    }

    try {
      // Procedemos a la autenticación con el email
      await signInWithEmailAndPassword(auth, email, password);

    } catch (error) {
      // Manejo de errores de Firebase
      console.error("Error al iniciar sesión:", error.code);
      switch (error.code) {
        case 'auth/user-not-found':
        case 'auth/invalid-credential': // Nuevo error para v9+
          setError('El usuario no existe. Por favor, regístrate.');
          break;
        case 'auth/wrong-password':
          setError('La contraseña es incorrecta.');
          break;
        case 'auth/invalid-email':
          setError('El formato del correo electrónico no es válido.');
          break;
        default:
          setError('Ocurrió un error al intentar iniciar sesión.');
          break;
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <img src={logo} alt="Logo Inventario Cocina" className="login-logo" />
      <h2>Bienvenido</h2>
      <p className="subtitle">Inicia sesión para gestionar tu inventario</p>
      <form onSubmit={handleLogin} className="login-form">
        <div className="input-group">
          <FiMail className="input-icon" /> {/* Mantenemos el icono de email */}
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Correo electrónico" required />
        </div>
        <div className="input-group">
          <FiLock className="input-icon" />
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Contraseña" required />
        </div>
        <button type="submit" disabled={loading}>
          {loading ? 'Iniciando...' : 'Iniciar Sesión'}
        </button>
        {error && <p className="error-message">{error}</p>}
      </form>
      <p className="form-switch-text">
        ¿No tienes una cuenta? <button onClick={onSwitchToRegister} className="form-switch-button">Regístrate aquí</button>
      </p>
    </div>
  );
};

export default Login;