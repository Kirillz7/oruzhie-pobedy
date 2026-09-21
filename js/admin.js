/* =========================================================
   ЛОГИКА admin.html
   Управление: вооружение, вопросы, достижения, игроки,
   QR-генератор (через публичный API), бэкап.
   ========================================================= */

const Admin = {
  editingType: null,
  editingIndex: -1,
  editingData: null,
  currentQrUrl: null,

  authed(){ return sessionStorage.getItem('ovp_admin') === '1'; },
  login(pwd){
    if (pwd === ADMIN_PASSWORD){ sessionStorage.setItem('ovp_admin', '1'); return true; }
    return false;
  },
  logout(){ sessionStorage.removeItem('ovp_admin'); },

  render(){
    const loginBox = document.getElementById('adminLogin');
    const panelBox = document.getElementById('adminPanel');
    if (!this.authed()){
      loginBox.hidden = false;
      panelBox.hidden = true;
      setTimeout(() => document.getElementById('adminPwd').focus(), 100);
      return;
    }
    loginBox.hidden = true;
    panelBox.hidden = false;
    this.renderWeapons();
    this.renderQuiz();
    this.renderAchievements();
    this.renderUsers();
    this.renderQrTab();
  },

  /* ---------- Вооружение ---------- */
  renderWeapons(){
    const box = document.getElementById('adminWeaponsList');
    box.innerHTML = '';
    if (!WEAPONS.length){
      box.appendChild(el('p','muted','Список пуст. Нажмите «Добавить образец».'));
      return;
    }
    WEAPONS.forEach((w, i) => {
      const cat = CATEGORIES.find(c => c.id === w.category);
      const row = el('div','admin-row');
      row.appendChild(el('div','admin-row__icon', w.emoji || '❓'));
      const cell = el('div','admin-row__main');
      cell.appendChild(el('div','admin-row__title', w.name));
      cell.appendChild(el('div','admin-row__sub',
        (cat ? cat.title : w.category) + ' · id: ' + w.id));
      row.appendChild(cell);
      const actions = el('div','admin-row__actions');
      const editBtn = el('button','btn btn--sm','✎'); editBtn.type = 'button';
      editBtn.onclick = () => this.editWeapon(i);
      const delBtn = el('button','btn btn--sm','🗑'); delBtn.type = 'button';
      delBtn.onclick = () => this.deleteWeapon(i);
      actions.append(editBtn, delBtn);
      row.appendChild(actions);
      box.appendChild(row);
    });
  },

  editWeapon(i){
    const w = i === -1 ? {
      id: 'new' + Date.now(),
      name: '', category: 'small', emoji: '🔫', img: null,
      short: '', specs: {}, fact: ''
    } : JSON.parse(JSON.stringify(WEAPONS[i]));
    this.editingType = 'weapon';
    this.editingIndex = i;
    this.editingData = w;
    this.showEditForm();
  },

  deleteWeapon(i){
    if (!confirm('Удалить «' + WEAPONS[i].name + '»?')) return;
    const list = WEAPONS.slice();
    list.splice(i, 1);
    DB.set(OVERRIDE_KEYS.weapons, list);
    WEAPONS.length = 0; WEAPONS.push(...list);
    this.renderWeapons();
    toast('Образец удалён');
  },

  /* ---------- Вопросы ---------- */
  renderQuiz(){
    const box = document.getElementById('adminQuizList');
    box.innerHTML = '';
    if (!QUIZ.length){
      box.appendChild(el('p','muted','Список пуст. Нажмите «Добавить вопрос».'));
      return;
    }
    QUIZ.forEach((q, i) => {
      const row = el('div','admin-row');
      const cell = el('div','admin-row__main');
      cell.appendChild(el('div','admin-row__title', q.text));
      cell.appendChild(el('div','admin-row__sub',
        'Вариантов: ' + (q.options?.length || 0) +
        ' · Правильный: ' + (q.options?.[q.correct] || '—')));
      row.appendChild(cell);
      const actions = el('div','admin-row__actions');
      const editBtn = el('button','btn btn--sm','✎'); editBtn.type = 'button';
      editBtn.onclick = () => this.editQuiz(i);
      const delBtn = el('button','btn btn--sm','🗑'); delBtn.type = 'button';
      delBtn.onclick = () => this.deleteQuiz(i);
      actions.append(editBtn, delBtn);
      row.appendChild(actions);
      box.appendChild(row);
    });
  },

  editQuiz(i){
    const q = i === -1 ? {
      weapon: WEAPONS[0]?.id || '',
      text: '', options: ['', '', '', ''], correct: 0
    } : JSON.parse(JSON.stringify(QUIZ[i]));
    while (q.options.length < 4) q.options.push('');
    this.editingType = 'quiz';
    this.editingIndex = i;
    this.editingData = q;
    this.showEditForm();
  },

  deleteQuiz(i){
    if (!confirm('Удалить вопрос?')) return;
    const list = QUIZ.slice();
    list.splice(i, 1);
    DB.set(OVERRIDE_KEYS.quiz, list);
    QUIZ.length = 0; QUIZ.push(...list);
    this.renderQuiz();
    toast('Вопрос удалён');
  },

  /* ---------- Достижения ---------- */
  renderAchievements(){
    const box = document.getElementById('adminAchList');
    box.innerHTML = '';
    if (!ACHIEVEMENTS.length){
      box.appendChild(el('p','muted','Список пуст. Нажмите «Добавить достижение».'));
      return;
    }
    ACHIEVEMENTS.forEach((a, i) => {
      const row = el('div','admin-row');
      row.appendChild(el('div','admin-row__icon', a.icon || '🏅'));
      const cell = el('div','admin-row__main');
      cell.appendChild(el('div','admin-row__title', a.name));
      cell.appendChild(el('div','admin-row__sub', 'id: ' + a.id + ' · ' + a.desc));
      row.appendChild(cell);
      const actions = el('div','admin-row__actions');
      const editBtn = el('button','btn btn--sm','✎'); editBtn.type = 'button';
      editBtn.onclick = () => this.editAch(i);
      const delBtn = el('button','btn btn--sm','🗑'); delBtn.type = 'button';
      delBtn.onclick = () => this.deleteAch(i);
      actions.append(editBtn, delBtn);
      row.appendChild(actions);
      box.appendChild(row);
    });
  },

  editAch(i){
    const a = i === -1 ? { id:'new' + Date.now(), icon:'🏅', name:'', desc:'' }
                       : JSON.parse(JSON.stringify(ACHIEVEMENTS[i]));
    this.editingType = 'ach';
    this.editingIndex = i;
    this.editingData = a;
    this.showEditForm();
  },

  deleteAch(i){
    if (!confirm('Удалить достижение «' + ACHIEVEMENTS[i].name + '»?')) return;
    const list = ACHIEVEMENTS.slice();
    list.splice(i, 1);
    DB.set(OVERRIDE_KEYS.ach, list);
    ACHIEVEMENTS.length = 0; ACHIEVEMENTS.push(...list);
    this.renderAchievements();
    toast('Достижение удалено');
  },

  /* ---------- Игроки ---------- */
  renderUsers(){
    const box = document.getElementById('adminUsersList');
    box.innerHTML = '';
    const all = Users.all();
    const nicks = Object.keys(all);
    if (!nicks.length){
      box.appendChild(el('p','muted','Нет ни одного игрока.'));
      return;
    }
    const rows = nicks.map(n => {
      const u = all[n];
      const games = (u.stats?.quizGames||0) + (u.stats?.matchGames||0) +
                    (u.stats?.silGames||0) + (u.stats?.oddGames||0) +
                    (u.stats?.duelGames||0) + (u.stats?.tfGames||0) +
                    (u.stats?.reactGames||0) + (u.stats?.gunsmithGames||0) +
                    (u.stats?.tacticGames||0) + (u.stats?.wordGames||0);
      return { nick:n, xp: u.xp || 0, rank: Rank.current(u.xp || 0).name, games };
    }).sort((a, b) => b.xp - a.xp);

    rows.forEach((r, i) => {
      const row = el('div','admin-row');
      row.appendChild(el('div','admin-row__icon', String(i + 1)));
      const cell = el('div','admin-row__main');
      cell.appendChild(el('div','admin-row__title', r.nick));
      cell.appendChild(el('div','admin-row__sub', r.rank + ' · игр: ' + r.games));
      row.appendChild(cell);
      row.appendChild(el('div','admin-row__actions', r.xp + ' XP'));
      box.appendChild(row);
    });

    const danger = el('button','btn btn--ghost','Удалить всех игроков');
    danger.type = 'button';
    danger.style.color = 'var(--danger)';
    danger.style.marginTop = '14px';
    danger.onclick = () => {
      if (!confirm('Удалить всех игроков и их прогресс? Это необратимо.')) return;
      DB.del('users');
      DB.del('current');
      this.renderUsers();
      toast('Список игроков очищен');
    };
    box.appendChild(danger);
  },

  /* ---------- Форма редактирования ---------- */
  showEditForm(){
    const form = document.getElementById('adminEditForm');
    form.innerHTML = '';
    const d = this.editingData;
    const t = this.editingType;

    if (t === 'weapon'){
      document.getElementById('adminEditTitle').textContent = this.editingIndex === -1
        ? 'Новый образец' : 'Редактирование образца';

      form.appendChild(this.field('ID (латиницей, без пробелов)', 'id', d.id, 'text'));
      form.appendChild(this.field('Название', 'name', d.name, 'text'));

      const catWrap = el('label','admin-field');
      catWrap.appendChild(el('span','admin-field__label','Категория'));
      const catSel = el('select','input'); catSel.id = 'field-category';
      CATEGORIES.forEach(c => {
        const o = document.createElement('option');
        o.value = c.id; o.textContent = c.title;
        if (c.id === d.category) o.selected = true;
        catSel.appendChild(o);
      });
      catWrap.appendChild(catSel);
      form.appendChild(catWrap);

      form.appendChild(this.field('Emoji (заглушка)', 'emoji', d.emoji || '🔫', 'text'));
      form.appendChild(this.field('Путь к фото (необязательно)', 'img', d.img || '', 'text'));
      form.appendChild(this.field('Краткое описание', 'short', d.short || '', 'textarea'));
      const specsText = Object.entries(d.specs || {}).map(([k, v]) => k + ': ' + v).join('\n');
      form.appendChild(this.field('ТТХ — каждая строка «Ключ: Значение»', 'specs', specsText, 'textarea'));
      form.appendChild(this.field('Интересный факт', 'fact', d.fact || '', 'textarea'));
    }

    if (t === 'quiz'){
      document.getElementById('adminEditTitle').textContent = this.editingIndex === -1
        ? 'Новый вопрос' : 'Редактирование вопроса';

      form.appendChild(this.field('Текст вопроса', 'text', d.text || '', 'textarea'));

      const wWrap = el('label','admin-field');
      wWrap.appendChild(el('span','admin-field__label','Привязанный образец (для картинки)'));
      const wSel = el('select','input'); wSel.id = 'field-weapon';
      WEAPONS.forEach(w => {
        const o = document.createElement('option');
        o.value = w.id; o.textContent = w.name;
        if (w.id === d.weapon) o.selected = true;
        wSel.appendChild(o);
      });
      wWrap.appendChild(wSel);
      form.appendChild(wWrap);

      const optWrap = el('div','admin-field');
      optWrap.appendChild(el('span','admin-field__label','Варианты ответа (отметьте правильный)'));
      for (let i = 0; i < 4; i++){
        const r = el('div','admin-opt-row');
        const radio = document.createElement('input');
        radio.type = 'radio'; radio.name = 'correctOpt'; radio.value = i;
        if (i === d.correct) radio.checked = true;
        const input = el('input','input'); input.type = 'text';
        input.id = 'opt-text-' + i;
        input.value = d.options?.[i] || '';
        input.placeholder = 'Вариант ' + (i + 1);
        r.append(radio, input);
        optWrap.appendChild(r);
      }
      form.appendChild(optWrap);
    }

    if (t === 'ach'){
      document.getElementById('adminEditTitle').textContent = this.editingIndex === -1
        ? 'Новое достижение' : 'Редактирование достижения';
      form.appendChild(this.field('ID (латиницей, без пробелов)', 'id', d.id, 'text'));
      form.appendChild(this.field('Иконка (emoji)', 'icon', d.icon || '🏅', 'text'));
      form.appendChild(this.field('Название', 'name', d.name || '', 'text'));
      form.appendChild(this.field('Описание', 'desc', d.desc || '', 'textarea'));
    }

    document.getElementById('adminEditModal').hidden = false;
  },

  field(label, name, value, type){
    const wrap = el('label','admin-field');
    wrap.appendChild(el('span','admin-field__label', label));
    let input;
    if (type === 'textarea'){
      input = el('textarea','input admin-textarea');
      input.rows = 3;
    } else {
      input = el('input','input');
      input.type = type;
    }
    input.id = 'field-' + name;
    input.value = value == null ? '' : value;
    wrap.appendChild(input);
    return wrap;
  },

  save(){
    const t = this.editingType;
    const i = this.editingIndex;

    if (t === 'weapon'){
      const newW = {
        id: (document.getElementById('field-id').value || '').trim().toLowerCase().replace(/\s+/g,'_'),
        name: (document.getElementById('field-name').value || '').trim(),
        category: document.getElementById('field-category').value,
        emoji: (document.getElementById('field-emoji').value || '').trim() || '🔫',
        img: (document.getElementById('field-img').value || '').trim() || null,
        short: (document.getElementById('field-short').value || '').trim(),
        specs: {},
        fact: (document.getElementById('field-fact').value || '').trim()
      };
      (document.getElementById('field-specs').value || '').split('\n').forEach(line => {
        const idx = line.indexOf(':');
        if (idx > 0){
          const k = line.slice(0, idx).trim();
          const v = line.slice(idx + 1).trim();
          if (k && v) newW.specs[k] = v;
        }
      });
      if (!newW.id || !newW.name) return toast('ID и Название обязательны');

      const list = WEAPONS.slice();
      if (i === -1) list.push(newW); else list[i] = newW;
      DB.set(OVERRIDE_KEYS.weapons, list);
      WEAPONS.length = 0; WEAPONS.push(...list);
      this.renderWeapons();
    }

    if (t === 'quiz'){
      const newQ = {
        weapon: document.getElementById('field-weapon').value,
        text: (document.getElementById('field-text').value || '').trim(),
        options: [], correct: 0
      };
      for (let k = 0; k < 4; k++){
        newQ.options.push((document.getElementById('opt-text-' + k).value || '').trim());
      }
      const radio = document.querySelector('input[name="correctOpt"]:checked');
      newQ.correct = radio ? parseInt(radio.value, 10) : 0;
      if (!newQ.text || !newQ.options[newQ.correct]){
        return toast('Заполните текст и правильный вариант');
      }
      const list = QUIZ.slice();
      if (i === -1) list.push(newQ); else list[i] = newQ;
      DB.set(OVERRIDE_KEYS.quiz, list);
      QUIZ.length = 0; QUIZ.push(...list);
      this.renderQuiz();
    }

    if (t === 'ach'){
      const newA = {
        id: (document.getElementById('field-id').value || '').trim(),
        icon: (document.getElementById('field-icon').value || '').trim() || '🏅',
        name: (document.getElementById('field-name').value || '').trim(),
        desc: (document.getElementById('field-desc').value || '').trim()
      };
      if (!newA.id || !newA.name) return toast('ID и Название обязательны');
      const list = ACHIEVEMENTS.slice();
      if (i === -1) list.push(newA); else list[i] = newA;
      DB.set(OVERRIDE_KEYS.ach, list);
      ACHIEVEMENTS.length = 0; ACHIEVEMENTS.push(...list);
      this.renderAchievements();
    }

    document.getElementById('adminEditModal').hidden = true;
    toast('Сохранено');
  },

  /* ---------- QR-генератор (через публичный API) ----------
     Использует api.qrserver.com — не требует библиотек,
     работает в любой сети и офлайн-PWA. */
  renderQrTab(){
    const sel = document.getElementById('qrWeapon');
    if (!sel.options.length){
      const opt = document.createElement('option');
      opt.value = ''; opt.textContent = '— выберите образец —';
      sel.appendChild(opt);
      WEAPONS.forEach(w => {
        const o = document.createElement('option');
        o.value = w.id; o.textContent = w.name;
        sel.appendChild(o);
      });
      sel.onchange = () => {
        if (sel.value) document.getElementById('qrInput').value = sel.value;
      };
    }
  },

  initQrTab(){
    const genBtn = document.getElementById('qrGenerateBtn');
    const dlBtn  = document.getElementById('qrDownloadBtn');
    const input  = document.getElementById('qrInput');
    const out    = document.getElementById('qrOutput');

    genBtn.onclick = () => {
      const raw = (input.value || '').trim();
      if (!raw) return toast('Введите ID или ссылку');

      // Короткий ID превращаем в ссылку на карточку
      let url = raw;
      if (/^[a-z0-9_-]+$/i.test(raw)){
        const base = location.origin +
                     location.pathname.replace(/admin\.html.*$/i, 'index.html');
        url = base + '#card=' + raw.toLowerCase();
      }

      // Публичный QR-API: отдаёт картинку PNG
      const apiUrl = 'https://api.qrserver.com/v1/create-qr-code/'
        + '?size=400x400&margin=10&data=' + encodeURIComponent(url);

      out.innerHTML = '';
      const img = document.createElement('img');
      img.alt = 'QR-код';
      img.style.maxWidth = '320px';
      img.style.width = '100%';
      img.style.borderRadius = '8px';
      img.style.background = '#ffffff';
      img.style.padding = '8px';
      img.onload = () => {
        this.currentQrUrl = apiUrl;
        dlBtn.disabled = false;
        toast('QR готов');
      };
      img.onerror = () => {
        out.innerHTML = '';
        toast('Не удалось сгенерировать QR — проверьте интернет');
      };
      img.src = apiUrl;
      out.appendChild(img);
    };

    dlBtn.onclick = async () => {
      if (!this.currentQrUrl) return;
      dlBtn.disabled = true;
      const oldText = dlBtn.textContent;
      dlBtn.textContent = 'Скачивание…';
      try {
        const res = await fetch(this.currentQrUrl);
        const blob = await res.blob();
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'qr-' + Date.now() + '.png';
        link.click();
        URL.revokeObjectURL(link.href);
        toast('QR сохранён');
      } catch (e){
        toast('Не удалось скачать PNG');
        console.error(e);
      } finally {
        dlBtn.disabled = false;
        dlBtn.textContent = oldText;
      }
    };
  },

  /* ---------- Бэкап ---------- */
  initBackupTab(){
    document.getElementById('exportBtn').onclick = () => {
      const data = {};
      for (let i = 0; i < localStorage.length; i++){
        const k = localStorage.key(i);
        if (k && k.startsWith('ovp_')) data[k] = localStorage.getItem(k);
      }
      const meta = {
        version: 1,
        exportedAt: new Date().toISOString(),
        app: 'Оружие Победы'
      };
      const blob = new Blob([JSON.stringify({ meta, data }, null, 2)],
        { type:'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'oruzhie-pobedy-backup-' +
        new Date().toISOString().slice(0, 10) + '.json';
      a.click();
      URL.revokeObjectURL(url);
      toast('Бэкап сохранён');
    };

    const fileInput = document.getElementById('importFile');
    document.getElementById('importBtn').onclick = () => fileInput.click();
    fileInput.onchange = () => {
      const f = fileInput.files && fileInput.files[0];
      fileInput.value = '';
      if (!f) return;
      const status = document.getElementById('importStatus');
      status.textContent = 'Читаем…';
      const reader = new FileReader();
      reader.onerror = () => { status.textContent = 'Ошибка чтения'; };
      reader.onload = () => {
        try {
          const parsed = JSON.parse(reader.result);
          const data = parsed && parsed.data ? parsed.data : parsed;
          if (!data || typeof data !== 'object') throw new Error('Неверный формат');
          const keys = Object.keys(data).filter(k => k.startsWith('ovp_'));
          if (!keys.length) throw new Error('Нет данных приложения');
          if (!confirm('Заменить текущие данные (' + keys.length + ' ключей)?')) {
            status.textContent = 'Отменено';
            return;
          }
          keys.forEach(k => localStorage.setItem(k, data[k]));
          status.textContent = 'Готово. Перезагружаем…';
          toast('Импорт завершён');
          setTimeout(() => location.reload(), 900);
        } catch (e){
          console.error(e);
          status.textContent = 'Ошибка: ' + e.message;
          toast('Не удалось импортировать');
        }
      };
      reader.readAsText(f);
    };

    document.getElementById('factoryResetBtn').onclick = () => {
      if (!confirm('Удалить ВСЕ данные приложения? Это необратимо!')) return;
      if (!confirm('Точно? Прогресс, пользователи, изменения — всё исчезнет.')) return;
      const toDel = [];
      for (let i = 0; i < localStorage.length; i++){
        const k = localStorage.key(i);
        if (k && k.startsWith('ovp_')) toDel.push(k);
      }
      toDel.forEach(k => localStorage.removeItem(k));
      toast('Все данные удалены');
      setTimeout(() => location.reload(), 700);
    };
  }
};

/* =========================================================
   ИНИЦИАЛИЗАЦИЯ
   ========================================================= */
function initAdmin(){
  document.getElementById('adminLoginBtn').onclick = () => {
    const pwd = document.getElementById('adminPwd').value;
    if (Admin.login(pwd)){
      document.getElementById('adminPwd').value = '';
      document.getElementById('adminLoginError').textContent = '';
      Admin.render();
      toast('Добро пожаловать, администратор');
    } else {
      document.getElementById('adminLoginError').textContent = 'Неверный пароль';
      toast('Неверный пароль');
    }
  };
  document.getElementById('adminPwd').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('adminLoginBtn').click();
  });

  $$('#adminTabs .switch__btn').forEach(btn => {
    btn.onclick = () => {
      $$('#adminTabs .switch__btn').forEach(b => b.classList.toggle('active', b === btn));
      const tab = btn.dataset.tab;
      ['weapons','quiz','achievements','users','qr','backup'].forEach(t => {
        document.getElementById('adminTab-' + t).hidden = (t !== tab);
      });
    };
  });

  document.getElementById('adminAddWeapon').onclick = () => Admin.editWeapon(-1);
  document.getElementById('adminAddQuiz').onclick   = () => Admin.editQuiz(-1);
  document.getElementById('adminAddAch').onclick    = () => Admin.editAch(-1);

  document.getElementById('adminResetWeapons').onclick = () => {
    if (!confirm('Вернуть заводской список вооружения? Изменения будут потеряны.')) return;
    DB.del(OVERRIDE_KEYS.weapons);
    location.reload();
  };
  document.getElementById('adminResetQuiz').onclick = () => {
    if (!confirm('Вернуть заводские вопросы?')) return;
    DB.del(OVERRIDE_KEYS.quiz);
    location.reload();
  };
  document.getElementById('adminResetAch').onclick = () => {
    if (!confirm('Вернуть заводские достижения?')) return;
    DB.del(OVERRIDE_KEYS.ach);
    location.reload();
  };

  document.getElementById('adminLogout').onclick = () => {
    Admin.logout();
    Admin.render();
    toast('Вы вышли из админки');
  };

  document.getElementById('adminSaveBtn').onclick = () => Admin.save();
  document.getElementById('adminCancelBtn').onclick = () =>
    document.getElementById('adminEditModal').hidden = true;
  document.getElementById('adminEditModal').onclick = e => {
    if (e.target.id === 'adminEditModal') document.getElementById('adminEditModal').hidden = true;
  };

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') document.getElementById('adminEditModal').hidden = true;
  });

  Admin.initQrTab();
  Admin.initBackupTab();
}

function init(){
  applyOverrides();
  document.body.classList.add('admin');
  initCommonChrome();
  initAdmin();
  BG.init();
  Admin.render();
}

document.addEventListener('DOMContentLoaded', init);
