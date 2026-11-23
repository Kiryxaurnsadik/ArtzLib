// Админка: управление состоянием экранов и фракциями.
import { loadPublished, readDraft, writeDraft, clearDraft, useDraft, setUseDraft, DEVICES, STATUSES, safe, loadDoc } from './store.js';
import { esc } from './md.js';

const root = document.getElementById('admin');
let pub = null;     // опубликованная версия
let model = null;   // { factions, state } — рабочая копия
let tab = 'screens';
let editId = null;  // редактируемая фракция

const LS_GH = 'artz.github';
const SS_AUTH = 'artz.admin';

async function sha256(text) {
  if (crypto?.subtle) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  return text; // без HTTPS хэш недоступен
}

const clone = (o) => JSON.parse(JSON.stringify(o));
function save() {
  model.state.updatedAt = new Date().toISOString();
  writeDraft(model);
  markDirty();
}
function isDirty() { return JSON.stringify(model) !== JSON.stringify(pub); }
function markDirty() {
  const el = root.querySelector('.dirty');
  if (el) el.hidden = !isDirty();
}
function toast(msg, kind = 'ok') {
  const t = document.createElement('div');
  t.className = `toast toast-${kind}`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 4200);
}
function ensureScreens(f) {
  model.state.screens ||= {};
  model.state.screens[f.id] ||= {};
  Object.keys(DEVICES).forEach((d) => {
    model.state.screens[f.id][d] = { status: 'normal', message: '', code: '', title: '', ...(model.state.screens[f.id][d] || {}) };
  });
}

// ---------- вход ----------
async function login() {
  let ok = false;
  try { ok = sessionStorage.getItem(SS_AUTH) === pub.state.adminHash; } catch { /* */ }
  if (ok) return start();
  root.innerHTML = `
    <form class="login">
      <div class="login-mark">☢</div>
      <h1>Админка терминалов</h1>
      <label>Пароль<input type="password" autocomplete="current-password" required></label>
      <button type="submit">Войти</button>
      <p class="login-err" aria-live="polite"></p>
      <p class="login-note">Пароль по умолчанию: <code>artz</code>. Смените его во вкладке «Публикация».</p>
      <a href="./">← На сайт</a>
    </form>`;
  const form = root.querySelector('form');
  form.querySelector('input').focus();
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const h = await sha256(form.querySelector('input').value);
    const draftHash = readDraft()?.state?.adminHash;
    if (h === pub.state.adminHash || (draftHash && h === draftHash)) {
      try { sessionStorage.setItem(SS_AUTH, pub.state.adminHash); } catch { /* */ }
      start();
    } else {
      form.querySelector('.login-err').textContent = 'Неверный пароль';
    }
  });
}

function start() {
  const d = readDraft();
  model = d && d.factions && d.state ? d : clone(pub);
  model.factions.factions.forEach(ensureScreens);
  if (safe.get('artz.useDraft') === null) setUseDraft(true);
  render();
}

// ---------- каркас ----------
function render() {
  root.innerHTML = `
    <header class="a-head">
      <div class="a-title"><span>☢</span> Админка терминалов</div>
      <nav class="a-tabs">
        ${[['screens', 'Экраны'], ['factions', 'Фракции'], ['publish', 'Публикация']].map(([id, n]) => `<button type="button" data-tab="${id}" class="${tab === id ? 'is-cur' : ''}">${n}</button>`).join('')}
      </nav>
      <div class="a-right">
        <span class="dirty" hidden>Есть неопубликованные изменения</span>
        <label class="a-preview"><input type="checkbox" ${useDraft() ? 'checked' : ''}> Черновик на сайте (в этом браузере)</label>
        <a href="./" target="_blank" rel="noopener">Открыть сайт ↗</a>
      </div>
    </header>
    <main class="a-main"></main>`;
  root.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { tab = b.dataset.tab; render(); }));
  root.querySelector('.a-preview input').addEventListener('change', (e) => { setUseDraft(e.target.checked); toast(e.target.checked ? 'Сайт в этом браузере показывает черновик' : 'Сайт в этом браузере показывает опубликованную версию'); });
  const main = root.querySelector('.a-main');
  if (tab === 'screens') screens(main);
  else if (tab === 'factions') factions(main);
  else publish(main);
  markDirty();
}

