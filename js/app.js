/* =========================================================
   ЛОГИКА index.html
   Дополнительные игры (TF, React, Assembly, Tactic, WordGame)
   определены в js/games-extra.js и подключаются до этого файла.
   Синхронизация рейтинга — через window.Cloud (Firebase).
   ========================================================= */

/* ---------- Параллакс героя ---------- */
function initParallax(){
  const bg = document.getElementById('heroBg');
  if (!bg) return;
  let raf = 0;
  window.addEventListener('scroll', () => {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      const y = Math.min(window.scrollY, 300);
      bg.style.transform = 'translate3d(0,' + (y * 0.15) + 'px,0)';
      raf = 0;
    });
  }, { passive:true });
}

/* ---------- Хелпер: путь к фото образца ---------- */
function weaponImageSrc(w){
  if (w && w.img) return w.img;
  if (w && w.id)  return 'images/' + w.id + '.webp';
  return null;
}

/* =========================================================
   РОУТЕР
   ========================================================= */
const VIEWS = ['home','catalog','games','rating','profile','teacher','help'];
let activeCat = 'all';
let favOnly = false;
let gamesHubOpen = true;
let pendingGameToOpen = null;

function showView(name){
  VIEWS.forEach(v => { document.getElementById('view-' + v).hidden = (v !== name); });
  document.querySelectorAll('.tab').forEach(t =>
    t.classList.toggle('active', t.dataset.view === name));
  window.scrollTo(0, 0);

  if (name === 'catalog') renderCatalog();
  if (name === 'rating')  renderRating();
  if (name === 'profile') renderProfile();
  if (name === 'teacher') renderTeacher();
  if (name === 'home')    renderHeroStatus();

  if (name === 'games'){
    renderGamesHub();
    if (pendingGameToOpen){
      const gid = pendingGameToOpen;
      pendingGameToOpen = null;
      openGame(gid);
    }
  }
}

