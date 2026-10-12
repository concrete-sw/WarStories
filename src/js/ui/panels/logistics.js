// Logistics: ammunition by unit, water, food, medical supplies, batteries and
// fuel; requests to higher that take time and can fail.

import { h, append } from '../dom.js';
import { btn, section, meter, tag } from './common.js';
import { formatHM } from '../../engine/clock.js';
import { friendlyUnits, liveUnit } from '../../engine/state.js';
import { SUPPLY_ITEMS, supplyLabel, averageAmmo } from '../../engine/logistics.js';

export function registerLogistics(app, { S, reg, readOnly }) {
  reg({
    id: 'logistics', title: 'Logistics', sub: 'SUPPLY', icon: '⛁', size: { w: 540, h: 560 }, x: 220, y: 100,
    render(body) {
      const s = S(); const L = s.logistics; const ro = readOnly(); const tier = app.ctx.echelon.tier;
      const veh = friendlyUnits(s).some(u => u.vehicles);
      append(body, section(tier >= 4 ? 'Supply picture' : 'What you have',
        meter('Ammunition', averageAmmo(s), { text: supplyLabel(s, 'ammo', averageAmmo(s)) }),
        meter('Water', L.water, { text: supplyLabel(s, 'water', L.water) }), meter('Food', L.food, { text: supplyLabel(s, 'food', L.food) }), meter('Medical', L.medical, { text: supplyLabel(s, 'medical', L.medical) }),
        s.era.tech >= 2 ? meter('Batteries', L.batteries, { text: supplyLabel(s, 'batteries', L.batteries) }) : null, veh ? meter('Fuel', L.fuel, { text: supplyLabel(s, 'fuel', L.fuel) }) : null));
      append(body, section('Ammunition by unit', friendlyUnits(s).filter(u => liveUnit(u) && !u.isHQ).map(u => meter(u.short || u.name, u.ammo))));
      const reqs = [...L.requests].reverse();
      append(body, section('Requests', reqs.length ? reqs.map(r => h('div', { class: 'radio-line' }, h('span', { class: 'dtg' }, formatHM(s, r.requestedAt)), ` ${r.item} · `, r.status === 'pending' ? tag(`expected ~${formatHM(s, r.eta)}`, 'warn') : r.status === 'delivered' ? tag(`arrived ${formatHM(s, r.deliveredAt)}`, 'ok') : tag('failed', 'bad'))) : h('p', { class: 'muted small' }, 'Nothing requested.')));
      if (!ro) append(body, h('div', { class: 'row tight' }, SUPPLY_ITEMS.filter(i => (i.id !== 'fuel' || veh) && (i.id !== 'batteries' || s.era.tech >= 2)).map(i => btn(`Request ${i.low}`, () => app.act({ type: 'radio', template: 'resupply', fields: { item: i.id } }), 'small ghost', { disabled: app.busy }))),
        h('p', { class: 'muted small' }, 'After a fight, Consolidate (in the Log) shares the remaining ammunition out evenly.'));
    }
  });
}
