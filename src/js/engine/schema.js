// Validation and normalisation of the generated operation truth. validateOperation
// returns a list of problems (empty means playable); the generator feeds them
// back to the model. normalizeOperation repairs what can be repaired in code so
// the rest of the engine can trust the shape.

import { asArray, num, str, clamp } from './util.js';
import { parseRef } from './grid.js';
import { UNIT_TYPES, TERRAIN, WEATHER } from '../data/terrain.js';
import { SIZES } from '../data/echelons.js';

// Models write the string "null" (or "N/A", "none") where the schema says "or null".
const NULLISH = /^\s*(null|none|n\/a|na|nil|undefined|not applicable|-|—)\s*$/i;
export function deepClean(x) {
  if (typeof x === 'string') return NULLISH.test(x) ? null : x;
  if (Array.isArray(x)) return x.map(deepClean).filter(v => v !== null && v !== undefined);
  if (x && typeof x === 'object') { for (const k of Object.keys(x)) x[k] = deepClean(x[k]); }
  return x;
}

export const MISSION_TYPES = ['attack', 'seize', 'clear', 'raid', 'defend', 'hold', 'delay', 'withdraw', 'recon', 'patrol', 'ambush', 'secure', 'relief', 'rescue', 'escort', 'crossing', 'breach', 'counterattack'];
export const TASKS = ['move', 'assault', 'suppress', 'defend', 'dig_in', 'withdraw', 'halt', 'recon', 'ambush', 'patrol', 'reinforce', 'counterattack', 'hold', 'screen', 'breach', 'support'];
export const REACTIONS = ['hold', 'counterattack', 'withdraw', 'delay', 'reinforce', 'ambush'];
export const SUPPORT_TYPES = ['mortar', 'artillery', 'naval', 'air', 'helicopter', 'drone', 'rocket', 'tank', 'gas', 'ew'];
export const EVENT_KINDS = ['comms', 'weather', 'enemy', 'reinforcement', 'higher', 'civilian', 'fire_support', 'friendly', 'logistics', 'press', 'other'];
export const CM_TYPES = ['LD', 'PL', 'OBJ', 'boundary', 'TRP', 'CP', 'AA', 'LOA', 'EA', 'BP', 'RP', 'LZ', 'axis'];

const TYPE_SYNONYMS = { rifle: 'infantry', rifles: 'infantry', riflemen: 'infantry', grenadier: 'infantry', grenadiers: 'infantry', marines: 'infantry', paratroopers: 'infantry', airborne: 'infantry', light_infantry: 'infantry', soldier: 'infantry', fighter: 'infantry', guerrilla: 'militia', guerrillas: 'militia', insurgents: 'militia', militia: 'militia', irregulars: 'militia', machinegun: 'mg', machine_gun: 'mg', 'machine gun': 'mg', hmg: 'mg', lmg: 'mg', gun: 'mg', tank: 'armor', tanks: 'armor', armour: 'armor', panzer: 'armor', armored: 'armor', armoured: 'armor', mechanized: 'mech', mechanised: 'mech', mech_infantry: 'mech', ifv: 'mech', apc: 'mech', panzergrenadier: 'mech', motorized: 'mech', motorised: 'mech', scouts: 'recon', scout: 'recon', reconnaissance: 'recon', cavalry: 'recon', cav: 'recon', engineers: 'engineer', pioneers: 'engineer', sappers: 'engineer', sapper: 'engineer', pioneer: 'engineer', arty: 'artillery', howitzer: 'artillery', guns: 'artillery', antitank: 'at', anti_tank: 'at', 'anti-tank': 'at', atgm: 'at', mortars: 'mortar', headquarters: 'hq', command: 'hq', cp: 'hq', snipers: 'sniper', helicopters: 'aviation', helicopter: 'aviation', aviation: 'aviation', logistics: 'support', supply: 'support', medical: 'support' };
export function normType(t) { const k = str(t).toLowerCase().trim(); if (UNIT_TYPES[k]) return k; if (TYPE_SYNONYMS[k]) return TYPE_SYNONYMS[k]; const k2 = k.replace(/[\s-]+/g, '_'); return UNIT_TYPES[k2] ? k2 : TYPE_SYNONYMS[k2] || 'infantry'; }
export function normSize(s, fallback = 'squad') { const k = str(s).toLowerCase().trim(); if (SIZES[k]) return k; if (/fire\s*team|team|crew|cell|group|trupp/.test(k)) return 'team'; if (/section/.test(k)) return 'section'; if (/squad|gruppe|otdel/.test(k)) return 'squad'; if (/platoon|zug|vzvod|troop/.test(k)) return 'platoon'; if (/company|battery|kompanie|rota|squadron/.test(k)) return 'company'; if (/battalion|bataillon|batallon/.test(k)) return 'battalion'; if (/regiment/.test(k)) return 'regiment'; if (/brigade/.test(k)) return 'brigade'; if (/division/.test(k)) return 'division'; if (/corps|army/.test(k)) return 'corps'; if (/individual|soldier|man/.test(k)) return 'individual'; return fallback; }
export function normTask(t) { const k = str(t).toLowerCase().trim().replace(/[\s-]+/g, '_'); if (TASKS.includes(k)) return k; if (/attack|assault|storm|charge|seize|clear/.test(k)) return 'assault'; if (/fire|suppress|support|overwatch|engage/.test(k)) return 'suppress'; if (/dig|fortif|entrench/.test(k)) return 'dig_in'; if (/defen|hold|block/.test(k)) return 'defend'; if (/withdraw|retreat|fall_?back|retire/.test(k)) return 'withdraw'; if (/recon|scout|probe/.test(k)) return 'recon'; if (/patrol/.test(k)) return 'patrol'; if (/ambush/.test(k)) return 'ambush'; if (/counter/.test(k)) return 'counterattack'; if (/reinforc/.test(k)) return 'reinforce'; if (/halt|stop|wait/.test(k)) return 'halt'; if (/screen/.test(k)) return 'screen'; if (/move|advance|march|go|infiltrat|redeploy|shift/.test(k)) return 'move'; return 'move'; }

