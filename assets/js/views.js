import { renderMarkdown, parseChat, esc } from './md.js';
import { loadDoc } from './store.js';

export const ICONS = {
  folder: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><path d="M4 12h15l4 4h21v24H4z" fill="#e8b54a"/><path d="M4 18h40v22H4z" fill="#f6d27a"/><path d="M4 18h40v3H4z" fill="#fff" opacity=".35"/></svg>'),
  doc: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><path d="M10 4h20l8 8v32H10z" fill="#fff" stroke="#7a8aa0" stroke-width="2"/><path d="M30 4v8h8" fill="#dde4ee" stroke="#7a8aa0" stroke-width="2"/><path d="M15 20h18M15 26h18M15 32h12" stroke="#4b6aa8" stroke-width="2.5"/></svg>'),
  disk: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect x="6" y="6" width="36" height="36" rx="3" fill="#2d3a48"/><rect x="14" y="6" width="20" height="12" fill="#c9d1da"/><rect x="27" y="8" width="4" height="8" fill="#2d3a48"/><rect x="12" y="24" width="24" height="16" fill="#eef1f4"/></svg>'),
  term: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect x="4" y="8" width="40" height="30" rx="3" fill="#1b2a6b" stroke="#9fb3ff" stroke-width="2"/><path d="M10 16l6 5-6 5" stroke="#7ef" stroke-width="3" fill="none"/><path d="M19 27h10" stroke="#ff0" stroke-width="3"/><rect x="16" y="38" width="16" height="4" fill="#8a94a8"/></svg>'),
  bin: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><path d="M12 14h24l-3 28H15z" fill="#cfe3f0" stroke="#5b7a92" stroke-width="2"/><path d="M9 12h30" stroke="#5b7a92" stroke-width="3"/><path d="M19 20v16M24 20v16M29 20v16" stroke="#7d9ab0" stroke-width="2"/></svg>'),
  pc: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect x="5" y="6" width="38" height="26" rx="2" fill="#d8dde4" stroke="#6d7785" stroke-width="2"/><rect x="9" y="10" width="30" height="18" fill="#2f6fd0"/><path d="M18 32h12l2 6H16z" fill="#a9b1bc"/><rect x="12" y="38" width="24" height="4" rx="1" fill="#8b95a3"/></svg>'),
  info: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><circle cx="24" cy="24" r="19" fill="#2f74d0" stroke="#fff" stroke-width="3"/><rect x="21.5" y="20" width="5" height="16" fill="#fff"/><circle cx="24" cy="14" r="3" fill="#fff"/></svg>'),
};

export function docIcon(doc) {
  if (doc.icon) return doc.icon;
  if (doc.kind === 'chat') return ICONS.disk;
  return ICONS.doc;
}

export function docHeaderHTML(doc, faction) {
  const meta = Object.entries(doc.meta || {})
    .map(([k, v]) => `<div><dt>${esc(k)}:</dt><dd>${esc(v)}</dd></div>`).join('');
  return `
    <header class="doc-head">
      <img class="doc-emblem" src="${faction.emblem}" alt="">
      <div>
        <div class="doc-org">${esc(doc.org || faction.fullName)}</div>
        <h1 class="doc-title">${esc(doc.title)}</h1>
        ${doc.author ? `<div class="doc-author">Автор: ${esc(doc.author)}</div>` : ''}
      </div>
    </header>
    ${meta ? `<dl class="doc-meta">${meta}</dl>` : ''}`;
}

export async function renderDocInto(el, doc, faction, { header = true } = {}) {
  el.innerHTML = '<div class="doc-loading">Загрузка...</div>';
  const md = await loadDoc(doc);
  if (doc.kind === 'chat') {
    el.innerHTML = '';
    el.appendChild(chatView(md, doc));
    return;
  }
  el.innerHTML = `<article class="doc">${header ? docHeaderHTML(doc, faction) : ''}<div class="doc-body">${renderMarkdown(md) || '<p class="muted">Документ пуст.</p>'}</div></article>`;
}

// «Дискета»: диалог запрос — ответ с эффектом печати
export function chatView(md, doc) {
  const wrap = document.createElement('div');
  wrap.className = 'chat';
  const items = parseChat(md);
  const log = document.createElement('div');
  log.className = 'chat-log';
  wrap.appendChild(log);
  const qs = items.filter((x) => x.type === 'q');
  const pairs = [];
  items.forEach((it, i) => { if (it.type === 'q') pairs.push({ q: it, a: items[i + 1]?.type === 'a' ? items[i + 1] : null }); });
  items.filter((x) => x.type === 'system' || x.type === 'note').forEach((it) => {
    log.insertAdjacentHTML('beforeend', `<div class="chat-msg chat-${it.type}">${esc(it.text)}</div>`);
  });
  const menu = document.createElement('div');
  menu.className = 'chat-menu';
  menu.innerHTML = `<div class="chat-menu-title">Запросы к ${esc(doc.author || 'ИИ')}:</div>`;
  pairs.forEach((p, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = `> ${p.q.text}`;
    b.addEventListener('click', () => ask(p, b));
    menu.appendChild(b);
  });
  wrap.appendChild(menu);
  let busy = false;
  function ask(p, btn) {
    if (busy) return;
    busy = true;
    btn.disabled = true;
    log.insertAdjacentHTML('beforeend', `<div class="chat-msg chat-q">&gt; ${esc(p.q.text)}</div>`);
    const a = document.createElement('div');
    a.className = 'chat-msg chat-a';
    log.appendChild(a);
    const text = p.a ? p.a.text : 'Нет данных. Повторите запрос.';
    let i = 0;
    const tick = () => {
      i = Math.min(text.length, i + 6);
      a.textContent = '> ' + text.slice(0, i);
      log.scrollTop = log.scrollHeight;
      if (i < text.length) setTimeout(tick, 12);
      else busy = false;
    };
    tick();
  }
  if (!qs.length) menu.remove();
  return wrap;
}

export function clock(el, opts = { hour: '2-digit', minute: '2-digit' }) {
  const upd = () => { if (el.isConnected) el.textContent = new Date().toLocaleTimeString('ru-RU', opts); };
  upd();
  const id = setInterval(() => (el.isConnected ? upd() : clearInterval(id)), 10000);
}
