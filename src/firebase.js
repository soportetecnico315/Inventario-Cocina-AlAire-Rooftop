// src/firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore"; // Para Firestore
import { getDatabase } from "firebase/database";   // Para Realtime Database
import { getAuth } from "firebase/auth";         // Para Autenticación

// Tu configuración de Firebase para la app web
// Leída desde variables de entorno para mayor seguridad
const firebaseConfig = {
  apiKey: process.env.REACT_APP_API_KEY,
  authDomain: process.env.REACT_APP_AUTH_DOMAIN,
  databaseURL: process.env.REACT_APP_DATABASE_URL, // URL para Realtime Database
  projectId: process.env.REACT_APP_PROJECT_ID,
  storageBucket: process.env.REACT_APP_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_APP_ID,
  measurementId: process.env.REACT_APP_MEASUREMENT_ID
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);

// Exportar los servicios que necesites
export const db = getFirestore(app);
export const rt_db = getDatabase(app); // Exportamos la instancia de Realtime Database
export const auth = getAuth(app);
