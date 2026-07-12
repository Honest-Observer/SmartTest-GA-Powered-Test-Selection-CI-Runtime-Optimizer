import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyCvXA1BwRG2zpU1CS5wCLIpz0zA7NRej-k',
  authDomain: 'tia-optimizer.firebaseapp.com',
  projectId: 'tia-optimizer',
  storageBucket: 'tia-optimizer.firebasestorage.app',
  messagingSenderId: '272066519691',
  appId: '1:272066519691:web:7d264f64c88d2c01302a8e',
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);
export default app;
