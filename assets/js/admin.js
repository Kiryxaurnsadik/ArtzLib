// Админка: состояния экранов, ссылки, редактирование группировок и публикация.
import { loadPublished, readDraft, writeDraft, clearDraft, useDraft, setUseDraft, DEVICES, STATUSES, safe, loadDoc } from './store.js';
import { esc, renderMarkdown } from './md.js';
import { importFile, imageFromFile, ACCEPT } from './importer.js';
import { S2_THEMES } from './pda.js';
import { docToDocx, factionZip, download, safeName } from './exporter.js';

const root = document.getElementById('admin');
let pub = null;     // опубликованная версия
let model = null;   // { factions, state } — рабочая копия
let tab = 'screens';
let editId = null;  // редактируемая группировка
let openDocs = new Set(); // раскрытые документы в редакторе

const LS_GH = 'artz.github';
const SS_AUTH = 'artz.admin';
const ALL_DEVICES = Object.keys(DEVICES);

async function sha256(text) {
  if (crypto?.subtle) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  return text; // без HTTPS хэш недоступен
}

const clone = (o) => JSON.parse(JSON.stringify(o));
let warnedSize = false;
function save() {
  model.state.updatedAt = new Date().toISOString();
  if (!writeDraft(model) && !warnedSize) {
    warnedSize = true;
    toast('Черновик не помещается в память браузера (слишком много картинок). Опубликуйте изменения, чтобы не потерять их.', 'err');
  }
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
  setTimeout(() => t.remove(), 5200);
}
const devicesOf = (f) => (Array.isArray(f.devices) && f.devices.length ? f.devices : ALL_DEVICES).filter((d) => DEVICES[d]);
function ensureScreens(f) {
  model.state.screens ||= {};
  model.state.screens[f.id] ||= {};
  ALL_DEVICES.forEach((d) => {
    model.state.screens[f.id][d] = { status: 'normal', message: '', code: '', title: '', ...(model.state.screens[f.id][d] || {}) };
  });
}
function ensureFaction(f) {
  f.look = { avatar: '', wallpaperAgat: '', wallpaperLaptop: '', emblemOnDesktop: true, note: '', ...(f.look || {}) };
  f.os = { agatName: 'Окна XP', laptopName: 'Окна Vista', computer: `${(f.id || 'PC').toUpperCase()}-PC`, bios: [], laptopPassword: '', laptopHint: '', ...(f.os || {}) };
  f.pda = { theme: 'standard', rank: '', reputation: '', ...(f.pda || {}) };
  f.devices = devicesOf(f);
  f.key ||= '';
  f.docs ||= [];
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
  pub.factions.factions.forEach(ensureFaction);
  const d = readDraft();
  model = d && d.factions && d.state ? d : clone(pub);
  model.factions.factions.forEach((f) => { ensureFaction(f); ensureScreens(f); });
  if (safe.get('artz.useDraft') === null) setUseDraft(true);
  render();
}

// ---------- каркас ----------
function render() {
  const keepScroll = window.scrollY;
  root.innerHTML = `
    <header class="a-head">
      <div class="a-title"><span>☢</span> Админка терминалов</div>
      <nav class="a-tabs">
        ${[['screens', 'Экраны'], ['links', 'Ссылки'], ['factions', 'Группировки'], ['publish', 'Публикация']].map(([id, n]) => `<button type="button" data-tab="${id}" class="${tab === id ? 'is-cur' : ''}">${n}</button>`).join('')}
      </nav>
      <div class="a-right">
        <span class="dirty" hidden>Есть неопубликованные изменения</span>
        <label class="a-preview"><input type="checkbox" ${useDraft() ? 'checked' : ''}> Черновик на сайте (в этом браузере)</label>
      </div>
    </header>
    <main class="a-main"></main>`;
  root.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { tab = b.dataset.tab; render(); window.scrollTo(0, 0); }));
  root.querySelector('.a-preview input').addEventListener('change', (e) => { setUseDraft(e.target.checked); toast(e.target.checked ? 'Сайт в этом браузере показывает черновик' : 'Сайт в этом браузере показывает опубликованную версию'); });
  const main = root.querySelector('.a-main');
  if (tab === 'screens') screens(main);
  else if (tab === 'links') links(main);
  else if (tab === 'factions') factions(main);
  else publish(main);
  markDirty();
  window.scrollTo(0, keepScroll);
}

function siteBase() {
  return new URL('./', location.href).href;
}
function deviceLink(f, dev) {
  return `${siteBase()}#/${f.id}${dev ? `/${dev}` : ''}${f.key ? `?k=${encodeURIComponent(f.key)}` : ''}`;
}

