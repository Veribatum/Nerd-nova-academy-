import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
const root = process.cwd();
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.json': 'application/json', '.pcap': 'application/vnd.tcpdump.pcap' };
const server = createServer(async (req, res) => {
  try {
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); return res.end(); }
    const requestPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (requestPath.split('/').some(part => part.startsWith('.')) || requestPath.includes('\\')) throw Error('Denied');
    let file = path.resolve(root, `.${requestPath}`);
    if (!file.startsWith(`${root}/`) && file !== root) throw Error('Denied');
    if ((await stat(file)).isDirectory()) file = path.join(file, 'index.html');
    const type = types[path.extname(file)]; if (!type) throw Error('Denied');
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch { res.writeHead(404); res.end('Not found'); }
});
const portFlag = process.argv.indexOf('--port');
const port = Number(portFlag >= 0 ? process.argv[portFlag + 1] : process.env.PORT || 5173);
server.listen(port, '0.0.0.0', () => process.stdout.write(`Academy preview: http://0.0.0.0:${port}\n`));