// ---------- экраны ----------
function screens(main) {
  const fs = model.factions.factions;
  main.innerHTML = `
    <section class="card">
      <h2>Общее объявление</h2>
      <p class="hint">Бегущая строка над всеми страницами сайта. Оставьте пустым, чтобы скрыть.</p>
      <input class="wide" data-broadcast value="${esc(model.state.broadcast || '')}" placeholder="Например: ВНИМАНИЕ! Ожидается выброс.">
      <div class="row">
        <button type="button" data-all="locked">Заблокировать всё</button>
        <button type="button" data-all="wiped" class="danger">Стереть всё</button>
        <button type="button" data-all="normal" class="ok">Вернуть всё в норму</button>
      </div>
    </section>
    <div class="grid-screens">
      ${fs.map((f) => `
        <section class="card fcard-a" style="--c:${f.colors?.primary || '#888'}">
          <header class="fa-head"><img src="${f.emblem}" alt=""><h2>${esc(f.name)}</h2>
            <div class="row small">
              <button type="button" data-fall="${f.id}" data-st="locked">Блок</button>
              <button type="button" data-fall="${f.id}" data-st="wiped" class="danger">Стереть</button>
              <button type="button" data-fall="${f.id}" data-st="normal" class="ok">Норма</button>
            </div>
          </header>
          ${Object.values(DEVICES).map((d) => screenCell(f, d)).join('')}
        </section>`).join('')}
    </div>`;
  main.querySelector('[data-broadcast]').addEventListener('input', (e) => { model.state.broadcast = e.target.value; save(); });
  main.querySelectorAll('[data-all]').forEach((b) => b.addEventListener('click', () => {
    const st = b.dataset.all;
    if (st === 'wiped' && !confirmInline(b, 'Точно стереть все экраны?')) return;
    fs.forEach((f) => Object.keys(DEVICES).forEach((d) => { model.state.screens[f.id][d].status = st; }));
    save(); render();
  }));
  main.querySelectorAll('[data-fall]').forEach((b) => b.addEventListener('click', () => {
    Object.keys(DEVICES).forEach((d) => { model.state.screens[b.dataset.fall][d].status = b.dataset.st; });
    save(); render();
  }));
  main.querySelectorAll('[data-cell]').forEach((cell) => {
    const [fid, did] = cell.dataset.cell.split(':');
    const s = model.state.screens[fid][did];
    cell.querySelectorAll('[data-k]').forEach((inp) => {
      inp.addEventListener(inp.tagName === 'SELECT' ? 'change' : 'input', () => {
        s[inp.dataset.k] = inp.value;
        save();
        if (inp.dataset.k === 'status') { cell.dataset.status = inp.value; cell.querySelector('.code-row').hidden = inp.value !== 'locked'; }
      });
    });
  });
}

function confirmInline(btn, q) {
  if (btn.dataset.sure === '1') { btn.dataset.sure = ''; return true; }
  btn.dataset.sure = '1';
  const old = btn.textContent;
  btn.textContent = `${q} Нажмите ещё раз`;
  setTimeout(() => { btn.dataset.sure = ''; btn.textContent = old; }, 3000);
  return false;
}

function screenCell(f, d) {
  const s = model.state.screens[f.id][d.id];
  return `
    <div class="cell" data-cell="${f.id}:${d.id}" data-status="${s.status}">
      <div class="cell-head"><b>${d.name}</b><a href="./#/${f.id}/${d.id}" target="_blank" rel="noopener">смотреть ↗</a></div>
      <label>Состояние
        <select data-k="status">${Object.entries(STATUSES).map(([k, v]) => `<option value="${k}" ${s.status === k ? 'selected' : ''}>${v.label}</option>`).join('')}</select>
      </label>
      <label>Заголовок <input data-k="title" value="${esc(s.title || '')}" placeholder="по умолчанию"></label>
      <label>Сообщение <textarea data-k="message" rows="2" placeholder="Текст на экране">${esc(s.message || '')}</textarea></label>
      <label class="code-row" ${s.status === 'locked' ? '' : 'hidden'}>Код разблокировки <input data-k="code" value="${esc(s.code || '')}" placeholder="пусто: без кода"></label>
    </div>`;
}