// ---------- экраны ----------
function screens(main) {
  const fs = model.factions.factions;
  main.innerHTML = `
    <section class="card">
      <h2>Общее объявление</h2>
      <p class="hint">Бегущая строка над всеми терминалами. Оставьте пустым, чтобы скрыть.</p>
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
          ${devicesOf(f).map((d) => screenCell(f, DEVICES[d])).join('')}
        </section>`).join('')}
    </div>`;
  main.querySelector('[data-broadcast]').addEventListener('input', (e) => { model.state.broadcast = e.target.value; save(); });
  main.querySelectorAll('[data-all]').forEach((b) => b.addEventListener('click', () => {
    const st = b.dataset.all;
    if (st === 'wiped' && !confirmInline(b, 'Точно стереть все экраны?')) return;
    fs.forEach((f) => ALL_DEVICES.forEach((d) => { model.state.screens[f.id][d].status = st; }));
    save(); render();
  }));
  main.querySelectorAll('[data-fall]').forEach((b) => b.addEventListener('click', () => {
    ALL_DEVICES.forEach((d) => { model.state.screens[b.dataset.fall][d].status = b.dataset.st; });
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
      <div class="cell-head"><b>${d.name}</b><a href="${esc(deviceLink(f, d.id))}" target="_blank" rel="noopener">смотреть ↗</a></div>
      <label>Состояние
        <select data-k="status">${Object.entries(STATUSES).map(([k, v]) => `<option value="${k}" ${s.status === k ? 'selected' : ''}>${v.label}</option>`).join('')}</select>
      </label>
      <label>Заголовок <input data-k="title" value="${esc(s.title || '')}" placeholder="по умолчанию"></label>
      <label>Сообщение <textarea data-k="message" rows="2" placeholder="Текст на экране">${esc(s.message || '')}</textarea></label>
      <label class="code-row" ${s.status === 'locked' ? '' : 'hidden'}>Код разблокировки <input data-k="code" value="${esc(s.code || '')}" placeholder="пусто: без кода"></label>
    </div>`;
}

// ---------- ссылки ----------
function links(main) {
  const fs = model.factions.factions;
  main.innerHTML = `
    <section class="card">
      <h2>Ссылки на терминалы</h2>
      <p class="hint">Игрок, открывший ссылку на устройство, видит только это устройство и никуда не может перейти. Ссылка на группировку показывает выбор её устройств. Чтобы адрес нельзя было угадать, задайте группировке ключ доступа во вкладке «Группировки».</p>
      <label class="check"><input type="checkbox" data-catalog ${model.state.catalog ? 'checked' : ''}> Показывать список группировок на главной странице сайта (группировки с ключом не показываются)</label>
    </section>
    ${fs.map((f) => `
      <section class="card fcard-a" style="--c:${f.colors?.primary || '#888'}">
        <header class="fa-head"><img src="${f.emblem}" alt=""><h2>${esc(f.name)}</h2>${f.key ? '<span class="pill">с ключом</span>' : ''}</header>
        <div class="links">
          ${[['', 'Выбор устройств группировки'], ...devicesOf(f).map((d) => [d, DEVICES[d].name])].map(([d, n]) => `
            <div class="link-row"><span>${esc(n)}</span><input readonly value="${esc(deviceLink(f, d))}"><button type="button" data-copy>Копировать</button><a href="${esc(deviceLink(f, d))}" target="_blank" rel="noopener">Открыть ↗</a></div>`).join('')}
        </div>
      </section>`).join('')}`;
  main.querySelector('[data-catalog]').addEventListener('change', (e) => { model.state.catalog = e.target.checked; save(); });
  main.querySelectorAll('[data-copy]').forEach((b) => b.addEventListener('click', async () => {
    const inp = b.previousElementSibling;
    try { await navigator.clipboard.writeText(inp.value); toast('Ссылка скопирована'); } catch { inp.select(); toast('Выделено: нажмите Ctrl+C'); }
  }));
}

// ---------- группировки ----------
const TEMPLATE = () => ({
  id: '', name: 'Новая группировка', fullName: 'Полное название', motto: '', emblem: 'assets/img/emblems/generic.svg',
  colors: { primary: '#5a7a3a', secondary: '#e8d27a', accent: '#9fc36a', dark: '#1a2410' },
  location: 'Зона', key: '', devices: [...ALL_DEVICES],
  user: { name: 'Оператор', login: 'operator', role: 'Сотрудник' },
  look: {}, os: {}, pda: { theme: 'standard', rank: 'Новичок', reputation: 'Нейтральная' },
  docs: [{ id: 'about', title: 'О группировке', category: 'about', org: '', author: '', meta: {}, body: '### О группировке\n\nОпишите группировку здесь.\n' }],
});

