// Site editor: forms over content/*.json. Saving writes the files and rebuilds the site.
import { renderMarkdown } from './markdown.js';

const state = { content: {}, saved: {}, categories: {}, art: [], tab: 'profile' };
const FILES = ['site', 'about', 'projects', 'posts', 'awards', 'courses'];

// ---------------------------------------------------------------- helpers
function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid);
  return el;
}
const slugify = (s) =>
  String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'untitled';
const today = () => new Date().toLocaleDateString('en-CA');
let uid = 0;
const nextId = () => 'f' + ++uid;

function toast(msg, isErr = false, linkHref = '', linkText = '') {
  const t = document.getElementById('toast');
  t.replaceChildren(msg, linkHref ? ' ' : '', linkHref ? h('a', { href: linkHref, target: '_blank', rel: 'noopener', text: linkText }) : '');
  t.className = 'toast' + (isErr ? ' err' : '');
  t.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => (t.hidden = true), isErr ? 9000 : 5000);
}

const dirtyFiles = () => FILES.filter((f) => JSON.stringify(state.content[f]) !== state.saved[f]);

function refreshDirty() {
  const dirty = dirtyFiles();
  const btn = document.getElementById('save');
  btn.disabled = dirty.length === 0;
  const status = document.getElementById('status');
  status.textContent = dirty.length ? 'Unsaved changes' : 'All changes saved';
  status.classList.toggle('dirty', dirty.length > 0);
  document.querySelectorAll('#tabs button[data-file]').forEach((b) => {
    const files = b.dataset.file.split(',');
    b.querySelector('.dot').hidden = !files.some((f) => dirty.includes(f));
  });
}

