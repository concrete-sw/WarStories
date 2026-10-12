// The map grid. The scenario names terrain features with simple geometry
// ("woods, area C3:F6", "road through A4, H4, P5", "Hill 30 at C2, radius 2");
// this module rasterises them into squares with terrain, elevation, roads and
// water, and answers the questions the simulation asks: where is C4, how far
// is it, can this square see that one, what is the best way there.

import { TERRAIN, FEATURE_TERRAIN, LINE_FEATURES } from '../data/terrain.js';
import { seededRandom, clamp, asArray, str } from './util.js';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export function refOf(n, idx) { if (idx == null || idx < 0) return '—'; const c = idx % n, r = Math.floor(idx / n); return `${LETTERS[c]}${r + 1}`; }
export function colRow(n, idx) { return { c: idx % n, r: Math.floor(idx / n) }; }
export function idxOf(n, c, r) { return (c < 0 || r < 0 || c >= n || r >= n) ? -1 : r * n + c; }

/** "C4", "c-4", "C 04", "grid C4" -> index, or -1. */
export function parseRef(n, text) {
  const m = /\b([A-Za-z])\s*-?\s*(\d{1,2})\b/.exec(String(text || '').replace(/^grid\s+/i, ''));
  if (!m) return -1;
  const c = LETTERS.indexOf(m[1].toUpperCase()), r = Number(m[2]) - 1;
  return idxOf(n, c, r);
}
export const isRef = (n, s) => /^\s*[A-Za-z]\s*-?\s*\d{1,2}\s*$/.test(String(s || '')) && parseRef(n, s) >= 0;

/** Parse "C3:F6" into a rectangle of indices. */
function rectCells(n, spec) {
  const [a, b] = String(spec).split(/[:\-–]|\s+to\s+/i).map(s => parseRef(n, s));
  if (a < 0) return [];
  if (b == null || b < 0) return [a];
  const A = colRow(n, a), B = colRow(n, b);
  const out = [];
  for (let r = Math.min(A.r, B.r); r <= Math.max(A.r, B.r); r++) for (let c = Math.min(A.c, B.c); c <= Math.max(A.c, B.c); c++) out.push(idxOf(n, c, r));
  return out;
}

/** Cells along a straight line (Bresenham), inclusive. */
export function lineCells(n, a, b) {
  const A = colRow(n, a), B = colRow(n, b);
  const out = [];
  let x0 = A.c, y0 = A.r; const x1 = B.c, y1 = B.r;
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (let guard = 0; guard < 400; guard++) {
    out.push(idxOf(n, x0, y0));
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
  return out;
}

/** A 4-connected version of a line, so a river or road has no diagonal gaps. */
function solidLine(n, a, b) {
  const pts = lineCells(n, a, b);
  const out = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const p = colRow(n, out[out.length - 1]), q = colRow(n, pts[i]);
    if (p.c !== q.c && p.r !== q.r) out.push(idxOf(n, q.c, p.r));
    out.push(pts[i]);
  }
  return out;
}

export function distance(n, a, b) { const A = colRow(n, a), B = colRow(n, b); return Math.hypot(A.c - B.c, A.r - B.r); }
export function bearing(n, a, b) { const A = colRow(n, a), B = colRow(n, b); const deg = Math.atan2(B.c - A.c, -(B.r - A.r)) * 180 / Math.PI; return (deg + 360) % 360; }
export function compass(deg) { return ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(deg / 45) % 8]; }
export function neighbours(n, idx, diag = true) {
  const { c, r } = colRow(n, idx); const out = [];
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
    if (!dr && !dc) continue; if (!diag && dr && dc) continue;
    const j = idxOf(n, c + dc, r + dr); if (j >= 0) out.push(j);
  }
  return out;
}

/**
 * Build the grid from the scenario's terrain spec:
 *   { size, base, features: [{ id, name, type, area | cells | line | at, radius, elevation }] }
 * Returns { n, cells: [{ t, elev, road, rail, water, bridge, ford, features: [ids] }], features: [{ ...f, cells, label }] }.
 */
