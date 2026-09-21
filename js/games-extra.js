/* =========================================================
   ДОПОЛНИТЕЛЬНЫЕ ИГРЫ
   1) Правда или миф
   2) Реакция
   3) Собери оружие
   4) Тактическая задача
   5) Военный кроссворд (собери слово)
   Загружается ПОСЛЕ utils.js, ПЕРЕД app.js
   ========================================================= */

/* =========================================================
   1. ПРАВДА ИЛИ МИФ
   ========================================================= */
const TF = {
  list:[], idx:0, score:0, locked:false,

  reset(){
    document.getElementById('tfStart').hidden = false;
    document.getElementById('tfGame').hidden = true;
    document.getElementById('tfResult').hidden = true;
    document.getElementById('tfStartBtn').onclick = () => this.start();
  },

  start(){
    this.list = shuffle(TRUE_FALSE).slice(0, 10);
    this.idx = 0; this.score = 0; this.locked = false;
    document.getElementById('tfStart').hidden = true;
    document.getElementById('tfResult').hidden = true;
    document.getElementById('tfGame').hidden = false;
    document.getElementById('tfTotal').textContent = this.list.length;
    this.render();
  },

  render(){
    const q = this.list[this.idx];
    this.locked = false;
    document.getElementById('tfNum').textContent = this.idx + 1;
    document.getElementById('tfScore').textContent = this.score;
    document.getElementById('tfText').textContent = q.text;
    const btns = document.querySelectorAll('#tfOpts .opt');
    btns.forEach(b => { b.disabled = false; b.classList.remove('correct','wrong'); });
  },

  answer(choice, btn){
    if (this.locked) return;
    this.locked = true;
    const q = this.list[this.idx];
    const btns = document.querySelectorAll('#tfOpts .opt');
    btns.forEach(b => b.disabled = true);

    if (choice === q.answer){
      btn.classList.add('correct'); this.score++;
      document.getElementById('tfScore').textContent = this.score;
      Game.addCorrect(); Game.addXp(10); Sound.ok(); vibrate(25);
    } else {
      btn.classList.add('wrong');
      const correctBtn = btns[q.answer ? 0 : 1];
      if (correctBtn) correctBtn.classList.add('correct');
      Game.addWrong(); Sound.err(); vibrate([40,40,40]);
    }

    setTimeout(() => {
      this.idx++;
      if (this.idx < this.list.length) this.render();
      else this.finish();
    }, 900);
  },

  finish(){
    document.getElementById('tfGame').hidden = true;
    const res = document.getElementById('tfResult');
    res.hidden = false; res.innerHTML = '';
    const total = this.list.length;
    const pct = Math.round(this.score / total * 100);

    Users.update(u => {
      u.stats.tfGames = (u.stats.tfGames || 0) + 1;
      if (this.score > (u.stats.tfBest || 0)) u.stats.tfBest = this.score;
    });
    Game.checkAchievements();
    if (pct >= 70) Sound.win();

    res.appendChild(el('h2', null, 'Результат'));
    res.appendChild(el('div','result-score', this.score + ' / ' + total));
    res.appendChild(el('p','muted', pct >= 80 ? 'Аналитик года!' :
      pct >= 50 ? 'Неплохо, но есть пробелы.' : 'Попробуй ещё раз.'));

    const row = el('div','row');
    const again = el('button','btn btn--primary','Ещё раз'); again.type = 'button';
    again.onclick = () => this.start();
    const share = el('button','btn','📤 Поделиться'); share.type = 'button';
    share.onclick = () => showShareModal({ title:'Правда или миф', score: this.score, total, xp: this.score * 10 });
    row.append(again, share);
    res.appendChild(row);
  }
};

/* =========================================================
   2. РЕАКЦИЯ
   ========================================================= */
