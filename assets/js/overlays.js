import { esc } from './md.js';
import { t as tr, locale } from './i18n.js';

const LOCK_SVG = `<svg viewBox="0 0 64 64" class="ov-icon" aria-hidden="true"><rect x="12" y="28" width="40" height="30" rx="4" fill="currentColor"/><path d="M20 28v-8a12 12 0 0 1 24 0v8" fill="none" stroke="currentColor" stroke-width="6"/><circle cx="32" cy="42" r="4" fill="#000"/><rect x="30" y="44" width="4" height="8" fill="#000"/></svg>`;
const WIPE_SVG = `<svg viewBox="0 0 64 64" class="ov-icon" aria-hidden="true"><rect x="10" y="8" width="44" height="48" rx="3" fill="none" stroke="currentColor" stroke-width="4"/><path d="M20 22h24M20 32h24M20 42h14" stroke="currentColor" stroke-width="4" opacity=".35"/><path d="M14 54L54 14" stroke="currentColor" stroke-width="5"/></svg>`;

const unlockKey = (f, d, code) => `artz.unlock.${f}.${d}.${code}`;
function isUnlocked(f, d, code) {
  try { return !!code && sessionStorage.getItem(unlockKey(f, d, code)) === '1'; } catch { return false; }
}

const TX = {
  agat: { lockTitle: 'ДОСТУП ЗАБЛОКИРОВАН', wipeTitle: 'ДАННЫЕ СТЁРТЫ', off: 'НЕТ СИГНАЛА' },
  laptop: { lockTitle: 'Компьютер заблокирован', wipeTitle: 'Диск очищен', off: 'Нет питания' },
  pda: { lockTitle: 'КПК ЗАБЛОКИРОВАН', wipeTitle: 'ПАМЯТЬ КПК ОЧИЩЕНА', off: 'НЕТ СВЯЗИ' },
};

function garble(n) {
  const chars = '░▒▓█▌▐■□▪▫◊¤§¶†‡#%&@ЖЩЪЫЮЯ0123456789ABCDEF';
  let s = '';
  for (let i = 0; i < n; i++) s += chars[(Math.random() * chars.length) | 0];
  return s;
}

/**
 * Накладывает оверлей состояния на экран устройства.
 * @param {HTMLElement} screen контейнер экрана (position:relative)
 * @param {object} st состояние { status, message, code, title }
 * @param {object} ctx { device, faction }
 * @returns {boolean} true, если содержимое под оверлеем полностью скрыто
 */
export function applyOverlay(screen, st, ctx) {
  screen.querySelectorAll('.ov').forEach((n) => n.remove());
  screen.classList.remove('is-corrupted');
  const { device, faction } = ctx;
  const tx = TX[device] || TX.agat;
  const t = { lockTitle: tr(tx.lockTitle), wipeTitle: tr(tx.wipeTitle), off: tr(tx.off) };
  const status = st.status || 'normal';
  if (status === 'normal') return false;
  if (status === 'locked' && isUnlocked(faction.id, device, st.code)) return false;

  const ov = document.createElement('div');
  ov.className = `ov ov-${device} ov-${status}`;
  const msg = st.message ? `<p class="ov-msg">${esc(st.message)}</p>` : '';

  if (status === 'locked') {
    const codeForm = st.code
      ? `<form class="ov-code"><label>${tr('Код доступа')}<input type="password" autocomplete="off" inputmode="text" maxlength="40"></label><button type="submit">${tr('Ввод')}</button><div class="ov-err" aria-live="polite"></div></form>`
      : '';
    ov.innerHTML = `<div class="ov-box">${LOCK_SVG}<h2>${esc(st.title || t.lockTitle)}</h2>${msg || `<p class="ov-msg">${esc(tr('Терминал {name} заблокирован администратором.', { name: faction.name }))}</p>`}${codeForm}<div class="ov-foot">ID: ${esc(faction.id.toUpperCase())}-${device.toUpperCase()} · ${new Date().toLocaleDateString(locale())}</div></div>`;
    const form = ov.querySelector('form');
    if (form) {
      let tries = 0;
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const inp = form.querySelector('input');
        if (inp.value.trim() === String(st.code).trim()) {
          try { sessionStorage.setItem(unlockKey(faction.id, device, st.code), '1'); } catch { /* */ }
          ov.classList.add('ov-leave');
          setTimeout(() => ov.remove(), 500);
          screen.dispatchEvent(new CustomEvent('unlocked'));
        } else {
          tries++;
          form.querySelector('.ov-err').textContent = tr('Неверный код. Попыток: {n}', { n: tries });
          ov.classList.add('ov-shake');
          setTimeout(() => ov.classList.remove('ov-shake'), 400);
          inp.select();
        }
      });
    }
  } else if (status === 'wiped') {
    ov.innerHTML = `<div class="ov-box">${WIPE_SVG}<h2 class="ov-wipe-title">${tr('Форматирование...')}</h2><div class="ov-bar"><i></i></div><pre class="ov-log"></pre></div>`;
    const bar = ov.querySelector('.ov-bar i');
    const log = ov.querySelector('.ov-log');
    const title = ov.querySelector('.ov-wipe-title');
    const files = (faction.docs || []).map((d) => d.title);
    let p = 0;
    const step = () => {
      if (!ov.isConnected) return;
      p += 4 + Math.random() * 9;
      bar.style.width = `${Math.min(100, p)}%`;
      if (files.length) log.textContent = `${tr('удалено: {f}', { f: files[(Math.random() * files.length) | 0] })}\n` + log.textContent.split('\n').slice(0, 4).join('\n');
      if (p < 100) setTimeout(step, 120);
      else {
        title.textContent = st.title || t.wipeTitle;
        log.textContent = `${tr('0 байт в 0 файлах')}\n${tr('Свободно: 100%')}`;
        ov.classList.add('ov-done');
        if (st.message) log.insertAdjacentHTML('afterend', msg);
      }
    };
    setTimeout(step, 300);
  } else if (status === 'offline') {
    ov.innerHTML = `<div class="ov-box"><div class="ov-noise"></div><h2>${esc(st.title || t.off)}</h2>${msg}</div>`;
  } else if (status === 'corrupted') {
    screen.classList.add('is-corrupted');
    ov.innerHTML = `<div class="ov-glitch"></div><div class="ov-box ov-small"><h2>${esc(st.title || tr('ОШИБКА ЧТЕНИЯ ДАННЫХ'))}</h2><p class="ov-garble">${garble(60)}</p>${msg || `<p class="ov-msg">${tr('Сектор повреждён. Часть файлов недоступна.')}</p>`}</div>`;
    const g = ov.querySelector('.ov-garble');
    const id = setInterval(() => { if (!ov.isConnected) return clearInterval(id); g.textContent = garble(60); }, 140);
  } else if (status === 'custom') {
    ov.innerHTML = `<div class="ov-box ov-dialog"><div class="ov-dialog-title">${esc(st.title || tr('Системное сообщение'))}</div><div class="ov-dialog-body">${esc(st.message || '').replace(/\n/g, '<br>')}</div><button type="button" class="ov-ok">${tr('ОК')}</button></div>`;
    ov.querySelector('.ov-ok').addEventListener('click', () => ov.remove());
  }
  screen.appendChild(ov);
  return status === 'locked' || status === 'wiped' || status === 'offline';
}
