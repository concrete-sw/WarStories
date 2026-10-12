// Bundles src/ into one self-contained index.html at the top of the repository
// that works when double-clicked (file://), and packs WarStories.zip next to it.
// Browsers refuse to load ES modules from local files, so every module is
// wrapped in a function and inlined as one classic script; the stylesheet is
// inlined too. It also draws the home-screen icons and writes the web app
// manifest used when the game is hosted for phones.
//
//   node dev/build.js

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateRawSync } from 'node:zlib';
import { makePng } from './icons.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');
const src = path.join(root, 'src');
const out = path.join(root, 'index.html');

const modules = new Map(); // abs path -> { code, deps, exports }
const IMPORT_RE = /^import\s+(\{[^}]*\}|\*\s+as\s+\w+)\s+from\s+'([^']+)';\s*$/gm;

function load(file) {
  if (modules.has(file)) return;
  let code = readFileSync(file, 'utf8');
  const deps = []; const prologue = [];
  code = code.replace(IMPORT_RE, (m, what, spec) => {
    const dep = path.resolve(path.dirname(file), spec);
    deps.push(dep);
    const ref = `__m[${JSON.stringify(path.relative(src, dep))}]`;
    if (what.startsWith('*')) prologue.push(`const ${what.replace(/\*\s+as\s+/, '')} = ${ref};`);
    else prologue.push(`const ${what.replace(/\s+as\s+/g, ': ')} = ${ref};`);
    return '';
  });
  const exports = [];
  code = code.replace(/^export\s+(async\s+function\*?|function\*?|class|const|let)\s+([$\w]+)/gm, (m, kind, name) => { exports.push(name); return `${kind} ${name}`; });
  // Export lists: export { a, b as c };
  code = code.replace(/^export\s*\{([^}]*)\};?\s*$/gm, (m, list) => {
    for (const part of list.split(',').map(x => x.trim()).filter(Boolean)) { const [local, as] = part.split(/\s+as\s+/); exports.push(as ? `${as}: ${local}` : local); }
    return '';
  });
  if (/^export\s/m.test(code)) throw new Error(`Unhandled export form in ${file}`);
  if (/^import\s/m.test(code)) throw new Error(`Unhandled import form in ${file} (imports must be single-line)`);
  modules.set(file, { code: prologue.join('\n') + '\n' + code, deps, exports });
  for (const d of deps) load(d);
}

const entry = path.join(src, 'js', 'main.js');
load(entry);

// Dependency order (post-order DFS), refusing import cycles: a module would run before what it needs.
const ordered = []; const seen = new Set(); const stack = new Set();
function visit(f) {
  if (stack.has(f)) throw new Error(`Import cycle through ${path.relative(src, f)}`);
  if (seen.has(f)) return;
  stack.add(f); for (const d of modules.get(f).deps) visit(d); stack.delete(f);
  seen.add(f); ordered.push(f);
}
visit(entry);

let js = '"use strict";\nconst __m = {};\n';
for (const f of ordered) {
  const m = modules.get(f);
  const key = JSON.stringify(path.relative(src, f));
  js += `\n// ---- ${path.relative(src, f)} ----\n__m[${key}] = (() => {\n${m.code}\nreturn { ${[...new Set(m.exports)].join(', ')} };\n})();\n`;
}

let html = readFileSync(path.join(src, 'index.html'), 'utf8');
const css = readFileSync(path.join(src, 'css', 'style.css'), 'utf8');
// Function replacers: a string replacement would treat "$$" in the code as an escape.
html = html.replace('<link rel="stylesheet" href="css/style.css">', () => `<style>\n${css}\n</style>`);
html = html.replace('<script type="module" src="js/main.js"></script>', () => `<script>\n${js.replace(/<\/script/gi, '<\\/script')}\n</script>`);
html = html.replace('<head>', () => '<head>\n<!-- BUILT FILE: edit the sources in src/ and run: node dev/build.js -->');
if (html.includes('src="js/main.js"') || html.includes('href="css/style.css"')) throw new Error('Build did not inline the script or the stylesheet');
writeFileSync(out, html);

