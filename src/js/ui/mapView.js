// The operations map, drawn in SVG from state: terrain shading and contours,
// roads and water, named features, the grid with its letters and numbers,
// control measures, friendly units where they report being, enemy contacts
// where they were seen (with confidence and age), pending fire, routes. In the
// after-action review it can lay the truth over the picture and replay the
// battle. Scroll or pinch to zoom, drag to pan, tap a square, long-press to
// place a control measure.

import { TERRAIN } from '../data/terrain.js';
import { refOf, colRow } from '../engine/grid.js';
import { friendlyUnits, enemyUnits, liveUnit } from '../engine/state.js';
import { unitSymbol, svgEl } from './symbols.js';
import { clamp } from '../engine/util.js';

const C = 10; // map units per grid square
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function defs(svg, dark) {
  const d = svgEl('defs');
  const ink = dark ? '#9fb39a' : '#3f5a2e';
  const pat = (id, w, h, ...kids) => { const p = svgEl('pattern', { id, width: w, height: h, patternUnits: 'userSpaceOnUse' }); kids.forEach(k => p.append(k)); d.append(p); };
  pat('p-woods', 2.5, 2.5, svgEl('circle', { cx: 1.2, cy: 1.2, r: 0.55, fill: ink, opacity: 0.55 }));
  pat('p-forest', 1.8, 1.8, svgEl('circle', { cx: 0.9, cy: 0.9, r: 0.55, fill: ink, opacity: 0.7 }));
  pat('p-jungle', 2, 2, svgEl('circle', { cx: 1, cy: 1, r: 0.6, fill: ink, opacity: 0.65 }), svgEl('path', { d: 'M0,2 L2,0', stroke: ink, 'stroke-width': 0.2, opacity: 0.5 }));
  pat('p-marsh', 3, 2.5, svgEl('path', { d: 'M0.5,1.8 H1.6 M1,1.8 V1 M2,2.3 H2.8', stroke: dark ? '#7fb0c8' : '#3b6f8f', 'stroke-width': 0.18, opacity: 0.8 }));
  pat('p-paddy', 2.5, 2.5, svgEl('path', { d: 'M0,0 H2.5 M0,0 V2.5', stroke: dark ? '#6b9a86' : '#5a8f6a', 'stroke-width': 0.15, opacity: 0.7 }));
  pat('p-village', 3.3, 3.3, svgEl('rect', { x: 0.6, y: 0.6, width: 1.3, height: 1.1, fill: dark ? '#b8a88e' : '#5b4a36', opacity: 0.75 }));
  pat('p-urban', 2.2, 2.2, svgEl('rect', { x: 0.3, y: 0.3, width: 1.4, height: 1.4, fill: dark ? '#b8a88e' : '#5b4a36', opacity: 0.8 }));
  pat('p-rubble', 2.6, 2.6, svgEl('circle', { cx: 0.7, cy: 0.8, r: 0.3, fill: dark ? '#a0907a' : '#6b5a44', opacity: 0.7 }), svgEl('circle', { cx: 1.9, cy: 1.8, r: 0.22, fill: dark ? '#a0907a' : '#6b5a44', opacity: 0.6 }));
  pat('p-hedgerow', 2.5, 2.5, svgEl('circle', { cx: 1.25, cy: 1.25, r: 0.75, fill: ink, opacity: 0.55 }));
  pat('p-trench', 4, 4, svgEl('path', { d: 'M0,2 L1,1 L2,3 L3,1 L4,2', fill: 'none', stroke: dark ? '#c9b18a' : '#5b4630', 'stroke-width': 0.3 }));
  pat('p-rocky', 3, 3, svgEl('path', { d: 'M0.5,2.4 L1.2,1.2 L1.9,2.4 Z', fill: 'none', stroke: dark ? '#a8a08a' : '#6b6450', 'stroke-width': 0.2 }));
  pat('p-desert', 2.2, 2.2, svgEl('circle', { cx: 0.5, cy: 0.6, r: 0.15, fill: dark ? '#c9b07a' : '#9a8050', opacity: 0.6 }));
  svg.append(d);
}

/**
 * Render the map. opts: { view (object kept by the caller), selCell, selUnit, onCell, onUnit, onLongPress, onView, draft (cells being drawn),
 * showTruth, at (minute for AAR replay), compact }
 */
