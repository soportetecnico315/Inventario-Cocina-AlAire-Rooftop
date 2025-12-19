import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, db } from '../firebase'; // Asegúrate de que esta ruta sea correcta
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

// 1. Crear el contexto de autenticación
const AuthContext = createContext(null);

// 2. Crear el componente AuthProvider que envolverá la aplicación
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        // Opcional: Cargar el perfil del usuario desde Firestore
        const userDocRef = doc(db, 'users', currentUser.uid);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
          setUserProfile(userDocSnap.data());
        } else {
          console.log("No se encontró perfil de usuario en Firestore para UID:", currentUser.uid);
          setUserProfile(null);
        }
      } else {
        setUser(null);
        setUserProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribeAuth(); // Limpiar el listener al desmontar
  }, []);

  const value = { user, userProfile, loading };

  return <AuthContext.Provider value={value}>{!loading && children}</AuthContext.Provider>;
}

// 3. Crear un hook personalizado para consumir el contexto
export function useAuth() { // Exportación nombrada
  return useContext(AuthContext);
}
