// Импорт документов в админке: .docx (Word, Google Docs → «Скачать → .docx»),
// .md, .txt, .html. Результат — Markdown, который понимает сайт.
// Картинки из .docx уменьшаются и встраиваются, при публикации
// админка сохраняет их отдельными файлами в репозитории.

const MAMMOTH = 'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js';

let mammothLoading = null;
function loadMammoth() {
  if (window.mammoth) return Promise.resolve(window.mammoth);
  mammothLoading ||= new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = MAMMOTH;
    s.onload = () => res(window.mammoth);
    s.onerror = () => { mammothLoading = null; rej(new Error('не удалось загрузить модуль чтения .docx (нужен интернет)')); };
    document.head.appendChild(s);
  });
  return mammothLoading;
}

export const ACCEPT = '.docx,.md,.markdown,.txt,.html,.htm';

// Уменьшение картинки до max пикселей по большей стороне.
export function shrinkDataURL(src, max = 1200, type = 'image/jpeg') {
  return new Promise((res) => {
    const img = new Image();
    img.onload = () => {
      const s = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(img.width * s));
      c.height = Math.max(1, Math.round(img.height * s));
      const ctx = c.getContext('2d');
      if (type === 'image/jpeg') { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); }
      ctx.drawImage(img, 0, 0, c.width, c.height);
      res(c.toDataURL(type, 0.85));
    };
    img.onerror = () => res(src);
    img.src = src;
  });
}

export function fileToDataURL(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = () => rej(r.error);
    r.readAsDataURL(file);
  });
}

// Картинка из файла: фото в JPEG, эмблемы и аватары с прозрачностью в PNG.
export async function imageFromFile(file, max, keepAlpha = false) {
  const raw = await fileToDataURL(file);
  return shrinkDataURL(raw, max, keepAlpha ? 'image/png' : 'image/jpeg');
}

// ---------- HTML → Markdown ----------
function inlineMd(node) {
  let out = '';
  node.childNodes.forEach((n) => {
    if (n.nodeType === 3) { out += n.textContent.replace(/\s+/g, ' '); return; }
    if (n.nodeType !== 1) return;
    const tag = n.tagName.toLowerCase();
    const inner = inlineMd(n);
    if (tag === 'strong' || tag === 'b') out += inner.trim() ? `**${inner.trim()}** ` : '';
    else if (tag === 'em' || tag === 'i') out += inner.trim() ? `*${inner.trim()}* ` : '';
    else if (tag === 's' || tag === 'del' || tag === 'strike') out += inner.trim() ? `~~${inner.trim()}~~` : '';
    else if (tag === 'br') out += '   ';
    else if (tag === 'img') out += `\n\n![${n.getAttribute('alt') || ''}](${n.getAttribute('src') || ''})\n\n`;
    else if (tag === 'a') out += n.getAttribute('href') && !n.getAttribute('href').startsWith('#') ? `[${inner.trim()}](${n.getAttribute('href')})` : inner;
    else out += inner;
  });
  return out.replace(/ +\*\*/g, ' **');
}

function blockMd(el, depth = 0) {
  const parts = [];
  el.childNodes.forEach((n) => {
    if (n.nodeType === 3) { if (n.textContent.trim()) parts.push(n.textContent.trim()); return; }
    if (n.nodeType !== 1) return;
    const tag = n.tagName.toLowerCase();
    if (/^h[1-6]$/.test(tag)) {
      const t = inlineMd(n).trim().replace(/\*\*/g, '');
      if (t) parts.push(`### ${t}`);
    } else if (tag === 'p' || tag === 'div' && !n.querySelector('p,table,ul,ol,h1,h2,h3')) {
      const t = inlineMd(n).trim();
      if (t) parts.push(t);
    } else if (tag === 'ul' || tag === 'ol') {
      const items = [];
      [...n.children].filter((li) => li.tagName === 'LI').forEach((li, i) => {
        const nested = [...li.children].filter((c) => c.tagName === 'UL' || c.tagName === 'OL');
        nested.forEach((c) => c.remove());
        const pad = '  '.repeat(depth);
        items.push(`${pad}${tag === 'ol' ? `${i + 1}.` : '*'} ${inlineMd(li).trim()}`);
        nested.forEach((c) => { const wrap = document.createElement('div'); wrap.appendChild(c); items.push(blockMd(wrap, depth + 1)); });
      });
      parts.push(items.join('\n'));
    } else if (tag === 'table') {
      const rows = [...n.querySelectorAll('tr')].map((tr) => [...tr.children].map((td) => inlineMd(td).replace(/\n+/g, ' ').replace(/\|/g, '\\|').trim()));
      if (rows.length) {
        const w = Math.max(...rows.map((r) => r.length));
        const line = (r) => `| ${Array.from({ length: w }, (_, i) => r[i] || ' ').join(' | ')} |`;
        parts.push([line(rows[0]), `|${' :---- |'.repeat(w)}`, ...rows.slice(1).map(line)].join('\n'));
      }
    } else if (tag === 'blockquote') {
      parts.push(blockMd(n).split('\n').map((l) => `> ${l}`).join('\n'));
    } else if (tag === 'hr') {
      parts.push('---');
    } else if (tag === 'img') {
      parts.push(`![](${n.getAttribute('src') || ''})`);
    } else {
      const t = blockMd(n, depth);
      if (t.trim()) parts.push(t);
    }
  });
  return parts.join('\n\n');
}

export function htmlToMarkdown(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('script,style,head').forEach((n) => n.remove());
  return blockMd(doc.body).replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

async function shrinkInlineImages(md) {
  const re = /!\[([^\]]*)\]\((data:image\/[^)\s]+)\)/g;
  const found = [...md.matchAll(re)];
  for (const m of found) {
    const small = await shrinkDataURL(m[2], 1200, m[2].startsWith('data:image/png') ? 'image/png' : 'image/jpeg');
    md = md.replace(m[2], small);
  }
  return md;
}

function guessTitle(md, file) {
  const h = md.match(/^#{1,6}\s+(.+)$/m);
  if (h) return h[1].replace(/\*\*/g, '').trim();
  return file.name.replace(/\.[^.]+$/, '');
}

// Главная функция: файл → { title, body, warnings }
export async function importFile(file) {
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  let body = '';
  const warnings = [];
  if (ext === 'docx') {
    const mammoth = await loadMammoth();
    const res = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() });
    res.messages.filter((m) => m.type === 'error').forEach((m) => warnings.push(m.message));
    body = htmlToMarkdown(res.value);
  } else if (ext === 'html' || ext === 'htm') {
    body = htmlToMarkdown(await file.text());
  } else if (ext === 'md' || ext === 'markdown' || ext === 'txt') {
    body = (await file.text()).replace(/\r/g, '');
    body = body.replace(/^#{1,2}\s/gm, '### ');
  } else {
    throw new Error(`формат .${ext} не поддерживается. Подходят: ${ACCEPT}`);
  }
  body = body.replace(/^[•●▪◦·]\s+/gm, '* ');
  body = await shrinkInlineImages(body);
  return { title: guessTitle(body, file), body, warnings };
}
