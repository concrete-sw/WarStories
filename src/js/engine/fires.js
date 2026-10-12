// Indirect fire: mortars, artillery, naval gunfire, air, helicopters, drones.
// A call for fire takes time to arrive, can land off target (and on your own
// people), and gets faster and more accurate when it is sent in proper form, on
// a pre-planned target, by an observer who can see the target.

import { WEATHER } from '../data/terrain.js';
import { neighbours, hasLOS, refOf, distance, compass, bearing } from './grid.js';
import { friendlyUnits, liveUnit, addRadio, addLog } from './state.js';
import { indirectEffect, coverOf } from './combat.js';
import { applyCasualties } from './casualties.js';
import { lightAt } from './clock.js';
import { clamp, pick } from './util.js';

export const FIRE_KINDS = ['HE', 'smoke', 'illum'];

/** Is an asset able to fire now? Returns null or a reason. */
export function assetBlocked(state, a) {
  const now = state.clock.minutes;
  if (a.left <= 0) return 'out of ammunition for further missions';
  if (now < a.availableFromMinutes) return `not available until ${Math.round(a.availableFromMinutes - now)} minutes from now`;
  if (now > a.availableToMinutes) return 'no longer allocated to you';
  if (a.disabled) return a.disabled;
  const w = WEATHER[state.weatherNow] || WEATHER.clear;
  if (['air', 'helicopter'].includes(a.type) && !w.air) return `grounded by the weather (${w.name})`;
  if (a.type === 'air' && state.era.tech <= 3 && lightAt(state).phase === 'night') return 'no close air support at night';
  if (a.type === 'drone' && state.flags.includes('jammed')) return 'jammed';
  return null;
}

/** Best asset for a request, or the named one. */
export function pickAsset(state, kind = null, assetId = null) {
  const list = state.fires.assets.filter(a => !assetBlocked(state, a));
  if (assetId) return state.fires.assets.find(a => a.id === assetId) || null;
  if (kind) { const k = list.find(a => a.type === kind); if (k) return k; }
  return list.sort((a, b) => a.response - b.response)[0] || null;
}

/**
 * Request fire. req: { cell, assetId, assetType, kind: 'HE'|'smoke'|'illum', quality (0..1), method: 'adjust'|'ffe', observerId, trp }
 * Returns { ok, mission, reason }.
 */
export function requestFire(state, req, ctx) {
  const asset = pickAsset(state, req.assetType, req.assetId);
  if (!asset) return { ok: false, reason: state.fires.assets.length ? 'no fire support is available right now' : 'you have no fire support' };
  const blocked = assetBlocked(state, asset);
  if (blocked) return { ok: false, reason: `${asset.name}: ${blocked}`, asset };
  if (req.cell == null || req.cell < 0) return { ok: false, reason: 'no valid target grid' };
  const now = state.clock.minutes;
  const q = clamp(req.quality ?? 0.5, 0, 1);
  const trp = state.controlMeasures.some(c => c.type === 'TRP' && c.cells.includes(req.cell)) || state.fires.missions.some(m => m.cell === req.cell && m.status === 'done' && m.hit);
  const comms = state.units.u0?.radio === 'down' ? 2.2 : state.units.u0?.radio === 'intermittent' ? 1.4 : 1;
  const bg = state.settings.background === 'radio' ? 0.85 : 1;
  const delay = Math.max(1, Math.round(asset.response * (q < 0.4 ? 1.5 : q > 0.8 ? 0.8 : 1) * (trp ? 0.6 : 1) * comms * bg * (0.85 + ctx.rnd() * 0.3)));
  const danger = friendlyUnits(state).filter(u => liveUnit(u) && (u.cell === req.cell || neighbours(state.grid.n, req.cell).includes(u.cell)));
  const m = {
    id: `fm${state.fires.nextId++}`, assetId: asset.id, assetType: asset.type, assetName: asset.name, cell: req.cell, kind: FIRE_KINDS.includes(req.kind) ? req.kind : 'HE',
    quality: q, method: req.method === 'ffe' ? 'ffe' : 'adjust', observerId: req.observerId || 'u0', requestedAt: now, impactAt: now + delay, status: 'pending', trp, dangerClose: danger.map(u => u.id), side: 'friendly'
  };
  asset.left -= 1; asset.used += 1;
  state.fires.missions.push(m);
  state.stats.firesCalled += 1;
  return { ok: true, mission: m, asset, delay };
}

