/* =========================================================
   CLOUD.JS — работа с Firebase Realtime Database.
   Использует compat-версию SDK (обычный <script>, не модуль).
   ========================================================= */

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
      if (typeof firebase === 'undefined'){
        throw new Error('Firebase SDK не загружен. Проверьте теги <script> в HTML.');
      }
      this.app = firebase.initializeApp(firebaseConfig);
      this.auth = firebase.auth();
      this.db = firebase.database();

      this.auth.onAuthStateChanged(user => {
        if (user && !this.ready){
          this.ready = true;
          console.log('[Cloud] подключено к Firebase, uid:', user.uid);
          this.callbacks.forEach(cb => cb());
          this.callbacks = [];
        }
      });

      await this.auth.signInAnonymously();
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
      await this.db.ref('leaderboard/' + nick).set({
        nick,
        xp: xp || 0,
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
    const ref = this.db.ref('leaderboard');
    const handler = ref.on('value', snap => {
      const data = snap.val() || {};
      const rows = Object.values(data).sort((a, b) => (b.xp || 0) - (a.xp || 0));
      cb(rows);
    });
    return () => ref.off('value', handler);
  },

  async getLeaderboard(){
    if (!this.ready) return [];
    const snap = await this.db.ref('leaderboard').once('value');
    const data = snap.val() || {};
    return Object.values(data).sort((a, b) => (b.xp || 0) - (a.xp || 0));
  }
};

window.Cloud = Cloud;
