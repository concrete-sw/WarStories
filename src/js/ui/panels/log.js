// The Log: the narrative, what the game decided each turn, radio lines the GM
// voiced, choices, and the quick actions for this command level.

import { h, append } from '../dom.js';
import { glossify, btn, tag } from './common.js';
import { formatHM } from '../../engine/clock.js';
import { personLabel } from '../../engine/state.js';
import { renderBriefing } from './briefing.js';

export function registerLog(app, { S, reg, readOnly }) {
  reg({
    id: 'log', title: 'Log', sub: 'NARRATIVE', icon: '▤', size: { w: 640, h: 600 }, x: 12, y: 10, primary: true,
    render(body) {
      body.classList.add('col'); body.classList.add('notebook');
      const s = S();
      const wrap = h('div', { class: 'log-stream grow', 'aria-live': 'polite' });
      const entries = s.log.slice(-90);
      for (const e of entries) append(wrap, renderEntry(app, s, e));
      if (!s.log.length) append(wrap, h('div', { class: 'entry system' }, 'Waiting for the first transmission...'));
      append(body, wrap);
      const composer = h('div', { class: 'composer' });
      const ro = readOnly();
      if (!ro && s.lastChoices.length && !s.contactMoment) append(composer, h('div', { class: 'choices' }, s.lastChoices.map((c, i) => h('button', { class: 'btn ghost', type: 'button', disabled: app.busy, title: `Press ${i + 1}`, onClick: () => app.sendText(c) }, `${i + 1}. ${c}`))));
      if (!ro) append(composer, quickActions(app, s));
      if (ro) append(composer, h('p', { class: 'muted small' }, 'This operation is over. ', btn('Open the after-action review', () => app.showAAR(), 'small primary')));
      append(body, composer);
      requestAnimationFrame(() => { wrap.scrollTop = wrap.scrollHeight; });
    }
  });
}

export function renderEntry(app, s, e) {
  const who = speakerLabel(s, e.speaker);
  if (e.kind === 'briefing') return h('div', { class: 'entry briefing' }, h('div', { class: 'who' }, `${formatHM(s, e.at)} · BRIEFING · READ BEFORE YOU GIVE AN ORDER`), renderBriefing(app, s, { compact: true }));
  if (e.kind === 'system' || e.kind === 'notice') return h('div', { class: `entry system` }, h('div', { class: 'who' }, `${formatHM(s, e.at)} · ${e.kind.toUpperCase()}`), h('div', { class: 'narr' }, e.text));
  const frag = document.createDocumentFragment();
  if (e.playerLine) frag.append(h('div', { class: 'entry player' }, h('div', { class: 'who' }, `${formatHM(s, e.at)} · ${personLabel(s, s.people.p0)}`), h('div', { class: 'narr' }, e.playerLine)));
  const kind = (e.speaker || 'narrator').split(':')[0];
  const rep = e.report;
  frag.append(h('div', { class: `entry ${kind} ${e.contact ? 'contact' : ''}` },
    h('div', { class: 'who' }, `${who}${e.contact ? ' · CONTACT!' : ''}`),
    h('div', { class: 'narr' }, glossify(e.text)),
    rep ? h('div', { class: 'report' }, `${rep.minutes} min passed`, rep.contacts?.length ? ` · new contacts: ${rep.contacts.join('; ')}` : '', rep.enemyHits ? ` · enemy hit: ${rep.enemyHits}` : '', rep.casualties?.length ? h('div', { class: 'cas' }, `Casualties: ${rep.casualties.join('; ')}`) : null) : null,
    e.ledger?.length ? h('div', { class: 'ledger' }, e.ledger.map(l => `🎲 ${l.a}→${l.t}: ${l.dice?.join('+')} = ${l.roll}, fire ${l.fire} × cover ${100 - l.cover}% → ${l.cas} hit (expected ${l.exp})`).join(' · ')) : null));
  return frag;
}

export function speakerLabel(s, speaker) {
  if (!speaker || speaker === 'narrator') return 'NARRATOR';
  if (speaker.startsWith('net:')) return `RADIO · ${speaker.slice(4).toUpperCase()}`;
  if (speaker.startsWith('npc:')) { const p = s.people[speaker.slice(4)]; return p ? personLabel(s, p).toUpperCase() : 'VOICE'; }
  return speaker.toUpperCase();
}

function quickActions(app, s) {
  const ech = app.ctx.echelon;
  const q = h('div', { class: 'quick' });
  const dis = app.busy || !!s.contactMoment;
  append(q,
    btn('Carry on ▸', () => app.act({ type: 'continue' }), 'small', { disabled: dis, title: 'Let time run to the next decision point' }),
    btn(ech.tier >= 4 ? 'Staff meeting' : 'Check on the men', () => app.act(ech.tier >= 4 ? { type: 'staff' } : { type: 'checkmen' }), 'small ghost', { disabled: dis }),
    btn(`Ask ${ech.hintGiver.replace(/^your /, 'the ')}`, () => app.askHint(), 'small ghost', { disabled: dis }),
    s.phase === 'planning' ? btn('Planning ▾', () => app.show('orders'), 'small ghost') : null,
    s.phase !== 'planning' ? btn('Consolidate', () => app.act({ type: 'consolidate' }), 'small ghost', { disabled: dis, title: 'Redistribute ammunition, dig in, evacuate the wounded' }) : null,
    s.playerWith ? btn('Return to CP', () => app.act({ type: 'return' }), 'small ghost', { disabled: dis }) : null,
    (s.mission.securedAt != null || s.phase === 'consolidation' || s.clock.minutes >= s.mission.nlt) ? btn('Report mission complete', () => app.endOperation(), 'small', { disabled: dis }) : null,
    h('span', { class: 'muted small' }, `Turn ${s.turnCount}`, s.settings.ironman ? tag('IRONMAN', 'bad') : null)
  );
  return q;
}
