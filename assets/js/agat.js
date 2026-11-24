// Агат 5189: ЭЛТ-монитор с рабочим столом в стиле XP.
import { WindowManager } from './wm.js';
import { ICONS, docIcon, renderDocInto, clock } from './views.js';
import { groupDocs } from './store.js';
import { esc } from './md.js';
import { t } from './i18n.js';

export function renderAgat(root, { faction, data, skipBoot }) {
  const osName = faction.os?.agatName || 'Okna XP';
  const avatar = faction.look?.avatar || faction.emblem;
  const abs = (u) => (u ? new URL(u, location.href).href : '');
  const wall = faction.look?.wallpaperAgat;
  const showEmb = faction.look?.emblemOnDesktop !== false;
  root.innerHTML = `
    <div class="agat">
      <div class="agat-bezel">
        <div class="agat-screen crt">
          <div class="screen-inner xp" data-screen></div>
          <div class="crt-fx" aria-hidden="true"></div>
        </div>
        <div class="agat-plate"><span>АГАТ 5189</span></div>
        <button type="button" class="agat-power" aria-label="${t('Питание')}"></button>
        <i class="agat-led"></i>
      </div>
      <div class="agat-neck"></div><div class="agat-foot"></div>
    </div>`;
  const screen = root.querySelector('[data-screen]');
  const groups = groupDocs(faction, data.factions.categories);

  const bootKey = `artz.boot.agat.${faction.id}`;
  let booted = false;
  try { booted = sessionStorage.getItem(bootKey) === '1'; } catch { /* */ }

  root.querySelector('.agat-power').addEventListener('click', () => {
    try { sessionStorage.removeItem(bootKey); } catch { /* */ }
    boot();
  });

  function boot() {
    screen.innerHTML = `<pre class="bios"></pre>`;
    const pre = screen.firstElementChild;
    const lines = [
      ...(faction.os?.bios?.length ? faction.os.bios : ['АГАТ-5189 ПЗУ v2.07  (c) НПО «Агат»']),
      `${t('Терминал')}: ${(faction.os?.computer || faction.name).toUpperCase()} / ${faction.location || t('ЧАЗ')}`,
      '',
      t('Загрузка системы...'),
    ];
    let i = 0;
    const next = () => {
      if (!pre.isConnected) return;
      pre.textContent += (lines[i] ?? '') + '\n';
      i++;
      if (i < lines.length) setTimeout(next, 170);
      else setTimeout(splash, 450);
    };
    next();
  }

  function splash() {
    screen.innerHTML = `
      <div class="xp-splash">
        <img src="${faction.emblem}" alt="">
        <div class="xp-splash-name">${esc(osName)} <small>${esc(faction.name)}</small></div>
        <div class="xp-splash-bar"><i></i><i></i><i></i></div>
        <div class="xp-splash-copy">${t('© НПО «Агат», Терминальная редакция для ЧАЗ')}</div>
      </div>`;
    setTimeout(welcome, 1800);
  }

  function welcome() {
    screen.innerHTML = `
      <div class="xp-welcome">
        <div class="xp-welcome-top"></div>
        <div class="xp-welcome-mid">
          <div class="xp-welcome-left">
            <img src="${faction.emblem}" alt="">
            <p>${t('Чтобы начать работу, щёлкните имя пользователя')}</p>
          </div>
          <div class="xp-welcome-users">
            <button type="button" class="xp-user">
              <img src="${avatar}" alt="">
              <span><b>${esc(faction.user?.name || t('Оператор'))}</b><small>${esc(faction.user?.role || '')}</small></span>
            </button>
          </div>
        </div>
        <div class="xp-welcome-bot"><span>${t('Выключить компьютер')}</span></div>
      </div>`;
    screen.querySelector('.xp-user').addEventListener('click', () => {
      screen.querySelector('.xp-welcome').classList.add('is-loading');
      setTimeout(desktop, 700);
    });
  }

  function desktop() {
    try { sessionStorage.setItem(bootKey, '1'); } catch { /* */ }
    screen.innerHTML = `
      <div class="xp-desktop ${wall ? 'has-wall' : ''} ${showEmb ? '' : 'no-emblem'}" style="--emblem:url('${abs(faction.emblem)}');${wall ? `--wall:url('${abs(wall)}')` : ''}">
        <div class="xp-icons"></div>
        <div class="xp-windows"></div>
      </div>
      <footer class="xp-taskbar">
        <button type="button" class="xp-start"><img src="${faction.emblem}" alt=""><span>${t('пуск')}</span></button>
        <div class="xp-tasks"></div>
        <div class="xp-tray"><span class="xp-tray-ico" title="${t('Сеть ЧАЗ-NET')}">📶</span><time></time></div>
      </footer>
      <div class="xp-startmenu" hidden>
        <div class="xp-sm-head"><img src="${avatar}" alt=""><b>${esc(faction.user?.name || t('Оператор'))}</b></div>
        <div class="xp-sm-cols"><ul class="xp-sm-left"></ul><ul class="xp-sm-right"></ul></div>
        <div class="xp-sm-foot"><button type="button" data-act="logoff">${t('Выход из системы')}</button><button type="button" data-act="off">${t('Выключение')}</button></div>
      </div>`;
    clock(screen.querySelector('.xp-tray time'));
    const wm = new WindowManager(screen.querySelector('.xp-windows'), screen.querySelector('.xp-tasks'));
    const icons = screen.querySelector('.xp-icons');

    const addIcon = (label, icon, fn) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'xp-icon';
      b.innerHTML = `<img src="${icon}" alt=""><span>${esc(label)}</span>`;
      b.addEventListener('click', () => { icons.querySelectorAll('.is-sel').forEach((n) => n.classList.remove('is-sel')); b.classList.add('is-sel'); });
      b.addEventListener('dblclick', fn);
      b.addEventListener('keydown', (e) => { if (e.key === 'Enter') fn(); });
      // на сенсорных экранах открываем одним касанием
      b.addEventListener('pointerup', (e) => { if (e.pointerType === 'touch') fn(); });
      icons.appendChild(b);
    };

    const openDoc = (doc) => {
      const body = document.createElement('div');
      body.className = doc.kind === 'chat' ? 'xp-term' : 'xp-doc';
      wm.open(`doc:${doc.id}`, { title: `${doc.title} — ${doc.kind === 'chat' ? t('Терминал') : t('Просмотр документа')}`, icon: docIcon(doc), content: body, width: 640, height: 470 });
      renderDocInto(body, doc, faction);
    };

    const openFolder = (g) => {
      const body = document.createElement('div');
      body.className = 'xp-explorer';
      body.innerHTML = `
        <div class="xp-ex-bar"><span>${t('Файл')}</span><span>${t('Правка')}</span><span>${t('Вид')}</span><span>${t('Избранное')}</span><span>${t('Сервис')}</span><span>${t('Справка')}</span></div>
        <div class="xp-ex-addr">${t('Адрес')}: <input readonly value="C:\\${esc((faction.os?.computer || faction.id).toUpperCase())}\\${esc(g.name)}"></div>
        <div class="xp-ex-main">
          <aside class="xp-ex-side"><div class="xp-ex-panel"><h4>${t('Задачи для файлов')}</h4><p>${t('Документов: {n}', { n: g.docs.length })}</p></div><div class="xp-ex-panel"><h4>${t('Другие места')}</h4><p>${esc(faction.fullName)}</p></div></aside>
          <div class="xp-ex-files"></div>
        </div>`;
      const files = body.querySelector('.xp-ex-files');
      g.docs.forEach((d) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'xp-file';
        b.innerHTML = `<img src="${docIcon(d)}" alt=""><span>${esc(d.title)}</span>`;
        b.addEventListener('dblclick', () => openDoc(d));
        b.addEventListener('pointerup', (e) => { if (e.pointerType === 'touch') openDoc(d); });
        b.addEventListener('keydown', (e) => { if (e.key === 'Enter') openDoc(d); });
        files.appendChild(b);
      });
      wm.open(`folder:${g.id}`, { title: g.name, icon: ICONS.folder, content: body, width: 600, height: 400 });
    };

    const openFar = () => {
      const body = document.createElement('div');
      body.className = 'far';
      const all = faction.docs || [];
      const left = groups.map((g) => `<li data-g="${g.id}"><span>${esc(g.name)}</span><span>&lt;${t('Папка')}&gt;</span></li>`).join('');
      body.innerHTML = `
        <div class="far-menu"><span>${t('Левая')}</span><span>${t('Файлы')}</span><span>${t('Команды')}</span><span>${t('Параметры')}</span><span>${t('Правая')}</span></div>
        <div class="far-panels">
          <div class="far-panel"><div class="far-path">C:\\${faction.id.toUpperCase()}</div><ul class="far-list far-left">${left}</ul></div>
          <div class="far-panel"><div class="far-path far-rpath">C:\\${faction.id.toUpperCase()}\\</div><ul class="far-list far-right"></ul></div>
        </div>
        <div class="far-status">${t('{n} файлов', { n: all.length })} · ${esc(faction.name)}</div>
        <div class="far-keys"><span>1<b>${t('Помощь')}</b></span><span>3<b>${t('Просм')}</b></span><span>5<b>${t('Копир')}</b></span><span>8<b>${t('Удален')}</b></span><span>10<b>${t('Выход')}</b></span></div>`;
      const right = body.querySelector('.far-right');
      const showGroup = (gid) => {
        const g = groups.find((x) => x.id === gid);
        body.querySelectorAll('.far-left li').forEach((li) => li.classList.toggle('is-cur', li.dataset.g === gid));
        body.querySelector('.far-rpath').textContent = `C:\\${faction.id.toUpperCase()}\\${g.name}`;
        right.innerHTML = '';
        g.docs.forEach((d) => {
          const li = document.createElement('li');
          li.tabIndex = 0;
          li.innerHTML = `<span>${esc(d.title)}</span><span>${d.kind === 'chat' ? t('ДИСК') : t('ДОК')}</span>`;
          li.addEventListener('click', () => openDoc(d));
          li.addEventListener('keydown', (e) => { if (e.key === 'Enter') openDoc(d); });
          right.appendChild(li);
        });
      };
      body.querySelectorAll('.far-left li').forEach((li) => li.addEventListener('click', () => showGroup(li.dataset.g)));
      if (groups[0]) showGroup(groups[0].id);
      wm.open('far', { title: 'C:\\Program Files\\Far — Far', icon: ICONS.term, content: body, width: 680, height: 430, className: 'win-far' });
    };

    const about = (faction.docs || []).find((d) => d.category === 'about');
    addIcon(t('Мой терминал'), ICONS.pc, () => about && openDoc(about));
    groups.filter((g) => g.id !== 'about').forEach((g) => addIcon(g.name, ICONS.folder, () => openFolder(g)));
    addIcon('Far', ICONS.term, openFar);
    addIcon(t('Корзина'), ICONS.bin, () => wm.open('bin', { title: t('Корзина'), icon: ICONS.bin, content: `<div class="xp-empty">${t('Корзина пуста.')}</div>`, width: 360, height: 220 }));

    // Пуск
    const sm = screen.querySelector('.xp-startmenu');
    const startBtn = screen.querySelector('.xp-start');
    const smLeft = sm.querySelector('.xp-sm-left');
    const smRight = sm.querySelector('.xp-sm-right');
    const smItem = (ul, label, icon, fn) => {
      const li = document.createElement('li');
      li.innerHTML = `<button type="button"><img src="${icon}" alt=""><span>${esc(label)}</span></button>`;
      li.firstElementChild.addEventListener('click', () => { sm.hidden = true; fn(); });
      ul.appendChild(li);
    };
    (faction.docs || []).slice(0, 7).forEach((d) => smItem(smLeft, d.title, docIcon(d), () => openDoc(d)));
    groups.forEach((g) => smItem(smRight, g.name, ICONS.folder, () => openFolder(g)));
    smItem(smRight, 'Far Manager', ICONS.term, openFar);
    startBtn.addEventListener('click', (e) => { e.stopPropagation(); sm.hidden = !sm.hidden; });
    screen.addEventListener('click', (e) => { if (!e.target.closest('.xp-startmenu')) sm.hidden = true; });
    sm.querySelector('[data-act="logoff"]').addEventListener('click', () => { wm.closeAll(); welcome(); });
    sm.querySelector('[data-act="off"]').addEventListener('click', () => {
      screen.innerHTML = `<div class="xp-off">${t('Теперь питание компьютера можно отключить.')}</div>`;
      try { sessionStorage.removeItem(bootKey); } catch { /* */ }
    });

    if (about && window.innerWidth > 700) openDoc(about);
  }

  if (booted || skipBoot) desktop(); else boot();
  return { screen };
}
