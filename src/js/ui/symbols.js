// Military-style unit symbols drawn from state: friendly blue rectangles,
// hostile red diamonds, unknown yellow, neutral green, with the branch icon
// inside and the echelon mark above. Coordinates are in map units (a grid
// square is 10 units).

import { SIZES } from '../data/echelons.js';

const NS = 'http://www.w3.org/2000/svg';
export function svgEl(tag, attrs = {}, text) { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) if (v != null && v !== false) e.setAttribute(k, v); if (text != null) e.textContent = text; return e; }

const COLORS = { friendly: ['var(--friend)', '#a8c8ff'], enemy: ['var(--enemy)', '#ffb0a8'], unknown: ['var(--unknown)', '#ffec99'], neutral: ['var(--neutral)', '#b6efb0'] };

/** Inner branch icon inside a frame centred at 0,0 with half-width w and half-height h. */
function icon(g, type, w, h, stroke) {
  const s = { stroke, 'stroke-width': 0.42, fill: 'none', 'stroke-linecap': 'round' };
  switch (type) {
    case 'infantry': case 'militia': g.append(svgEl('path', { d: `M${-w},${-h} L${w},${h} M${-w},${h} L${w},${-h}`, ...s })); break;
    case 'armor': g.append(svgEl('rect', { x: -w * 0.62, y: -h * 0.5, width: w * 1.24, height: h, rx: h * 0.5, ...s })); break;
    case 'mech': g.append(svgEl('path', { d: `M${-w},${-h} L${w},${h} M${-w},${h} L${w},${-h}`, ...s })); g.append(svgEl('rect', { x: -w * 0.62, y: -h * 0.5, width: w * 1.24, height: h, rx: h * 0.5, ...s })); break;
    case 'recon': g.append(svgEl('path', { d: `M${-w},${h} L${w},${-h}`, ...s })); break;
    case 'engineer': g.append(svgEl('path', { d: `M${-w * 0.55},${h * 0.35} V${-h * 0.35} H${w * 0.55} V${h * 0.35} M0,${-h * 0.35} V${h * 0.35}`, ...s })); break;
    case 'artillery': g.append(svgEl('circle', { cx: 0, cy: 0, r: h * 0.32, fill: stroke })); break;
    case 'mortar': g.append(svgEl('circle', { cx: 0, cy: h * 0.42, r: h * 0.17, ...s })); g.append(svgEl('path', { d: `M0,${h * 0.25} V${-h * 0.6} M${-h * 0.25},${-h * 0.32} L0,${-h * 0.6} L${h * 0.25},${-h * 0.32}`, ...s })); break;
    case 'mg': g.append(svgEl('path', { d: `M0,${h * 0.7} V${-h * 0.7} M${-h * 0.3},${-h * 0.4} L0,${-h * 0.7} L${h * 0.3},${-h * 0.4} M${-w * 0.35},${h * 0.15} H${w * 0.35}`, ...s })); break;
    case 'at': g.append(svgEl('path', { d: `M${-w * 0.8},${h} L0,${-h} L${w * 0.8},${h}`, ...s })); break;
    case 'hq': g.append(svgEl('text', { x: 0, y: h * 0.38, 'text-anchor': 'middle', 'font-size': h * 1.05, fill: stroke, 'font-weight': 700 }, 'HQ')); break;
    case 'sniper': g.append(svgEl('circle', { cx: 0, cy: 0, r: h * 0.5, ...s })); g.append(svgEl('path', { d: `M0,${-h * 0.8} V${h * 0.8} M${-h * 0.8},0 H${h * 0.8}`, ...s })); break;
    case 'aviation': g.append(svgEl('path', { d: `M${-w * 0.7},${-h * 0.5} L${w * 0.7},${h * 0.5} V${-h * 0.5} L${-w * 0.7},${h * 0.5} Z`, ...s })); break;
    case 'support': g.append(svgEl('path', { d: `M${-w * 0.7},${h * 0.5} H${w * 0.7}`, ...s })); break;
    default: g.append(svgEl('text', { x: 0, y: h * 0.38, 'text-anchor': 'middle', 'font-size': h * 1.1, fill: stroke }, '?'));
  }
}

