// КПК сталкера: две оболочки — «ТЧ» (классическая, 2007) и «S2» (современная).
import { renderDocInto, docIcon, clock } from './views.js';
import { groupDocs, safe } from './store.js';
import { esc } from './md.js';

const MARK = { base: '#4fbf5f', poi: '#e8c15a', danger: '#e0483c', anomaly: '#b46cf0', lab: '#46a7e8', done: '#8a8a8a' };

function mapSVG(points, skin) {
  const land = skin === 'shoc' ? '#3b4a2c' : '#2b2a26';
  const land2 = skin === 'shoc' ? '#46563a' : '#34332e';
  const line = skin === 'shoc' ? '#8fa874' : '#6d6a60';
  const pts = (points || []).map((p, i) => `
    <g class="map-pt" tabindex="0" data-i="${i}" transform="translate(${p.x * 10} ${p.y * 6})">
      <circle r="9" fill="${MARK[p.type] || MARK.poi}" opacity=".25"><animate attributeName="r" values="7;14;7" dur="2.4s" repeatCount="indefinite"/></circle>
      <circle r="5" fill="${MARK[p.type] || MARK.poi}" stroke="#000" stroke-width="1.5"/>
      <text x="9" y="4" fill="#efe9d8" font-size="13">${esc(p.name)}</text>
    </g>`).join('');
  return `<svg class="pda-map" viewBox="0 0 1000 600" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Карта">
    <defs><pattern id="grid-${skin}" width="50" height="50" patternUnits="userSpaceOnUse"><path d="M50 0H0V50" fill="none" stroke="${line}" stroke-opacity=".25"/></pattern></defs>
    <rect width="1000" height="600" fill="${land}"/>
    <path d="M0 420 C120 380 220 470 330 430 S520 330 640 380 S860 470 1000 400 V600 H0Z" fill="${land2}"/>
    <path d="M80 80 C200 40 300 140 420 110 S640 30 760 90 S920 160 1000 120 V0 H0 V60Z" fill="${land2}" opacity=".7"/>
    <path d="M-10 300 C150 280 250 330 380 300 S600 250 720 300 S900 360 1010 330" fill="none" stroke="#3f6f86" stroke-width="10" opacity=".55"/>
    <path d="M500 600 L480 450 L520 320 L470 180 L540 0" fill="none" stroke="${line}" stroke-width="3" stroke-dasharray="10 6" opacity=".7"/>
    <path d="M0 520 L300 470 L520 320 L800 260 L1000 230" fill="none" stroke="${line}" stroke-width="2" opacity=".5"/>
    <rect width="1000" height="600" fill="url(#grid-${skin})"/>
    ${pts}
  </svg>`;
}

const STATUS_TXT = { active: 'Активно', done: 'Выполнено', failed: 'Провалено' };