function route(){
  let hash = decodeURIComponent(location.hash.replace(/^#/, '')) || 'home';
  const m = hash.match(/^card=([a-z0-9_-]+)$/i);
  if (m){ handleQrCard(m[1].toLowerCase()); return; }
  if (!VIEWS.includes(hash)) hash = 'home';
  showView(hash);
}

function handleQrCard(cardId){
  const w = WEAPONS.find(x => x.id === cardId);
  if (!w){ toast('Карточка не распознана'); location.hash = '#home'; return; }
  showView('catalog');

  if (!Users.current()){
    document.getElementById('wCardName').textContent = w.name;
    document.getElementById('welcomeModal').hidden = false;
    document.getElementById('wStartBtn').onclick = () => {
      const nick = document.getElementById('wNick').value.trim();
      const res = Users.ensure(nick || ('Студент-' + cardId.toUpperCase()));
      if (!res.ok){ toast(res.error); return; }
      document.getElementById('welcomeModal').hidden = true;
      Game.addToCollection(w.id);
      Game.tickStreak();
      Game.syncCloud();
      setTimeout(() => openCard(w.id), 200);
    };
  } else {
    Game.addToCollection(w.id);
    setTimeout(() => openCard(w.id), 200);
  }
}

/* =========================================================
   ГЛАВНАЯ
   ========================================================= */
function renderHeroStatus(){
  const box = document.getElementById('heroStatus');
  box.innerHTML = '';
  const d = Users.data();
  if (!d){
    box.appendChild(el('span', null, 'Войдите через QR-код или позывной, чтобы получать XP.'));
    return;
  }
  const r = Rank.current(d.xp || 0);
  const n = Rank.next(d.xp || 0);
  box.appendChild(el('span', null, `${r.icon} ${r.name}`));
  box.appendChild(el('span', null, `${d.xp || 0} XP`));
  box.appendChild(el('span', null, `🔥 ${d.streak || 0} дн.`));
  if (n) box.appendChild(el('span', null, `→ «${n.name}»: ${n.xp - (d.xp || 0)} XP`));
}

function buildHome(){
  const gh = document.getElementById('homeGames');
  GAME_LIST.forEach(g => gh.appendChild(gameCard(g, () => {
    Sound.tap();
    if (location.hash === '#games'){
      openGame(g.id);
    } else {
      pendingGameToOpen = g.id;
      location.hash = '#games';
    }
  })));

  const box = document.getElementById('homeCats');
  CATEGORIES.forEach(c => {
    const count = WEAPONS.filter(w => w.category === c.id).length;
    const card = el('button','cat-card'); card.type = 'button';
    card.appendChild(el('div','cat-card__icon', c.icon));
    card.appendChild(el('div','cat-card__title', c.title));
    card.appendChild(el('div','cat-card__count', count + ' ед.'));
    card.addEventListener('click', () => {
      activeCat = c.id;
      if (location.hash === '#catalog') renderCatalog();
      else location.hash = '#catalog';
    });
    box.appendChild(card);
  });

  const day = Math.floor(Date.now() / 864e5);
  const w = WEAPONS[day % WEAPONS.length];
  document.getElementById('homeRandom').appendChild(weaponCard(w));
}

function weaponCard(w){
  const cat = CATEGORIES.find(c => c.id === w.category);
  const card = el('button','wcard'); card.type = 'button';

  const fav = el('button','wcard__fav', Game.isFavorite(w.id) ? '★' : '☆');
  fav.type = 'button';
  fav.addEventListener('click', e => {
    e.stopPropagation();
    if (!Users.current()){ toast('Войдите, чтобы добавить в избранное'); return; }
    const on = Game.toggleFavorite(w.id);
    fav.textContent = on ? '★' : '☆';
    Sound.tap();
  });
  card.appendChild(fav);

  const media = el('div','wcard__img');
  const src = weaponImageSrc(w);
  if (src){
    const img = el('img');
    img.src = src; img.alt = w.name; img.loading = 'lazy';
    img.onerror = () => { img.remove(); media.textContent = w.emoji; };
    media.appendChild(img);
  } else {
    media.textContent = w.emoji;
  }

  const body = el('div','wcard__body');
  body.appendChild(el('div','wcard__cat', cat ? cat.title : ''));
  body.appendChild(el('div','wcard__title', w.name));

  card.append(media, body);
  card.addEventListener('click', () => { Sound.tap(); openCard(w.id); });
  return card;
}

/* =========================================================
   АРСЕНАЛ
   ========================================================= */
function initCatalogFilters(){
  let t;
  document.getElementById('searchInput').addEventListener('input', () => {
    clearTimeout(t); t = setTimeout(renderCatalog, 150);
  });
  const favBtn = document.getElementById('favFilterBtn');
  favBtn.addEventListener('click', () => {
    favOnly = !favOnly;
    favBtn.textContent = favOnly ? '★' : '☆';
    favBtn.style.color = favOnly ? 'var(--gold)' : '';
    renderCatalog();
  });
}

function renderCatalog(){
  const chips = document.getElementById('catChips');
  if (!chips.dataset.ready){
    [{ id:'all', title:'Все', icon:'★' }].concat(CATEGORIES).forEach(c => {
      const b = el('button','chip'); b.type = 'button';
      b.dataset.cat = c.id;
      b.textContent = c.icon + ' ' + c.title;
      b.addEventListener('click', () => {
        activeCat = c.id;
        chips.querySelectorAll('.chip').forEach(x =>
          x.classList.toggle('active', x.dataset.cat === activeCat));
        renderCatalog();
      });
      chips.appendChild(b);
    });
    chips.dataset.ready = '1';
  }
  chips.querySelectorAll('.chip').forEach(b =>
    b.classList.toggle('active', b.dataset.cat === activeCat));

  const q = (document.getElementById('searchInput').value || '').trim().toLowerCase();
  const favs = (Users.data()?.favorites) || [];
  const list = WEAPONS.filter(w =>
    (activeCat === 'all' || w.category === activeCat) &&
    (!favOnly || favs.includes(w.id)) &&
    (!q || w.name.toLowerCase().includes(q) || w.short.toLowerCase().includes(q))
  );

  const grid = document.getElementById('catalogGrid');
  grid.innerHTML = '';
  if (!list.length) grid.appendChild(el('p','muted','Ничего не найдено.'));
  else list.forEach(w => grid.appendChild(weaponCard(w)));

  const g = document.getElementById('glossaryBox');
  if (!g.dataset.ready){
    GLOSSARY.forEach(x => {
      const p = el('p', null, '');
      p.appendChild(el('b', null, x.term + '. '));
      p.appendChild(document.createTextNode(x.def));
      g.appendChild(p);
    });
    g.dataset.ready = '1';
  }
}

function openCard(id){
  const w = WEAPONS.find(x => x.id === id);
  if (!w) return;
  const cat = CATEGORIES.find(c => c.id === w.category);
  const box = document.getElementById('modalBox');
  box.innerHTML = '';

  const media = el('div','modal__media');
  const src = weaponImageSrc(w);
  if (src){
    const img = el('img');
    img.src = src; img.alt = w.name;
    img.onerror = () => { img.remove(); media.textContent = w.emoji; };
    media.appendChild(img);
  } else {
    media.textContent = w.emoji;
  }
  box.appendChild(media);

  box.appendChild(el('div','modal__cat', cat ? cat.title : ''));
  box.appendChild(el('h2','modal__title', w.name));
  box.appendChild(el('p','muted', w.short));

  box.appendChild(el('h3', null, 'Тактико-технические характеристики'));
  const table = el('table','specs');
  Object.entries(w.specs).forEach(([k, v]) => {
    const tr = el('tr');
    tr.appendChild(el('th', null, k));
    tr.appendChild(el('td', null, v));
    table.appendChild(tr);
  });
  box.appendChild(table);

  if (w.fact){
    box.appendChild(el('h3', null, 'Интересный факт'));
    box.appendChild(el('p', null, w.fact));
  }

  const actions = el('div','modal__actions');
  const share = el('button','btn','🔗 Поделиться');
  share.type = 'button';
  share.addEventListener('click', () => shareCard(w));

  const coll = el('button','btn btn--primary','＋ В коллекцию');
  coll.type = 'button';
  coll.addEventListener('click', () => Game.addToCollection(w.id));

  const close = el('button','btn','Закрыть');
  close.type = 'button';
  close.addEventListener('click', closeModal);

  actions.append(share, coll, close);
  box.appendChild(actions);

  document.getElementById('modal').hidden = false;
  document.body.style.overflow = 'hidden';
}
function closeModal(){
  document.getElementById('modal').hidden = true;
  document.body.style.overflow = '';
}
function shareCard(w){
  const url = location.origin + location.pathname + '#card=' + w.id;
  if (navigator.share) navigator.share({ title:w.name, text:w.short, url }).catch(() => {});
  else if (navigator.clipboard) navigator.clipboard.writeText(url).then(() => toast('Ссылка скопирована')).catch(() => toast(url));
  else prompt('Скопируйте ссылку:', url);
}

/* =========================================================
   ХАБ ИГР
   ========================================================= */
const GAME_LIST = [
  { id:'match',    icon:'🃏', title:'Найди пару',           desc:'Открой одинаковые карточки и узнай ТТХ' },
  { id:'quiz',     icon:'⚡', title:'Блиц-опрос',            desc:'10 вопросов по вооружению' },
  { id:'sil',      icon:'🌑', title:'Угадай по силуэту',     desc:'10 чёрных силуэтов техники' },
  { id:'odd',      icon:'❓', title:'Найди лишнее',          desc:'4 образца — один не из этой категории' },
  { id:'duel',     icon:'⚔️', title:'Дуэль',                 desc:'1 на 1 на одном устройстве, 20 секунд на ответ' },
  { id:'daily',    icon:'🎯', title:'Ежедневный вызов',      desc:'Образец дня + 3 вопроса, бонус раз в сутки' },
  { id:'tf',       icon:'🤔', title:'Правда или миф',        desc:'Правда или вымысел о вооружении' },
  { id:'react',    icon:'⏱️', title:'Реакция',               desc:'2 секунды на ответ — успей нажать!' },
  { id:'assembly', icon:'🔧', title:'Собери оружие',         desc:'Отметь правильные детали образца' },
  { id:'tactic',   icon:'🗺️', title:'Тактическая задача',    desc:'Расставь технику по зонам' },
  { id:'word',     icon:'🔤', title:'Военный кроссворд',     desc:'Собери слово по описанию' }
];
const GAME_IDS = ['match','quiz','sil','odd','duel','daily','tf','react','assembly','tactic','word'];

function gameCard(g, customHandler){
  const c = el('button','game-card'); c.type = 'button';
  c.appendChild(el('div','game-card__icon', g.icon));
  c.appendChild(el('div','game-card__title', g.title));
  c.appendChild(el('div','game-card__desc', g.desc));
  const handler = customHandler || (() => { Sound.tap(); openGame(g.id); });
  c.addEventListener('click', handler);
  return c;
}

function renderGamesHub(){
  const hub = document.getElementById('gamesHub');
  if (!hub.children.length) GAME_LIST.forEach(g => hub.appendChild(gameCard(g)));
  hub.hidden = !gamesHubOpen;
  GAME_IDS.forEach(id => {
    const panel = document.getElementById('game-' + id);
    panel.hidden = gamesHubOpen || panel.dataset.active !== '1';
  });
}

function openGame(id){
  gamesHubOpen = false;
  document.getElementById('gamesHub').hidden = true;
  GAME_IDS.forEach(x => {
    const panel = document.getElementById('game-' + x);
    panel.dataset.active = (x === id) ? '1' : '0';
    panel.hidden = (x !== id);
  });
  if (id === 'match')    Match.init();
  if (id === 'quiz')     Quiz.reset();
  if (id === 'sil')      Sil.reset();
  if (id === 'odd')      Odd.reset();
  if (id === 'duel')     Duel.reset();
  if (id === 'daily')    Daily.reset();
  if (id === 'tf'       && typeof TF       !== 'undefined') TF.reset();
  if (id === 'react'    && typeof React    !== 'undefined') React.reset();
  if (id === 'assembly' && typeof Assembly !== 'undefined') Assembly.reset();
  if (id === 'tactic'   && typeof Tactic   !== 'undefined') Tactic.reset();
  if (id === 'word'     && typeof WordGame !== 'undefined') WordGame.reset();
}

function backToHub(){
  gamesHubOpen = true;
  clearInterval(Match.timer);
  Duel.stopTimer();
  if (typeof React !== 'undefined') React.stopTimer();
  renderGamesHub();
}

/* =========================================================
   ИГРА «НАЙДИ ПАРУ»
   ========================================================= */
const Match = {
  first:null, lock:false, moves:0, pairs:0, total:6, sec:0, timer:null, started:false,

  init(){
    const sel = document.getElementById('matchCat');
    if (!sel.options.length){
      sel.appendChild(new Option('Все категории', 'all'));
      CATEGORIES.forEach(c => sel.appendChild(new Option(c.title, c.id)));
    }
    document.getElementById('matchStart').onclick = () => this.start(sel.value);
    if (!document.getElementById('matchBoard').children.length) this.start('all');
  },

  start(catId){
    const pool = WEAPONS.filter(w => catId === 'all' || w.category === catId);
    const cnt = Math.min(6, pool.length);
    const picked = shuffle(pool).slice(0, cnt);
    this.deck = shuffle(picked.flatMap(w => ([{ wid:w.id }, { wid:w.id }])));
    this.first = null; this.lock = false;
    this.moves = 0; this.pairs = 0; this.total = cnt;
    this.sec = 0; this.started = false;
    clearInterval(this.timer); this.timer = null;
    const info = document.getElementById('matchInfo');
    info.hidden = true; info.innerHTML = '';
    this.render(); this.updateHud();
  },

  render(){
    const board = document.getElementById('matchBoard');
    board.innerHTML = '';
    this.deck.forEach(c => {
      const w = WEAPONS.find(x => x.id === c.wid);
      const btn = el('button','mcard'); btn.type = 'button';
      const inner = el('div','mcard__inner');
      const front = el('div','mcard__face mcard__front','★');
      const back  = el('div','mcard__face mcard__back');
      back.appendChild(el('div', null, w.emoji));
      back.appendChild(el('small', null, w.name));
      inner.append(front, back); btn.appendChild(inner);
      btn.addEventListener('click', () => this.flip(btn, c));
      board.appendChild(btn);
    });
  },

  flip(btn, c){
    if (this.lock || btn.classList.contains('flipped')) return;
    if (!this.started){ this.started = true; this.startTimer(); }
    btn.classList.add('flipped');
    Sound.tap();

    if (!this.first){ this.first = { btn, c }; return; }
    this.moves++; this.updateHud();

    const a = this.first; const b = { btn, c };
    this.first = null;

    if (a.c.wid === b.c.wid){
      this.pairs++;
      a.btn.classList.add('matched'); b.btn.classList.add('matched');
      this.updateHud();
      this.showInfo(a.c.wid);
      Game.addXp(8); Sound.ok(); vibrate(25);
      if (this.pairs === this.total) this.finish();
    } else {
      this.lock = true;
      vibrate(15);
      setTimeout(() => {
        a.btn.classList.remove('flipped');
        b.btn.classList.remove('flipped');
        this.lock = false;
      }, 750);
    }
  },

  startTimer(){
    this.timer = setInterval(() => {
      this.sec++;
      document.getElementById('matchTime').textContent = fmtTime(this.sec);
    }, 1000);
  },
  updateHud(){
    document.getElementById('matchMoves').textContent = this.moves;
    document.getElementById('matchPairs').textContent = this.pairs + '/' + this.total;
    document.getElementById('matchTime').textContent = fmtTime(this.sec);
  },
  showInfo(wid){
    const w = WEAPONS.find(x => x.id === wid); if (!w) return;
    const box = document.getElementById('matchInfo');
    box.hidden = false; box.innerHTML = '';
    box.appendChild(el('h3', null, w.emoji + ' ' + w.name));
    box.appendChild(el('p','muted small', w.short));
    const t = el('table','specs');
    Object.entries(w.specs).slice(0, 4).forEach(([k, v]) => {
      const tr = el('tr');
      tr.appendChild(el('th', null, k)); tr.appendChild(el('td', null, v));
      t.appendChild(tr);
    });
    box.appendChild(t);
    const more = el('button','btn','Подробнее'); more.type = 'button';
    more.onclick = () => openCard(w.id);
    box.appendChild(more);
  },
  finish(){
    clearInterval(this.timer); this.timer = null;
    Users.update(u => {
      u.stats.matchGames = (u.stats.matchGames || 0) + 1;
      if (u.stats.matchBest == null || this.moves < u.stats.matchBest) u.stats.matchBest = this.moves;
    });
    const timeBonus = Math.max(0, 60 - this.sec);
    const moveBonus = Math.max(0, (this.total * 2 + 5 - this.moves) * 3);
    const bonus = 30 + timeBonus + moveBonus;
    Game.addXp(bonus);
    Game.checkAchievements();
    Game.syncCloud();
    Sound.win();

    const box = document.getElementById('matchInfo');
    box.hidden = false; box.innerHTML = '';
    box.appendChild(el('h2', null, '🎉 Победа!'));
    box.appendChild(el('p', null, 'Ходов: ' + this.moves + ' · Время: ' + fmtTime(this.sec)));
    box.appendChild(el('p','muted small','Бонус: +' + bonus + ' XP'));

    const row = el('div','row');
    const again = el('button','btn btn--primary','Ещё раз'); again.type = 'button';
    again.onclick = () => this.start(document.getElementById('matchCat').value);
    const share = el('button','btn','📤 Поделиться'); share.type = 'button';
    share.onclick = () => showShareModal({
      title:'Найди пару', score: this.moves, total: 'ходов', xp: bonus,
      subtitle: 'Время ' + fmtTime(this.sec)
    });
    row.append(again, share);
    box.appendChild(row);
  }
};

/* =========================================================
   ИГРА «БЛИЦ-ОПРОС»
   ========================================================= */
const Quiz = {
  list:[], idx:0, score:0, locked:false,
  reset(){
    document.getElementById('quizStart').hidden = false;
    document.getElementById('quizGame').hidden = true;
    document.getElementById('quizResult').hidden = true;
    document.getElementById('quizStartBtn').onclick = () => this.start();
  },
  start(){
    this.list = shuffle(QUIZ).slice(0, 10);
    this.idx = 0; this.score = 0;
    document.getElementById('quizStart').hidden = true;
    document.getElementById('quizResult').hidden = true;
    document.getElementById('quizGame').hidden = false;
    document.getElementById('qTotal').textContent = this.list.length;
    this.render();
  },
  render(){
    const q = this.list[this.idx]; this.locked = false;
    document.getElementById('qNum').textContent = this.idx + 1;
    document.getElementById('qScore').textContent = this.score;
    document.getElementById('qBar').style.width = (this.idx / this.list.length * 100) + '%';

    const w = WEAPONS.find(x => x.id === q.weapon);
    const imgBox = document.getElementById('qImg'); imgBox.innerHTML = '';
    const src = w ? weaponImageSrc(w) : null;
    if (src){
      const img = el('img');
      img.src = src; img.alt = '';
      img.onerror = () => { img.remove(); imgBox.textContent = w ? w.emoji : '❓'; };
      imgBox.appendChild(img);
    } else {
      imgBox.textContent = w ? w.emoji : '❓';
    }

    document.getElementById('qText').textContent = q.text;
    const opts = document.getElementById('qOpts'); opts.innerHTML = '';
    q.options.forEach((t, i) => {
      const b = el('button','opt', t); b.type = 'button';
      b.onclick = () => this.answer(i, b);
      opts.appendChild(b);
    });
  },
  answer(i, btn){
    if (this.locked) return;
    this.locked = true;
    const q = this.list[this.idx];
    const buttons = $$('#qOpts .opt');
    buttons.forEach(b => b.disabled = true);
    if (i === q.correct){
      btn.classList.add('correct'); this.score++;
      document.getElementById('qScore').textContent = this.score;
      Game.addCorrect(q.weapon); Game.addXp(10); Sound.ok(); vibrate(25);
    } else {
      btn.classList.add('wrong');
      buttons[q.correct].classList.add('correct');
      Game.addWrong(q.weapon); Sound.err(); vibrate([40,40,40]);
    }
    setTimeout(() => {
      this.idx++;
      if (this.idx < this.list.length) this.render(); else this.finish();
    }, 950);
  },
  finish(){
    document.getElementById('quizGame').hidden = true;
    const res = document.getElementById('quizResult');
    res.hidden = false; res.innerHTML = '';
    const total = this.list.length;
    const pct = Math.round(this.score / total * 100);

    Users.update(u => {
      u.stats.quizGames = (u.stats.quizGames || 0) + 1;
      if (this.score > (u.stats.quizBest || 0)) u.stats.quizBest = this.score;
    });
    Game.checkAchievements();
    Game.syncCloud();
    if (pct >= 70) Sound.win();

    res.appendChild(el('h2', null, 'Результат'));
    res.appendChild(el('div','result-score', this.score + ' / ' + total));
    res.appendChild(el('p','muted', pct >= 80 ? 'Отличный результат!' :
      pct >= 50 ? 'Хорошо, но есть куда расти.' : 'Стоит ещё раз пролистать арсенал.'));

    const row = el('div','row');
    const again = el('button','btn btn--primary','Ещё раз'); again.type = 'button';
    again.onclick = () => this.start();
    const share = el('button','btn','📤 Поделиться'); share.type = 'button';
    share.onclick = () => showShareModal({
      title:'Блиц-опрос', score: this.score, total, xp: this.score * 10
    });
    row.append(again, share);
    res.appendChild(row);
  }
};

/* =========================================================
   ИГРА «УГАДАЙ ПО СИЛУЭТУ»
   ========================================================= */
const Sil = {
  list:[], idx:0, score:0, locked:false,
  reset(){
    document.getElementById('silStart').hidden = false;
    document.getElementById('silGame').hidden = true;
    document.getElementById('silResult').hidden = true;
    document.getElementById('silStartBtn').onclick = () => this.start();
  },
  start(){
    const pool = shuffle(WEAPONS).slice(0, 10);
    this.list = pool.map(w => {
      const wrong = shuffle(WEAPONS.filter(x => x.id !== w.id)).slice(0, 3);
      const opts = shuffle([w, ...wrong]);
      return { wid:w.id, options:opts, correct:opts.findIndex(x => x.id === w.id) };
    });
    this.idx = 0; this.score = 0;
    document.getElementById('silStart').hidden = true;
    document.getElementById('silResult').hidden = true;
    document.getElementById('silGame').hidden = false;
    document.getElementById('silTotal').textContent = this.list.length;
    this.render();
  },
  render(){
    const q = this.list[this.idx]; this.locked = false;
    const w = WEAPONS.find(x => x.id === q.wid);
    document.getElementById('silNum').textContent = this.idx + 1;
    document.getElementById('silScore').textContent = this.score;

    const s = document.getElementById('silImg'); s.innerHTML = '';
    s.appendChild(el('div','sil-img__icon', w.emoji));

    const opts = document.getElementById('silOpts'); opts.innerHTML = '';
    q.options.forEach((o, i) => {
      const b = el('button','opt', o.name); b.type = 'button';
      b.onclick = () => this.answer(i, b);
      opts.appendChild(b);
    });
  },
  answer(i, btn){
    if (this.locked) return;
    this.locked = true;
    const q = this.list[this.idx];
    const buttons = $$('#silOpts .opt');
    buttons.forEach(b => b.disabled = true);
    if (i === q.correct){
      btn.classList.add('correct'); this.score++;
      document.getElementById('silScore').textContent = this.score;
      Game.addCorrect(q.wid); Game.addXp(15); Sound.ok(); vibrate(25);
    } else {
      btn.classList.add('wrong');
      buttons[q.correct].classList.add('correct');
      Game.addWrong(q.wid); Sound.err(); vibrate([40,40,40]);
    }
    setTimeout(() => {
      this.idx++;
      if (this.idx < this.list.length) this.render(); else this.finish();
    }, 1100);
  },
  finish(){
    document.getElementById('silGame').hidden = true;
    const res = document.getElementById('silResult');
    res.hidden = false; res.innerHTML = '';
    const total = this.list.length;
    Users.update(u => {
      u.stats.silGames = (u.stats.silGames || 0) + 1;
      if (this.score > (u.stats.silBest || 0)) u.stats.silBest = this.score;
    });
    Game.checkAchievements();
    Game.syncCloud();
    if (this.score / total >= 0.7) Sound.win();
    res.appendChild(el('h2', null, 'Результат'));
    res.appendChild(el('div','result-score', this.score + ' / ' + total));
    res.appendChild(el('p','muted','Узнано силуэтов: ' + this.score + '.'));
    const row = el('div','row');
    const again = el('button','btn btn--primary','Ещё раз'); again.type = 'button';
    again.onclick = () => this.start();
    const share = el('button','btn','📤 Поделиться'); share.type = 'button';
    share.onclick = () => showShareModal({
      title:'Угадай по силуэту', score: this.score, total, xp: this.score * 15
    });
    row.append(again, share);
    res.appendChild(row);
  }
};

/* =========================================================
   ИГРА «НАЙДИ ЛИШНЕЕ»
   ========================================================= */
const Odd = {
  list:[], idx:0, score:0, locked:false,
  reset(){
    document.getElementById('oddStart').hidden = false;
    document.getElementById('oddGame').hidden = true;
    document.getElementById('oddResult').hidden = true;
    document.getElementById('oddStartBtn').onclick = () => this.start();
  },
  start(){
    const rounds = [];
    const eligibleCats = CATEGORIES.filter(c => WEAPONS.filter(w => w.category === c.id).length >= 3);
    for (let i = 0; i < 8; i++){
      const cats = shuffle(eligibleCats);
      if (cats.length < 2) continue;
      const cMain = cats[0];
      const cOdd  = cats.find(c => c.id !== cMain.id);
      const main3 = shuffle(WEAPONS.filter(w => w.category === cMain.id)).slice(0, 3);
      const odd1  = shuffle(WEAPONS.filter(w => w.category === cOdd.id))[0];
      rounds.push({ items: shuffle([...main3, odd1]), correctId: odd1.id });
    }
    this.list = rounds;
    this.idx = 0; this.score = 0;
    document.getElementById('oddStart').hidden = true;
    document.getElementById('oddResult').hidden = true;
    document.getElementById('oddGame').hidden = false;
    document.getElementById('oddTotal').textContent = this.list.length;
    this.render();
  },
  render(){
    const r = this.list[this.idx]; this.locked = false;
    document.getElementById('oddNum').textContent = this.idx + 1;
    document.getElementById('oddScore').textContent = this.score;
    const grid = document.getElementById('oddGrid'); grid.innerHTML = '';
    r.items.forEach(w => {
      const card = el('button','odd-card'); card.type = 'button';
      card.appendChild(el('div','odd-card__icon', w.emoji));
      card.appendChild(el('div','odd-card__name', w.name));
      card.onclick = () => this.answer(w.id, card);
      grid.appendChild(card);
    });
  },
  answer(id, card){
    if (this.locked) return;
    this.locked = true;
    const r = this.list[this.idx];
    const cards = $$('#oddGrid .odd-card');
    cards.forEach(c => c.disabled = true);
    if (id === r.correctId){
      card.classList.add('correct');
      this.score++;
      document.getElementById('oddScore').textContent = this.score;
      Game.addCorrect(); Game.addXp(15); Sound.ok(); vibrate(25);
    } else {
      card.classList.add('wrong');
      const idx = r.items.findIndex(x => x.id === r.correctId);
      if (cards[idx]) cards[idx].classList.add('correct');
      Game.addWrong(); Sound.err(); vibrate([40,40,40]);
    }
    setTimeout(() => {
      this.idx++;
      if (this.idx < this.list.length) this.render(); else this.finish();
    }, 1100);
  },
  finish(){
    document.getElementById('oddGame').hidden = true;
    const res = document.getElementById('oddResult');
    res.hidden = false; res.innerHTML = '';
    const total = this.list.length;
    Users.update(u => {
      u.stats.oddGames = (u.stats.oddGames || 0) + 1;
      if (this.score > (u.stats.oddBest || 0)) u.stats.oddBest = this.score;
    });
    Game.checkAchievements();
    Game.syncCloud();
    if (this.score / total >= 0.7) Sound.win();
    res.appendChild(el('h2', null, 'Результат'));
    res.appendChild(el('div','result-score', this.score + ' / ' + total));
    const row = el('div','row');
    const again = el('button','btn btn--primary','Ещё раз'); again.type = 'button';
    again.onclick = () => this.start();
    const share = el('button','btn','📤 Поделиться'); share.type = 'button';
    share.onclick = () => showShareModal({
      title:'Найди лишнее', score: this.score, total, xp: this.score * 15
    });
    row.append(again, share);
    res.appendChild(row);
  }
};

/* =========================================================
   ИГРА «ДУЭЛЬ»
   ========================================================= */
const Duel = {
  questions: [], turn: 1, round: 0,
  scores: { 1:0, 2:0 },
  names: { 1:'Игрок 1', 2:'Игрок 2' },
  locked: false, timer: null, timerSec: 0, timerMax: 20, lastXp: 0,

  reset(){
    this.stopTimer();
    document.getElementById('duelSetup').hidden = false;
    document.getElementById('duelGame').hidden = true;
    document.getElementById('duelResult').hidden = true;
    document.getElementById('duelStartBtn').onclick = () => {
      const n1 = (document.getElementById('duelP1').value || '').trim() || 'Игрок 1';
      const n2 = (document.getElementById('duelP2').value || '').trim() || 'Игрок 2';
      if (n1 === n2) return toast('Позывные должны различаться');
      this.start(n1, n2);
    };
  },

  start(n1, n2){
    this.questions = shuffle(QUIZ).slice(0, 10);
    this.names = { 1:n1, 2:n2 };
    this.scores = { 1:0, 2:0 };
    this.turn = 1; this.round = 0; this.locked = false; this.lastXp = 0;

    document.getElementById('duelSetup').hidden = true;
    document.getElementById('duelResult').hidden = true;
    document.getElementById('duelGame').hidden = false;
    document.getElementById('duelName1').textContent = n1;
    document.getElementById('duelName2').textContent = n2;
    document.getElementById('duelTotal').textContent = this.questions.length;
    this.render();
  },

  render(){
    const q = this.questions[this.round];
    this.locked = false;

    document.getElementById('duelCard1').classList.toggle('active', this.turn === 1);
    document.getElementById('duelCard2').classList.toggle('active', this.turn === 2);
    document.getElementById('duelScore1').textContent = this.scores[1] + ' / ' + this.questions.length;
    document.getElementById('duelScore2').textContent = this.scores[2] + ' / ' + this.questions.length;
    document.getElementById('duelTurn').textContent = 'Ход: ' + this.names[this.turn];
    document.getElementById('duelNum').textContent = this.round + 1;

    const w = WEAPONS.find(x => x.id === q.weapon);
    const box = document.getElementById('duelImg'); box.innerHTML = '';
    const src = w ? weaponImageSrc(w) : null;
    if (src){
      const img = el('img');
      img.src = src; img.alt = '';
      img.onerror = () => { img.remove(); box.textContent = w ? w.emoji : '❓'; };
      box.appendChild(img);
    } else box.textContent = w ? w.emoji : '❓';

    document.getElementById('duelText').textContent = q.text;
    const opts = document.getElementById('duelOpts'); opts.innerHTML = '';
    q.options.forEach((t, i) => {
      const b = el('button','opt', t); b.type = 'button';
      b.onclick = () => this.answer(i, b);
      opts.appendChild(b);
    });

    this.startTimer();
  },

  startTimer(){
    this.stopTimer();
    this.timerSec = this.timerMax;
    document.getElementById('duelTimerText').textContent = this.timerSec;
    document.getElementById('duelTimerBar').style.width = '100%';
    this.timer = setInterval(() => {
      this.timerSec--;
      document.getElementById('duelTimerText').textContent = Math.max(0, this.timerSec);
      document.getElementById('duelTimerBar').style.width =
        Math.max(0, (this.timerSec / this.timerMax) * 100) + '%';
      if (this.timerSec <= 0){
        this.stopTimer();
        this.answer(-1, null);
      }
    }, 1000);
  },
  stopTimer(){
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  },

  answer(i, btn){
    if (this.locked) return;
    this.locked = true;
    this.stopTimer();

    const q = this.questions[this.round];
    const buttons = $$('#duelOpts .opt');
    buttons.forEach(b => b.disabled = true);

    if (i === q.correct){
      btn.classList.add('correct');
      this.scores[this.turn]++;
      Sound.ok(); vibrate(25);
    } else {
      if (btn) btn.classList.add('wrong');
      if (buttons[q.correct]) buttons[q.correct].classList.add('correct');
      Sound.err(); vibrate([40,40,40]);
      if (i === -1) toast('Время вышло');
    }

    document.getElementById('duelScore1').textContent =
      this.scores[1] + ' / ' + this.questions.length;
    document.getElementById('duelScore2').textContent =
      this.scores[2] + ' / ' + this.questions.length;

    setTimeout(() => {
      this.round++;
      this.turn = this.turn === 1 ? 2 : 1;
      if (this.round < this.questions.length) this.render();
      else this.finish();
    }, 1200);
  },

  finish(){
    this.stopTimer();
    document.getElementById('duelGame').hidden = true;
    const res = document.getElementById('duelResult');
    res.hidden = false; res.innerHTML = '';
    const { 1:p1, 2:p2 } = this.scores;

    let title = '🤝 Ничья!';
    let winner = null;
    if (p1 > p2){ title = '🏆 Победа: ' + this.names[1]; winner = 1; }
    if (p2 > p1){ title = '🏆 Победа: ' + this.names[2]; winner = 2; }

    res.appendChild(el('h2', null, title));

    const table = el('table','specs');
    [1, 2].forEach(k => {
      const tr = el('tr');
      tr.appendChild(el('th', null, this.names[k]));
      tr.appendChild(el('td', null, this.scores[k] + ' / ' + this.questions.length));
      table.appendChild(tr);
    });
    res.appendChild(table);

    const me = Users.current();
    if (me){
      let myScore = null;
      if (this.names[1] === me) myScore = p1;
      if (this.names[2] === me) myScore = p2;
      this.lastXp = (myScore != null) ? myScore * 5 : 3;

      Game.addXp(this.lastXp);
      Game.checkAchievements();
      Users.update(u => {
        u.stats.duelGames = (u.stats.duelGames || 0) + 1;
        if (winner && this.names[winner] === me) u.stats.duelWins = (u.stats.duelWins || 0) + 1;
      });
      Game.syncCloud();
    }
    if (p1 !== p2) Sound.win();

    const row = el('div','row');
    const again = el('button','btn btn--primary','Ещё дуэль'); again.type = 'button';
    again.onclick = () => this.reset();
    const share = el('button','btn','📤 Поделиться'); share.type = 'button';
    share.onclick = () => showShareModal({
      title:'Дуэль', score: p1 + ' : ' + p2, total: '', xp: this.lastXp,
      subtitle: this.names[1] + ' vs ' + this.names[2]
    });
    row.append(again, share);
    res.appendChild(row);
  }
};

/* =========================================================
   ИГРА «ЕЖЕДНЕВНЫЙ ВЫЗОВ»
   ========================================================= */
const Daily = {
  weapon: null, questions: [],
  idx: 0, score: 0, locked: false, firstToday: false,

  dayKey(){ return todayKey(); },

  pickWeapon(){
    const key = this.dayKey();
    let h = 0;
    for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
    return WEAPONS[Math.abs(h) % WEAPONS.length];
  },

  buildQuestions(w){
    const entries = Object.entries(w.specs);
    const picked = shuffle(entries).slice(0, 3);
    return picked.map(([key, val]) => {
      const pool = WEAPONS
        .filter(x => x.id !== w.id && x.specs[key] && x.specs[key] !== val)
        .map(x => x.specs[key]);
      let wrongs = shuffle(pool).slice(0, 3);
      while (wrongs.length < 3){
        const rw = WEAPONS[Math.floor(Math.random() * WEAPONS.length)];
        const vals = Object.values(rw.specs).filter(v => v !== val && !wrongs.includes(v));
        if (!vals.length) break;
        wrongs.push(vals[Math.floor(Math.random() * vals.length)]);
      }
      while (wrongs.length < 3) wrongs.push('—');

      const options = shuffle([val, ...wrongs.slice(0, 3)]);
      return {
        text: `«${w.name}» — чему равно значение «${key}»?`,
        options, correct: options.indexOf(val)
      };
    });
  },

  reset(){
    this.weapon = this.pickWeapon();
    this.questions = this.buildQuestions(this.weapon);
    this.idx = 0; this.score = 0; this.locked = false;

    document.getElementById('dailyStart').hidden = false;
    document.getElementById('dailyGame').hidden = true;
    document.getElementById('dailyResult').hidden = true;

    document.getElementById('dailyIcon').textContent = this.weapon.emoji;
    document.getElementById('dailyName').textContent = this.weapon.name;
    document.getElementById('dailyShort').textContent = this.weapon.short;
    document.getElementById('dailyTotal').textContent = this.questions.length;

    const d = new Date();
    const months = ['янв','фев','мар','апр','мая','июн','июл','авг','сен','окт','ноя','дек'];
    document.getElementById('dailyDate').textContent =
      d.getDate() + ' ' + months[d.getMonth()];

    const user = Users.data();
    const done = user && user.dailyDone && user.dailyDone[this.dayKey()];
    this.firstToday = !done;
    const st = document.getElementById('dailyStatus');
    const btn = document.getElementById('dailyStartBtn');
    if (!Users.current()){
      st.textContent = 'Войдите, чтобы сохранять результат и получать XP.';
      btn.disabled = false; btn.textContent = 'Пройти вызов';
    } else if (done){
      st.innerHTML = `Сегодня уже пройдено: <b>${done.score} / ${done.total}</b>. ` +
        `Повторное прохождение — уменьшенный бонус.`;
      btn.disabled = false; btn.textContent = 'Пройти снова';
    } else {
      st.textContent = 'Первое прохождение дня — бонус +50 XP.';
      btn.disabled = false; btn.textContent = 'Пройти вызов дня';
    }
    btn.onclick = () => this.start();
  },

  start(){
    this.idx = 0; this.score = 0; this.locked = false;
    document.getElementById('dailyStart').hidden = true;
    document.getElementById('dailyResult').hidden = true;
    document.getElementById('dailyGame').hidden = false;
    this.render();
  },

  render(){
    const q = this.questions[this.idx];
    this.locked = false;
    document.getElementById('dailyNum').textContent = this.idx + 1;
    document.getElementById('dailyScore').textContent = this.score;

    const img = document.getElementById('dailyImg');
    img.innerHTML = '';
    const src = weaponImageSrc(this.weapon);
    if (src){
      const im = el('img');
      im.src = src; im.alt = '';
      im.onerror = () => { im.remove(); img.textContent = this.weapon.emoji; };
      img.appendChild(im);
    } else img.textContent = this.weapon.emoji;

    document.getElementById('dailyText').textContent = q.text;
    const opts = document.getElementById('dailyOpts'); opts.innerHTML = '';
    q.options.forEach((t, i) => {
      const b = el('button','opt', t); b.type = 'button';
      b.onclick = () => this.answer(i, b);
      opts.appendChild(b);
    });
  },

  answer(i, btn){
    if (this.locked) return;
    this.locked = true;
    const q = this.questions[this.idx];
    const buttons = $$('#dailyOpts .opt');
    buttons.forEach(b => b.disabled = true);
    if (i === q.correct){
      btn.classList.add('correct'); this.score++;
      document.getElementById('dailyScore').textContent = this.score;
      Game.addCorrect(this.weapon.id); Sound.ok(); vibrate(25);
    } else {
      btn.classList.add('wrong');
      buttons[q.correct].classList.add('correct');
      Game.addWrong(this.weapon.id); Sound.err(); vibrate([40,40,40]);
    }
    setTimeout(() => {
      this.idx++;
      if (this.idx < this.questions.length) this.render();
      else this.finish();
    }, 1100);
  },

  finish(){
    document.getElementById('dailyGame').hidden = true;
    const res = document.getElementById('dailyResult');
    res.hidden = false; res.innerHTML = '';
    const total = this.questions.length;
    const key = this.dayKey();
    const alreadyDone = !this.firstToday;

    if (Users.current()){
      Users.update(u => {
        u.dailyDone = u.dailyDone || {};
        if (!u.dailyDone[key]) u.dailyDone[key] = { score: this.score, total };
      });
    }

    const base = this.score * 10;
    const bonus = alreadyDone ? 10 : 50;
    const gained = base + bonus;

    if (Users.current()){
      Game.addXp(gained);
      Game.checkAchievements();
      Game.syncCloud();
    }
    if (this.score === total) Sound.win();

    res.appendChild(el('h2', null, '🎯 Результат дня'));
    res.appendChild(el('div','result-score', this.score + ' / ' + total));
    res.appendChild(el('p','muted', alreadyDone
      ? 'Повторное прохождение: +' + gained + ' XP.'
      : 'Первое прохождение: +' + gained + ' XP (включая бонус +50).'));

    const more = el('button','btn','📖 Подробнее об образце');
    more.type = 'button';
    more.onclick = () => openCard(this.weapon.id);
    res.appendChild(more);

    const row = el('div','row');
    const again = el('button','btn','Закрыть'); again.type = 'button';
    again.onclick = () => this.reset();
    const share = el('button','btn btn--primary','📤 Поделиться'); share.type = 'button';
    share.onclick = () => showShareModal({
      title:'Ежедневный вызов', score: this.score, total, xp: gained,
      subtitle: this.weapon.name
    });
    row.append(again, share);
    res.appendChild(row);
  }
};

/* =========================================================
   АВАТАРЫ
   ========================================================= */
function renderAvatarInto(container, value){
  container.innerHTML = '';
  const v = value || '🎖️';
  if (typeof v === 'string' && v.startsWith('data:image')){
    const img = el('img');
    img.src = v; img.alt = 'avatar';
    container.appendChild(img);
  } else {
    container.textContent = v;
  }
}

function resizeImageFile(file, maxSize = 240){
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')){
      reject(new Error('Не картинка')); return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = ev => {
      const img = new Image();
      img.onerror = () => reject(new Error('Ошибка чтения изображения'));
      img.onload = () => {
        const ratio = Math.min(maxSize / img.width, maxSize / img.height, 1);
        const w = Math.max(1, Math.round(img.width * ratio));
        const h = Math.max(1, Math.round(img.height * ratio));
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#191d15';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  });
}

function openAvatarPicker(){
  const user = Users.data();
  if (!user) return;

  const curBox = document.getElementById('avatarCurrent');
  curBox.innerHTML = '';
  const curPreview = el('div','avatar-current__preview');
  renderAvatarInto(curPreview, user.avatar);
  curBox.appendChild(curPreview);
  const curLabel = el('div','muted small',
    user.avatar && user.avatar.startsWith('data:image') ? 'Загруженное фото' : 'Эмодзи');
  curBox.appendChild(curLabel);

  const picker = document.getElementById('avatarPicker');
  picker.innerHTML = '';
  const current = user.avatar || '🎖️';
  const isCustom = typeof current === 'string' && current.startsWith('data:image');
  AVATARS.forEach(a => {
    const b = el('button','avatar-opt' + (!isCustom && a === current ? ' selected' : ''), a);
    b.type = 'button';
    b.onclick = () => {
      Users.update(u => { u.avatar = a; });
      toast('Аватар обновлён');
      Sound.tap();
      openAvatarPicker();
    };
    picker.appendChild(b);
  });

  const resetBtn = document.getElementById('avatarResetBtn');
  resetBtn.hidden = !isCustom;
  resetBtn.onclick = () => {
    Users.update(u => { u.avatar = '🎖️'; });
    toast('Возвращён стандартный аватар');
    openAvatarPicker();
  };

  const fileInput = document.getElementById('avatarFileInput');
  document.getElementById('avatarUploadBtn').onclick = () => fileInput.click();
  fileInput.onchange = async () => {
    const f = fileInput.files && fileInput.files[0];
    fileInput.value = '';
    if (!f) return;
    try {
      const dataUrl = await resizeImageFile(f, 240);
      Users.update(u => { u.avatar = dataUrl; });
      toast('Фото загружено');
      Sound.ok();
      openAvatarPicker();
    } catch (e){
      toast('Не удалось загрузить изображение');
      console.error(e);
    }
  };

  document.getElementById('avatarModal').hidden = false;
}
function closeAvatarModal(){
  document.getElementById('avatarModal').hidden = true;
  renderProfile();
}

/* =========================================================
   РЕЙТИНГ (из облака Firebase)
   ========================================================= */
function renderRating(){
  const box = document.getElementById('leaderboard');
  box.innerHTML = '<p class="muted">Загрузка рейтинга…</p>';

  const render = rows => {
    box.innerHTML = '';
    if (!rows.length){
      box.appendChild(el('p','muted','Пока нет ни одного игрока. Сыграйте первую игру!'));
      return;
    }
    const me = Users.current();
    rows.forEach((r, i) => {
      const row = el('div','lb-row' + (r.nick === me ? ' me' : ''));
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i + 1);
      row.appendChild(el('div','lb-row__rank', String(medal)));

      const av = el('div','lb-avatar');
      renderAvatarInto(av, r.avatar || '🎖️');
      row.appendChild(av);

      const nameCell = el('div','lb-row__name');
      nameCell.appendChild(document.createTextNode(r.nick + (r.nick === me ? ' (вы)' : '')));
      nameCell.appendChild(el('small','', r.rank || ''));
      row.appendChild(nameCell);
      row.appendChild(el('div','lb-row__xp', (r.xp || 0) + ' XP'));
      box.appendChild(row);
    });
  };

  // Пробуем облако
  if (window.Cloud && Cloud.ready){
    Cloud.watchLeaderboard(render);
    return;
  }

  // Если Cloud ещё не готов — показываем локальные данные
  const all = Users.all();
  const localRows = Object.entries(all).map(([nick, u]) => ({
    nick, xp: u.xp || 0, rank: Rank.current(u.xp || 0).name, avatar: u.avatar || '🎖️'
  })).sort((a, b) => b.xp - a.xp);
  render(localRows);

  // И подписываемся на облако, когда оно будет готово
  if (window.Cloud){
    Cloud.onReady(() => Cloud.watchLeaderboard(render));
  }
}

/* =========================================================
   ПРОФИЛЬ
   ========================================================= */
function renderProfile(){
  const user = Users.current();
  document.getElementById('authBox').hidden = !!user;
  document.getElementById('profileBox').hidden = !user;
  if (!user){ bindAuthForms(); return; }

  const d = Users.data();
  const r = Rank.current(d.xp || 0);
  const n = Rank.next(d.xp || 0);

  document.getElementById('pName').textContent = user;
  renderAvatarInto(document.getElementById('pAvatar'), d.avatar || r.icon);
  document.getElementById('pSince').textContent =
    'В деле с ' + new Date(d.created).toLocaleDateString('ru-RU');

  const ep = document.getElementById('pEpaulette');
  ep.innerHTML = '';
  const oldRank = ep.parentElement.querySelector('.rank-line');
  if (oldRank) oldRank.remove();
  for (let i = 0; i < (r.stars || 0); i++) ep.appendChild(el('span','star'));
  const rankLine = el('div','muted small rank-line', r.icon + ' ' + r.name);
  rankLine.style.marginTop = '2px';
  ep.parentElement.insertBefore(rankLine, ep.nextSibling);

  document.getElementById('pXp').textContent = d.xp || 0;
  const curBase = r.xp;
  const nextXp = n ? n.xp : r.xp;
  const pct = n ? Math.min(100, Math.round((d.xp - curBase) / (nextXp - curBase) * 100)) : 100;
  document.getElementById('xpFill').style.width = pct + '%';
  document.getElementById('xpNext').textContent =
    n ? 'до «' + n.name + '» ещё ' + (n.xp - d.xp) + ' XP' : 'Максимум достигнут';

  document.getElementById('sQuiz').textContent   = d.stats.quizBest || 0;
  document.getElementById('sMatch').textContent  = d.stats.matchBest == null ? '—' : d.stats.matchBest + ' х.';
  document.getElementById('sGames').textContent  =
    (d.stats.quizGames||0) + (d.stats.matchGames||0) + (d.stats.silGames||0) +
    (d.stats.oddGames||0) + (d.stats.duelGames||0) + (d.stats.tfGames||0) +
    (d.stats.reactGames||0) + (d.stats.gunsmithGames||0) + (d.stats.tacticGames||0) +
    (d.stats.wordGames||0);
  document.getElementById('sStreak').textContent = d.streak || 0;

  const bb = document.getElementById('badgesBox'); bb.innerHTML = '';
  ACHIEVEMENTS.forEach(a => {
    const own = (d.achievements || []).includes(a.id);
    const b = el('div','badge' + (own ? '' : ' locked'));
    b.appendChild(el('div','badge__icon', a.icon));
    b.appendChild(el('div','badge__name', a.name));
    b.appendChild(el('div','badge__desc', a.desc));
    bb.appendChild(b);
  });

  const grid = document.getElementById('collectionGrid'); grid.innerHTML = '';
  const items = WEAPONS.filter(w => (d.collection || []).includes(w.id));
  if (!items.length){
    grid.appendChild(el('p','muted','Коллекция пуста. Открой карточку и нажми «В коллекцию».'));
  } else items.forEach(w => grid.appendChild(weaponCard(w)));

  document.getElementById('logoutBtn').onclick = () => {
    Users.logout(); toast('Вы вышли'); renderProfile();
  };
  document.getElementById('avatarBtn').onclick = () => openAvatarPicker();
  document.getElementById('shareProfileBtn').onclick = () => showShareModal({
    title: 'Профиль', score: d.xp || 0, total: ' XP', xp: 0,
    subtitle: Rank.current(d.xp || 0).name
  });
}

function bindAuthForms(){
  $$('.switch__btn').forEach(btn => {
    btn.onclick = () => {
      $$('.switch__btn').forEach(b => b.classList.toggle('active', b === btn));
      document.getElementById('formQr').hidden   = btn.dataset.form !== 'qr';
      document.getElementById('formNick').hidden = btn.dataset.form !== 'nick';
    };
  });
  document.getElementById('qrEnterBtn').onclick = () => {
    const code = (document.getElementById('qrCode').value || '').trim().toLowerCase();
    if (!code) return toast('Введите код');
    handleQrCard(code);
  };
  document.getElementById('nickEnterBtn').onclick = () => {
    const nick = (document.getElementById('nickInput').value || '').trim();
    const word = (document.getElementById('wordInput').value || '').trim();
    if (word !== CODEWORD) return toast('Неверное кодовое слово');
    const res = Users.ensure(nick);
    if (!res.ok) return toast(res.error);
    toast('Добро пожаловать, ' + nick);
    Game.tickStreak();
    Game.syncCloud();
    renderProfile();
  };
}

function bindExchange(){
  document.getElementById('exchangeBtn').onclick = () => {
    const raw = (document.getElementById('exchangeInput').value || '').trim();
    if (!raw) return;
    let id = raw;
    const m = raw.match(/card=([a-z0-9_-]+)/i);
    if (m) id = m[1];
    id = id.replace(/^#/, '').toLowerCase();
    const w = WEAPONS.find(x => x.id === id);
    if (!w) return toast('Карточка не найдена');
    Game.addToCollection(w.id);
    document.getElementById('exchangeInput').value = '';
    renderProfile();
    toast('Добавлено: ' + w.name);
  };
}

/* =========================================================
   СТРАНИЦА ПРЕПОДАВАТЕЛЯ
   ========================================================= */
function renderTeacher(){
  const all = Users.all();
  const nicks = Object.keys(all);

  const stats = document.getElementById('teacherStats');
  stats.innerHTML = '';
  const totalPlayers = nicks.length;
  const totalGames = nicks.reduce((sum, n) => {
    const s = all[n].stats || {};
    return sum + (s.quizGames||0) + (s.matchGames||0) + (s.silGames||0) +
                 (s.oddGames||0) + (s.duelGames||0) + (s.tfGames||0) +
                 (s.reactGames||0) + (s.gunsmithGames||0) + (s.tacticGames||0) +
                 (s.wordGames||0);
  }, 0);
  const totalXp = nicks.reduce((sum, n) => sum + (all[n].xp || 0), 0);
  const totalCorrect = nicks.reduce((sum, n) => sum + (all[n].stats?.correct || 0), 0);

  [['Игроков', totalPlayers], ['Игр сыграно', totalGames],
   ['Всего XP', totalXp], ['Правильных', totalCorrect]].forEach(([label, val]) => {
    const c = el('div','tcard');
    c.appendChild(el('b', null, String(val)));
    c.appendChild(el('span', null, label));
    stats.appendChild(c);
  });

  const box = document.getElementById('teacherPlayers');
  box.innerHTML = '';
  if (!nicks.length){
    box.appendChild(el('p','muted','Нет данных — никто ещё не входил.'));
  } else {
    const rows = nicks.map(n => {
      const u = all[n], s = u.stats || {};
      const games = (s.quizGames||0) + (s.matchGames||0) + (s.silGames||0) +
                    (s.oddGames||0) + (s.duelGames||0) + (s.tfGames||0) +
                    (s.reactGames||0) + (s.gunsmithGames||0) + (s.tacticGames||0) +
                    (s.wordGames||0);
      const acc = (s.correct || 0) + (s.wrong || 0) > 0
        ? Math.round((s.correct || 0) / ((s.correct || 0) + (s.wrong || 0)) * 100) + '%'
        : '—';
      return { nick:n, xp: u.xp || 0, rank: Rank.current(u.xp || 0).name, games, acc };
    }).sort((a, b) => b.xp - a.xp);

    rows.forEach((r, i) => {
      const row = el('div','lb-row');
      row.appendChild(el('div','lb-row__rank', String(i + 1)));
      const nameCell = el('div','lb-row__name');
      nameCell.appendChild(document.createTextNode(r.nick));
      nameCell.appendChild(el('small','', r.rank + ' · игр: ' + r.games + ' · точность: ' + r.acc));
      row.appendChild(nameCell);
      row.appendChild(el('div','lb-row__xp', r.xp + ' XP'));
      box.appendChild(row);
    });
  }

  const hard = document.getElementById('teacherHard');
  hard.innerHTML = '';
  const perWeapon = {};
  nicks.forEach(n => {
    const qs = all[n].stats?.qstats || {};
    Object.entries(qs).forEach(([wid, { c, w }]) => {
      const s = perWeapon[wid] = perWeapon[wid] || { c:0, w:0 };
      s.c += c; s.w += w;
    });
  });
  const items = Object.entries(perWeapon).map(([wid, { c, w }]) => {
    const total = c + w;
    return { wid, total, pct: total ? Math.round(w / total * 100) : 0 };
  }).filter(x => x.total >= 2).sort((a, b) => b.pct - a.pct).slice(0, 8);

  if (!items.length){
    hard.appendChild(el('p','muted','Пока нет данных: нужно больше ответов.'));
  } else {
    items.forEach(it => {
      const w = WEAPONS.find(x => x.id === it.wid);
      if (!w) return;
      const row = el('div','lb-row');
      const e = el('div', null, w.emoji);
      e.style.fontSize = '1.5rem';
      row.appendChild(e);
      const cell = el('div','lb-row__name');
      cell.appendChild(document.createTextNode(w.name));
      cell.appendChild(el('small','', 'ответов: ' + it.total));
      row.appendChild(cell);
      row.appendChild(el('div','lb-row__xp', it.pct + '% ошибок'));
      hard.appendChild(row);
    });
  }
}

/* =========================================================
   PNG-ЭКСПОРТ
   ========================================================= */
async function generateResultPng({ title, score, total, xp, subtitle }){
  const W = 1080, H = 1350;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');

  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#0d0f0c');
  g.addColorStop(1, '#161a10');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  const r1 = ctx.createRadialGradient(180, 200, 0, 180, 200, 700);
  r1.addColorStop(0, 'rgba(143,167,99,.22)');
  r1.addColorStop(1, 'rgba(143,167,99,0)');
  ctx.fillStyle = r1; ctx.fillRect(0, 0, W, H);

  const r2 = ctx.createRadialGradient(W - 100, H - 200, 0, W - 100, H - 200, 700);
  r2.addColorStop(0, 'rgba(139,157,195,.18)');
  r2.addColorStop(1, 'rgba(139,157,195,0)');
  ctx.fillStyle = r2; ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = 'rgba(143,167,99,.07)';
  ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 40){ ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 0; y < H; y += 40){ ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

  ctx.strokeStyle = 'rgba(143,167,99,.4)';
  ctx.lineWidth = 2;
  ctx.strokeRect(40, 40, W - 80, H - 80);

  ctx.strokeStyle = '#b4c883';
  ctx.lineWidth = 4;
  const C = 50;
  [[40, 40], [W - 40, 40], [40, H - 40], [W - 40, H - 40]].forEach(([x, y]) => {
    const sx = x < W / 2 ? 1 : -1;
    const sy = y < H / 2 ? 1 : -1;
    ctx.beginPath();
    ctx.moveTo(x + sx * C, y); ctx.lineTo(x, y); ctx.lineTo(x, y + sy * C);
    ctx.stroke();
  });

  ctx.fillStyle = '#8fa763';
  ctx.font = '600 26px "JetBrains Mono", ui-monospace, monospace';
  ctx.textAlign = 'left';
  ctx.fillText('// ОРУЖИЕ ПОБЕДЫ', 80, 130);

  ctx.fillStyle = '#e9ece3';
  ctx.font = '700 78px Oswald, system-ui, sans-serif';
  ctx.fillText('РЕЗУЛЬТАТ', 80, 220);

  ctx.fillStyle = '#8e9884';
  ctx.font = '400 26px Inter, system-ui, sans-serif';
  ctx.fillText(title, 80, 275);

  drawEpaulette(ctx, 80, 330, 260, 70, Rank.current(Users.data()?.xp || 0).stars || 0);

  ctx.fillStyle = '#e9ece3';
  ctx.font = '700 42px Oswald, system-ui, sans-serif';
  ctx.fillText(Users.current() || 'Гость', 80, 470);

  ctx.fillStyle = '#b4c883';
  ctx.font = '500 26px Oswald, system-ui, sans-serif';
  ctx.fillText(Rank.current(Users.data()?.xp || 0).name, 80, 505);

  ctx.fillStyle = '#b4c883';
  ctx.font = '700 200px Oswald, system-ui, sans-serif';
  ctx.textAlign = 'center';
  const scoreText = String(score);
  const totalText = total ? String(total) : '';
  const scoreY = 800;
  ctx.fillText(scoreText, W / 2 - (totalText ? 100 : 0), scoreY);

  if (totalText){
    ctx.fillStyle = '#8e9884';
    ctx.font = '500 100px Oswald, system-ui, sans-serif';
    ctx.fillText('/ ' + totalText, W / 2 + 130, scoreY - 20);
  }
  ctx.textAlign = 'left';

  ctx.fillStyle = '#8e9884';
  ctx.font = '400 24px Inter, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(subtitle || 'правильных ответов', W / 2, scoreY + 60);
  ctx.textAlign = 'left';

  if (xp){
    ctx.fillStyle = '#8e9884';
    ctx.font = '500 26px JetBrains Mono, monospace';
    ctx.fillText('ОПЫТ ЗА ИГРУ', 80, H - 260);
    ctx.fillStyle = '#f4a261';
    ctx.font = '700 60px Oswald, system-ui, sans-serif';
    ctx.fillText('+' + xp + ' XP', 80, H - 200);
  }

  const now = new Date();
  const dateStr = now.toLocaleDateString('ru-RU', { day:'2-digit', month:'long', year:'numeric' }) +
                  ' · ' + now.toLocaleTimeString('ru-RU', { hour:'2-digit', minute:'2-digit' });
  ctx.fillStyle = '#8e9884';
  ctx.font = '400 22px JetBrains Mono, monospace';
  ctx.fillText(dateStr, 80, H - 130);

  ctx.fillStyle = '#5f6d5c';
  ctx.font = '400 20px Inter, system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('Тема 52 · РЭУ им. Г.В. Плеханова', W - 80, H - 130);
  ctx.textAlign = 'left';

  return canvas.toDataURL('image/png');
}

function drawEpaulette(ctx, x, y, w, h, stars){
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, '#b83b3b'); g.addColorStop(1, '#7c1f1f');
  ctx.fillStyle = g;
  roundRect(ctx, x, y, w, h, 10); ctx.fill();

  ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.lineWidth = 2;
  roundRect(ctx, x, y, w, h, 10); ctx.stroke();

  ctx.strokeStyle = 'rgba(255,255,255,.15)'; ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + w / 2, y + 4); ctx.lineTo(x + w / 2, y + h - 4); ctx.stroke();

  const count = Math.min(stars, 5);
  if (count <= 0) return;
  const starR = 14, gap = 22;
  const totalW = count * (starR * 2) + (count - 1) * (gap - starR * 2);
  const startX = x + (w - totalW) / 2 + starR;
  const cy = y + h / 2;
  ctx.fillStyle = '#f4a261';
  for (let i = 0; i < count; i++) drawStar(ctx, startX + i * gap, cy, starR, 5, 0.45);
}
function drawStar(ctx, cx, cy, r, points, innerRatio){
  const step = Math.PI / points;
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++){
    const r2 = i % 2 === 0 ? r : r * innerRatio;
    const a = i * step - Math.PI / 2;
    const px = cx + Math.cos(a) * r2;
    const py = cy + Math.sin(a) * r2;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath(); ctx.fill();
}
function roundRect(ctx, x, y, w, h, r){
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

let currentPng = null;
let currentShareData = null;

async function showShareModal(data){
  currentShareData = data;
  const prev = document.getElementById('sharePreview');
  prev.innerHTML = '<p class="muted small">Готовим картинку…</p>';
  document.getElementById('shareModal').hidden = false;

  try {
    const dataUrl = await generateResultPng(data);
    currentPng = dataUrl;
    prev.innerHTML = '';
    const img = el('img');
    img.src = dataUrl; img.alt = 'Результат';
    prev.appendChild(img);
  } catch (e){
    prev.textContent = 'Не удалось создать картинку';
    console.error(e);
  }
}

function downloadPng(){
  if (!currentPng) return;
  const a = document.createElement('a');
  a.href = currentPng;
  a.download = 'oruzhie-pobedy-' + Date.now() + '.png';
  a.click();
  toast('Картинка сохранена');
}
function shareNative(){
  if (!currentShareData) return;
  const { title, score, total, xp } = currentShareData;
  const text = `«Оружие Победы» — ${title}: ${score}${total ? ' / ' + total : ''}` +
               (xp ? ` (+${xp} XP)` : '');
  const url = location.origin + location.pathname;
  if (navigator.share) navigator.share({ title:'Оружие Победы', text, url }).catch(() => {});
  else if (navigator.clipboard) navigator.clipboard.writeText(text + ' ' + url).then(() => toast('Скопировано')).catch(() => toast(text));
  else prompt('Скопируйте:', text + ' ' + url);
}
function copyShareText(){
  if (!currentShareData) return;
  const { title, score, total, xp } = currentShareData;
  const text = `«Оружие Победы» — ${title}: ${score}${total ? ' / ' + total : ''}` +
               (xp ? ` (+${xp} XP)` : '');
  navigator.clipboard?.writeText(text).then(() => toast('Текст скопирован'));
}

/* =========================================================
   ЗАПУСК
   ========================================================= */
function initCloud(){
  if (window.Cloud){
    Cloud.init();
    Cloud.onReady(() => {
      const d = Users.data();
      if (d) Cloud.pushScore(Users.current(), d.xp || 0, d.stats, Rank.current(d.xp || 0).name);
    });
  } else {
    // cloud.js — модуль, он может выполниться чуть позже обычных скриптов
    setTimeout(initCloud, 200);
  }
}

function init(){
  applyOverrides();

  initCommonChrome();
  initCloud();
  initParallax();
  buildHome();
  initCatalogFilters();
  bindExchange();
  BG.init();

  $$('[data-back]').forEach(b => b.onclick = backToHub);

  document.getElementById('modal').onclick = e => {
    if (e.target.id === 'modal') closeModal();
  };
  document.getElementById('welcomeModal').onclick = e => {
    if (e.target.id === 'welcomeModal') document.getElementById('welcomeModal').hidden = true;
  };
  document.getElementById('avatarModal').onclick = e => {
    if (e.target.id === 'avatarModal') closeAvatarModal();
  };
  document.getElementById('avatarClose').onclick = () => closeAvatarModal();
  document.getElementById('shareModal').onclick = e => {
    if (e.target.id === 'shareModal') document.getElementById('shareModal').hidden = true;
  };
  document.getElementById('shareCloseBtn').onclick = () =>
    document.getElementById('shareModal').hidden = true;
  document.getElementById('shareDownloadBtn').onclick = downloadPng;
  document.getElementById('shareNativeBtn').onclick = shareNative;
  document.getElementById('shareCopyBtn').onclick = copyShareText;

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape'){
      closeModal();
      document.getElementById('welcomeModal').hidden = true;
      document.getElementById('avatarModal').hidden = true;
      document.getElementById('shareModal').hidden = true;
    }
  });

  window.addEventListener('hashchange', route);
  route();

  if (Users.current()) Game.tickStreak();

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')){
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

document.addEventListener('DOMContentLoaded', init);