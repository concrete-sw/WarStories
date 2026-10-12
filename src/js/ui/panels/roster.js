// The Roster: every named soldier at squad to company level (status, morale,
// fatigue, trait, kills, awards, the personal detail), and unit strength cards
// above that. Talk to anyone, recommend an award, write to a family.

import { h, append } from '../dom.js';
import { btn, tag, kv, meter, pickList } from './common.js';
import { friendlyUnits, membersOf, personLabel } from '../../engine/state.js';
import { refOf } from '../../engine/grid.js';
import { orderText } from '../../engine/orders.js';
import { awardsFor } from '../../data/armies.js';
import { symbolBadge } from '../symbols.js';
import { formatHM } from '../../engine/clock.js';

const statusTag = p => p.status === 'ok' ? null : p.status === 'kia' ? tag('KIA', 'bad') : p.status === 'wia' ? tag(`WIA ${p.wound?.severity || ''}`, 'warn') : p.status === 'evac' ? tag('evacuated', 'info') : p.status === 'mia' ? tag(p.captured ? 'captured' : 'MIA', 'bad') : tag(p.status);

export function registerRoster(app, { S, reg, readOnly }) {
  reg({
    id: 'roster', title: 'Roster', sub: 'YOUR PEOPLE', icon: '☰', size: { w: 660, h: 600 }, x: 150, y: 70, primary: true,
    render(body) {
      const s = S(); const ech = app.ctx.echelon; const ro = readOnly();
      if (ech.tier >= 4 || ech.namedCasualties !== true) append(body, unitCards(app, s));
      const units = friendlyUnits(s).filter(u => !u.dormant);
      const people = units.flatMap(u => membersOf(s, u).map(p => ({ p, u })));
      const selId = app.sel.person && s.people[app.sel.person] ? app.sel.person : null;
      const list = h('div', {});
      for (const u of units) {
        const ms = membersOf(s, u);
        if (!ms.length) continue;
        append(list, h('h3', {}, symbolBadge({ side: 'friendly', type: u.type, size: u.size }), ` ${u.name}`, h('span', { class: 'muted small' }, ` · ${u.strength}/${u.start} · ${refOf(s.grid.n, u.cell)}`)));
        append(list, pickList(ms.map(p => ({ id: p.id, cls: p.status === 'kia' ? 'kia' : '', title: personLabel(s, p), tags: [p.isPlayer ? tag('you', 'info') : null, statusTag(p), p.replacement ? tag('new') : null, p.veteran ? tag('veteran', 'ok') : null, p.awards.length ? tag(`${p.awards.length} award${p.awards.length > 1 ? 's' : ''}`) : null].filter(Boolean), meta: `${p.role}${p.trait ? ` · ${p.trait}` : ''}${p.mood && p.status === 'ok' ? ` · ${p.mood}` : ''}` })), { selectedId: selId, onSelect: id => { app.sel = { ...app.sel, person: id }; app.refresh('roster'); } }));
      }
      const detail = selId ? personDetail(app, s, s.people[selId], ro) : h('p', { class: 'muted small' }, people.length ? 'Select someone to see who they are.' : '');
      append(body, h('div', { class: 'split' }, h('div', {}, list), h('div', { class: 'detail' }, detail)));
    }
  });
}

function unitCards(app, s) {
  return h('div', { class: 'boards' }, friendlyUnits(s).filter(u => !u.dormant).map(u => {
    const L = s.people[u.leaderId];
    return h('div', { class: 'board' },
      h('h4', {}, h('span', {}, symbolBadge({ side: 'friendly', type: u.type, size: u.size }), ` ${u.name}`), h('span', { class: 'muted small' }, u.callsign || '')),
      meter('Strength', u.strength, { max: Math.max(1, u.start), text: `${u.strength}/${u.start}` }),
      meter('Morale', u.morale), meter('Ammo', u.ammo), meter('Fatigue', u.fatigue, { inverse: true }),
      h('div', { class: 'small' }, `${orderText(s, u)} · ${u.posture}${u.radio !== 'ok' ? ` · radio ${u.radio}` : ''}`),
      L ? h('div', { class: 'small muted' }, `${personLabel(s, L)}${L.status !== 'ok' ? ` (${L.status})` : ''}${L.competence ? ` · competence ${'★'.repeat(L.competence)}` : ''}`) : null,
      (u.killed || u.wounded || u.missing) ? h('div', { class: 'small danger' }, `${u.killed || 0} killed · ${u.wounded || 0} wounded · ${u.missing || 0} missing`) : null);
  }));
}

function personDetail(app, s, p, ro) {
  const u = s.units[p.unitId];
  const year = new Date(s.clock.start).getUTCFullYear();
  const awards = awardsFor(app.ctx.army, year).filter(a => !a.wound);
  const box = h('div', {},
    h('h2', {}, personLabel(s, p)), h('p', { class: 'small muted' }, `${p.role} · ${u?.name || ''}${p.serviceNumber ? ` · ${p.serviceNumber}` : ''}`),
    kv([['Status', p.status === 'ok' ? 'fit for duty' : p.status === 'wia' ? `wounded (${p.wound?.severity}, ${p.wound?.part}) at ${formatHM(s, p.wound?.at)}${p.wound?.evacAt != null ? ` · evacuation ~${formatHM(s, p.wound.evacAt)}` : ''}` : p.status === 'kia' ? `killed at ${formatHM(s, p.wound?.at)}${p.wound?.cause ? ` (${p.wound.cause})` : ''}` : p.status],
      ['From', `${p.hometown || '—'}${p.age ? `, age ${p.age}` : ''}`], ['Weapon', p.weapon], ['Trait', p.trait], ['Detail', p.detail], ['Breaks if', p.isPlayer ? null : p.breakingPoint],
      ['Personality', p.personality], ['Voice', p.voice], ['Mood', p.mood], ['Morale', p.status === 'ok' ? Math.round(p.morale) : null], ['Kills', p.kills || null],
      ['Awards', p.awards.length ? p.awards.map(a => a.name).join(', ') : null], ['Said', p.said.length ? `"${p.said[p.said.length - 1].text.replace(/^\(to the player\)\s*/, '').slice(0, 160)}"` : null]]));
  if (ro) return box;
  const row = h('div', { class: 'row tight' });
  if (!p.isPlayer && ['ok', 'wia'].includes(p.status)) append(row, btn(`Talk to ${p.last || p.name}`, () => app.talkTo(p.id), 'small'));
  if (p.status === 'kia' && !p.letterWritten) append(row, btn('Write to the family', () => app.writeFamily(p.id), 'small'));
  if (!p.isPlayer && awards.length) {
    const sel = h('select', { 'aria-label': 'Award' }, awards.map(a => h('option', { value: a.id }, a.name)));
    const cit = h('textarea', { rows: '2', placeholder: 'Citation: what they did, when and where.' });
    const rec = (s.recommendations || []).find(r => r.personId === p.id);
    append(box, h('h3', {}, 'Recommend for an award'), rec ? h('p', { class: 'small' }, `Recommended for the ${awards.find(a => a.id === rec.awardId)?.name}. Higher decides after the operation.`) : h('div', {}, h('label', {}, 'Award', sel), h('label', {}, 'Citation', cit), btn('Submit recommendation', () => { s.recommendations = s.recommendations || []; s.recommendations.push({ personId: p.id, awardId: sel.value, citation: cit.value.trim(), at: s.clock.minutes }); app.toast('Recommendation forwarded to higher.', 'info'); app.refresh('roster'); }, 'small')));
  }
  append(box, row);
  return box;
}
