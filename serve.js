const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const port = process.env.PORT || 8000;
const root = process.cwd();

const mime = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.wasm': 'application/wasm',
};

function sendFile(res, filePath) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.statusCode = 500;
      res.end('Server error');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.setHeader('Content-Type', mime[ext] || 'application/octet-stream');
    res.setHeader('Cache-Control', 'no-store');
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url);
  let safePath = decodeURIComponent(parsed.pathname);
  if (safePath.includes('\0')) {
    res.statusCode = 400;
    res.end('Bad request');
    return;
  }
  if (safePath === '/') safePath = '/index.html';
  const filePath = path.join(root, safePath);

  if (!filePath.startsWith(root)) {
    res.statusCode = 403;
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err) {
      // Try serving index.html for SPA routes
      const index = path.join(root, 'index.html');
      fs.access(index, fs.constants.R_OK, (ie) => {
        if (!ie) return sendFile(res, index);
        res.statusCode = 404;
        res.end('Not found');
      });
      return;
    }
    if (stats.isDirectory()) {
      const index = path.join(filePath, 'index.html');
      fs.access(index, fs.constants.R_OK, (ie) => {
        if (!ie) return sendFile(res, index);
        res.statusCode = 404;
        res.end('Not found');
      });
      return;
    }
    sendFile(res, filePath);
  });
});

server.listen(port, () => {
  console.log(`Serving ${root} at http://localhost:${port}`);
});

module.exports = server;
