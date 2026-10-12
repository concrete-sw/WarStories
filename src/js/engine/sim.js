// The simulation. Time moves in ticks of the echelon's beat; each tick resolves
// orders, the enemy's plan, movement, spotting, direct fire, assaults, indirect
// fire, morale, radios, the wounded, supply, the player's own state, timed
// events and intelligence, and the mission's status. Everything that happens is
// written into a report the GM then narrates. Nothing here asks the AI.

import { ctxOf, friendlyUnits, enemyUnits, liveUnit, addFact, addRadio, addIntelItem, addLog, membersOf, personLabel } from './state.js';
import { distance, hasLOS, moveFactor, neighbours, refOf, parseRef, findPath, colRow, bearing } from './grid.js';
import { UNIT_TYPES, MOBILITY, WEATHER, QUALITY } from '../data/terrain.js';
import { fireValue, effectOf, assaultResult, coverOf, concealOf, rangeKm, dice } from './combat.js';
import { applyCasualties, tickWounded, woundPerson } from './casualties.js';
import { processFires } from './fires.js';
import { enemyAI } from './enemy.js';
import { activate } from './orders.js';
import { tickLogistics } from './logistics.js';
import { evaluateMission } from './objectives.js';
import { lightAt, lightFactor, formatHM } from './clock.js';
import { normTask } from './schema.js';
import { clamp, pick, asArray, str, num } from './util.js';

export function simCtx(state, rnd = Math.random) { return { ...ctxOf(state), rnd }; }

export function newReport(state) {
  return { start: state.clock.minutes, end: state.clock.minutes, minutes: 0, lines: [], casualties: [], enemyHits: [], contacts: [], fires: [], events: [], intel: [], enemyMoves: [], moraleBreaks: [], surrenders: [], assaults: [], arrivals: [], ledger: [], exchanges: {}, playerHit: null, interrupt: null, objective: null, phaseChange: null, decoysRevealed: [], orderArrivals: [], initiative: [] };
}

/**
 * Advance the game by `minutes`. opts: { stopOnInterrupt, rnd, ctx, report }.
 * A quiet span compresses; a turn that hits something stops at the decision point.
 */
export function simulate(state, minutes, opts = {}) {
  const ctx = opts.ctx || simCtx(state, opts.rnd);
  const report = opts.report || newReport(state);
  let remaining = Math.max(0, Math.round(minutes));
  const tick = state.scale.tick;
  let steps = 0;
  while (remaining > 0 && !state.ended) {
    const dt = Math.min(tick, remaining);
    step(state, dt, ctx, report);
    remaining -= dt; steps++;
    if (opts.stopOnInterrupt && report.interrupt) break;
    if (report.playerHit && report.playerHit.severity !== 'light') break;
    if (state.mission.status === 'failure' && !opts.ignoreEnd) break;
  }
  finishReport(state, report);
  report.steps = steps;
  return report;
}

function step(state, dt, ctx, report) {
  state.clock.minutes += dt;
  const now = state.clock.minutes;
  const frac = dt / state.scale.tick;
  ctx.light = lightAt(state); ctx.weather = WEATHER[state.weatherNow] || WEATHER.clear; ctx.frac = frac; ctx.dt = dt;
  if (state.phase === 'planning' && now >= state.mission.hHour) {
    state.phase = 'execution'; report.phaseChange = 'execution';
    report.lines.push(`H-hour, ${formatHM(state, state.mission.hHour)}. The operation is under way.`);
    report.interrupt = report.interrupt || 'H-hour';
  }
  fireEvents(state, ctx, report);
  deliverIntel(state, ctx, report);
  for (const u of friendlyUnits(state)) {
    if (u.order?.status === 'pending' && now >= u.order.startAt) {
      activate(state, u);
      report.orderArrivals.push({ unitId: u.id, order: u.order });
    }
    if (u.order?.task === 'dig_in' && u.order.status === 'active' && now >= (u.order.digUntil || 0)) { u.posture = 'dug_in'; u.order.status = 'done'; report.lines.push(`${u.name} has dug in at ${refOf(state.grid.n, u.cell)}.`); }
  }
  enemyAI(state, ctx, report);
  initiative(state, ctx, report);
  for (const u of Object.values(state.units)) if (liveUnit(u) && !u.decoy) move(state, u, dt, ctx, report);
  spot(state, ctx, report);
  directFire(state, ctx, report);
  assaults(state, ctx, report);
  processFires(state, ctx, report);
  morale(state, ctx, report);
  comms(state, ctx, report);
  tickWounded(state, ctx, report);
  tickLogistics(state, dt, ctx, report);
  playerTick(state, dt, ctx, report);
  const ev = evaluateMission(state);
  if (ev.changed) { report.objective = ev; report.interrupt = report.interrupt || 'objective'; }
  trace(state);
}