const React = {
  list:[], idx:0, score:0, locked:false, timer:null, sec:0, maxSec:2,

  reset(){
    this.stopTimer();
    document.getElementById('reactStart').hidden = false;
    document.getElementById('reactGame').hidden = true;
    document.getElementById('reactResult').hidden = true;
    document.getElementById('reactStartBtn').onclick = () => this.start();
  },

  start(){
    // Список из 10 случайных вопросов, но с ограничением 2 секунды
    const pool = shuffle(QUIZ).slice(0, 10);
    this.list = pool.map(q => {
      // Перемешиваем варианты внутри вопроса
      const opts = q.options.map((text, i) => ({ text, correct: i === q.correct }));
      return { weapon:q.weapon, text:q.text, options:shuffle(opts) };
    });
    this.idx = 0; this.score = 0; this.locked = false;
    document.getElementById('reactStart').hidden = true;
    document.getElementById('reactResult').hidden = true;
    document.getElementById('reactGame').hidden = false;
    document.getElementById('reactTotal').textContent = this.list.length;
    this.render();
  },

  render(){
    const q = this.list[this.idx];
    this.locked = false;
    document.getElementById('reactNum').textContent = this.idx + 1;
    document.getElementById('reactScore').textContent = this.score;
    document.getElementById('reactText').textContent = q.text;

    const w = WEAPONS.find(x => x.id === q.weapon);
    const imgBox = document.getElementById('reactImg'); imgBox.innerHTML = '';
    const src = w ? weaponImageSrc(w) : null;
    if (src){
      const img = el('img'); img.src = src; img.alt = '';
      img.onerror = () => { img.remove(); imgBox.textContent = w ? w.emoji : '❓'; };
      imgBox.appendChild(img);
    } else imgBox.textContent = w ? w.emoji : '❓';

    const opts = document.getElementById('reactOpts'); opts.innerHTML = '';
    q.options.forEach((o, i) => {
      const b = el('button','opt', o.text); b.type = 'button';
      b.onclick = () => this.answer(i, b, o.correct);
      opts.appendChild(b);
    });

    this.startTimer();
  },

  startTimer(){
    this.stopTimer();
    this.sec = this.maxSec;
    const bar = document.getElementById('reactTimerBar');
    bar.style.width = '100%';
    document.getElementById('reactTimerText').textContent = this.sec + ' с';
    const step = 50;
    let elapsed = 0;
    this.timer = setInterval(() => {
      elapsed += step;
      const left = Math.max(0, this.maxSec * 1000 - elapsed);
      bar.style.width = (left / (this.maxSec * 1000) * 100) + '%';
      document.getElementById('reactTimerText').textContent =
        (left / 1000).toFixed(1) + ' с';
      if (left <= 0){
        this.stopTimer();
        this.answer(-1, null, false);
      }
    }, step);
  },
  stopTimer(){
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  },

  answer(i, btn, isCorrect){
    if (this.locked) return;
    this.locked = true;
    this.stopTimer();

    const btns = document.querySelectorAll('#reactOpts .opt');
    btns.forEach(b => b.disabled = true);
    const correctIdx = this.list[this.idx].options.findIndex(o => o.correct);

    if (isCorrect){
      btn.classList.add('correct');
      this.score++;
      document.getElementById('reactScore').textContent = this.score;
      Game.addCorrect(); Game.addXp(15); Sound.ok(); vibrate(20);
    } else {
      if (btn) btn.classList.add('wrong');
      if (btns[correctIdx]) btns[correctIdx].classList.add('correct');
      Game.addWrong(); Sound.err(); vibrate([40,40,40]);
      if (i === -1) toast('Время вышло');
    }

    setTimeout(() => {
      this.idx++;
      if (this.idx < this.list.length) this.render();
      else this.finish();
    }, 1000);
  },

  finish(){
    this.stopTimer();
    document.getElementById('reactGame').hidden = true;
    const res = document.getElementById('reactResult');
    res.hidden = false; res.innerHTML = '';
    const total = this.list.length;
    const pct = Math.round(this.score / total * 100);

    Users.update(u => {
      u.stats.reactGames = (u.stats.reactGames || 0) + 1;
      if (this.score > (u.stats.reactBest || 0)) u.stats.reactBest = this.score;
    });
    Game.checkAchievements();
    if (pct >= 70) Sound.win();

    res.appendChild(el('h2', null, 'Результат'));
    res.appendChild(el('div','result-score', this.score + ' / ' + total));
    res.appendChild(el('p','muted', pct >= 80 ? 'Реакция снайпера!' :
      pct >= 50 ? 'Есть скорость, но нужна точность.' : 'Медленно. Тренируйся.'));

    const row = el('div','row');
    const again = el('button','btn btn--primary','Ещё раз'); again.type = 'button';
    again.onclick = () => this.start();
    const share = el('button','btn','📤 Поделиться'); share.type = 'button';
    share.onclick = () => showShareModal({ title:'Реакция', score: this.score, total, xp: this.score * 15 });
    row.append(again, share);
    res.appendChild(row);
  }
};

