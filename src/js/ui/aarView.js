// The after-action review screen (the truth unsealed, the replay, the roll
// call, the awards) and the interlude between operations (refit, replacements,
// mail call, promotion).

import { h, append, clear } from './dom.js';
import { btn, tag, section, kv, glossify } from './panels/common.js';
import { renderMapSVG } from './mapView.js';
import { makeRack } from './ribbons.js';
import { personLabel } from '../engine/state.js';
import { formatHM, formatDuration } from '../engine/clock.js';
import { canContinue } from '../engine/campaign.js';
import { exportState } from '../engine/storage.js';
import { echelonById } from '../data/echelons.js';

const OUTCOME = { success: ['MISSION ACCOMPLISHED', 'ok'], partial: ['PARTIAL SUCCESS', 'warn'], failure: ['MISSION FAILED', 'bad'], pending: ['UNRESOLVED', 'warn'] };

export function renderAAR(app, s, el) {
  const a = s.aar; const p = a.prose || {};
  clear(el);
  const [label, cls] = OUTCOME[a.outcome] || OUTCOME.pending;
  append(el,
    h('div', { class: 'stamp-row' }, h('span', { class: 'stamp' }, 'AFTER-ACTION REVIEW'), h('span', { class: 'form-no' }, `OPERATION ${a.codename} · ${a.date}`)),
    h('h1', {}, a.title), h('p', { class: 'muted small' }, `${a.place} · ${a.player} · ${a.duration}`),
    h('div', { class: 'row' }, h('span', { class: `tag ${cls}`, style: 'font-size:14px;padding:2px 10px' }, label), h('span', { class: 'small' }, a.endText), h('span', { class: 'score', style: 'margin-left:auto' }, a.rating.grade.toUpperCase()), h('span', { class: 'muted' }, `${a.rating.score}/100`)),
    p.verdict ? h('p', { class: 'verdict narr' }, glossify(p.verdict)) : null,
    p.offline ? h('p', { class: 'small warn' }, `The Game Master could not write the review (${p.offline}); this is the staff's short version.`) : null);
  // Replay with the truth laid over the map.
  const last = s.trace.length ? s.trace[s.trace.length - 1].at : s.clock.minutes;
  const first = s.trace.length ? s.trace[0].at : 0;
  const mapBox = h('div', { class: 'mapbox map-svg-wrap', style: 'position:relative' });
  const view = {};
  const slider = h('input', { type: 'range', min: String(first), max: String(last), value: String(last), step: '1', 'aria-label': 'Replay time', style: 'width:100%' });
  const when = h('span', { class: 'small muted' }, '');
  const draw = () => { const at = Number(slider.value); when.textContent = `${formatHM(s, at)} · the truth: where everyone really was`; clear(mapBox).append(renderMapSVG(s, { view, showTruth: true, at })); };
  slider.addEventListener('input', draw);
  append(el, h('div', { class: 'two' },
    h('div', {}, h('h2', {}, 'The truth, unsealed'), mapBox, slider, when, h('p', { class: 'small muted' }, 'Red: the enemy as he really was, with his movements. Blue: yours. Dummy positions are marked DECOY.')),
    h('div', {}, p.whatHappened ? section('What really happened', h('p', { class: 'narr small' }, glossify(p.whatHappened))) : null, p.enemyView ? section('The enemy\'s view', h('p', { class: 'narr small' }, h('i', {}, p.enemyView))) : null, p.history ? section('History', h('p', { class: 'small' }, p.history)) : null)));
  setTimeout(draw, 0);
  append(el, h('div', { class: 'two' },
    section('Sustain', h('ul', { class: 'small' }, (p.sustain || []).map(x => h('li', {}, x)))),
    section('Improve', h('ul', { class: 'small' }, (p.improve || []).map(x => h('li', {}, x))))));
  const dec = (p.deceptions && p.deceptions.length ? p.deceptions : a.deceptions);
  if (dec.length) append(el, section('Deceptions', h('ul', { class: 'small' }, dec.map(d => h('li', {}, h('b', {}, d.what), d.truth ? ` — ${d.truth}` : '', d.fooled === true ? tag('fooled you', 'bad') : d.fooled === false ? tag('you saw through it', 'ok') : d.revealed ? tag('found', 'ok') : null)))));
  append(el, section('Score', h('table', {}, h('tbody', {}, a.rating.parts.map(x => h('tr', {}, h('td', {}, x.label), h('td', {}, `${x.v > 0 ? '+' : ''}${x.v}`)))))));
  append(el, section('Your decisions', h('ol', { class: 'small timeline' }, a.timeline.map(d => h('li', {}, h('span', { class: 'muted' }, `${d.time} `), d.text)))));
  const ech = echelonById(s.settings.echelonId);
  append(el, section('Roll call',
    a.rollCall.length ? h('table', {}, h('thead', {}, h('tr', {}, h('th', {}, 'Name'), h('th', {}, 'Unit'), h('th', {}, 'Status'), h('th', {}, 'When'))), h('tbody', {}, a.rollCall.map(r => h('tr', {}, h('td', {}, r.name, h('div', { class: 'small muted' }, r.role)), h('td', {}, r.unit), h('td', {}, r.status === 'kia' ? tag('KIA', 'bad') : r.status === 'mia' ? tag('MIA', 'bad') : r.status === 'evac' ? tag('evacuated', 'info') : tag(`WIA ${r.wound}`, 'warn')), h('td', {}, r.at))))) : h('p', { class: 'small' }, 'Everyone came back.'),
    ech.tier >= 3 ? h('table', {}, h('thead', {}, h('tr', {}, h('th', {}, 'Unit'), h('th', {}, 'Start'), h('th', {}, 'Now'), h('th', {}, 'Killed'), h('th', {}, 'Wounded'), h('th', {}, 'Missing'))), h('tbody', {}, a.stats.unitLosses.map(u => h('tr', {}, h('td', {}, u.unit), h('td', {}, u.start), h('td', {}, u.now), h('td', {}, u.kia), h('td', {}, u.wia), h('td', {}, u.mia + u.captured))))) : null,
    h('p', { class: 'small' }, `Enemy: ${a.stats.enemyKIA} killed, ${a.stats.enemyWIA} wounded, ${a.stats.prisoners} prisoners. Friendly fire incidents: ${a.stats.fratricide}. Civilians hurt by your fire: ${a.stats.civilianCasualties}.`)));
  const aw = a.awards;
  if (aw.player.length || aw.recommended.length) append(el, section('Decorations',
    aw.player.length ? h('div', {}, makeRack(aw.player.map(x => ({ name: x.award.name, ribbon: x.award.ribbon }))), h('ul', { class: 'small' }, aw.player.map(x => h('li', {}, h('b', {}, x.award.name), ` · ${x.reason}`)))) : null,
    p.citation ? h('div', { class: 'typed' }, h('div', { class: 'typed-head' }, h('span', {}, 'CITATION'), h('span', {}, '')), p.citation) : null,
    aw.recommended.length ? h('ul', { class: 'small' }, aw.recommended.map(r => h('li', {}, `${r.name}: ${r.asked} → `, r.status === 'approved' ? tag('approved', 'ok') : r.status === 'downgraded' ? tag(`downgraded to ${r.got}`, 'warn') : tag('denied', 'bad')))) : null));
  const c = a.consequences;
  append(el, section('What it means for you', c.notes.length ? h('ul', { class: 'small' }, c.notes.map(x => h('li', {}, x))) : null, p.higherView ? h('p', { class: 'small' }, h('b', {}, 'Higher: '), p.higherView) : null, p.theMen ? h('p', { class: 'small' }, h('b', {}, 'The men: '), p.theMen) : null, p.epitaph ? h('p', { class: 'narr' }, h('i', {}, p.epitaph)) : null));
  if (a.wall.length) append(el, section('The Wall', h('ul', { class: 'wall' }, a.wall.map(w => h('li', {}, h('b', {}, `${w.rank} ${w.name}`), w.isPlayer ? tag('you', 'bad') : null, h('div', { class: 'small muted' }, `${w.role || ''} · ${w.unit || ''}${w.hometown ? ` · ${w.hometown}` : ''}`), w.line ? h('div', { class: 'small' }, w.line) : null)))));
  const more = canContinue(s);
  append(el, h('div', { class: 'row' },
    more ? btn(s.settings.mode === 'career' ? 'Continue my career ▸' : 'Next operation ▸', () => app.toNextOperation(), 'primary') : null,
    btn('Back to the log', () => { app.enterDesktop(false); }, 'ghost'),
    btn('Export the record', () => exportState(s), 'ghost'),
    btn('New game', () => app.newGame(), more ? 'ghost' : 'primary')),
    !more && s.settings.mode !== 'single' ? h('p', { class: 'small muted' }, s.ended.kind === 'kia' ? 'Your war is over. The record stays.' : s.settings.mode === 'campaign' ? 'The campaign is over.' : '') : null);
  el.scrollTop = 0;
}

