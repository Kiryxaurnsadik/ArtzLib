// Полевой ноутбук: рабочий стол в стиле Vista (Aero, боковая панель, сфера «Пуск»).
import { WindowManager } from './wm.js';
import { ICONS, docIcon, renderDocInto, clock } from './views.js';
import { groupDocs } from './store.js';
import { esc } from './md.js';

export function renderLaptop(root, { faction, data, skipBoot }) {
  root.innerHTML = `
    <div class="laptop">
      <div class="laptop-lid">
        <i class="laptop-cam"></i>
        <div class="laptop-screen">
          <div class="screen-inner vista" data-screen></div>
          <div class="lcd-fx" aria-hidden="true"></div>
        </div>
        <div class="laptop-brand">${esc(faction.name)} · ПОЛЕВОЙ</div>
      </div>
      <div class="laptop-base"><div class="laptop-keys"></div><div class="laptop-pad"></div></div>
    </div>`;
  const screen = root.querySelector('[data-screen]');
  const groups = groupDocs(faction, data.factions.categories);
  const bootKey = `artz.boot.laptop.${faction.id}`;
  let booted = false;
  try { booted = sessionStorage.getItem(bootKey) === '1'; } catch { /* */ }

  function boot() {
    screen.innerHTML = `<div class="vista-boot"><div class="vista-boot-bar"><i></i></div><div class="vista-boot-copy">© НПО «Агат» · Окна Vista</div></div>`;
    setTimeout(login, 2200);
  }

  function login() {
    screen.innerHTML = `
      <div class="vista-login">
        <div class="vista-login-tile">
          <div class="vista-userpic"><img src="${faction.emblem}" alt=""></div>
          <div class="vista-login-name">${esc(faction.user?.name || 'Оператор')}</div>
          <form class="vista-login-form"><input type="password" placeholder="Пароль" aria-label="Пароль"><button type="submit" aria-label="Войти">➜</button></form>
          <div class="vista-login-hint">Подсказка: любой пароль</div>
        </div>
        <div class="vista-login-brand">Окна Vista<sup>™</sup> · ${esc(faction.fullName)}</div>
      </div>`;
    const form = screen.querySelector('form');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      screen.querySelector('.vista-login').classList.add('is-welcome');
      screen.querySelector('.vista-login-hint').textContent = 'Добро пожаловать';
      setTimeout(desktop, 900);
    });
    setTimeout(() => form.querySelector('input')?.focus({ preventScroll: true }), 50);
  }

  function desktop() {
    try { sessionStorage.setItem(bootKey, '1'); } catch { /* */ }
    screen.innerHTML = `
      <div class="vista-desktop" style="--emblem:url('${new URL(faction.emblem, location.href).href}')">
        <div class="vista-icons"></div>
        <aside class="vista-sidebar">
          <div class="gadget g-clock"><div class="g-clock-face"><i class="h"></i><i class="m"></i><i class="s"></i></div><div class="g-cap">${esc(faction.location || 'ЧАЗ')}</div></div>
          <div class="gadget g-meter"><div class="g-title">Радиационный фон</div><div class="g-val" data-rad>0.18</div><div class="g-unit">мкЗв/ч</div><div class="g-bar"><i data-radbar></i></div></div>
          <div class="gadget g-meter g-psi"><div class="g-title">Пси-фон</div><div class="g-val" data-psi>12</div><div class="g-unit">усл. ед.</div><div class="g-bar"><i data-psibar></i></div></div>
          <div class="gadget g-notes"><div class="g-title">Заметки</div><div class="g-note">${esc(faction.journal?.find((j) => j.status === 'active')?.title || faction.motto || '')}</div></div>
        </aside>
        <div class="vista-windows"></div>
      </div>
      <footer class="vista-taskbar">
        <button type="button" class="vista-orb" aria-label="Пуск"><img src="${faction.emblem}" alt=""></button>
        <div class="vista-quick"></div>
        <div class="vista-tasks"></div>
        <div class="vista-tray"><span>RU</span><time></time></div>
      </footer>
      <div class="vista-start" hidden>
        <div class="vs-left">
          <ul class="vs-list"></ul>
          <div class="vs-search"><input type="search" placeholder="Начать поиск" aria-label="Поиск документов"></div>
        </div>
        <div class="vs-right">
          <div class="vs-pic"><img src="${faction.emblem}" alt=""></div>
          <b class="vs-user">${esc(faction.user?.name || 'Оператор')}</b>
          <ul class="vs-places"></ul>
          <div class="vs-power"><button type="button" data-act="lock" aria-label="Блокировать">🔒</button><button type="button" data-act="off" aria-label="Завершение работы">⏻</button></div>
        </div>
      </div>`;
    clock(screen.querySelector('.vista-tray time'));
    analogClock(screen.querySelector('.g-clock-face'));
    meters(screen);

    const wm = new WindowManager(screen.querySelector('.vista-windows'), screen.querySelector('.vista-tasks'));
    const openDoc = (doc) => {
      const body = document.createElement('div');
      body.className = doc.kind === 'chat' ? 'vista-term' : 'vista-doc';
      wm.open(`doc:${doc.id}`, { title: doc.title, icon: docIcon(doc), content: body, width: 660, height: 480 });
      renderDocInto(body, doc, faction);
    };

    const openExplorer = (gid) => {
      const body = document.createElement('div');
      body.className = 'vista-ex';
      body.innerHTML = `
        <div class="vx-top">
          <div class="vx-nav"><button type="button" aria-label="Назад">◀</button><button type="button" aria-label="Вперёд">▶</button></div>
          <div class="vx-crumbs"></div>
          <input class="vx-search" type="search" placeholder="Поиск" aria-label="Поиск">
        </div>
        <div class="vx-cmd"><span>Упорядочить ▾</span><span>Виды ▾</span><span>Общий доступ</span></div>
        <div class="vx-main">
          <nav class="vx-tree"></nav>
          <div class="vx-files"></div>
          <div class="vx-preview"><div class="vx-prev-empty">Выберите файл для предварительного просмотра.</div></div>
        </div>
        <div class="vx-status"></div>`;
      const tree = body.querySelector('.vx-tree');
      const files = body.querySelector('.vx-files');
      const crumbs = body.querySelector('.vx-crumbs');
      const status = body.querySelector('.vx-status');
      const prev = body.querySelector('.vx-preview');
      let cur = gid || groups[0]?.id;
      const show = (id, q = '') => {
        cur = id;
        tree.querySelectorAll('button').forEach((b) => b.classList.toggle('is-cur', b.dataset.g === id));
        const g = groups.find((x) => x.id === id);
        const list = q
          ? (faction.docs || []).filter((d) => d.title.toLowerCase().includes(q.toLowerCase()))
          : g?.docs || [];
        crumbs.textContent = q ? `Результаты поиска: ${q}` : `${faction.name} ▸ Документы ▸ ${g?.name || ''}`;
        files.innerHTML = '';
        list.forEach((d) => {
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'vx-file';
          b.innerHTML = `<img src="${docIcon(d)}" alt=""><span>${esc(d.title)}</span><small>${esc(d.author || '')}</small>`;
          b.addEventListener('click', () => {
            files.querySelectorAll('.is-sel').forEach((n) => n.classList.remove('is-sel'));
            b.classList.add('is-sel');
            prev.innerHTML = `<img class="vx-prev-ico" src="${docIcon(d)}" alt=""><b>${esc(d.title)}</b><span>${esc(d.org || '')}</span><span>${esc(d.author || '')}</span><button type="button" class="vx-open">Открыть</button>`;
            prev.querySelector('.vx-open').addEventListener('click', () => openDoc(d));
          });
          b.addEventListener('dblclick', () => openDoc(d));
          files.appendChild(b);
        });
        status.textContent = `Элементов: ${list.length}`;
      };
      groups.forEach((g) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.dataset.g = g.id;
        b.innerHTML = `<img src="${ICONS.folder}" alt="">${esc(g.name)}`;
        b.addEventListener('click', () => show(g.id));
        tree.appendChild(b);
      });
      body.querySelector('.vx-search').addEventListener('input', (e) => show(cur, e.target.value.trim()));
      show(cur);
      wm.open('explorer', { title: 'Документы', icon: ICONS.folder, content: body, width: 760, height: 470 });
    };

    // значки
    const icons = screen.querySelector('.vista-icons');
    const addIcon = (label, icon, fn) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'vista-icon';
      b.innerHTML = `<img src="${icon}" alt=""><span>${esc(label)}</span>`;
      b.addEventListener('dblclick', fn);
      b.addEventListener('keydown', (e) => { if (e.key === 'Enter') fn(); });
      b.addEventListener('pointerup', (e) => { if (e.pointerType === 'touch') fn(); });
      icons.appendChild(b);
    };
    const about = (faction.docs || []).find((d) => d.category === 'about');
    addIcon('Компьютер', ICONS.pc, () => about && openDoc(about));
    addIcon('Документы', ICONS.folder, () => openExplorer());
    const chat = (faction.docs || []).find((d) => d.kind === 'chat');
    if (chat) addIcon(chat.title, docIcon(chat), () => openDoc(chat));
    addIcon('Корзина', ICONS.bin, () => wm.open('bin', { title: 'Корзина', icon: ICONS.bin, content: '<div class="xp-empty">Корзина пуста.</div>', width: 380, height: 220 }));

    // быстрый запуск
    const quick = screen.querySelector('.vista-quick');
    const q = document.createElement('button');
    q.type = 'button';
    q.innerHTML = `<img src="${ICONS.folder}" alt="Документы">`;
    q.addEventListener('click', () => openExplorer());
    quick.appendChild(q);

    // меню Пуск
    const start = screen.querySelector('.vista-start');
    const list = start.querySelector('.vs-list');
    const fill = (filter = '') => {
      list.innerHTML = '';
      const docs = (faction.docs || []).filter((d) => !filter || d.title.toLowerCase().includes(filter.toLowerCase()));
      docs.slice(0, filter ? 12 : 8).forEach((d) => {
        const li = document.createElement('li');
        li.innerHTML = `<button type="button"><img src="${docIcon(d)}" alt=""><span>${esc(d.title)}</span></button>`;
        li.firstElementChild.addEventListener('click', () => { start.hidden = true; openDoc(d); });
        list.appendChild(li);
      });
      if (!docs.length) list.innerHTML = '<li class="vs-none">Ничего не найдено</li>';
    };
    fill();
    start.querySelector('.vs-search input').addEventListener('input', (e) => fill(e.target.value.trim()));
    const places = start.querySelector('.vs-places');
    groups.forEach((g) => {
      const li = document.createElement('li');
      li.innerHTML = `<button type="button">${esc(g.name)}</button>`;
      li.firstElementChild.addEventListener('click', () => { start.hidden = true; openExplorer(g.id); });
      places.appendChild(li);
    });
    screen.querySelector('.vista-orb').addEventListener('click', (e) => { e.stopPropagation(); start.hidden = !start.hidden; if (!start.hidden) start.querySelector('input').focus({ preventScroll: true }); });
    screen.addEventListener('click', (e) => { if (!e.target.closest('.vista-start')) start.hidden = true; });
    start.querySelector('[data-act="lock"]').addEventListener('click', () => { wm.closeAll(); login(); });
    start.querySelector('[data-act="off"]').addEventListener('click', () => {
      screen.innerHTML = '<div class="vista-off">Завершение работы...</div>';
      try { sessionStorage.removeItem(bootKey); } catch { /* */ }
      setTimeout(() => { if (screen.isConnected) screen.innerHTML = '<div class="vista-off is-dark"></div>'; }, 1500);
    });

    if (window.innerWidth > 800) openExplorer();
  }

  if (booted || skipBoot) desktop(); else boot();
  return { screen };
}