// ------------------------------------------------------------ events and intel
function fireEvents(state, ctx, report) {
  const now = state.clock.minutes; const n = state.grid.n;
  for (const e of asArray(state.truth.events)) {
    if (state.eventsFired.includes(e.id) || e.atMinutes > now) continue;
    state.eventsFired.push(e.id);
    const fx = e.effects || {};
    const applied = [];
    const commsUnit = fx.comms?.unit || fx.commsUnit; const commsState = fx.comms?.state || (typeof fx.comms === 'string' ? fx.comms : null);
    if (commsUnit && ['ok', 'intermittent', 'down'].includes(commsState)) {
      for (const u of friendlyUnits(state)) if (commsUnit === 'all' || u.id === commsUnit) { u.radio = commsState; u.radioUntil = now + Math.max(30, state.scale.tick * 4); }
      applied.push(`radio ${commsState} for ${commsUnit === 'all' ? 'everyone' : state.units[commsUnit]?.name || commsUnit}`);
    }
    if (fx.jamming != null) { if (fx.jamming) { if (!state.flags.includes('jammed')) state.flags.push('jammed'); } else state.flags = state.flags.filter(f => f !== 'jammed'); applied.push(fx.jamming ? 'jamming begins' : 'jamming ends'); }
    if (fx.weather && WEATHER[fx.weather]) { state.weatherNow = fx.weather; applied.push(`weather: ${WEATHER[fx.weather].name}`); }
    for (const id of [].concat(fx.spawnEnemy || [])) { const u = state.units[id]; if (u && u.side === 'enemy') { u.dormant = false; if (fx.spawnCell && parseRef(n, fx.spawnCell) >= 0) u.cell = parseRef(n, fx.spawnCell); applied.push(`enemy ${u.name} enters the area`); } }
    for (const id of [].concat(fx.spawnFriendly || [])) { const u = state.units[id]; if (u && u.side === 'friendly') { u.dormant = false; applied.push(`${u.name} arrives`); } }
    if (fx.enemyOrder?.unit && state.units[fx.enemyOrder.unit]) { const u = state.units[fx.enemyOrder.unit]; const c = parseRef(n, fx.enemyOrder.target); u.plan = [...(u.plan || []).slice(0, u.planStep + 1), { atMinutes: now, task: normTask(fx.enemyOrder.task), target: c >= 0 ? refOf(n, c) : refOf(n, u.cell) }, ...(u.plan || []).slice(u.planStep + 1)]; }
    const sid = fx.support?.id || fx.supportId;
    if (sid) { const a = state.fires.assets.find(x => x.id === sid); if (a) { const av = fx.support?.available ?? fx.supportAvailable; if (av === false) a.disabled = str(fx.support?.reason) || 'withdrawn by higher'; if (av === true) a.disabled = null; if (num(fx.support?.missions, 0)) a.left += Math.round(num(fx.support.missions, 0)); applied.push(`${a.name} ${a.disabled ? 'unavailable' : 'available'}`); } }
    if (Number.isFinite(num(fx.nltMinutes, NaN))) { state.mission.nlt = clamp(Math.round(num(fx.nltMinutes)), now, state.mission.end); applied.push(`new deadline ${formatHM(state, state.mission.nlt)}`); }
    if (asArray(fx.objectiveCells).length) { const cells = asArray(fx.objectiveCells).map(x => parseRef(n, x)).filter(x => x >= 0); if (cells.length) { state.mission.objectiveCells = cells; state.mission.securedAt = null; state.mission.heldTicks = 0; applied.push(`new objective ${cells.map(c => refOf(n, c)).join(', ')}`); } }
    if (fx.civilians) { const c = fx.civilians; state.truth.people = asArray(state.truth.people); state.truth.people.push({ id: `cv${state.truth.people.length + 1}`, kind: 'civilian', name: str(c.name) || 'civilians', cell: str(c.cell), count: Math.max(1, Math.round(num(c.count, 6))), description: e.text }); applied.push(`civilians at ${c.cell}`); }
    if (fx.friendlyLoss?.unit && state.units[fx.friendlyLoss.unit]) { const u = state.units[fx.friendlyLoss.unit]; const cas = applyCasualties(state, u, Math.round(num(fx.friendlyLoss.count, 1)), ctx, report, str(fx.friendlyLoss.cause) || 'accident'); report.casualties.push(...cas); }
    if (fx.logistics?.item && state.logistics[fx.logistics.item] != null) { state.logistics[fx.logistics.item] = clamp(state.logistics[fx.logistics.item] + num(fx.logistics.amount, 0), 0, 100); }
    if (fx.standing && typeof fx.standing === 'object') for (const k of ['superiors', 'troops', 'staff', 'political']) if (num(fx.standing[k], 0)) state.standing[k] = clamp(state.standing[k] + num(fx.standing[k], 0), 0, 100);
    report.events.push({ id: e.id, kind: e.kind, text: e.text, visible: e.visible, urgent: e.urgent, applied, flash: e.kind === 'higher' && e.urgent });
    if (e.visible) {
      if (e.kind === 'higher' || e.kind === 'fire_support' || e.kind === 'logistics') addRadio(state, { net: e.kind === 'logistics' ? (ctx.echelon.tier >= 4 ? 'admin' : 'higher') : e.kind === 'fire_support' ? 'fires' : 'higher', from: state.truth.higher?.commander?.callsign || 'Higher', to: state.units.u0.callsign, text: e.text, garble: state.units.u0.radio === 'intermittent' ? 0.15 : 0 });
      if (e.urgent || e.kind === 'higher' || e.kind === 'enemy') report.interrupt = report.interrupt || 'event';
    }
  }
}

function deliverIntel(state, ctx, report) {
  const now = state.clock.minutes; const n = state.grid.n;
  for (const it of asArray(state.truth.intel)) {
    if (state.intelDelivered.includes(it.id) || it.atMinutes > now) continue;
    state.intelDelivered.push(it.id);
    const cell = it.cell ? parseRef(n, it.cell) : -1;
    addIntelItem(state, { id: it.id, source: it.source, reliability: it.reliability, text: it.text, cell: cell >= 0 ? cell : null, about: it.about, truthful: it.truthful, kind: 'intel' });
    report.intel.push(it);
    if (cell >= 0) {
      const target = it.about && state.units[it.about]?.side === 'enemy' ? state.units[it.about] : null;
      const key = target && it.truthful ? target.id : `x-${it.id}`;
      const existing = state.picture.contacts[key];
      if (!existing || existing.confidence === 'possible') state.picture.contacts[key] = { id: key, cell, at: now, confidence: 'possible', size: target ? Math.round((target.fakeStrength || target.strength || 10) * (0.7 + ctx.rnd() * 0.6)) : null, type: target?.type || 'unknown', source: `${it.source} (${it.reliability})`, firstAt: now, reported: true, falseContact: !it.truthful || !target };
    }
  }
}

