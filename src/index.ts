export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  ADMIN_PASSWORD: string;
  ADMIN_USERNAME: string;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

function unauthorized(): Response {
  return new Response('Unauthorized', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Donald Never Admin"' },
  });
}

function checkAuth(request: Request, env: Env): Response | null {
  const header = request.headers.get('Authorization');
  if (!header?.startsWith('Basic ')) return unauthorized();

  let decoded: string;
  try {
    decoded = atob(header.slice(6));
  } catch {
    return unauthorized();
  }

  const sep = decoded.indexOf(':');
  if (sep === -1) return unauthorized();

  const username = decoded.slice(0, sep);
  const password = decoded.slice(sep + 1);

  const expectedUser = env.ADMIN_USERNAME || 'admin';
  const expectedPass = env.ADMIN_PASSWORD || 'changeme';

  if (username !== expectedUser || password !== expectedPass) {
    return unauthorized();
  }

  return null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function html(content: string, status = 200): Response {
  return new Response(content, {
    status,
    headers: { 'Content-Type': 'text/html;charset=UTF-8' },
  });
}

// ─── Home page ────────────────────────────────────────────────────────────────

async function serveHome(env: Env): Promise<Response> {
  const row = await env.DB.prepare(
    'SELECT text FROM phrases ORDER BY RANDOM() LIMIT 1'
  ).first<{ text: string }>();

  const phrase = row?.text ?? 'has never existed.';
  return html(homeHtml(phrase));
}

function homeHtml(phrase: string): string {
  const safe = escapeHtml(phrase);
  // Strip "has never " prefix if present, then capitalize
  const display = safe.startsWith('has never ')
    ? 'Never ' + safe.slice('has never '.length)
    : safe;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Donald Never</title>
  <meta property="og:title" content="Donald Never" />
  <meta property="og:description" content="Donald Never" />
  <meta property="og:image" content="https://donaldnever.meandmybadself.com/share.jpg" />
  <meta property="og:type" content="website" />
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    html, body {
      height: 100%;
      overflow: hidden;
    }

    body {
      background-color: #FAF5F4;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      font-family: Georgia, 'Times New Roman', serif;
    }

    .gallery {
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    /* ── Frame ─────────────────────────────── */

    .frame-container {
      position: relative;
      overflow: hidden;
      /* Fill screen: constrained by whichever viewport dimension runs out first */
      width: min(100vw, calc(100vh * 1.5));
    }

    .frame-img {
      display: block;
      width: 100%;
      height: auto;
    }

    /*
      Measured from frame.jpg (1536x1024):
        inner white area: ~24% top, ~26% bottom, ~29% left/right
    */
    .phrase-overlay {
      position: absolute;
      inset: 25% 30% 27% 30%;
      display: flex;
      align-items: center;
      justify-content: center;
      text-align: center;
      overflow: hidden;
    }

    .phrase-text {
      font-size: clamp(10px, 1.8vw, 22px);
      color: #111;
      line-height: 1.5;
      font-style: normal;
      max-width: 100%;
      word-break: break-word;
      user-select: none;
    }

    /* ── Portrait ───────────────────────────── */
    /*
      Display the landscape frame rotated +90° inside a portrait container.
      Container aspect ratio: 1024:1536 = 2:3 (the rotated frame dimensions).
      Image is scaled to 150% width and rotated to fill this portrait container.

      Portrait insets (inner opening after -90° rotation):
        top/bottom ≈ 29%  left ≈ 26%  right ≈ 25%
    */
    @media (orientation: portrait) {
      .frame-container {
        width: min(100vw, calc(100vh * 2 / 3));
        aspect-ratio: 2 / 3;
      }

      .frame-img {
        /* Rotate image to fill portrait container */
        position: absolute;
        width: 150%;
        height: auto;
        left: -25%;
        top: calc(100% / 6);
        transform: rotate(90deg);
        transform-origin: 50% 50%;
      }

      .phrase-overlay {
        inset: 29% 24% 29% 26%;
      }

      .phrase-text {
        font-size: clamp(9px, 3vmin, 18px);
      }
    }
  </style>
</head>
<body>
  <div class="gallery">
    <div class="frame-container">
      <img src="/frame.jpg" class="frame-img" alt="" />
      <div class="phrase-overlay">
        <p class="phrase-text">${display}</p>
      </div>
    </div>
  </div>
  <script>
    function fitPhrase() {
      var overlay = document.querySelector('.phrase-overlay');
      var text = document.querySelector('.phrase-text');
      if (!overlay || !text) return;
      // Reset to CSS-computed size
      text.style.fontSize = '';
      var maxH = overlay.clientHeight;
      var maxW = overlay.clientWidth;
      if (!maxH || !maxW) return;
      var size = parseFloat(getComputedStyle(text).fontSize);
      // Shrink until text fits within the overlay bounds
      while (size > 8) {
        if (text.scrollHeight <= maxH && text.scrollWidth <= maxW) break;
        size -= 0.5;
        text.style.fontSize = size + 'px';
      }
    }
    var img = document.querySelector('.frame-img');
    if (img && img.complete) {
      fitPhrase();
    } else if (img) {
      img.addEventListener('load', fitPhrase);
    }
    window.addEventListener('resize', fitPhrase);
    document.addEventListener('click', function() { location.reload(); });
  </script>
</body>
</html>`;
}

// ─── Admin page ───────────────────────────────────────────────────────────────

function adminHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Admin — Donald Never</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: system-ui, -apple-system, sans-serif;
      background: #f7f7f5;
      color: #1a1a1a;
      padding: 40px 20px;
    }

    .container {
      max-width: 680px;
      margin: 0 auto;
    }

    h1 {
      font-size: 20px;
      font-weight: 600;
      margin-bottom: 8px;
      color: #111;
    }

    .subtitle {
      font-size: 13px;
      color: #888;
      margin-bottom: 32px;
    }

    /* ── Add form ── */

    .card {
      background: white;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      padding: 24px;
      margin-bottom: 28px;
    }

    .card h2 {
      font-size: 14px;
      font-weight: 600;
      color: #555;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-bottom: 12px;
    }

    .hint {
      font-size: 12px;
      color: #999;
      font-family: Georgia, serif;
      margin-bottom: 10px;
      display: block;
    }

    textarea {
      width: 100%;
      padding: 10px 12px;
      border: 1px solid #ddd;
      border-radius: 6px;
      font-size: 15px;
      font-family: Georgia, serif;
      resize: vertical;
      min-height: 72px;
      margin-bottom: 12px;
      transition: border-color 0.15s;
    }

    textarea:focus {
      outline: none;
      border-color: #c8a96e;
      box-shadow: 0 0 0 3px rgba(200,169,110,0.12);
    }

    .form-row {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    /* ── Buttons ── */

    button {
      padding: 8px 18px;
      border: none;
      border-radius: 5px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      transition: background 0.12s;
    }

    .btn-primary  { background: #c8a96e; color: white; }
    .btn-primary:hover  { background: #b8954e; }

    .btn-danger   { background: #e53935; color: white; font-size: 12px; padding: 5px 11px; }
    .btn-danger:hover   { background: #c62828; }

    .btn-edit     { background: #e8e8e8; color: #333; font-size: 12px; padding: 5px 11px; }
    .btn-edit:hover     { background: #d5d5d5; }

    .btn-save     { background: #2e7d32; color: white; font-size: 12px; padding: 5px 11px; }
    .btn-save:hover     { background: #1b5e20; }

    .btn-cancel   { background: #bbb; color: white; font-size: 12px; padding: 5px 11px; }
    .btn-cancel:hover   { background: #999; }

    /* ── Phrases list ── */

    .list-header {
      display: flex;
      align-items: baseline;
      gap: 8px;
      margin-bottom: 10px;
    }

    .list-header h2 {
      font-size: 14px;
      font-weight: 600;
      color: #555;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    .count {
      font-size: 12px;
      color: #aaa;
    }

    .phrases-list {
      background: white;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      overflow: hidden;
    }

    .phrase-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 13px 18px;
      border-bottom: 1px solid #f0f0f0;
    }

    .phrase-item:last-child { border-bottom: none; }

    .prefix {
      color: #bbb;
      font-size: 13px;
      font-family: Georgia, serif;
      white-space: nowrap;
      flex-shrink: 0;
    }

    .phrase-text {
      flex: 1;
      font-family: Georgia, serif;
      font-size: 15px;
      color: #222;
    }

    .actions { display: flex; gap: 6px; flex-shrink: 0; }

    .edit-input {
      flex: 1;
      padding: 5px 10px;
      font-size: 14px;
      font-family: Georgia, serif;
      border: 1px solid #c8a96e;
      border-radius: 4px;
    }

    .edit-input:focus {
      outline: none;
      box-shadow: 0 0 0 3px rgba(200,169,110,0.15);
    }

    .empty {
      padding: 40px;
      text-align: center;
      color: #aaa;
      font-size: 14px;
    }

    .flash {
      font-size: 13px;
      color: #2e7d32;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Donald Never</h1>
    <p class="subtitle">Admin — manage phrases</p>

    <div class="card">
      <h2>Add phrase</h2>
      <span class="hint">Everything after "Donald " — e.g. "has never read a book."</span>
      <textarea id="new-phrase" placeholder="has never…"></textarea>
      <div class="form-row">
        <button class="btn-primary" onclick="addPhrase()">Add phrase</button>
        <span id="flash" class="flash"></span>
      </div>
    </div>

    <div class="list-header">
      <h2>Phrases</h2>
      <span class="count" id="count"></span>
    </div>
    <div class="phrases-list" id="phrases-list">
      <div class="empty">Loading…</div>
    </div>
  </div>

  <script>
    let phrases = [];

    async function load() {
      const res = await fetch('/api/phrases');
      phrases = await res.json();
      render();
    }

    function render() {
      const list = document.getElementById('phrases-list');
      const countEl = document.getElementById('count');
      countEl.textContent = phrases.length + ' phrase' + (phrases.length !== 1 ? 's' : '');

      if (!phrases.length) {
        list.innerHTML = '<div class="empty">No phrases yet.</div>';
        return;
      }

      list.innerHTML = phrases.map(p => \`
        <div class="phrase-item" id="item-\${p.id}">
          <span class="prefix">Donald</span>
          <span class="phrase-text">\${esc(p.text)}</span>
          <div class="actions">
            <button class="btn-edit" onclick="startEdit(\${p.id})">Edit</button>
            <button class="btn-danger" onclick="deletePhrase(\${p.id})">Delete</button>
          </div>
        </div>
      \`).join('');
    }

    function esc(str) {
      return str
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function startEdit(id) {
      const item = document.getElementById('item-' + id);
      const phrase = phrases.find(p => p.id === id);
      item.innerHTML = \`
        <span class="prefix">Donald</span>
        <input class="edit-input" id="edit-\${id}" value="\${esc(phrase.text)}" />
        <div class="actions">
          <button class="btn-save" onclick="saveEdit(\${id})">Save</button>
          <button class="btn-cancel" onclick="render()">Cancel</button>
        </div>
      \`;
      const input = document.getElementById('edit-' + id);
      input.focus();
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter') saveEdit(id);
        if (e.key === 'Escape') render();
      });
    }

    async function saveEdit(id) {
      const text = document.getElementById('edit-' + id).value.trim();
      if (!text) return;
      await fetch('/api/phrases/' + id, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      await load();
    }

    async function deletePhrase(id) {
      const phrase = phrases.find(p => p.id === id);
      if (!confirm('Delete "Donald ' + phrase.text + '"?')) return;
      await fetch('/api/phrases/' + id, { method: 'DELETE' });
      await load();
    }

    async function addPhrase() {
      const el = document.getElementById('new-phrase');
      const text = el.value.trim();
      if (!text) return;
      await fetch('/api/phrases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      el.value = '';
      const flash = document.getElementById('flash');
      flash.textContent = 'Added!';
      setTimeout(() => { flash.textContent = ''; }, 2000);
      await load();
    }

    document.getElementById('new-phrase').addEventListener('keydown', e => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) addPhrase();
    });

    load();
  </script>
</body>
</html>`;
}

// ─── API ──────────────────────────────────────────────────────────────────────

async function handleApi(request: Request, env: Env, pathname: string): Promise<Response> {
  const method = request.method;

  if (pathname === '/api/phrases' && method === 'GET') {
    const { results } = await env.DB.prepare(
      'SELECT id, text, created_at FROM phrases ORDER BY created_at DESC'
    ).all<{ id: number; text: string; created_at: string }>();
    return json(results);
  }

  if (pathname === '/api/phrases' && method === 'POST') {
    const body = await request.json<{ text?: string }>();
    const text = body?.text?.trim();
    if (!text) return json({ error: 'text required' }, 400);
    const result = await env.DB.prepare(
      'INSERT INTO phrases (text) VALUES (?)'
    ).bind(text).run();
    return json({ id: result.meta.last_row_id, text }, 201);
  }

  const phraseIdMatch = pathname.match(/^\/api\/phrases\/(\d+)$/);
  if (phraseIdMatch) {
    const id = parseInt(phraseIdMatch[1], 10);

    if (method === 'PUT') {
      const body = await request.json<{ text?: string }>();
      const text = body?.text?.trim();
      if (!text) return json({ error: 'text required' }, 400);
      await env.DB.prepare('UPDATE phrases SET text = ? WHERE id = ?').bind(text, id).run();
      return json({ id, text });
    }

    if (method === 'DELETE') {
      await env.DB.prepare('DELETE FROM phrases WHERE id = ?').bind(id).run();
      return json({ ok: true });
    }
  }

  return json({ error: 'Not found' }, 404);
}

// ─── Router ───────────────────────────────────────────────────────────────────

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const { pathname, method } = { pathname: url.pathname, method: request.method };

    if (pathname === '/' && method === 'GET') {
      return serveHome(env);
    }

    if (pathname === '/admin' && method === 'GET') {
      const authErr = checkAuth(request, env);
      if (authErr) return authErr;
      return html(adminHtml());
    }

    if (pathname.startsWith('/api/')) {
      const authErr = checkAuth(request, env);
      if (authErr) return authErr;
      return handleApi(request, env, pathname);
    }

    // Static assets (frame.jpg, etc.)
    return env.ASSETS.fetch(request);
  },
};