function analogClock(face) {
  const h = face.querySelector('.h'), m = face.querySelector('.m'), s = face.querySelector('.s');
  const upd = () => {
    if (!face.isConnected) return;
    const d = new Date();
    s.style.transform = `rotate(${d.getSeconds() * 6}deg)`;
    m.style.transform = `rotate(${d.getMinutes() * 6 + d.getSeconds() * 0.1}deg)`;
    h.style.transform = `rotate(${(d.getHours() % 12) * 30 + d.getMinutes() * 0.5}deg)`;
    setTimeout(upd, 1000);
  };
  upd();
}

function meters(screen) {
  const rad = screen.querySelector('[data-rad]'), radbar = screen.querySelector('[data-radbar]');
  const psi = screen.querySelector('[data-psi]'), psibar = screen.querySelector('[data-psibar]');
  let r = 0.18, p = 12;
  const upd = () => {
    if (!rad.isConnected) return;
    r = Math.max(0.08, Math.min(3, r + (Math.random() - 0.48) * 0.06));
    p = Math.max(2, Math.min(100, p + (Math.random() - 0.5) * 4));
    rad.textContent = r.toFixed(2);
    radbar.style.width = `${Math.min(100, r / 3 * 100)}%`;
    psi.textContent = Math.round(p);
    psibar.style.width = `${p}%`;
    setTimeout(upd, 1500);
  };
  upd();
}
