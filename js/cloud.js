/* =========================================================
   CLOUD.JS — работа с Firebase Realtime Database.
   Подключается как ES-модуль: <script type="module" src="js/cloud.js">.
   ========================================================= */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js';
import { getDatabase, ref, set, onValue, get } from 'https://www.gstatic.com/firebasejs/12.11.0/firebase-database.js';

const firebaseConfig = {
  apiKey: "AIzaSyAir3uF_2zCdj1ltMQP_Yzm_wR1Ro1ISbA",
  authDomain: "oruzhie-pobedy.firebaseapp.com",
  databaseURL: "https://oruzhie-pobedy-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "oruzhie-pobedy",
  storageBucket: "oruzhie-pobedy.firebasestorage.app",
  messagingSenderId: "856628650103",
  appId: "1:856628650103:web:7b5b052bfdf8a3de15a672"
};

const Cloud = {
  app: null, auth: null, db: null,
  ready: false, callbacks: [],

  async init(){
    try {
      this.app = initializeApp(firebaseConfig);
      this.auth = getAuth(this.app);
      this.db = getDatabase(this.app);
      await signInAnonymously(this.auth);
      onAuthStateChanged(this.auth, user => {
        if (user){
          this.ready = true;
          console.log('[Cloud] подключено к Firebase, uid:', user.uid);
          this.callbacks.forEach(cb => cb());
          this.callbacks = [];
        }
      });
    } catch (e){
      console.warn('[Cloud] Firebase не подключён:', e.message);
    }
  },

  onReady(cb){
    if (this.ready) cb();
    else this.callbacks.push(cb);
  },

  async pushScore(nick, xp, stats, rank){
    if (!this.ready || !nick) return false;
    try {
      await set(ref(this.db, 'leaderboard/' + nick), {
        nick, xp: xp || 0,
        rank: rank || 'Рядовой',
        stats: stats || {},
        updatedAt: Date.now()
      });
      return true;
    } catch (e){
      console.warn('[Cloud] push error:', e.message);
      return false;
    }
  },

  watchLeaderboard(cb){
    if (!this.ready) return () => {};
    return onValue(ref(this.db, 'leaderboard'), snap => {
      const data = snap.val() || {};
      const rows = Object.values(data).sort((a, b) => (b.xp || 0) - (a.xp || 0));
      cb(rows);
    });
  },

  async getLeaderboard(){
    if (!this.ready) return [];
    const snap = await get(ref(this.db, 'leaderboard'));
    const data = snap.val() || {};
    return Object.values(data).sort((a, b) => (b.xp || 0) - (a.xp || 0));
  }
};

window.Cloud = Cloud;