// ------------------------------------------------------------ movement
function move(state, u, dt, ctx, report) {
  const o = u.order;
  if (!o || o.status !== 'active' || !u.path?.length || o.paused) return;
  if (u.posture === 'broken' && o.task !== 'withdraw') return;
  if (u.suppression > 65 && !['withdraw'].includes(o.task)) { if (u.posture !== 'pinned') { u.posture = 'pinned'; if (u.side === 'friendly') report.lines.push(`${u.name} is pinned down at ${refOf(state.grid.n, u.cell)}.`); } return; }
  if (u.posture === 'pinned') u.posture = o.task === 'withdraw' ? 'withdrawing' : 'moving';
  const n = state.grid.n; const ech = ctx.echelon;
  const mob = u.mobility || 'foot';
  const nv = u.side === 'friendly' ? !!ctx.army?.nightVision : state.era.tech >= 5;
  const night = ctx.light.phase === 'night' ? (nv ? 0.9 : 0.65) : 1;
  const taskMult = o.task === 'recon' ? 0.6 : o.task === 'assault' || o.task === 'counterattack' ? 1.1 : o.task === 'withdraw' ? 1.15 : 1;
  const kmh = ech.footKmh * (MOBILITY[mob]?.kmh || 1) * ctx.weather.move * night * (1 - u.fatigue / 260) * (1 - u.suppression / 160) * taskMult * (u.side === 'enemy' ? 1 : 1);
  u.progress = (u.progress || 0) + kmh * (dt / 60) * 1000 / state.scale.cellM;
  let moved = false; const from = u.cell;
  while (u.path.length) {
    const next = u.path[0];
    const blocker = Object.values(state.units).find(x => x.side !== u.side && liveUnit(x) && !x.decoy && x.strength > 0 && x.cell === next);
    if (blocker) { if (!['assault', 'counterattack'].includes(o.task)) { u.posture = 'halted'; u.path = []; o.status = 'done'; o.blocked = true; } break; }
    const mf = Math.max(0.08, moveFactor(state.grid, next, mob));
    const cr = colRow(n, u.cell), nr = colRow(n, next);
    const cost = (cr.c !== nr.c && cr.r !== nr.r ? 1.414 : 1) / mf;
    if (u.progress < cost) break;
    u.progress -= cost; u.cell = next; u.path.shift(); moved = true;
    if (u.side === 'friendly') u.fatigue = clamp(u.fatigue + 1.2 * (mob === 'foot' ? 1 : 0.4), 0, 100);
    const c = state.grid.cells[next];
    if (c.mines && u.type !== 'engineer') {
      const k = Math.max(1, Math.round(u.strength * (0.05 + ctx.rnd() * 0.08)));
      const cas = applyCasualties(state, u, k, ctx, report, 'mine');
      if (u.side === 'friendly') { report.casualties.push(...cas); report.interrupt = report.interrupt || 'mine'; }
      report.lines.push(`${u.side === 'friendly' ? u.name : 'An enemy unit'} hit mines at ${refOf(n, next)}: ${k} casualt${k === 1 ? 'y' : 'ies'}.`);
      if (u.side === 'friendly') { u.path = []; o.status = 'done'; o.blocked = true; u.posture = 'halted'; }
      break;
    }
    if (o.task === 'breach' && u.type === 'engineer' && next === o.cell) { c.mines = false; c.wire = false; report.lines.push(`${u.name} breached the obstacle at ${refOf(n, next)}.`); }
  }
  if (moved && u.side === 'friendly') report.lines.push(`${u.name} moved ${refOf(n, from)} → ${refOf(n, u.cell)}.`);
  if (moved) u.history.push({ at: state.clock.minutes, cell: u.cell });
  if (!u.path.length && o.status === 'active') {
    const arrived = u.cell === o.cell;
    if (['move', 'withdraw', 'recon', 'reinforce', 'breach', 'screen', 'ambush'].includes(o.task) || (['assault', 'counterattack'].includes(o.task) && arrived)) {
      o.status = arrived || o.task !== 'assault' ? 'done' : o.status;
      u.posture = o.task === 'ambush' ? 'ambush' : o.task === 'screen' ? 'cover' : (state.grid.cells[u.cell].t !== 'open' ? 'cover' : 'halted');
      if (o.task === 'patrol' && o.origin != null && !o.returning) { o.returning = true; o.status = 'active'; u.path = findPath(state.grid, u.cell, o.origin, mob); }
      if (u.side === 'friendly' && arrived) { report.arrivals.push({ unitId: u.id, cell: u.cell, task: o.task }); report.interrupt = report.interrupt || 'arrival'; }
    }
  }
}

// ------------------------------------------------------------ spotting
function spot(state, ctx, report) {
  const now = state.clock.minutes; const n = state.grid.n; const ech = ctx.echelon; const { rnd } = ctx;
  const cellKm = state.scale.cellM / 1000;
  state.enemyKnows = state.enemyKnows || {};
  const smoke = state.smoke || {};
  const illum = state.illum && state.illum.until >= now ? state.illum : null;
  for (const side of ['friendly', 'enemy']) {
    const observers = Object.values(state.units).filter(u => u.side === side && liveUnit(u) && !u.decoy && u.strength > 0);
    const targets = Object.values(state.units).filter(u => u.side !== side && liveUnit(u) && (side === 'friendly' ? true : !u.decoy));
    const nv = side === 'friendly' ? !!ctx.army?.nightVision : state.era.tech >= 5;
    for (const T of targets) {
      let best = 0, by = null, bestD = 99;
      for (const O of observers) {
        const d = distance(n, O.cell, T.cell);
        const lit = illum && distance(n, illum.cell, T.cell) <= 1.5;
        const lf = lit ? 1 : lightFactor(ctx.light, nv);
        let range = ech.sightKm * (UNIT_TYPES[O.type]?.spot || 1) * lf * ctx.weather.sight * (state.grid.cells[O.cell].elev >= 2 ? 1.3 : 1) * (O.order?.task === 'recon' || O.order?.task === 'screen' ? 1.4 : 1);
        if (side === 'friendly' && ['hunter', 'reenlisted'].includes(state.settings.background)) range *= 1.1;
        if (d > 1.5 && d * cellKm > range) continue;
        if (d > 1.5 && (smoke[T.cell] >= now || smoke[O.cell] >= now)) continue;
        if (d > 1.5 && !hasLOS(state.grid, O.cell, T.cell)) continue;
        const conceal = concealOf(state.grid, T, smoke[T.cell] >= now);
        const moving = ['moving', 'assault', 'withdrawing'].includes(T.posture) ? 1.6 : 1;
        const firing = now - (T.lastFiredAt ?? -9999) <= state.scale.tick ? 2.5 : 1;
        const big = T.decoy ? 1 : clamp(Math.log10((T.strength || 1) + 1) / 1.2, 0.5, 1.4);
        const near = d <= 1.5 ? 0.85 : clamp(1 - (d * cellKm) / range, 0.05, 1);
        let p = near * (1 - conceal) * moving * firing * big * (QUALITY[O.quality] || 1);
        if (side === 'friendly') p *= ctx.difficulty.id === 'green' ? 1.2 : ctx.difficulty.id === 'veteran' ? 0.9 : 1;
        else p *= ctx.difficulty.enemySkill;
        if (T.posture === 'ambush' && d > 1.5) p *= 0.3;
        if (p > best) { best = p; by = O; bestD = d; }
      }
      if (!by) continue;
      const pdt = 1 - Math.pow(1 - clamp(best, 0, 0.97), ctx.frac);
      if (rnd() >= pdt) continue;
      if (side === 'enemy') { state.enemyKnows[T.id] = { cell: T.cell, at: now, by: by.id }; continue; }
      updateContact(state, T, by, bestD, ctx, report);
    }
  }
  // Ground that is visibly empty clears stale contacts.
  for (const c of Object.values(state.picture.contacts)) {
    if (c.cleared) continue;
    const there = friendlyUnits(state).some(u => liveUnit(u) && u.cell === c.cell);
    const real = state.units[c.id];
    if (there && (!real || real.cell !== c.cell || !liveUnit(real))) { c.cleared = true; c.clearedAt = now; if (c.falseContact) report.lines.push(`Nothing at ${refOf(n, c.cell)}: the reported enemy position there is empty.`); }
  }
}

