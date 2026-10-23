// Builds the site from content/*.json into docs/ (the folder GitHub Pages serves).
// Usage: node build.mjs     (the editor runs this for you after every save)
import { cpSync, mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { renderMarkdown, renderInline, escapeHtml as esc } from './lib/markdown.js';

const ROOT = dirname(fileURLToPath(import.meta.url));
const OUT = join(ROOT, 'docs');

// Simple Icons paths (CC0), drawn in the current text color.
const ICONS = {
  github: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="currentColor"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg>',
  linkedin: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 1 1 0-4.125 2.062 2.062 0 0 1 0 4.125zM7.119 20.452H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>',
};

export const CATEGORIES = {
  hw: 'Hardware & EE',
  sw: 'Software & AI',
  gm: 'Games & learning',
  tm: 'Team builds',
};

const ART = {
  inverter: `<svg width="240" height="120" viewBox="0 0 240 120" aria-hidden="true"><path d="M20 60H70M170 60H220" stroke="#121412" stroke-width="2" fill="none"/><rect x="70" y="10" width="100" height="100" fill="#FFFFFF" stroke="#121412" stroke-width="2"/><path d="M70 110L170 10" stroke="#121412" stroke-width="2" fill="none"/><path d="M84 32H112M84 41H112" stroke="#121412" stroke-width="2.5" fill="none"/><path d="M126 86q8 -16 16 0t16 0" stroke="#1F44C8" stroke-width="2.5" fill="none" stroke-linecap="round"/></svg>`,
  battery: `<svg width="240" height="120" viewBox="0 0 240 120" aria-hidden="true"><path d="M20 72H64M76 72H104M116 72H144M156 72H220" stroke="#121412" stroke-width="2" fill="none"/><path d="M64 48V96M104 48V96M144 48V96" stroke="#121412" stroke-width="2" fill="none"/><path d="M76 60V84M116 60V84M156 60V84" stroke="#121412" stroke-width="5" fill="none"/><path d="M70 22H150M70 22V56M110 22V56M150 22V56" stroke="#1F44C8" stroke-width="2" fill="none" stroke-dasharray="4 4"/><circle cx="70" cy="22" r="3.5" fill="#1F44C8"/><circle cx="110" cy="22" r="3.5" fill="#1F44C8"/><circle cx="150" cy="22" r="3.5" fill="#1F44C8"/><rect x="170" y="10" width="40" height="24" fill="#FFFFFF" stroke="#1F44C8" stroke-width="2"/><path d="M150 22H170" stroke="#1F44C8" stroke-width="2" fill="none"/></svg>`,
  spice: `<svg width="240" height="120" viewBox="0 0 240 120" aria-hidden="true"><path d="M14 46H40L46 34L58 58L70 34L82 58L94 34L100 46H130M130 46V62M130 70V90" stroke="#121412" stroke-width="2" fill="none" stroke-linejoin="round"/><path d="M116 62H144M116 70H144" stroke="#121412" stroke-width="2.5" fill="none"/><path d="M116 90H144M121 97H139M126 104H134" stroke="#121412" stroke-width="2" fill="none"/><circle cx="130" cy="46" r="3.5" fill="#121412"/><path d="M130 46H156" stroke="#121412" stroke-width="2" fill="none"/><path d="M162 96C178 50 196 40 226 36" stroke="#1F44C8" stroke-width="2.5" fill="none" stroke-linecap="round"/><path d="M162 100H228M162 100V28" stroke="#121412" stroke-width="1" fill="none"/></svg>`,
  chip: `<svg width="240" height="120" viewBox="0 0 240 120" aria-hidden="true"><rect x="80" y="20" width="80" height="80" fill="#FFFFFF" stroke="#121412" stroke-width="2"/><path d="M95 20V8M110 20V8M125 20V8M140 20V8M95 112V100M110 112V100M125 112V100M140 112V100M80 40H66M80 60H66M80 80H66M174 40H160M174 60H160M174 80H160" stroke="#121412" stroke-width="2"/><rect x="100" y="40" width="40" height="40" fill="none" stroke="#1F44C8" stroke-width="2"/></svg>`,
  code: `<svg width="240" height="120" viewBox="0 0 240 120" aria-hidden="true"><rect x="40" y="14" width="160" height="92" rx="4" fill="#FFFFFF" stroke="#121412" stroke-width="2"/><path d="M40 32H200" stroke="#121412" stroke-width="2"/><path d="M92 54L76 68L92 82M148 54L164 68L148 82" stroke="#1F44C8" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M128 50L112 86" stroke="#121412" stroke-width="2.5" stroke-linecap="round"/></svg>`,
  gear: `<svg width="240" height="120" viewBox="0 0 240 120" aria-hidden="true"><circle cx="120" cy="60" r="30" fill="#FFFFFF" stroke="#121412" stroke-width="2"/><circle cx="120" cy="60" r="10" fill="none" stroke="#1F44C8" stroke-width="2.5"/><path d="M120 18V30M120 90V102M78 60H90M150 60H162M90 30L98 38M142 82L150 90M150 30L142 38M98 82L90 90" stroke="#121412" stroke-width="5" stroke-linecap="round"/></svg>`,
};
export const ART_CHOICES = Object.keys(ART);

const readJson = (name, fallback) => {
  const file = join(ROOT, 'content', name + '.json');
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : fallback;
};
export const slugify = (s) =>
  String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'untitled';
const stripTags = (s) => String(s ?? '').replace(/<[^>]+>/g, '');
const fmtDate = (iso) => {
  const d = new Date(String(iso) + 'T12:00:00Z');
  return isNaN(d) ? '' : d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
};
const readMinutes = (md) => Math.max(1, Math.round(String(md || '').split(/\s+/).length / 220));
const asset = (p) => '{{root}}' + String(p || '').replace(/^\/+/, '');
const href = (url) => (url && url.startsWith('/') && !url.startsWith('//') ? '{{root}}' + url.slice(1) : url);
const ext = (url) => (url && /^https?:/.test(url) ? ' rel="noopener"' : '');
const pad = (n) => String(n).padStart(3, '0');

function uniqueSlugs(items, key = 'title') {
  const seen = new Set();
  for (const it of items) {
    let s = slugify(it.slug || it[key]);
    let base = s, n = 2;
    while (seen.has(s)) s = `${base}-${n++}`;
    seen.add(s);
    it.slug = s;
  }
  return items;
}

export function build() {
  const warnings = [];
  const site = readJson('site', {});
  const about = readJson('about', {});
  const awards = readJson('awards', { sections: [] });
  const courses = readJson('courses', { sections: [] });
  const projects = uniqueSlugs(readJson('projects', []));
  const posts = uniqueSlugs(readJson('posts', []))
    .map((p, i) => ({ ...p, number: p.number || pad(i + 1) }))
    .filter((p) => !p.draft)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.number).localeCompare(String(b.number)));
  const bySlug = Object.fromEntries(projects.map((p) => [p.slug, p]));
  const domain = String(site.domain || '').trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  const baseUrl = domain ? `https://${domain}/` : '';
  const name = site.name || 'Your Name';
  const projectUrl = (p) => (p.hasCaseStudy ? `{{root}}projects/${p.slug}/` : p.repo || '');
  const postUrl = (p) => `{{root}}notebook/${p.slug}/`;
  let pageCount = 0;

  // ------------------------------------------------------------ layout
  const NAV = [
    ['home', 'Home', ''],
    ['projects', 'Projects', 'projects/'],
    ['notebook', 'Lab notebook', 'notebook/'],
    ['awards', 'Awards', 'awards/'],
    ['courses', 'Courses', 'courses/'],
    ['about', 'About', 'about/'],
  ];

  function layout({ path, title, description, active, body, ogType = 'website' }) {
    const depth = path === '404.html' ? 0 : path.split('/').filter(Boolean).length;
    const root = path === '404.html' ? '/' : '../'.repeat(depth) || './';
    const fullTitle = title ? `${title} · ${name}` : `${name}${site.eyebrow ? ' · ' + site.eyebrow : ''}`;
    const desc = description || site.description || '';
    const canonical = baseUrl ? baseUrl + path : '';
    const nav = NAV.map(([key, label, to]) =>
      `<li><a href="{{root}}${to}"${key === active ? ' aria-current="page"' : ''}>${label}</a></li>`).join('');
    const socials = [
      site.linkedin && `<li><a class="nav-icon" href="${esc(site.linkedin)}" aria-label="LinkedIn" title="LinkedIn">${ICONS.linkedin}</a></li>`,
      site.github && `<li><a class="nav-icon" href="${esc(site.github)}" aria-label="GitHub" title="GitHub">${ICONS.github}</a></li>`,
    ].filter(Boolean).join('');
    const footerLinks = [
      site.github && `<li><a href="${esc(site.github)}">GitHub</a></li>`,
      site.email && `<li><a href="mailto:${esc(site.email)}">Email</a></li>`,
      site.linkedin && `<li><a href="${esc(site.linkedin)}">LinkedIn</a></li>`,
      `<li><a href="{{root}}feed.xml">RSS</a></li>`,
    ].filter(Boolean).join('\n');
    const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="author" content="${esc(name)}">
<meta name="theme-color" content="#F5F5F0">
${canonical ? `<link rel="canonical" href="${canonical}">` : ''}
<meta property="og:type" content="${ogType}">
<meta property="og:title" content="${esc(fullTitle)}">
<meta property="og:description" content="${esc(desc)}">
${canonical ? `<meta property="og:url" content="${canonical}">` : ''}
${baseUrl ? `<meta property="og:image" content="${baseUrl}assets/img/og.jpg">` : ''}
<meta name="twitter:card" content="summary">
<link rel="icon" href="{{root}}assets/img/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="{{root}}assets/img/apple-touch-icon.png">
<link rel="alternate" type="application/rss+xml" title="${esc(name)} · Lab notebook" href="{{root}}feed.xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500..800&amp;family=Hanken+Grotesk:ital,wght@0,400;0,500;0,600;1,400&amp;family=JetBrains+Mono:wght@400;500&amp;display=swap">
<link rel="stylesheet" href="{{root}}assets/css/site.css">
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header class="site-header">
<nav class="site-nav" aria-label="Primary"><ul>${nav}${site.resume ? `<li><a class="nav-resume" href="${asset(site.resume)}">Résumé</a></li>` : ''}${socials}</ul></nav>
</header>
<main id="main">
${body}
</main>
<footer class="site-footer">
<div class="wrap">
<div class="who"><strong>${esc(name)}</strong><span>${esc(site.location || '')}</span></div>
<ul>
${footerLinks}
</ul>
</div>
</footer>
<script src="{{root}}assets/js/site.js" defer></script>
</body>
</html>
`;
    return html.replaceAll('{{root}}', root);
  }

  function write(path, html) {
    const file = join(OUT, /\.(html|xml|txt)$/.test(path) ? path : join(path, 'index.html'));
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, html);
    if (file.endsWith('.html')) pageCount++;
  }

  const md = (s) => renderMarkdown(s, '{{root}}/').replaceAll('{{root}}/', '{{root}}');
  const inline = (s) => renderInline(s, '{{root}}/').replaceAll('{{root}}/', '{{root}}');
  const statusTag = (p) =>
    p.status === 'built' ? '<span class="tag tag-built">Built</span>' : '<span class="tag tag-wip">In progress</span>';

  // ------------------------------------------------------------ home
  {
    const featured = projects.filter((p) => p.home === 'featured');
    const listed = projects.filter((p) => p.home === 'list');
    const cards = featured.map((p) => {
      const url = projectUrl(p);
      const art = p.cardImage
        ? `<div class="card-art card-photo"><img src="${asset(p.cardImage)}" alt="" loading="lazy"></div>`
        : ART[p.cardArt] ? `<div class="card-art grid-paper">${ART[p.cardArt]}</div>` : '';
      const tag = url ? 'a' : 'div';
      return `<${tag} class="card"${url ? ` href="${url}"${ext(url)}` : ''}>
${art}
<div class="card-body">
<div class="card-meta"><span>${esc(p.area)}</span>${statusTag(p)}</div>
<h3>${esc(p.title)}</h3>
<p>${esc(p.description)}</p>
${url ? `<span class="card-cta">${p.hasCaseStudy ? 'Read the case study →' : 'View on GitHub →'}</span>` : ''}
</div>
</${tag}>`;
    }).join('\n');
    const rows = listed.map((p) => {
      const url = projectUrl(p) || '{{root}}projects/';
      return `<a class="row" href="${url}"${ext(url)}>
<span class="row-title">${esc(p.title)}</span>
<span class="row-desc">${esc(p.description)}</span>
<span class="${p.status === 'built' ? 'status-done' : 'status-wip'}">${p.status === 'built' ? 'Built' : 'In progress'} →</span>
</a>`;
    }).join('\n');
    const entries = posts.slice(-3).reverse().map((e) => `<a class="entry-card" href="${postUrl(e)}">
<div class="meta"><span>Entry ${esc(e.number)}</span><span>${esc(bySlug[e.project]?.title || '')}</span></div>
<h3>${esc(e.title)}</h3>
<time datetime="${esc(e.date)}">${fmtDate(e.date)}</time>
</a>`).join('\n');
    const specs = (site.specs || []).map((s) =>
      `<div><dt>${esc(s.label)}</dt><dd${s.highlight ? ' class="hl"' : ''}>${esc(s.value)}</dd></div>`).join('\n');
    const now = (site.now || []).map((t) => `<div><span class="mono">${esc(t.name)}</span><p>${esc(t.text)}</p></div>`).join('\n');
    let n = 0;
    const num = () => String(++n).padStart(2, '0');

    const body = `
<section class="hero grid-paper">
<div class="wrap hero-inner">
<div class="hero-text">
<div class="hero-id">
${site.photo ? `<img class="portrait" src="${asset(site.photo)}" alt="Portrait of ${esc(name)}" width="184" height="184">` : ''}
<div>${site.eyebrow ? `<span class="eyebrow blue">${esc(site.eyebrow)}</span>` : ''}<h1>${esc(name)}</h1></div>
</div>
${site.intro ? `<p class="lede">${inline(site.intro)}</p>` : ''}
<div class="btns">
<a class="btn btn-primary" href="{{root}}projects/">See the projects</a>
${posts.length ? `<a class="btn" href="{{root}}notebook/">Read the lab notebook</a>` : ''}
</div>
</div>
${specs ? `<div class="spec"><div class="spec-head">Specifications</div><dl>${specs}</dl></div>` : ''}
</div>
</section>

${cards ? `<section class="wrap section-first" aria-labelledby="h-feat">
<div class="section-head">
<div><span class="eyebrow">${num()} · Featured builds</span><h2 id="h-feat">${esc(site.featuredHeading || 'Featured projects')}</h2></div>
<a class="link-more" href="{{root}}projects/">All ${projects.length} projects →</a>
</div>
<div class="cards">
${cards}
</div>
</section>` : ''}

${rows ? `<section class="wrap ${cards ? 'section' : 'section-first'}" aria-labelledby="h-list">
<div class="section-head" style="margin-bottom: 24px">
<div><span class="eyebrow">${num()} · In progress</span><h2 id="h-list">${esc(site.listHeading || 'More projects')}</h2></div>
${cards ? '' : `<a class="link-more" href="{{root}}projects/">All ${projects.length} projects →</a>`}
</div>
<div class="rows">
${rows}
</div>
</section>` : ''}

${entries ? `<section class="wrap section" aria-labelledby="h-nb">
<div class="section-head" style="margin-bottom: 28px">
<div><span class="eyebrow">${num()} · Lab notebook</span><h2 id="h-nb">Latest entries</h2></div>
<a class="link-more" href="{{root}}notebook/">All entries →</a>
</div>
<div class="entry-cards">
${entries}
</div>
</section>` : ''}

${now ? `<section class="wrap section section-last" aria-labelledby="h-now">
<div class="section-head" style="margin-bottom: 28px">
<div><span class="eyebrow">${num()} · ${esc(site.nowLabel || 'Now')}</span><h2 id="h-now">${esc(site.nowHeading || 'What I am doing now')}</h2></div>
</div>
<div class="teams">
${now}
</div>
</section>` : '<div class="section-last"></div>'}

${site.ctaHeading ? `<section class="cta" aria-labelledby="h-cta">
<div class="wrap cta-inner">
<div>${site.ctaLabel ? `<span class="eyebrow">${esc(site.ctaLabel)}</span>` : ''}<h2 id="h-cta">${esc(site.ctaHeading)}</h2></div>
<div class="btns">
${site.email ? `<a class="btn" href="mailto:${esc(site.email)}">Email me</a>` : ''}
${site.resume ? `<a class="btn btn-ghost" href="${asset(site.resume)}">Résumé</a>` : ''}
</div>
</div>
</section>` : ''}`;
    write('', layout({ path: '', active: 'home', body }));
  }

  // ------------------------------------------------------------ projects
  {
    const used = Object.keys(CATEGORIES).filter((k) => projects.some((p) => p.category === k));
    const chips = [['all', 'All'], ...used.map((k) => [k, CATEGORIES[k]])]
      .map(([k, l]) => `<button type="button" class="chip" data-filter="${k}" aria-pressed="${k === 'all'}">${l}</button>`).join('');
    const rows = projects.map((p) => {
      const url = projectUrl(p);
      const tag = url ? 'a' : 'div';
      const go = p.hasCaseStudy ? 'Case study →' : p.repo ? 'GitHub ↗' : '';
      return `<${tag} class="prow" data-cat="${esc(p.category)}"${url ? ` href="${url}"${ext(url)}` : ''}>
<span class="prow-main"><span class="prow-title">${esc(p.title)}${go ? `<span class="go">${go}</span>` : ''}</span><span class="prow-desc">${esc(p.description)}</span></span>
<span class="prow-area">${esc(p.area)}</span>
<span>${statusTag(p)}</span>
</${tag}>`;
    }).join('\n');
    const body = `<div class="wrap page">
<div class="page-head"><div><h1>Projects</h1><p>Solo and team projects, hardware and software.</p></div></div>
<div class="toolbar">
<div class="chips" role="group" aria-label="Filter projects" data-filter-group="project-list">${chips}</div>
<span class="count" aria-live="polite" data-count-for="project-list" data-template="Showing {n} of {total}">Showing ${projects.length} of ${projects.length}</span>
</div>
<div class="ptable" id="project-list">
<div class="ptable-head" aria-hidden="true"><span>Project</span><span>Area</span><span>Status</span></div>
${rows || '<p class="empty">No projects yet.</p>'}
</div>
${site.github ? `<p class="foot-note">Code lives on <a href="${esc(site.github)}">${esc(site.github.replace(/^https?:\/\//, ''))}</a>.${posts.length ? ` Build logs live in the <a href="{{root}}notebook/">lab notebook</a>.` : ''}</p>` : ''}
</div>`;
    write('projects/', layout({ path: 'projects/', title: 'Projects', active: 'projects', body,
      description: `Projects by ${name}: ${projects.slice(0, 4).map((p) => p.title).join(', ')}.` }));
  }

  const studies = projects.filter((p) => p.hasCaseStudy);
  studies.forEach((p, i) => {
    const next = studies[(i + 1) % studies.length];
    const related = posts.filter((e) => e.project === p.slug);
    const sections = (p.sections || []).filter((s) => String(s.body || '').trim());
    const ids = sections.map((s, j) => slugify(s.title) + (sections.findIndex((x) => slugify(x.title) === slugify(s.title)) < j ? '-' + j : ''));
    const toc = sections.map((s, j) => `<a href="#${ids[j]}"><span>${String(j + 1).padStart(2, '0')}</span>${esc(s.title)}</a>`).join('');
    const content = sections.map((s, j) =>
      `<h2 id="${ids[j]}"><span class="n">${String(j + 1).padStart(2, '0')}</span>${esc(s.title)}</h2>\n${md(s.body)}`).join('\n');
    const specs = (p.specs || []).filter((s) => s.label || s.value);
    const body = `<div class="wrap page page-narrow-top">
<a class="back" href="{{root}}projects/">← Projects</a>
<section class="case-top${specs.length ? '' : ' no-spec'}">
<div>
<div class="meta"><span>${esc(p.area)}</span>${statusTag(p)}</div>
<h1>${esc(p.title)}</h1>
<p class="lede">${inline(p.summary || p.description)}</p>
<div class="btns">
${p.repo ? `<a class="btn btn-primary" href="${esc(p.repo)}" rel="noopener">View on GitHub</a>` : ''}
${related.length ? `<a class="btn" href="${postUrl(related[0])}">Build log</a>` : ''}
</div>
</div>
${specs.length ? `<div class="spec"><div class="spec-head">Specifications</div><dl>${specs.map((s) => `<div><dt>${esc(s.label)}</dt><dd>${esc(s.value)}</dd></div>`).join('')}</dl></div>` : ''}
</section>
${p.heroImage ? `<figure class="wide-fig"><img src="${asset(p.heroImage)}" alt="${esc(p.heroAlt || '')}">${p.heroCaption ? `<figcaption>${inline(p.heroCaption)}</figcaption>` : ''}</figure>` : ''}
<div class="reading" style="padding-top: 56px">
${sections.length > 1 ? `<aside><nav class="toc" aria-label="On this page"><span class="k">On this page</span>${toc}</nav></aside>` : ''}
<article class="prose case">
${content}
${related.length ? `<div class="related"><span class="k">Notebook entries for this project</span>${related.map((e) =>
      `<a href="${postUrl(e)}"><span class="t">${esc(e.title)}</span><span class="k2">Entry ${esc(e.number)} →</span></a>`).join('')}</div>` : ''}
</article>
</div>
<nav class="pager" aria-label="More projects">
<a href="{{root}}projects/"><span class="k">← All projects</span><span class="t">Projects</span></a>
${next !== p ? `<a class="next" href="{{root}}projects/${next.slug}/"><span class="k">Next project →</span><span class="t">${esc(next.title)}</span></a>` : ''}
</nav>
</div>`;
    write(`projects/${p.slug}/`, layout({ path: `projects/${p.slug}/`, title: p.title, active: 'projects', body,
      description: stripTags(p.summary || p.description), ogType: 'article' }));
  });

  // ------------------------------------------------------------ notebook
  {
    const used = [...new Set(posts.map((e) => e.project).filter((s) => bySlug[s]))];
    const chips = used.length > 1
      ? [['all', 'All'], ...used.map((s) => [s, bySlug[s].title])]
          .map(([k, l]) => `<button type="button" class="chip" data-filter="${esc(k)}" aria-pressed="${k === 'all'}">${esc(l)}</button>`).join('')
      : '';
    const list = [...posts].reverse().map((e) => `<a class="entry" data-cat="${esc(e.project || '')}" href="${postUrl(e)}">
<span class="num">Entry ${esc(e.number)}</span>
<span class="t">${esc(e.title)}</span>
<span class="proj">${esc(bySlug[e.project]?.title || '')}</span>
<time datetime="${esc(e.date)}">${fmtDate(e.date)}</time>
</a>`).join('\n');
    const body = `<div class="wrap page">
<div class="page-head">
<div><span class="eyebrow blue">Blog</span><h1>Lab notebook</h1><p>Build logs and notes, sorted by project.</p></div>
<a class="btn" href="{{root}}feed.xml" style="font-family: var(--mono); font-size: 13px; font-weight: 400; min-height: 44px; padding: 0 16px">
<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><circle cx="2.5" cy="11.5" r="1.5" fill="currentColor"/><path d="M1 6.5a6.5 6.5 0 0 1 6.5 6.5M1 1.5a11.5 11.5 0 0 1 11.5 11.5" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>
RSS feed</a>
</div>
<div class="toolbar">
<div class="chips" role="group" aria-label="Filter entries by project"${chips ? ' data-filter-group="entry-list"' : ''}>${chips}</div>
<span class="count" aria-live="polite" data-count-for="entry-list" data-template="{n} entries">${posts.length} ${posts.length === 1 ? 'entry' : 'entries'}</span>
</div>
<div class="entries" id="entry-list">
${list || '<p class="empty">First entries coming soon.</p>'}
</div>
</div>`;
    write('notebook/', layout({ path: 'notebook/', title: 'Lab notebook', active: 'notebook', body,
      description: `Build logs and engineering notes by ${name}.` }));
  }

  posts.forEach((e, i) => {
    const p = bySlug[e.project];
    const prev = posts[i - 1];
    const next = posts[i + 1];
    const tags = String(e.tags || '').split(',').map((t) => t.trim()).filter(Boolean);
    const pUrl = p && projectUrl(p);
    const body = `<div class="wrap page page-narrow-top">
<a class="back" href="{{root}}notebook/">← Lab notebook</a>
<div class="reading">
<aside>
<div class="meta-row"><span class="k">Entry</span><span>${esc(e.number)}</span></div>
${p ? `<div class="meta-row"><span class="k">Project</span>${pUrl ? `<a href="${pUrl}"${ext(pUrl)}>${esc(p.title)}</a>` : esc(p.title)}</div>` : ''}
<div class="meta-row"><span class="k">Published</span><time datetime="${esc(e.date)}">${fmtDate(e.date)}</time></div>
<div class="meta-row"><span class="k">Reading time</span><span>${readMinutes(e.body)} min</span></div>
${tags.length ? `<div class="meta-row"><span class="k">Tags</span><div class="pills">${tags.map((t) => `<span>${esc(t)}</span>`).join('')}</div></div>` : ''}
</aside>
<article class="prose">
<h1>${esc(e.title)}</h1>
${e.summary ? `<p class="summary">${inline(e.summary)}</p>` : ''}
${md(e.body)}
<nav class="pager" aria-label="More entries">
${prev ? `<a href="${postUrl(prev)}"><span class="k">← Entry ${esc(prev.number)}</span><span class="t">${esc(prev.title)}</span></a>` : `<a href="{{root}}notebook/"><span class="k">← All entries</span><span class="t">Lab notebook</span></a>`}
${next ? `<a class="next" href="${postUrl(next)}"><span class="k">Entry ${esc(next.number)} →</span><span class="t">${esc(next.title)}</span></a>` : `<a class="next" href="{{root}}notebook/"><span class="k">All entries →</span><span class="t">Lab notebook</span></a>`}
</nav>
</article>
</div>
</div>`;
    write(`notebook/${e.slug}/`, layout({ path: `notebook/${e.slug}/`, title: e.title, active: 'notebook', body,
      description: stripTags(e.summary), ogType: 'article' }));
  });

  // ------------------------------------------------------------ section pages (awards, courses)
  function sectionPage(data) {
    const stats = (data.stats || []).filter((s) => s.label || s.value);
    const head = `<div class="page-head">
<div>${data.eyebrow ? `<span class="eyebrow blue">${esc(data.eyebrow)}</span>` : ''}<h1>${esc(data.title)}</h1>${data.intro ? `<p>${inline(data.intro)}</p>` : ''}</div>
${stats.length ? `<div class="stat-strip">${stats.map((s) => `<div><span>${esc(s.label)}</span><span>${esc(s.value)}</span></div>`).join('')}</div>` : ''}
</div>`;
    const wide = (data.sections || []).some((s) => s.layout === 'cards' && s.items?.length > 4);
    const sections = (data.sections || []).map((s, si) => {
      const items = (s.items || []).filter((it) => it.title || it.kicker);
      const link = (it, cls) => it.link
        ? `<a class="${cls}" href="${esc(href(it.link))}"${ext(it.link)}>${esc(it.linkText || 'Link →')}</a>` : '';
      let inner;
      if (s.layout === 'cards') {
        inner = `<div class="tiles">${items.map((it) => `<div class="tile${it.style === 'dashed' ? ' dashed' : it.style === 'pending' ? ' pending' : ''}">
${it.kicker ? `<span class="tile-kicker">${esc(it.kicker)}</span>` : ''}<span class="tile-title">${esc(it.title)}</span>
${it.description ? `<span class="tile-desc">${inline(it.description)}</span>` : ''}${link(it, 'tile-link')}</div>`).join('')}</div>`;
      } else if (s.layout === 'list') {
        inner = `<div class="list-rows">${items.map((it) => `<div class="list-row"><span class="k">${esc(it.kicker)}</span><span class="t">${
          it.link ? `<a href="${esc(href(it.link))}"${ext(it.link)}>${esc(it.title)}</a>` : esc(it.title)}</span>${
          it.status === 'done' ? '<span class="status-done">Completed</span>' : it.status === 'progress' ? '<span class="status-wip">In progress</span>' : '<span></span>'}</div>`).join('')}</div>`;
      } else {
        inner = `<div class="tl">${items.map((it) => `<div class="tl-row"><span class="tl-date${it.highlight ? ' now' : ''}">${esc(it.kicker)}</span><div class="tl-body"><span class="tl-title">${esc(it.title)}</span>${
          it.description ? `<span class="tl-desc">${inline(it.description)}</span>` : ''}${link(it, 'tile-link')}</div></div>`).join('')}</div>`;
      }
      const state = s.state === 'current' ? ' now' : s.state === 'planned' ? ' plan' : '';
      return `<section class="split${wide ? ' wide-label' : ''}" aria-labelledby="s${si}">
<div class="split-label"><h2 id="s${si}">${esc(s.heading)}</h2>${s.note ? `<span class="state${state}">${esc(s.note)}</span>` : ''}</div>
${inner}
</section>`;
    }).join('\n');
    return `<div class="wrap page">${head}\n${sections}</div>`;
  }
  write('awards/', layout({ path: 'awards/', title: awards.title || 'Awards', active: 'awards', body: sectionPage(awards) }));
  write('courses/', layout({ path: 'courses/', title: courses.title || 'Courses', active: 'courses', body: sectionPage(courses) }));

  // ------------------------------------------------------------ about
  {
    const contact = [
      site.email && ['Email', `mailto:${site.email}`, site.email],
      site.personalEmail && ['Personal email', `mailto:${site.personalEmail}`, site.personalEmail],
      site.phone && ['Phone', `tel:${String(site.phone).replace(/[^\d+]/g, '')}`, site.phone],
      site.github && ['GitHub', site.github, site.github.replace(/^https?:\/\/(www\.)?github\.com\//, '')],
      site.linkedin && ['LinkedIn', site.linkedin, site.linkedin.replace(/^https?:\/\/(www\.)?linkedin\.com\/in\//, '').replace(/\/$/, '')],
    ].filter(Boolean);
    const exp = (about.experience || []).filter((x) => x.title);
    const teams = (about.teams || []).filter((x) => x.name);
    const tools = String(about.tools || '').split('\n').map((t) => t.trim()).filter(Boolean);
    const body = `<div class="wrap page">
<section class="about-top">
<div class="about-side">
${site.photo ? `<img class="portrait" src="${asset(site.photo)}" alt="Portrait of ${esc(name)}" width="300" height="300">` : ''}
${contact.length ? `<dl class="contact">${contact.map(([k, u, t]) => `<div><dt>${k}</dt><dd><a href="${esc(u)}">${esc(t)}</a></dd></div>`).join('')}</dl>` : ''}
</div>
<div class="about-main">
<span class="eyebrow blue">About</span>
<h1>${esc(name)}</h1>
<div class="bio">${md(about.bio)}</div>
<div class="btns" style="padding-top: 8px">
${site.resume ? `<a class="btn btn-primary" href="${asset(site.resume)}">Download résumé (PDF)</a>` : ''}
${site.email ? `<a class="btn" href="mailto:${esc(site.email)}">Email me</a>` : ''}
</div>
</div>
</section>
${exp.length ? `<section class="split" aria-labelledby="ab-exp">
<div class="split-label"><h2 id="ab-exp">Experience</h2></div>
<div class="tl">${exp.map((x, i) => `<div class="tl-row wide${i === 0 ? ' strong' : ''}"><span class="tl-date${x.current ? ' now' : ''}">${esc(x.when)}</span><div class="tl-body"><span class="tl-title">${esc(x.title)}</span>${x.description ? `<span class="tl-desc">${inline(x.description)}</span>` : ''}</div></div>`).join('')}</div>
</section>` : ''}
${teams.length ? `<section class="split" aria-labelledby="ab-teams">
<div class="split-label"><h2 id="ab-teams">${esc(about.teamsHeading || 'Teams')}</h2></div>
<div class="tiles">${teams.map((t) => `<div class="tile"><span class="tile-title">${esc(t.name)}</span>${t.role ? `<span class="tile-kicker">${esc(t.role)}</span>` : ''}</div>`).join('')}</div>
</section>` : ''}
${tools.length ? `<section class="split" aria-labelledby="ab-tools">
<div class="split-label"><h2 id="ab-tools">Tools</h2></div>
<ul class="tools">${tools.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
</section>` : ''}
</div>`;
    write('about/', layout({ path: 'about/', title: 'About', active: 'about', body }));
  }

  // ------------------------------------------------------------ 404, feed, sitemap
  write('404.html', layout({ path: '404.html', title: 'Page not found',
    body: `<div class="wrap notfound"><span class="eyebrow blue">Error 404</span><h1>This page isn't here.</h1>
<p class="lede">The link may be old, or the page moved.</p>
<div class="btns"><a class="btn btn-primary" href="/">Go home</a><a class="btn" href="/projects/">See the projects</a></div></div>` }));

  const link = (path) => (baseUrl || '/') + path;
  write('feed.xml', `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
<title>${esc(name)} · Lab notebook</title>
<link>${link('notebook/')}</link>
<description>Build logs and engineering notes.</description>
<language>en-us</language>
${[...posts].reverse().map((e) => `<item>
<title>${esc(e.title)}</title>
<link>${link(`notebook/${e.slug}/`)}</link>
<guid>${link(`notebook/${e.slug}/`)}</guid>
<pubDate>${new Date(e.date + 'T12:00:00Z').toUTCString()}</pubDate>
<description>${esc(stripTags(e.summary))}</description>
</item>`).join('\n')}
</channel>
</rss>
`);
  if (baseUrl) {
    const pages = ['', 'projects/', 'notebook/', 'awards/', 'courses/', 'about/',
      ...studies.map((p) => `projects/${p.slug}/`), ...posts.map((e) => `notebook/${e.slug}/`)];
    write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map((p) => `<url><loc>${baseUrl}${p}</loc></url>`).join('\n')}
</urlset>
`);
    write('robots.txt', `User-agent: *\nAllow: /\nSitemap: ${baseUrl}sitemap.xml\n`);
    writeFileSync(join(OUT, 'CNAME'), domain + '\n');
  } else {
    write('robots.txt', 'User-agent: *\nAllow: /\n');
  }

  for (const f of [site.photo, site.resume, ...projects.flatMap((p) => [p.cardImage, p.heroImage])].filter(Boolean)) {
    if (!existsSync(join(ROOT, f))) warnings.push(`Missing file: ${f}`);
  }
  return { pages: pageCount, warnings, domain };
}

function run() {
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });
  cpSync(join(ROOT, 'assets'), join(OUT, 'assets'), { recursive: true });
  writeFileSync(join(OUT, '.nojekyll'), '');
  return build();
}
export { run };

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const r = run();
  r.warnings.forEach((w) => console.warn('! ' + w));
  console.log(`Built ${r.pages} pages into docs/` + (r.domain ? ` for https://${r.domain}/` : ' (no domain set yet)'));
}
