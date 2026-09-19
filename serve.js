/*
 * Optional local static server — the chatbot itself needs nothing:
 * index.html runs straight from the filesystem, offline.
 * Use this only if you prefer serving it over http://localhost.
 *
 *   node serve.js        (then open http://localhost:3000)
 *
 * Zero dependencies: Node's built-in http/fs modules only.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const TYPES = {
  '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8',   '.json':'application/json; charset=utf-8',
  '.png':'image/png', '.jpg':'image/jpeg', '.svg':'image/svg+xml', '.ico':'image/x-icon'
};

http.createServer((req, res) => {
  const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  const rel = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '');
  const file = path.join(ROOT, rel);

  // never serve outside the project directory
  if(!file.startsWith(ROOT + path.sep) && file !== path.join(ROOT, 'index.html')){
    res.writeHead(403).end('Forbidden');
    return;
  }
  fs.readFile(file, (err, data) => {
    if(err){
      res.writeHead(404, { 'Content-Type':'text/plain' }).end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    res.end(data);
  });
}).listen(PORT, () => {
  console.log('Amity admission chatbot: http://localhost:' + PORT);
});