export function renderPDA(root, { faction, data }) {
  const skinKey = `artz.pdaSkin.${faction.id}`;
  let skin = safe.get(skinKey) || faction.pdaSkin || 's2';
  const groups = groupDocs(faction, data.factions.categories);
  const docs = faction.docs || [];
  const chat = docs.find((d) => d.kind === 'chat');
  const notes = docs.filter((d) => d.kind !== 'chat');

  const draw = () => {
    root.innerHTML = `
      <div class="pda pda-${skin}">
        <div class="pda-case">
          <div class="pda-grip pda-grip-t"></div><div class="pda-grip pda-grip-b"></div>
          <div class="pda-screen">
            <div class="screen-inner pda-ui" data-screen></div>
            <div class="pda-fx" aria-hidden="true"></div>
          </div>
          <div class="pda-side">
            <button type="button" class="pda-hw" data-hw="skin" title="Сменить оболочку КПК">${skin === 'shoc' ? 'S2' : 'ТЧ'}</button>
            <button type="button" class="pda-hw pda-hw-round" aria-label="Назад" data-hw="back"></button>
          </div>
          <div class="pda-label">${skin === 'shoc' ? 'КПК «Сталкер»' : 'КПК · ' + esc(faction.name)}</div>
        </div>
      </div>`;
    root.querySelector('[data-hw="skin"]').addEventListener('click', () => {
      skin = skin === 'shoc' ? 's2' : 'shoc';
      safe.set(skinKey, skin);
      draw();
      root.dispatchEvent(new CustomEvent('redraw'));
    });
    const screen = root.querySelector('[data-screen]');
    if (skin === 'shoc') shoc(screen); else s2(screen);
    root.querySelector('[data-hw="back"]').addEventListener('click', () => {
      const open = screen.querySelector('.has-detail');
      if (open) open.classList.remove('has-detail');
      else root.dispatchEvent(new CustomEvent('exit', { bubbles: true }));
    });
    screen.querySelector('.s2-exit')?.addEventListener('click', () => root.dispatchEvent(new CustomEvent('exit', { bubbles: true })));
  };

  // ---------- STALKER 2 ----------
  function s2(screen) {
    const tabs = [['map', 'Карта'], ['journal', 'Журнал'], ['notes', 'Заметки']];
    if (chat) tabs.push(['disk', 'Дискета']);
    tabs.push(['info', 'Сведения']);
    screen.innerHTML = `
      <div class="s2">
        <div class="s2-status"><span class="s2-sig">▂▃▅▇</span><span>${esc(faction.location || 'Зона')}</span><span class="s2-deco"></span><time></time></div>
        <nav class="s2-tabs"><kbd>Q</kbd>${tabs.map(([id, n]) => `<button type="button" data-tab="${id}">${n}</button>`).join('')}<kbd>E</kbd></nav>
        <div class="s2-body"></div>
        <div class="s2-foot"><button type="button" class="s2-exit"><kbd>Esc</kbd> Выход</button></div>
      </div>`;
    clock(screen.querySelector('.s2-status time'));
    const body = screen.querySelector('.s2-body');
    const btns = [...screen.querySelectorAll('[data-tab]')];
    const open = (id) => {
      btns.forEach((b) => b.classList.toggle('is-cur', b.dataset.tab === id));
      if (id === 'map') {
        body.innerHTML = `<div class="s2-mapwrap">${mapSVG(faction.map, 's2')}<div class="s2-legend">${(faction.map || []).map((p) => `<span><i style="background:${MARK[p.type] || MARK.poi}"></i>${esc(p.name)}</span>`).join('')}</div></div>`;
      } else if (id === 'journal') {
        listView(body, (faction.journal || []).map((j, i) => ({ id: `j${i}`, title: j.title, sub: STATUS_TXT[j.status] || '', ico: j.status, render: (el) => { el.innerHTML = `<h2 class="s2-h">${esc(j.title)}</h2><div class="s2-sub">${esc(STATUS_TXT[j.status] || '')}</div><p class="s2-text">${esc(j.text || '')}</p>`; } })));
      } else if (id === 'notes') {
        listView(body, notes.map((d) => ({ id: d.id, title: d.title, sub: '', ico: d.category, cat: d.category, render: (el) => noteView(el, d) })), true);
      } else if (id === 'disk') {
        listView(body, [{ id: chat.id, title: chat.author || chat.title, sub: 'Контакт', img: docIcon(chat), render: (el) => { el.innerHTML = `<h2 class="s2-h">${esc(chat.title)}</h2><div class="s2-sub">${esc(chat.org || '')}</div><div class="s2-chat"></div>`; renderDocInto(el.querySelector('.s2-chat'), chat, faction); } }]);
      } else {
        body.innerHTML = `<div class="s2-info"><img src="${faction.emblem}" alt=""><div><h2 class="s2-h">${esc(faction.fullName)}</h2><div class="s2-sub">${esc(faction.motto || '')}</div><dl><dt>Владелец</dt><dd>${esc(faction.user?.name || '')}</dd><dt>Должность</dt><dd>${esc(faction.user?.role || '')}</dd><dt>Местоположение</dt><dd>${esc(faction.location || '')}</dd><dt>Записей</dt><dd>${docs.length}</dd></dl></div></div>`;
      }
    };
    function noteView(el, d) {
      el.innerHTML = `<h2 class="s2-h">${esc(d.title)}</h2><div class="s2-sub">Найдено: ${esc(d.org || faction.fullName)}</div><div class="s2-note"><div class="s2-note-text"></div><figure class="s2-photo"><figcaption>File_Photo.gsc</figcaption><img src="${faction.emblem}" alt=""></figure></div>`;
      renderDocInto(el.querySelector('.s2-note-text'), d, faction, { header: false }).then(() => {
        const first = el.querySelector('.s2-note-text img.md-img');
        if (first) el.querySelector('.s2-photo img').src = first.getAttribute('src');
      });
    }
    function listView(target, items, filters) {
      const cats = [...new Set(items.map((i) => i.cat).filter(Boolean))];
      target.innerHTML = `
        <div class="s2-split">
          <aside class="s2-list">
            ${filters && cats.length > 1 ? `<div class="s2-filters"><kbd>A</kbd><button type="button" class="is-cur" data-f="">☰</button>${cats.map((c) => `<button type="button" data-f="${c}" title="${esc(data.factions.categories?.[c] || c)}">${catGlyph(c)}</button>`).join('')}<kbd>D</kbd></div>` : ''}
            <ul></ul>
          </aside>
          <section class="s2-detail"></section>
        </div>`;
      const ul = target.querySelector('ul');
      const detail = target.querySelector('.s2-detail');
      const fill = (f) => {
        ul.innerHTML = '';
        items.filter((i) => !f || i.cat === f).forEach((it, idx) => {
          const li = document.createElement('li');
          li.innerHTML = `<button type="button">${it.img ? `<img src="${it.img}" alt="">` : `<span class="s2-ico">${catGlyph(it.ico)}</span>`}<span class="s2-li-t">${esc(it.title)}${it.sub ? `<small>${esc(it.sub)}</small>` : ''}</span></button>`;
          li.firstElementChild.addEventListener('click', () => {
            ul.querySelectorAll('.is-cur').forEach((n) => n.classList.remove('is-cur'));
            li.firstElementChild.classList.add('is-cur');
            it.render(detail);
            detail.scrollTop = 0;
            target.querySelector('.s2-split').classList.add('has-detail');
          });
          ul.appendChild(li);
          if (idx === 0 && window.innerWidth > 640) li.firstElementChild.click();
        });
      };
      target.querySelectorAll('[data-f]').forEach((b) => b.addEventListener('click', () => {
        target.querySelectorAll('[data-f]').forEach((x) => x.classList.toggle('is-cur', x === b));
        fill(b.dataset.f);
      }));
      fill('');
    }
    btns.forEach((b) => b.addEventListener('click', () => open(b.dataset.tab)));
    open('notes');
  }

  // ---------- Тень Чернобыля ----------
  function shoc(screen) {
    const tabs = [['tasks', 'Задания'], ['map', 'Карта'], ['contacts', 'Контакты'], ['rank', 'Ранг'], ['stats', 'Статистика'], ['enc', 'Энциклопедия']];
    screen.innerHTML = `
      <div class="shoc">
        <div class="shoc-top"><span>${esc(faction.location || 'Зона')}</span><time></time></div>
        <div class="shoc-main">
          <nav class="shoc-tabs">${tabs.map(([id, n]) => `<button type="button" data-tab="${id}">${n}</button>`).join('')}</nav>
          <div class="shoc-body"></div>
        </div>
      </div>`;
    clock(screen.querySelector('.shoc-top time'));
    const body = screen.querySelector('.shoc-body');
    const btns = [...screen.querySelectorAll('[data-tab]')];
    const open = (id) => {
      btns.forEach((b) => b.classList.toggle('is-cur', b.dataset.tab === id));
      if (id === 'tasks') {
        body.innerHTML = `<div class="shoc-pane"><h3>Текущие задания</h3>${(faction.journal || []).map((j) => `<div class="shoc-task shoc-${j.status}"><b>${esc(j.title)}</b><span>${esc(STATUS_TXT[j.status] || '')}</span><p>${esc(j.text || '')}</p></div>`).join('') || '<p>Нет заданий.</p>'}</div>`;
      } else if (id === 'map') {
        body.innerHTML = `<div class="shoc-pane shoc-mapwrap">${mapSVG(faction.map, 'shoc')}</div>`;
      } else if (id === 'contacts') {
        const cs = [{ n: faction.user?.name, r: faction.user?.role, img: faction.emblem }];
        if (chat) cs.push({ n: chat.author || chat.title, r: chat.org, img: docIcon(chat), chat: true });
        body.innerHTML = `<div class="shoc-pane"><h3>Контакты</h3><div class="shoc-contacts">${cs.map((c, i) => `<button type="button" class="shoc-contact" data-c="${i}"><img src="${c.img}" alt=""><span><b>${esc(c.n || '')}</b><small>${esc(c.r || '')}</small></span></button>`).join('')}</div><div class="shoc-chat"></div></div>`;
        const ch = body.querySelector('[data-c="1"]');
        if (ch) ch.addEventListener('click', () => renderDocInto(body.querySelector('.shoc-chat'), chat, faction));
      } else if (id === 'rank') {
        body.innerHTML = `<div class="shoc-pane shoc-rank"><img src="${faction.emblem}" alt=""><dl><dt>Имя</dt><dd>${esc(faction.user?.name || '')}</dd><dt>Группировка</dt><dd>${esc(faction.fullName)}</dd><dt>Ранг</dt><dd>Опытный</dd><dt>Репутация</dt><dd>Хорошая</dd></dl><p class="shoc-motto">${esc(faction.motto || '')}</p></div>`;
      } else if (id === 'stats') {
        const done = (faction.journal || []).filter((j) => j.status === 'done').length;
        body.innerHTML = `<div class="shoc-pane"><h3>Статистика</h3><table class="shoc-stats"><tr><td>Записей в энциклопедии</td><td>${notes.length}</td></tr><tr><td>Разделов</td><td>${groups.length}</td></tr><tr><td>Выполнено заданий</td><td>${done}</td></tr><tr><td>Точек на карте</td><td>${(faction.map || []).length}</td></tr></table></div>`;
      } else {
        body.innerHTML = `<div class="shoc-enc"><ul class="shoc-tree">${groups.filter((g) => g.docs.some((d) => d.kind !== 'chat')).map((g) => `<li><b>${esc(g.name)}</b><ul>${g.docs.filter((d) => d.kind !== 'chat').map((d) => `<li><button type="button" data-doc="${d.id}">${esc(d.title)}</button></li>`).join('')}</ul></li>`).join('')}</ul><div class="shoc-article"></div></div>`;
        const art = body.querySelector('.shoc-article');
        body.querySelectorAll('[data-doc]').forEach((b) => b.addEventListener('click', () => {
          body.querySelectorAll('[data-doc]').forEach((x) => x.classList.toggle('is-cur', x === b));
          const d = notes.find((x) => x.id === b.dataset.doc);
          renderDocInto(art, d, faction);
          art.scrollTop = 0;
          body.querySelector('.shoc-enc').classList.add('has-detail');
        }));
        if (window.innerWidth > 640) body.querySelector('[data-doc]')?.click();
      }
    };
    btns.forEach((b) => b.addEventListener('click', () => open(b.dataset.tab)));
    open('enc');
  }

  draw();
  return { get screen() { return root.querySelector('[data-screen]'); } };
}

function catGlyph(c) {
  return ({ about: 'ⓘ', tech: '⚙', med: '✚', research: '⚗', communities: '⚑', objects: '◈', intel: '⌁', field: '✎', staff: '☺', active: '!', done: '✓', failed: '✕' })[c] || '▤';
}
