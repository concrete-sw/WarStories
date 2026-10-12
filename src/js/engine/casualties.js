// Who gets hit. At squad and platoon level the code's dice pick a named soldier
// and decide how badly; at company and above casualties are numbers, with the
// occasional leader by name. The wounded need evacuation in time, by era.

import { activeMembers, membersOf, personLabel, addFact, player } from './state.js';
import { nameOnDemand } from './forces.js';
import { clamp, pick } from './util.js';

const PARTS = ['head', 'neck', 'chest', 'shoulder', 'arm', 'hand', 'abdomen', 'hip', 'thigh', 'leg', 'foot', 'back'];

function severity(rnd, era) {
  const r = rnd();
  const kia = era.tech >= 6 ? 0.22 : era.tech >= 4 ? 0.26 : 0.3;
  return r < kia ? 'kia' : r < kia + 0.36 ? 'serious' : 'light';
}

/**
 * Apply `count` casualties to a unit. ctx: { era, echelon, difficulty, army, rnd, ironman }.
 * Returns the list of named casualties [{ personId, name, label, status, severity, part, isPlayer }].
 */
export function applyCasualties(state, unit, count, ctx, report, cause = 'fire', shooter = null) {
  count = Math.min(unit.strength, Math.max(0, Math.round(count)));
  if (!count) return [];
  const { rnd, era, echelon } = ctx;
  const out = [];
  // Vehicles go with the men in them.
  if (unit.vehicles > 0) { const perVeh = Math.max(1, (unit.strength) / unit.vehicles); const lost = Math.min(unit.vehicles, Math.floor(count / perVeh * 0.9 + rnd() * 0.6)); if (lost > 0) { unit.vehicles -= lost; unit.vehiclesLost = (unit.vehiclesLost || 0) + lost; } }
  unit.strength -= count;
  if (unit.side === 'enemy') {
    const kia = Math.max(0, Math.round(count * (0.25 + rnd() * 0.15)));
    unit.killed += kia; unit.wounded += count - kia;
    state.stats.enemyKIA += kia; state.stats.enemyWIA += count - kia;
    if (shooter && shooter.side === 'friendly') {
      shooter.kills += count;
      const m = activeMembers(state, shooter).filter(p => !p.isPlayer || echelon.tier <= 1);
      if (m.length && echelon.namedCasualties === true) for (let i = 0; i < count; i++) pick(m, rnd).kills += 1;
    }
  } else {
    const named = echelon.namedCasualties === true || unit.isHQ;
    if (named) {
      for (let i = 0; i < count; i++) {
        const pool = activeMembers(state, unit).filter(p => p.status === 'ok');
        if (!pool.length) break;
        const weights = pool.map(p => (p.isPlayer ? (unit.strength + i + 1 <= 2 ? 1 : echelon.playerRisk) : 1) * (p.leader && unit.posture === 'assault' ? 1.4 : 1));
        const victim = weighted(pool, weights, rnd);
        out.push(woundPerson(state, victim, ctx, cause));
      }
    } else {
      const kia = Math.round(count * (0.24 + rnd() * 0.08)), mia = Math.round(count * (cause === 'assault' ? 0.08 : 0.02) * rnd());
      const wia = Math.max(0, count - kia - mia);
      unit.killed += kia; unit.wounded += wia; unit.missing += mia;
      state.stats.friendlyKIA += kia; state.stats.friendlyWIA += wia; state.stats.friendlyMIA += mia;
      out.push({ count, kia, wia, mia, unitId: unit.id });
      // A leader by name, sometimes: the price of command at every level.
      const leader = state.people[unit.leaderId];
      const hitChance = clamp((count / Math.max(1, unit.strength + count)) * 1.6, 0, 0.35);
      if (leader && leader.status === 'ok' && rnd() < hitChance) out.push(woundPerson(state, leader, ctx, cause));
      else if (kia > 0 && rnd() < 0.6) {
        // Someone with a name among the dead, so the letter can be written.
        const s = nameOnDemand(state, unit, ctx);
        s.status = 'kia'; s.wound = { severity: 'kia', at: state.clock.minutes, part: pick(PARTS, rnd), cause };
        unit.killed -= 1; state.stats.friendlyKIA -= 1;
        out.push(recordKIA(state, s, ctx, cause));
      }
      for (const nb of membersOf(state, unit).filter(p => p.notable && p.status === 'ok' && !p.leader)) if (rnd() < count / Math.max(1, unit.start) * 0.8) out.push(woundPerson(state, nb, ctx, cause));
      // A general who went forward shares the risk of the men he is visiting.
      if (state.playerWith === unit.id && state.people.p0.status === 'ok' && rnd() < clamp(count / Math.max(1, unit.strength + count) * 4, 0, 0.5)) out.push(woundPerson(state, state.people.p0, ctx, cause));
    }
    if (unit.strength <= 0) { unit.strength = 0; unit.destroyed = true; }
  }
  if (unit.strength <= 0 && unit.side === 'enemy') { unit.strength = 0; unit.destroyed = true; }
  return out;
}

function weighted(list, w, rnd) { const tot = w.reduce((a, b) => a + b, 0); let r = rnd() * tot; for (let i = 0; i < list.length; i++) { r -= w[i]; if (r <= 0) return list[i]; } return list[list.length - 1]; }