export function buildGrid(spec, seed = 'grid') {
  const n = clamp(Math.round(Number(spec?.size) || 16), 10, 20);
  const base = TERRAIN[spec?.base] ? spec.base : 'field';
  const rnd = seededRandom(`${seed}:terrain`);
  const cells = Array.from({ length: n * n }, () => ({ t: base, elev: 0, road: false, rail: false, water: false, stream: false, bridge: false, ford: false, mines: false, wire: false, features: [] }));
  const features = [];
  const fs = asArray(spec?.features);
  // Areas first, then lines over them, then points; elevation last.
  const order = f => { const ty = str(f?.type).toLowerCase(); if (asArray(f?.line).length) return 1; if (['hill', 'ridge', 'mountain'].includes(ty)) return 3; if (f?.at && !(Number(f.radius) > 0) && !FEATURE_TERRAIN[ty]) return 2; return 0; };
  const sorted = fs.map((f, i) => ({ f, i })).sort((a, b) => order(a.f) - order(b.f) || a.i - b.i);
  for (const { f, i } of sorted) {
    if (!f || typeof f !== 'object') continue;
    const type = str(f.type).toLowerCase().trim();
    const id = str(f.id) || `f${i + 1}`;
    const out = { id, name: str(f.name) || type || 'feature', type, cells: [], label: -1, elevation: Number(f.elevation) || 0, note: str(f.note || f.description) };
    const line = asArray(f.line).map(x => parseRef(n, x)).filter(x => x >= 0);
    if (line.length >= 2 || (LINE_FEATURES.includes(type) && line.length)) {
      let path = [];
      for (let k = 0; k < line.length - 1; k++) { const seg = solidLine(n, line[k], line[k + 1]); path.push(...(k ? seg.slice(1) : seg)); }
      if (line.length === 1) path = [line[0]];
      out.cells = [...new Set(path)];
      for (const j of out.cells) applyFeature(cells[j], type, id);
      if (type === 'ridge') for (const j of out.cells) raise(cells, n, j, Math.max(1, out.elevation || 1), 1);
      out.label = out.cells[Math.floor(out.cells.length / 2)];
    } else {
      let area = [];
      if (f.area) area = rectCells(n, f.area);
      else if (asArray(f.cells).length) area = asArray(f.cells).map(x => parseRef(n, x)).filter(x => x >= 0);
      else if (f.at) {
        const at = parseRef(n, f.at);
        const rad = clamp(Number(f.radius) || 0, 0, 5);
        if (at >= 0) {
          if (['hill', 'ridge', 'mountain'].includes(type)) { raise(cells, n, at, clamp(Math.round(Number(f.elevation) || 2), 1, 4), Math.max(1, rad || 2)); area = [at]; if (type === 'mountain') area = cellsWithin(n, at, rad || 1); }
          else area = rad > 0 ? cellsWithin(n, at, rad + (rnd() - 0.5) * 0.6) : [at];
        }
      }
      if (area.length > 3 && FEATURE_TERRAIN[type]) area = roughen(n, area, rnd);
      out.cells = [...new Set(area)];
      if (!['hill', 'ridge'].includes(type)) for (const j of out.cells) applyFeature(cells[j], type, id);
      else for (const j of out.cells) cells[j].features.push(id);
      const cen = centroid(n, out.cells);
      out.label = cen;
    }
    if (out.cells.length) features.push(out);
  }
  // Roads that cross water get a bridge unless the scenario said otherwise.
  for (const c of cells) if (c.road && c.water && !c.ford) c.bridge = true;
  return { n, cells, features };
}