function slug(s) {
  const tr = { а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch', ы: 'y', э: 'e', ю: 'yu', я: 'ya' };
  return (s || '').toLowerCase().split('').map((c) => tr[c] ?? c).join('').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
function uniqueId(base, list) {
  let id = base || `x${Date.now().toString(36)}`, i = 2;
  const b = id;
  while (list.some((x) => x.id === id)) id = `${b}-${i++}`;
  return id;
}
const randomKey = () => Math.random().toString(36).slice(2, 8) + Math.random().toString(36).slice(2, 6);

function factions(main) {
  const fs = model.factions.factions;
  if (editId && !fs.find((f) => f.id === editId)) editId = null;
  if (!editId && fs[0]) editId = fs[0].id;
  main.innerHTML = `
    <div class="f-layout">
      <aside class="card f-list">
        <h2>Группировки</h2>
        <ul>${fs.map((f, i) => `<li><button type="button" data-edit="${f.id}" class="${f.id === editId ? 'is-cur' : ''}"><img src="${f.emblem}" alt="">${esc(f.name)}</button>
          <span class="mv"><button type="button" data-up="${i}" aria-label="Выше">▲</button><button type="button" data-down="${i}" aria-label="Ниже">▼</button></span></li>`).join('')}</ul>
        <div class="col">
          <button type="button" data-new class="ok">+ Новая группировка</button>
          ${editId ? '<button type="button" data-dupf>Создать вариацию этой</button>' : ''}
        </div>
        <nav class="f-toc">
          <a href="#fe-main">Основное</a><a href="#fe-user">Пользователь и обои</a><a href="#fe-os">Системы</a><a href="#fe-pda">КПК</a><a href="#fe-cats">Разделы</a><a href="#fe-docs">Документы</a>
        </nav>
      </aside>
      <section class="f-edit"></section>
    </div>`;
  main.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => { editId = b.dataset.edit; openDocs = new Set(); render(); }));
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
    ensureFaction(f);
    fs.push(f); ensureScreens(f); editId = f.id; save(); render();
  });
  main.querySelector('[data-dupf]')?.addEventListener('click', () => {
    const src = fs.find((x) => x.id === editId);
    const f = clone(src);
    f.id = uniqueId(`${src.id}-v`, fs);
    f.name = `${src.name} (вариация)`;
    fs.push(f); ensureScreens(f); editId = f.id; save(); render();
    toast('Создана копия группировки: меняйте цвета, эмблему и документы');
  });
  main.querySelector('.f-toc').addEventListener('click', (e) => {
    const a = e.target.closest('a');
    if (!a) return;
    e.preventDefault();
    document.querySelector(a.getAttribute('href'))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  const ed = main.querySelector('.f-edit');
  if (!editId) { ed.innerHTML = '<div class="card empty">Создайте группировку.</div>'; return; }
  editFaction(ed, fs.find((f) => f.id === editId));
}

function imgField(label, value, attr, hint = '') {
  return `
    <div class="img-field">
      <div class="img-prev">${value ? `<img src="${esc(value)}" alt="">` : '<span>нет</span>'}</div>
      <div class="col">
        <b>${label}</b>
        ${hint ? `<span class="hint">${hint}</span>` : ''}
        <div class="row small">
          <label class="file">Загрузить<input type="file" accept="image/*" ${attr} hidden></label>
          ${value ? `<button type="button" ${attr}-clear>Убрать</button>` : ''}
        </div>
      </div>
    </div>`;
}

function editFaction(ed, f) {
  ensureFaction(f);
  const cats = model.factions.categories;
  const isNew = !pub.factions.factions.some((x) => x.id === f.id);
  ed.innerHTML = `
    <div class="card" id="fe-main">
      <h2>Основное</h2>
      <div class="fe-top">
        <div class="fe-emblem"><img src="${f.emblem}" alt=""><label class="file">Загрузить эмблему<input type="file" accept="image/*" data-emblem hidden></label></div>
        <div class="fe-fields">
          <label>ID (латиница, в адресе страницы) <input data-f="id" value="${esc(f.id)}" ${isNew ? '' : 'readonly'}></label>
          <label>Короткое название <input data-f="name" value="${esc(f.name)}"></label>
          <label>Полное название <input data-f="fullName" value="${esc(f.fullName || '')}"></label>
          <label>Девиз <input data-f="motto" value="${esc(f.motto || '')}"></label>
          <label>Местоположение <input data-f="location" value="${esc(f.location || '')}"></label>
          <label>Ключ доступа к ссылкам <span class="row small"><input data-f="key" value="${esc(f.key || '')}" placeholder="пусто: без ключа"><button type="button" data-genkey>Создать</button></span></label>
        </div>
      </div>
      <div class="fe-row">
        ${['primary', 'secondary', 'accent', 'dark'].map((k) => `<label class="color">${({ primary: 'Основной', secondary: 'Второй', accent: 'Акцент', dark: 'Тёмный' })[k]}<input type="color" data-c="${k}" value="${f.colors?.[k] || '#888888'}"></label>`).join('')}
      </div>
      <fieldset class="devs"><legend>Устройства группировки</legend>
        ${ALL_DEVICES.map((d) => `<label class="check"><input type="checkbox" data-dev="${d}" ${f.devices.includes(d) ? 'checked' : ''}> ${DEVICES[d].name}</label>`).join('')}
      </fieldset>
      <div class="row"><a href="${esc(deviceLink(f))}" target="_blank" rel="noopener">Открыть страницу группировки ↗</a><button type="button" class="danger" data-del>Удалить группировку</button></div>
    </div>

    <div class="card" id="fe-user">
      <h2>Пользователь и обои</h2>
      <div class="fe-row">
        <label>Имя пользователя <input data-u="name" value="${esc(f.user?.name || '')}"></label>
        <label>Должность <input data-u="role" value="${esc(f.user?.role || '')}"></label>
      </div>
      <div class="img-grid">
        ${imgField('Аватарка', f.look.avatar, 'data-img="avatar"', 'Экран входа, меню «Пуск», сведения в КПК. Без неё используется эмблема.')}
        ${imgField('Обои Агата (XP)', f.look.wallpaperAgat, 'data-img="wallpaperAgat"', 'Без обоев: стандартный рисунок в цветах группировки.')}
        ${imgField('Обои ноутбука (Vista)', f.look.wallpaperLaptop, 'data-img="wallpaperLaptop"')}
      </div>
      <label class="check"><input type="checkbox" data-look="emblemOnDesktop" ${f.look.emblemOnDesktop !== false ? 'checked' : ''}> Эмблема на рабочем столе</label>
      <label>Заметка на гаджете ноутбука <input data-lk="note" value="${esc(f.look.note || '')}" placeholder="по умолчанию: девиз"></label>
    </div>

    <div class="card" id="fe-os">
      <h2>Системы</h2>
      <div class="fe-fields">
        <label>Название системы Агата <input data-os="agatName" value="${esc(f.os.agatName)}"></label>
        <label>Название системы ноутбука <input data-os="laptopName" value="${esc(f.os.laptopName)}"></label>
        <label>Имя компьютера <input data-os="computer" value="${esc(f.os.computer)}"></label>
        <label>Пароль ноутбука <input data-os="laptopPassword" value="${esc(f.os.laptopPassword)}" placeholder="пусто: любой пароль"></label>
        <label>Подсказка к паролю <input data-os="laptopHint" value="${esc(f.os.laptopHint)}" placeholder="по умолчанию"></label>
      </div>
      <label>Строки загрузки Агата (каждая с новой строки)<textarea data-bios rows="5" class="md">${esc((f.os.bios || []).join('\n'))}</textarea></label>
    </div>

    <div class="card" id="fe-pda">
      <h2>КПК</h2>
      <div class="fe-fields">
        <label>Оформление КПК S2 <select data-pda="theme">${Object.entries(S2_THEMES).map(([k, v]) => `<option value="${k}" ${f.pda.theme === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
        <label>Ранг <input data-pda="rank" value="${esc(f.pda.rank || '')}"></label>
        <label>Репутация <input data-pda="reputation" value="${esc(f.pda.reputation || '')}"></label>
      </div>
      <p class="hint">В КПК только информация: документы группировки и сведения о владельце. Оформления ТЧ, ЧН и ЗП включаются галочками в «Устройствах».</p>
    </div>

    <div class="card" id="fe-cats">
      <h2>Разделы документов</h2>
      <p class="hint">Общие для всех группировок. Документы группируются по разделам в папках, энциклопедии и заметках КПК.</p>
      <div class="rows">${Object.entries(cats).map(([k, v]) => `<div class="rowed"><input data-cat="${esc(k)}" value="${esc(v)}" aria-label="Название раздела"><code>${esc(k)}</code></div>`).join('')}</div>
      <div class="row"><input data-newcat placeholder="Новый раздел, например: Аномалии"><button type="button" data-addcat>+ Раздел</button></div>
    </div>

    <div class="card" id="fe-docs">
      <h2>Документы (${f.docs.length})</h2>
      <p class="hint">Текст в формате Markdown: <code>### Заголовок</code>, <code>**жирный**</code>, <code>* список</code>, таблицы через <code>|</code>, картинки <code>![](ссылка)</code>. Для «Дискеты» тип «Диалог ИИ» и строки <code>@q вопрос</code> / <code>@a ответ</code>.</p>
      <div class="row add-doc">
        ${[['research', '+ Исследование'], ['tech', '+ Разработка'], ['med', '+ Мед. разработка'], ['field', '+ Полевая запись'], ['', '+ Документ']].map(([c, n]) => `<button type="button" class="ok" data-adddoc="${c}">${n}</button>`).join('')}
        <label class="file">Импорт файла (.docx, .md, .txt, .html)<input type="file" accept="${ACCEPT}" data-importdoc multiple hidden></label>
        <button type="button" data-exportall>Экспорт всех документов (.zip: .docx и .md)</button>
      </div>
      <div class="docs"></div>
    </div>`;

  // основное
  ed.querySelectorAll('[data-f]').forEach((inp) => inp.addEventListener('input', () => {
    const k = inp.dataset.f;
    if (k === 'id') {
      const old = f.id;
      const v = slug(inp.value);
      if (!v || model.factions.factions.some((x) => x !== f && x.id === v)) return;
      f.id = v; editId = v;
      model.state.screens[v] = model.state.screens[old] || {};
      if (old !== v) delete model.state.screens[old];
    } else if (k === 'key') f.key = slug(inp.value);
    else f[k] = inp.value;
    save();
  }));
  ed.querySelector('[data-genkey]').addEventListener('click', () => { f.key = randomKey(); save(); render(); toast('Ключ создан. Старые ссылки на эту группировку перестанут работать после публикации.'); });
  ed.querySelectorAll('[data-c]').forEach((inp) => inp.addEventListener('input', () => { f.colors ||= {}; f.colors[inp.dataset.c] = inp.value; save(); }));
  ed.querySelectorAll('[data-dev]').forEach((inp) => inp.addEventListener('change', () => {
    const set = new Set(f.devices);
    inp.checked ? set.add(inp.dataset.dev) : set.delete(inp.dataset.dev);
    f.devices = ALL_DEVICES.filter((d) => set.has(d));
    if (!f.devices.length) { f.devices = [inp.dataset.dev]; inp.checked = true; toast('Нужно оставить хотя бы одно устройство', 'err'); }
    save();
  }));
  ed.querySelector('[data-emblem]').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    f.emblem = await imageFromFile(file, 512, true);
    save(); render();
  });
  ed.querySelector('[data-del]').addEventListener('click', (e) => {
    if (!confirmInline(e.currentTarget, 'Удалить?')) return;
    model.factions.factions = model.factions.factions.filter((x) => x !== f);
    delete model.state.screens[f.id];
    editId = null; save(); render();
  });

  // пользователь, оформление
  ed.querySelectorAll('[data-u]').forEach((inp) => inp.addEventListener('input', () => { f.user ||= {}; f.user[inp.dataset.u] = inp.value; save(); }));
  ed.querySelectorAll('input[type="file"][data-img]').forEach((inp) => inp.addEventListener('change', async () => {
    const file = inp.files[0];
    if (!file) return;
    const k = inp.dataset.img;
    f.look[k] = k === 'avatar' ? await imageFromFile(file, 320, true) : await imageFromFile(file, 1920);
    save(); render();
  }));
  ed.querySelectorAll('[data-img-clear]').forEach((b) => b.addEventListener('click', () => {
    const k = b.getAttribute('data-img');
    f.look[k] = ''; save(); render();
  }));
  ed.querySelector('[data-look]').addEventListener('change', (e) => { f.look.emblemOnDesktop = e.target.checked; save(); });
  ed.querySelector('[data-lk]').addEventListener('input', (e) => { f.look.note = e.target.value; save(); });

  // системы, КПК
  ed.querySelectorAll('[data-os]').forEach((inp) => inp.addEventListener('input', () => { f.os[inp.dataset.os] = inp.value; save(); }));
  ed.querySelector('[data-bios]').addEventListener('input', (e) => { f.os.bios = e.target.value.split('\n'); save(); });
  ed.querySelectorAll('[data-pda]').forEach((inp) => inp.addEventListener(inp.tagName === 'SELECT' ? 'change' : 'input', () => { f.pda[inp.dataset.pda] = inp.value; save(); }));

  // разделы
  ed.querySelectorAll('[data-cat]').forEach((inp) => inp.addEventListener('input', () => { cats[inp.dataset.cat] = inp.value; save(); }));
  ed.querySelector('[data-addcat]').addEventListener('click', () => {
    const name = ed.querySelector('[data-newcat]').value.trim();
    if (!name) return;
    const id = uniqueId(slug(name), Object.keys(cats).map((k) => ({ id: k })));
    cats[id] = name; save(); render();
  });

  // документы
  const docsEl = ed.querySelector('.docs');
  f.docs.forEach((d, i) => docsEl.appendChild(docEditor(f, d, i)));
  ed.querySelectorAll('[data-adddoc]').forEach((b) => b.addEventListener('click', () => {
    const c = b.dataset.adddoc || Object.keys(cats).find((k) => k !== 'about') || 'research';
    const label = { research: 'Новое исследование', tech: 'Новая разработка', med: 'Новая медицинская разработка', field: 'Новая полевая запись' }[c] || 'Новый документ';
    const d = { id: uniqueId(slug(label), f.docs), title: label, category: c, org: f.fullName || '', author: f.user?.name || '', meta: {}, body: `### ${label}\n\nТекст документа.\n` };
    f.docs.push(d); openDocs.add(d.id);
    save(); render();
    document.querySelector(`[data-docid="${CSS.escape(d.id)}"]`)?.scrollIntoView({ block: 'center' });
  }));
  ed.querySelector('[data-exportall]').addEventListener('click', async (e) => {
    const b = e.currentTarget;
    b.disabled = true;
    const old = b.textContent;
    try {
      const blob = await factionZip(f, (d) => loadDoc(d), (t) => { b.textContent = `Экспорт ${t}`; });
      download(blob, `${safeName(f.name)} — документы.zip`);
    } catch (err) { toast(`Экспорт не удался: ${err.message}`, 'err'); }
    b.disabled = false; b.textContent = old;
  });
  ed.querySelector('[data-importdoc]').addEventListener('change', async (e) => {
    const files = [...e.target.files];
    let n = 0;
    for (const file of files) {
      try {
        const { title, body, warnings } = await importFile(file);
        const d = { id: uniqueId(slug(title), f.docs), title, category: 'research', org: f.fullName || '', author: f.user?.name || '', meta: {}, body };
        f.docs.push(d); openDocs.add(d.id); n++;
        if (warnings.length) toast(`«${file.name}»: часть оформления не перенесена`, 'err');
      } catch (err) { toast(`«${file.name}»: ${err.message}`, 'err'); }
    }
    if (n) { save(); render(); toast(`Импортировано документов: ${n}. Проверьте раздел и название.`); }
  });
}

