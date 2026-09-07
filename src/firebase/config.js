import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getDatabase } from 'firebase/database';

// Copied as-is from the reference implementation (index4.html) — the brief
// says to keep auth + Realtime Database calls unchanged, only the rendering
// layer changes. This config is already public in the live deployed app.
const firebaseConfig = {
  apiKey: 'AIzaSyA_4WTcjW_VQCsWR5vNcbIZIGfDWGGgpsg',
  authDomain: 'table-stakes-blackjack.firebaseapp.com',
  databaseURL: 'https://table-stakes-blackjack-default-rtdb.firebaseio.com',
  projectId: 'table-stakes-blackjack',
  storageBucket: 'table-stakes-blackjack.firebasestorage.app',
  messagingSenderId: '1025609048299',
  appId: '1:1025609048299:web:b2178f766c432395441eae',
};

export const fbApp = initializeApp(firebaseConfig);
export const auth = getAuth(fbApp);
export const db = getDatabase(fbApp);
