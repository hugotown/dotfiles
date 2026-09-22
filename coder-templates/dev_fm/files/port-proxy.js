// Espeja cada puerto que escuche en el workspace en puerto+OFFSET, normalizando
// las cabeceras de host.
//
// Para que existe: Coder enruta <puerto>--<agente>--<workspace>--<usuario> y
// pasa el subdominio en Host y X-Forwarded-Host. Muchas herramientas de
// desarrollo (Vite sin allowedHosts, lavish-axi, servidores de review) llevan
// lista blanca de hosts y responden 403 a cualquier valor que no reconozcan.
// Este proceso reescribe ambas cabeceras a 127.0.0.1:<puerto>, que es lo que
// esas apps esperan, sin tocar su configuracion.
//
// Un solo proceso con N listeners, no N procesos. Descubre puertos nuevos solos
// y cierra los espejos cuando el servicio desaparece.

const http = require('http');
const { execSync } = require('child_process');

const OFFSET = parseInt(process.env.PORT_PROXY_OFFSET || '10000', 10);
const INTERVAL = parseInt(process.env.PORT_PROXY_INTERVAL || '5000', 10);
const mirrors = new Map(); // puerto destino -> servidor

function listening() {
  let out = '';
  try { out = execSync('ss -lntH 2>/dev/null', { encoding: 'utf8' }); } catch { return []; }
  const ports = new Set();
  for (const line of out.split('\n')) {
    const m = line.trim().split(/\s+/)[3];
    if (!m) continue;
    const p = parseInt(m.slice(m.lastIndexOf(':') + 1), 10);
    // Solo puertos de usuario, y nunca los espejos que creamos nosotros.
    if (p >= 1024 && p < OFFSET && p + OFFSET <= 65535) ports.add(p);
  }
  return [...ports];
}

function headers(h, target) {
  const o = Object.assign({}, h, { host: '127.0.0.1:' + target });
  delete o['x-forwarded-host'];
  delete o['x-forwarded-proto'];
  delete o['x-forwarded-port'];
  delete o['origin'];
  return o;
}

function mirror(target) {
  const server = http.createServer((req, res) => {
    const up = http.request(
      { hostname: '127.0.0.1', port: target, path: req.url, method: req.method,
        headers: headers(req.headers, target) },
      r => { res.writeHead(r.statusCode, r.headers); r.pipe(res); }
    );
    up.on('error', e => { if (!res.headersSent) res.writeHead(502); res.end('port-proxy: ' + e.message); });
    req.pipe(up);
  });

  server.on('upgrade', (req, sock, head) => {
    const up = http.request({ hostname: '127.0.0.1', port: target, path: req.url,
                              method: req.method, headers: headers(req.headers, target) });
    up.on('upgrade', (r, s, h) => {
      sock.write('HTTP/1.1 101 Switching Protocols\r\n' +
        Object.entries(r.headers).map(e => e[0] + ': ' + e[1]).join('\r\n') + '\r\n\r\n');
      if (h && h.length) s.unshift(h);
      s.pipe(sock); sock.pipe(s);
    });
    up.on('error', () => sock.destroy());
    up.end();
  });

  server.on('error', () => { mirrors.delete(target); });
  server.listen(target + OFFSET, '0.0.0.0', () => {
    console.log(`[port-proxy] ${target + OFFSET} -> 127.0.0.1:${target}`);
  });
  return server;
}

function scan() {
  const now = new Set(listening());
  for (const p of now) if (!mirrors.has(p)) mirrors.set(p, mirror(p));
  for (const [p, s] of mirrors) {
    if (!now.has(p)) { s.close(); mirrors.delete(p); console.log(`[port-proxy] cerrado ${p + OFFSET}`); }
  }
}

scan();
setInterval(scan, INTERVAL);
