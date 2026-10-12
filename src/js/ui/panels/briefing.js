// The briefing: who you are, the war so far, your unit, the chain of command,
// the ground, weather and light. Built by code from the operation, never improvised.

import { h, append } from '../dom.js';
import { kv, glossify, tag, section } from './common.js';
import { formatHM, longDate, lightAt, sunTimes, hoursToHM, moonIllumination, formatDuration } from '../../engine/clock.js';
import { personLabel, friendlyUnits, membersOf } from '../../engine/state.js';
import { refOf, describeCell } from '../../engine/grid.js';
import { WEATHER } from '../../data/terrain.js';

export function renderBriefing(app, s, { compact = false } = {}) {
  const t = s.truth; const p = s.people.p0; const ctx = app.ctx;
  const sun = sunTimes(s.clock.start, s.setting.latitude);
  const moon = moonIllumination(s.clock.start);
  const wrap = h('div', { class: 'briefing' });
  append(wrap,
    h('div', { class: 'typed' }, h('div', { class: 'typed-head' }, h('span', {}, `OPERATION ${t.codename}`), h('span', {}, longDate(s, 0))),
      h('b', {}, t.title), '\n', `${t.setting.place}. ${t.setting.weather || ''}.`),
    kv([
      ['You', `${personLabel(s, p)} · ${p.role}`],
      ['Service no.', p.serviceNumber],
      ['Unit', t.friendly.unitName],
      ['Call sign', s.units.u0.callsign],
      ['Command', `${ctx.echelon.name}: ${ctx.echelon.controls}`],
      ['Army', `${ctx.army.name} · ${ctx.branch.name}`],
      ['Higher', `${t.higher?.unit || ''}${t.higher?.commander ? ` · ${t.higher.commander.name} (${t.higher.commander.callsign})` : ''}`],
      ['H-hour', `${formatHM(s, s.mission.hHour)} (in ${formatDuration(Math.max(0, s.mission.hHour - s.clock.minutes))})`],
      ['Light', `sunrise ${hoursToHM(sun.sunrise)}, sunset ${hoursToHM(sun.sunset)}, moon ${Math.round(moon.illum * 100)}%`],
      ['Map', `${s.grid.n}×${s.grid.n} squares of ${s.scale.cellM} m · you are at ${describeCell(s, s.units.u0.cell)}`]
    ])
  );
  if (!compact) {
    append(wrap,
      section('The war so far', h('p', { class: 'narr' }, glossify(t.setting.warSoFar))),
      section('Your unit', h('p', { class: 'narr' }, glossify(t.setting.unitHistory || t.friendly.history || ''))),
      section('Your people', h('ul', {}, friendlyUnits(s).filter(u => !u.isHQ && !u.dormant).map(u => { const L = s.people[u.leaderId]; return h('li', {}, h('b', {}, u.name), ` (${u.callsign || ''}) · ${u.strength} ${ctx.echelon.strengthWord} · ${refOf(s.grid.n, u.cell)}${L ? ` · led by ${personLabel(s, L)}${L.personality ? `: ${L.personality}` : ''}` : ''}`); })),
        membersOf(s, s.units.u0).filter(x => !x.isPlayer).length ? h('p', { class: 'small muted' }, 'With you: ', membersOf(s, s.units.u0).filter(x => !x.isPlayer).map(x => `${personLabel(s, x)} (${x.role})`).join(', ')) : null),
      section('Mission', h('p', { class: 'narr' }, glossify(t.mission.statement)), h('p', { class: 'small' }, h('b', {}, 'Higher\'s intent: '), glossify(t.mission.higherIntent)), t.mission.roe ? h('p', { class: 'small' }, h('b', {}, 'Rules of engagement: '), t.mission.roe) : null,
        (t.mission.constraints || []).length ? h('ul', { class: 'small' }, t.mission.constraints.map(c => h('li', {}, c))) : null),
      t.setting.historicalOutcome ? section('History', h('p', { class: 'small muted' }, 'Real events around this date (your unit is fictional): ', t.setting.historicalOutcome)) : null
    );
  } else {
    append(wrap, h('p', { class: 'narr small' }, glossify((t.setting.warSoFar || '').slice(0, 420) + ((t.setting.warSoFar || '').length > 420 ? '…' : ''))),
      h('p', { class: 'small' }, h('b', {}, 'Mission: '), glossify(t.mission.statement)),
      h('p', { class: 'small muted' }, 'The Briefing and Orders panels keep all of this. ', h('a', { href: '#', onClick: ev => { ev.preventDefault(); app.show('briefing'); } }, 'Open the briefing'), ' · ', h('a', { href: '#', onClick: ev => { ev.preventDefault(); app.show('orders'); } }, 'Read the orders')));
  }
  return wrap;
}

export function registerBriefing(app, { S, reg }) {
  reg({ id: 'briefing', title: 'Briefing', sub: 'THE WAR SO FAR', icon: '✦', size: { w: 600, h: 620 }, x: 60, y: 30, render(body) { body.append(renderBriefing(app, S())); } });
}

export { WEATHER, lightAt, tag };