function updateContact(state, T, O, d, ctx, report, heard = false) {
  const now = state.clock.minutes; const n = state.grid.n; const { rnd } = ctx;
  if (T.decoy && d <= 1.5) {
    const c = state.picture.contacts[T.id];
    if (!c || !c.cleared) { state.picture.contacts[T.id] = { ...(c || {}), id: T.id, cell: T.cell, at: now, confidence: 'confirmed', cleared: true, decoyRevealed: true, type: T.type, source: O.name };
      report.decoysRevealed.push(T.id); report.lines.push(`${O.name} got close enough to see the "enemy position" at ${refOf(n, T.cell)} for what it is: a dummy.`); addFact(state, `The enemy position at ${refOf(n, T.cell)} was a decoy.`, 'game'); }
    return;
  }
  const cellKm = state.scale.cellM / 1000;
  const confident = !heard && (d <= 1.5 || d * cellKm < ctx.echelon.sightKm * 0.4);
  const old = state.picture.contacts[T.id];
  const cell = confident || rnd() > (heard ? 0.5 : 0.3) ? T.cell : pick(neighbours(n, T.cell), rnd);
  const size = confident ? (T.decoy ? (T.fakeStrength || 8) : T.strength) : Math.max(1, Math.round((T.decoy ? (T.fakeStrength || 8) : T.strength) * (0.6 + rnd() * 0.8)));
  const isNew = !old || old.cleared || now - old.at > state.scale.tick * 3 || old.falseContact;
  state.picture.contacts[T.id] = { id: T.id, cell, at: now, confidence: confident ? 'confirmed' : 'probable', size, type: confident || rnd() < 0.5 ? T.type : (old?.type || 'unknown'), source: heard ? `${O.name} (fire from that direction)` : O.name, firstAt: old && !old.cleared ? old.firstAt : now, vehicles: T.vehicles ? (confident ? T.vehicles : Math.max(1, Math.round(T.vehicles * (0.6 + rnd() * 0.8)))) : 0, heard: heard || undefined };
  if (isNew) {
    report.contacts.push({ id: T.id, cell, by: O.id, type: state.picture.contacts[T.id].type, size, confidence: confident ? 'confirmed' : 'probable', decoy: !!T.decoy });
    report.interrupt = report.interrupt || 'contact';
    if (O.id !== 'u0' && O.radio !== 'down' && ctx.echelon.tier >= 2) addRadio(state, { net: 'own', from: O.callsign || O.name, to: state.units.u0.callsign, text: `Contact. ${size > 1 ? `About ${size}` : 'One'} ${typeWord(state.picture.contacts[T.id].type)} at grid ${refOf(n, cell)}, ${T.posture === 'moving' ? 'moving' : 'static'}. Over.`, garble: O.radio === 'intermittent' ? 0.2 : 0 });
  }
  // Old false reports of this unit elsewhere are superseded.
  for (const c of Object.values(state.picture.contacts)) if (c.falseContact && !c.cleared && c.cell === cell) { c.cleared = true; c.clearedAt = now; }
}

export function enemyWord(t) { const w = typeWord(t); return w === 'enemy' ? 'enemy position' : `enemy ${w}`; }
export function typeWord(t) { return { infantry: 'infantry', mg: 'machine gun', mortar: 'mortar', armor: 'tanks', mech: 'armoured vehicles with infantry', recon: 'scouts', engineer: 'engineers', artillery: 'guns', at: 'anti-tank weapons', hq: 'command post', sniper: 'sniper', aviation: 'helicopters', support: 'vehicles', militia: 'fighters', unknown: 'enemy' }[t] || 'enemy'; }

// ------------------------------------------------------------ direct fire
function fires(state, A, now) {
  const o = A.order;
  if (A.posture === 'broken' || A.ammo <= 0 || A.strength <= 0 || UNIT_TYPES[A.type]?.indirect && A.side === 'enemy') return false;
  if (A.holdFire && now - A.engagedAt > state.scale.tick) return false;
  // Before H-hour friendly troops keep their positions hidden: they return fire, or fire when ordered to.
  if (A.side === 'friendly' && state.phase === 'planning' && !A.weaponsFree && !(o?.status === 'active' && ['suppress', 'assault', 'support', 'counterattack', 'breach'].includes(o.task))) return now - A.engagedAt <= state.scale.tick;
  if (A.side === 'enemy' && A.posture === 'withdrawing') return now - A.engagedAt <= state.scale.tick;
  if (!o || o.status !== 'active') return true;
  if (o.task === 'move' || o.task === 'recon' || o.task === 'patrol') return now - A.engagedAt <= state.scale.tick;
  return true;
}