/* =========================================================
   3. СОБЕРИ ОРУЖИЕ
   ========================================================= */
const Assembly = {
  current:null, idx:0, score:0, selected:new Set(), total:4,

  reset(){
    document.getElementById('assemblyStart').hidden = false;
    document.getElementById('assemblyGame').hidden = true;
    document.getElementById('assemblyResult').hidden = true;
    document.getElementById('assemblyStartBtn').onclick = () => this.start();
  },

  start(){
    this.pool = shuffle(ASSEMBLY);
    this.idx = 0;
    this.score = 0;
    document.getElementById('assemblyStart').hidden = true;
    document.getElementById('assemblyResult').hidden = true;
    document.getElementById('assemblyGame').hidden = false;
    document.getElementById('assemblyTotal').textContent = this.pool.length;
    this.render();
  },

  render(){
    this.selected.clear();
    const w = this.pool[this.idx];
    this.current = w;
    document.getElementById('assemblyNum').textContent = this.idx + 1;
    document.getElementById('assemblyScore').textContent = this.score;
    document.getElementById('assemblyTitle').textContent = w.name;
    document.getElementById('assemblyHint').textContent = w.hint;

    // Все варианты: 4 правильных + 6 неправильных (случайные)
    const allParts = [...w.correct, ...shuffle(w.wrong).slice(0, 6)];
    const mixed = shuffle(allParts);

    const box = document.getElementById('assemblyParts');
    box.innerHTML = '';
    mixed.forEach(part => {
      const chip = el('button','part-chip', part);
      chip.type = 'button';
      chip.dataset.part = part;
      chip.onclick = () => {
        if (chip.classList.contains('locked')) return;
        if (this.selected.has(part)){
          this.selected.delete(part);
          chip.classList.remove('picked');
        } else if (this.selected.size < 4){
          this.selected.add(part);
          chip.classList.add('picked');
          Sound.tap();
        }
        document.getElementById('assemblyPick').textContent = this.selected.size + ' / 4';
      };
      box.appendChild(chip);
    });

    document.getElementById('assemblyPick').textContent = '0 / 4';
    document.getElementById('assemblySubmit').disabled = true;
    document.getElementById('assemblySubmit').onclick = () => this.submit();

    // Обновляем доступность кнопки
    box.onclick = () => {
      document.getElementById('assemblySubmit').disabled = this.selected.size !== 4;
    };
  },

  submit(){
    if (this.selected.size !== 4) return;
    const w = this.current;
    const correctSet = new Set(w.correct);
    let right = 0;
    document.querySelectorAll('#assemblyParts .part-chip').forEach(chip => {
      chip.classList.add('locked');
      chip.disabled = true;
      const p = chip.dataset.part;
      if (correctSet.has(p)){
        if (this.selected.has(p)){ chip.classList.add('ok'); right++; }
        else chip.classList.add('missed');
      } else if (this.selected.has(p)){
        chip.classList.add('bad');
      }
    });

    const fullWin = right === 4;
    if (fullWin){
      this.score++;
      document.getElementById('assemblyScore').textContent = this.score;
      Game.addCorrect(); Game.addXp(25); Sound.win();
      Users.update(u => { u.stats.gunsmithDone = (u.stats.gunsmithDone || 0) + 1; });
    } else {
      Game.addWrong(); Game.addXp(5); Sound.err();
    }
    Game.checkAchievements();

    setTimeout(() => {
      this.idx++;
      if (this.idx < this.pool.length) this.render();
      else this.finish();
    }, 1600);
  },

  finish(){
    document.getElementById('assemblyGame').hidden = true;
    const res = document.getElementById('assemblyResult');
    res.hidden = false; res.innerHTML = '';
    const total = this.pool.length;

    Users.update(u => {
      u.stats.gunsmithGames = (u.stats.gunsmithGames || 0) + 1;
    });
    Game.checkAchievements();

    res.appendChild(el('h2', null, 'Результат'));
    res.appendChild(el('div','result-score', this.score + ' / ' + total));
    res.appendChild(el('p','muted', 'Собрано без ошибок: ' + this.score + ' из ' + total));

    const row = el('div','row');
    const again = el('button','btn btn--primary','Ещё раз'); again.type = 'button';
    again.onclick = () => this.start();
    row.appendChild(again);
    res.appendChild(row);
  }
};