/**
 * A unit symbol group at (x, y). opts: { side, type, size, label, sub, confidence, opacity, player, damaged, selected }
 */
export function unitSymbol(x, y, opts) {
  const side = opts.side || 'friendly';
  const [stroke, fill] = COLORS[side] || COLORS.unknown;
  const g = svgEl('g', { class: `unit ${side} ${opts.selected ? 'sel' : ''}`, transform: `translate(${x} ${y})`, opacity: opts.opacity ?? 1 });
  const w = 3.1, h = 2.1;
  const dash = opts.confidence === 'probable' ? '0.9 0.5' : opts.confidence === 'possible' ? '0.3 0.5' : null;
  let frame;
  if (side === 'friendly') frame = svgEl('rect', { class: 'frame', x: -w, y: -h, width: 2 * w, height: 2 * h, fill, 'fill-opacity': 0.9, stroke, 'stroke-width': 0.42, 'stroke-dasharray': dash });
  else if (side === 'enemy') frame = svgEl('path', { class: 'frame', d: `M0,${-h * 1.45} L${w * 0.95},0 L0,${h * 1.45} L${-w * 0.95},0 Z`, fill, 'fill-opacity': 0.9, stroke, 'stroke-width': 0.42, 'stroke-dasharray': dash });
  else if (side === 'neutral') frame = svgEl('rect', { class: 'frame', x: -h * 1.1, y: -h * 1.1, width: h * 2.2, height: h * 2.2, fill, stroke, 'stroke-width': 0.42 });
  else frame = svgEl('path', { class: 'frame', d: `M${-w * 0.6},${-h} Q0,${-h * 2} ${w * 0.6},${-h} Q${w * 1.4},0 ${w * 0.6},${h} Q0,${h * 2} ${-w * 0.6},${h} Q${-w * 1.4},0 ${-w * 0.6},${-h} Z`, fill, stroke, 'stroke-width': 0.42, 'stroke-dasharray': dash });
  g.append(frame);
  const ic = svgEl('g', {});
  const iw = side === 'enemy' ? w * 0.5 : w, ih = side === 'enemy' ? h * 0.62 : h;
  icon(ic, opts.type, iw, ih, '#111');
  g.append(ic);
  const mark = SIZES[opts.size]?.mark;
  if (mark) g.append(svgEl('text', { x: 0, y: side === 'enemy' ? -h * 1.6 : -h - 0.45, 'text-anchor': 'middle', 'font-size': 1.7, fill: '#111', 'font-weight': 700, class: 'echmark' }, mark));
  if (opts.player) g.append(svgEl('circle', { cx: 0, cy: 0, r: w * 1.35, fill: 'none', stroke: 'var(--accent)', 'stroke-width': 0.35, 'stroke-dasharray': '1 .6' }));
  if (opts.damaged) g.append(svgEl('path', { d: `M${-w},${h + 0.6} H${-w + 2 * w * Math.max(0, Math.min(1, opts.damaged))}`, stroke: opts.damaged < 0.5 ? 'var(--danger)' : opts.damaged < 0.8 ? 'var(--warn)' : 'var(--ok)', 'stroke-width': 0.6 }));
  if (opts.label) g.append(svgEl('text', { x: 0, y: (side === 'enemy' ? h * 1.45 : h) + 2.2, 'text-anchor': 'middle', 'font-size': 1.75, class: 'ulabel', fill: 'var(--ink)', 'paint-order': 'stroke', stroke: 'var(--bg-2)', 'stroke-width': 0.45 }, opts.label));
  if (opts.sub) g.append(svgEl('text', { x: 0, y: (side === 'enemy' ? h * 1.45 : h) + 4, 'text-anchor': 'middle', 'font-size': 1.4, fill: 'var(--ink-dim)', 'paint-order': 'stroke', stroke: 'var(--bg-2)', 'stroke-width': 0.4 }, opts.sub));
  return g;
}

/** A small standalone SVG of a symbol (roster, legends). */
export function symbolBadge(opts) {
  const svg = svgEl('svg', { viewBox: '-5 -5 10 10', width: 26, height: 26, 'aria-hidden': 'true', class: 'sym' });
  svg.append(unitSymbol(0, 0, { ...opts, label: null, sub: null }));
  return svg;
}
