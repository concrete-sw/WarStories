// The enemy thinks, a little. Each enemy unit follows its commander's plan
// (timed orders from the scenario) and reacts by doctrine: defenders hold and
// fire, the threatened fall back to their fallback positions, reserves
// counterattack lost ground, reinforcements march to the sound of the guns,
// and mortars drop pre-registered fire on anything they have seen.

import { enemyUnits, friendlyUnits, liveUnit } from './state.js';
import { distance, neighbours, findPath, refOf, parseRef } from './grid.js';
import { normTask } from './schema.js';
import { enemyFire } from './fires.js';
import { clamp } from './util.js';

function setOrder(state, e, task, cell, why) {
  const n = state.grid.n;
  e.order = { task, cell, issuedAt: state.clock.minutes, startAt: state.clock.minutes, status: 'active', why };
  const mob = e.type === 'armor' || e.type === 'mech' ? 'tracked' : e.type === 'recon' ? 'light' : 'foot';
  e.mobility = mob;
  if (cell != null && cell >= 0 && cell !== e.cell && ['move', 'assault', 'withdraw', 'counterattack', 'reinforce', 'patrol', 'recon', 'delay', 'ambush'].includes(task)) {
    const avoid = new Set(friendlyUnits(state).filter(liveUnit).map(u => u.cell));
    e.path = findPath(state.grid, e.cell, cell, mob, task === 'withdraw' ? avoid : null); e.progress = 0;
    e.posture = task === 'withdraw' ? 'withdrawing' : 'moving';
  } else {
    e.path = [];
    if (task === 'dig_in' || task === 'defend' || task === 'hold') e.posture = e.posture === 'dug_in' ? 'dug_in' : (task === 'dig_in' ? 'dug_in' : 'cover');
    if (task === 'ambush') e.posture = 'ambush';
    if (task === 'halt') e.posture = 'cover';
  }
  e.history.push({ at: state.clock.minutes, task, cell, why });
  if (cell != null && cell >= 0) e.lastOrderRef = refOf(n, cell);
}

/** Total friendly strength within r squares of a cell. */
function pressure(state, cell, r = 2) {
  const n = state.grid.n;
  return friendlyUnits(state).filter(u => liveUnit(u) && !u.isHQ && distance(n, u.cell, cell) <= r).reduce((s, u) => s + u.strength * (u.type === 'armor' ? 3 : 1), 0);
}

function awayFrom(state, cell, threatCell) {
  const n = state.grid.n;
  const opts = neighbours(n, cell).filter(k => !state.grid.cells[k].water);
  let best = cell, bd = -1;
  for (const k of opts) { const d = distance(n, k, threatCell); if (d > bd) { bd = d; best = k; } }
  const next = neighbours(n, best).filter(k => !state.grid.cells[k].water).sort((a, b) => distance(n, b, threatCell) - distance(n, a, threatCell))[0];
  return next ?? best;
}