/* =========================================================
   4. ТАКТИЧЕСКАЯ ЗАДАЧА
   ========================================================= */
const Tactic = {
  current:null, idx:0, score:0, selectedUnit:null,

  reset(){
    document.getElementById('tacticStart').hidden = false;
    document.getElementById('tacticGame').hidden = true;
    document.getElementById('tacticResult').hidden = true;
    document.getElementById('tacticStartBtn').onclick = () => this.start();
  },

  start(){
    this.pool = TACTIC.slice();
    this.idx = 0; this.score = 0;
    document.getElementById('tacticStart').hidden = true;
    document.getElementById('tacticResult').hidden = true;
    document.getElementById('tacticGame').hidden = false;
    document.getElementById('tacticTotal').textContent = this.pool.length;
    this.render();
  },

  render(){
    const t = this.pool[this.idx];
    this.current = t;
    this.selectedUnit = null;
    document.getElementById('tacticNum').textContent = this.idx + 1;
    document.getElementById('tacticScore').textContent = this.score;
    document.getElementById('tacticTask').textContent = t.task;

    // Зоны
    const zonesBox = document.getElementById('tacticZones');
    zonesBox.innerHTML = '';
    t.zones.forEach(z => {
      const zone = el('div','tactic-zone');
      zone.dataset.zone = z;
      zone.appendChild(el('div','tactic-zone__title', z));
      const inner = el('div','tactic-zone__units');
      zone.appendChild(inner);
      zone.onclick = () => this.place(z);
      zonesBox.appendChild(zone);
    });

    // Единицы
    const unitsBox = document.getElementById('tacticUnits');
    unitsBox.innerHTML = '';
    const units = shuffle(t.units);
    units.forEach(u => {
      const chip = el('button','tactic-unit');
      chip.type = 'button';
      chip.dataset.unit = u.name;
      chip.dataset.zone = u.zone;
      chip.appendChild(el('span', null, u.icon));
      chip.appendChild(el('span', null, u.name));
      chip.onclick = () => {
        document.querySelectorAll('.tactic-unit').forEach(x => x.classList.remove('picked'));
        chip.classList.add('picked');
        this.selectedUnit = { name:u.name, zone:u.zone, chip };
      };
      unitsBox.appendChild(chip);
    });
  },

  place(zoneName){
    if (!this.selectedUnit) { toast('Сначала выберите технику'); return; }
    const { name, zone, chip } = this.selectedUnit;
    if (chip.classList.contains('placed')) return;

    const zoneEl = document.querySelector(`.tactic-zone[data-zone="${zoneName}"] .tactic-zone__units`);
    chip.classList.remove('picked');
    chip.classList.add('placed');
    chip.disabled = true;
    const inZone = el('div','tactic-placed', name);
    inZone.dataset.correct = (zone === zoneName).toString();
    if (zone === zoneName) inZone.classList.add('ok');
    else inZone.classList.add('bad');
    zoneEl.appendChild(inZone);
    Sound.tap();

    if (zone === zoneName){
      this.score++;
      document.getElementById('tacticScore').textContent = this.score;
      Game.addCorrect(); Game.addXp(8);
    } else {
      Game.addWrong();
    }
    this.selectedUnit = null;

    // Все размещены?
    if (document.querySelectorAll('.tactic-unit.placed').length === this.current.units.length){
      Game.checkAchievements();
      setTimeout(() => {
        this.idx++;
        if (this.idx < this.pool.length) this.render();
        else this.finish();
      }, 900);
    }
  },

  finish(){
    document.getElementById('tacticGame').hidden = true;
    const res = document.getElementById('tacticResult');
    res.hidden = false; res.innerHTML = '';
    const total = this.pool.reduce((s, t) => s + t.units.length, 0);

    Users.update(u => {
      u.stats.tacticGames = (u.stats.tacticGames || 0) + 1;
      if (this.score > (u.stats.tacticBest || 0)) u.stats.tacticBest = this.score;
    });
    Game.checkAchievements();
    if (this.score / total >= 0.7) Sound.win();

    res.appendChild(el('h2', null, 'Результат'));
    res.appendChild(el('div','result-score', this.score + ' / ' + total));
    res.appendChild(el('p','muted','Верных позиций: ' + this.score));

    const row = el('div','row');
    const again = el('button','btn btn--primary','Ещё раз'); again.type = 'button';
    again.onclick = () => this.start();
    row.appendChild(again);
    res.appendChild(row);
  }
};