function applyFeature(cell, type, id) {
  cell.features.push(id);
  const t = FEATURE_TERRAIN[type];
  if (type === 'road' || type === 'track' || type === 'crossroads') { cell.road = true; return; }
  if (type === 'railway') { cell.rail = true; return; }
  if (type === 'bridge') { cell.bridge = true; cell.road = true; return; }
  if (type === 'ford') { cell.ford = true; return; }
  if (type === 'stream') { cell.stream = true; return; }
  if (type === 'minefield') { cell.mines = true; return; }
  if (type === 'wire') { cell.wire = true; cell.t = cell.t === 'open' || cell.t === 'field' ? 'rubble' : cell.t; return; }
  if (t === 'water') { cell.water = true; cell.t = 'water'; return; }
  if (t && TERRAIN[t]) cell.t = t;
}

function raise(cells, n, at, height, radius) {
  const { c, r } = colRow(n, at);
  for (let dr = -radius - 1; dr <= radius + 1; dr++) for (let dc = -radius - 1; dc <= radius + 1; dc++) {
    const j = idxOf(n, c + dc, r + dr); if (j < 0) continue;
    const d = Math.hypot(dc, dr);
    const h = Math.round(height * (1 - d / (radius + 1)));
    if (h > cells[j].elev) cells[j].elev = h;
  }
}

function cellsWithin(n, at, rad) {
  const { c, r } = colRow(n, at); const out = [];
  const R = Math.ceil(rad);
  for (let dr = -R; dr <= R; dr++) for (let dc = -R; dc <= R; dc++) { const j = idxOf(n, c + dc, r + dr); if (j >= 0 && Math.hypot(dc, dr) <= rad + 0.01) out.push(j); }
  return out;
}

/** Make a rectangle look like ground: bite the edges, let it spill a little. */
function roughen(n, area, rnd) {
  const set = new Set(area);
  const edge = area.filter(j => neighbours(n, j, false).some(k => !set.has(k)));
  for (const j of edge) if (rnd() < 0.22 && set.size > 4) set.delete(j);
  for (const j of edge) for (const k of neighbours(n, j, false)) if (!set.has(k) && rnd() < 0.12) set.add(k);
  return [...set];
}

function centroid(n, list) {
  if (!list.length) return -1;
  let sc = 0, sr = 0; for (const j of list) { const p = colRow(n, j); sc += p.c; sr += p.r; }
  const target = idxOf(n, Math.round(sc / list.length), Math.round(sr / list.length));
  // Prefer a member cell near the centroid so labels sit on the feature.
  let best = list[0], bd = Infinity; for (const j of list) { const d = distance(n, j, target); if (d < bd) { bd = d; best = j; } }
  return best;
}

export function terrainAt(grid, idx) { return TERRAIN[grid.cells[idx]?.t] || TERRAIN.open; }

/** Line of sight between two squares: woods, villages and higher ground in between block it. */
export function hasLOS(grid, a, b) {
  if (a === b) return true;
  const { n, cells } = grid;
  const path = lineCells(n, a, b);
  const ea = cells[a].elev, eb = cells[b].elev;
  const lo = Math.min(ea, eb), hi = Math.max(ea, eb);
  for (let i = 1; i < path.length - 1; i++) {
    const c = cells[path[i]];
    if (c.elev > hi) return false;
    if (TERRAIN[c.t]?.block && c.elev >= lo && !(ea > c.elev && eb > c.elev)) {
      // Looking down from high ground over woods to low ground two squares away still works.
      if (!(hi - c.elev >= 2)) return false;
    }
  }
  return true;
}

/** Movement factor for a mobility class on a square (0 means impassable). */
export function moveFactor(grid, idx, mobility = 'foot') {
  const c = grid.cells[idx]; const t = TERRAIN[c.t] || TERRAIN.open;
  if (mobility === 'air') return 1;
  const veh = mobility !== 'foot' && mobility !== 'light';
  if (c.water && !c.bridge) return c.ford ? (veh ? 0.25 : 0.35) : 0;
  let f = veh ? t.veh : t.foot;
  if (mobility === 'light') f = Math.max(f, (t.foot + t.veh) / 2);
  if (c.road || c.bridge) f = veh ? Math.max(f, 1.6) : Math.max(f, 1.15);
  if (c.stream) f *= veh ? 0.4 : 0.7;
  if (c.wire) f *= veh ? 0.7 : 0.35;
  if (c.elev >= 2) f *= 0.85;
  return f;
}