// ---------- фракции ----------
const TEMPLATE = () => ({
  id: '', name: 'Новая группировка', fullName: 'Полное название', motto: '', emblem: 'assets/img/emblems/iig.svg',
  colors: { primary: '#5a7a3a', secondary: '#e8d27a', accent: '#9fc36a', dark: '#1a2410' },
  location: 'Зона', pdaSkin: 's2',
  user: { name: 'Оператор', login: 'operator', role: 'Сотрудник' },
  docs: [{ id: 'about', title: 'О группировке', category: 'about', org: '', author: '', meta: {}, body: '### О группировке\n\nОпишите группировку здесь.\n' }],
  map: [{ name: 'База', x: 50, y: 50, type: 'base' }],
  journal: [{ title: 'Первое задание', status: 'active', text: '' }],
});

function slug(s) {
  const tr = { а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch', ы: 'y', э: 'e', ю: 'yu', я: 'ya' };
  return (s || '').toLowerCase().split('').map((c) => tr[c] ?? c).join('').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `f${Date.now().toString(36)}`;
}
function uniqueId(base, list) {
  let id = base, i = 2;
  while (list.some((x) => x.id === id)) id = `${base}-${i++}`;
  return id;
}

function factions(main) {
  const fs = model.factions.factions;
  if (editId && !fs.find((f) => f.id === editId)) editId = null;
  main.innerHTML = `
    <div class="f-layout">
      <aside class="card f-list">
        <h2>Группировки</h2>
        <ul>${fs.map((f, i) => `<li><button type="button" data-edit="${f.id}" class="${f.id === editId ? 'is-cur' : ''}"><img src="${f.emblem}" alt="">${esc(f.name)}</button>
          <span class="mv"><button type="button" data-up="${i}" aria-label="Выше">▲</button><button type="button" data-down="${i}" aria-label="Ниже">▼</button></span></li>`).join('')}</ul>
        <div class="col">
          <button type="button" data-new class="ok">+ Новая группировка</button>
          ${editId ? '<button type="button" data-dup>Создать вариацию этой</button>' : ''}
        </div>
      </aside>
      <section class="f-edit"></section>
    </div>`;
  main.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => { editId = b.dataset.edit; render(); }));
  main.querySelectorAll('[data-up],[data-down]').forEach((b) => b.addEventListener('click', () => {
    const i = +(b.dataset.up ?? b.dataset.down);
    const j = b.dataset.up != null ? i - 1 : i + 1;
    if (j < 0 || j >= fs.length) return;
    [fs[i], fs[j]] = [fs[j], fs[i]];
    save(); render();
  }));
  main.querySelector('[data-new]').addEventListener('click', () => {
    const f = TEMPLATE();
    f.id = uniqueId('new', fs);
    fs.push(f); ensureScreens(f); editId = f.id; save(); render();
  });
  main.querySelector('[data-dup]')?.addEventListener('click', () => {
    const src = fs.find((x) => x.id === editId);
    const f = clone(src);
    f.id = uniqueId(`${src.id}-v`, fs);
    f.name = `${src.name} (вариация)`;
    fs.push(f); ensureScreens(f); editId = f.id; save(); render();
    toast('Создана копия группировки: меняйте цвета, эмблему и документы');
  });
  const ed = main.querySelector('.f-edit');
  if (!editId) { ed.innerHTML = '<div class="card empty">Выберите группировку слева или создайте новую.</div>'; return; }
  editFaction(ed, fs.find((f) => f.id === editId));
}