export function renderMapSVG(state, opts = {}) {
  const n = state.grid.n; const W = n * C;
  const dark = document.body.dataset.theme !== 'paper';
  const v = opts.view || {};
  if (!v.w) Object.assign(v, { x: -4, y: -4, w: W + 6, fitted: true });
  const svg = svgEl('svg', { class: 'mapsvg', role: 'img', 'aria-label': 'Operations map. Tap a square for details; scroll or pinch to zoom; drag to pan.', tabindex: '0', preserveAspectRatio: 'xMidYMid meet' });
  defs(svg, dark);
  // Terrain.
  const tg = svgEl('g', { class: 'terrain' });
  state.grid.cells.forEach((cell, i) => {
    const { c, r } = colRow(n, i);
    const t = TERRAIN[cell.t] || TERRAIN.open;
    tg.append(svgEl('rect', { x: c * C, y: r * C, width: C + 0.05, height: C + 0.05, fill: dark ? t.dark : t.light }));
    if (cell.elev) tg.append(svgEl('rect', { x: c * C, y: r * C, width: C + 0.05, height: C + 0.05, fill: dark ? '#e8d6a8' : '#8a5a20', opacity: 0.06 * cell.elev }));
    const p = { woods: 'woods', forest: 'forest', jungle: 'jungle', marsh: 'marsh', paddy: 'paddy', village: 'village', urban: 'urban', rubble: 'rubble', hedgerow: 'hedgerow', trench: 'trench', rocky: 'rocky', desert: 'desert', beach: 'desert' }[cell.t];
    if (p) tg.append(svgEl('rect', { x: c * C, y: r * C, width: C, height: C, fill: `url(#p-${p})` }));
    if (cell.mines && opts.showTruth) tg.append(svgEl('text', { x: c * C + 5, y: r * C + 6, 'text-anchor': 'middle', 'font-size': 3, fill: 'var(--danger)' }, '⚠'));
  });
  svg.append(tg);
  // Contours where the ground rises.
  const cont = svgEl('path', { d: contourPath(state), fill: 'none', stroke: dark ? '#d8b878' : '#8a5a20', 'stroke-width': 0.35, opacity: 0.75 });
  svg.append(cont);
  // Water, streams, roads, bridges.
  const lines = svgEl('g', {});
  const road = [], stream = [];
  state.grid.cells.forEach((cell, i) => {
    const { c, r } = colRow(n, i);
    for (const [dc, dr] of [[1, 0], [0, 1], [1, 1], [-1, 1]]) {
      const j = (r + dr) * n + (c + dc);
      if (c + dc < 0 || c + dc >= n || r + dr >= n) continue;
      const o = state.grid.cells[j];
      if (dc && dr && Math.abs(dc) + Math.abs(dr) === 2) { const a = state.grid.cells[r * n + c + dc], b = state.grid.cells[(r + dr) * n + c]; if (cell.road && o.road && !(a?.road || b?.road)) road.push(`M${c * C + 5},${r * C + 5} L${(c + dc) * C + 5},${(r + dr) * C + 5}`); continue; }
      if (cell.road && o.road) road.push(`M${c * C + 5},${r * C + 5} L${(c + dc) * C + 5},${(r + dr) * C + 5}`);
      if (cell.stream && o.stream) stream.push(`M${c * C + 5},${r * C + 5} L${(c + dc) * C + 5},${(r + dr) * C + 5}`);
    }
  });
  if (stream.length) lines.append(svgEl('path', { d: stream.join(' '), stroke: dark ? '#4f8fbf' : '#3a78b0', 'stroke-width': 1, fill: 'none', 'stroke-linecap': 'round' }));
  if (road.length) { lines.append(svgEl('path', { d: road.join(' '), stroke: dark ? '#0006' : '#5c4a2a', 'stroke-width': 1.6, fill: 'none', 'stroke-linecap': 'round' })); lines.append(svgEl('path', { d: road.join(' '), stroke: dark ? '#d8c08a' : '#f4e3b5', 'stroke-width': 0.8, fill: 'none', 'stroke-linecap': 'round' })); }
  state.grid.cells.forEach((cell, i) => { if (cell.bridge) { const { c, r } = colRow(n, i); lines.append(svgEl('path', { d: `M${c * C + 2},${r * C + 2.5} Q${c * C + 5},${r * C + 4} ${c * C + 8},${r * C + 2.5} M${c * C + 2},${r * C + 7.5} Q${c * C + 5},${r * C + 6} ${c * C + 8},${r * C + 7.5}`, stroke: dark ? '#eee' : '#222', 'stroke-width': 0.5, fill: 'none' })); } });
  svg.append(lines);
  // Grid.
  const gg = svgEl('g', {});
  for (let k = 0; k <= n; k++) { gg.append(svgEl('line', { class: 'gridline', x1: k * C, y1: 0, x2: k * C, y2: W })); gg.append(svgEl('line', { class: 'gridline', x1: 0, y1: k * C, x2: W, y2: k * C })); }
  for (let k = 0; k < n; k++) { gg.append(svgEl('text', { class: 'glabel', x: k * C + 5, y: -1.2, 'text-anchor': 'middle' }, LETTERS[k])); gg.append(svgEl('text', { class: 'glabel', x: -1.2, y: k * C + 5.9, 'text-anchor': 'end' }, String(k + 1))); }
  svg.append(gg);
  // Feature names.
  const fl = svgEl('g', {});
  const used = new Set();
  for (const f of state.grid.features) {
    if (f.label < 0) continue;
    // Keep labels apart: try the feature's own squares nearest its label square.
    const cands = [f.label, ...f.cells.filter(x => x !== f.label)];
    const at = cands.find(x => !used.has(x) && !used.has(x - 1) && !used.has(x + 1)) ?? f.label;
    used.add(at);
    const { c, r } = colRow(n, at);
    fl.append(svgEl('text', { class: 'flabel', x: c * C + 5, y: r * C + 8.6, 'text-anchor': 'middle' }, f.name.length > 26 ? f.name.slice(0, 25) + '…' : f.name));
  }
  svg.append(fl);
  // Control measures.
  const cmg = svgEl('g', {});
  for (const cm of state.controlMeasures) drawCM(cmg, n, cm);
  if (opts.draft && opts.draft.cells.length) drawCM(cmg, n, { type: opts.draft.type, name: opts.draft.name || '…', cells: opts.draft.cells, from: 'player', draft: true });
  svg.append(cmg);
  // Pending fire.
  for (const m of state.fires.missions.filter(x => x.status === 'pending' && x.side === 'friendly')) { const { c, r } = colRow(n, m.cell); svg.append(svgEl('circle', { class: 'fire-pending', cx: c * C + 5, cy: r * C + 5, r: 6 })); svg.append(svgEl('text', { x: c * C + 5, y: r * C + 1.5, 'text-anchor': 'middle', 'font-size': 2, fill: 'var(--danger)', 'font-weight': 700 }, `FIRE ${Math.max(0, m.impactAt - state.clock.minutes)}′`)); }
  // Smoke.
  for (const [cell, until] of Object.entries(state.smoke || {})) if (until >= state.clock.minutes) { const { c, r } = colRow(n, Number(cell)); svg.append(svgEl('rect', { x: c * C, y: r * C, width: C, height: C, fill: '#ddd', opacity: 0.45 })); }
  const now = opts.at ?? state.clock.minutes;
  // Routes of the selected unit.
  const su = opts.selUnit ? state.units[opts.selUnit] : null;
  if (su && su.side === 'friendly' && su.path?.length && !opts.showTruth) { const pts = [su.cell, ...su.path].map(i => { const p = colRow(n, i); return `${p.c * C + 5},${p.r * C + 5}`; }); svg.append(svgEl('polyline', { class: 'route', points: pts.join(' ') })); }
  // Units.
  const ug = svgEl('g', {});
  const trace = opts.showTruth ? traceAt(state, now) : null;
  const offsets = new Map();
  const place = (cell) => { const k = offsets.get(cell) || 0; offsets.set(cell, k + 1); const { c, r } = colRow(n, cell); return { x: c * C + 5 + (k % 2 ? 2.4 : k ? -2.4 : 0), y: r * C + 4.6 + Math.floor(k / 2) * 2.6 }; };
  if (trace) {
    // After-action replay: everyone where they truly were at that moment, with their trails.
    for (const u of Object.values(state.units)) {
      const at = trace.u[u.id]; if (!at) continue;
      const trail = state.trace.filter(s => s.at <= now && s.u[u.id]).map(s => s.u[u.id][0]);
      if (trail.length > 1) svg.append(svgEl('polyline', { class: u.side === 'enemy' ? 'trail' : 'ftrail', points: dedupe(trail).map(i => { const p = colRow(n, i); return `${p.c * C + 5},${p.r * C + 5}`; }).join(' ') }));
      const pos = place(at[0]);
      const g = unitSymbol(pos.x, pos.y, { side: u.side, type: u.decoy ? 'infantry' : u.type, size: u.size, label: u.side === 'friendly' ? (u.short || u.name).slice(0, 12) : `${u.decoy ? 'DECOY ' : ''}${u.name.slice(0, 18)}`, sub: u.decoy ? 'dummy' : `${at[1]}/${u.start}${at[2] ? ' PW' : ''}`, confidence: u.decoy ? 'possible' : 'confirmed', opacity: at[1] <= 0 && !u.decoy ? 0.45 : 1 });
      g.classList.add('truth'); g.dataset.id = u.id; ug.append(g);
    }
  } else {
    for (const u of friendlyUnits(state)) {
      if (u.dormant || (u.strength <= 0 && !u.isHQ)) continue;
      const cell = state.settings.echelonId === 'fireteam' || state.settings.echelonId === 'squad' || u.isHQ ? u.cell : (u.reported?.cell ?? u.cell);
      const pos = place(cell);
      const g = unitSymbol(pos.x, pos.y, { side: 'friendly', type: u.type, size: u.size, label: (u.short || u.name).slice(0, 12), sub: u.surrendered ? 'captured' : u.posture === 'broken' ? 'broken' : u.posture === 'pinned' ? 'pinned' : u.radio === 'down' && !u.isHQ ? 'no comms' : null, player: u.isHQ, selected: opts.selUnit === u.id, damaged: u.start ? u.strength / u.start : 1, opacity: u.surrendered ? 0.4 : 1 });
      g.dataset.id = u.id; ug.append(g);
    }
    for (const c of Object.values(state.picture.contacts)) {
      if (c.cleared) continue;
      const age = state.clock.minutes - c.at;
      const op = clamp(1 - age / (state.scale.tick * 14), 0.35, 1);
      const pos = place(c.cell);
      const g = unitSymbol(pos.x, pos.y, { side: c.type === 'unknown' && c.confidence === 'possible' ? 'unknown' : 'enemy', type: c.type, size: null, label: `${c.size ? `~${c.size}` : '?'}${c.confidence === 'confirmed' ? '' : '?'}`, sub: age > state.scale.tick ? `${age < 120 ? `${age}′` : `${Math.round(age / 60)}h`} ago` : null, confidence: c.confidence, opacity: op, selected: opts.selUnit === c.id });
      g.dataset.contact = c.id; ug.append(g);
    }
    for (const p of state.truth.people || []) {
      if (!p.cell || p.gone || p.kind !== 'civilian') continue;
      const idx = refIdx(n, p.cell); if (idx < 0) continue;
      if (!friendlyUnits(state).some(u => liveUnit(u) && Math.hypot(colRow(n, u.cell).c - colRow(n, idx).c, colRow(n, u.cell).r - colRow(n, idx).r) <= 2.5)) continue;
      const pos = place(idx);
      ug.append(unitSymbol(pos.x, pos.y, { side: 'neutral', type: 'support', label: 'civ', opacity: 0.85 }));
    }
  }
  svg.append(ug);
  if (opts.selCell != null && opts.selCell >= 0) { const { c, r } = colRow(n, opts.selCell); svg.append(svgEl('rect', { class: 'cellsel', x: c * C + 0.25, y: r * C + 0.25, width: C - 0.5, height: C - 0.5 })); }
  wireInteraction(svg, state, v, opts);
  return svg;
}

