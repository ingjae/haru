import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const files = { '/menubar.js': ['menubar.js', 'text/javascript'], '/': ['index.html', 'text/html'], '/app.js': ['app.js', 'text/javascript'], '/style.css': ['style.css', 'text/css'], '/calendar.js': ['calendar.js', 'text/javascript'] };
const server = http.createServer(async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.url === '/config') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ clientId: process.env.GOOGLE_CLIENT_ID || '' }));
  }
  const entry = files[req.url];
  if (!entry) { res.writeHead(404); return res.end('Not found'); }
  try {
    const body = await readFile(fileURLToPath(new URL(`./public/${entry[0]}`, import.meta.url)));
    res.writeHead(200, { 'Content-Type': `${entry[1]}; charset=utf-8` }); res.end(body);
  } catch { res.writeHead(500); res.end('Unable to load application'); }
});
server.listen(Number(process.env.PORT || 3000), '127.0.0.1', () => console.log('Scheduler listening on port ' + (process.env.PORT || 3000)));
