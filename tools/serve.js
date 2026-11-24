// 极简静态服务器：node tools/serve.js [port]
const http = require('http');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const port = Number(process.argv[2] || 8787);
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.wav': 'audio/wav', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg' };

http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/src/app/index.html';
  const fp = path.join(root, p);
  if (!fp.startsWith(root)) { res.writeHead(403); res.end(); return; }
  fs.readFile(fp, (err, buf) => {
    if (err) { res.writeHead(404); res.end('not found: ' + p); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(buf);
  });
}).listen(port, '127.0.0.1', () => console.log('http://127.0.0.1:' + port + '/'));