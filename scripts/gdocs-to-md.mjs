// Converts a Google Docs API document (documents.get JSON) into article metadata + Markdown.
//
// Expected document shape (see the "Article template" Google Doc):
//   1. A two-column table: label | value  (Title, Web address, Language, Section, Date, Author,
//      Summary, Main photo, Photo description, Photo credit, Featured, Status)
//   2. The article text (headings, bold/italic, links, lists, photos, footnotes, quotes = indented paragraphs)
//   3. A paragraph "Sources / संदर्भ" followed by one source per line (links allowed)

import { readFileSync } from 'node:fs';

const CATEGORIES = JSON.parse(readFileSync(new URL('../src/lib/categories.json', import.meta.url), 'utf8'));

// ---------- small helpers ----------

const DEVANAGARI_DIGITS = '०१२३४५६७८९';
const toAsciiDigits = (s) => s.replace(/[०-९]/g, (d) => String(DEVANAGARI_DIGITS.indexOf(d)));
const norm = (s) =>
  toAsciiDigits(String(s ?? ''))
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, ' ')
    .trim();

/** Template placeholders are written in parentheses, e.g. "(paste photo here)". Treat them as empty. */
const cleanValue = (s) => {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim();
  return /^\(.*\)$/.test(t) ? '' : t;
};

const FIELD_LABELS = {
  title: ['title', 'शीर्षक'],
  slug: ['web address', 'slug', 'url', 'वेब पत्ता'],
  lang: ['language', 'भाषा'],
  section: ['section', 'category', 'विभाग'],
  date: ['date', 'publish date', 'तारीख', 'दिनांक'],
  author: ['author', 'लेखक'],
  summary: ['summary', 'short summary', 'description', 'सारांश'],
  image: ['main photo', 'photo', 'image', 'मुख्य फोटो'],
  imageAlt: ['photo description', 'photo caption', 'caption', 'फोटो वर्णन'],
  imageCredit: ['photo credit', 'credit', 'फोटो श्रेय'],
  featured: ['featured', 'feature on home page', 'मुख्य लेख'],
  status: ['status', 'स्थिती'],
};
const LABEL_TO_FIELD = new Map();
for (const [field, labels] of Object.entries(FIELD_LABELS)) for (const l of labels) LABEL_TO_FIELD.set(norm(l), field);

/** "Title / शीर्षक" → 'title' */
function fieldForLabel(label) {
  for (const part of String(label).split('/')) {
    const f = LABEL_TO_FIELD.get(norm(part));
    if (f) return f;
  }
  return LABEL_TO_FIELD.get(norm(label));
}

const SOURCES_HEADINGS = new Set(['sources', 'source', 'references', 'संदर्भ', 'स्रोत'].map(norm));
const isSourcesHeading = (text) => {
  const t = String(text).trim();
  if (!t || t.length > 40) return false;
  return t.split('/').every((p) => SOURCES_HEADINGS.has(norm(p.replace(/:$/, ''))));
};

export function parseSection(value) {
  const v = norm(value);
  if (!v) return undefined;
  for (const [slug, c] of Object.entries(CATEGORIES)) {
    const options = [slug, slug.replace(/-/g, ' '), c.en, c.mr].map(norm);
    if (options.includes(v) || v.split(' / ').some((p) => options.includes(norm(p)))) return slug;
  }
  // Partial match, e.g. "Ground stories / जमिनीवरच्या गोष्टी" or just "ground"
  for (const [slug, c] of Object.entries(CATEGORIES)) {
    if ([c.en, c.mr, slug].some((o) => norm(o).startsWith(v) || v.startsWith(norm(o)))) return slug;
  }
  return undefined;
}

