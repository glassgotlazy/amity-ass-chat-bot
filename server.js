/*
 * Amity Lucknow Admission Assistant — local / Codespaces / any-Node-host server.
 *
 * The chatbot itself does not need this: index.html answers 159 topics
 * offline, straight from the filesystem. This server adds two things:
 *   - the AI fallback endpoints (/api/health, /api/ask), and
 *   - static file serving, so the page and the API share one origin.
 *
 *   node server.js          ->  http://localhost:3000
 *
 * On Vercel this file is NOT used. Vercel serves index.html statically and
 * runs api/ask.js and api/health.js as serverless functions instead. Both
 * paths share lib/assistant.js, so they behave identically.
 *
 * Requires: npm install
 * Configure: copy .env.example to .env and put your key in it.
 *   OPENAI_API_KEY=...      uses OpenAI      (OPENAI_MODEL, default gpt-4o-mini)
 *   ANTHROPIC_API_KEY=...   uses Claude      (ANTHROPIC_MODEL, default claude-opus-5)
 * Whichever key is set decides the provider; OpenAI wins if both are.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const assistant = require('./lib/assistant.js');   // also loads .env

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;

/* ======================================================================
   HELPERS
   ====================================================================== */
function sendJSON(res, status, body){
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type':'application/json; charset=utf-8',
    'Cache-Control':'no-store',
    'Content-Length': Buffer.byteLength(payload)
  });
  res.end(payload);
}

function readBody(req){
  return new Promise((resolve, reject) => {
    let data = '', size = 0;
    req.on('data', chunk => {
      size += chunk.length;
      if(size > 8192){ reject(new Error('too_large')); req.destroy(); return; }
      data += chunk;
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

/* ======================================================================
   STATIC FILES
   ====================================================================== */
const TYPES = {
  '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8',   '.json':'application/json; charset=utf-8',
  '.png':'image/png', '.jpg':'image/jpeg', '.svg':'image/svg+xml', '.ico':'image/x-icon',
  '.txt':'text/plain; charset=utf-8', '.md':'text/markdown; charset=utf-8'
};

function serveStatic(req, res){
  const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  const rel = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '');
  const file = path.resolve(ROOT, rel);

  if(file !== path.join(ROOT, 'index.html') && !file.startsWith(ROOT + path.sep)){
    res.writeHead(403, { 'Content-Type':'text/plain' }); res.end('Forbidden'); return;
  }
  if(path.basename(file) === '.env'){
    res.writeHead(403, { 'Content-Type':'text/plain' }); res.end('Forbidden'); return;
  }
  fs.readFile(file, (err, data) => {
    if(err){ res.writeHead(404, { 'Content-Type':'text/plain' }); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    res.end(data);
  });
}

/* ======================================================================
   SERVER
   ====================================================================== */
http.createServer((req, res) => {
  const url = (req.url || '/').split('?')[0];

  if(url === '/api/health'){ sendJSON(res, 200, assistant.health()); return; }

  if(url === '/api/ask'){
    if(req.method !== 'POST'){ sendJSON(res, 405, { error:'method_not_allowed' }); return; }
    (async () => {
      let body;
      try{ body = JSON.parse(await readBody(req) || '{}'); }
      catch(e){ sendJSON(res, 400, { error:'bad_request' }); return; }
      const result = await assistant.answer({
        question: body.question,
        topic: body.topic,
        ip: req.socket.remoteAddress || 'unknown'
      });
      sendJSON(res, result.status, result.body);
    })().catch(err => {
      console.error('[handler]', err);
      sendJSON(res, 500, { error:'upstream_error' });
    });
    return;
  }

  serveStatic(req, res);
}).listen(PORT, () => {
  const state = assistant.health();
  console.log('Amity admission assistant  ->  http://localhost:' + PORT);
  console.log(state.ai
    ? '  AI fallback: on  (' + state.provider + ' / ' + state.model + ', in-scope questions only)'
    : '  AI fallback: off (' + state.reason + ') — the offline knowledge base still works');
});
