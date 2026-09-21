/* =========================================================
   ОБЩИЕ УТИЛИТЫ.
   Подключается и на index.html, и на admin.html ПОСЛЕ data.js.
   Здесь: DOM-хелперы, хранилище, пользователи, ранги,
   геймификация, звук, живой фон, override-данные, доступность.
   Интеграция с Firebase — через Cloud.pushScore() (см. js/cloud.js).
   ========================================================= */

/* ---------- DOM-хелперы ---------- */
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
function el(tag, cls, text){
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

/* ---------- Общие утилиты ---------- */
function shuffle(a){
  a = a.slice();
  for (let i = a.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function fmtTime(sec){
  const m = Math.floor(sec / 60), s = String(sec % 60).padStart(2, '0');
  return m + ':' + s;
}
function todayKey(){
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') +
         '-' + String(d.getDate()).padStart(2, '0');
}

let toastTimer;
function toast(msg){
  const t = $('#toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}
function vibrate(pattern){
  try { if (navigator.vibrate) navigator.vibrate(pattern); } catch(e){}
}

/* ---------- Хранилище ---------- */
const DB = {
  get(k, def){
    try { const v = localStorage.getItem('ovp_' + k); return v == null ? def : JSON.parse(v); }
    catch { return def; }
  },
  set(k, v){ try { localStorage.setItem('ovp_' + k, JSON.stringify(v)); } catch {} },
  del(k){ try { localStorage.removeItem('ovp_' + k); } catch {} }
};

/* ---------- Звук (WebAudio, без файлов) ---------- */
const Sound = {
  get enabled(){ return DB.get('sound', true) !== false; },
  ctx:null,
  beep(freq = 660, dur = .08, type = 'sine'){
    if (!this.enabled) return;
    try {
      if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type; o.frequency.value = freq;
      g.gain.setValueAtTime(0.09, this.ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + dur);
      o.connect(g); g.connect(this.ctx.destination);
      o.start(); o.stop(this.ctx.currentTime + dur);
    } catch(e){}
  },
  ok(){ this.beep(880, .09); setTimeout(() => this.beep(1200, .12), 85); },
  err(){ this.beep(220, .18, 'sawtooth'); },
  win(){ [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.beep(f, .14), i * 110)); },
  tap(){ this.beep(440, .04, 'triangle'); },
  toggle(){ DB.set('sound', !this.enabled); }
};

/* ---------- Override-данные (заполняются админкой) ---------- */
const OVERRIDE_KEYS = {
  weapons: 'weapons_override',
  quiz:    'quiz_override',
  ach:     'ach_override'
};

function applyOverrides(){
  const w = DB.get(OVERRIDE_KEYS.weapons, null);
  if (Array.isArray(w) && w.length){ WEAPONS.length = 0; WEAPONS.push(...w); }

  const q = DB.get(OVERRIDE_KEYS.quiz, null);
  if (Array.isArray(q) && q.length){ QUIZ.length = 0; QUIZ.push(...q); }

  const a = DB.get(OVERRIDE_KEYS.ach, null);
  if (Array.isArray(a) && a.length){ ACHIEVEMENTS.length = 0; ACHIEVEMENTS.push(...a); }
}

/* ---------- Пользователи ---------- */
const CODEWORD = 'Плехановка-2026';
const ADMIN_PASSWORD = 'admin2026';

const Users = {
  all(){ return DB.get('users', {}); },
  saveAll(u){ DB.set('users', u); },
  current(){ return DB.get('current', null); },
  setCurrent(n){ DB.set('current', n); },
  logout(){ DB.del('current'); },

  ensure(nick){
    nick = String(nick).trim();
    if (nick.length < 3) return { ok:false, error:'Позывной — минимум 3 символа' };
    const all = this.all();
    if (!all[nick]){
      all[nick] = {
        created: Date.now(),
        xp: 0,
        avatar: '🎖️',
        collection: [],
        favorites: [],
        achievements: [],
        dailyDone: {},
        lastVisit: null,
        streak: 0,
        stats: {
          quizBest:0, quizGames:0,
          matchBest:null, matchGames:0,
          silBest:0, silGames:0,
          oddBest:0, oddGames:0,
          duelWins:0, duelGames:0,
          correct:0, wrong:0,
          qstats: {},
          tfBest:0, tfGames:0,
          reactBest:0, reactGames:0,
          gunsmithDone:0, gunsmithGames:0,
          tacticBest:0, tacticGames:0,
          wordsSolved:0, wordGames:0
        }
      };
      this.saveAll(all);
    }
    this.setCurrent(nick);
    return { ok:true, nick };
  },

  data(){ const n = this.current(); return n ? this.all()[n] : null; },
  update(fn){
    const n = this.current(); if (!n) return;
    const all = this.all();
    fn(all[n]);
    this.saveAll(all);
  }
};

/* ---------- Ранги ---------- */
const Rank = {
  current(xp){
    let r = RANKS[0];
    for (const x of RANKS) if (xp >= x.xp) r = x;
    return r;
  },
  next(xp){
    for (const x of RANKS) if (xp < x.xp) return x;
    return null;
  }
};

/* ---------- Геймификация ---------- */
const Game = {
  /** Отправить текущий прогресс в облако Firebase.
      Вызывается из addXp, tickStreak и addToCollection. */
  syncCloud(){
    if (!window.Cloud || !Cloud.ready) return;
    const n = Users.current(); if (!n) return;
    const d = Users.data(); if (!d) return;
    Cloud.pushScore(n, d.xp || 0, d.stats, Rank.current(d.xp || 0).name);
  },

  addXp(amount){
    if (!Users.current()) return;
    Users.update(u => { u.xp = (u.xp || 0) + amount; });
    toast('+' + amount + ' XP');
    this.syncCloud();
  },

  addCorrect(weaponId){
    Users.update(u => {
      u.stats.correct = (u.stats.correct || 0) + 1;
      if (weaponId){
        u.stats.qstats = u.stats.qstats || {};
        const s = u.stats.qstats[weaponId] = u.stats.qstats[weaponId] || { c:0, w:0 };
        s.c++;
      }
    });
  },
  addWrong(weaponId){
    Users.update(u => {
      u.stats.wrong = (u.stats.wrong || 0) + 1;
      if (weaponId){
        u.stats.qstats = u.stats.qstats || {};
        const s = u.stats.qstats[weaponId] = u.stats.qstats[weaponId] || { c:0, w:0 };
        s.w++;
      }
    });
  },

  checkAchievements(){
    const d = Users.data(); if (!d) return;
    const have = new Set(d.achievements || []);
    const add = [];
    const hasCat = catId => {
      const all = WEAPONS.filter(w => w.category === catId).map(w => w.id);
      return all.every(id => d.collection.includes(id));
    };
    const games = d.stats || {};
    if (!have.has('sniper')    && games.quizBest === 10)              add.push('sniper');
    if (!have.has('tankist')   && hasCat('armor'))                    add.push('tankist');
    if (!have.has('pilot')     && hasCat('air'))                      add.push('pilot');
    if (!have.has('sailor')    && hasCat('navy'))                     add.push('sailor');
    if (!have.has('erudit')    && (games.correct || 0) >= 50)         add.push('erudit');
    if (!have.has('collector') && (d.collection || []).length >= 20)  add.push('collector');
    if (!have.has('streak7')   && (d.streak || 0) >= 7)               add.push('streak7');
    if (!have.has('master')    && Rank.current(d.xp || 0).xp >= 1200) add.push('master');
    if (!have.has('gunsmith')  && (games.gunsmithDone || 0) >= 4)     add.push('gunsmith');
    if (!have.has('analyst')   && games.tfBest === 10)                add.push('analyst');
    if (!have.has('strateg')   && games.tacticBest === 10)            add.push('strateg');
    if (!have.has('polyglot')  && (games.wordsSolved || 0) >= 10)     add.push('polyglot');

    if (add.length){
      Users.update(u => { u.achievements = [...new Set([...(u.achievements||[]), ...add])]; });
      add.forEach(id => {
        const a = ACHIEVEMENTS.find(x => x.id === id);
        if (a) setTimeout(() => { toast(a.icon + ' Достижение: ' + a.name); Sound.win(); }, 400);
      });
      this.addXp(add.length * 50);
      this.syncCloud();
    }
  },

  tickStreak(){
    if (!Users.current()) return 0;
    const today = todayKey();
    let bonus = 0;
    Users.update(u => {
      if (u.lastVisit === today) return;
      const y = new Date(Date.now() - 864e5);
      const yKey = y.getFullYear() + '-' + String(y.getMonth()+1).padStart(2,'0') +
                   '-' + String(y.getDate()).padStart(2,'0');
      u.streak = (u.lastVisit === yKey) ? (u.streak || 0) + 1 : 1;
      u.lastVisit = today;
      bonus = u.streak > 1 ? 25 + Math.min(u.streak * 5, 50) : 25;
      u.xp = (u.xp || 0) + bonus;
    });
    if (bonus){
      setTimeout(() => toast('🔥 Серия ' + Users.data().streak + ' дн. +' + bonus + ' XP'), 700);
      this.syncCloud();
    }
    return bonus;
  },

  addToCollection(id){
    if (!Users.current()) return;
    let isNew = false;
    Users.update(u => {
      if (!u.collection.includes(id)){ u.collection.push(id); u.xp += 5; isNew = true; }
    });
    if (isNew){
      toast('+5 XP · новый образец');
      this.checkAchievements();
      this.syncCloud();
    }
  },

  toggleFavorite(id){
    if (!Users.current()) return false;
    let on = false;
    Users.update(u => {
      const i = u.favorites.indexOf(id);
      if (i === -1){ u.favorites.push(id); on = true; }
      else u.favorites.splice(i, 1);
    });
    return on;
  },
  isFavorite(id){
    const d = Users.data(); return d ? (d.favorites || []).includes(id) : false;
  }
};

/* =========================================================
   ЖИВОЙ ФОН
   ========================================================= */
const BG = {
  canvas: null, ctx: null,
  particles: [],
  ripples: [],
  raf: 0, running: false,
  mouse: { x: -10000, y: -10000, tx: -10000, ty: -10000 },

  enabled(){ return DB.get('bg', true) !== false; },

  init(){
    this.canvas = document.getElementById('bgCanvas');
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.resize();
    window.addEventListener('resize', () => this.resize());

    window.addEventListener('pointermove', (e) => {
      this.mouse.tx = e.clientX;
      this.mouse.ty = e.clientY;
    }, { passive: true });
    window.addEventListener('pointerleave', () => {
      this.mouse.tx = -10000; this.mouse.ty = -10000;
    });

    window.addEventListener('pointerdown', (e) => {
      if (!this.enabled() || this.prefersReduced()) return;
      this.ripples.push({
        x: e.clientX, y: e.clientY,
        r: 0,
        maxR: 130 + Math.random() * 90,
        a: 0.55,
        hue: Math.random() < 0.72 ? '143,167,99' : '139,157,195'
      });
      if (this.ripples.length > 8) this.ripples.shift();
    }, { passive: true });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.stop();
      else if (this.enabled() && !this.prefersReduced()) this.start();
    });

    if (this.enabled() && !this.prefersReduced()) this.start();
    else document.body.classList.add('bg-off');
  },

  prefersReduced(){
    return window.matchMedia &&
           window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  },

  resize(){
    if (!this.canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth, h = window.innerHeight;
    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const isMobile = w < 700;
    const maxCount = isMobile ? 40 : 110;
    const areaCount = Math.round((w * h) / (isMobile ? 26000 : 18000));
    const count = Math.min(maxCount, Math.max(22, areaCount));

    this.particles = [];
    for (let i = 0; i < count; i++){
      this.particles.push(this.makeParticle(w, h));
    }
  },

  makeParticle(w, h){
    const isSpark = Math.random() > 0.88;
    return {
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * (isSpark ? 0.28 : 0.16),
      vy: (Math.random() - 0.5) * (isSpark ? 0.28 : 0.16),
      r: isSpark ? 1.6 + Math.random() * 1.2 : 0.5 + Math.random() * 1.1,
      a: isSpark ? 0.55 + Math.random() * 0.35 : 0.15 + Math.random() * 0.4,
      phase: Math.random() * Math.PI * 2,
      speed: 0.006 + Math.random() * 0.014,
      isSpark,
      trail: 0
    };
  },

  draw(){
    if (!this.running) return;
    const ctx = this.ctx;
    const w = window.innerWidth, h = window.innerHeight;
    ctx.clearRect(0, 0, w, h);

    this.mouse.x += (this.mouse.tx - this.mouse.x) * 0.06;
    this.mouse.y += (this.mouse.ty - this.mouse.y) * 0.06;
    const px = (this.mouse.x / w - 0.5) * 16;
    const py = (this.mouse.y / h - 0.5) * 16;

    for (let i = this.ripples.length - 1; i >= 0; i--){
      const rp = this.ripples[i];
      rp.r += 2.4;
      rp.a *= 0.965;
      if (rp.r > rp.maxR || rp.a < 0.02){
        this.ripples.splice(i, 1);
        continue;
      }
      ctx.beginPath();
      ctx.arc(rp.x, rp.y, rp.r, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${rp.hue}, ${rp.a.toFixed(3)})`;
      ctx.lineWidth = 1.4;
      ctx.stroke();
    }

    for (const p of this.particles){
      p.x += p.vx; p.y += p.vy;
      p.phase += p.speed;
      if (p.isSpark && p.trail > 0) p.trail *= 0.94;
      if (p.isSpark && Math.random() < 0.006) p.trail = 1;

      if (p.x < -10) p.x = w + 10;
      if (p.x > w + 10) p.x = -10;
      if (p.y < -10) p.y = h + 10;
      if (p.y > h + 10) p.y = -10;
    }

    if (this.particles.length <= 75){
      const maxDist = 110;
      const maxDist2 = maxDist * maxDist;
      for (let i = 0; i < this.particles.length; i++){
        const a = this.particles[i];
        for (let j = i + 1; j < this.particles.length; j++){
          const b = this.particles[j];
          const dx = a.x - b.x, dy = a.y - b.y;
          const d2 = dx*dx + dy*dy;
          if (d2 < maxDist2){
            const t = 1 - d2 / maxDist2;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = `rgba(143,167,99,${(0.10 * t).toFixed(3)})`;
            ctx.lineWidth = 0.6;
            ctx.stroke();
          }
        }
      }
    }

    for (const p of this.particles){
      const tw = 0.6 + 0.4 * Math.sin(p.phase);
      const scale = p.isSpark ? 0.6 : 0.3;
      const dx = p.x + px * scale;
      const dy = p.y + py * scale;

      if (p.isSpark){
        const g = ctx.createRadialGradient(dx, dy, 0, dx, dy, p.r * 6);
        g.addColorStop(0,   `rgba(200,220,160,${(p.a * tw).toFixed(3)})`);
        g.addColorStop(0.4, `rgba(143,167,99,${(p.a * tw * 0.35).toFixed(3)})`);
        g.addColorStop(1,   'rgba(143,167,99,0)');
        ctx.beginPath();
        ctx.arc(dx, dy, p.r * 6, 0, Math.PI * 2);
        ctx.fillStyle = g;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(dx, dy, p.r * 0.9, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(230,245,200,${(p.a * tw).toFixed(3)})`;
        ctx.fill();

        if (p.trail > 0.05){
          ctx.beginPath();
          ctx.moveTo(dx, dy);
          ctx.lineTo(dx - p.vx * 80 * p.trail, dy - p.vy * 80 * p.trail);
          ctx.strokeStyle = `rgba(200,230,150,${(p.trail * 0.55).toFixed(3)})`;
          ctx.lineWidth = p.r * 0.7;
          ctx.lineCap = 'round';
          ctx.stroke();
        }
      } else {
        ctx.beginPath();
        ctx.arc(dx, dy, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(180,200,131,${(p.a * tw).toFixed(3)})`;
        ctx.fill();
      }
    }

    this.raf = requestAnimationFrame(() => this.draw());
  },

  start(){
    if (this.running) return;
    this.running = true;
    this.draw();
  },

  stop(){
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    if (this.ctx && this.canvas){
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
  },

  toggle(){
    const on = !this.enabled();
    DB.set('bg', on);
    if (on){
      document.body.classList.remove('bg-off');
      if (!this.prefersReduced()) this.start();
    } else {
      document.body.classList.add('bg-off');
      this.stop();
    }
    return on;
  }
};

/* ---------- Тема ---------- */
function setTheme(t){
  document.documentElement.dataset.theme = t;
  DB.set('theme', t);
  const b = document.getElementById('themeBtn');
  if (b) b.textContent = t === 'dark' ? '☀️' : '🌙';
  const m = document.querySelector('meta[name="theme-color"]');
  if (m) m.setAttribute('content', t === 'dark' ? '#0d0f0c' : '#eceee6');
}

/* ---------- Доступность ---------- */
function setA11y(on){
  document.body.classList.toggle('a11y', !!on);
  DB.set('a11y', !!on);
  const btn = document.getElementById('a11yBtn');
  if (btn) btn.style.opacity = on ? '1' : '.55';
}
function initA11y(){
  const saved = DB.get('a11y', false);
  setA11y(saved);
}

/* ---------- Общий chrome (шапка) ---------- */
function initCommonChrome(){
  const saved = DB.get('theme', 'dark');
  setTheme(saved);
  const themeBtn = document.getElementById('themeBtn');
  if (themeBtn){
    themeBtn.addEventListener('click', () => {
      setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
    });
  }

  const soundBtn = document.getElementById('soundBtn');
  if (soundBtn){
    soundBtn.textContent = Sound.enabled ? '🔊' : '🔇';
    soundBtn.addEventListener('click', () => {
      Sound.toggle();
      soundBtn.textContent = Sound.enabled ? '🔊' : '🔇';
      if (Sound.enabled) Sound.tap();
    });
  }

  const bgBtn = document.getElementById('bgBtn');
  if (bgBtn){
    bgBtn.style.opacity = BG.enabled() ? '1' : '.5';
    bgBtn.addEventListener('click', () => {
      const on = BG.toggle();
      bgBtn.style.opacity = on ? '1' : '.5';
      toast(on ? 'Фон включён' : 'Фон отключён');
    });
  }

  initA11y();
  const a11yBtn = document.getElementById('a11yBtn');
  if (a11yBtn){
    a11yBtn.addEventListener('click', () => {
      const next = !DB.get('a11y', false);
      setA11y(next);
      toast(next ? 'Крупный шрифт включён' : 'Обычный шрифт');
    });
  }
}