/* =========================================================
   5. ВОЕННЫЙ КРОССВОРД (собери слово)
   ========================================================= */
const WordGame = {
  list:[], idx:0, score:0, typed:[], letters:[], locked:false,

  reset(){
    document.getElementById('wordStart').hidden = false;
    document.getElementById('wordGame').hidden = true;
    document.getElementById('wordResult').hidden = true;
    document.getElementById('wordStartBtn').onclick = () => this.start();
  },

  start(){
    this.list = shuffle(WORD_PUZZLE).slice(0, 8);
    this.idx = 0; this.score = 0;
    document.getElementById('wordStart').hidden = true;
    document.getElementById('wordResult').hidden = true;
    document.getElementById('wordGame').hidden = false;
    document.getElementById('wordTotal').textContent = this.list.length;
    this.render();
  },

  render(){
    const w = this.list[this.idx];
    this.current = w;
    this.typed = [];
    this.locked = false;
    document.getElementById('wordNum').textContent = this.idx + 1;
    document.getElementById('wordScore').textContent = this.score;
    document.getElementById('wordHint').textContent = w.hint;

    // Правильные буквы + 2 лишних
    const letters = w.answer.split('');
    const extra = 'АБВГДЕЖЗИКЛМНОПРСТУФХЦЧШЩЫЭЮЯ'.split('');
    const noise = [];
    while (noise.length < 2){
      const r = extra[Math.floor(Math.random()*extra.length)];
      if (!letters.includes(r)) noise.push(r);
    }
    this.letters = shuffle([...letters, ...noise]);

    this.renderSlots();
    this.renderTiles();
  },

  renderSlots(){
    const slots = document.getElementById('wordSlots');
    slots.innerHTML = '';
    const len = this.current.answer.length;
    for (let i = 0; i < len; i++){
      const s = el('div','word-slot' + (i < this.typed.length ? ' filled' : ''));
      s.textContent = this.typed[i] || '';
      slots.appendChild(s);
    }
  },

  renderTiles(){
    const box = document.getElementById('wordTiles');
    box.innerHTML = '';
    const usedCount = {};
    this.typed.forEach(l => usedCount[l] = (usedCount[l] || 0) + 1);
    this.letters.forEach(l => {
      const available = (usedCount[l] || 0) > 0;
      if (available) usedCount[l]--;
      const b = el('button','letter-tile', l);
      b.type = 'button';
      b.disabled = available || this.locked;
      if (available) b.classList.add('used');
      b.onclick = () => this.pick(l);
      box.appendChild(b);
    });
  },

  pick(letter){
    if (this.locked) return;
    if (this.typed.length >= this.current.answer.length) return;
    this.typed.push(letter);
    this.renderSlots();
    this.renderTiles();
    Sound.tap();

    if (this.typed.length === this.current.answer.length){
      this.check();
    }
  },

  check(){
    this.locked = true;
    const answer = this.current.answer;
    const typed = this.typed.join('');
    const isCorrect = typed === answer;
    if (isCorrect){
      this.score++;
      document.getElementById('wordScore').textContent = this.score;
      Game.addCorrect(); Game.addXp(20); Sound.ok();
      Users.update(u => { u.stats.wordsSolved = (u.stats.wordsSolved || 0) + 1; });
    } else {
      Game.addWrong(); Sound.err();
      document.getElementById('wordHint').textContent =
        'Ответ: ' + answer;
    }
    Game.checkAchievements();

    setTimeout(() => {
      this.idx++;
      if (this.idx < this.list.length) this.render();
      else this.finish();
    }, 1600);
  },

  finish(){
    document.getElementById('wordGame').hidden = true;
    const res = document.getElementById('wordResult');
    res.hidden = false; res.innerHTML = '';
    const total = this.list.length;

    Users.update(u => {
      u.stats.wordGames = (u.stats.wordGames || 0) + 1;
    });
    Game.checkAchievements();

    res.appendChild(el('h2', null, 'Результат'));
    res.appendChild(el('div','result-score', this.score + ' / ' + total));
    res.appendChild(el('p','muted','Разгадано слов: ' + this.score));

    const row = el('div','row');
    const again = el('button','btn btn--primary','Ещё раз'); again.type = 'button';
    again.onclick = () => this.start();
    row.appendChild(again);
    res.appendChild(row);
  }
};