/** Enemy indirect fire on a square (pre-registered, fast, sometimes brutal). */
export function enemyFire(state, cell, kind, source) {
  const now = state.clock.minutes;
  state.fires.missions.push({ id: `ef${state.fires.nextId++}`, assetType: kind, assetName: source, cell, kind: 'HE', quality: 0.7, method: 'ffe', requestedAt: now, impactAt: now + 1, status: 'pending', side: 'enemy' });
}

/** Resolve every mission due by now. Pushes lines and casualties into the report. */
export function processFires(state, ctx, report) {
  const now = state.clock.minutes; const { rnd } = ctx; const n = state.grid.n;
  const accuracy = ctx.era.accuracy ?? 0.6;
  for (const m of state.fires.missions) {
    if (m.status !== 'pending' || m.impactAt > now) continue;
    m.status = 'done';
    const observer = state.units[m.observerId] || state.units.u0;
    const sees = observer && hasLOS(state.grid, observer.cell, m.cell);
    let pOn = m.side === 'enemy' ? 0.75 : accuracy * (0.55 + 0.45 * m.quality) * (sees ? 1.1 : 0.7) * (m.trp ? 1.2 : 1) * (m.assetType === 'drone' ? 1.3 : 1);
    if (m.method === 'adjust' && m.side !== 'enemy') pOn = Math.min(0.97, pOn + 0.15);
    let impact = m.cell;
    if (rnd() > clamp(pOn, 0.05, 0.97)) {
      const nb = neighbours(n, m.cell);
      impact = pick(nb, rnd);
      if (m.quality < 0.35 && rnd() < 0.35) { const nb2 = neighbours(n, impact).filter(x => x !== m.cell); impact = pick(nb2, rnd); }
    }
    m.impact = impact; m.hit = impact === m.cell;
    const off = impact === m.cell ? 'on target' : `${Math.round(distance(n, m.cell, impact) * state.scale.cellM)} m ${compass(bearing(n, m.cell, impact))} of the aim point, at ${refOf(n, impact)}`;
    const who = m.side === 'enemy' ? `Enemy ${m.assetName || 'fire'}` : m.assetName;
    if (m.kind === 'smoke') {
      state.smoke = state.smoke || {};
      for (const c of [impact, ...neighbours(n, impact, false)]) state.smoke[c] = now + Math.max(state.scale.tick * 2, 10);
      report.lines.push(`${who}: smoke landed ${off}. It screens ${refOf(n, impact)} and the squares around it for a while.`);
      report.fires.push({ ...m });
      continue;
    }
    if (m.kind === 'illum') {
      state.illum = { cell: impact, until: now + Math.max(state.scale.tick, 8) };
      report.lines.push(`${who}: illumination hangs over ${refOf(n, impact)}; the ground below is lit for a few minutes.`);
      report.fires.push({ ...m });
      continue;
    }
    const lines = [];
    const hitUnits = Object.values(state.units).filter(u => liveUnit(u) && !u.decoy && (u.cell === impact || neighbours(n, impact).includes(u.cell)));
    for (const u of hitUnits) {
      const adjacent = u.cell !== impact;
      if (adjacent && !['artillery', 'naval', 'air', 'rocket'].includes(m.assetType)) continue;
      const eff = indirectEffect(m.assetType, u, { cover: coverOf(state.grid, u), rnd, adjacent });
      u.suppression = clamp(u.suppression + eff.suppression, 0, 100);
      u.engagedAt = now;
      const friendlyFire = m.side === 'friendly' && u.side === 'friendly';
      if (eff.casualties > 0) {
        const cas = applyCasualties(state, u, eff.casualties, ctx, report, friendlyFire ? 'friendly fire' : 'shellfire');
        report.casualties.push(...cas.map(c => ({ ...c, friendlyFire })));
        u.morale = clamp(u.morale - eff.casualties / Math.max(1, u.start) * 70 - 6, 0, 100);
        lines.push(`${u.side === 'enemy' ? (state.picture.contacts[u.id] ? `enemy at ${refOf(n, u.cell)}` : `an unseen enemy position at ${refOf(n, u.cell)}`) : u.name}: ${eff.casualties} hit${friendlyFire ? ' (FRIENDLY FIRE)' : ''}`);
        if (u.side === 'enemy' && m.side === 'friendly') report.enemyHits.push({ unitId: u.id, count: eff.casualties, by: 'fires' });
      } else lines.push(`${u.side === 'enemy' ? `enemy at ${refOf(n, u.cell)}` : u.name} under fire, suppressed`);
      if (friendlyFire) { state.stats.fratricide += 1; report.fratricide = true; }
      if (u.side === 'enemy') { m.effect = (m.effect || 0) + eff.casualties; }
    }
    // Civilians in the beaten zone.
    const civ = (state.truth.people || []).find(p => p.kind === 'civilian' && p.cell && refOf(n, impact) === String(p.cell).toUpperCase() && !p.gone);
    if (civ && m.side === 'friendly' && rnd() < 0.6) {
      const k = Math.max(1, Math.round(rnd() * Math.min(6, civ.count || 3)));
      state.stats.civilianCasualties += k; state.conduct.civiliansHarmed += k;
      lines.push(`civilians at ${refOf(n, impact)} (${civ.name}): ${k} hurt or killed`);
      report.civilians = (report.civilians || 0) + k;
    }
    report.lines.push(`${who} (${m.kind}) landed ${off}${lines.length ? `: ${lines.join('; ')}` : ': nothing seen to be hit'}.`);
    report.fires.push({ ...m });
    if (m.side === 'friendly') {
      const asset = state.fires.assets.find(a => a.id === m.assetId);
      addRadio(state, { net: 'fires', from: asset?.callsign || m.assetName, to: state.units.u0.callsign, text: m.hit ? `Shot, over. Rounds complete at ${refOf(n, m.cell)}.` : `Shot, over. Rounds complete. Observer reports fall of shot ${off}; give correction, over.` });
    } else if (hitUnits.some(u => u.side === 'friendly')) {
      report.interrupt = report.interrupt || 'incoming fire';
    }
  }
  // Keep the list short.
  if (state.fires.missions.length > 80) state.fires.missions = state.fires.missions.slice(-80);
}

/** Quality of a call for fire written in a template: 0..1 from the fields that are right. */
export function callForFireQuality(state, f) {
  let q = 0.2;
  if (f.observer) q += 0.1;
  if (f.warning && /adjust|effect|suppress|immediate/i.test(f.warning)) q += 0.15;
  if (f.cell != null && f.cell >= 0) q += 0.25;
  if (f.description && f.description.length > 3) q += 0.15;
  if (f.method && f.method.length > 1) q += 0.1;
  if (f.control && f.control.length > 1) q += 0.05;
  return clamp(q, 0, 1);
}

export function firesSummary(state) {
  return state.fires.assets.map(a => ({ id: a.id, name: a.name, type: a.type, callsign: a.callsign, left: a.left, response: a.response, blocked: assetBlocked(state, a) }));
}

export function announceFire(state, res) {
  if (!res.ok) return;
  addLog(state, 'system', `Fire mission ${res.mission.id}: ${res.asset.name} on ${refOf(state.grid.n, res.mission.cell)} (${res.mission.kind}). Rounds expected in about ${res.delay} min.${res.mission.dangerClose.length ? ' DANGER CLOSE: friendly troops are in or beside the target square.' : ''}`, 'system');
}
