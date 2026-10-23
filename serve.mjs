// Local preview + site editor.
//   node serve.mjs          then open http://localhost:4321/admin/
// Only reachable from this computer. Saving in the editor rebuilds docs/ right away.
import { createServer } from 'node:http';
import { readFile, stat, writeFile, rename, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { run, CATEGORIES, ART_CHOICES, slugify } from './build.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));
const DOCS = join(ROOT, 'docs');
const ADMIN = join(ROOT, 'admin');
const PORT = Number(process.env.PORT) || 4321;
const CONTENT = ['site', 'about', 'projects', 'posts', 'awards', 'courses'];
const UPLOAD_TYPES = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.pdf'];
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.pdf': 'application/pdf',
  '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8',
};

const send = (res, code, body, type = 'application/json') => {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(type === 'application/json' ? JSON.stringify(body) : body);
};

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { reject(new Error('File is too large')); req.destroy(); }
      else chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

const git = (args) =>
  new Promise((resolve) =>
    execFile('git', args, { cwd: ROOT, windowsHide: true }, (err, stdout, stderr) =>
      resolve({ ok: !err, out: (stdout + stderr).trim() })));

function rebuild() {
  try {
    return { ok: true, ...run() };
  } catch (e) {
    return { ok: false, error: String(e.message || e) };
  }
}

async function serveFile(res, base, path) {
  let file = join(base, normalize(path));
  if (!file.startsWith(base)) return false;
  try {
    if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
    const data = await readFile(file);
    res.writeHead(200, { 'Content-Type': TYPES[extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
    return true;
  } catch {
    return false;
  }
}

async function api(req, res, url) {
  // Refuse requests coming from other websites while the editor is running.
  const origin = req.headers.origin;
  if (origin && !/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) return send(res, 403, { error: 'Forbidden' });
  const parts = url.pathname.split('/').filter(Boolean); // ['api', ...]

  if (req.method === 'GET' && parts[1] === 'content') {
    const out = {};
    for (const n of CONTENT) {
      const f = join(ROOT, 'content', n + '.json');
      out[n] = existsSync(f) ? JSON.parse(await readFile(f, 'utf8')) : null;
    }
    return send(res, 200, { content: out, categories: CATEGORIES, art: ART_CHOICES });
  }

  if (req.method === 'PUT' && parts[1] === 'content' && CONTENT.includes(parts[2])) {
    let data;
    try {
      data = JSON.parse((await readBody(req, 5e6)).toString('utf8'));
    } catch {
      return send(res, 400, { error: 'That was not valid data.' });
    }
    const wantArray = parts[2] === 'projects' || parts[2] === 'posts';
    if (Array.isArray(data) !== wantArray || typeof data !== 'object' || data === null) return send(res, 400, { error: 'Unexpected data shape.' });
    const file = join(ROOT, 'content', parts[2] + '.json');
    await writeFile(file + '.tmp', JSON.stringify(data, null, 2) + '\n');
    await rename(file + '.tmp', file);
    return send(res, 200, rebuild());
  }

  if (req.method === 'POST' && parts[1] === 'upload') {
    const original = decodeURIComponent(req.headers['x-filename'] || 'file');
    const ext = extname(original).toLowerCase();
    if (!UPLOAD_TYPES.includes(ext)) return send(res, 400, { error: `Use one of: ${UPLOAD_TYPES.join(' ')}` });
    let buf;
    try {
      buf = await readBody(req, 25e6);
    } catch (e) {
      return send(res, 413, { error: e.message + ' (25 MB max).' });
    }
    const dir = join(ROOT, 'assets', 'uploads');
    await mkdir(dir, { recursive: true });
    const base = slugify(original.slice(0, -ext.length));
    let name = base + ext, n = 2;
    while (existsSync(join(dir, name))) name = `${base}-${n++}${ext}`;
    await writeFile(join(dir, name), buf);
    rebuild();
    return send(res, 200, { path: `assets/uploads/${name}` });
  }

  if (req.method === 'GET' && parts[1] === 'status') {
    const repo = await git(['rev-parse', '--is-inside-work-tree']);
    if (!repo.ok) return send(res, 200, { repo: false });
    const remote = await git(['remote', 'get-url', 'origin']);
    const status = await git(['status', '--porcelain']);
    const last = await git(['log', '-1', '--format=%cr: %s']);
    return send(res, 200, {
      repo: true,
      remote: remote.ok ? remote.out : '',
      changes: status.out ? status.out.split('\n').length : 0,
      last: last.ok ? last.out : '',
    });
  }

  if (req.method === 'POST' && parts[1] === 'publish') {
    let message = 'Update site';
    try {
      message = JSON.parse((await readBody(req, 1e4)).toString('utf8')).message?.trim() || message;
    } catch {}
    const built = rebuild();
    if (!built.ok) return send(res, 200, { ok: false, log: 'Build failed: ' + built.error });
    const log = [];
    const add = await git(['add', '-A']);
    log.push(add.out);
    if (!add.ok) return send(res, 200, { ok: false, log: log.join('\n') });
    const commit = await git(['commit', '-m', message]);
    log.push(commit.out);
    if (!commit.ok && !/nothing to commit/.test(commit.out)) return send(res, 200, { ok: false, log: log.join('\n') });
    const push = await git(['push']);
    log.push(push.out);
    return send(res, 200, { ok: push.ok, log: log.filter(Boolean).join('\n') });
  }

  return send(res, 404, { error: 'Not found' });
}

const initial = rebuild();
if (!initial.ok) console.error('Build failed: ' + initial.error);

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const path = decodeURIComponent(url.pathname);
  try {
    if (path.startsWith('/api/')) return await api(req, res, url);
    if (path === '/admin') { res.writeHead(301, { Location: '/admin/' }); return res.end(); }
    if (path === '/admin/markdown.js') return void (await serveFile(res, join(ROOT, 'lib'), 'markdown.js'));
    if (path.startsWith('/admin/')) {
      if (await serveFile(res, ADMIN, path.slice('/admin/'.length))) return;
      return send(res, 404, 'Not found', 'text/plain');
    }
    if (path !== '/' && !path.endsWith('/') && existsSync(join(DOCS, normalize(path))) && (await stat(join(DOCS, normalize(path)))).isDirectory()) {
      res.writeHead(301, { Location: path + '/' });
      return res.end();
    }
    if (await serveFile(res, DOCS, path)) return;
    res.writeHead(404, { 'Content-Type': TYPES['.html'] });
    res.end(await readFile(join(DOCS, '404.html')));
  } catch (e) {
    send(res, 500, { error: String(e.message || e) });
  }
}).listen(PORT, '127.0.0.1', () => {
  console.log(`Site preview:  http://localhost:${PORT}/`);
  console.log(`Site editor:   http://localhost:${PORT}/admin/`);
});