function directFire(state, ctx, report) {
  const now = state.clock.minutes; const n = state.grid.n; const ech = ctx.echelon; const { rnd } = ctx;
  const cellKm = state.scale.cellM / 1000;
  const shooters = Object.values(state.units).filter(u => liveUnit(u) && !u.decoy && u.strength > 0);
  for (const A of shooters) {
    if (!fires(state, A, now)) continue;
    const reach = rangeKm(ech, A);
    const known = id => A.side === 'friendly' ? (state.picture.contacts[id] && !state.picture.contacts[id].cleared && now - state.picture.contacts[id].at <= state.scale.tick && state.picture.contacts[id].cell === state.units[id].cell) : (state.enemyKnows?.[id] && now - state.enemyKnows[id].at <= state.scale.tick);
    // A suppression order puts fire on the square whether or not anyone there has been seen.
    const areaCell = A.side === 'friendly' && A.order?.status === 'active' && ['suppress', 'support'].includes(A.order.task) ? A.order.cell : null;
    const cands = Object.values(state.units).filter(T => T.side !== A.side && liveUnit(T) && (A.side === 'friendly' || !T.decoy) && (known(T.id) || (areaCell != null && T.cell === areaCell)));
    let target = null, best = -Infinity, tD = 0, area = false;
    for (const T of cands) {
      const d = distance(n, A.cell, T.cell);
      if (d > 1.5 && d * cellKm > reach) continue;
      if (d > 1.5 && !hasLOS(state.grid, A.cell, T.cell)) continue;
      let score = -d + (A.order?.cell === T.cell ? 6 : 0) + (A.order?.cell != null && distance(n, A.order.cell, T.cell) <= 1 ? 2 : 0) + Math.log10((T.strength || 1) + 1);
      if (score > best) { best = score; target = T; tD = d; area = !known(T.id); }
    }
    if (!target) { if (areaCell != null && distance(n, A.cell, areaCell) * cellKm <= reach) { A.ammo = clamp(A.ammo - 4 * ctx.frac, 0, 100); A.lastFiredAt = now; report.exchanges[`${A.id}>@${areaCell}`] = { a: A.id, cell: areaCell, ticks: (report.exchanges[`${A.id}>@${areaCell}`]?.ticks || 0) + 1, empty: true }; } continue; }
    // Ambushers hold fire until the enemy is in the kill zone.
    if (A.posture === 'ambush') { if (tD > 1.5) continue; A.sprung = true; }
    const surprise = A.posture === 'ambush' || (target.posture === 'moving' && now - target.engagedAt > state.scale.tick * 3 && A.side === 'enemy' && A.posture === 'dug_in' && rnd() < 0.4);
    if (A.posture === 'ambush') A.posture = 'cover';
    const moving = ['moving', 'assault'].includes(A.posture) && A.path?.length > 0;
    const lf = lightFactor(ctx.light, A.side === 'friendly' ? !!ctx.army?.nightVision : state.era.tech >= 5);
    // Enfilade: fire from a flank the target is not facing strips its cover.
    const brg = bearing(n, target.cell, A.cell);
    if (target.facingAt !== now) { target.facing = brg; target.facingAt = now; }
    const off = Math.abs(((brg - target.facing) + 540) % 360 - 180);
    const flank = off > 70 && tD > 0.5;
    const fv = fireValue(A, target, { distKm: tD * cellKm, rangeKm: reach, surprise, moving, lightF: Math.max(0.35, lf), enemySkill: ctx.difficulty.enemySkill, rnd });
    if (area) fv.fire *= 0.5;
    if (flank) fv.fire *= 1.25;
    const cover = coverOf(state.grid, target) * (flank ? 0.55 : 1);
    // Whoever is shot at gets an idea where it came from.
    if (A.side === 'enemy' && !known(A.id) && !A.decoy) { const c = state.picture.contacts[A.id]; if ((!c || c.cleared || now - c.at > state.scale.tick * 3) && rnd() < 0.6) updateContact(state, A, target, 99, ctx, report, true); }
    A.lastFiredAt = now;
    A.ammo = clamp(A.ammo - (A.type === 'mg' ? 9 : A.type === 'armor' ? 5 : 6) * ctx.frac * (ech.tier >= 4 ? 1.4 : 1), 0, 100);
    if (target.decoy) { report.exchanges[`${A.id}>${target.id}`] = { a: A.id, t: target.id, ticks: (report.exchanges[`${A.id}>${target.id}`]?.ticks || 0) + 1, hits: 0, decoy: true }; continue; }
    const eff = effectOf(fv.fire, target, { cover, lethality: ech.lethality, dtFrac: ctx.frac, rnd });
    target.suppression = clamp(target.suppression + eff.suppression, 0, 100);
    target.engagedAt = now; target.lastHitBy = A.id;
    A.engagedAt = Math.max(A.engagedAt, now - state.scale.tick / 2);
    const key = `${A.id}>${target.id}`;
    const ex = report.exchanges[key] || (report.exchanges[key] = { a: A.id, t: target.id, ticks: 0, hits: 0, supp: 0, surprise: false, named: [] });
    ex.ticks += 1; ex.supp = Math.max(ex.supp, Math.round(target.suppression)); ex.surprise = ex.surprise || surprise; ex.flank = ex.flank || flank; ex.area = ex.area || area;
    if (state.settings.dice === 'shown') report.ledger.push({ a: A.id, t: target.id, roll: fv.dice.roll, dice: fv.dice.dice, fire: Math.round(fv.fire * 10) / 10, parts: fv.parts, cover: Math.round(cover * 100), cas: eff.casualties, exp: Math.round(eff.expected * 100) / 100 });
    if (eff.casualties > 0) {
      ex.hits += eff.casualties;
      const cas = applyCasualties(state, target, eff.casualties, ctx, report, 'fire', A);
      target.morale = clamp(target.morale - clamp(60 * eff.casualties / Math.max(1, target.start), 2, 30), 0, 100);
      if (target.side === 'friendly') { report.casualties.push(...cas); ex.named.push(...cas.filter(c => c.label).map(c => `${c.label} (${c.status === 'kia' ? 'KIA' : `WIA, ${c.severity}, ${c.part}`})`)); report.interrupt = report.interrupt || 'casualties'; }
      else report.enemyHits.push({ unitId: target.id, count: eff.casualties, by: A.id });
    }
    if (target.side === 'friendly' && ex.ticks === 1) report.interrupt = report.interrupt || 'under fire';
    if (surprise && target.side === 'friendly' && !state.contactMoment && target.cell === state.units.u0.cell || (surprise && target.id === 'u0')) report.contactMoment = { by: A.id, target: target.id };
  }
}

