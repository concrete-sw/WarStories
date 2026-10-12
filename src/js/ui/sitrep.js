// A situation report in the same shape every time, built by code from the
// state: what the player knows, never the hidden truth.

import { formatHM, formatDate, lightAt } from '../engine/clock.js';
import { friendlyUnits, liveUnit, personLabel } from '../engine/state.js';
import { refOf } from '../engine/grid.js';
import { averageAmmo, supplyLabel } from '../engine/logistics.js';
import { strengthPct } from '../engine/objectives.js';
import { typeWord } from '../engine/sim.js';
import { WEATHER } from '../data/terrain.js';

export function sitrepText(s, ctx) {
  const n = s.grid.n; const tier = ctx.echelon.tier;
  const contacts = Object.values(s.picture.contacts).filter(c => !c.cleared);
  const fresh = contacts.filter(c => s.clock.minutes - c.at <= s.scale.tick * 3);
  const threat = fresh.length ? (Object.values(s.units).some(u => u.side === 'friendly' && s.clock.minutes - u.engagedAt <= s.scale.tick) ? 4 : 3) : s.phase === 'planning' ? 2 : 1;
  const lines = [];
  lines.push(`SITREP ${formatHM(s)} · ${formatDate(s)} · ${s.setting.place.toUpperCase().slice(0, 40)} · ${(WEATHER[s.weatherNow] || WEATHER.clear).name.toUpperCase()}, ${lightAt(s).label.toUpperCase()}`);
  lines.push(`THREAT  [${'■'.repeat(threat)}${'□'.repeat(5 - threat)}] ${threat} — ${['QUIET', 'ALERT', 'OPERATIONS', 'IN CONTACT', 'OVERRUN'][threat - 1]}`);
  const fr = friendlyUnits(s).filter(u => !u.isHQ && !u.dormant);
  lines.push(`${tier >= 4 ? 'FORCE ' : 'UNIT  '}  ${s.truth.friendly.unitName.split(',')[0]} · ${strengthPct(s)}% effective · ${fr.filter(u => u.posture === 'broken').length ? `${fr.filter(u => u.posture === 'broken').length} broken` : 'none broken'}`);
  const named = Object.values(s.people).filter(p => !p.isPlayer && p.status !== 'ok').slice(-4).map(p => `${p.rank} ${p.last || p.name} ${p.status === 'kia' ? 'KIA' : p.status === 'wia' ? `WIA (${p.wound?.severity})` : p.status.toUpperCase()}`);
  if (named.length) lines.push(`        ${named.join(' · ')}`);
  lines.push(`AMMO    ${averageAmmo(s)}% · WATER ${supplyLabel(s, 'water', s.logistics.water)}${tier >= 4 ? ` · FUEL ${supplyLabel(s, 'fuel', s.logistics.fuel)}` : ''}`);
  const p0 = s.people.p0;
  lines.push(`BODY    Fatigue ${Math.round(p0.fatigue) >= 70 ? 'HIGH' : Math.round(p0.fatigue) >= 40 ? 'MODERATE' : 'LOW'} · Stress ${Math.round(p0.stress || 0) >= 60 ? 'HIGH' : 'manageable'}${p0.wound ? ` · wounded (${p0.wound.part})` : ''}`);
  lines.push(`COMMS   ${s.units.u0.radio === 'ok' && !s.flags.includes('jammed') ? 'up' : s.flags.includes('jammed') ? 'JAMMED' : s.units.u0.radio}${fr.filter(u => u.radio === 'down').length ? ` · no contact with ${fr.filter(u => u.radio === 'down').map(u => u.short || u.name).join(', ')}` : ''}`);
  lines.push(`ENEMY   ${contacts.length ? contacts.slice(0, 4).map(c => `${c.size ? `~${c.size} ` : ''}${typeWord(c.type)} ${refOf(n, c.cell)} (${c.confidence}${s.clock.minutes - c.at > s.scale.tick * 2 ? `, ${s.clock.minutes - c.at}′ old` : ''})`).join(' · ') : 'none seen'}`);
  lines.push(`ORDERS  ${s.mission.name} · NLT ${formatHM(s, s.mission.nlt)} · ${s.mission.status.toUpperCase()}`);
  const pending = s.fires.missions.filter(m => m.status === 'pending' && m.side === 'friendly');
  const reqs = s.logistics.requests.filter(r => r.status === 'pending');
  if (pending.length || reqs.length) lines.push(`PENDING ${[...pending.map(m => `fire on ${refOf(n, m.cell)} in ${m.impactAt - s.clock.minutes}′`), ...reqs.map(r => `${r.item} resupply ~${formatHM(s, r.eta)}`)].join(' · ')}`);
  if (tier >= 4) lines.push(`HIGHER  ${s.truth.higher?.commander?.name || 'higher'} · confidence ${s.standing.superiors >= 70 ? 'high' : s.standing.superiors >= 45 ? 'steady' : 'thin'}`);
  void liveUnit; void personLabel;
  return lines.join('\n');
}
