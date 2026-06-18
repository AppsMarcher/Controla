/* Servidor estático mínimo — sem dependências, sem build.
   Serve os arquivos crus da pasta do projeto em http://localhost:5173,
   com os tipos MIME corretos para os módulos ES funcionarem no navegador.
   Rode com:  node server.mjs   (o iniciar.bat faz isso por você) */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, normalize, join } from 'node:path';

const ROOT = process.cwd();
const PORT = 5173;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.mjs':  'text/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.webp': 'image/webp',
  '.ico':  'image/x-icon',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
  '.map':  'application/json; charset=utf-8'
};

async function tryRead(p) {
  try { return await readFile(p); } catch { return null; }
}

const server = createServer(async (req, res) => {
  let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  if (urlPath === '/' || urlPath.endsWith('/')) urlPath += 'index.html';

  // impede path traversal (../)
  const safe = normalize(urlPath).replace(/^([.][.][\/\\])+/, '');

  // tenta o caminho pedido; se não achar, tenta dentro de public/
  let data = await tryRead(join(ROOT, safe));
  if (data === null) data = await tryRead(join(ROOT, 'public', safe));

  if (data === null) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404 - ' + safe);
    return;
  }

  const type = MIME[extname(safe).toLowerCase()] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-cache' });
  res.end(data);
});

server.listen(PORT, () => {
  console.log('Controla Marcher rodando em http://localhost:' + PORT);
  console.log('Para parar: feche a janela ou pressione Ctrl+C.');
});