// ------------------------------------------------------------ assaults
function assaults(state, ctx, report) {
  const n = state.grid.n; const { rnd } = ctx; const now = state.clock.minutes;
  for (const A of Object.values(state.units)) {
    const o = A.order;
    if (!liveUnit(A) || A.decoy || A.strength <= 0 || !o || o.status !== 'active' || !['assault', 'counterattack'].includes(o.task) || o.paused) continue;
    if (A.suppression >= 70 || A.posture === 'broken') continue;
    const tgtCell = A.path?.length ? A.path[0] : o.cell;
    if (tgtCell == null || tgtCell < 0) continue;
    const defenders = Object.values(state.units).filter(D => D.side !== A.side && liveUnit(D) && !D.decoy && D.strength > 0 && D.cell === tgtCell);
    if (!defenders.length) {
      const dummy = Object.values(state.units).find(D => D.side !== A.side && D.decoy && D.cell === tgtCell && !state.picture.contacts[D.id]?.decoyRevealed);
      if (dummy && A.side === 'friendly' && distance(n, A.cell, tgtCell) <= 1.5) updateContact(state, dummy, A, 1, ctx, report);
      continue;
    }
    if (distance(n, A.cell, tgtCell) > 1.5) continue;
    if (rnd() > ctx.frac) continue;
    const D = defenders.sort((a, b) => b.strength - a.strength)[0];
    A.posture = 'assault';
    const res = assaultResult(A, D, { coverDef: coverOf(state.grid, D), rnd, enemySkill: ctx.difficulty.enemySkill });
    const aLoss = Math.max(res.outcome === 'repulsed' ? 1 : 0, Math.round(A.strength * res.attLoss));
    const dLoss = Math.max(res.outcome === 'taken' ? 1 : 0, Math.round(D.strength * res.defLoss));
    const ca = applyCasualties(state, A, aLoss, ctx, report, 'assault', D);
    const cd = applyCasualties(state, D, dLoss, ctx, report, 'assault', A);
    if (A.side === 'friendly') report.casualties.push(...ca); else report.casualties.push(...cd);
    if (A.side === 'friendly') report.enemyHits.push({ unitId: D.id, count: dLoss, by: A.id }); else report.enemyHits.push({ unitId: A.id, count: aLoss, by: D.id });
    A.engagedAt = now; D.engagedAt = now;
    const entry = { attacker: A.id, defender: D.id, cell: tgtCell, outcome: res.outcome, ratio: Math.round(res.ratio * 100) / 100, attLoss: aLoss, defLoss: dLoss, dice: res.dice };
    if (res.outcome === 'taken') {
      const escape = neighbours(n, D.cell).filter(k => !state.grid.cells[k].water && !Object.values(state.units).some(x => x.side === A.side && liveUnit(x) && x.cell === k)).sort((a, b) => distance(n, b, A.cell) - distance(n, a, A.cell));
      if ((res.surrender || !escape.length) && D.strength > 0) {
        D.surrendered = true; entry.surrendered = D.strength;
        if (D.side === 'enemy') { state.stats.prisoners += D.strength; state.conduct.prisonersTaken += D.strength; report.surrenders.push({ unitId: D.id, count: D.strength, cell: D.cell }); addFact(state, `${D.strength} enemy soldiers surrendered at ${refOf(n, D.cell)}. They are your prisoners now.`, 'game'); }
        else { D.captured = D.strength; state.stats.friendlyMIA += D.strength; for (const p of membersOf(state, D)) if (p.status === 'ok') { p.status = 'mia'; p.captured = true; } report.surrenders.push({ unitId: D.id, count: D.strength, cell: D.cell, friendly: true }); }
      } else if (D.strength > 0) {
        D.cell = escape[0]; D.posture = res.defBreaks ? 'broken' : 'withdrawing'; D.path = []; if (D.order) D.order.status = 'done';
        D.morale = clamp(D.morale - 20, 0, 100); D.suppression = clamp(D.suppression + 30, 0, 100);
        entry.retreatedTo = refOf(n, D.cell);
      }
      if (!Object.values(state.units).some(x => x.side !== A.side && liveUnit(x) && !x.decoy && x.strength > 0 && x.cell === tgtCell)) {
        A.cell = tgtCell; if (A.path?.[0] === tgtCell) A.path.shift();
        if (!A.path.length) { o.status = 'done'; A.posture = 'halted'; }
        else A.posture = 'moving';
        A.morale = clamp(A.morale + 8, 0, 100);
      }
    } else if (res.outcome === 'bloody') {
      A.suppression = clamp(A.suppression + 25, 0, 100); D.suppression = clamp(D.suppression + 25, 0, 100);
    } else {
      A.suppression = clamp(A.suppression + 55, 0, 100); A.morale = clamp(A.morale - 18, 0, 100);
      const back = neighbours(n, A.cell).filter(k => !state.grid.cells[k].water && !Object.values(state.units).some(x => x.side !== A.side && liveUnit(x) && x.cell === k)).sort((a, b) => distance(n, b, tgtCell) - distance(n, a, tgtCell))[0];
      if (back != null) A.cell = back;
      A.posture = 'pinned'; o.status = 'failed'; o.failReason = 'assault repulsed'; A.path = [];
    }
    report.assaults.push(entry);
    report.interrupt = report.interrupt || 'assault';
  }
}

