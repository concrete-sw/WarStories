// Combat resolution: a small, legible model.
//   fire  = strength × firepower × quality × range × suppression × morale × light × surprise × dice
//   hits  = fire × lethality × (1 − cover) × exposure
// Fire suppresses before it kills; suppressed units cannot manoeuvre. The GM
// narrates the results it is given; it never decides who dies.

import { UNIT_TYPES, TERRAIN, POSTURES, QUALITY } from '../data/terrain.js';
import { clamp } from './util.js';

/** 2d6 scaled to a multiplier with mean 1 (0.0 to 2.0). Returns { mult, roll }. */
export function dice(rnd) { const a = 1 + Math.floor(rnd() * 6), b = 1 + Math.floor(rnd() * 6); return { roll: a + b, dice: [a, b], mult: (a + b - 2) / 5 }; }

/** Stochastic rounding: 2.3 becomes 2 seventy percent of the time and 3 thirty percent. */
export function sround(x, rnd) { const f = Math.floor(x); return f + (rnd() < x - f ? 1 : 0); }

export function coverOf(grid, unit) {
  const t = TERRAIN[grid.cells[unit.cell]?.t] || TERRAIN.open;
  const p = POSTURES[unit.posture] || POSTURES.halted;
  return clamp(t.cover + p.cover + (grid.cells[unit.cell]?.elev >= 2 ? 0.05 : 0), 0, 0.9);
}

export function concealOf(grid, unit, smoke = false) {
  const t = TERRAIN[grid.cells[unit.cell]?.t] || TERRAIN.open;
  const p = POSTURES[unit.posture] || POSTURES.halted;
  return clamp(t.conceal + p.conceal + (smoke ? 0.5 : 0) + (unit.type === 'sniper' ? 0.2 : 0) + (unit.type === 'recon' ? 0.1 : 0), 0, 0.95);
}

/** Weapon reach in km for a unit at this echelon. */
export function rangeKm(echelon, unit) {
  const f = { mg: 1.5, armor: 2.4, mech: 1.6, at: 1.6, sniper: 2.0, recon: 1.0, aviation: 3.0, artillery: 0.6, mortar: 0.6, hq: 0.6, support: 0.5 }[unit.type] ?? 1.0;
  return echelon.smallArmsKm * f;
}

/**
 * The fire one unit puts out at another this tick.
 * opts: { distKm, rangeKm, surprise, moving, lightF, enemySkill, rnd }
 */
export function fireValue(a, t, opts) {
  const ty = UNIT_TYPES[a.type] || UNIT_TYPES.infantry;
  const range = clamp(1 - 0.6 * (opts.distKm / Math.max(0.01, opts.rangeKm)), 0.25, 1);
  const supp = 1 - clamp(a.suppression, 0, 100) / 130;
  const morale = 0.5 + clamp(a.morale, 0, 100) / 200;
  const ammo = a.ammo <= 0 ? 0 : a.ammo < 15 ? 0.45 : 1;
  const q = (QUALITY[a.quality] || 1) * (a.side === 'enemy' ? (opts.enemySkill || 1) : 1);
  const d = dice(opts.rnd);
  const strength = Math.max(0, a.strength) + (a.vehicles || 0) * (a.type === 'armor' ? 3 : a.type === 'mech' ? 1.5 : 0);
  let f = strength * ty.fp * q * range * supp * morale * ammo * (opts.lightF ?? 1) * (opts.surprise ? 2 : 1) * (opts.moving ? 0.5 : 1);
  // Armoured targets shrug off small arms; anti-tank weapons are what count against them.
  const tt = UNIT_TYPES[t.type] || UNIT_TYPES.infantry;
  if (tt.protect > 0) f *= (1 - tt.protect) + tt.protect * Math.min(1, ty.at);
  // Against vehicles, anti-tank weapons kill crews and passengers by the vehicle-load.
  if ((t.vehicles || 0) > 0) f *= 1 + 2.5 * Math.min(1.4, ty.at);
  return { fire: f * d.mult, base: f, dice: d, parts: { strength: Math.round(strength), fp: ty.fp, q, range, supp, morale, ammo, light: opts.lightF ?? 1, surprise: !!opts.surprise } };
}

