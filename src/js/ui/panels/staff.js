// The command post: the people around you. From battalion up, a staff with
// opinions (XO, S1 to S4, FSO, chaplain, aide, driver) and status boards; at
// company, the XO, first sergeant and forward observer.

import { h, append } from '../dom.js';
import { btn, section, tag, meter } from './common.js';
import { membersOf, personLabel, friendlyUnits, liveUnit } from '../../engine/state.js';
import { strengthPct } from '../../engine/objectives.js';
import { averageAmmo } from '../../engine/logistics.js';
import { formatHM, formatDuration } from '../../engine/clock.js';

export function registerStaff(app, { S, reg, readOnly }) {
  reg({
    id: 'staff', get title() { return app.ctx?.echelon?.tier >= 4 ? 'Staff' : 'Command post'; }, sub: 'THE PEOPLE AROUND YOU', icon: '♜', size: { w: 640, h: 600 }, x: 240, y: 60,
    render(body) {
      const s = S(); const ro = readOnly(); const tier = app.ctx.echelon.tier;
      const people = membersOf(s, s.units.u0).filter(p => !p.isPlayer);
      if (tier >= 4) {
        const own = strengthPct(s, 'friendly');
        const contacts = Object.values(s.picture.contacts).filter(c => !c.cleared).length;
        append(body, h('div', { class: 'boards' },
          h('div', { class: 'board' }, h('h4', {}, 'S3 · Operations'), h('div', { class: 'big' }, s.mission.status.toUpperCase()), h('div', { class: 'small' }, `${s.mission.name} · NLT ${formatHM(s, s.mission.nlt)} · ends in ${formatDuration(Math.max(0, s.mission.end - s.clock.minutes))}`)),
          h('div', { class: 'board' }, h('h4', {}, 'S1 · Personnel'), h('div', { class: 'big' }, `${own}%`), h('div', { class: 'small' }, `${s.stats.friendlyKIA} killed · ${s.stats.friendlyWIA} wounded · ${s.stats.friendlyMIA} missing`)),
          h('div', { class: 'board' }, h('h4', {}, 'S2 · Intelligence'), h('div', { class: 'big' }, String(contacts)), h('div', { class: 'small' }, 'enemy contacts on the map')),
          h('div', { class: 'board' }, h('h4', {}, 'S4 · Logistics'), h('div', { class: 'big' }, `${averageAmmo(s)}%`), h('div', { class: 'small' }, `ammunition · water ${Math.round(s.logistics.water)}% · fuel ${Math.round(s.logistics.fuel)}%`)),
          h('div', { class: 'board' }, h('h4', {}, 'Higher'), meter('Confidence', s.standing.superiors), h('div', { class: 'small muted' }, s.truth.higher?.commander ? `${s.truth.higher.commander.name}: ${s.truth.higher.commander.temperament || ''}` : '')),
          tier >= 6 ? h('div', { class: 'board' }, h('h4', {}, 'Politics and press'), meter('Political capital', s.standing.political)) : null));
      }
      if (!ro) append(body, h('div', { class: 'row tight' }, btn(tier >= 4 ? 'Call a staff meeting' : 'Gather the leaders', () => app.act({ type: 'staff' }), 'small', { disabled: app.busy }), tier >= 4 ? btn('Go forward to a unit…', () => app.chooseVisit(), 'small ghost', { disabled: app.busy }) : null));
      append(body, section(tier >= 4 ? 'Your staff' : 'With you', people.length ? h('div', { class: 'boards' }, people.map(p => h('div', { class: 'board' },
        h('h4', {}, h('span', {}, personLabel(s, p)), p.status !== 'ok' ? tag(p.status, 'bad') : null), h('div', { class: 'small muted' }, p.role),
        p.personality ? h('div', { class: 'small' }, p.personality) : null, p.opinion ? h('div', { class: 'small' }, h('i', {}, `"${p.opinion}"`)) : null, p.mood ? h('div', { class: 'small muted' }, `mood: ${p.mood}`) : null,
        !ro && p.status === 'ok' ? btn('Talk', () => app.talkTo(p.id), 'small ghost') : null))) : h('p', { class: 'muted small' }, 'Nobody: you are on your own here.')));
      if (tier >= 4) {
        const subs = friendlyUnits(s).filter(u => liveUnit(u) && !u.isHQ).map(u => s.people[u.leaderId]).filter(Boolean);
        append(body, section('Subordinate commanders', h('ul', { class: 'small' }, subs.map(L => h('li', {}, `${personLabel(s, L)} · ${s.units[L.unitId]?.name}${L.personality ? ` · ${L.personality}` : ''}${L.competence ? ` · ${'★'.repeat(L.competence)}` : ''} `, !ro ? btn('Talk', () => app.talkTo(L.id), 'small ghost') : null)))));
      }
    }
  });
}