export function enemyAI(state, ctx, report) {
  const now = state.clock.minutes; const n = state.grid.n; const { rnd } = ctx;
  const friends = friendlyUnits(state).filter(u => liveUnit(u));
  for (const e of enemyUnits(state)) {
    if (!liveUnit(e) || e.decoy) continue;
    e.startCell = e.startCell ?? e.cell;
    // 1. The plan.
    const plan = e.plan || [];
    while (e.planStep + 1 < plan.length && plan[e.planStep + 1].atMinutes <= now) {
      e.planStep += 1;
      const p = plan[e.planStep];
      const cell = parseRef(n, p.target);
      setOrder(state, e, normTask(p.task), cell >= 0 ? cell : e.cell, 'plan');
      if (['assault', 'counterattack', 'move'].includes(e.order.task) && cell !== e.cell) report.enemyMoves.push({ unitId: e.id, task: e.order.task, to: cell });
    }
    // 2. Broken units run.
    if (e.posture === 'broken') {
      const threat = friends.sort((a, b) => distance(n, a.cell, e.cell) - distance(n, b.cell, e.cell))[0];
      if (threat && (!e.order || e.order.task !== 'withdraw')) setOrder(state, e, 'withdraw', e.fallback >= 0 ? e.fallback : awayFrom(state, e.cell, threat.cell), 'broken');
      continue;
    }
    // 3. Pinned attackers go to ground.
    if (e.suppression > 72 && e.order && ['assault', 'move', 'counterattack'].includes(e.order.task) && e.order.status === 'active') { e.posture = 'pinned'; e.order.paused = true; }
    else if (e.order?.paused && e.suppression < 40) { e.order.paused = false; e.posture = 'moving'; }
    // 4. Doctrine.
    const press = pressure(state, e.cell, 2);
    const ratio = press / Math.max(1, e.strength);
    const threatened = e.strength < 0.55 * Math.max(1, e.start) || ratio > 2.6;
    if ((e.reaction === 'withdraw' || e.reaction === 'delay') && threatened && !e.hasWithdrawn) {
      const threat = friends.sort((a, b) => distance(n, a.cell, e.cell) - distance(n, b.cell, e.cell))[0];
      const to = e.fallback >= 0 && e.fallback !== e.cell ? e.fallback : threat ? awayFrom(state, e.cell, threat.cell) : e.cell;
      setOrder(state, e, 'withdraw', to, `${e.reaction}: pressed`); e.hasWithdrawn = true;
      report.enemyMoves.push({ unitId: e.id, task: 'withdraw', to });
    }
    if (e.reaction === 'counterattack' && !e.counterattacked && e.strength > 0.5 * Math.max(1, e.start)) {
      const held = new Set([...enemyUnits(state).map(x => x.startCell ?? x.cell), ...(state.mission.objectiveCells || [])]);
      const lost = friends.filter(u => !u.isHQ && held.has(u.cell) && distance(n, u.cell, e.cell) <= 6).sort((a, b) => distance(n, a.cell, e.cell) - distance(n, b.cell, e.cell))[0];
      if (lost && (state.mission.securedAt != null || ['attack', 'seize', 'clear', 'raid', 'secure'].includes(state.mission.type))) {
        const wait = e.waitUntil ?? (e.waitUntil = now + Math.max(state.scale.tick * 2, 10) + Math.round(rnd() * state.scale.tick * 3));
        if (now >= wait) { setOrder(state, e, 'counterattack', lost.cell, 'counterattack: retake lost ground'); e.counterattacked = true; report.enemyMoves.push({ unitId: e.id, task: 'counterattack', to: lost.cell }); }
      }
    }
    if (e.reaction === 'reinforce' && !e.reinforcing) {
      const hot = enemyUnits(state).find(x => x !== e && liveUnit(x) && !x.decoy && now - x.engagedAt < state.scale.tick * 2 && distance(n, x.cell, e.cell) <= 7);
      if (hot) { const to = neighbours(n, hot.cell).find(k => !state.grid.cells[k].water && !friends.some(f => f.cell === k)) ?? hot.cell; setOrder(state, e, 'move', to, 'reinforce'); e.reinforcing = true; report.enemyMoves.push({ unitId: e.id, task: 'reinforce', to }); }
    }
    if (e.reaction === 'ambush' && e.posture !== 'ambush' && !e.sprung && (!e.order || e.order.task === 'defend' || e.order.task === 'ambush')) e.posture = 'ambush';
    // 5. Indirect fire on what they can see.
    if ((e.type === 'mortar' || e.type === 'artillery') && e.strength > 0 && e.ammo > 10 && now - (e.lastFiredAt || -9999) >= Math.max(state.scale.tick, 4)) {
      const known = Object.entries(state.enemyKnows || {}).filter(([id, k]) => now - k.at <= state.scale.tick * 2 && state.units[id] && liveUnit(state.units[id]));
      const reach = (e.type === 'artillery' ? 12 : 5) * (state.scale.tick <= 5 ? 1.5 : 1);
      const ownNear = c => enemyUnits(state).some(x => liveUnit(x) && !x.decoy && x.strength > 0 && distance(n, x.cell, c) <= 1.5);
      const pickT = known.map(([id, k]) => ({ id, cell: k.cell, d: distance(n, e.cell, k.cell) })).filter(x => x.d <= reach && !ownNear(x.cell)).sort((a, b) => a.d - b.d)[0];
      if (pickT && rnd() < 0.55) { enemyFire(state, pickT.cell, e.type, e.type === 'mortar' ? 'mortars' : 'artillery'); e.lastFiredAt = now; e.ammo = clamp(e.ammo - 8, 0, 100); }
    }
  }
}