async function upload(file) {
  const res = await fetch('/api/upload', {
    method: 'POST',
    headers: { 'X-Filename': encodeURIComponent(file.name) },
    body: file,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Upload failed');
  return data.path;
}

function pickFile(accept) {
  return new Promise((resolve) => {
    const input = h('input', { type: 'file', accept });
    input.addEventListener('change', () => resolve(input.files[0] || null));
    input.click();
  });
}

// ---------------------------------------------------------------- form builder
// A schema is a list of fields: { key, label, type, help, options, fields, showIf, live, ... }
function renderFields(container, fields, obj, ctx = {}) {
  container.replaceChildren();
  const rerender = () => renderFields(container, fields, obj, ctx);
  for (const f of fields) {
    if (f.showIf && !f.showIf(obj, ctx)) continue;
    container.append(renderField(f, obj, ctx, rerender));
  }
}

function changed(f, rerender, ctx) {
  refreshDirty();
  ctx.onChange?.();
  if (f.live) rerender();
}

function renderField(f, obj, ctx, rerender) {
  const id = nextId();
  const help = f.help ? h('span', { class: 'help', id: id + '-h', text: f.help }) : null;
  const label = typeof f.label === 'function' ? f.label(obj, ctx) : f.label;
  const set = (v) => { obj[f.key] = v; changed(f, rerender, ctx); };

  switch (f.type) {
    case 'group': {
      const box = h('section', { class: 'group' }, h('h2', { text: label }), f.help ? h('p', { class: 'ghelp', text: f.help }) : null);
      const inner = h('div');
      renderFields(inner, f.fields, obj, ctx);
      box.append(inner);
      return box;
    }
    case 'row': {
      const row = h('div', { class: 'row2' });
      for (const sub of f.fields) if (!sub.showIf || sub.showIf(obj, ctx)) row.append(renderField(sub, obj, ctx, rerender));
      return row;
    }
    case 'checkbox':
      return h('div', { class: 'field check' },
        h('input', { type: 'checkbox', id, checked: !!obj[f.key], onchange: (e) => set(e.target.checked) }),
        h('div', {}, h('label', { for: id, text: label }), help));
    case 'select': {
      const opts = typeof f.options === 'function' ? f.options(obj, ctx) : f.options;
      const sel = h('select', { id, 'aria-describedby': help ? id + '-h' : null, onchange: (e) => set(e.target.value) },
        opts.map(([v, l]) => h('option', { value: v, selected: String(obj[f.key] ?? '') === v, text: l })));
      return h('div', { class: 'field' }, h('label', { for: id, text: label }), sel, help);
    }
    case 'textarea':
    case 'lines':
      return h('div', { class: 'field' }, h('label', { for: id, text: label }),
        h('textarea', { id, rows: f.rows || 3, placeholder: f.placeholder, 'aria-describedby': help ? id + '-h' : null,
          oninput: (e) => set(e.target.value) }, obj[f.key] ?? ''), help);
    case 'markdown':
      return markdownField(f, obj, ctx, rerender, id, label, help);
    case 'image':
    case 'file':
      return mediaField(f, obj, ctx, rerender, id, label, help);
    case 'list':
      return listField(f, obj, ctx);
    default: {
      const input = h('input', { type: f.type || 'text', id, value: obj[f.key] ?? '', placeholder: f.placeholder,
        'aria-describedby': help ? id + '-h' : null, oninput: (e) => set(e.target.value) });
      return h('div', { class: 'field' }, h('label', { for: id, text: label }), input, help);
    }
  }
}

function markdownField(f, obj, ctx, rerender, id, label, help) {
  const ta = h('textarea', { id, class: 'md', rows: f.rows || 16, 'aria-describedby': help ? id + '-h' : null,
    oninput: () => { obj[f.key] = ta.value; changed(f, rerender, ctx); if (!preview.hidden) drawPreview(); } }, obj[f.key] ?? '');
  const preview = h('div', { class: 'md-preview prose', hidden: true });
  const drawPreview = () => { preview.innerHTML = renderMarkdown(ta.value, '/'); };

  const wrap = (before, after = before, placeholder = 'text') => () => {
    const { selectionStart: s, selectionEnd: e, value } = ta;
    const sel = value.slice(s, e) || placeholder;
    ta.setRangeText(before + sel + after, s, e, 'end');
    ta.focus();
    ta.dispatchEvent(new Event('input'));
  };
  const linePrefix = (prefix) => () => {
    const { selectionStart: s, value } = ta;
    const lineStart = value.lastIndexOf('\n', s - 1) + 1;
    ta.setRangeText(prefix, lineStart, lineStart, 'end');
    ta.focus();
    ta.dispatchEvent(new Event('input'));
  };
  const insert = (text) => {
    const { selectionStart: s, selectionEnd: e } = ta;
    ta.setRangeText(text, s, e, 'end');
    ta.focus();
    ta.dispatchEvent(new Event('input'));
  };
  const btn = (text, title, fn) => h('button', { type: 'button', class: 'abtn small', title, 'aria-label': title, onclick: fn, text });
  const toggle = btn('Preview', 'Show how it will look', () => {
    preview.hidden = !preview.hidden;
    ta.hidden = !preview.hidden;
    toggle.textContent = preview.hidden ? 'Preview' : 'Edit';
    if (!preview.hidden) drawPreview();
  });

  const tools = h('div', { class: 'md-tools' },
    btn('B', 'Bold', wrap('**')),
    btn('I', 'Italic', wrap('*')),
    btn('Heading', 'Section heading', linePrefix('## ')),
    btn('• List', 'Bulleted list', linePrefix('- ')),
    btn('Link', 'Link', () => {
      const url = prompt('Link address (https://… or /projects/…)');
      if (url) wrap('[', `](${url})`, 'link text')();
    }),
    btn('Image', 'Upload and insert an image', async () => {
      const file = await pickFile('image/*');
      if (!file) return;
      try {
        const path = await upload(file);
        insert(`\n\n![Describe the image](/${path} "Fig. · Caption")\n\n`);
        toast('Image uploaded and inserted. Edit the description and caption.');
      } catch (e) { toast(e.message, true); }
    }),
    btn('Table', 'Insert a table', () => insert('\n\n| Column | Column |\n| --- | --- |\n| Value | Value |\n\n')),
    btn('Note', 'Highlighted note box', linePrefix('> **Note:** ')),
    btn('Code', 'Code block', wrap('\n```\n', '\n```\n', 'code here')),
    h('span', { class: 'sep' }),
    toggle);

  return h('div', { class: 'field' }, h('label', { for: id, text: label }), tools, ta, preview,
    help || h('span', { class: 'help' }, 'Formatting help is in the ', h('a', { href: '#help', onclick: (e) => { e.preventDefault(); go('help'); }, text: 'Help' }), ' tab.'));
}

function mediaField(f, obj, ctx, rerender, id, label, help) {
  const isImage = f.type === 'image';
  const box = h('div', { class: 'field' });
  const draw = () => {
    const path = obj[f.key];
    box.replaceChildren(
      h('span', { class: 'flabel', id, text: label }),
      h('div', { class: 'media' },
        isImage ? (path ? h('img', { src: '/' + path, alt: '' }) : h('span', { class: 'none', text: 'No image' })) : null,
        h('div', { style: 'display:flex;flex-direction:column;gap:6px' },
          path ? h('span', { class: 'path', text: path }) : (!isImage ? h('span', { class: 'path', text: 'No file' }) : null),
          h('div', { style: 'display:flex;gap:6px;flex-wrap:wrap' },
            h('button', { type: 'button', class: 'abtn small', 'aria-describedby': id, onclick: async () => {
              const file = await pickFile(isImage ? 'image/*' : '.pdf,application/pdf');
              if (!file) return;
              try {
                obj[f.key] = await upload(file);
                changed(f, rerender, ctx);
                draw();
              } catch (e) { toast(e.message, true); }
            }, text: path ? 'Replace…' : 'Upload…' }),
            path && !isImage ? h('a', { class: 'abtn small', href: '/' + path, target: '_blank', rel: 'noopener', text: 'Open' }) : null,
            path && !f.required ? h('button', { type: 'button', class: 'abtn small danger', onclick: () => { obj[f.key] = ''; changed(f, rerender, ctx); draw(); }, text: 'Remove' }) : null))),
      help);
  };
  draw();
  return box;
}

function listField(f, obj, ctx) {
  if (!Array.isArray(obj[f.key])) obj[f.key] = [];
  const arr = obj[f.key];
  const wrap = h('div', { class: 'list' + (f.compact ? ' compact' : '') });
  const openSet = new Set();

  const draw = (focusIndex = -1) => {
    wrap.replaceChildren();
    if (f.label) wrap.append(h('span', { class: 'list-label', text: f.label }));
    if (f.help) wrap.append(h('span', { class: 'help', text: f.help }));
    const order = arr.map((_, i) => i);
    if (f.newestFirst) order.reverse();
    for (const i of order) {
      const item = arr[i];
      const titleEl = h('span', { class: 'sum-title' });
      const metaEl = h('span', { class: 'sum-meta' });
      const badgeEl = h('span', { class: 'badge', hidden: true });
      const updateSummary = () => {
        titleEl.textContent = (f.itemTitle ? f.itemTitle(item, i) : item.title || item.name || item.label) || '(untitled)';
        metaEl.textContent = f.itemMeta ? f.itemMeta(item, i) : '';
        const badge = f.itemBadge ? f.itemBadge(item) : '';
        badgeEl.textContent = badge;
        badgeEl.hidden = !badge;
      };
      updateSummary();
      const move = (d) => (e) => {
        e.preventDefault();
        const j = i + d;
        if (j < 0 || j >= arr.length) return;
        [arr[i], arr[j]] = [arr[j], arr[i]];
        refreshDirty();
        draw();
      };
      const del = (e) => {
        e.preventDefault();
        const what = titleEl.textContent;
        if (!confirm(`Delete “${what}”? You can still undo by not saving (reload the page).`)) return;
        arr.splice(i, 1);
        refreshDirty();
        draw();
      };
      const body = h('div', { class: 'item-body' });
      const details = h('details', { class: 'item', open: openSet.has(item) || i === focusIndex || null },
        h('summary', {}, titleEl, badgeEl, metaEl,
          h('span', { class: 'ctrl' },
            f.sortable !== false ? h('button', { type: 'button', class: 'abtn small icon', title: 'Move up', 'aria-label': 'Move up', onclick: move(-1), text: '↑' }) : null,
            f.sortable !== false ? h('button', { type: 'button', class: 'abtn small icon', title: 'Move down', 'aria-label': 'Move down', onclick: move(1), text: '↓' }) : null,
            h('button', { type: 'button', class: 'abtn small icon danger', title: 'Delete', 'aria-label': 'Delete', onclick: del, text: '✕' }))),
        body);
      const fill = () => renderFields(body, f.fields, item, { ...ctx, parent: obj, onChange: () => { updateSummary(); ctx.onChange?.(); } });
      details.addEventListener('toggle', () => {
        if (details.open) { openSet.add(item); if (!body.childElementCount) fill(); }
        else openSet.delete(item);
      });
      if (details.open) fill();
      wrap.append(details);
      if (i === focusIndex) setTimeout(() => { details.scrollIntoView({ block: 'center', behavior: 'smooth' }); body.querySelector('input,textarea,select')?.focus(); }, 30);
    }
    wrap.append(h('button', { type: 'button', class: 'abtn small list-add', onclick: () => {
      const item = f.newItem ? f.newItem(arr, ctx) : {};
      arr.push(item);
      openSet.add(item);
      refreshDirty();
      draw(arr.length - 1);
    }, text: '+ ' + (f.addLabel || 'Add') }));
  };
  draw();
  return wrap;
}

// ---------------------------------------------------------------- schemas
const pairs = (key, label, extra = []) => ({
  key, label, type: 'list', compact: true, addLabel: 'Add row',
  itemTitle: (it) => [it.label, it.value].filter(Boolean).join(': '),
  newItem: () => ({ label: '', value: '' }),
  fields: [{ type: 'row', fields: [{ key: 'label', label: 'Label' }, { key: 'value', label: 'Value' }] }, ...extra],
});

const PROFILE = [
  { type: 'group', label: 'You', fields: [
    { type: 'row', fields: [
      { key: 'name', label: 'Your name' },
      { key: 'eyebrow', label: 'Line above your name', help: 'Example: Electrical Engineering · Purdue' },
    ] },
    { key: 'intro', label: 'Short intro on the home page', type: 'textarea', rows: 3, help: 'One or two sentences.' },
    { type: 'row', fields: [
      { key: 'photo', label: 'Photo', type: 'image', help: 'A square photo works best.' },
      { key: 'resume', label: 'Résumé', type: 'file', help: 'PDF. The Résumé buttons link to it.' },
    ] },
    { key: 'location', label: 'Location (in the footer)' },
  ] },
  { type: 'group', label: 'Contact', help: 'Leave one empty to hide it.', fields: [
    { type: 'row', fields: [
      { key: 'email', label: 'Email', type: 'email' },
      { key: 'github', label: 'GitHub link', type: 'url', placeholder: 'https://github.com/…' },
    ] },
    { key: 'linkedin', label: 'LinkedIn link', type: 'url', placeholder: 'https://www.linkedin.com/in/…' },
  ] },
  { type: 'group', label: 'Home page', fields: [
    { ...pairs('specs', 'Specifications card', [{ key: 'highlight', label: 'Show in blue', type: 'checkbox' }]),
      help: 'The black-topped card next to your name.' },
    { type: 'row', fields: [
      { key: 'featuredHeading', label: 'Heading for featured project cards', help: 'Pick which projects appear in the Projects tab.' },
      { key: 'listHeading', label: 'Heading for the project list' },
    ] },
    { type: 'row', fields: [
      { key: 'nowLabel', label: '“Now” small label', help: 'Example: Now · Fall 2026' },
      { key: 'nowHeading', label: '“Now” heading' },
    ] },
    { key: 'now', label: '“Now” items', type: 'list', compact: true, addLabel: 'Add item',
      newItem: () => ({ name: '', text: '' }),
      fields: [{ key: 'name', label: 'Name' }, { key: 'text', label: 'One line about it' }] },
    { type: 'row', fields: [
      { key: 'ctaLabel', label: 'Dark banner small label' },
      { key: 'ctaHeading', label: 'Dark banner heading', help: 'Leave empty to hide the banner.' },
    ] },
  ] },
  { type: 'group', label: 'Search engines and domain', fields: [
    { key: 'description', label: 'Site description', type: 'textarea', rows: 2, help: 'Shown under your name in Google results and link previews.' },
    { key: 'domain', label: 'Your domain', placeholder: 'yourname.me', help: 'Fill this in once you own the domain. Without https://.' },
  ] },
];

const ABOUT = [
  { type: 'group', label: 'Bio', fields: [
    { key: 'bio', label: 'About you', type: 'markdown', rows: 12, help: 'Leave an empty line between paragraphs.' },
  ] },
  { type: 'group', label: 'Experience', fields: [
    { key: 'experience', type: 'list', addLabel: 'Add a job or role',
      itemMeta: (it) => it.when || '',
      newItem: () => ({ when: '', title: '', description: '', current: false }),
      fields: [
        { type: 'row', fields: [{ key: 'title', label: 'Role and organization' }, { key: 'when', label: 'When', placeholder: 'May 2026 – Aug 2026' }] },
        { key: 'description', label: 'Description', type: 'textarea', rows: 2 },
        { key: 'current', label: 'Show the date in blue (current or upcoming)', type: 'checkbox' },
      ] },
  ] },
  { type: 'group', label: 'Teams', fields: [
    { key: 'teamsHeading', label: 'Heading' },
    { key: 'teams', type: 'list', compact: true, addLabel: 'Add a team',
      itemMeta: (it) => it.role || '',
      newItem: () => ({ name: '', role: '' }),
      fields: [{ type: 'row', fields: [{ key: 'name', label: 'Team' }, { key: 'role', label: 'Your role' }] }] },
  ] },
  { type: 'group', label: 'Tools', fields: [
    { key: 'tools', label: 'Tools and skills', type: 'lines', rows: 8, help: 'One per line.' },
  ] },
];

const homeOptions = [['none', 'Not on the home page'], ['featured', 'Featured card (big, with a drawing)'], ['list', 'In the “in progress” list']];

const PROJECT_FIELDS = [
  { key: 'title', label: 'Project name' },
  { type: 'row', fields: [
    { key: 'category', label: 'Category', type: 'select', options: () => Object.entries(state.categories) },
    { key: 'status', label: 'Status', type: 'select', options: [['built', 'Built'], ['progress', 'In progress']] },
  ] },
  { type: 'row', fields: [
    { key: 'area', label: 'Area', help: 'Short label, e.g. Power electronics' },
    { key: 'repo', label: 'GitHub link (optional)', type: 'url', placeholder: 'https://github.com/…' },
  ] },
  { key: 'description', label: 'One-sentence description', type: 'textarea', rows: 2 },
  { type: 'row', fields: [
    { key: 'home', label: 'Home page', type: 'select', options: homeOptions, live: true },
    { key: 'cardArt', label: 'Card drawing', type: 'select', showIf: (p) => p.home === 'featured',
      options: () => [['none', 'None'], ...state.art.map((a) => [a, a[0].toUpperCase() + a.slice(1)])] },
  ] },
  { key: 'cardImage', label: 'Card photo (optional, replaces the drawing)', type: 'image', showIf: (p) => p.home === 'featured' },
  { key: 'hasCaseStudy', label: 'Give this project its own page (a case study)', type: 'checkbox', live: true,
    help: 'Without a page, the project links to its GitHub repo if it has one.' },
  { type: 'group', label: 'Case study page', showIf: (p) => p.hasCaseStudy, fields: [
    { key: 'summary', label: 'Summary at the top', type: 'textarea', rows: 3 },
    pairs('specs', 'Specifications card'),
    { key: 'heroImage', label: 'Big image under the title', type: 'image' },
    { type: 'row', fields: [
      { key: 'heroAlt', label: 'Image description (for screen readers)' },
      { key: 'heroCaption', label: 'Caption' },
    ] },
    { key: 'sections', label: 'Sections', type: 'list', addLabel: 'Add a section',
      newItem: () => ({ title: 'New section', body: '' }),
      fields: [{ key: 'title', label: 'Section title' }, { key: 'body', label: 'Text', type: 'markdown' }] },
  ] },
  { key: 'slug', label: 'Page address', help: 'The /projects/… part of the link. Filled in from the name when you first save; changing it later breaks old links.',
    showIf: (p) => p.hasCaseStudy },
];

const PROJECTS = [
  { key: '__list', type: 'list', addLabel: 'Add a project', fields: PROJECT_FIELDS,
    itemMeta: (p) => `${state.categories[p.category] || ''} · ${p.status === 'built' ? 'Built' : 'In progress'}`,
    itemBadge: (p) => (p.home === 'featured' ? 'Home card' : p.home === 'list' ? 'Home list' : ''),
    newItem: () => ({
      slug: '', title: '', category: 'hw', status: 'progress', area: '', description: '', repo: '',
      home: 'none', cardArt: 'none', cardImage: '', hasCaseStudy: false, summary: '', specs: [],
      heroImage: '', heroAlt: '', heroCaption: '',
      sections: [
        { title: 'Overview', body: '' }, { title: 'How it works', body: '' }, { title: 'Design decisions', body: '' },
        { title: 'Testing', body: '' }, { title: "What I'd change", body: '' },
      ],
    }) },
];

const POST_FIELDS = [
  { key: 'title', label: 'Title' },
  { key: 'draft', label: 'Draft: keep this entry hidden from the site', type: 'checkbox' },
  { type: 'row', fields: [
    { key: 'date', label: 'Date', type: 'date' },
    { key: 'number', label: 'Entry number', placeholder: '004' },
  ] },
  { type: 'row', fields: [
    { key: 'project', label: 'Project', type: 'select',
      options: () => [['', 'No project'], ...state.content.projects.map((p) => [p.slug || slugify(p.title), p.title || '(untitled)'])] },
    { key: 'tags', label: 'Tags', help: 'Separate with commas.' },
  ] },
  { key: 'summary', label: 'One-sentence summary', type: 'textarea', rows: 2 },
  { key: 'body', label: 'Entry', type: 'markdown', rows: 22 },
  { key: 'slug', label: 'Page address', help: 'The /notebook/… part of the link. Filled in from the title when you first save.' },
];

const POSTS = [
  { key: '__list', type: 'list', addLabel: 'Write a new entry', newestFirst: true, sortable: false, fields: POST_FIELDS,
    itemTitle: (p) => `${p.number ? 'Entry ' + p.number + ' · ' : ''}${p.title || '(untitled)'}`,
    itemMeta: (p) => p.date || '',
    itemBadge: (p) => (p.draft ? 'Draft' : ''),
    newItem: (arr) => ({
      number: String(Math.max(0, ...arr.map((p) => parseInt(p.number, 10) || 0)) + 1).padStart(3, '0'),
      slug: '', title: '', date: today(), project: '', tags: '', summary: '', draft: true,
      body: '## Goal\n\n\n\n## How it works\n\n\n\n## What went wrong\n\n\n\n## Next\n\n',
    }) },
];

const ITEM_FIELDS = [
  { type: 'row', fields: [
    { key: 'title', label: 'Title' },
    { key: 'kicker', label: (it, ctx) => (ctx.parent.layout === 'timeline' ? 'Date' : 'Small label'),
      help: 'Date, course code or issuer.' },
  ] },
  { key: 'description', label: 'Description (optional)', type: 'textarea', rows: 2, showIf: (it, ctx) => ctx.parent.layout !== 'list' },
  { key: 'highlight', label: 'Show the date in blue', type: 'checkbox', showIf: (it, ctx) => ctx.parent.layout === 'timeline' },
  { key: 'style', label: 'Card style', type: 'select', showIf: (it, ctx) => ctx.parent.layout === 'cards',
    options: [['normal', 'Normal'], ['dashed', 'Dashed outline (planned)'], ['pending', 'Orange outline (in progress)']] },
  { key: 'status', label: 'Status', type: 'select', showIf: (it, ctx) => ctx.parent.layout === 'list',
    options: [['', 'None'], ['done', 'Completed'], ['progress', 'In progress']] },
  { type: 'row', fields: [
    { key: 'link', label: 'Link (optional)', placeholder: 'https://… or /projects/…' },
    { key: 'linkText', label: 'Link text', placeholder: 'Related: … →', showIf: (it, ctx) => ctx.parent.layout !== 'list' },
  ] },
];

const sectionPage = (what) => [
  { type: 'group', label: 'Page heading', fields: [
    { type: 'row', fields: [{ key: 'title', label: 'Title' }, { key: 'eyebrow', label: 'Small label above the title' }] },
    { key: 'intro', label: 'Intro (optional)', type: 'textarea', rows: 2 },
    { ...pairs('stats', 'Stat boxes (optional)'), help: 'Small boxes on the right, like GPA.' },
  ] },
  { type: 'group', label: 'Sections', help: `Each section is a heading on the left with its ${what} on the right.`, fields: [
    { key: 'sections', type: 'list', addLabel: 'Add a section',
      itemTitle: (s) => s.heading,
      itemMeta: (s) => ({ timeline: 'Timeline', cards: 'Cards', list: 'List' })[s.layout] || '',
      newItem: () => ({ heading: 'New section', note: '', state: '', layout: 'cards', items: [] }),
      fields: [
        { type: 'row', fields: [
          { key: 'heading', label: 'Heading' },
          { key: 'note', label: 'Small note under the heading', placeholder: 'Current' },
        ] },
        { type: 'row', fields: [
          { key: 'layout', label: 'Layout', type: 'select', live: true,
            options: [['timeline', 'Timeline (date + title)'], ['cards', 'Cards'], ['list', 'Simple list with status']] },
          { key: 'state', label: 'Note color', type: 'select', options: [['', 'Grey'], ['current', 'Blue (current)'], ['planned', 'Orange (planned)']] },
        ] },
        { key: 'items', label: 'Items', type: 'list', compact: true, addLabel: 'Add item', fields: ITEM_FIELDS,
          itemMeta: (it) => it.kicker || '',
          newItem: () => ({ kicker: '', title: '', description: '', highlight: false, status: '', style: 'normal', link: '', linkText: '' }) },
      ] },
  ] },
];

// ---------------------------------------------------------------- tabs
const TABS = [
  { id: 'profile', label: 'Profile & home', file: 'site', title: 'Profile and home page',
    lead: 'Your name, photo, résumé, contact links and the home page.', schema: PROFILE, view: '/' },
  { id: 'about', label: 'About', file: 'about', title: 'About page', lead: 'Your bio, experience, teams and tools.', schema: ABOUT, view: '/about/' },
  { id: 'projects', label: 'Projects', file: 'projects', title: 'Projects',
    lead: 'Add, edit, reorder or delete projects. The order here is the order on the site. Open a project to edit it.', schema: PROJECTS, list: true, view: '/projects/' },
  { id: 'notebook', label: 'Lab notebook', file: 'posts', title: 'Lab notebook',
    lead: 'Write blog entries. New entries start as drafts; untick “Draft” when it is ready to go on the site.', schema: POSTS, list: true, view: '/notebook/' },
  { id: 'awards', label: 'Awards', file: 'awards', title: 'Awards page', lead: 'Programs, competitions, certifications, leadership.', schema: sectionPage('items'), view: '/awards/' },
  { id: 'courses', label: 'Courses', file: 'courses', title: 'Courses page', lead: 'Semesters and courses.', schema: sectionPage('courses'), view: '/courses/' },
  { sep: true },
  { id: 'publish', label: 'Publish', title: 'Publish to the web' },
  { id: 'help', label: 'Help', title: 'Help' },
];

function drawTabs() {
  const nav = document.getElementById('tabs');
  nav.replaceChildren(...TABS.map((t) => t.sep ? h('hr') :
    h('button', { type: 'button', 'data-file': t.file || null, 'aria-current': String(state.tab === t.id), onclick: () => go(t.id) },
      t.label, h('span', { class: 'dot', hidden: true, 'aria-label': 'unsaved' }))));
  refreshDirty();
}

function go(id) {
  state.tab = id;
  history.replaceState(null, '', '#' + id);
  drawTabs();
  const t = TABS.find((x) => x.id === id) || TABS[0];
  const panel = document.getElementById('panel');
  panel.replaceChildren(h('h1', { text: t.title }));
  document.getElementById('view-link').href = t.view || '/';
  if (t.id === 'publish') return drawPublish(panel);
  if (t.id === 'help') return drawHelp(panel);
  panel.append(h('p', { class: 'lead' }, t.lead, ' ', h('a', { href: t.view, target: '_blank', rel: 'noopener', text: 'See this page ↗' })));
  const box = h('div');
  panel.append(box);
  if (t.list) renderFields(box, t.schema, { __list: state.content[t.file] }, {});
  else renderFields(box, t.schema, state.content[t.file], {});
  panel.focus({ preventScroll: true });
  window.scrollTo(0, 0);
}

// ---------------------------------------------------------------- save
function fillSlugs(items, key) {
  const seen = new Set();
  for (const it of items) {
    let s = it.slug ? slugify(it.slug) : slugify(it[key]);
    const base = s;
    let n = 2;
    while (seen.has(s)) s = `${base}-${n++}`;
    seen.add(s);
    it.slug = s;
  }
}

async function save() {
  const files = dirtyFiles();
  if (!files.length) return;
  if (files.includes('projects')) {
    const before = state.content.projects.map((p) => p.slug);
    fillSlugs(state.content.projects, 'title');
    // keep notebook links pointing at a project that just got its address
    state.content.projects.forEach((p, i) => {
      if (!before[i]) state.content.posts.forEach((e) => { if (e.project === slugify(p.title)) e.project = p.slug; });
    });
  }
  if (files.includes('posts') || files.includes('projects')) fillSlugs(state.content.posts, 'title');
  const btn = document.getElementById('save');
  btn.disabled = true;
  btn.textContent = 'Saving…';
  let last = null;
  try {
    for (const f of dirtyFiles()) {
      const res = await fetch('/api/content/' + f, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(state.content[f]),
      });
      last = await res.json();
      if (!res.ok || last.ok === false) throw new Error(last.error || 'Save failed');
      state.saved[f] = JSON.stringify(state.content[f]);
    }
    const t = TABS.find((x) => x.id === state.tab);
    toast(`Saved. The site was rebuilt (${last.pages} pages).` + (last.warnings?.length ? ' ' + last.warnings.join('; ') : ''),
      !!last.warnings?.length, t?.view || '/', 'View it ↗');
  } catch (e) {
    toast('Could not save: ' + e.message, true);
  } finally {
    btn.textContent = 'Save changes';
    refreshDirty();
    if (state.tab !== 'publish' && state.tab !== 'help') {
      const y = window.scrollY;
      const openTitles = [...document.querySelectorAll('.item[open] > summary .sum-title')].map((e) => e.textContent);
      go(state.tab);
      document.querySelectorAll('.item > summary .sum-title').forEach((el) => {
        if (openTitles.includes(el.textContent)) el.closest('details').open = true;
      });
      window.scrollTo(0, y);
    }
  }
}

// ---------------------------------------------------------------- publish
async function drawPublish(panel) {
  const body = h('div', { class: 'group' }, h('p', { text: 'Checking…' }));
  panel.append(h('p', { class: 'lead', text: 'Your edits are saved on this computer and show up in the preview right away. Publishing sends them to the live website.' }), body);
  let st;
  try {
    st = await (await fetch('/api/status')).json();
  } catch {
    body.replaceChildren(h('p', { text: 'Could not reach the editor server.' }));
    return;
  }
  if (dirtyFiles().length) {
    panel.insertBefore(h('div', { class: 'notice', text: 'You have unsaved changes. Save them first, or they will not be published.' }), body);
  }
  if (!st.repo || !st.remote) {
    body.replaceChildren(
      h('h2', { text: 'One-time setup needed' }),
      h('p', { class: 'ghelp', text: 'Publishing uses a free GitHub repository and GitHub Pages. This only has to be done once:' }),
      h('ol', { style: 'margin:12px 0 0;padding-left:1.3em;display:flex;flex-direction:column;gap:8px;line-height:1.55' },
        h('li', {}, 'Create an empty repository on GitHub (for example ', h('code', { text: 'portfolio' }), ').'),
        h('li', {}, 'Connect this folder to it and turn on GitHub Pages: the steps are in ', h('code', { text: 'README.md' }), '.'),
        h('li', { text: 'Come back here: the Publish button will appear.' })));
    return;
  }
  const msg = h('input', { type: 'text', id: 'pubmsg', value: 'Update site', placeholder: 'What changed?' });
  const log = h('div', { class: 'log', hidden: true });
  const btn = h('button', { type: 'button', class: 'abtn primary', text: 'Publish now', onclick: async () => {
    btn.disabled = true;
    btn.textContent = 'Publishing…';
    try {
      const r = await (await fetch('/api/publish', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: msg.value }) })).json();
      log.hidden = false;
      log.textContent = r.log || '(no output)';
      toast(r.ok ? 'Published. The live site updates in about a minute.' : 'Publishing failed. See the details below.', !r.ok);
    } catch (e) {
      toast('Publishing failed: ' + e.message, true);
    }
    btn.disabled = false;
    btn.textContent = 'Publish now';
  } });
  const domain = state.content.site?.domain;
  body.replaceChildren(
    h('p', {}, h('strong', { text: st.changes ? `${st.changes} changed file${st.changes === 1 ? '' : 's'} ready to publish.` : 'Everything is already published.' })),
    st.last ? h('p', { class: 'ghelp', text: 'Last published ' + st.last }) : null,
    h('div', { class: 'field' }, h('label', { for: 'pubmsg', text: 'Short note about this update' }), msg),
    h('div', { style: 'display:flex;gap:8px;flex-wrap:wrap' }, btn,
      domain ? h('a', { class: 'abtn', href: 'https://' + domain, target: '_blank', rel: 'noopener', text: 'Open the live site ↗' }) : null),
    log);
}

