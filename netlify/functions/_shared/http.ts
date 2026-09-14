import { request } from 'node:https';
import { lookup } from 'node:dns/promises';

export function publicIPv4(ip: string) {
  const p = ip.split('.').map(Number);
  return p.length === 4 && p.every(n => Number.isInteger(n) && n >= 0 && n <= 255) &&
    ![0,10,127].includes(p[0]) && p[0] < 224 &&
    !(p[0] === 169 && p[1] === 254) && !(p[0] === 172 && p[1] >= 16 && p[1] <= 31) &&
    !(p[0] === 192 && [0,168].includes(p[1])) && !(p[0] === 100 && p[1] >= 64 && p[1] <= 127) &&
    !(p[0] === 198 && [18,19].includes(p[1]));
}
/** Resolve, validate, and pin DNS on every redirect; stream with a hard byte limit. */
export async function safeGet(input: string, maxBytes = 2_000_000, redirects = 0): Promise<{ text: string; url: string; type: string }> {
  const u = new URL(input);
  if (u.protocol !== 'https:' || u.username || u.password || (u.port && u.port !== '443') || redirects > 3) throw new Error('URL HTTPS publique requise.');
  const addresses = await lookup(u.hostname, { all: true, family: 4 });
  if (!addresses.length || addresses.some(a => !publicIPv4(a.address))) throw new Error('Adresse réseau non autorisée.');
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => req.destroy(new Error('Délai dépassé.')), 8000);
    const req = request(u, { lookup: ((_h: any, options: any, cb: any) => options?.all ? cb(null, [addresses[0]]) : cb(null, addresses[0].address, 4)) as any,
      headers: { accept: 'text/html,application/json,text/csv', 'user-agent': 'PatrimoineIA/1.0', 'accept-encoding': 'identity' } }, res => {
      if ([301,302,303,307,308].includes(res.statusCode ?? 0) && res.headers.location) {
        res.resume(); clearTimeout(timer);
        safeGet(new URL(res.headers.location, u).href, maxBytes, redirects + 1).then(resolve, reject); return;
      }
      if (res.statusCode !== 200) { res.resume(); clearTimeout(timer); reject(new Error(`Source indisponible (HTTP ${res.statusCode}).`)); return; }
      let size = 0; const chunks: Buffer[] = [];
      res.on('data', (b: Buffer) => { size += b.length; if (size > maxBytes) req.destroy(new Error('Réponse trop volumineuse.')); else chunks.push(b); });
      res.on('end', () => { clearTimeout(timer); resolve({ text: Buffer.concat(chunks).toString('utf8'), url: u.href, type: String(res.headers['content-type'] ?? '') }); });
      res.on('error', reject);
    });
    req.on('error', e => { clearTimeout(timer); reject(e); }); req.end();
  });
}