// ------------------------------------------------------------ morale
function morale(state, ctx, report) {
  const now = state.clock.minutes; const n = state.grid.n; const f = ctx.frac; const tick = state.scale.tick;
  const hq = state.units.u0;
  for (const u of Object.values(state.units)) {
    if (!liveUnit(u) || u.decoy || u.strength <= 0) continue;
    const underFire = now - u.engagedAt <= tick;
    if (underFire) { if (u.suppression > 70) u.morale -= 3 * f; u.suppression = u.suppression * Math.pow(0.8, f); }
    else { u.suppression = u.suppression * Math.pow(0.5, f); if (u.posture !== 'broken') u.morale += 2 * f; }
    if (u.ammo < 15) u.morale -= 2 * f;
    if (u.side === 'friendly' && !u.isHQ && hq && distance(n, hq.cell, u.cell) <= 1.5 && state.people.p0.status === 'ok') u.morale += 1.5 * f * (state.settings.background === 'mustang' || state.settings.background === 'reenlisted' ? 1.4 : 1);
    if (u.side === 'friendly') u.morale += (state.standing.troops - 60) / 200 * f;
    const cap = u.quality === 'elite' ? 90 : u.quality === 'veteran' ? 82 : 76;
    u.morale = clamp(u.morale, 0, Math.max(cap, Math.min(u.morale, 100)));
    if (!underFire && u.morale > cap) u.morale = Math.max(cap, u.morale - f);
    // Checks.
    const enemyNear = Object.values(state.units).some(x => x.side !== u.side && liveUnit(x) && !x.decoy && x.strength > 0 && distance(n, x.cell, u.cell) <= 1.5);
    if (u.posture !== 'broken' && u.morale < 16 && underFire) {
      u.posture = 'broken';
      report.moraleBreaks.push({ unitId: u.id, side: u.side, cell: u.cell });
      if (u.side === 'friendly') { report.lines.push(`${u.name} has broken and is falling back without orders.`); report.interrupt = report.interrupt || 'morale'; const away = neighbours(n, u.cell).filter(k => !state.grid.cells[k].water).sort((a, b) => distance(n, a, hq.cell) - distance(n, b, hq.cell))[0]; if (away != null) { u.order = { task: 'withdraw', cell: away, status: 'active', issuedAt: now, startAt: now, why: 'broken' }; u.path = [away]; } }
      else report.lines.push(`The enemy at ${refOf(n, u.cell)} is breaking.`);
    } else if (u.posture !== 'broken' && u.posture !== 'pinned' && u.morale < 32 && u.suppression > 60) {
      u.posture = 'pinned';
    }
    if (u.posture === 'broken' && u.side === 'enemy' && u.morale < 9 && enemyNear && !u.surrendered) {
      u.surrendered = true; state.stats.prisoners += u.strength; state.conduct.prisonersTaken += u.strength;
      report.surrenders.push({ unitId: u.id, count: u.strength, cell: u.cell });
      addFact(state, `${u.strength} enemy soldiers gave themselves up at ${refOf(n, u.cell)}.`, 'game');
      report.interrupt = report.interrupt || 'surrender';
    }
    if (u.posture === 'broken' && u.morale > 38 && !enemyNear) { u.posture = 'halted'; if (u.side === 'friendly') report.lines.push(`${u.name} has rallied at ${refOf(n, u.cell)}.`); }
    u.fatigue = clamp(u.fatigue + (u.posture === 'moving' ? 0.6 : underFire ? 0.8 : -0.4) * f, 0, 100);
  }
}

// ------------------------------------------------------------ radios and reports
function comms(state, ctx, report) {
  const now = state.clock.minutes; const n = state.grid.n; const ech = ctx.echelon; const { rnd } = ctx; const f = ctx.frac;
  const rel = ctx.era.comms?.reliability ?? 0.8;
  const jam = state.flags.includes('jammed') ? 0.25 : 0;
  const hq = state.units.u0;
  for (const u of friendlyUnits(state)) {
    if (!liveUnit(u)) continue;
    if (u.radioUntil && now >= u.radioUntil) { u.radio = 'ok'; u.radioUntil = null; }
    if (ech.tier <= 1) {
      // Squad level: you can see and shout to your teams nearby; beyond that, nothing.
      const d = distance(n, hq.cell, u.cell);
      const seen = d <= 1.5 || hasLOS(state.grid, hq.cell, u.cell);
      u.radio = d <= Math.max(2, 300 / state.scale.cellM) && seen ? 'ok' : (state.era.tech >= 4 ? 'intermittent' : 'down');
      if (seen && d <= 6) u.reported = { cell: u.cell, at: now };
      continue;
    }
    if (u.isHQ) continue;
    if (!u.radioUntil) {
      if (u.radio === 'ok' && rnd() < ((1 - rel) * 0.1 + jam) * f) u.radio = 'intermittent';
      else if (u.radio === 'intermittent') { const r = rnd(); if (r < 0.12 * f + jam / 2) u.radio = 'down'; else if (r < 0.45 * f + 0.1) u.radio = 'ok'; }
      else if (u.radio === 'down' && rnd() < 0.25 * f) u.radio = 'intermittent';
    }
    if (u.radio === 'ok' && now - u.engagedAt <= state.scale.tick) u.reported = { cell: u.cell, at: now };
  }
  if (ech.reportEvery && now >= (state.nextReportAt ?? 0)) {
    state.nextReportAt = now + ech.reportEvery;
    const night = ctx.light.phase === 'night';
    for (const u of friendlyUnits(state)) {
      if (!liveUnit(u) || u.isHQ) continue;
      const leader = state.people[u.leaderId];
      if (u.radio === 'down' || (u.radio === 'intermittent' && rnd() < 0.5)) continue;
      let cell = u.cell;
      if (night && (leader?.competence || 3) <= 2 && rnd() < 0.12 && state.settings.background !== 'outdoors') { cell = pick(neighbours(n, u.cell), rnd); u.lost = true; }
      else u.lost = false;
      u.reported = { cell, at: now };
      const o = u.order;
      if (ech.tier >= 2) addRadio(state, { net: 'own', from: u.callsign || u.name, to: hq.callsign, text: `Situation report: at ${refOf(n, cell)}, ${u.strength} effective, ammunition ${Math.round(u.ammo)} percent${o && o.status === 'active' ? `, executing ${o.task}` : o?.status === 'done' ? ', task complete' : ''}${u.posture === 'pinned' ? ', pinned' : ''}. Over.`, garble: u.radio === 'intermittent' ? 0.15 : 0 });
    }
  }
}

// ------------------------------------------------------------ initiative
function initiative(state, ctx, report) {
  const now = state.clock.minutes; const n = state.grid.n; const { rnd } = ctx;
  const intent = state.planning.intent || '';
  for (const u of friendlyUnits(state)) {
    if (!liveUnit(u) || u.isHQ || u.posture === 'broken') continue;
    const leader = state.people[u.leaderId];
    const busy = u.order && (u.order.status === 'active' || u.order.status === 'pending');
    // Under fire with nothing better to do: take cover and return fire.
    if (!busy && now - u.engagedAt <= state.scale.tick && u.posture === 'halted') u.posture = 'cover';
    // A good leader who understands the intent keeps going when the plan stops.
    if (!busy && intent && (leader?.initiative || 3) >= 4 && state.phase === 'execution' && state.mission.securedAt == null && u.morale > 55 && u.strength >= u.start * 0.6 && rnd() < 0.15 * ctx.frac && !u.initiativeUsed) {
      const obj = state.mission.objectiveCells[0];
      if (obj != null && ['attack', 'seize', 'clear', 'raid', 'secure', 'counterattack'].includes(state.mission.type)) {
        u.initiativeUsed = true;
        u.order = { id: `oi${now}`, unitId: u.id, task: 'assault', cell: obj, how: state.mission.name, issuedAt: now, startAt: now, status: 'pending', source: 'initiative', clause: 'own initiative' };
        activate(state, u);
        report.initiative.push({ unitId: u.id, text: `${leader ? personLabel(state, leader) : u.name} moved ${u.name} toward ${state.mission.name} on his own initiative.` });
        report.lines.push(`${leader ? personLabel(state, leader) : u.name} is taking ${u.name} toward ${state.mission.name} on his own initiative, in keeping with your intent.`);
      }
    }
  }
}

