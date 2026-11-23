// Минимальный рендерер Markdown для документов терминалов.
// Поддерживает: заголовки, абзацы, жирный/курсив/зачёркнутый, списки,
// таблицы, цитаты, изображения, горизонтальные линии.

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function inline(src) {
  let s = esc(src);
  // экранированные символы
  s = s.replace(/\\([*_\\[\]()#+\-.!~|`])/g, (_, c) => `&#${c.charCodeAt(0)};`);
  s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_, alt, url) =>
    `<img class="md-img" src="${url}" alt="${alt}" loading="lazy">`);
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  s = s.replace(/\*\*\*([^*]+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  s = s.replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*\w])\*([^*\n]+?)\*(?!\w)/g, '$1<em>$2</em>');
  s = s.replace(/~~([^~]+?)~~/g, '<del>$1</del>');
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  // потерянные переносы строк из Google Docs (3+ пробела)
  s = s.replace(/ {3,}/g, '<br>');
  s = s.replace(/\*{2,}/g, '');
  return s;
}

function splitRow(line) {
  let l = line.trim();
  if (l.startsWith('|')) l = l.slice(1);
  if (l.endsWith('|')) l = l.slice(0, -1);
  return l.split(/(?<!\\)\|/).map((c) => c.trim());
}

export function renderMarkdown(text) {
  const lines = (text || '').replace(/\r/g, '').split('\n');
  const out = [];
  let i = 0;
  let para = [];
  const flush = () => {
    if (para.length) {
      out.push(`<p>${para.map(inline).join('<br>')}</p>`);
      para = [];
    }
  };
  while (i < lines.length) {
    const raw = lines[i];
    const line = raw.trimEnd();
    const t = line.trim();
    if (!t) { flush(); i++; continue; }

    let m;
    if ((m = t.match(/^(#{1,6})\s+(.*)$/))) {
      flush();
      const lvl = Math.min(6, m[1].length + 1);
      out.push(`<h${lvl}>${inline(m[2])}</h${lvl}>`);
      i++; continue;
    }
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(t)) { flush(); out.push('<hr>'); i++; continue; }
    if (/^!\[[^\]]*\]\([^)]+\)$/.test(t)) {
      flush();
      out.push(`<figure class="md-fig">${inline(t)}</figure>`);
      i++; continue;
    }
    if (t.startsWith('>')) {
      flush();
      const buf = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        buf.push(lines[i].trim().replace(/^>\s?/, ''));
        i++;
      }
      out.push(`<blockquote>${renderMarkdown(buf.join('\n'))}</blockquote>`);
      continue;
    }
    if (t.startsWith('|') && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1])) {
      flush();
      const head = splitRow(t);
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        rows.push(splitRow(lines[i]));
        i++;
      }
      out.push('<div class="md-table"><table><thead><tr>' +
        head.map((h) => `<th>${inline(h)}</th>`).join('') + '</tr></thead><tbody>' +
        rows.map((r) => '<tr>' + r.map((c) => `<td>${inline(c)}</td>`).join('') + '</tr>').join('') +
        '</tbody></table></div>');
      continue;
    }
    if ((m = t.match(/^([*\-+]|\d+\.)\s+(.*)$/))) {
      flush();
      const ordered = /\d/.test(m[1]);
      const items = [];
      while (i < lines.length) {
        const l = lines[i];
        const lm = l.trim().match(/^([*\-+]|\d+\.)\s+(.*)$/);
        if (lm) {
          const indent = l.match(/^\s*/)[0].length;
          items.push({ indent, text: lm[2] });
          i++;
        } else if (!l.trim()) {
          // пустая строка внутри списка: продолжаем, если дальше снова пункт
          const next = lines[i + 1];
          if (next && /^\s*([*\-+]|\d+\.)\s+/.test(next)) { i++; continue; }
          break;
        } else if (/^\s{2,}\S/.test(l) && items.length) {
          items[items.length - 1].text += '<br>' + l.trim();
          i++;
        } else break;
      }
      const tag = ordered ? 'ol' : 'ul';
      let html = `<${tag}>`;
      let depth = 0;
      const base = items.length ? items[0].indent : 0;
      items.forEach((it) => {
        const d = it.indent > base + 1 ? 1 : 0;
        if (d > depth) html += '<ul>';
        if (d < depth) html += '</ul>';
        depth = d;
        html += `<li>${inline(it.text).replace(/&lt;br&gt;/g, '<br>')}</li>`;
      });
      if (depth) html += '</ul>';
      html += `</${tag}>`;
      out.push(html);
      continue;
    }
    para.push(t);
    i++;
  }
  flush();
  return out.join('\n');
}

// Формат «Дискеты»: строки @system / @note / @q / @a
export function parseChat(text) {
  const items = [];
  (text || '').split(/\n\s*\n/).forEach((block) => {
    const b = block.trim();
    const m = b.match(/^@(system|note|q|a)\s+([\s\S]*)$/);
    if (m) items.push({ type: m[1], text: m[2].trim() });
    else if (b) items.push({ type: 'note', text: b });
  });
  return items;
}

export function plainText(md) {
  return (md || '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/[#*>_`|~]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export { esc };