function refIdx(n, s) { const m = /^([A-Za-z])(\d{1,2})$/.exec(String(s).trim()); if (!m) return -1; const c = LETTERS.indexOf(m[1].toUpperCase()), r = Number(m[2]) - 1; return c >= 0 && c < n && r >= 0 && r < n ? r * n + c : -1; }
function dedupe(a) { return a.filter((x, i) => i === 0 || x !== a[i - 1]); }
function traceAt(state, at) { let best = state.trace[0] || null; for (const s of state.trace) { if (s.at <= at) best = s; else break; } return best || { u: {} }; }

function contourPath(state) {
  const n = state.grid.n; const out = [];
  state.grid.cells.forEach((cell, i) => {
    const { c, r } = colRow(n, i);
    if (c + 1 < n && state.grid.cells[i + 1].elev !== cell.elev) out.push(`M${(c + 1) * C},${r * C} V${(r + 1) * C}`);
    if (r + 1 < n && state.grid.cells[i + n].elev !== cell.elev) out.push(`M${c * C},${(r + 1) * C} H${(c + 1) * C}`);
  });
  return out.join(' ') || 'M0,0';
}

function drawCM(g, n, cm) {
  const pts = cm.cells.map(i => { const p = colRow(n, i); return [p.c * C + 5, p.r * C + 5]; });
  if (!pts.length) return;
  const cls = `${cm.from === 'player' ? 'cm-player' : ''}`;
  const label = cm.name;
  if (['PL', 'LD', 'LOA', 'boundary', 'axis'].includes(cm.type) && pts.length > 1) {
    g.append(svgEl('polyline', { class: `cm-line ${cls}`, points: pts.map(p => p.join(',')).join(' '), 'stroke-dasharray': cm.type === 'boundary' ? '3 1 .6 1' : cm.type === 'LOA' ? '2 1' : null, opacity: cm.draft ? 0.6 : 1, 'marker-end': null }));
    const [x, y] = pts[pts.length - 1]; const [x0, y0] = pts[0];
    g.append(svgEl('text', { class: 'cm-label', x: x0, y: y0 - 1.4, 'text-anchor': 'middle' }, label));
    if (pts.length > 2) g.append(svgEl('text', { class: 'cm-label', x, y: y - 1.4, 'text-anchor': 'middle' }, label));
    return;
  }
  if (cm.type === 'OBJ' || cm.type === 'AA' || cm.type === 'EA' || cm.type === 'BP') {
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    const x0 = Math.min(...xs) - 4.4, y0 = Math.min(...ys) - 4.4, x1 = Math.max(...xs) + 4.4, y1 = Math.max(...ys) + 4.4;
    g.append(svgEl('rect', { class: `obj ${cls}`, x: x0, y: y0, width: x1 - x0, height: y1 - y0, rx: 3.5, 'stroke-dasharray': cm.type === 'OBJ' ? null : '1.4 .8', opacity: cm.draft ? 0.6 : 1 }));
    g.append(svgEl('text', { class: 'cm-label', x: (x0 + x1) / 2, y: y0 - 0.8, 'text-anchor': 'middle' }, label));
    return;
  }
  // Points: TRP, CP, RP, LZ.
  for (const [x, y] of pts) {
    g.append(svgEl('circle', { class: `cm-line ${cls}`, cx: x, cy: y, r: 1.6 }));
    if (cm.type === 'TRP') g.append(svgEl('path', { class: `cm-line ${cls}`, d: `M${x - 2.2},${y} H${x + 2.2} M${x},${y - 2.2} V${y + 2.2}` }));
    g.append(svgEl('text', { class: 'cm-label', x, y: y - 2.4, 'text-anchor': 'middle' }, label));
  }
}

