import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
// 1. Importe o serviço de Storage
import { getStorage } from "firebase/storage"; 

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);

// 2. Exporta o Firestore (Banco de dados)
export const db = getFirestore(app);

// 3. Exporta o Storage (Armazenamento de Fotos/Arquivos)
export const storage = getStorage(app);