/** Mission timing windows (minutes after start) by echelon: [hHourMin, hHourMax, endMin, endMax]. */
export const TIMING = {
  fireteam: [10, 45, 90, 240], squad: [15, 60, 120, 300], platoon: [30, 120, 180, 420], company: [60, 240, 360, 900],
  battalion: [120, 480, 720, 1800], brigade: [240, 900, 1440, 4320], division: [480, 1440, 2880, 7200], corps: [720, 2880, 4320, 14400]
};

/**
 * Validate a generated operation. opts: { echelonId, unitCounts: [min, max] }.
 */
export function validateOperation(w, opts = {}) {
  const problems = [];
  const need = (cond, msg) => { if (!cond) problems.push(msg); };
  if (!w || typeof w !== 'object') return ['Operation is not a JSON object'];
  const n = clamp(Math.round(num(w.terrain?.size, 16)), 10, 20);
  const cellOk = x => parseRef(n, x) >= 0;
  const T = TIMING[opts.echelonId] || TIMING.squad;

  need(str(w.title).length > 2, 'title missing');
  need(str(w.codename).length > 2, 'codename missing (an operation codename, e.g. "IRON HARROW")');
  const s = w.setting;
  need(s && typeof s === 'object', 'setting missing');
  if (s) {
    need(/^\d{4}-\d{2}-\d{2}$/.test(str(s.date)), 'setting.date must be YYYY-MM-DD');
    need(/^\d{1,2}:\d{2}$/.test(str(s.startTime)), 'setting.startTime must be HH:MM (24-hour)');
    need(str(s.place).length > 3, 'setting.place missing');
    need(str(s.warSoFar).length > 120, 'setting.warSoFar missing or too short (a real orientation: the war, the front, your side, the enemy)');
    need(str(s.unitHistory || w.friendly?.history).length > 40, 'setting.unitHistory missing (the unit\'s history and reputation)');
  }
  const t = w.terrain;
  need(t && typeof t === 'object', 'terrain missing');
  if (t) {
    need(Number.isFinite(num(t.size, NaN)) && num(t.size) >= 12 && num(t.size) <= 20, 'terrain.size must be a number from 12 to 20');
    need(TERRAIN[str(t.base)], `terrain.base must be one of: ${Object.keys(TERRAIN).filter(k => k !== 'water').join(', ')}`);
    const fs = asArray(t.features);
    need(fs.length >= 5, `terrain.features needs at least 5 named features, got ${fs.length}`);
    fs.forEach((f, i) => {
      if (!f || typeof f !== 'object') { problems.push(`terrain.features[${i}] is not an object`); return; }
      need(str(f.name), `terrain.features[${i}] needs a name`);
      const geo = f.area || asArray(f.cells).length || asArray(f.line).length || f.at;
      need(geo, `terrain.features[${i}] ("${str(f.name)}") needs area ("C3:F6"), line (["A4","P5"]), cells, or at ("E5")`);
      for (const x of [f.at, ...asArray(f.line), ...asArray(f.cells), ...String(f.area || '').split(':').filter(Boolean)].filter(Boolean)) if (!cellOk(x)) { problems.push(`terrain.features[${i}] ("${str(f.name)}") has invalid square "${x}" (columns A-${'ABCDEFGHIJKLMNOPQRST'[n - 1]}, rows 1-${n})`); break; }
    });
  }
  const m = w.mission;
  need(m && typeof m === 'object', 'mission missing');
  if (m) {
    need(MISSION_TYPES.includes(str(m.type)), `mission.type must be one of: ${MISSION_TYPES.join(', ')}`);
    need(str(m.statement).length > 30, 'mission.statement missing (who, what, when, where, why)');
    need(str(m.higherIntent).length > 20, 'mission.higherIntent missing');
    const oc = asArray(m.objective?.cells);
    need(str(m.objective?.name) && oc.length >= 1 && oc.every(cellOk), 'mission.objective needs a name and 1-4 valid cells');
    const hh = num(m.hHourMinutes, NaN), end = num(m.endMinutes, NaN), nlt = num(m.nltMinutes, NaN);
    need(Number.isFinite(hh) && hh >= 0, 'mission.hHourMinutes missing');
    need(Number.isFinite(end) && end > (hh || 0), 'mission.endMinutes missing or not after hHourMinutes');
    if (Number.isFinite(hh) && Number.isFinite(end)) {
      need(hh <= T[1] * 1.5, `mission.hHourMinutes should be at most about ${T[1]} for this echelon`);
      need(end <= T[3] * 1.5 && end >= T[2] * 0.5, `mission.endMinutes should be between ${T[2]} and ${T[3]} for this echelon`);
    }
    if (Number.isFinite(nlt)) need(nlt >= (hh || 0) && nlt <= (end || Infinity), 'mission.nltMinutes must fall between hHourMinutes and endMinutes');
    need(m.opord && ['situation', 'mission', 'execution', 'sustainment', 'commandSignal'].every(k => str(m.opord[k]).length > 15), 'mission.opord needs situation, mission, execution, sustainment and commandSignal paragraphs');
    need(str(m.warno).length > 20, 'mission.warno missing');
    asArray(m.controlMeasures).forEach((c, i) => { if (!asArray(c?.cells).every(cellOk)) problems.push(`mission.controlMeasures[${i}] has an invalid square`); });
  }
  const fr = w.friendly;
  need(fr && typeof fr === 'object', 'friendly missing');
  const fids = new Set();
  if (fr) {
    const us = asArray(fr.units);
    const [lo, hi] = opts.unitCounts || [2, 8];
    need(us.length >= lo && us.length <= hi, `friendly.units needs ${lo}-${hi} subordinate units, got ${us.length}`);
    us.forEach((u, i) => {
      if (!u || typeof u !== 'object') { problems.push(`friendly.units[${i}] is not an object`); return; }
      need(str(u.id), `friendly.units[${i}] needs an id`); fids.add(str(u.id));
      need(str(u.name), `friendly.units[${i}] needs a name`);
      need(num(u.strength, 0) >= 1, `friendly.units[${i}] needs strength (number of soldiers)`);
      need(cellOk(u.cell), `friendly.units[${i}] ("${str(u.name)}") needs a valid cell`);
    });
    need(cellOk(fr.hqCell), 'friendly.hqCell must be a valid square for your own command post');
    need(asArray(fr.leaders).length >= Math.min(2, us.length), 'friendly.leaders needs a named leader for the subordinate units');
    asArray(fr.leaders).forEach((p, i) => need(str(p?.name) && str(p?.role), `friendly.leaders[${i}] needs name and role`));
  }
  const en = w.enemy;
  need(en && typeof en === 'object', 'enemy missing');
  const eids = new Set();
  if (en) {
    const us = asArray(en.units);
    need(us.length >= 2 && us.length <= 12, `enemy.units needs 2-12 units, got ${us.length}`);
    need(us.some(u => u && !u.decoy), 'enemy.units needs at least one real (non-decoy) unit');
    us.forEach((u, i) => {
      if (!u || typeof u !== 'object') { problems.push(`enemy.units[${i}] is not an object`); return; }
      need(str(u.id), `enemy.units[${i}] needs an id`); eids.add(str(u.id));
      if (fids.has(str(u.id))) problems.push(`enemy.units[${i}] id "${u.id}" clashes with a friendly unit id; use e1, e2...`);
      need(num(u.strength, -1) >= 0, `enemy.units[${i}] needs strength`);
      need(cellOk(u.cell), `enemy.units[${i}] ("${str(u.name)}") needs a valid cell`);
      asArray(u.orders).forEach((o, k) => { if (o?.target && !cellOk(o.target)) problems.push(`enemy.units[${i}].orders[${k}].target must be a square like "G4"`); });
    });
    need(str(en.intent).length > 20, 'enemy.intent missing');
    need(str(en.commander?.temperament), 'enemy.commander.temperament missing');
  }
  const intel = asArray(w.intel);
  need(intel.length >= 3, `intel needs at least 3 items, got ${intel.length}`);
  const deceptive = intel.filter(x => x && x.truthful === false).length + asArray(en?.units).filter(u => u?.decoy).length;
  need(deceptive >= 2, 'need at least 2 deceptive indicators: intel items with "truthful": false and/or enemy units with "decoy": true');
  asArray(w.events).forEach((e, i) => { need(Number.isFinite(num(e?.atMinutes, NaN)), `events[${i}].atMinutes missing`); need(str(e?.text).length > 8, `events[${i}].text missing`); });
  need(asArray(w.events).length >= 3, 'events needs at least 3 timed events (friction: comms failures, weather, higher, civilians, enemy moves)');
  return problems;
}