/** Casualties and suppression a unit suffers from incoming fire. */
export const EXPOSURE = { moving: 1.25, assault: 1.4, withdrawing: 1.15, halted: 0.9, cover: 0.6, pinned: 0.45, dug_in: 0.4, ambush: 0.5, broken: 1.1 };
export function effectOf(fire, target, { cover, lethality, dtFrac, rnd }) {
  const exposure = EXPOSURE[target.posture] ?? 1;
  const expected = fire * lethality * dtFrac * (1 - cover) * exposure;
  const cas = Math.min(target.strength, sround(expected, rnd));
  const supp = clamp(100 * (fire * dtFrac) / (target.strength + 1) * 0.6 * (1 - cover * 0.5), 0, 100);
  return { casualties: cas, suppression: supp, expected };
}

/** A close assault: attacker against defender in or beside the target square. */
export function assaultResult(att, def, { coverDef, rnd, enemySkill = 1 }) {
  const ta = UNIT_TYPES[att.type] || UNIT_TYPES.infantry, td = UNIT_TYPES[def.type] || UNIT_TYPES.infantry;
  const qa = (QUALITY[att.quality] || 1) * (att.side === 'enemy' ? enemySkill : 1);
  const qd = (QUALITY[def.quality] || 1) * (def.side === 'enemy' ? enemySkill : 1);
  const da = dice(rnd), dd = dice(rnd);
  const A = Math.max(0.1, att.strength * ta.fp * qa * (0.5 + att.morale / 200) * (1 - att.suppression / 150)) * (0.5 + da.mult / 2 + 0.25);
  const D = Math.max(0.1, def.strength * td.fp * qd * (0.5 + def.morale / 200) * (1 - def.suppression / 110) * (1 + coverDef * 1.5)) * (0.5 + dd.mult / 2 + 0.25);
  const ratio = A / D;
  const r = (lo, hi) => lo + rnd() * (hi - lo);
  if (ratio > 1.3) return { outcome: 'taken', ratio, attLoss: r(0.03, 0.1), defLoss: r(0.15, 0.35), defBreaks: ratio > 2.2 || def.morale < 30, surrender: def.morale < 22 && ratio > 1.8, dice: [da.roll, dd.roll] };
  if (ratio > 0.8) return { outcome: 'bloody', ratio, attLoss: r(0.08, 0.18), defLoss: r(0.08, 0.2), defBreaks: false, surrender: false, dice: [da.roll, dd.roll] };
  return { outcome: 'repulsed', ratio, attLoss: r(0.12, 0.28), defLoss: r(0.02, 0.08), defBreaks: false, surrender: false, dice: [da.roll, dd.roll] };
}

/** Indirect fire on a square: the fraction of a unit hit, and the suppression. */
export const FIRE_POWER = { mortar: 1.0, artillery: 2.0, naval: 2.6, air: 3.0, helicopter: 2.0, drone: 1.4, rocket: 2.6, tank: 1.6, gas: 1.2, ew: 0 };
export function indirectEffect(kind, target, { cover, rounds = 1, rnd, adjacent = false }) {
  const p = (FIRE_POWER[kind] ?? 1.5) * (adjacent ? 0.25 : 1) * rounds;
  const dug = target.posture === 'dug_in' ? 0.45 : 1;
  const frac = clamp(p * 0.055 * (1 - cover * 0.8) * dug * (0.5 + rnd()), 0, 0.45);
  const cas = Math.min(target.strength, sround(target.strength * frac, rnd));
  const supp = clamp(p * 32 * (adjacent ? 0.5 : 1), 0, 100);
  return { casualties: cas, suppression: supp };
}
