// Загрузка данных фракций и состояния экранов.
// Источник правды: data/factions.json и data/state.json в репозитории.
// Админка может держать черновик в localStorage этого браузера.

export const DEVICES = {
  agat: { id: 'agat', name: 'Агат 5189', desc: 'ЭЛТ-монитор с системой в стиле XP' },
  laptop: { id: 'laptop', name: 'Ноутбук', desc: 'Полевой ноутбук с системой в стиле Vista' },
  'pda-s2': { id: 'pda-s2', name: 'КПК S2', skin: 's2', desc: 'КПК в стиле STALKER 2' },
  'pda-shoc': { id: 'pda-shoc', name: 'КПК ТЧ', skin: 'shoc', desc: 'КПК в стиле «Тени Чернобыля»' },
  'pda-cs': { id: 'pda-cs', name: 'КПК ЧН', skin: 'cs', desc: 'КПК в стиле «Чистого Неба»' },
  'pda-cop': { id: 'pda-cop', name: 'КПК ЗП', skin: 'cop', desc: 'КПК в стиле «Зова Припяти»' },
};
// старые ссылки
export const DEVICE_ALIASES = { pda: 'pda-s2' };

export const STATUSES = {
  normal: { label: 'Норма', hint: 'Экран работает как обычно' },
  locked: { label: 'Заблокировано', hint: 'Доступ закрыт. Можно задать код разблокировки' },
  wiped: { label: 'Данные стёрты', hint: 'Показывает стирание и пустой диск' },
  corrupted: { label: 'Сбой / повреждение', hint: 'Помехи, битые данные' },
  offline: { label: 'Нет сигнала', hint: 'Экран выключен или нет питания' },
  custom: { label: 'Своё сообщение', hint: 'Окно с вашим текстом поверх экрана' },
};

const LS_DRAFT = 'artz.draft';
const LS_USE = 'artz.useDraft';

const safe = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* приватный режим */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* */ } },
};
export { safe };

async function getJSON(url) {
  const r = await fetch(`${url}?t=${Date.now()}`, { cache: 'no-store' });
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return r.json();
}

export function readDraft() {
  const raw = safe.get(LS_DRAFT);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}
export function writeDraft(d) {
  try { localStorage.setItem(LS_DRAFT, JSON.stringify(d)); return true; } catch { return false; }
}
export function clearDraft() { safe.del(LS_DRAFT); }
export function useDraft() { return safe.get(LS_USE) === '1'; }
export function setUseDraft(v) { v ? safe.set(LS_USE, '1') : safe.del(LS_USE); }

export async function loadPublished() {
  const [factions, state] = await Promise.all([getJSON('data/factions.json'), getJSON('data/state.json')]);
  return { factions, state };
}

export async function loadAll() {
  const pub = await loadPublished();
  if (useDraft()) {
    const d = readDraft();
    // черновик, сделанный от старой опубликованной версии, не показываем
    if (d && d.factions && d.state && d.baseRev === (pub.factions.rev || 0)) return { ...d, draft: true };
  }
  return { ...pub, draft: false };
}

export function screenState(state, factionId, deviceId) {
  const s = state?.screens?.[factionId]?.[deviceId];
  return { status: 'normal', message: '', code: '', title: '', ...(s || {}) };
}

const cache = new Map();
export async function loadDoc(doc) {
  if (doc.body != null) return doc.body;
  if (!doc.file) return '';
  if (cache.has(doc.file)) return cache.get(doc.file);
  let r = await fetch(doc.file);
  // перевода нет — показываем русский оригинал
  if (!r.ok && doc.fileOrig) r = await fetch(doc.fileOrig);
  const t = r.ok ? await r.text() : `> Документ не найден: ${doc.file}`;
  cache.set(doc.file, t);
  return t;
}

// Периодическая проверка состояния экранов, чтобы блокировка
// появлялась у зрителей без перезагрузки страницы.
export function watchState(onChange, ms = 15000) {
  let last = '';
  const tick = async () => {
    try {
      const { state } = await loadAll();
      const sig = JSON.stringify(state.screens) + (state.broadcast || '');
      if (last && sig !== last) onChange(state);
      last = sig;
    } catch { /* офлайн */ }
  };
  tick();
  const id = setInterval(tick, ms);
  window.addEventListener('storage', tick);
  return () => clearInterval(id);
}

export function factionVars(f) {
  const c = f.colors || {};
  return `--f-primary:${c.primary || '#888'};--f-secondary:${c.secondary || '#ccc'};--f-accent:${c.accent || c.primary || '#aaa'};--f-dark:${c.dark || '#111'};`;
}

export function groupDocs(faction, categories) {
  const groups = [];
  const map = new Map();
  (faction.docs || []).forEach((d) => {
    const key = d.category || 'research';
    if (!map.has(key)) {
      const g = { id: key, name: categories?.[key] || key, docs: [] };
      map.set(key, g);
      groups.push(g);
    }
    map.get(key).docs.push(d);
  });
  return groups;
}