// ------------------------------------------------------------ the player
function playerTick(state, dt, ctx, report) {
  const p = state.people.p0; if (!p || p.status !== 'ok' && p.status !== 'wia') return;
  const h = dt / 60;
  const tier = ctx.echelon.tier;
  if (!state.resting) p.fatigue = clamp((p.fatigue || 0) + h * (tier <= 2 ? 3.5 : 2.6) * (state.settings.background === 'athlete' ? 0.8 : 1), 0, 100);
  const hq = state.units.u0;
  if (now(state) - hq.engagedAt <= state.scale.tick) p.stress = clamp((p.stress || 0) + 2 * ctx.frac, 0, 100);
  else p.stress = clamp((p.stress || 0) - 0.5 * ctx.frac, 0, 100);
  const hit = report.casualties.find(c => c.isPlayer && !c.reported);
  if (hit) { hit.reported = true; report.playerHit = hit; report.interrupt = 'player hit'; }
}
const now = state => state.clock.minutes;

function trace(state) {
  const snap = { at: state.clock.minutes, u: {} };
  for (const u of Object.values(state.units)) if (!u.dormant) snap.u[u.id] = [u.cell, u.strength, u.surrendered ? 1 : 0];
  const last = state.trace[state.trace.length - 1];
  if (last && last.at === snap.at) state.trace[state.trace.length - 1] = snap; else state.trace.push(snap);
  if (state.trace.length > 500) state.trace.splice(1, state.trace.length - 500);
}

/** Turn the per-pair exchanges into lines the GM can narrate. */
function finishReport(state, report) {
  const n = state.grid.n;
  for (const ex of Object.values(report.exchanges)) {
    const A = state.units[ex.a], T = state.units[ex.t];
    if (ex.empty && A) { report.lines.push(`${A.side === 'friendly' ? A.name : 'The enemy'} put fire on ${refOf(n, ex.cell)}; nothing seen to be hit there.`); continue; }
    if (!A || !T) continue;
    const aName = A.side === 'friendly' ? A.name : (state.picture.contacts[A.id] && !state.picture.contacts[A.id].cleared ? `the ${enemyWord(state.picture.contacts[A.id].type)} at ${refOf(n, A.cell)}` : `unseen enemy fire from the direction of ${refOf(n, A.cell)}`);
    const tName = T.side === 'friendly' ? T.name : `the ${enemyWord(state.picture.contacts[T.id]?.type || T.type)} at ${refOf(n, T.cell)}`;
    if (ex.decoy) { report.lines.push(`${aName} fired on ${tName}; no return fire, no movement.`); continue; }
    report.lines.push(`${aName} fired on ${tName}${ex.surprise ? ' (SURPRISE: an ambush or a hidden position opening up at close range)' : ''}${ex.flank ? ' (from the flank: enfilade)' : ''}${ex.area ? ' (area fire on a suspected position)' : ''}: ${ex.hits ? `${ex.hits} hit` : 'no hits seen'}${T.side === 'friendly' && ex.named?.length ? ` — ${ex.hits > ex.named.length ? 'among them ' : ''}${ex.named.join('; ')}` : ''}${ex.supp >= 60 ? `, ${T.side === 'friendly' ? 'pinned down' : 'suppressed'}` : ''}.`);
  }
  for (const a of report.assaults) {
    const A = state.units[a.attacker], D = state.units[a.defender];
    const an = A.side === 'friendly' ? A.name : 'the enemy'; const dn = D.side === 'friendly' ? D.name : 'the enemy position';
    report.lines.push(`ASSAULT at ${refOf(n, a.cell)}: ${an} against ${dn}: ${a.outcome === 'taken' ? `${dn} was overrun${a.surrendered ? ` and ${a.surrendered} surrendered` : a.retreatedTo ? `, survivors fell back to ${a.retreatedTo}` : ''}` : a.outcome === 'bloody' ? 'hand-to-hand, neither side gave way' : 'the assault was thrown back'}. Losses: attacker ${a.attLoss}, defender ${a.defLoss}.`);
  }
  for (const s of report.surrenders) if (!s.friendly) report.lines.push(`${s.count} enemy soldiers surrendered at ${refOf(n, s.cell)}.`); else report.lines.push(`${state.units[s.unitId]?.name} was overrun; ${s.count} of your men are missing, probably captured.`);
  for (const a of report.orderArrivals) report.lines.push(`${state.units[a.unitId]?.name} received the order and began: ${a.order.task}${a.order.cell != null && a.order.cell >= 0 ? ` ${refOf(n, a.order.cell)}` : ''}${a.order.misread ? ` (MISREAD: ${a.order.misread})` : ''}.`);
  for (const a of report.arrivals) report.lines.push(`${state.units[a.unitId]?.name} reached ${refOf(n, a.cell)}.`);
  report.end = state.clock.minutes; report.minutes = report.end - report.start;
}

/** Minutes a quiet "continue" may run: to the next decision point, at most the echelon's span. */
export function continueSpan(state, ctx) {
  const now = state.clock.minutes;
  let span = state.scale.maxSpan;
  if (state.phase === 'planning') span = Math.max(state.scale.tick, Math.min(state.mission.hHour - now, ctx.echelon.planningMinutes[1]));
  const engaged = Object.values(state.units).some(u => liveUnit(u) && now - u.engagedAt <= state.scale.tick);
  if (engaged) span = state.scale.tick;
  return Math.max(state.scale.tick, Math.min(span, Math.max(state.scale.tick, state.mission.end - now)));
}

export { dice };