function editFaction(ed, f) {
  const cats = model.factions.categories;
  const isNew = !pub.factions.factions.some((x) => x.id === f.id);
  ed.innerHTML = `
    <div class="card">
      <div class="fe-top">
        <div class="fe-emblem"><img src="${f.emblem}" alt=""><label class="file">Загрузить эмблему<input type="file" accept="image/*" data-emblem hidden></label></div>
        <div class="fe-fields">
          <label>ID (латиница, в адресе страницы) <input data-f="id" value="${esc(f.id)}" ${isNew ? '' : 'readonly'}></label>
          <label>Короткое название <input data-f="name" value="${esc(f.name)}"></label>
          <label>Полное название <input data-f="fullName" value="${esc(f.fullName || '')}"></label>
          <label>Девиз <input data-f="motto" value="${esc(f.motto || '')}"></label>
          <label>Местоположение <input data-f="location" value="${esc(f.location || '')}"></label>
          <label>Эмблема (путь или ссылка) <input data-f="emblem" value="${esc(f.emblem && f.emblem.startsWith('data:') ? '(загруженное изображение)' : f.emblem || '')}"></label>
        </div>
      </div>
      <div class="fe-row">
        ${['primary', 'secondary', 'accent', 'dark'].map((k) => `<label class="color">${({ primary: 'Основной', secondary: 'Второй', accent: 'Акцент', dark: 'Тёмный' })[k]}<input type="color" data-c="${k}" value="${f.colors?.[k] || '#888888'}"></label>`).join('')}
        <label>Оболочка КПК <select data-f="pdaSkin"><option value="s2" ${f.pdaSkin !== 'shoc' ? 'selected' : ''}>S2</option><option value="shoc" ${f.pdaSkin === 'shoc' ? 'selected' : ''}>ТЧ</option></select></label>
      </div>
      <div class="fe-row">
        <label>Пользователь <input data-u="name" value="${esc(f.user?.name || '')}"></label>
        <label>Должность <input data-u="role" value="${esc(f.user?.role || '')}"></label>
      </div>
      <div class="row"><a href="./#/${f.id}" target="_blank" rel="noopener">Открыть страницу ↗</a><button type="button" class="danger" data-del>Удалить группировку</button></div>
    </div>

    <div class="card">
      <h2>Документы (${f.docs.length})</h2>
      <p class="hint">Текст в формате Markdown: <code>### Заголовок</code>, <code>**жирный**</code>, <code>* список</code>, таблицы через <code>|</code>, картинки <code>![](ссылка)</code>. Для «Дискеты» тип «Диалог ИИ» и строки <code>@q вопрос</code> / <code>@a ответ</code>.</p>
      <div class="docs"></div>
      <button type="button" class="ok" data-adddoc>+ Добавить документ</button>
    </div>

    <div class="card two">
      <div>
        <h2>Журнал (задания)</h2>
        <div class="rows" data-journal></div>
        <button type="button" data-addj>+ Задание</button>
      </div>
      <div>
        <h2>Точки на карте КПК</h2>
        <p class="hint">X и Y в процентах от 0 до 100.</p>
        <div class="rows" data-map></div>
        <button type="button" data-addm>+ Точка</button>
      </div>
    </div>`;

  ed.querySelectorAll('[data-f]').forEach((inp) => inp.addEventListener(inp.tagName === 'SELECT' ? 'change' : 'input', () => {
    const k = inp.dataset.f;
    if (k === 'emblem' && inp.value.startsWith('(')) return;
    if (k === 'id') {
      const old = f.id;
      const v = slug(inp.value);
      if (!v || model.factions.factions.some((x) => x !== f && x.id === v)) return;
      f.id = v; editId = v;
      model.state.screens[v] = model.state.screens[old] || {};
      if (old !== v) delete model.state.screens[old];
    } else f[k] = inp.value;
    save();
  }));
  ed.querySelectorAll('[data-c]').forEach((inp) => inp.addEventListener('input', () => { f.colors ||= {}; f.colors[inp.dataset.c] = inp.value; save(); }));
  ed.querySelectorAll('[data-u]').forEach((inp) => inp.addEventListener('input', () => { f.user ||= {}; f.user[inp.dataset.u] = inp.value; save(); }));
  ed.querySelector('[data-emblem]').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    f.emblem = await shrinkImage(file, 320);
    save(); render();
  });
  ed.querySelector('[data-del]').addEventListener('click', (e) => {
    if (!confirmInline(e.currentTarget, 'Удалить?')) return;
    model.factions.factions = model.factions.factions.filter((x) => x !== f);
    delete model.state.screens[f.id];
    editId = null; save(); render();
  });

  // документы
  const docsEl = ed.querySelector('.docs');
  f.docs.forEach((d, i) => {
    const det = document.createElement('details');
    det.className = 'doc-ed';
    det.innerHTML = `
      <summary><span class="dt">${esc(d.title)}</span><span class="dc">${esc(cats[d.category] || d.category)}</span>
        <span class="mv"><button type="button" data-dup aria-label="Выше">▲</button><button type="button" data-ddn aria-label="Ниже">▼</button></span></summary>
      <div class="doc-grid">
        <label>Название <input data-d="title" value="${esc(d.title)}"></label>
        <label>Раздел <select data-d="category">${Object.entries(cats).map(([k, v]) => `<option value="${k}" ${d.category === k ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select></label>
        <label>Автор <input data-d="author" value="${esc(d.author || '')}"></label>
        <label>Учреждение / где найдено <input data-d="org" value="${esc(d.org || '')}"></label>
        <label>Тип <select data-d="kind"><option value="">Документ</option><option value="chat" ${d.kind === 'chat' ? 'selected' : ''}>Диалог ИИ («Дискета»)</option></select></label>
        <label>Источник <input value="${d.body != null ? 'встроенный текст' : esc(d.file || '')}" readonly></label>
      </div>
      <textarea class="md" rows="12" placeholder="Нажмите «Загрузить текст», чтобы редактировать документ из файла"></textarea>
      <div class="row">
        ${d.body == null ? '<button type="button" data-load>Загрузить текст для правки</button>' : ''}
        <button type="button" class="danger" data-rm>Удалить документ</button>
      </div>`;
    const ta = det.querySelector('textarea');
    if (d.body != null) ta.value = d.body; else ta.disabled = true;
    det.querySelector('[data-load]')?.addEventListener('click', async (e) => {
      ta.value = await loadDoc(d);
      ta.disabled = false;
      e.target.remove();
    });
    ta.addEventListener('input', () => { d.body = ta.value; save(); });
    det.querySelectorAll('[data-d]').forEach((inp) => inp.addEventListener(inp.tagName === 'SELECT' ? 'change' : 'input', () => {
      const k = inp.dataset.d;
      if (k === 'kind') { if (inp.value) d.kind = inp.value; else delete d.kind; }
      else d[k] = inp.value;
      if (k === 'title') det.querySelector('.dt').textContent = inp.value;
      save();
    }));
    det.querySelector('[data-rm]').addEventListener('click', (e) => {
      if (!confirmInline(e.currentTarget, 'Удалить?')) return;
      f.docs.splice(f.docs.indexOf(d), 1); save(); render();
    });
    det.querySelector('[data-dup]').addEventListener('click', (e) => { e.preventDefault(); if (i > 0) { [f.docs[i - 1], f.docs[i]] = [f.docs[i], f.docs[i - 1]]; save(); render(); } });
    det.querySelector('[data-ddn]').addEventListener('click', (e) => { e.preventDefault(); if (i < f.docs.length - 1) { [f.docs[i + 1], f.docs[i]] = [f.docs[i], f.docs[i + 1]]; save(); render(); } });
    docsEl.appendChild(det);
  });
  ed.querySelector('[data-adddoc]').addEventListener('click', () => {
    f.docs.push({ id: uniqueId('doc', f.docs), title: 'Новый документ', category: 'research', org: f.fullName || '', author: f.user?.name || '', meta: {}, body: '### Заголовок\n\nТекст документа.\n' });
    save(); render();
    ed.querySelector('.doc-ed:last-of-type')?.setAttribute('open', '');
  });

  // журнал и карта
  rowsEditor(ed.querySelector('[data-journal]'), f.journal ||= [], [
    ['title', 'Название', 'text'],
    ['status', 'Статус', 'select', { active: 'Активно', done: 'Выполнено', failed: 'Провалено' }],
    ['text', 'Описание', 'text'],
  ]);
  ed.querySelector('[data-addj]').addEventListener('click', () => { f.journal.push({ title: 'Новое задание', status: 'active', text: '' }); save(); render(); });
  rowsEditor(ed.querySelector('[data-map]'), f.map ||= [], [
    ['name', 'Название', 'text'], ['x', 'X', 'number'], ['y', 'Y', 'number'],
    ['type', 'Тип', 'select', { base: 'База', poi: 'Точка', danger: 'Опасность', anomaly: 'Аномалия', lab: 'Лаборатория', done: 'Закрыто' }],
  ]);
  ed.querySelector('[data-addm]').addEventListener('click', () => { f.map.push({ name: 'Точка', x: 50, y: 50, type: 'poi' }); save(); render(); });
}

function rowsEditor(el, arr, cols) {
  arr.forEach((item, i) => {
    const row = document.createElement('div');
    row.className = 'rowed';
    row.innerHTML = cols.map(([k, label, type, opts]) => type === 'select'
      ? `<select aria-label="${label}" data-k="${k}">${Object.entries(opts).map(([v, n]) => `<option value="${v}" ${item[k] === v ? 'selected' : ''}>${n}</option>`).join('')}</select>`
      : `<input aria-label="${label}" placeholder="${label}" data-k="${k}" type="${type}" ${type === 'number' ? 'min="0" max="100"' : ''} value="${esc(String(item[k] ?? ''))}">`).join('') + '<button type="button" aria-label="Удалить" data-x>✕</button>';
    row.querySelectorAll('[data-k]').forEach((inp) => inp.addEventListener('input', () => {
      item[inp.dataset.k] = inp.type === 'number' ? Math.max(0, Math.min(100, +inp.value)) : inp.value; save();
    }));
    row.querySelector('[data-x]').addEventListener('click', () => { arr.splice(i, 1); save(); render(); });
    el.appendChild(row);
  });
}

function shrinkImage(file, max) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => {
      const s = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      res(c.toDataURL('image/png'));
      URL.revokeObjectURL(img.src);
    };
    img.onerror = rej;
    img.src = URL.createObjectURL(file);
  });
}

// ---------- публикация ----------
function ghCfg() {
  let c = {};
  try { c = JSON.parse(safe.get(LS_GH) || '{}'); } catch { /* */ }
  return { owner: 'Kiryxaurnsadik', repo: 'ArtzLib', branch: 'main', token: '', ...c };
}

function publish(main) {
  const c = ghCfg();
  main.innerHTML = `
    <section class="card">
      <h2>Опубликовать на GitHub</h2>
      <p class="hint">Изменения записываются в <code>data/factions.json</code> и <code>data/state.json</code> репозитория. Сайт на GitHub Pages обновится примерно через минуту, а открытые страницы подхватят новое состояние экранов сами (проверка каждые 15 секунд).</p>
      <div class="fe-row">
        <label>Владелец <input data-g="owner" value="${esc(c.owner)}"></label>
        <label>Репозиторий <input data-g="repo" value="${esc(c.repo)}"></label>
        <label>Ветка <input data-g="branch" value="${esc(c.branch)}"></label>
      </div>
      <label>Токен GitHub (fine-grained, права Contents: Read and write только на этот репозиторий)
        <input data-g="token" type="password" value="${esc(c.token)}" autocomplete="off" placeholder="github_pat_...">
      </label>
      <label class="check"><input type="checkbox" data-remember ${c.token ? 'checked' : ''}> Запомнить токен в этом браузере</label>
      <div class="row">
        <button type="button" class="ok big" data-push>Опубликовать</button>
        <span class="push-log" aria-live="polite"></span>
      </div>
    </section>
    <section class="card">
      <h2>Без GitHub</h2>
      <p class="hint">Скачайте файлы и положите их в папку <code>data/</code> вручную, или перенесите черновик на другой компьютер.</p>
      <div class="row">
        <button type="button" data-dl="factions">Скачать factions.json</button>
        <button type="button" data-dl="state">Скачать state.json</button>
        <label class="file">Загрузить JSON<input type="file" accept="application/json,.json" data-import hidden></label>
        <button type="button" class="danger" data-reset>Отменить черновик</button>
      </div>
    </section>
    <section class="card">
      <h2>Пароль админки</h2>
      <p class="hint">Хранится в <code>data/state.json</code> как хэш. Это защита от случайных зрителей, а не от взлома: настоящий доступ к изменениям даёт только токен GitHub.</p>
      <div class="row"><input type="password" data-newpass placeholder="Новый пароль" autocomplete="new-password"><button type="button" data-setpass>Сменить</button></div>
    </section>`;

  const read = () => {
    const v = {};
    main.querySelectorAll('[data-g]').forEach((i) => { v[i.dataset.g] = i.value.trim(); });
    return v;
  };
  const persist = () => {
    const v = read();
    if (!main.querySelector('[data-remember]').checked) v.token = '';
    safe.set(LS_GH, JSON.stringify(v));
  };
  main.querySelectorAll('[data-g], [data-remember]').forEach((i) => i.addEventListener('change', persist));

  main.querySelector('[data-push]').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    const log = main.querySelector('.push-log');
    const v = read();
    if (!v.token) { log.textContent = 'Нужен токен GitHub.'; return; }
    persist();
    btn.disabled = true;
    try {
      log.textContent = 'Публикация factions.json...';
      await putFile(v, 'data/factions.json', JSON.stringify(model.factions, null, 1) + '\n', 'Админка: обновлены группировки');
      log.textContent = 'Публикация state.json...';
      await putFile(v, 'data/state.json', JSON.stringify(model.state, null, 1) + '\n', 'Админка: обновлено состояние экранов');
      pub = clone(model);
      log.textContent = 'Готово. Сайт обновится в течение минуты.';
      toast('Опубликовано');
      markDirty();
    } catch (err) {
      log.textContent = `Ошибка: ${err.message}`;
    } finally {
      btn.disabled = false;
    }
  });
  main.querySelectorAll('[data-dl]').forEach((b) => b.addEventListener('click', () => {
    const k = b.dataset.dl;
    const blob = new Blob([JSON.stringify(model[k], null, 1) + '\n'], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${k}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }));
  main.querySelector('[data-import]').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const j = JSON.parse(await file.text());
      if (j.factions && Array.isArray(j.factions)) model.factions = j;
      else if (j.screens) model.state = j;
      else if (j.factions?.factions && j.state) model = j;
      else throw new Error('неизвестный формат');
      model.factions.factions.forEach(ensureScreens);
      save(); toast('Импортировано'); render();
    } catch (err) { toast(`Не удалось импортировать: ${err.message}`, 'err'); }
  });
  main.querySelector('[data-reset]').addEventListener('click', (e) => {
    if (!confirmInline(e.currentTarget, 'Отменить все изменения?')) return;
    clearDraft();
    model = clone(pub);
    model.factions.factions.forEach(ensureScreens);
    toast('Черновик сброшен'); render();
  });
  main.querySelector('[data-setpass]').addEventListener('click', async () => {
    const p = main.querySelector('[data-newpass]').value;
    if (p.length < 4) { toast('Пароль слишком короткий', 'err'); return; }
    model.state.adminHash = await sha256(p);
    save();
    toast('Пароль изменён в черновике. Опубликуйте, чтобы он заработал на сайте.');
  });
}

async function putFile({ owner, repo, branch, token }, path, content, message) {
  const api = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${path}`;
  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' };
  let sha;
  const r = await fetch(`${api}?ref=${encodeURIComponent(branch)}`, { headers });
  if (r.ok) sha = (await r.json()).sha;
  else if (r.status !== 404) throw new Error(`GitHub ${r.status}: ${(await r.json().catch(() => ({}))).message || 'нет доступа'}`);
  let bin = '';
  new TextEncoder().encode(content).forEach((b) => { bin += String.fromCharCode(b); });
  const b64 = btoa(bin);
  const w = await fetch(api, { method: 'PUT', headers, body: JSON.stringify({ message, content: b64, branch, sha }) });
  if (!w.ok) throw new Error(`GitHub ${w.status}: ${(await w.json().catch(() => ({}))).message || 'ошибка записи'}`);
}

(async function init() {
  try {
    pub = await loadPublished();
  } catch (e) {
    root.innerHTML = `<div class="fatal"><h1>Нет данных</h1><p>${esc(e.message)}</p></div>`;
    return;
  }
  login();
})();
