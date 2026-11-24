// КПК сталкера. Каждая оболочка — отдельная страница:
// S2 (современный), ТЧ, ЧН и ЗП (классическая трилогия).
// В КПК только информация: записи группировки и сведения о владельце.
import { renderDocInto, docIcon, clock } from './views.js';
import { groupDocs } from './store.js';
import { esc } from './md.js';
import { t } from './i18n.js';

export const PDA_SKINS = {
  s2: { name: 'КПК · STALKER 2', short: 'S2' },
  shoc: { name: 'КПК · Тень Чернобыля', short: 'ТЧ' },
  cs: { name: 'КПК · Чистое Небо', short: 'ЧН' },
  cop: { name: 'КПК · Зов Припяти', short: 'ЗП' },
};

export const S2_THEMES = {
  standard: 'Стандарт (янтарный)',
  military: 'Военный (олива)',
  science: 'Научный (бирюза)',
  night: 'Ночной (красный)',
  mono: 'Монохром',
};

const avatarOf = (f) => f.look?.avatar || f.emblem;

export function renderPDA(root, { faction, data, skin = 's2' }) {
  const groups = groupDocs(faction, data.factions.categories);
  const docs = faction.docs || [];
  const theme = faction.pda?.theme || 'standard';

  root.innerHTML = `
    <div class="pda pda-${skin}">
      <div class="pda-case">
        <div class="pda-grip pda-grip-t"></div><div class="pda-grip pda-grip-b"></div>
        <div class="pda-screen">
          <div class="screen-inner pda-ui" data-screen></div>
          <div class="pda-fx" aria-hidden="true"></div>
        </div>
        <div class="pda-side">
          <button type="button" class="pda-hw" data-hw="home" title="${t('К списку')}" aria-label="${t('К списку')}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 11.5 12 5l8 6.5M6.5 10v9h4v-5h3v5h4v-9" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg></button>
          <button type="button" class="pda-hw pda-hw-round" aria-label="${t('Назад')}" data-hw="back"></button>
        </div>
      </div>
    </div>`;
  const screen = root.querySelector('[data-screen]');
  const back = () => { screen.querySelector('.has-detail')?.classList.remove('has-detail'); };
  root.querySelector('[data-hw="back"]').addEventListener('click', back);
  root.querySelector('[data-hw="home"]').addEventListener('click', () => { back(); screen.querySelector('[data-tab]')?.click(); });

  const infoHTML = (cls) => `
    <div class="${cls}-info">
      <img src="${avatarOf(faction)}" alt="">
      <div>
        <h2 class="${cls}-h">${esc(faction.fullName || faction.name)}</h2>
        <div class="${cls}-sub">${esc(faction.motto || '')}</div>
        <dl>
          <dt>${t('Владелец')}</dt><dd>${esc(faction.user?.name || '')}</dd>
          <dt>${t('Должность')}</dt><dd>${esc(faction.user?.role || '')}</dd>
          ${faction.pda?.rank ? `<dt>${t('Ранг')}</dt><dd>${esc(faction.pda.rank)}</dd>` : ''}
          ${faction.pda?.reputation ? `<dt>${t('Репутация')}</dt><dd>${esc(faction.pda.reputation)}</dd>` : ''}
          <dt>${t('Местоположение')}</dt><dd>${esc(faction.location || '')}</dd>
          <dt>${t('Записей')}</dt><dd>${docs.length}</dd>
        </dl>
      </div>
      <img class="${cls}-info-emb" src="${faction.emblem}" alt="">
    </div>`;

  // ---------- STALKER 2 ----------
  function s2() {
    const tabs = [['notes', t('Заметки')], ['info', t('Сведения')]];
    screen.innerHTML = `
      <div class="s2" data-theme="${esc(theme)}">
        <div class="s2-status"><span class="s2-sig">▂▃▅▇</span><span>${esc(faction.location || t('Зона'))}</span><span class="s2-deco"></span><time></time></div>
        <nav class="s2-tabs"><span class="s2-arrow" aria-hidden="true">‹</span>${tabs.map(([id, n]) => `<button type="button" data-tab="${id}">${n}</button>`).join('')}<span class="s2-arrow" aria-hidden="true">›</span></nav>
        <div class="s2-body"></div>
        <div class="s2-foot"><button type="button" class="s2-back"><span class="s2-back-ico" aria-hidden="true">↩</span> ${t('Назад')}</button><span class="s2-owner">${esc(faction.user?.name || '')}</span></div>
      </div>`;
    clock(screen.querySelector('.s2-status time'));
    screen.querySelector('.s2-back').addEventListener('click', back);
    const body = screen.querySelector('.s2-body');
    const btns = [...screen.querySelectorAll('[data-tab]')];
    const open = (id) => {
      btns.forEach((b) => b.classList.toggle('is-cur', b.dataset.tab === id));
      if (id === 'notes') {
        listView(body, docs.map((d) => ({ id: d.id, title: d.title, sub: d.kind === 'chat' ? t('Носитель данных') : '', img: d.kind === 'chat' || d.icon ? docIcon(d) : '', ico: d.category, cat: d.category, render: (el) => noteView(el, d) })));
      } else {
        body.innerHTML = infoHTML('s2');
      }
    };
    function noteView(el, d) {
      if (d.kind === 'chat') {
        el.innerHTML = `<h2 class="s2-h">${esc(d.title)}</h2><div class="s2-sub">${esc(d.org || '')}</div><div class="s2-chat"></div>`;
        renderDocInto(el.querySelector('.s2-chat'), d, faction);
        return;
      }
      el.innerHTML = `<h2 class="s2-h">${esc(d.title)}</h2><div class="s2-sub">${t('Найдено')}: ${esc(d.org || faction.fullName)}</div><div class="s2-note"><div class="s2-note-text"></div><figure class="s2-photo"><figcaption>File_Photo.gsc</figcaption><img src="${d.cover || faction.emblem}" alt=""></figure></div>`;
      renderDocInto(el.querySelector('.s2-note-text'), d, faction, { header: false }).then(() => {
        const first = el.querySelector('.s2-note-text img.md-img');
        if (first && !d.cover) el.querySelector('.s2-photo img').src = first.getAttribute('src');
      });
    }
    function listView(target, items) {
      const cats = [...new Set(items.map((i) => i.cat).filter(Boolean))];
      target.innerHTML = `
        <div class="s2-split">
          <aside class="s2-list">
            ${cats.length > 1 ? `<div class="s2-filters"><button type="button" class="is-cur" data-f="" title="${t('Все записи')}">☰</button>${cats.map((c) => `<button type="button" data-f="${esc(c)}" title="${esc(data.factions.categories?.[c] || c)}">${catGlyph(c)}</button>`).join('')}</div>` : ''}
            <div class="s2-cat-name">${t('Все записи')}</div>
            <ul></ul>
          </aside>
          <section class="s2-detail"></section>
        </div>`;
      const ul = target.querySelector('ul');
      const detail = target.querySelector('.s2-detail');
      const catName = target.querySelector('.s2-cat-name');
      const fill = (f) => {
        ul.innerHTML = '';
        catName.textContent = f ? (data.factions.categories?.[f] || f) : t('Все записи');
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

  // ---------- классика: ТЧ, ЧН, ЗП ----------
  function classic() {
    const tabs = [['enc', t('Энциклопедия')], ['info', skin === 'cs' ? t('Личное дело') : t('Сведения')]];
    const title = skin === 'cs' ? `${t('КПК')} · ${t('локальная сеть')}` : t('КПК');
    screen.innerHTML = `
      <div class="cl cl-${skin}">
        <div class="cl-top"><span>${esc(title)} · ${esc(faction.location || t('Зона'))}</span><time></time></div>
        <div class="cl-main">
          <nav class="cl-tabs">${tabs.map(([id, n]) => `<button type="button" data-tab="${id}">${n}</button>`).join('')}</nav>
          <div class="cl-body"></div>
        </div>
      </div>`;
    clock(screen.querySelector('.cl-top time'));
    const body = screen.querySelector('.cl-body');
    const btns = [...screen.querySelectorAll('[data-tab]')];
    const open = (id) => {
      btns.forEach((b) => b.classList.toggle('is-cur', b.dataset.tab === id));
      if (id === 'info') { body.innerHTML = `<div class="cl-pane">${infoHTML('cl')}</div>`; return; }
      body.innerHTML = `<div class="cl-enc"><ul class="cl-tree">${groups.map((g) => `<li><b>${esc(g.name)}</b><ul>${g.docs.map((d) => `<li><button type="button" data-doc="${esc(d.id)}">${esc(d.title)}</button></li>`).join('')}</ul></li>`).join('')}</ul><div class="cl-article"></div></div>`;
      const art = body.querySelector('.cl-article');
      body.querySelectorAll('[data-doc]').forEach((b) => b.addEventListener('click', () => {
        body.querySelectorAll('[data-doc]').forEach((x) => x.classList.toggle('is-cur', x === b));
        const d = docs.find((x) => x.id === b.dataset.doc);
        renderDocInto(art, d, faction);
        art.scrollTop = 0;
        body.querySelector('.cl-enc').classList.add('has-detail');
      }));
      if (window.innerWidth > 640) body.querySelector('[data-doc]')?.click();
    };
    btns.forEach((b) => b.addEventListener('click', () => open(b.dataset.tab)));
    open('enc');
  }

  if (skin === 's2') s2(); else classic();
  return { get screen() { return root.querySelector('[data-screen]'); } };
}

function catGlyph(c) {
  return ({ about: 'ⓘ', tech: '⚙', med: '✚', research: '⚗', communities: '⚑', objects: '◈', intel: '⌁', field: '✎', staff: '☺' })[c] || '▤';
}
