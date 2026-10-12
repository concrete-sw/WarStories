// Fire support: what you can call, how fast it comes, what is in the air, and
// the target reference points you planned.

import { h, append } from '../dom.js';
import { btn, section, tag } from './common.js';
import { formatHM } from '../../engine/clock.js';
import { refOf } from '../../engine/grid.js';
import { assetBlocked } from '../../engine/fires.js';

export function registerFires(app, { S, reg, readOnly }) {
  reg({
    id: 'fires', title: 'Fires', sub: 'FIRE SUPPORT', icon: '✸', size: { w: 560, h: 520 }, x: 200, y: 90,
    render(body) {
      const s = S(); const n = s.grid.n; const ro = readOnly();
      if (!s.fires.assets.length) { append(body, h('p', { class: 'muted' }, 'You have no fire support on call for this operation. Ask higher for it over the radio, or do without.')); return; }
      append(body, section('On call', h('table', {}, h('thead', {}, h('tr', {}, h('th', {}, 'Unit'), h('th', {}, 'Type'), h('th', {}, 'Missions'), h('th', {}, 'Response'), h('th', {}, 'Status'))),
        h('tbody', {}, s.fires.assets.map(a => { const b = assetBlocked(s, a); return h('tr', {}, h('td', {}, a.name, a.callsign ? h('div', { class: 'small muted' }, a.callsign) : null), h('td', {}, a.type), h('td', {}, `${a.left}/${a.missions}`), h('td', {}, `~${a.response} min`), h('td', {}, b ? tag(b, 'warn') : tag('ready', 'ok'))); })))));
      const trps = s.controlMeasures.filter(c => c.type === 'TRP');
      append(body, section('Target reference points', trps.length ? h('div', { class: 'row tight' }, trps.map(t => btn(`${t.name} (${refOf(n, t.cells[0])})`, () => app.fireOn(t.cells[0]), 'small ghost', { disabled: ro || app.busy }))) : h('p', { class: 'muted small' }, 'None. Long-press a square on the map to plan one: fire on a TRP comes faster and lands truer.')));
      const pending = s.fires.missions.filter(m => m.status === 'pending' && m.side === 'friendly');
      const done = s.fires.missions.filter(m => m.status === 'done' && m.side === 'friendly').slice(-8).reverse();
      append(body, section('Missions', pending.map(m => h('div', { class: 'radio-line' }, tag('in the air', 'warn'), ` ${m.assetName} on ${refOf(n, m.cell)} (${m.kind}) · impact in ~${Math.max(0, m.impactAt - s.clock.minutes)} min${m.dangerClose?.length ? ' · DANGER CLOSE' : ''}`)),
        done.map(m => h('div', { class: 'radio-line' }, h('span', { class: 'dtg' }, formatHM(s, m.impactAt)), ` ${m.assetName} on ${refOf(n, m.cell)}: ${m.hit ? 'on target' : `landed at ${refOf(n, m.impact)}`}${m.effect ? `, ${m.effect} enemy hit` : ''}`)), !pending.length && !done.length ? h('p', { class: 'muted small' }, 'No missions fired yet.') : null));
      if (!ro) append(body, h('p', { class: 'small muted' }, 'Call fire by typing ("mortars on I9", "fire mission G4, smoke"), from the map, or with the call-for-fire template on the Radio: a complete call is faster and more accurate. Fire landing on your own people happens.'), h('div', { class: 'row tight' }, btn('Call for fire (template)', () => { app.radioTemplate = 'cff'; app.radioFields = null; app.show('radio'); }, 'small')));
    }
  });
}
