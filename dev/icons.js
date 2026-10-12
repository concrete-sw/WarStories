// Draws the home-screen icon (a red shield with a pale star on dark paper)
// straight into a PNG, with no browser and no image library.

import { deflateSync } from 'node:zlib';

function crc32(buf) {
  let c, crc = 0xFFFFFFFF;
  for (let n = 0; n < buf.length; n++) { c = (crc ^ buf[n]) & 0xFF; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; crc = (crc >>> 8) ^ c; }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td), 0);
  return Buffer.concat([len, td, crc]);
}

function inPoly(x, y, pts) { let inside = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside; } return inside; }

// Geometry in a 64-unit square.
const SHIELD = (() => { const p = [[32, 6], [56, 16], [56, 34]]; for (let t = 0; t <= 1.0001; t += 0.1) { const a = t * Math.PI / 2; p.push([32 + 24 * Math.cos(a), 34 + 24 * Math.sin(a) * 1.08]); } p.push([32, 60]); for (let t = 1; t >= -0.0001; t -= 0.1) { const a = t * Math.PI / 2; p.push([32 - 24 * Math.cos(a), 34 + 24 * Math.sin(a) * 1.08]); } p.push([8, 34], [8, 16]); return p; })();
const INNER = SHIELD.map(([x, y]) => [32 + (x - 32) * 0.86, 33 + (y - 33) * 0.86]);
const STAR = (() => { const p = []; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5; const r = i % 2 ? 5.2 : 12.5; p.push([32 + r * Math.cos(a), 31 + r * Math.sin(a)]); } return p; })();

function colorAt(x, y) {
  const r = 10, inBox = !((x < r && y < r && Math.hypot(x - r, y - r) > r) || (x > 64 - r && y < r && Math.hypot(x - 64 + r, y - r) > r) || (x < r && y > 64 - r && Math.hypot(x - r, y - 64 + r) > r) || (x > 64 - r && y > 64 - r && Math.hypot(x - 64 + r, y - 64 + r) > r));
  if (!inBox) return [0, 0, 0, 0];
  if (inPoly(x, y, STAR)) return [233, 223, 196, 255];
  if (inPoly(x, y, INNER)) return [139, 26, 26, 255];
  if (inPoly(x, y, SHIELD)) return [233, 223, 196, 255];
  return [43, 36, 24, 255];
}

export function makePng(size) {
  const ss = 3;
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let py = 0; py < size; py++) {
    raw[py * (size * 4 + 1)] = 0;
    for (let px = 0; px < size; px++) {
      let R = 0, G = 0, B = 0, A = 0;
      for (let sy = 0; sy < ss; sy++) for (let sx = 0; sx < ss; sx++) {
        const [r, g, b, a] = colorAt((px + (sx + 0.5) / ss) * 64 / size, (py + (sy + 0.5) / ss) * 64 / size);
        R += r * a; G += g * a; B += b * a; A += a;
      }
      const o = py * (size * 4 + 1) + 1 + px * 4;
      raw[o] = A ? Math.round(R / A) : 0; raw[o + 1] = A ? Math.round(G / A) : 0; raw[o + 2] = A ? Math.round(B / A) : 0; raw[o + 3] = Math.round(A / (ss * ss));
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