function metaToText(meta) { return Object.entries(meta || {}).map(([k, v]) => `${k}: ${v}`).join('\n'); }
function textToMeta(t) {
  const m = {};
  t.split('\n').forEach((l) => { const i = l.indexOf(':'); if (i > 0) m[l.slice(0, i).trim()] = l.slice(i + 1).trim(); });
  return m;
}

function docEditor(f, d, i) {
  const cats = model.factions.categories;
  const det = document.createElement('details');
  det.className = 'doc-ed';
  det.dataset.docid = d.id;
  if (openDocs.has(d.id)) det.open = true;
  det.innerHTML = `
    <summary><span class="dt">${esc(d.title)}</span><span class="dc">${esc(cats[d.category] || d.category)}</span>
      <span class="mv"><button type="button" data-dup aria-label="Выше">▲</button><button type="button" data-ddn aria-label="Ниже">▼</button></span></summary>
    <div class="doc-grid">
      <label>Название <input data-d="title" value="${esc(d.title)}"></label>
      <label>Раздел <select data-d="category">${Object.entries(cats).map(([k, v]) => `<option value="${k}" ${d.category === k ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select></label>
      <label>Автор <input data-d="author" value="${esc(d.author || '')}"></label>
      <label>Учреждение / где найдено <input data-d="org" value="${esc(d.org || '')}"></label>
      <label>Тип <select data-d="kind"><option value="">Документ</option><option value="chat" ${d.kind === 'chat' ? 'selected' : ''}>Диалог ИИ («Дискета»)</option></select></label>
    </div>
    <div class="doc-grid">
      <label>Поля в шапке (по одному «Название: значение» в строке)<textarea data-meta rows="3">${esc(metaToText(d.meta))}</textarea></label>
      ${imgField('Фото записи', d.cover, 'data-cover', 'Показывается рядом с текстом в КПК S2.')}
    </div>
    <div class="row small doc-tools">
      <button type="button" data-load ${d.body != null ? 'hidden' : ''}>Загрузить текст для правки</button>
      <label class="file">Вставить картинку<input type="file" accept="image/*" data-insimg hidden></label>
      <label class="file">Заменить текст из файла<input type="file" accept="${ACCEPT}" data-replace hidden></label>
      <button type="button" data-preview>Предпросмотр</button>
      <button type="button" data-exp="docx">Скачать .docx</button>
      <button type="button" data-exp="md">Скачать .md</button>
    </div>
    <textarea class="md" rows="14" placeholder="Нажмите «Загрузить текст для правки»"></textarea>
    <div class="md-preview doc" hidden></div>
    <div class="row"><button type="button" class="danger" data-rm>Удалить документ</button></div>`;
  det.addEventListener('toggle', () => { det.open ? openDocs.add(d.id) : openDocs.delete(d.id); });
  const ta = det.querySelector('textarea.md');
  const prev = det.querySelector('.md-preview');
  if (d.body != null) ta.value = d.body; else ta.disabled = true;
  const ensureBody = async () => {
    if (d.body == null) { d.body = await loadDoc(d); ta.value = d.body; ta.disabled = false; det.querySelector('[data-load]').hidden = true; }
  };
  det.querySelector('[data-load]').addEventListener('click', ensureBody);
  ta.addEventListener('input', () => { d.body = ta.value; save(); if (!prev.hidden) prev.innerHTML = renderMarkdown(ta.value); });
  det.querySelector('[data-preview]').addEventListener('click', async () => {
    await ensureBody();
    prev.hidden = !prev.hidden;
    if (!prev.hidden) prev.innerHTML = renderMarkdown(ta.value);
  });
  det.querySelectorAll('[data-exp]').forEach((b) => b.addEventListener('click', async () => {
    try {
      const md = d.body != null ? d.body : await loadDoc(d);
      if (b.dataset.exp === 'md') download(new Blob([`# ${d.title}\n\n${md}`], { type: 'text/markdown' }), `${safeName(d.title)}.md`);
      else download(await docToDocx(d, md, f), `${safeName(d.title)}.docx`);
    } catch (err) { toast(`Экспорт не удался: ${err.message}`, 'err'); }
  }));
  det.querySelector('[data-insimg]').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    await ensureBody();
    const url = await imageFromFile(file, 1200);
    const pos = ta.selectionStart ?? ta.value.length;
    ta.value = `${ta.value.slice(0, pos)}\n\n![](${url})\n\n${ta.value.slice(pos)}`;
    d.body = ta.value; save();
    toast('Картинка вставлена в текст');
  });
  det.querySelector('[data-replace]').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const { body } = await importFile(file);
      d.body = body; ta.value = body; ta.disabled = false; det.querySelector('[data-load]').hidden = true;
      save(); toast('Текст заменён');
    } catch (err) { toast(err.message, 'err'); }
  });
  det.querySelector('input[data-cover]').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    d.cover = await imageFromFile(file, 900); save(); render();
  });
  det.querySelector('[data-cover-clear]')?.addEventListener('click', () => { delete d.cover; save(); render(); });
  det.querySelector('[data-meta]').addEventListener('input', (e) => { d.meta = textToMeta(e.target.value); save(); });
  det.querySelectorAll('[data-d]').forEach((inp) => inp.addEventListener(inp.tagName === 'SELECT' ? 'change' : 'input', () => {
    const k = inp.dataset.d;
    if (k === 'kind') { if (inp.value) d.kind = inp.value; else delete d.kind; }
    else d[k] = inp.value;
    if (k === 'title') det.querySelector('.dt').textContent = inp.value;
    if (k === 'category') det.querySelector('.dc').textContent = cats[inp.value] || inp.value;
    save();
  }));
  det.querySelector('[data-rm]').addEventListener('click', (e) => {
    if (!confirmInline(e.currentTarget, 'Удалить?')) return;
    f.docs.splice(f.docs.indexOf(d), 1); save(); render();
  });
  det.querySelector('[data-dup]').addEventListener('click', (e) => { e.preventDefault(); if (i > 0) { [f.docs[i - 1], f.docs[i]] = [f.docs[i], f.docs[i - 1]]; save(); render(); } });
  det.querySelector('[data-ddn]').addEventListener('click', (e) => { e.preventDefault(); if (i < f.docs.length - 1) { [f.docs[i + 1], f.docs[i]] = [f.docs[i], f.docs[i + 1]]; save(); render(); } });
  return det;
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
      <p class="hint">Тексты документов сохраняются в <code>content/</code>, картинки в <code>assets/uploads/</code>, настройки в <code>data/factions.json</code> и <code>data/state.json</code>. Сайт на GitHub Pages обновится примерно через минуту, а открытые терминалы подхватят новое состояние экранов сами (проверка каждые 15 секунд).</p>
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
      <p class="hint">Скачайте файлы и положите их в папку <code>data/</code> вручную, или перенесите черновик на другой компьютер. Тексты и картинки в этом случае остаются внутри <code>factions.json</code>.</p>
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
      const out = clone(model);
      const say = (t) => { log.textContent = t; };
      await externalize(v, out, say);
      say('Публикация factions.json...');
      await putFile(v, 'data/factions.json', JSON.stringify(out.factions, null, 1) + '\n', 'Админка: обновлены группировки');
      say('Публикация state.json...');
      await putFile(v, 'data/state.json', JSON.stringify(out.state, null, 1) + '\n', 'Админка: обновлено состояние экранов');
      model = out;
      pub = clone(out);
      writeDraft(model);
      say('Готово. Сайт обновится в течение минуты.');
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
      model.factions.factions.forEach((f) => { ensureFaction(f); ensureScreens(f); });
      save(); toast('Импортировано'); render();
    } catch (err) { toast(`Не удалось импортировать: ${err.message}`, 'err'); }
  });
  main.querySelector('[data-reset]').addEventListener('click', (e) => {
    if (!confirmInline(e.currentTarget, 'Отменить все изменения?')) return;
    clearDraft();
    model = clone(pub);
    model.factions.factions.forEach((f) => { ensureFaction(f); ensureScreens(f); });
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

// Выносит встроенные картинки и тексты документов в отдельные файлы репозитория.
async function externalize(cfg, out, say) {
  const uploaded = new Map();
  const DATA_RE = /data:image\/(png|jpeg|jpg|gif|webp|svg\+xml);base64,[A-Za-z0-9+/=]+/g;
  const upload = async (dataUrl) => {
    if (uploaded.has(dataUrl)) return uploaded.get(dataUrl);
    const m = dataUrl.match(/^data:image\/([a-z+]+);base64,(.*)$/);
    const ext = { jpeg: 'jpg', 'svg+xml': 'svg' }[m[1]] || m[1];
    const name = `assets/uploads/${(await sha256(dataUrl)).slice(0, 16)}.${ext}`;
    say(`Загрузка картинки ${name}...`);
    await putFile(cfg, name, null, 'Админка: картинка', m[2], true);
    uploaded.set(dataUrl, name);
    return name;
  };
  const replaceAll = async (text) => {
    for (const m of [...new Set(text.match(DATA_RE) || [])]) text = text.split(m).join(await upload(m));
    return text;
  };
  for (const f of out.factions.factions) {
    for (const k of ['emblem']) if (f[k]?.startsWith('data:')) f[k] = await upload(f[k]);
    for (const k of Object.keys(f.look || {})) if (typeof f.look[k] === 'string' && f.look[k].startsWith('data:')) f.look[k] = await upload(f.look[k]);
    for (const d of f.docs || []) {
      if (d.cover?.startsWith('data:')) d.cover = await upload(d.cover);
      if (d.icon?.startsWith('data:')) d.icon = await upload(d.icon);
      if (d.body != null) {
        const body = await replaceAll(d.body);
        const path = `content/${f.id}/${slug(d.id) || 'doc'}.md`;
        say(`Сохранение текста ${path}...`);
        await putFile(cfg, path, body, `Админка: документ «${d.title}»`);
        d.file = path;
        delete d.body;
      }
    }
  }
}

async function putFile({ owner, repo, branch, token }, path, content, message, b64 = null, skipIfExists = false) {
  const api = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${path}`;
  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' };
  let sha;
  const r = await fetch(`${api}?ref=${encodeURIComponent(branch)}`, { headers });
  if (r.ok) {
    if (skipIfExists) return;
    sha = (await r.json()).sha;
  } else if (r.status !== 404) throw new Error(`GitHub ${r.status}: ${(await r.json().catch(() => ({}))).message || 'нет доступа'}`);
  if (b64 == null) {
    let bin = '';
    new TextEncoder().encode(content).forEach((b) => { bin += String.fromCharCode(b); });
    b64 = btoa(bin);
  }
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