/** A* over the grid. Returns the list of squares from a to b (excluding a), or [] when there is no way. */
export function findPath(grid, a, b, mobility = 'foot', avoid = null) {
  if (a === b) return [];
  const { n } = grid;
  const open = new Map([[a, 0]]); const g = new Map([[a, 0]]); const from = new Map();
  const h = j => distance(n, j, b) * 0.6;
  for (let guard = 0; guard < n * n * 8 && open.size; guard++) {
    let cur = null, best = Infinity;
    for (const [j, f] of open) if (f < best) { best = f; cur = j; }
    open.delete(cur);
    if (cur === b) break;
    for (const k of neighbours(n, cur)) {
      const mf = moveFactor(grid, k, mobility);
      if (mf <= 0 && k !== b) continue;
      const diag = (k % n !== cur % n) && (Math.floor(k / n) !== Math.floor(cur / n)) ? 1.414 : 1;
      const cost = diag / Math.max(0.08, mf) + (avoid?.has(k) ? 6 : 0);
      const ng = g.get(cur) + cost;
      if (ng < (g.get(k) ?? Infinity)) { g.set(k, ng); from.set(k, cur); open.set(k, ng + h(k)); }
    }
  }
  if (!from.has(b)) return [];
  const path = [b]; let cur = b;
  while (from.get(cur) !== a && from.has(cur)) { cur = from.get(cur); path.push(cur); }
  return path.reverse();
}

/** Era-flavoured full grid reference for a square (used in cell details and radio traffic). */
export function fullRef(state, idx) {
  const { n } = state.grid; const { c, r } = colRow(n, idx);
  const cellM = state.scale?.cellM || 100;
  const o = state.gridOrigin || { e: 431000, n: 5462000, zone: '31U', sq: 'FV', sheet: '57c' };
  const e = o.e + c * cellM + cellM / 2, no = o.n + (n - 1 - r) * cellM + cellM / 2;
  const tech = state.era?.tech || 2;
  if (tech <= 1) return `Sheet ${o.sheet} · sq ${refOf(n, idx)}`;
  if (tech <= 4) return `${String(Math.floor(e / 100) % 1000).padStart(3, '0')}${String(Math.floor(no / 100) % 1000).padStart(3, '0')}`;
  return `${o.zone} ${o.sq} ${String(Math.floor(e / 10) % 10000).padStart(4, '0')} ${String(Math.floor(no / 10) % 10000).padStart(4, '0')}`;
}

/** Human description of a square: "C4 · woods, elevation 1 · Bois de Rots". */
export function describeCell(state, idx) {
  const g = state.grid; const c = g.cells[idx]; if (!c) return '';
  const names = c.features.map(id => g.features.find(f => f.id === id)?.name).filter(Boolean);
  const bits = [TERRAIN[c.t]?.name || c.t];
  if (c.elev) bits.push(`elevation ${c.elev}`);
  if (c.road) bits.push('road'); if (c.bridge) bits.push('bridge'); if (c.ford) bits.push('ford'); if (c.stream) bits.push('stream');
  return `${refOf(g.n, idx)} · ${bits.join(', ')}${names.length ? ` · ${[...new Set(names)].join(', ')}` : ''}`;
}

/** Find a feature by (fuzzy) name. */
export function findFeature(grid, text) {
  const t = String(text || '').toLowerCase().replace(/^the\s+/, '').trim();
  if (t.length < 3) return null;
  return grid.features.find(f => f.name.toLowerCase() === t) || grid.features.find(f => f.name.toLowerCase().includes(t)) || grid.features.find(f => t.includes(f.name.toLowerCase().replace(/^the\s+/, ''))) || null;
}