function drawHelp(panel) {
  const rows = [
    ['## Section heading', 'A heading inside an entry or case study'],
    ['**bold**  *italic*', 'Bold and italic text'],
    ['[link text](https://example.com)', 'A link. Use /projects/… for pages on your own site'],
    ['- item\n- item', 'Bulleted list'],
    ['1. step\n2. step', 'Numbered list'],
    ['![What it shows](/assets/uploads/photo.jpg "Fig. 1 · Caption")', 'Image with a caption. The Image button uploads and writes this for you'],
    ['> **Note:** something worth remembering', 'Blue highlighted note box'],
    ['| A | B |\n| --- | --- |\n| 1 | 2 |', 'Table'],
    ['```\ncode here\n```', 'Code block'],
    ['`inline code`', 'Code inside a sentence'],
    ['V<sub>DS</sub>  T<sup>2</sup>', 'Subscript and superscript'],
  ];
  panel.append(
    h('p', { class: 'lead', text: 'Longer text (bio, notebook entries, case-study sections) uses simple formatting marks. The buttons above each text box add them for you, and Preview shows the result.' }),
    h('section', { class: 'group' }, h('h2', { text: 'Formatting' }),
      h('table', { class: 'cheat' }, h('tbody', {}, rows.map(([a, b]) => h('tr', {}, h('td', {}, h('code', { text: a })), h('td', { text: b })))))),
    h('section', { class: 'group' }, h('h2', { text: 'How saving works' }),
      h('ul', { style: 'margin:8px 0 0;padding-left:1.2em;display:flex;flex-direction:column;gap:6px;line-height:1.55' },
        h('li', { text: 'Save changes (or Ctrl+S) stores your edits and rebuilds the preview at localhost:4321.' }),
        h('li', { text: 'Nothing goes on the internet until you press Publish.' }),
        h('li', { text: 'A yellow dot on a tab means it has unsaved changes.' }),
        h('li', { text: 'To start the editor later, double-click “Edit site” in the portfolio-site folder.' }))));
}

// ---------------------------------------------------------------- start
async function start() {
  try {
    const data = await (await fetch('/api/content')).json();
    state.categories = data.categories;
    state.art = data.art;
    for (const f of FILES) {
      state.content[f] = data.content[f] ?? (f === 'projects' || f === 'posts' ? [] : {});
      if (f === 'awards' || f === 'courses') state.content[f].sections ??= [];
      state.saved[f] = JSON.stringify(state.content[f]);
    }
  } catch {
    document.getElementById('panel').replaceChildren(h('p', { text: 'Could not load your content. Is the editor server running (node serve.mjs)?' }));
    return;
  }
  document.getElementById('save').addEventListener('click', save);
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); save(); }
  });
  window.addEventListener('beforeunload', (e) => { if (dirtyFiles().length) { e.preventDefault(); e.returnValue = ''; } });
  window.addEventListener('hashchange', () => {
    const id = location.hash.slice(1);
    if (id !== state.tab && TABS.some((t) => t.id === id)) go(id);
  });
  const initial = location.hash.slice(1);
  go(TABS.some((t) => t.id === initial) ? initial : 'profile');
}
start();
