// Service record and The Wall: rank, unit, operations, decorations as a
// ribbon rack, evaluations, wounds, and everyone killed under your command.

import { h, append } from '../dom.js';
import { section, kv, tag } from './common.js';
import { personLabel } from '../../engine/state.js';
import { makeRack } from '../ribbons.js';
import { formatDate } from '../../engine/clock.js';

export function registerRecord(app, { S, reg }) {
  reg({
    id: 'record', title: 'Record', sub: 'SERVICE RECORD · THE WALL', icon: '✠', size: { w: 560, h: 600 }, x: 320, y: 80,
    render(body) {
      const s = S(); const p = s.people.p0; const c = s.campaign;
      append(body, h('div', { class: 'typed' }, h('div', { class: 'typed-head' }, h('span', {}, 'SERVICE RECORD'), h('span', {}, p.serviceNumber)),
        kv([['Name', personLabel(s, p)], ['Unit', s.truth.friendly.unitName], ['Command', app.ctx.echelon.name], ['Army', app.ctx.army.name], ['From', p.hometown], ['Mode', `${s.settings.mode}${c.total ? ` · operation ${c.index} of ${c.total}` : ` · operation ${c.index}`}${s.settings.ironman ? ' · IRONMAN' : ''}`]]),
        p.awards.length ? h('div', {}, h('h3', {}, 'Decorations'), makeRack(p.awards), h('ul', { class: 'small' }, p.awards.map(a => h('li', {}, `${a.name}${a.op ? ` · ${a.op}` : ''}${a.reason ? ` · ${a.reason}` : ''}`)))) : h('p', { class: 'small muted' }, 'No decorations yet.')));
      append(body, section('Operations', c.ops.length ? h('ul', { class: 'small' }, c.ops.map(o => h('li', {}, `${o.date} · ${o.codename}: ${o.title} · ${o.outcome} · ${o.grade}`))) : h('p', { class: 'muted small' }, 'This is your first.')),
        c.record.promotions.length ? section('Promotions', h('ul', { class: 'small' }, c.record.promotions.map(x => h('li', {}, `${x.date}: to ${x.to} command`)))) : null,
        c.record.evaluations.length ? section('Evaluations', h('ul', { class: 'small' }, c.record.evaluations.map(x => h('li', {}, `${x.op}: ${x.text}`)))) : null,
        c.record.wounds.length ? section('Wounds', h('ul', { class: 'small' }, c.record.wounds.map(w => h('li', {}, `${w.op}: ${w.severity}, ${w.part}`)))) : null);
      const wall = c.wall;
      append(body, section(`The Wall (${wall.length})`, wall.length ? h('ul', { class: 'wall' }, wall.map(w => h('li', {}, h('b', {}, `${w.rank} ${w.name}`), w.isPlayer ? tag('you', 'bad') : null, h('div', { class: 'small muted' }, `${w.role || ''}${w.unit ? `, ${w.unit}` : ''} · ${w.op} · ${w.place}${w.hometown ? ` · from ${w.hometown}` : ''}`), w.line ? h('div', { class: 'small' }, w.line) : null))) : h('p', { class: 'muted small' }, 'Everyone killed under your command or beside you will be named here. It is empty. Keep it that way as long as you can.')));
      void formatDate;
    }
  });
}