const MIN_W = 18;

function wireInteraction(svg, state, v, opts) {
  const n = state.grid.n; const W = n * C + 6;
  let aspect = 1;
  const apply = () => {
    const r = svg.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) aspect = r.width / r.height;
    const h = v.w / aspect;
    if (v.fitted) { const need = W; if (aspect >= 1) { v.w = need * aspect; v.x = -4 - (v.w - need) / 2; v.y = -4; } else { v.w = need; v.x = -4; v.y = -4 - (need / aspect - need) / 2; } }
    svg.setAttribute('viewBox', `${v.x} ${v.y} ${v.w} ${v.w / aspect}`);
    opts.onView?.(v);
    void h;
  };
  const toMap = (cx, cy) => { const r = svg.getBoundingClientRect(); const h = v.w / aspect; return { x: v.x + (cx - r.left) / r.width * v.w, y: v.y + (cy - r.top) / r.height * h }; };
  const cellAt = (cx, cy) => { const p = toMap(cx, cy); const c = Math.floor(p.x / C), r = Math.floor(p.y / C); return c >= 0 && r >= 0 && c < n && r < n ? r * n + c : -1; };
  const zoomAt = (factor, px, py) => { const nw = clamp(v.w * factor, MIN_W, W * Math.max(1, aspect) * 1.6); const k = nw / v.w; v.x = px - (px - v.x) * k; v.y = py - (py - v.y) * k; v.w = nw; v.fitted = false; apply(); };
  svg.addEventListener('wheel', e => { e.preventDefault(); const p = toMap(e.clientX, e.clientY); zoomAt(e.deltaY > 0 ? 1.18 : 1 / 1.18, p.x, p.y); }, { passive: false });
  const pointers = new Map(); let drag = null, pinch = null, moved = false, press = null;
  svg.addEventListener('pointerdown', e => {
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try { svg.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    if (pointers.size === 1) {
      drag = { x: e.clientX, y: e.clientY, vx: v.x, vy: v.y }; moved = false;
      const target = e.target.closest?.('.unit');
      press = { t: setTimeout(() => { if (!moved) { press.fired = true; const cell = cellAt(e.clientX, e.clientY); if (cell >= 0) opts.onLongPress?.(cell); } }, 550), fired: false, unit: target?.dataset?.id || null, contact: target?.dataset?.contact || null };
    } else if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), w: v.w, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 }; drag = null; if (press) clearTimeout(press.t); }
  });
  svg.addEventListener('pointermove', e => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && pointers.size === 2) { const [a, b] = [...pointers.values()]; const d = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)); const c = toMap(pinch.cx, pinch.cy); zoomAt(clamp(pinch.w * (pinch.d / d), MIN_W, W * 3) / v.w, c.x, c.y); moved = true; return; }
    if (drag) {
      if (Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y) > 6) { moved = true; if (press) clearTimeout(press.t); }
      if (moved) { const r = svg.getBoundingClientRect(); v.x = drag.vx - (e.clientX - drag.x) / r.width * v.w; v.y = drag.vy - (e.clientY - drag.y) / r.height * (v.w / aspect); v.fitted = false; apply(); }
    }
  });
  const up = e => {
    const was = pointers.size;
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (pointers.size === 0) {
      if (press) clearTimeout(press.t);
      if (was === 1 && !moved && !(press && press.fired) && e.type === 'pointerup') {
        if (press?.unit) opts.onUnit?.(press.unit);
        else if (press?.contact) opts.onContact?.(press.contact);
        else { const cell = cellAt(e.clientX, e.clientY); if (cell >= 0) opts.onCell?.(cell); }
      }
      drag = null; press = null;
    }
  };
  svg.addEventListener('pointerup', up); svg.addEventListener('pointercancel', up);
  svg.addEventListener('contextmenu', e => { e.preventDefault(); const cell = cellAt(e.clientX, e.clientY); if (cell >= 0) opts.onLongPress?.(cell); });
  svg.addEventListener('keydown', e => {
    const step = v.w * 0.1; const k = e.key;
    if (k === 'ArrowLeft') v.x -= step; else if (k === 'ArrowRight') v.x += step; else if (k === 'ArrowUp') v.y -= step; else if (k === 'ArrowDown') v.y += step;
    else if (k === '+' || k === '=') { zoomAt(1 / 1.25, v.x + v.w / 2, v.y + v.w / aspect / 2); e.preventDefault(); return; }
    else if (k === '-' || k === '_') { zoomAt(1.25, v.x + v.w / 2, v.y + v.w / aspect / 2); e.preventDefault(); return; }
    else if (k === '0') { v.fitted = true; apply(); e.preventDefault(); return; }
    else return;
    v.fitted = false; apply(); e.preventDefault();
  });
  svg.zoomIn = () => zoomAt(1 / 1.35, v.x + v.w / 2, v.y + v.w / aspect / 2);
  svg.zoomOut = () => zoomAt(1.35, v.x + v.w / 2, v.y + v.w / aspect / 2);
  svg.fit = () => { v.fitted = true; apply(); };
  svg.centerOn = cell => { const { c, r } = colRow(n, cell); v.fitted = false; if (v.w > W * 0.7) v.w = W * 0.6; v.x = c * C + 5 - v.w / 2; v.y = r * C + 5 - v.w / aspect / 2; apply(); };
  let lastW = 0, lastH = 0;
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => { const r = svg.getBoundingClientRect(); if (r.width < 1 || r.height < 1 || (Math.abs(r.width - lastW) < 1 && Math.abs(r.height - lastH) < 1)) return; lastW = r.width; lastH = r.height; apply(); }).observe(svg);
  requestAnimationFrame(apply);
  apply();
}

export { refOf, enemyUnits };
