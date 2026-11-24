import { t } from './i18n.js';
// Простой оконный менеджер для рабочих столов XP и Vista.
let zTop = 10;

export class WindowManager {
  constructor(desktop, taskbarList, opts = {}) {
    this.desktop = desktop;
    this.taskbar = taskbarList;
    this.windows = new Map();
    this.opts = opts;
  }

  open(id, { title, icon, content, width = 560, height = 420, className = '' }) {
    if (this.windows.has(id)) {
      const w = this.windows.get(id);
      w.el.hidden = false;
      this.focus(id);
      return w.el;
    }
    const el = document.createElement('section');
    el.className = `win ${className}`;
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', title);
    const dw = this.desktop.clientWidth;
    const dh = this.desktop.clientHeight;
    const n = this.windows.size;
    const w = Math.min(width, dw - 16);
    const h = Math.min(height, dh - 16);
    el.style.width = `${w}px`;
    el.style.height = `${h}px`;
    el.style.left = `${Math.max(4, Math.min(dw - w - 4, 110 + n * 26))}px`;
    el.style.top = `${Math.max(4, Math.min(dh - h - 4, 20 + n * 22))}px`;
    el.innerHTML = `
      <header class="win-title">
        ${icon ? `<img class="win-ico" src="${icon}" alt="">` : ''}
        <span class="win-name"></span>
        <div class="win-btns">
          <button type="button" class="wb wb-min" aria-label="${t('Свернуть')}"><i></i></button>
          <button type="button" class="wb wb-max" aria-label="${t('Развернуть')}"><i></i></button>
          <button type="button" class="wb wb-close" aria-label="${t('Закрыть')}"><i></i></button>
        </div>
      </header>
      <div class="win-body"></div>`;
    el.querySelector('.win-name').textContent = title;
    const body = el.querySelector('.win-body');
    if (typeof content === 'string') body.innerHTML = content;
    else if (content) body.appendChild(content);

    const tb = document.createElement('button');
    tb.type = 'button';
    tb.className = 'tb-item';
    tb.innerHTML = `${icon ? `<img src="${icon}" alt="">` : ''}<span></span>`;
    tb.querySelector('span').textContent = title;
    tb.addEventListener('click', () => {
      if (el.hidden) { el.hidden = false; this.focus(id); }
      else if (el.classList.contains('is-active')) el.hidden = true;
      else this.focus(id);
    });
    this.taskbar?.appendChild(tb);

    el.addEventListener('pointerdown', () => this.focus(id));
    el.querySelector('.wb-close').addEventListener('click', (e) => { e.stopPropagation(); this.close(id); });
    el.querySelector('.wb-min').addEventListener('click', (e) => { e.stopPropagation(); el.hidden = true; el.classList.remove('is-active'); tb.classList.remove('is-active'); });
    el.querySelector('.wb-max').addEventListener('click', (e) => { e.stopPropagation(); el.classList.toggle('is-max'); });
    el.querySelector('.win-title').addEventListener('dblclick', () => el.classList.toggle('is-max'));
    this.drag(el);

    this.desktop.appendChild(el);
    this.windows.set(id, { el, tb });
    this.focus(id);
    if (this.desktop.clientWidth < 520) el.classList.add('is-max');
    return el;
  }

  focus(id) {
    this.windows.forEach(({ el, tb }, k) => {
      const on = k === id;
      el.classList.toggle('is-active', on);
      tb.classList.toggle('is-active', on);
    });
    const w = this.windows.get(id);
    if (w) w.el.style.zIndex = ++zTop;
  }

  close(id) {
    const w = this.windows.get(id);
    if (!w) return;
    w.el.remove();
    w.tb.remove();
    this.windows.delete(id);
  }

  closeAll() { [...this.windows.keys()].forEach((k) => this.close(k)); }

  drag(el) {
    const handle = el.querySelector('.win-title');
    let sx, sy, ox, oy, dragging = false;
    handle.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.wb') || el.classList.contains('is-max')) return;
      dragging = true;
      sx = e.clientX; sy = e.clientY;
      ox = el.offsetLeft; oy = el.offsetTop;
      handle.setPointerCapture(e.pointerId);
    });
    handle.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const scale = el.getBoundingClientRect().width / el.offsetWidth || 1;
      const dw = this.desktop.clientWidth, dh = this.desktop.clientHeight;
      const nx = ox + (e.clientX - sx) / scale;
      const ny = oy + (e.clientY - sy) / scale;
      el.style.left = `${Math.max(-el.offsetWidth + 80, Math.min(dw - 80, nx))}px`;
      el.style.top = `${Math.max(0, Math.min(dh - 30, ny))}px`;
    });
    const end = () => { dragging = false; };
    handle.addEventListener('pointerup', end);
    handle.addEventListener('pointercancel', end);
  }
}