/** Wound or kill a named person. Decides the player's fate by difficulty. */
export function woundPerson(state, p, ctx, cause = 'fire', forced = null) {
  const { rnd, era, difficulty } = ctx;
  let sev = forced || severity(rnd, era);
  if (p.isPlayer && sev === 'kia' && !(difficulty.playerDeath || state.settings.ironman)) sev = 'serious';
  if (p.isPlayer && sev === 'serious' && difficulty.id === 'green' && rnd() < 0.5) sev = 'light';
  const part = pick(PARTS, rnd);
  const unit = state.units[p.unitId];
  if (sev === 'kia') { if (unit && !unit.isHQ && state.settings.echelonId !== 'fireteam') { /* strength already reduced by the caller */ } return recordKIA(state, p, ctx, cause, part); }
  p.status = 'wia';
  p.wound = { severity: sev, at: state.clock.minutes, part, cause, evacAt: sev === 'serious' ? state.clock.minutes + Math.round((ctx.era.medicine?.goldenHour || 120) * 1.3) : null, stabilized: false };
  if (unit && !unit.isHQ) unit.wounded = (unit.wounded || 0) + 1;
  state.stats.friendlyWIA += 1;
  if (p.isPlayer) { p.health = clamp((p.health ?? 100) - (sev === 'serious' ? 60 : 25), 5, 100); p.stress = clamp((p.stress || 0) + 20, 0, 100); state.campaign.record.wounds.push({ at: state.clock.minutes, part, severity: sev, op: state.truth.codename }); }
  if (unit && unit.leaderId === p.id && sev === 'serious') succession(state, unit, ctx);
  return { personId: p.id, name: p.name, label: personLabel(state, p), status: 'wia', severity: sev, part, isPlayer: !!p.isPlayer, unitId: p.unitId };
}

function recordKIA(state, p, ctx, cause, part = null) {
  p.status = 'kia';
  p.wound = { severity: 'kia', at: state.clock.minutes, part: part || p.wound?.part || 'chest', cause };
  const unit = state.units[p.unitId];
  if (unit && !unit.isHQ) unit.killed = (unit.killed || 0) + 1;
  state.stats.friendlyKIA += 1;
  state.campaign.wall.push({ id: p.id, name: p.name, rank: p.rank, role: p.role, unit: unit?.name || '', at: state.clock.minutes, date: null, place: state.setting.place, op: state.truth.codename, line: p.detail || p.trait || '', hometown: p.hometown, isPlayer: !!p.isPlayer });
  if (unit && unit.leaderId === p.id) succession(state, unit, ctx);
  if (unit) unit.morale = clamp(unit.morale - (p.leader ? 15 : 8), 0, 100);
  for (const u of Object.values(state.units)) if (u.side === 'friendly' && u.id !== p.unitId) u.morale = clamp(u.morale - (p.leader ? 3 : 1), 0, 100);
  state.standing.troops = clamp(state.standing.troops - 1, 0, 100);
  return { personId: p.id, name: p.name, label: personLabel(state, p), status: 'kia', severity: 'kia', part: p.wound.part, isPlayer: !!p.isPlayer, unitId: p.unitId };
}

/** The next senior man takes over. */
export function succession(state, unit, ctx) {
  const pool = activeMembers(state, unit).filter(p => p.status === 'ok' && !p.isPlayer);
  if (!pool.length) { unit.leaderId = null; return null; }
  const next = pool.sort((a, b) => (b.leader ? 1 : 0) - (a.leader ? 1 : 0) || (b.competence || 2) - (a.competence || 2))[0];
  const old = state.people[unit.leaderId];
  unit.leaderId = next.id; next.leader = true; next.competence = next.competence || 2; next.initiative = next.initiative || 3;
  addFact(state, `${next.rank} ${next.name} took command of ${unit.name} after ${old ? old.name : 'the leader'} went down.`, 'game');
  return next;
}

/** Wounded soldiers: evacuation and death from wounds, by era and by what the player did. */
export function tickWounded(state, ctx, report) {
  const now = state.clock.minutes; const { rnd, era } = ctx;
  for (const p of Object.values(state.people)) {
    if (p.status !== 'wia' || p.wound?.severity !== 'serious') continue;
    const w = p.wound;
    if (!w.stabilized && now >= w.at + (era.medicine?.goldenHour || 120) * (w.medevacAsked ? 1.4 : 1)) {
      const unit = state.units[p.unitId];
      const medic = unit && membersOf(state, unit).some(m => m.status === 'ok' && /medic|corpsman|aid/i.test(m.role));
      const bg = state.settings.background === 'medic' ? 0.75 : 1;
      if (rnd() < (era.medicine?.dowRate || 0.2) * (medic ? 0.6 : 1) * bg * (w.medevacAsked ? 0.6 : 1)) {
        const r = recordKIA(state, p, ctx, 'died of wounds');
        state.stats.friendlyWIA -= 1;
        r.dow = true; report.casualties.push(r);
        report.lines.push(`${r.label} died of wounds before he could be evacuated.`);
        if (p.isPlayer) report.playerHit = r;
      } else w.stabilized = true;
    }
    if (p.status === 'wia' && w.evacAt != null && now >= w.evacAt) {
      p.status = 'evac'; w.evacuatedAt = now;
      report.lines.push(`${personLabel(state, p)} was evacuated${w.medevacAsked ? ' by the MEDEVAC you called' : ''}.`);
      if (p.isPlayer) report.playerEvacuated = true;
    }
  }
}

export function playerStatus(state) { const p = player(state); return p ? p.status : 'ok'; }