/**
 * Normalise a validated operation in place: types, sizes, ids, cells, timings, defaults.
 * echelon is the ECHELONS entry; returns the operation.
 */
export function normalizeOperation(w, { echelon }) {
  const n = clamp(Math.round(num(w.terrain?.size, echelon.gridN)), 12, 20);
  w.terrain.size = n;
  w.setting = w.setting || {};
  const wc = str(w.setting.weatherCode).toLowerCase();
  w.setting.weatherCode = WEATHER[wc] ? wc : (/rain|drizzle|shower/.test(str(w.setting.weather)) ? 'rain' : /fog|mist/.test(str(w.setting.weather)) ? 'fog' : /snow/.test(str(w.setting.weather)) ? 'snow' : /storm/.test(str(w.setting.weather)) ? 'storm' : /overcast|cloud|grey|gray/.test(str(w.setting.weather)) ? 'overcast' : 'clear');
  w.setting.latitude = Number.isFinite(num(w.setting.latitude, NaN)) ? clamp(num(w.setting.latitude), -70, 70) : null;
  const m = w.mission;
  m.hHourMinutes = Math.max(0, Math.round(num(m.hHourMinutes, 30)));
  m.endMinutes = Math.max(m.hHourMinutes + echelon.tick * 4, Math.round(num(m.endMinutes, m.hHourMinutes + 180)));
  m.nltMinutes = clamp(Math.round(num(m.nltMinutes, m.endMinutes)), m.hHourMinutes, m.endMinutes);
  m.objective.cells = asArray(m.objective.cells).slice(0, 4);
  m.controlMeasures = asArray(m.controlMeasures).filter(c => c && asArray(c.cells).length).map((c, i) => ({ id: `cm${i + 1}`, type: CM_TYPES.includes(str(c.type)) ? c.type : (str(c.type).toUpperCase() === 'OBJ' ? 'OBJ' : 'PL'), name: str(c.name) || `${c.type || 'PL'} ${i + 1}`, cells: asArray(c.cells).slice(0, 12), from: 'higher' }));
  if (!m.controlMeasures.some(c => c.type === 'OBJ')) m.controlMeasures.push({ id: 'cmobj', type: 'OBJ', name: m.objective.name, cells: m.objective.cells, from: 'higher' });
  m.targetUnits = asArray(m.targetUnits).map(String);
  const sub = { fireteam: 'individual', squad: 'team', platoon: 'squad', company: 'platoon', battalion: 'company', brigade: 'battalion', division: 'brigade', corps: 'division' }[echelon.id];
  const fixUnit = (u, i, side) => {
    u.id = str(u.id) || `${side === 'friendly' ? 'u' : 'e'}${i + 1}`;
    u.type = normType(u.type);
    u.size = normSize(u.size, side === 'friendly' ? sub : sub);
    const range = { individual: [1, 1], team: [2, 6], squad: [5, 14], section: [5, 14], platoon: [15, 55], company: [50, 250], battalion: [250, 1100], regiment: [1000, 5000], brigade: [1000, 6000], division: [4000, 25000], corps: [15000, 90000] }[u.size] || [1, 99999];
    if (u.decoy) u.fakeStrength = clamp(Math.round(num(u.fakeStrength ?? u.strength, range[0])), Math.max(1, range[0]), range[1]);
    u.strength = clamp(Math.round(num(u.strength, range[0])), side === 'enemy' && u.decoy ? 0 : range[0], range[1]);
    if (u.decoy) u.strength = 0;
    u.quality = ['green', 'regular', 'veteran', 'elite'].includes(str(u.quality)) ? u.quality : 'regular';
    u.posture = ['halted', 'cover', 'dug_in', 'moving', 'ambush'].includes(str(u.posture)) ? u.posture : (side === 'enemy' && ['defend', 'hold'].includes(normTask(u.orders?.[0]?.task)) ? 'dug_in' : 'halted');
    u.vehicles = Math.max(0, Math.round(num(u.vehicles, ['armor', 'mech'].includes(u.type) ? Math.max(1, Math.round(u.strength / (u.type === 'armor' ? 4 : 10))) : 0)));
    return u;
  };
  const seen = new Set();
  w.friendly.units = asArray(w.friendly.units).filter(u => u && typeof u === 'object').map((u, i) => { const x = fixUnit(u, i, 'friendly'); if (seen.has(x.id) || x.id === 'u0') x.id = `u${i + 1}x`; seen.add(x.id); return x; });
  w.enemy.units = asArray(w.enemy.units).filter(u => u && typeof u === 'object').map((u, i) => {
    const x = fixUnit(u, i, 'enemy'); if (seen.has(x.id)) x.id = `e${i + 1}x`; seen.add(x.id);
    x.orders = asArray(x.orders).filter(o => o && typeof o === 'object').map(o => ({ atMinutes: Math.max(0, Math.round(num(o.atMinutes, 0))), task: normTask(o.task), target: str(o.target) || x.cell, note: str(o.note) })).sort((a, b) => a.atMinutes - b.atMinutes);
    x.reaction = REACTIONS.includes(str(x.reaction)) ? x.reaction : 'hold';
    x.fallback = str(x.fallback) || null;
    return x;
  });
  w.friendly.leaders = asArray(w.friendly.leaders).filter(p => p && str(p.name));
  w.friendly.notables = asArray(w.friendly.notables).filter(p => p && str(p.name)).slice(0, 6);
  w.friendly.staff = asArray(w.friendly.staff).filter(p => p && str(p.name)).slice(0, 10);
  w.friendly.support = asArray(w.friendly.support).filter(a => a && typeof a === 'object').map((a, i) => ({
    id: str(a.id) || `a${i + 1}`, type: SUPPORT_TYPES.includes(str(a.type)) ? a.type : 'artillery', name: str(a.name) || 'supporting fires', callsign: str(a.callsign) || null,
    missions: clamp(Math.round(num(a.missions, 4)), 1, 40), availableFromMinutes: Math.max(0, Math.round(num(a.availableFromMinutes, 0))), availableToMinutes: Math.round(num(a.availableToMinutes, 1e7)),
    responseMinutes: Number.isFinite(num(a.responseMinutes, NaN)) ? clamp(num(a.responseMinutes), 1, 240) : null, note: str(a.note)
  }));
  w.events = asArray(w.events).filter(e => e && typeof e === 'object').map((e, i) => ({ ...e, id: `ev${i + 1}`, atMinutes: Math.max(0, Math.round(num(e.atMinutes, 0))), kind: EVENT_KINDS.includes(str(e.kind)) ? e.kind : 'other', text: str(e.text), visible: e.visible !== false, urgent: !!e.urgent, effects: e.effects && typeof e.effects === 'object' ? e.effects : {} })).sort((a, b) => a.atMinutes - b.atMinutes);
  w.intel = asArray(w.intel).filter(x => x && typeof x === 'object').map((x, i) => ({ id: `i${i + 1}`, atMinutes: Math.max(0, Math.round(num(x.atMinutes, 0))), source: str(x.source) || 'higher', reliability: /^[A-F][1-6]$/.test(str(x.reliability)) ? x.reliability : 'C3', text: str(x.text), about: str(x.about) || null, cell: str(x.cell) || null, truthful: x.truthful !== false }));
  w.people = asArray(w.people).filter(p => p && str(p.name)).map((p, i) => ({ id: str(p.id) || `c${i + 1}`, kind: str(p.kind) || 'civilian', name: str(p.name), cell: str(p.cell) || null, description: str(p.description), knows: str(p.knows), wants: str(p.wants), count: clamp(Math.round(num(p.count, 1)), 1, 5000) }));
  w.deceptions = asArray(w.deceptions).map(str).filter(Boolean);
  w.complications = asArray(w.complications).map(str).filter(Boolean);
  return w;
}
