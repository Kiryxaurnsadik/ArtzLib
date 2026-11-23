import { loadAll, watchState, screenState, factionVars, DEVICES, STATUSES } from './store.js';
import { applyOverlay } from './overlays.js';
import { renderAgat } from './agat.js';
import { renderLaptop } from './laptop.js';
import { renderPDA } from './pda.js';
import { esc } from './md.js';

const app = document.getElementById('app');
let data = null;
let current = null; // { faction, device, screenGetter }

const SIZE = { agat: [1040, 900], laptop: [1180, 800], pda: [1120, 700] };
const RENDER = { agat: renderAgat, laptop: renderLaptop, pda: renderPDA };

function findFaction(id) { return data.factions.factions.find((f) => f.id === id); }

function route() {
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  document.body.classList.remove('on-device');
  current = null;
  if (!parts.length) return home();
  const f = findFaction(parts[0]);
  if (!f) return home();
  if (!parts[1] || !DEVICES[parts[1]]) return factionPage(f);
  return devicePage(f, parts[1]);
}

function banner() {
  const b = data.state.broadcast;
  const draft = data.draft ? '<div class="draft-note">Показан черновик из админки (только в этом браузере)</div>' : '';
  return draft + (b ? `<div class="broadcast" role="status"><span>${esc(b)}</span></div>` : '');
}

function statusBadge(f, d) {
  const st = screenState(data.state, f.id, d);
  if (st.status === 'normal') return '<span class="badge ok">в сети</span>';
  return `<span class="badge st-${st.status}">${esc(STATUSES[st.status]?.label || st.status)}</span>`;
}

function home() {
  document.title = 'Терминалы ЧАЗ';
  document.body.style.cssText = '';
  app.innerHTML = `
    ${banner()}
    <header class="hero">
      <div class="hero-mark">☢</div>
      <h1>Терминалы ЧАЗ</h1>
      <p>Архивы группировок Чернобыльской аномальной зоны. Выберите группировку, затем устройство: монитор «Агат 5189», полевой ноутбук или КПК.</p>
    </header>
    <main class="factions">
      ${data.factions.factions.map((f) => `
        <a class="fcard" href="#/${f.id}" style="${factionVars(f)}">
          <img src="${f.emblem}" alt="">
          <div><h2>${esc(f.name)}</h2><p>${esc(f.fullName || '')}</p><small>${esc(f.motto || '')}</small></div>
          <div class="fcard-devs">${Object.keys(DEVICES).map((d) => statusBadge(f, d)).join('')}</div>
        </a>`).join('')}
    </main>
    <footer class="site-foot"><a href="admin.html">Админка</a><span>Фанатский некоммерческий проект по мотивам S.T.A.L.K.E.R.</span></footer>`;
}

function factionPage(f) {
  document.title = `${f.name} — Терминалы ЧАЗ`;
  document.body.style.cssText = factionVars(f);
  app.innerHTML = `
    ${banner()}
    <nav class="topnav"><a href="#/">← Все группировки</a></nav>
    <header class="fhead">
      <img src="${f.emblem}" alt="">
      <div><h1>${esc(f.name)}</h1><p>${esc(f.fullName || '')}</p><small>${esc(f.motto || '')}</small></div>
    </header>
    <main class="devices">
      ${Object.values(DEVICES).map((d) => `
        <a class="dcard dcard-${d.id}" href="#/${f.id}/${d.id}">
          <div class="dthumb dthumb-${d.id}"><img src="${f.emblem}" alt=""></div>
          <h2>${d.name}</h2><p>${d.desc}</p>
          ${statusBadge(f, d.id)}
        </a>`).join('')}
    </main>
    <section class="doclist">
      <h2>Документы группировки (${(f.docs || []).length})</h2>
      <ul>${(f.docs || []).map((d) => `<li><b>${esc(d.title)}</b><span>${esc(data.factions.categories?.[d.category] || d.category || '')}</span></li>`).join('')}</ul>
    </section>`;
}

function devicePage(f, devId) {
  document.title = `${f.name} · ${DEVICES[devId].name}`;
  document.body.style.cssText = factionVars(f);
  document.body.classList.add('on-device');
  app.innerHTML = `
    ${banner()}
    <nav class="devnav">
      <a href="#/${f.id}" class="devnav-back">← ${esc(f.name)}</a>
      <div class="devnav-tabs">${Object.values(DEVICES).map((d) => `<a href="#/${f.id}/${d.id}" class="${d.id === devId ? 'is-cur' : ''}">${d.name}</a>`).join('')}</div>
      <select class="devnav-f" aria-label="Группировка">${data.factions.factions.map((x) => `<option value="${x.id}" ${x.id === f.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select>
    </nav>
    <div class="stage"><div class="device-root device-${devId}"></div></div>`;
  app.querySelector('.devnav-f').addEventListener('change', (e) => { location.hash = `#/${e.target.value}/${devId}`; });
  const root = app.querySelector('.device-root');
  const inst = RENDER[devId](root, { faction: f, data });
  current = { faction: f, device: devId, root };
  root.addEventListener('redraw', () => { fit(); overlay(); });
  root.addEventListener('exit', () => { location.hash = `#/${f.id}`; });
  fit();
  overlay();
  return inst;
}

function overlay() {
  if (!current) return;
  const screen = current.root.querySelector('[data-screen]')?.parentElement;
  if (!screen) return;
  applyOverlay(screen, screenState(data.state, current.faction.id, current.device), { device: current.device, faction: current.faction });
}

function fit() {
  if (!current) return;
  const stage = app.querySelector('.stage');
  const root = current.root;
  const [w, h] = SIZE[current.device];
  const aw = stage.clientWidth - 16;
  const ah = stage.clientHeight - 16;
  const s = Math.min(aw / w, ah / h, 1.25);
  const bare = s < 0.62;
  stage.classList.toggle('is-bare', bare);
  if (bare) {
    root.style.transform = '';
    root.style.width = '';
    root.style.height = '';
  } else {
    root.style.width = `${w}px`;
    root.style.height = `${h}px`;
    root.style.transform = `translate(-50%, -50%) scale(${s})`;
  }
}

window.addEventListener('resize', () => fit());
window.addEventListener('hashchange', route);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && current && !document.querySelector('.ov input:focus')) {
    const open = current.root.querySelector('.has-detail');
    if (open) open.classList.remove('has-detail');
  }
});

(async function init() {
  try {
    data = await loadAll();
  } catch (e) {
    app.innerHTML = `<div class="fatal"><h1>Нет связи с архивом</h1><p>Не удалось загрузить данные: ${esc(e.message)}</p><p>Откройте сайт через веб-сервер (например, GitHub Pages), а не как файл.</p></div>`;
    return;
  }
  route();
  watchState(async (state) => {
    data.state = state;
    if (current) overlay();
    else route();
  });
})();
