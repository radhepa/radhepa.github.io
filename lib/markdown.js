// Small Markdown renderer shared by the build (Node) and the editor preview (browser).
// Supports: ## headings, paragraphs, **bold**, *italic*, `code`, [links](url),
// images with captions ![alt](src "caption"), - lists, 1. lists, ``` code blocks,
// > notes, | tables |, and the inline tags <sub> <sup> <br>.
// Paths that start with "/" are made relative to the site root.

export function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function resolveUrl(url, root) {
  url = url.trim();
  if (/^\s*javascript:/i.test(url)) return '#';
  if (url.startsWith('/') && !url.startsWith('//')) return root + url.slice(1);
  return url;
}

export function renderInline(text, root = '/') {
  const codes = [];
  let s = escapeHtml(text).replace(/`([^`]+)`/g, (_, c) => {
    codes.push(`<code>${c}</code>`);
    return `\u0000${codes.length - 1}\u0000`;
  });
  s = s.replace(/&lt;(\/?)(sub|sup|br|mark|kbd)\s*\/?&gt;/gi, '<$1$2>');
  s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_, alt, src) => `<img src="${resolveUrl(src, root)}" alt="${alt}" loading="lazy">`);
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, url) => `<a href="${resolveUrl(url, root)}">${t}</a>`);
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*\w])\*([^*\s][^*]*)\*(?!\w)/g, '$1<em>$2</em>');
  s = s.replace(/(^|[^_\w])_([^_\s][^_]*)_(?!\w)/g, '$1<em>$2</em>');
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => codes[+i]);
}

const splitRow = (line) =>
  line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());

export function renderMarkdown(md, root = '/') {
  const lines = String(md ?? '').replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  const inl = (t) => renderInline(t, root);
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }

    // code block
    if (/^```/.test(line.trim())) {
      const buf = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i].trim())) buf.push(lines[i++]);
      i++;
      out.push(`<pre><code>${escapeHtml(buf.join('\n'))}</code></pre>`);
      continue;
    }

    // heading
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      const level = Math.max(2, Math.min(4, h[1].length + (h[1].length === 1 ? 1 : 0)));
      out.push(`<h${level}>${inl(h[2])}</h${level}>`);
      i++;
      continue;
    }

    // table
    if (line.trim().startsWith('|') && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1])) {
      const head = splitRow(line);
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) rows.push(splitRow(lines[i++]));
      out.push(
        `<div class="table-wrap"><table><thead><tr>${head.map((c) => `<th scope="col">${inl(c)}</th>`).join('')}</tr></thead><tbody>` +
          rows.map((r) => `<tr>${head.map((_, j) => `<td>${inl(r[j] ?? '')}</td>`).join('')}</tr>`).join('') +
          '</tbody></table></div>'
      );
      continue;
    }

    // note (blockquote)
    if (/^>/.test(line)) {
      const buf = [];
      while (i < lines.length && /^>/.test(lines[i])) buf.push(lines[i++].replace(/^>\s?/, ''));
      const paras = buf.join('\n').split(/\n\s*\n/).map((p) => `<p>${inl(p.replace(/\n/g, ' '))}</p>`);
      out.push(`<div class="note">${paras.join('')}</div>`);
      continue;
    }

    // lists
    const isUl = (l) => /^\s*[-*+]\s+/.test(l);
    const isOl = (l) => /^\s*\d+[.)]\s+/.test(l);
    if (isUl(line) || isOl(line)) {
      const ordered = isOl(line);
      const items = [];
      while (i < lines.length && lines[i].trim()) {
        const l = lines[i];
        if (ordered ? isOl(l) : isUl(l)) items.push(l.replace(ordered ? /^\s*\d+[.)]\s+/ : /^\s*[-*+]\s+/, ''));
        else if (/^\s+/.test(l) && items.length) items[items.length - 1] += ' ' + l.trim();
        else break;
        i++;
      }
      const tag = ordered ? 'ol' : 'ul';
      out.push(`<${tag}>${items.map((t) => `<li>${inl(t)}</li>`).join('')}</${tag}>`);
      continue;
    }

    // paragraph (or a figure if it is just one image)
    const buf = [];
    while (
      i < lines.length && lines[i].trim() &&
      !/^(#{1,4}\s|```|>|\s*[-*+]\s|\s*\d+[.)]\s)/.test(lines[i]) &&
      !(lines[i].trim().startsWith('|') && buf.length === 0)
    ) buf.push(lines[i++].trim());
    if (!buf.length) { buf.push(lines[i++].trim()); }
    const text = buf.join(' ');
    const fig = text.match(/^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)$/);
    if (fig) {
      out.push(
        `<figure><img src="${resolveUrl(fig[2], root)}" alt="${escapeHtml(fig[1])}" loading="lazy">` +
          (fig[3] ? `<figcaption>${inl(fig[3])}</figcaption>` : '') + '</figure>'
      );
    } else {
      out.push(`<p>${inl(text)}</p>`);
    }
  }
  return out.join('\n');
}
