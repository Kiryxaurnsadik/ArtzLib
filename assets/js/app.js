import { loadAll, watchState, screenState, factionVars, DEVICES, DEVICE_ALIASES, STATUSES } from './store.js';
import { applyOverlay } from './overlays.js';
import { renderAgat } from './agat.js';
import { renderLaptop } from './laptop.js';
import { renderPDA } from './pda.js';
import { esc } from './md.js';

// Адреса:
//   #/<группировка>/<устройство>   — только это устройство, без переходов
//   #/<группировка>                — выбор устройств одной группировки
//   #/                             — заглушка (или каталог, если включён в админке)
// Если у группировки задан ключ доступа, к адресу добавляется ?k=<ключ>.

const app = document.getElementById('app');
let data = null;
let current = null;

const SIZE = { agat: [1040, 900], laptop: [1180, 800], pda: [1120, 700] };

function findFaction(id) { return data.factions.factions.find((f) => f.id === id); }
export function enabledDevices(f) {
  const list = Array.isArray(f.devices) && f.devices.length ? f.devices : Object.keys(DEVICES);
  return list.filter((d) => DEVICES[d]);
}

function parseHash() {
  const raw = location.hash.replace(/^#\/?/, '');
  const [path, query = ''] = raw.split('?');
  const parts = path.split('/').filter(Boolean).map(decodeURIComponent);
  const key = new URLSearchParams(query).get('k') || '';
  return { parts, key };
}

function route() {
  const { parts, key } = parseHash();
  document.body.classList.remove('on-device');
  document.body.style.cssText = '';
  current = null;
  if (!parts.length) return data.state.catalog || window.ARTZ_PREVIEW ? catalog() : idle();
  const f = findFaction(parts[0]);
  if (!f) return idle('Терминал не найден');
  if (f.key && f.key !== key) return idle('Нет доступа к терминалу');
  if (!parts[1]) return factionPage(f, key);
  const dev = DEVICE_ALIASES[parts[1]] || parts[1];
  if (!DEVICES[dev] || !enabledDevices(f).includes(dev)) return idle('Терминал не найден');
  return devicePage(f, dev);
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

const link = (f, dev, key) => `#/${f.id}${dev ? `/${dev}` : ''}${key ? `?k=${encodeURIComponent(key)}` : ''}`;

function idle(msg = 'Терминал не выбран') {
  document.title = 'Терминал ЧАЗ';
  app.innerHTML = `
    ${banner()}
    <div class="idle">
      <div class="idle-mark">☢</div>
      <h1>${esc(msg)}</h1>
      <p>Откройте ссылку на терминал, которую выдал ведущий игры.</p>
    </div>`;
}

function catalog() {
  document.title = 'Терминалы ЧАЗ';
  app.innerHTML = `
    ${banner()}
    <header class="hero">
      <div class="hero-mark">☢</div>
      <h1>Терминалы ЧАЗ</h1>
      <p>Архивы группировок Чернобыльской аномальной зоны.</p>
    </header>
    <main class="factions">
      ${data.factions.factions.filter((f) => !f.key || window.ARTZ_PREVIEW).map((f) => `
        <a class="fcard" href="${link(f)}" style="${factionVars(f)}">
          <img src="${f.emblem}" alt="">
          <div><h2>${esc(f.name)}</h2><p>${esc(f.fullName || '')}</p><small>${esc(f.motto || '')}</small></div>
        </a>`).join('')}
    </main>`;
}

function factionPage(f, key) {
  document.title = `${f.name} · Терминалы`;
  document.body.style.cssText = factionVars(f);
  app.innerHTML = `
    ${banner()}
    ${window.ARTZ_PREVIEW ? '<a class="preview-back" href="#/">← Превью: все группировки</a>' : ''}
    <header class="fhead">
      <img src="${f.emblem}" alt="">
      <div><h1>${esc(f.name)}</h1><p>${esc(f.fullName || '')}</p><small>${esc(f.motto || '')}</small></div>
    </header>
    <main class="devices">
      ${enabledDevices(f).map((id) => DEVICES[id]).map((d) => `
        <a class="dcard dcard-${d.id.startsWith('pda') ? 'pda' : d.id}" href="${link(f, d.id, key)}">
          <div class="dthumb dthumb-${d.id.startsWith('pda') ? `pda dthumb-${d.id}` : d.id}"><img src="${f.emblem}" alt=""></div>
          <h2>${d.name}</h2><p>${d.desc}</p>
          ${statusBadge(f, d.id)}
        </a>`).join('')}
    </main>`;
}

function devicePage(f, devId) {
  const dev = DEVICES[devId];
  document.title = `${f.name} · ${dev.name}`;
  document.body.style.cssText = factionVars(f);
  document.body.classList.add('on-device');
  const back = window.ARTZ_PREVIEW ? `<a class="preview-back" href="#/${f.id}">← Превью: к устройствам группировки</a>` : '';
  app.innerHTML = `${banner()}${back}<div class="stage"><div class="device-root device-${dev.skin ? 'pda' : devId}"></div><button type="button" class="fs-btn" title="Только экран, во весь экран" aria-label="Полноэкранный режим"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" fill="none" stroke="currentColor" stroke-width="2"/></svg></button></div>`;
  const stage = app.querySelector('.stage');
  app.querySelector('.fs-btn').addEventListener('click', () => {
    const on = !stage.classList.contains('is-full');
    stage.classList.toggle('is-full', on);
    try {
      if (on && !document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {});
      if (!on && document.fullscreenElement) document.exitFullscreen?.();
    } catch { /* не поддерживается */ }
    fit();
  });
  const root = app.querySelector('.device-root');
  const opts = { faction: f, data };
  if (dev.skin) renderPDA(root, { ...opts, skin: dev.skin });
  else if (devId === 'agat') renderAgat(root, opts);
  else renderLaptop(root, opts);
  current = { faction: f, device: devId, root, size: SIZE[dev.skin ? 'pda' : devId] };
  root.addEventListener('redraw', () => { fit(); overlay(); });
  fit();
  overlay();
}

function overlay() {
  if (!current) return;
  const screen = current.root.querySelector('[data-screen]')?.parentElement;
  if (!screen) return;
  applyOverlay(screen, screenState(data.state, current.faction.id, current.device), { device: current.device.startsWith('pda') ? 'pda' : current.device, faction: current.faction });
}

function fit() {
  if (!current) return;
  const stage = app.querySelector('.stage');
  const root = current.root;
  const [w, h] = current.size;
  const s = Math.min((stage.clientWidth - 16) / w, (stage.clientHeight - 16) / h, 1.25);
  const bare = s < 0.62 || stage.classList.contains('is-full');
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
document.addEventListener('fullscreenchange', () => {
  if (!document.fullscreenElement) document.querySelector('.stage.is-full')?.classList.remove('is-full');
  fit();
});
window.addEventListener('hashchange', route);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && current && !document.querySelector('.ov input:focus')) {
    current.root.querySelector('.has-detail')?.classList.remove('has-detail');
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