export function parseLang(value) {
  const v = norm(value);
  return /^(mr|mar|marathi|मराठी)/.test(v) ? 'mr' : 'en';
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const pad = (n) => String(n).padStart(2, '0');
const validYmd = (y, m, d) => {
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d ? `${y}-${pad(m)}-${pad(d)}` : undefined;
};

/** Accepts 2026-11-20, 20/11/2026, 20-11-2026, 20 November 2026, Nov 20 2026, Marathi digits. Day comes first in d/m/y. */
export function parseDate(value) {
  const v = toAsciiDigits(String(value ?? '')).trim().toLowerCase();
  if (!v) return undefined;
  let m;
  if ((m = v.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/))) return validYmd(+m[1], +m[2], +m[3]);
  if ((m = v.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/))) return validYmd(+m[3], +m[2], +m[1]);
  if ((m = v.match(/^(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]+)\.?,?\s+(\d{4})/))) {
    const mi = MONTHS.indexOf(m[2].slice(0, 3));
    if (mi >= 0) return validYmd(+m[3], mi + 1, +m[1]);
  }
  if ((m = v.match(/^([a-z]+)\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})/))) {
    const mi = MONTHS.indexOf(m[1].slice(0, 3));
    if (mi >= 0) return validYmd(+m[3], mi + 1, +m[2]);
  }
  return undefined;
}

export function slugify(value) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '');
}

// ---------- Markdown building ----------

