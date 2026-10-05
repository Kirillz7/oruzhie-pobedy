/* =========================================================
   CLOUD.JS — Firebase Realtime Database.
   Использует compat-версию SDK.
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
      const d = (window.Users && Users.data()) || {};
      await this.db.ref('leaderboard/' + nick).set({
        nick,
        xp: xp || 0,
        rank: rank || 'Рядовой',
        stats: stats || {},
        avatar: d.avatar || '🎖️',
        profile: d.profile || {},
        achievements: d.achievements || [],
        updatedAt: Date.now()
      });
      return true;
    } catch (e){
      console.warn('[Cloud] push error:', e.message);
      return false;
    }
  },

  async pushProfile(nick, fields){
    if (!this.ready || !nick) return false;
    try {
      await this.db.ref('leaderboard/' + nick).update(fields);
      return true;
    } catch (e){
      console.warn('[Cloud] pushProfile error:', e.message);
      return false;
    }
  },

  async getProfile(nick){
    if (!this.ready || !nick) return null;
    try {
      const snap = await this.db.ref('leaderboard/' + nick).once('value');
      return snap.val();
    } catch (e){
      console.warn('[Cloud] getProfile error:', e.message);
      return null;
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
  },

  /* Записывает уведомление в Firebase.
     Структура: notifications/{nick}/{id}: {type, title, text, icon, ts, read} */
  async pushNotification(nick, payload){
    if (!this.ready || !nick) return false;
    try {
      const id = 'n' + Date.now() + '_' + Math.floor(Math.random() * 1e5);
      const data = Object.assign({
        type: 'info',
        title: 'Уведомление',
        text: '',
        icon: '🔔',
        ts: Date.now(),
        read: false
      }, payload || {});
      await this.db.ref('notifications/' + nick + '/' + id).set(data);
      return id;
    } catch (e){
      console.warn('[Cloud] pushNotification error:', e.message);
      return false;
    }
  },

  watchNotifications(nick, cb){
    if (!this.ready || !nick) return () => {};
    const ref = this.db.ref('notifications/' + nick);
    const handler = ref.on('value', snap => {
      const data = snap.val() || {};
      const list = Object.entries(data).map(([id, v]) => Object.assign({ id }, v));
      list.sort((a, b) => (b.ts || 0) - (a.ts || 0));
      cb(list);
    });
    return () => ref.off('value', handler);
  },

  async markNotificationRead(nick, id){
    if (!this.ready || !nick || !id) return false;
    try {
      await this.db.ref('notifications/' + nick + '/' + id + '/read').set(true);
      return true;
    } catch (e){
      return false;
    }
  },

  async markAllNotificationsRead(nick){
    if (!this.ready || !nick) return false;
    try {
      await this.db.ref('notifications/' + nick).once('value').then(snap => {
        const updates = {};
        snap.forEach(ch => { updates[ch.key + '/read'] = true; });
        return this.db.ref('notifications/' + nick).update(updates);
      });
      return true;
    } catch (e){
      return false;
    }
  }
};

window.Cloud = Cloud;
