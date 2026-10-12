// Intelligence: the enemy as you know him (contacts with confidence and age),
// reports with source reliability, prisoners, and at battalion and up the S2's
// estimate, written by code from your picture, not from the truth.

import { h, append } from '../dom.js';
import { tag, section, btn, glossify } from './common.js';
import { formatHM } from '../../engine/clock.js';
import { refOf } from '../../engine/grid.js';
import { typeWord } from '../../engine/sim.js';

const REL = { A: 'completely reliable', B: 'usually reliable', C: 'fairly reliable', D: 'not usually reliable', E: 'unreliable', F: 'cannot be judged' };
const INFO = { 1: 'confirmed', 2: 'probably true', 3: 'possibly true', 4: 'doubtful', 5: 'improbable', 6: 'cannot be judged' };

export function registerIntel(app, { S, reg }) {
  reg({
    id: 'intel', title: 'Intel', sub: 'THE ENEMY AS YOU KNOW HIM', icon: '◎', size: { w: 600, h: 580 }, x: 180, y: 80,
    render(body) {
      const s = S(); const n = s.grid.n; const ech = app.ctx.echelon;
      const contacts = Object.values(s.picture.contacts).filter(c => !c.cleared).sort((a, b) => b.at - a.at);
      if (ech.tier >= 3) append(body, section('S2 estimate', h('p', { class: 'narr small' }, estimate(s, contacts))));
      append(body, section(`Contacts (${contacts.length})`, contacts.length ? h('table', {}, h('thead', {}, h('tr', {}, h('th', {}, 'Where'), h('th', {}, 'What'), h('th', {}, 'Confidence'), h('th', {}, 'Seen'), h('th', {}, ''))),
        h('tbody', {}, contacts.map(c => { const age = s.clock.minutes - c.at; const eff = age > s.scale.tick * 6 ? 'stale' : c.confidence; return h('tr', {}, h('td', {}, refOf(n, c.cell)), h('td', {}, `${c.size ? `~${c.size} ` : ''}${typeWord(c.type)}`), h('td', {}, tag(eff, eff === 'confirmed' ? 'bad' : eff === 'probable' ? 'warn' : '')), h('td', { class: 'small' }, `${formatHM(s, c.at)} (${age}′) · ${c.source}`), h('td', {}, btn('Map', () => { app.sel = { contact: c.id, cell: c.cell }; app.show('map'); }, 'small ghost'))); }))) : h('p', { class: 'muted small' }, 'No enemy seen yet. That does not mean there is none.')));
      const reports = [...s.intelLog].reverse();
      append(body, section('Reports', reports.length ? reports.map(r => h('div', { class: 'radio-line' }, h('span', { class: 'dtg' }, formatHM(s, r.at)), tag(r.reliability, 'info'), h('span', { class: 'muted small' }, ` ${r.source}: `), h('span', { class: 'txt' }, glossify(r.text)), r.cell != null ? h('span', { class: 'muted small' }, ` [${refOf(n, r.cell)}]`) : null, h('div', { class: 'faint small' }, `${REL[r.reliability?.[0]] || ''}, ${INFO[r.reliability?.[1]] || ''}`))) : h('p', { class: 'muted small' }, 'Nothing yet.')));
      if (s.stats.prisoners) append(body, section('Prisoners', h('p', { class: 'small' }, `${s.stats.prisoners} prisoners taken. Talk to them through the command bar ("question the prisoners about the farm"); what they say may be true.`)));
      const decoys = Object.values(s.picture.contacts).filter(c => c.decoyRevealed);
      if (decoys.length) append(body, section('Deceptions found', h('ul', { class: 'small' }, decoys.map(c => h('li', {}, `${refOf(n, c.cell)}: a dummy position.`)))));
    }
  });
}

function estimate(s, contacts) {
  const n = s.grid.n;
  if (!contacts.length) return 'The enemy picture is blank. Recommend reconnaissance before committing the main body.';
  const conf = contacts.filter(c => c.confidence === 'confirmed').length;
  const total = contacts.reduce((a, c) => a + (c.size || 0), 0);
  const near = contacts.filter(c => s.mission.objectiveCells.some(o => Math.hypot((o % n) - (c.cell % n), Math.floor(o / n) - Math.floor(c.cell / n)) <= 2.5));
  const armor = contacts.filter(c => ['armor', 'mech'].includes(c.type));
  return `We hold ${contacts.length} enemy contacts, ${conf} of them confirmed, totalling roughly ${total || 'an unknown number of'} men. ${near.length ? `${near.length} are on or near ${s.mission.name}.` : `None are confirmed on ${s.mission.name} itself.`} ${armor.length ? `Armour or armoured vehicles reported at ${armor.map(c => refOf(n, c.cell)).join(', ')}.` : 'No armour confirmed.'} Most likely enemy course of action: hold in place and counterattack lost ground. Confidence: ${conf >= contacts.length / 2 ? 'moderate' : 'low'}. Reports older than an hour may be wrong.`;
}
