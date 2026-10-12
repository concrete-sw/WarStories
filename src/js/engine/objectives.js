// What success looks like, decided by code from the mission type and the
// ground truth: who holds the objective squares, what is left of the force,
// and whether it happened in time.

import { friendlyUnits, enemyUnits, liveUnit } from './state.js';
import { refOf } from './grid.js';

const HOLD_TYPES = ['attack', 'seize', 'clear', 'secure', 'relief', 'rescue', 'crossing', 'breach', 'counterattack', 'escort'];
const DEFEND_TYPES = ['defend', 'hold', 'delay'];

export function strengthPct(state, side = 'friendly') {
  const us = (side === 'friendly' ? friendlyUnits(state) : enemyUnits(state)).filter(u => !u.isHQ && !u.decoy);
  const start = us.reduce((s, u) => s + (u.start || 0), 0);
  const now = us.reduce((s, u) => s + (u.surrendered || u.destroyed ? 0 : u.strength), 0);
  return start ? Math.round(now / start * 100) : 100;
}

function fighting(u) { return liveUnit(u) && !u.decoy && u.posture !== 'broken' && u.strength > 0; }

/** Who is on the objective right now. */
export function objectiveHold(state) {
  const cells = new Set(state.mission.objectiveCells);
  const fr = friendlyUnits(state).filter(u => fighting(u) && cells.has(u.cell));
  const en = enemyUnits(state).filter(u => fighting(u) && cells.has(u.cell));
  const occupied = [...cells].filter(c => fr.some(u => u.cell === c));
  return { friendly: fr, enemy: en, allHeld: cells.size > 0 && occupied.length === cells.size && en.length === 0, anyHeld: occupied.length > 0 && en.length === 0, contested: fr.length > 0 && en.length > 0 };
}

/**
 * Evaluate the mission now. Returns { status: 'pending'|'success'|'partial'|'failure', text, changed }.
 * final: true at the end of the operation, when "pending" must resolve.
 */
export function evaluateMission(state, { final = false } = {}) {
  const m = state.mission; const now = state.clock.minutes;
  const type = m.type;
  const own = strengthPct(state, 'friendly');
  const theirs = strengthPct(state, 'enemy');
  const broken = friendlyUnits(state).filter(u => !u.isHQ).every(u => !fighting(u));
  const prev = m.status;
  let status = 'pending', text = '';
  const hold = objectiveHold(state);
  const targets = m.targetUnits.length ? m.targetUnits.map(id => state.units[id]).filter(Boolean) : null;
  if (broken) { status = 'failure'; text = 'Your force is broken: nobody is left fighting.'; }
  else if (HOLD_TYPES.includes(type)) {
    if (hold.allHeld) { m.heldTicks += 1; if (m.securedAt == null) m.securedAt = now; }
    else if (!hold.anyHeld && m.securedAt != null && hold.enemy.length) { m.lostAt = now; m.securedAt = null; m.heldTicks = 0; }
    if (m.securedAt != null && m.heldTicks >= 2) { status = m.securedAt <= m.nlt && own >= 50 ? 'success' : 'partial'; text = `${m.name} is in your hands${m.securedAt > m.nlt ? ', later than ordered' : ''}${own < 50 ? ', at a terrible cost' : ''}.`; }
    else if (final || now > m.end) { status = hold.anyHeld || hold.contested ? 'partial' : 'failure'; text = hold.anyHeld ? `Part of ${m.name} is held; not all of it.` : hold.contested ? `${m.name} is still contested.` : `${m.name} was not taken.`; }
  } else if (DEFEND_TYPES.includes(type)) {
    if (hold.enemy.length && !hold.friendly.length) { if (m.lostAt == null) m.lostAt = now; } else if (hold.friendly.length && !hold.enemy.length) m.lostAt = null;
    if (final || now >= m.end) {
      if (m.lostAt == null && own >= 40) { status = 'success'; text = `You held ${m.name}.`; }
      else if (m.lostAt == null || theirs < 50) { status = 'partial'; text = m.lostAt == null ? `You held ${m.name}, barely.` : `${m.name} was lost, but the enemy paid for it.`; }
      else { status = 'failure'; text = `${m.name} was lost.`; }
      if (type === 'delay' && now >= m.nlt && own >= 35) { status = status === 'failure' ? 'partial' : 'success'; text = 'You bought the time you were asked for.'; }
    }
  } else if (type === 'raid' || type === 'ambush') {
    const tg = targets || enemyUnits(state).filter(u => !u.decoy);
    const done = tg.length && tg.every(u => !fighting(u));
    if (done) { status = own >= 50 ? 'success' : 'partial'; text = 'The target is destroyed or broken.'; }
    else if (final || now > m.end) { const some = tg.some(u => !fighting(u) || u.strength < u.start * 0.5); status = some ? 'partial' : 'failure'; text = some ? 'The target was hurt, not destroyed.' : 'The target escaped intact.'; }
  } else if (type === 'recon' || type === 'patrol') {
    const real = enemyUnits(state).filter(u => !u.decoy);
    const found = real.filter(u => state.picture.contacts[u.id] && ['confirmed', 'probable'].includes(state.picture.contacts[u.id].confidence)).length;
    const pct = real.length ? found / real.length : 1;
    if ((final || now > m.end) || pct >= 0.75) {
      if (pct >= 0.6 && own >= 60) status = 'success'; else if (pct >= 0.3) status = 'partial'; else status = 'failure';
      text = `You located ${found} of ${real.length} enemy positions${own < 60 ? ', and the patrol was badly hurt' : ''}.`;
      if (pct >= 0.75 && !final && now <= m.end && status === 'success') m.securedAt = m.securedAt ?? now;
      if (!final && now <= m.end && status !== 'success') status = 'pending';
    }
  } else if (type === 'withdraw') {
    if (hold.anyHeld && hold.friendly.length >= Math.ceil(friendlyUnits(state).filter(fighting).filter(u => !u.isHQ).length * 0.7)) { status = own >= 50 ? 'success' : 'partial'; text = 'The force reached the rally point.'; }
    else if (final || now > m.end) { status = own >= 40 ? 'partial' : 'failure'; text = 'The withdrawal was not completed as ordered.'; }
  } else {
    if (hold.allHeld) { status = 'success'; text = `${m.name} is yours.`; }
    else if (final || now > m.end) { status = hold.anyHeld ? 'partial' : 'failure'; text = hold.anyHeld ? 'A partial result.' : 'The mission was not accomplished.'; }
  }
  m.status = status;
  m.statusText = text;
  return { status, text, changed: status !== prev, own, theirs, hold: { held: hold.anyHeld, all: hold.allHeld, enemyOn: hold.enemy.map(u => refOf(state.grid.n, u.cell)) } };
}
