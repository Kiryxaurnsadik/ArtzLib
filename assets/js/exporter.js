// Экспорт документов из админки: .docx (Word, Google Docs), .md и архив .zip.
// .docx собирается прямо в браузере: заголовки, абзацы, жирный/курсив,
// списки, таблицы и картинки.

const JSZIP = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
let zipLoading = null;
function loadZip() {
  if (window.JSZip) return Promise.resolve(window.JSZip);
  zipLoading ||= new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = JSZIP;
    s.onload = () => res(window.JSZip);
    s.onerror = () => { zipLoading = null; rej(new Error('не удалось загрузить модуль архивов (нужен интернет)')); };
    document.head.appendChild(s);
  });
  return zipLoading;
}

const x = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function runs(text) {
  // **жирный**, *курсив*, ~~зачёркнутый~~; ссылки превращаются в текст
  const t = text.replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\\([*_|#])/g, '$1');
  const out = [];
  const re = /(\*\*\*[^*]+\*\*\*|\*\*[^*]+\*\*|\*[^*\n]+\*|~~[^~]+~~)/g;
  let last = 0;
  let m;
  const push = (s, rpr = '') => { if (s) s.split(/ {3,}/).forEach((part, i) => { if (i) out.push('<w:r><w:br/></w:r>'); out.push(`<w:r>${rpr ? `<w:rPr>${rpr}</w:rPr>` : ''}<w:t xml:space="preserve">${x(part)}</w:t></w:r>`); }); };
  while ((m = re.exec(t))) {
    push(t.slice(last, m.index));
    const s = m[0];
    if (s.startsWith('***')) push(s.slice(3, -3), '<w:b/><w:i/>');
    else if (s.startsWith('**')) push(s.slice(2, -2), '<w:b/>');
    else if (s.startsWith('~~')) push(s.slice(2, -2), '<w:strike/>');
    else push(s.slice(1, -1), '<w:i/>');
    last = m.index + s.length;
  }
  push(t.slice(last));
  return out.join('');
}

const para = (inner, style = '', extra = '') => `<w:p>${style || extra ? `<w:pPr>${style ? `<w:pStyle w:val="${style}"/>` : ''}${extra}</w:pPr>` : ''}${inner}</w:p>`;

async function imageSize(src) {
  return new Promise((res) => {
    const img = new Image();
    img.onload = () => res([img.naturalWidth || 400, img.naturalHeight || 300]);
    img.onerror = () => res([400, 300]);
    img.src = src;
  });
}

async function fetchImage(src) {
  try {
    const r = await fetch(src);
    if (!r.ok) return null;
    const blob = await r.blob();
    const ext = { 'image/png': 'png', 'image/jpeg': 'jpeg', 'image/gif': 'gif' }[blob.type];
    if (!ext) {
      // webp и прочее переводим в PNG через canvas
      const url = URL.createObjectURL(blob);
      const [w, h] = await imageSize(url);
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const img = new Image();
      await new Promise((ok) => { img.onload = ok; img.onerror = ok; img.src = url; });
      c.getContext('2d').drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      const png = await new Promise((ok) => c.toBlob(ok, 'image/png'));
      return png ? { data: await png.arrayBuffer(), ext: 'png', w, h } : null;
    }
    const [w, h] = await imageSize(URL.createObjectURL(blob));
    return { data: await blob.arrayBuffer(), ext, w, h };
  } catch { return null; }
}

function drawing(rid, n, w, h) {
  const maxW = 6000000; // ~16 см
  const cx = Math.min(maxW, w * 9525);
  const cy = Math.round(cx * (h / w));
  return `<w:r><w:drawing><wp:inline><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${n}" name="img${n}"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${n}" name="img${n}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
}

// Markdown → document.xml + картинки
async function bodyXml(md, media) {
  const lines = (md || '').replace(/\r/g, '').split('\n');
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const t = lines[i].trim();
    if (!t) { i++; continue; }
    let m;
    if ((m = t.match(/^(#{1,6})\s+(.*)$/))) {
      out.push(para(runs(m[2]), m[1].length <= 2 ? 'Heading1' : 'Heading2'));
      i++;
    } else if ((m = t.match(/^!\[[^\]]*\]\(([^)\s]+)\)$/))) {
      const img = await fetchImage(m[1]);
      if (img) {
        const n = media.length + 1;
        media.push({ ...img, name: `image${n}.${img.ext}`, rid: `rIdImg${n}` });
        out.push(para(drawing(`rIdImg${n}`, n, img.w, img.h), '', '<w:jc w:val="center"/>'));
      }
      i++;
    } else if (t.startsWith('|')) {
      const rows = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        const cells = lines[i].trim().replace(/^\||\|$/g, '').split(/(?<!\\)\|/).map((c) => c.trim());
        if (!cells.every((c) => /^:?-{2,}:?$/.test(c))) rows.push(cells);
        i++;
      }
      const w = Math.max(...rows.map((r) => r.length));
      const border = '<w:tblBorders>' + ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map((b) => `<w:${b} w:val="single" w:sz="4" w:color="888888"/>`).join('') + '</w:tblBorders>';
      out.push(`<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/>${border}</w:tblPr>${rows.map((r, ri) => `<w:tr>${Array.from({ length: w }, (_, ci) => `<w:tc><w:p>${runs(ri === 0 ? `**${(r[ci] || '').replace(/\*\*/g, '')}**` : r[ci] || '')}</w:p></w:tc>`).join('')}</w:tr>`).join('')}</w:tbl>`);
      out.push('<w:p/>');
    } else if ((m = lines[i].match(/^(\s*)([*\-+]|\d+\.)\s+(.*)$/))) {
      const level = Math.min(3, Math.floor(m[1].length / 2));
      const bullet = /\d/.test(m[2]) ? `${m[2]} ` : '• ';
      out.push(para(runs(bullet + m[3]), '', `<w:ind w:left="${360 + level * 360}" w:hanging="240"/>`));
      i++;
    } else if (t.startsWith('>')) {
      out.push(para(runs(t.replace(/^>\s?/, '')), 'Quote'));
      i++;
    } else if (/^(-{3,}|\*{3,})$/.test(t)) {
      out.push('<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="6" w:color="888888"/></w:pBdr></w:pPr></w:p>');
      i++;
    } else if (t.startsWith('@')) {
      const mm = t.match(/^@(\w+)\s*(.*)$/);
      const who = { q: 'Запрос', a: 'Ответ', system: 'Система', note: 'Примечание' }[mm?.[1]] || '';
      out.push(para(runs(`**${who}:** ${mm?.[2] || t}`)));
      i++;
    } else {
      out.push(para(runs(lines[i].trim())));
      i++;
    }
  }
  return out.join('');
}

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="22"/><w:lang w:val="ru-RU"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="200"/></w:pPr><w:rPr><w:b/><w:sz w:val="40"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="240" w:after="120"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:sz w:val="32"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="200" w:after="80"/><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/><w:sz w:val="26"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Quote"><w:name w:val="Quote"/><w:basedOn w:val="Normal"/><w:pPr><w:ind w:left="720"/></w:pPr><w:rPr><w:i/><w:color w:val="555555"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Meta"><w:name w:val="Meta"/><w:basedOn w:val="Normal"/><w:rPr><w:color w:val="555555"/><w:sz w:val="20"/></w:rPr></w:style>
</w:styles>`;

export async function docToDocx(doc, md, faction) {
  const JSZip = await loadZip();
  const media = [];
  const head = [
    doc.org || faction?.fullName ? para(runs(doc.org || faction.fullName), 'Meta') : '',
    para(runs(doc.title || ''), 'Title'),
    doc.author ? para(runs(`Автор: ${doc.author}`), 'Meta') : '',
    ...Object.entries(doc.meta || {}).map(([k, v]) => para(runs(`**${k}:** ${v}`), 'Meta')),
  ].join('');
  const first = (md || '').match(/^\s*#{1,6}\s+(.+)\n/);
  if (first && first[1].trim() === (doc.title || '').trim()) md = md.slice(first[0].length);
  const body = await bodyXml(md, media);
  const docXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"><w:body>${head}${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>`;
  const zip = new JSZip();
  const types = [...new Set(media.map((m) => m.ext))].map((e) => `<Default Extension="${e}" ContentType="image/${e}"/>`).join('');
  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>${types}<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>`);
  zip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  zip.file('word/_rels/document.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>${media.map((m) => `<Relationship Id="${m.rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${m.name}"/>`).join('')}</Relationships>`);
  zip.file('word/document.xml', docXml);
  zip.file('word/styles.xml', STYLES);
  media.forEach((m) => zip.file(`word/media/${m.name}`, m.data));
  return zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}

export function safeName(s) {
  return (s || 'документ').replace(/[\\/:*?"<>|«»]+/g, '').replace(/\s+/g, ' ').trim().slice(0, 80) || 'документ';
}

export function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

// Все документы группировки одним архивом: .docx и .md
export async function factionZip(faction, getText, onStep) {
  const JSZip = await loadZip();
  const zip = new JSZip();
  let n = 0;
  for (const d of faction.docs || []) {
    n++;
    onStep?.(`${n}/${faction.docs.length}: ${d.title}`);
    const md = await getText(d);
    const base = `${String(n).padStart(2, '0')} ${safeName(d.title)}`;
    zip.file(`md/${base}.md`, `# ${d.title}\n\n${md}`);
    zip.file(`docx/${base}.docx`, await docToDocx(d, md, faction));
  }
  return zip.generateAsync({ type: 'blob' });
}
