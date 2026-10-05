/* =========================================================
   UPDATES.JS — система уведомлений об обновлениях сайта.
   ========================================================= */

const APP_VERSION = 18;

const CHANGELOG = {
  10: [
    'Добавлены 25 образцов вооружения',
    'Админка: генератор QR-кодов и бэкап',
    'Экспорт результата в PNG'
  ],
  11: [
    'Локальная библиотека QR — работает без интернета',
    'Исправлена загрузка Firebase (compat SDK)',
    'Улучшена работа на iPhone Safari'
  ],
  12: [
    'Фотографии образцов в игре «Найди пару»',
    'Фотографии в игре «Найди лишнее»',
    'Плашка «Доступно обновление»',
    'Окно «Что нового» с историей изменений'
  ],
  13: [
    'Тестовое обновление — проверяем плашку',
    'Проверяем модалку «Что нового»',
    'Проверяем бейдж NEW'
  ],
  14: [
    'Исправлено фото РСЗО «Смерч» — теперь боевая машина, а не ТЗМ',
    'Исправлено фото С-500 — пусковая установка вместо ТЗМ от С-300',
    'Исправлено фото «Авангард» — пусковая установка носителя',
    'Уточнены детали Су-57 в игре «Собери оружие»',
    'Правки по замечаниям эксперта'
  ],
  15: [
    'Реальные силуэты техники в игре «Угадай по силуэту»',
    'Вместо эмодзи — фотографии 25 образцов с прозрачным фоном',
    'В тёмной теме силуэты показываются белым цветом'
  ],
  16: [
    'Улучшена работа игры «Угадай по силуэту» — теперь с реальными фото',
    'Силуэты показываются чёрным цветом на светлой теме и белым на тёмной',
    'Финальные штрихи перед защитой проекта'
  ],
  17: [
    'Просмотр профилей игроков — нажмите на позывной в рейтинге',
    'Редактирование своего профиля — статус, о себе, ВШ, группа, день рождения',
    'Профиль синхронизируется в облако и виден всей группе'
  ],
  18: [
    'Статус теперь можно выбрать из готовых вариантов или написать свой',
    'Добавлено поле «Пол» — по желанию',
    'Дата рождения вводится через календарь',
    'ВШ / факультет выбирается из списка РЭУ им. Г.В. Плеханова'
  ]
};

/* =========================================================
   1. ПЛАШКА «ДОСТУПНО ОБНОВЛЕНИЕ»
   ========================================================= */
function initUpdateBanner(){
  if (!('serviceWorker' in navigator)) return;
  if (location.protocol === 'file:') return;

  const banner = document.createElement('div');
  banner.className = 'update-banner';
  banner.hidden = true;
  banner.innerHTML = `
    <div class="update-banner__inner">
      <span class="update-banner__icon">🔄</span>
      <span class="update-banner__text">Доступно обновление сайта</span>
      <button class="update-banner__btn" type="button">Обновить</button>
      <button class="update-banner__close" type="button" aria-label="Закрыть">✕</button>
    </div>`;
  document.body.appendChild(banner);

  const btnUpdate = banner.querySelector('.update-banner__btn');
  const btnClose = banner.querySelector('.update-banner__close');
  let shown = false;
  let refreshing = false;

  btnUpdate.addEventListener('click', () => {
    btnUpdate.textContent = 'Загрузка…';
    btnUpdate.disabled = true;
    if (navigator.serviceWorker.controller){
      navigator.serviceWorker.controller.postMessage('skipWaiting');
    }
  });

  btnClose.addEventListener('click', () => {
    banner.hidden = true;
  });

  navigator.serviceWorker.ready.then(reg => {
    reg.update().catch(() => {});
    setInterval(() => reg.update().catch(() => {}), 60000);

    reg.addEventListener('updatefound', () => {
      const newSW = reg.installing;
      if (!newSW) return;
      newSW.addEventListener('statechange', () => {
        if (newSW.state === 'installed' && navigator.serviceWorker.controller){
          if (!shown){
            shown = true;
            banner.hidden = false;
          }
        }
      });
    });
  });

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });
}

/* =========================================================
   2. МОДАЛКА «ЧТО НОВОГО»
   ========================================================= */
function initWhatsNew(){
  const lastSeen = parseInt(DB.get('lastVersion', '0'), 10);

  if (lastSeen === 0){
    DB.set('lastVersion', APP_VERSION);
    return;
  }

  if (lastSeen >= APP_VERSION) return;

  const blocks = [];
  for (let v = lastSeen + 1; v <= APP_VERSION; v++){
    if (CHANGELOG[v]) blocks.push({ v, list: CHANGELOG[v] });
  }
  if (!blocks.length){
    DB.set('lastVersion', APP_VERSION);
    return;
  }

  const html = blocks.map(b => `
    <div class="whatsnew-version">
      <div class="whatsnew-version__num">Версия ${b.v}</div>
      <ul class="whatsnew-list">
        ${b.list.map(x => `<li>${x}</li>`).join('')}
      </ul>
    </div>
  `).join('');

  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.id = 'whatsNewModal';
  modal.innerHTML = `
    <div class="modal__box">
      <div class="whatsnew-head">
        <span class="whatsnew-head__icon">🎉</span>
        <h2>Что нового</h2>
      </div>
      <p class="muted small">Мы обновили сайт. Вот что изменилось с вашего последнего визита.</p>
      ${html}
      <button class="btn btn--primary" type="button" id="whatsNewOk" style="width:100%;margin-top:14px">Понятно</button>
    </div>`;
  document.body.appendChild(modal);

  const close = () => {
    DB.set('lastVersion', APP_VERSION);
    modal.remove();
  };
  modal.querySelector('#whatsNewOk').addEventListener('click', close);
  modal.addEventListener('click', e => {
    if (e.target === modal) close();
  });
}

/* =========================================================
   3. БЕЙДЖИ NEW
   ========================================================= */
function initNewBadges(){
  const lastSeen = parseInt(DB.get('lastVersion', '0'), 10);
  if (lastSeen >= APP_VERSION) return;

  const targets = document.querySelectorAll('[data-new]');
  targets.forEach(el => {
    const ver = parseInt(el.dataset.new, 10) || 0;
    if (ver <= APP_VERSION && ver > lastSeen){
      if (el.querySelector('.badge-new')) return;
      const badge = document.createElement('span');
      badge.className = 'badge-new';
      badge.textContent = 'NEW';
      el.appendChild(badge);
    }
  });
}

/* =========================================================
   ЗАПУСК
   ========================================================= */
function initUpdates(){
  initUpdateBanner();
  initWhatsNew();
  setTimeout(initNewBadges, 100);
}

window.initUpdates = initUpdates;
window.APP_VERSION = APP_VERSION;