export function renderInterlude(app, s, el, { aar, mail, settings, carry, onNext }) {
  clear(el);
  const promo = aar.consequences.promotion;
  const veterans = carry.veterans || [];
  const lostCount = aar.rollCall.filter(r => ['kia', 'mia'].includes(r.status) || (r.status === 'evac' && !/light/.test(r.wound))).length;
  append(el,
    h('div', { class: 'stamp-row' }, h('span', { class: 'stamp' }, 'REST AND REFIT'), h('span', { class: 'form-no' }, `after ${aar.codename}`)),
    h('h1', {}, promo ? 'Promotion' : 'Out of the line'),
    h('p', { class: 'narr' }, promo ? `Orders came down: you are to take a ${promo}. New faces, a bigger map, longer days. The men you led give you a send-off that is half a wake.` : `A few days back from the line: hot food, a shower if there is one, sleep. ${lostCount ? `${lostCount} of the men will not be coming back; strangers will fill their places.` : 'Everyone came back this time. Nobody says it out loud.'}`),
    !promo && veterans.length ? section('Who is still with you', h('p', { class: 'small' }, veterans.slice(0, 16).map(v => `${v.rank || ''} ${v.name}`.trim()).join(', '))) : null,
    s.campaign.ops.length ? section('The campaign so far', h('ul', { class: 'small' }, s.campaign.ops.map(o => h('li', {}, `${o.date} · ${o.codename}: ${o.title} · ${o.outcome} · ${o.grade}`)))) : null,
    mail.length ? section('Mail call', mail.map(l => h('div', { class: 'letter' }, h('div', { class: 'from' }, `From ${l.from} · to ${l.toName}`), l.text))) : section('Mail call', h('p', { class: 'small muted' }, 'Nothing came this time. The mail is always late.')));
  const status = h('p', { class: 'muted small', role: 'status' });
  const go = btn(promo ? `Report to your new command ▸` : 'Next operation ▸', async () => { go.disabled = true; status.className = 'muted small'; await onNext(status); go.disabled = false; }, 'primary');
  append(el, h('div', { class: 'row' }, go, btn('Main menu', () => app.quitToMenu(), 'ghost')), status);
  void personLabel; void kv; void formatDuration;
}