// Icons and manifest for "Add to Home Screen" when hosted.
const icons = { 'icon-192.png': makePng(192), 'icon-512.png': makePng(512), 'icon-180.png': makePng(180) };
for (const [name, buf] of Object.entries(icons)) writeFileSync(path.join(root, name), buf);
const manifest = {
  name: 'War Stories · Chain of Command', short_name: 'War Stories', description: 'A military command roleplay game with an AI Game Master.',
  start_url: './index.html', scope: './', display: 'fullscreen', orientation: 'any', background_color: '#2b2418', theme_color: '#2b2418',
  icons: [{ src: 'icon-192.png', sizes: '192x192', type: 'image/png' }, { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }]
};
writeFileSync(path.join(root, 'manifest.webmanifest'), JSON.stringify(manifest, null, 2) + '\n');

// The download: one ZIP with the game in a folder.
const readme = `WAR STORIES · CHAIN OF COMMAND\r\n\r\n1. Unzip this folder anywhere.\r\n2. Double-click index.html. It opens in your web browser (Chrome, Edge, Firefox or Safari).\r\n3. Pick your AI provider, paste your own API key, click "Report for duty".\r\n\r\nFor phones: host the folder (Netlify Drop, Cloudflare Pages or GitHub Pages) and open the link; see the README on GitHub.\r\nEverything in the game is fiction.\r\n`;
const zip = makeZip([
  ['WarStories/index.html', Buffer.from(html, 'utf8')],
  ['WarStories/README.txt', Buffer.from(readme, 'utf8')],
  ['WarStories/manifest.webmanifest', Buffer.from(JSON.stringify(manifest, null, 2) + '\n', 'utf8')],
  ...Object.entries(icons).map(([n, b]) => [`WarStories/${n}`, b])
]);
writeFileSync(path.join(root, 'WarStories.zip'), zip);
console.log(`built index.html (${(html.length / 1024).toFixed(0)} KB, ${ordered.length} modules) and WarStories.zip (${(zip.length / 1024).toFixed(0)} KB)`);

// ---------------------------------------------------------------- a small ZIP writer
function crc32(buf) {
  let c, crc = 0xFFFFFFFF;
  for (let n = 0; n < buf.length; n++) { c = (crc ^ buf[n]) & 0xFF; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; crc = (crc >>> 8) ^ c; }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}
function makeZip(files) {
  const parts = []; const central = []; let offset = 0;
  const d = new Date(); const dosTime = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1); const dosDate = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  for (const [name, data] of files) {
    const nameBuf = Buffer.from(name, 'utf8');
    const comp = deflateRawSync(data, { level: 9 });
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6); local.writeUInt16LE(8, 8);
    local.writeUInt16LE(dosTime, 10); local.writeUInt16LE(dosDate, 12); local.writeUInt32LE(crc, 14); local.writeUInt32LE(comp.length, 18); local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26); local.writeUInt16LE(0, 28);
    parts.push(local, nameBuf, comp);
    const cen = Buffer.alloc(46);
    cen.writeUInt32LE(0x02014b50, 0); cen.writeUInt16LE(20, 4); cen.writeUInt16LE(20, 6); cen.writeUInt16LE(0x0800, 8); cen.writeUInt16LE(8, 10);
    cen.writeUInt16LE(dosTime, 12); cen.writeUInt16LE(dosDate, 14); cen.writeUInt32LE(crc, 16); cen.writeUInt32LE(comp.length, 20); cen.writeUInt32LE(data.length, 24);
    cen.writeUInt16LE(nameBuf.length, 28); cen.writeUInt16LE(0, 30); cen.writeUInt16LE(0, 32); cen.writeUInt16LE(0, 34); cen.writeUInt16LE(0, 36); cen.writeUInt32LE(0, 38); cen.writeUInt32LE(offset, 42);
    central.push(cen, nameBuf);
    offset += local.length + nameBuf.length + comp.length;
  }
  const cenBuf = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(0, 4); end.writeUInt16LE(0, 6); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(cenBuf.length, 12); end.writeUInt32LE(offset, 16); end.writeUInt16LE(0, 20);
  return Buffer.concat([...parts, cenBuf, end]);
}