const escapeText = (s) => s.replace(/([\\`*_[\]<>~|])/g, '\\$1');
const escapeLineStart = (s) => s.replace(/^(\s*)(#{1,6}\s|>|[-+]\s|\d+[.)]\s)/, '$1\\$2');
const safeUrl = (u) => String(u).trim().replace(/[\s()<>]/g, (c) => encodeURIComponent(c));
const ORDERED_GLYPHS = new Set(['DECIMAL', 'ZERO_DECIMAL', 'UPPER_ALPHA', 'ALPHA', 'UPPER_ROMAN', 'ROMAN']);

/** Moves leading/trailing whitespace outside of a markdown wrapper. */
function wrap(text, open, close = open) {
  const m = text.match(/^(\s*)([\s\S]*?)(\s*)$/);
  if (!m[2]) return text;
  return `${m[1]}${open}${m[2]}${close}${m[3]}`;
}

export function convertDoc(doc, { imageBase = '/uploads/gdocs/x', createdTime } = {}) {
  const errors = [];
  const images = []; // { objectId, contentUri, alt }
  const imageIds = new Set();
  const footnoteOrder = []; // footnoteIds in order of first reference
  const lists = doc.lists ?? {};

  const registerImage = (objectId, embedded) => {
    const uri = embedded?.imageProperties?.contentUri;
    if (!uri) return undefined;
    if (!imageIds.has(objectId)) {
      imageIds.add(objectId);
      images.push({ objectId, contentUri: uri, alt: (embedded.description || embedded.title || '').trim() });
    }
    return `${imageBase}/${fileNameFor(objectId)}`;
  };

  const inlineImage = (id) => {
    const emb = doc.inlineObjects?.[id]?.inlineObjectProperties?.embeddedObject;
    const src = registerImage(id, emb);
    if (!src) return '';
    const alt = (emb.description || emb.title || '').replace(/[[\]\n]/g, ' ').trim();
    return `![${alt}](${src})`;
  };
  const positionedImage = (id) => {
    const emb = doc.positionedObjects?.[id]?.positionedObjectProperties?.embeddedObject;
    const src = registerImage(id, emb);
    if (!src) return '';
    const alt = (emb.description || emb.title || '').replace(/[[\]\n]/g, ' ').trim();
    return `![${alt}](${src})`;
  };

  /** Plain text of a list of paragraph elements (smart chips included). */
  const plainOf = (elements = []) =>
    elements
      .map((el) =>
        el.textRun ? el.textRun.content
        : el.person ? el.person.personProperties?.name || el.person.personProperties?.email || ''
        : el.richLink ? el.richLink.richLinkProperties?.title || el.richLink.richLinkProperties?.uri || ''
        : el.dateElement ? el.dateElement.dateElementProperties?.displayText || ''
        : '',
      )
      .join('')
      .replace(/\u000b/g, ' ')
      .replace(/\n$/, '');

  /** Inline markdown for a paragraph's elements. `plainStyles` drops bold/italic (used for headings). */
  const inlineOf = (elements = [], { plainStyles = false } = {}) => {
    // 1. Flatten into segments with a style key.
    const segs = [];
    for (const el of elements) {
      if (el.textRun) {
        const st = el.textRun.textStyle ?? {};
        const text = el.textRun.content.replace(/\n$/, '');
        if (!text) continue;
        segs.push({
          text,
          link: st.link?.url ? safeUrl(st.link.url) : undefined,
          bold: !plainStyles && !!st.bold,
          italic: !plainStyles && !!st.italic,
          strike: !!st.strikethrough,
          sup: st.baselineOffset === 'SUPERSCRIPT',
          sub: st.baselineOffset === 'SUBSCRIPT',
        });
      } else if (el.footnoteReference) {
        const id = el.footnoteReference.footnoteId;
        if (!footnoteOrder.includes(id)) footnoteOrder.push(id);
        segs.push({ raw: `[^${footnoteOrder.indexOf(id) + 1}]` });
      } else if (el.inlineObjectElement) {
        const md = inlineImage(el.inlineObjectElement.inlineObjectId);
        if (md) segs.push({ raw: `\n\n${md}\n\n` });
      } else if (el.person) {
        segs.push({ text: el.person.personProperties?.name || el.person.personProperties?.email || '' });
      } else if (el.richLink) {
        const p = el.richLink.richLinkProperties ?? {};
        segs.push({ text: p.title || p.uri || '', link: p.uri ? safeUrl(p.uri) : undefined });
      } else if (el.dateElement) {
        segs.push({ text: el.dateElement.dateElementProperties?.displayText || '' });
      }
    }

    // 2. Emit, grouping consecutive segments that share a link.
    let out = '';
    for (let i = 0; i < segs.length; ) {
      const s = segs[i];
      if (s.raw !== undefined) { out += s.raw; i++; continue; }
      const link = s.link;
      let inner = '';
      while (i < segs.length && segs[i].raw === undefined && segs[i].link === link) {
        // merge runs with the same style
        const a = segs[i];
        let text = a.text;
        i++;
        while (
          i < segs.length && segs[i].raw === undefined && segs[i].link === link &&
          segs[i].bold === a.bold && segs[i].italic === a.italic && segs[i].strike === a.strike &&
          segs[i].sup === a.sup && segs[i].sub === a.sub
        ) { text += segs[i].text; i++; }
        let md = escapeText(text).replace(/\u000b/g, '<br>');
        if (a.sup) md = wrap(md, '<sup>', '</sup>');
        if (a.sub) md = wrap(md, '<sub>', '</sub>');
        if (a.strike) md = wrap(md, '~~');
        if (a.italic) md = wrap(md, '*');
        if (a.bold) md = wrap(md, '**');
        inner += md;
      }
      out += link ? wrap(inner, '[', `](${link})`) : inner;
    }
    return out;
  };

  // ---------- walk the document ----------
  const content = doc.body?.content ?? [];
  const metaIndex = content.findIndex((el) => el.table);
  const meta = {};
  let mainImage;

  if (metaIndex === -1) {
    errors.push('The details table at the top is missing. Start from the article template.');
  } else {
    for (const row of content[metaIndex].table.tableRows ?? []) {
      const [labelCell, valueCell] = row.tableCells ?? [];
      if (!labelCell || !valueCell) continue;
      const label = (labelCell.content ?? []).map((c) => (c.paragraph ? plainOf(c.paragraph.elements) : '')).join(' ');
      const field = fieldForLabel(label);
      if (!field) continue;
      const paras = (valueCell.content ?? []).filter((c) => c.paragraph).map((c) => c.paragraph);
      if (field === 'image') {
        for (const p of paras) {
          for (const el of p.elements ?? []) {
            if (el.inlineObjectElement && !mainImage) {
              const id = el.inlineObjectElement.inlineObjectId;
              mainImage = registerImage(id, doc.inlineObjects?.[id]?.inlineObjectProperties?.embeddedObject);
            }
          }
          for (const id of p.positionedObjectIds ?? []) {
            if (!mainImage) mainImage = registerImage(id, doc.positionedObjects?.[id]?.positionedObjectProperties?.embeddedObject);
          }
        }
        continue;
      }
      meta[field] = cleanValue(paras.map((p) => plainOf(p.elements)).join(' '));
    }
  }

  // Body + sources
  const blocks = []; // { kind: 'li' | 'block', text }
  const sources = [];
  let inSources = false;
  const bodyEls = metaIndex === -1 ? content : content.slice(metaIndex + 1);

  for (const el of bodyEls) {
    if (el.table) {
      if (inSources) continue;
      const rows = (el.table.tableRows ?? []).map((r) =>
        (r.tableCells ?? []).map((c) =>
          (c.content ?? [])
            .filter((x) => x.paragraph)
            .map((x) => inlineOf(x.paragraph.elements).trim())
            .filter(Boolean)
            .join('<br>'),
        ),
      );
      if (rows.length) {
        const cols = Math.max(...rows.map((r) => r.length));
        const line = (r) => `| ${Array.from({ length: cols }, (_, i) => r[i] ?? '').join(' | ')} |`;
        blocks.push({ kind: 'block', text: [line(rows[0]), line(Array(cols).fill('---')), ...rows.slice(1).map(line)].join('\n') });
      }
      continue;
    }
    const p = el.paragraph;
    if (!p) continue;
    const plain = plainOf(p.elements).trim();

    if (!inSources && isSourcesHeading(plain)) { inSources = true; continue; }
    // Template hint lines start with ✎ and are never published.
    if (plain.startsWith('✎')) continue;
    // An empty line in the Doc ends a list, so a following list starts fresh.
    if (!inSources && !plain && !(p.elements ?? []).some((e) => e.inlineObjectElement || e.horizontalRule) && !(p.positionedObjectIds ?? []).length) {
      blocks.push({ kind: 'gap', text: '' });
      continue;
    }

    if (inSources) {
      if (!plain) continue;
      const linkEl = (p.elements ?? []).find((e) => e.textRun?.textStyle?.link?.url || e.richLink?.richLinkProperties?.uri);
      let url = linkEl?.textRun?.textStyle?.link?.url ?? linkEl?.richLink?.richLinkProperties?.uri;
      if (!url) url = plain.match(/https?:\/\/\S+/)?.[0];
      const title = plain.replace(/^[-•*\d.)\s]+/, '').trim() || url;
      sources.push(url ? { title, url } : { title });
      continue;
    }

    const style = p.paragraphStyle?.namedStyleType ?? 'NORMAL_TEXT';
    const hasHr = (p.elements ?? []).some((e) => e.horizontalRule);
    if (hasHr && !plain) { blocks.push({ kind: 'block', text: '---' }); continue; }

    const positioned = (p.positionedObjectIds ?? []).map(positionedImage).filter(Boolean);

    if (/^HEADING_|^TITLE$|^SUBTITLE$/.test(style)) {
      const text = inlineOf(p.elements, { plainStyles: true }).replace(/\s+/g, ' ').trim();
      if (text) {
        const level = style === 'HEADING_1' || style === 'HEADING_2' || style === 'TITLE' ? 2
          : style === 'HEADING_3' || style === 'SUBTITLE' ? 3 : 4;
        blocks.push({ kind: 'block', text: `${'#'.repeat(level)} ${text}` });
      }
    } else if (p.bullet) {
      const level = p.bullet.nestingLevel ?? 0;
      const glyph = lists[p.bullet.listId]?.listProperties?.nestingLevels?.[level]?.glyphType;
      const marker = ORDERED_GLYPHS.has(glyph) ? '1.' : '-';
      const text = inlineOf(p.elements).trim();
      if (text) blocks.push({ kind: 'li', text: `${'   '.repeat(level)}${marker} ${text}` });
    } else {
      let text = inlineOf(p.elements).trim();
      if (text) {
        text = escapeLineStart(text);
        const indent = p.paragraphStyle?.indentStart?.magnitude ?? 0;
        if (indent >= 18) text = text.split('\n').map((l) => (l.trim() ? `> ${l}` : '>')).join('\n');
        blocks.push({ kind: 'block', text });
      }
    }
    for (const img of positioned) blocks.push({ kind: 'block', text: img });
  }

  let body = '';
  let prev;
  for (const b of blocks) {
    if (b.kind === 'gap') { prev = b; continue; }
    if (body) body += b.kind === 'li' && prev?.kind === 'li' ? '\n' : '\n\n';
    body += b.text;
    prev = b;
  }

  // Footnotes
  if (footnoteOrder.length) {
    const defs = footnoteOrder.map((id, i) => {
      const fn = doc.footnotes?.[id];
      const text = (fn?.content ?? [])
        .filter((c) => c.paragraph)
        .map((c) => inlineOf(c.paragraph.elements).trim())
        .filter(Boolean)
        .join(' ');
      return `[^${i + 1}]: ${text || ' '}`;
    });
    body += `\n\n${defs.join('\n')}`;
  }
  body = body.replace(/\n{3,}/g, '\n\n').trim() + '\n';

  // ---------- metadata ----------
  const status = /^(publish|published|live|yes|प्रकाशित|प्रकाशन)/i.test(norm(meta.status)) ? 'publish' : 'draft';
  const title = meta.title || '';
  const lang = parseLang(meta.lang);
  const category = parseSection(meta.section);
  const slug = slugify(meta.slug) || (slugify(title).length >= 3 ? slugify(title) : '');
  const date = parseDate(meta.date) ?? (createdTime ? String(createdTime).slice(0, 10) : undefined);

  if (!title) errors.push('Title is empty.');
  if (!category) {
    errors.push(
      meta.section
        ? `Section "${meta.section}" is not one of: ${Object.values(CATEGORIES).map((c) => c.en).join(', ')}.`
        : 'Section is empty.',
    );
  }
  if (!slug) errors.push('Web address is empty. Write a few English words, e.g. farmers-protest-explained.');
  if (!date) errors.push('Date could not be read. Use a format like 20/11/2026.');
  if (!body.trim()) errors.push('The article text is empty.');

  return {
    status,
    errors,
    images,
    article: {
      title,
      slug,
      description: meta.summary || '',
      date,
      author: meta.author || (lang === 'mr' ? 'मिथिला मनोहर राऊत' : 'Mithila Manohar Raut'),
      category,
      lang,
      image: mainImage,
      imageAlt: meta.imageAlt || '',
      imageCredit: meta.imageCredit || undefined,
      featured: /^(yes|y|true|हो|होय)/i.test(norm(meta.featured)),
      sources,
    },
    body,
  };
}

/** Deterministic file name for an embedded image id like "kix.abc123". */
export function fileNameFor(objectId) {
  return `${String(objectId).replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '')}.jpg`;
}

/** Serialises frontmatter as YAML using JSON-style quoted strings (always valid YAML). */
export function toFrontmatter(data) {
  const lines = ['---'];
  const q = (v) => JSON.stringify(String(v));
  for (const [k, v] of Object.entries(data)) {
    if (v === undefined || v === null || v === '') continue;
    if (Array.isArray(v)) {
      if (!v.length) continue;
      lines.push(`${k}:`);
      for (const item of v) {
        const entries = Object.entries(item).filter(([, x]) => x !== undefined && x !== '');
        entries.forEach(([ik, iv], i) => lines.push(`${i === 0 ? '  - ' : '    '}${ik}: ${q(iv)}`));
      }
    } else if (typeof v === 'boolean') {
      lines.push(`${k}: ${v}`);
    } else {
      lines.push(`${k}: ${q(v)}`);
    }
  }
  lines.push('---');
  return lines.join('\n');
}
