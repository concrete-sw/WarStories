// Logistics bite at every level: water, food, ammunition, batteries, fuel,
// medical supplies. Requests take time and can fail. At battalion and above
// the same numbers are read as days of supply.

import { friendlyUnits, liveUnit, addRadio } from './state.js';
import { WEATHER } from '../data/terrain.js';
import { clamp, uid } from './util.js';

export const SUPPLY_ITEMS = [
  { id: 'ammo', name: 'Ammunition', low: 'ammunition' },
  { id: 'water', name: 'Water', low: 'water' },
  { id: 'food', name: 'Rations', low: 'rations' },
  { id: 'medical', name: 'Medical supplies', low: 'medical supplies' },
  { id: 'batteries', name: 'Radio batteries', low: 'batteries' },
  { id: 'fuel', name: 'Fuel', low: 'fuel' }
];

export function supplyLabel(state, id, value) {
  const tier = { fireteam: 0, squad: 1, platoon: 2, company: 3, battalion: 4, brigade: 5, division: 6, corps: 7 }[state.settings.echelonId] ?? 1;
  const v = Math.round(value);
  if (tier >= 4) return `${(v / 33).toFixed(1)} days of supply`;
  if (id === 'water') return state.era.tech >= 7 ? `${v}% (bottles and CamelBaks)` : `${v}% (canteens)`;
  if (id === 'food') return `${v}%`;
  return `${v}%`;
}

export function tickLogistics(state, dt, ctx, report) {
  const L = state.logistics; const h = dt / 60;
  const tier = ctx.echelon.tier;
  const heat = state.weatherNow === 'heat' || /desert/.test(state.theatre?.name || '') || ['gulf', 'coin'].includes(state.era.id) ? 1.8 : 1;
  const rate = tier >= 4 ? 0.6 : 1;
  L.water = clamp(L.water - h * 2.2 * heat * rate, 0, 100);
  L.food = clamp(L.food - h * 1.2 * rate, 0, 100);
  if (state.era.tech >= 2) L.batteries = clamp(L.batteries - h * (state.era.tech >= 7 ? 1.6 : 1.1), 0, 100);
  const vehicles = friendlyUnits(state).some(u => u.vehicles > 0);
  if (vehicles) L.fuel = clamp(L.fuel - h * (friendlyUnits(state).filter(u => u.vehicles > 0 && u.posture === 'moving').length * 2.2 + 0.3), 0, 100);
  // Effects of running out.
  if (L.water < 15) for (const u of friendlyUnits(state)) { u.fatigue = clamp(u.fatigue + h * 6, 0, 100); u.morale = clamp(u.morale - h * 2, 0, 100); }
  if (L.batteries < 8) for (const u of friendlyUnits(state)) if (u.radio === 'ok' && !u.isHQ && ctx.rnd() < 0.3 * (dt / state.scale.tick)) u.radio = 'intermittent';
  // Arrivals.
  for (const r of L.requests) {
    if (r.status !== 'pending' || state.clock.minutes < r.eta) continue;
    if (ctx.rnd() < r.failChance) { r.status = 'failed'; report.lines.push(`The ${itemName(r.item)} resupply did not arrive: ${pickFail(ctx.rnd)}.`); addRadio(state, { net: tier >= 4 ? 'admin' : 'higher', from: 'higher', to: state.units.u0.callsign, text: `Be advised, your ${itemName(r.item)} resupply is delayed indefinitely. ${pickFail(ctx.rnd)}. Out.` }); continue; }
    r.status = 'delivered'; r.deliveredAt = state.clock.minutes;
    if (r.item === 'ammo') { for (const u of friendlyUnits(state)) if (liveUnit(u)) u.ammo = clamp(u.ammo + 45 * ctx.difficulty.supply, 0, 100); }
    else L[r.item] = clamp((L[r.item] || 0) + 50 * ctx.difficulty.supply, 0, 100);
    report.lines.push(`Resupply arrived: ${itemName(r.item)}.`);
  }
}

const FAILS = ['the truck hit a mine on the supply route', 'the drop went to the wrong unit', 'the route is under enemy observation and nothing is moving by day', 'higher reprioritised it to another unit', 'the carrying party was caught by shellfire'];
function pickFail(rnd) { return FAILS[Math.floor(rnd() * FAILS.length)]; }
function itemName(id) { return { ammo: 'ammunition', water: 'water', food: 'rations', medical: 'medical', batteries: 'battery', fuel: 'fuel' }[id] || id; }

/** Ask higher for supplies. Returns the request. */
export function requestSupply(state, item, ctx) {
  const now = state.clock.minutes; const tier = ctx.echelon.tier;
  if (state.logistics.requests.some(r => r.item === item && r.status === 'pending')) return { ok: false, reason: 'already requested and on its way' };
  const base = Math.max(40, state.scale.tick * 6) * (tier >= 5 ? 1.5 : 1) * (state.era.tech <= 2 ? 1.4 : 1);
  const eta = now + Math.round(base * (0.7 + ctx.rnd() * 0.8) / ctx.difficulty.supply);
  const failChance = clamp(0.12 + (ctx.difficulty.id === 'veteran' ? 0.12 : 0) + (state.phase === 'execution' ? 0.06 : 0) + (state.standing.superiors < 35 ? 0.08 : 0), 0.05, 0.5);
  const r = { id: uid('rq'), item, requestedAt: now, eta, status: 'pending', failChance };
  state.logistics.requests.push(r);
  return { ok: true, request: r };
}

/** Consolidation: share the ammunition out evenly among the units that are left. */
export function redistributeAmmo(state) {
  const us = friendlyUnits(state).filter(u => liveUnit(u) && !u.isHQ);
  if (!us.length) return 0;
  const tot = us.reduce((s, u) => s + u.ammo * Math.max(1, u.strength), 0);
  const men = us.reduce((s, u) => s + Math.max(1, u.strength), 0);
  const avg = tot / men;
  for (const u of us) u.ammo = Math.round(avg);
  return Math.round(avg);
}

export function averageAmmo(state) {
  const us = friendlyUnits(state).filter(u => liveUnit(u) && !u.isHQ);
  if (!us.length) return 0;
  return Math.round(us.reduce((s, u) => s + u.ammo, 0) / us.length);
}

export function weatherFactor(state) { return WEATHER[state.weatherNow] || WEATHER.clear; }
