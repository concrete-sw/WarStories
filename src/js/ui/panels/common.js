// Shared bits for panels.

import { h } from '../dom.js';
import { GLOSSARY, GLOSSARY_TERMS } from '../../data/glossary.js';
import { formatHM } from '../../engine/clock.js';

export const tag = (txt, cls = '') => h('span', { class: `tag ${cls}` }, txt);
export const btn = (label, onClick, cls = 'small', attrs = {}) => h('button', { class: `btn ${cls}`, type: 'button', onClick, ...attrs }, label);
export const section = (title, ...kids) => h('div', { class: 'section' }, h('h3', {}, title), ...kids);

export function meter(label, value, { max = 100, inverse = false, suffix = '%', text = null } = {}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const lvl = inverse ? (pct > 75 ? 'bad' : pct > 50 ? 'warn' : '') : (pct < 25 ? 'bad' : pct < 50 ? 'warn' : '');
  return h('div', { class: 'meter' }, h('span', { class: 'lbl' }, label), h('div', { class: `bar ${lvl}`, role: 'meter', 'aria-label': label, 'aria-valuenow': String(Math.round(value)), 'aria-valuemin': '0', 'aria-valuemax': String(max) }, h('i', { style: `width:${pct}%` })), h('span', { class: 'val' }, text ?? `${Math.round(value)}${suffix}`));
}

export function kv(pairs) {
  return h('dl', { class: 'kv' }, pairs.filter(p => p && p[1] != null && p[1] !== '').map(([k, v]) => [h('dt', {}, k), h('dd', {}, v)]));
}

export function pickList(items, { selectedId, onSelect, empty = 'Nothing here.' }) {
  const ul = h('ul', { class: 'list' });
  if (!items.length) ul.append(h('li', { class: 'muted' }, empty));
  for (const it of items) {
    const pick = () => onSelect(it.id);
    ul.append(h('li', { class: `clickable ${selectedId === it.id ? 'sel' : ''} ${it.cls || ''}`, tabindex: '0', role: 'button', onClick: pick, onKeydown: e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } } },
      h('div', {}, it.icon || null, h('span', { class: 'nm' }, it.title), ...(it.tags || [])), it.meta ? h('div', { class: 'meta' }, it.meta) : null));
  }
  return ul;
}

// No lookbehind (older Safari rejects it): the leading boundary is captured instead.
const TERM_RE = new RegExp(`(^|[^\\w-])(${GLOSSARY_TERMS.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})(?![\\w-])`, 'g');

/** Text with military terms underlined and explained on hover (no innerHTML: safe for model text). */
export function glossify(text) {
  const frag = document.createDocumentFragment();
  const s = String(text ?? '');
  let last = 0; let m; let count = 0;
  TERM_RE.lastIndex = 0;
  const seen = new Set();
  while ((m = TERM_RE.exec(s)) && count < 30) {
    const term = m[2];
    const start = m.index + m[1].length;
    const def = GLOSSARY[term];
    if (!def || seen.has(term)) continue;
    seen.add(term); count++;
    if (start > last) frag.append(document.createTextNode(s.slice(last, start)));
    frag.append(h('span', { class: 'gl', title: def, tabindex: '0' }, term));
    last = start + term.length;
  }
  if (last < s.length) frag.append(document.createTextNode(s.slice(last)));
  return frag;
}

export const hm = (state, at) => formatHM(state, at);
