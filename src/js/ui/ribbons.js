// A ribbon rack drawn from award stripe colours.

import { h } from './dom.js';
import { svgEl } from './symbols.js';

export function ribbon(colors, title) {
  const svg = svgEl('svg', { viewBox: '0 0 36 10', preserveAspectRatio: 'none', role: 'img', 'aria-label': title });
  const w = 36 / Math.max(1, colors.length);
  colors.forEach((c, i) => svg.append(svgEl('rect', { x: i * w, y: 0, width: w + 0.2, height: 10, fill: c })));
  svg.append(svgEl('title', {}, title));
  return svg;
}

export function makeRack(awards) {
  const seen = new Map();
  for (const a of awards) { const k = a.name; seen.set(k, { ...a, count: (seen.get(k)?.count || 0) + 1 }); }
  return h('div', { class: 'rack', title: [...seen.values()].map(a => `${a.name}${a.count > 1 ? ` ×${a.count}` : ''}`).join(', ') }, [...seen.values()].map(a => ribbon(a.ribbon || ['#888', '#ccc', '#888'], `${a.name}${a.count > 1 ? ` ×${a.count}` : ''}`)));
}
