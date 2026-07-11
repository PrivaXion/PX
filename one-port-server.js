const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 5005;


// --- upstreams ---
const JSON_SERVER_ORIGIN = 'http://localhost:8081';
const SIGNAL_ORIGIN = 'http://localhost:5560';

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
};

function safeJoin(baseDir, reqUrlPath) {
  const clean = reqUrlPath.replace(/\/+/, '/').replace(/^\//, '');
  const filePath = path.join(baseDir, clean);
  if (!filePath.startsWith(baseDir)) return null;
  return filePath;
}

function readFile(res, filePath) {
  fs.readFile(filePath, (err, buf) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
        return;
      }
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Internal Server Error: ' + err.code);
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(buf);
  });
}

function proxyRequest(req, res, upstreamOrigin, upstreamPath) {
  const targetUrl = new URL(upstreamOrigin + upstreamPath);

  const options = {
    method: req.method,
    headers: {
      ...req.headers,
      host: targetUrl.host
    }
  };

  const proxyReq = http.request(targetUrl, options, (proxyRes) => {
    // CORS for browser clients (so phones can call)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
    proxyRes.pipe(res);
  });

  proxyReq.on('error', () => {
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Upstream not available', upstream: upstreamOrigin }));
  });

  req.pipe(proxyReq);
}

const server = http.createServer((req, res) => {
  // Handle preflight quickly
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }

  const urlObj = new URL(req.url, `http://${req.headers.host}`);
  const pathname = urlObj.pathname;

  // Proxy json-server endpoints
  if (pathname === '/users' || pathname.startsWith('/users?') || pathname.startsWith('/users/') ||
      pathname === '/news' || pathname.startsWith('/news?') || pathname.startsWith('/news/') ||
      pathname === '/rooms' || pathname.startsWith('/rooms?') || pathname.startsWith('/rooms/') ||
      pathname === '/messages' || pathname.startsWith('/messages/') ||
      pathname === '/sessions' || pathname.startsWith('/sessions/')) {
    proxyRequest(req, res, JSON_SERVER_ORIGIN, urlObj.pathname + urlObj.search);
    return;
  }

  // Proxy signal-server endpoints
  if (pathname === '/events' || pathname === '/signal') {
    proxyRequest(req, res, SIGNAL_ORIGIN, urlObj.pathname + urlObj.search);
    return;
  }

  // Serve static UI (index + assets)
  // If directory or empty path => index.html
  const baseDir = __dirname;
  const reqPath = pathname === '/' ? '/index.html' : pathname;
  const filePath = safeJoin(baseDir, reqPath);
  if (!filePath) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  readFile(res, filePath);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`One-port server running at http://localhost:${PORT}/`);
  console.log(`UI static + proxy to:
- json-server: ${JSON_SERVER_ORIGIN}
- signal-server: ${SIGNAL_ORIGIN}`);
});

