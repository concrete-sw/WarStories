// Builds the player's force and the enemy from the operation truth: units on
// the grid, and the people in them. Leaders and a few notable soldiers come
// from the AI; everyone else is drawn by code from the army's name pool so
// every casualty at squad and platoon level has a name.

import { pool } from '../data/names.js';
import { TRAITS, DETAILS, BREAKING_POINTS, NICKNAMES, forEra } from '../data/people.js';
import { roleRank, playerRank } from '../data/armies.js';
import { SIZES } from '../data/echelons.js';
import { UNIT_TYPES } from '../data/terrain.js';
import { parseRef, neighbours } from './grid.js';
import { asArray, num, str, clamp, pick, seededRandom } from './util.js';

const PHONETIC_OLD = ['Able', 'Baker', 'Charlie', 'Dog', 'Easy', 'Fox', 'George', 'How', 'Item', 'King', 'Love', 'Mike'];
const PHONETIC = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot', 'Golf', 'Hotel', 'India', 'Kilo', 'Lima', 'Mike'];
const NUM_WORDS = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
const CALL_WORDS = ['Falcon', 'Badger', 'Lantern', 'Granite', 'Hammer', 'Willow', 'Copper', 'Raven', 'Thistle', 'Anvil', 'Juniper', 'Harrow'];
const CALL_WORDS_DE = ['Adler', 'Bussard', 'Dachs', 'Eiche', 'Falke', 'Habicht', 'Luchs', 'Marder', 'Rabe', 'Sperber', 'Uhu', 'Wolf'];
const CALL_WORDS_JP = ['Sakura', 'Matsu', 'Take', 'Ume', 'Kiku', 'Fuji', 'Asahi', 'Hayabusa', 'Taka', 'Kaze', 'Yama', 'Kawa'];

export function phonetic(tech, i) { return (tech <= 3 ? PHONETIC_OLD : PHONETIC)[i % 12]; }

/** A fallback call sign for a unit when the scenario did not give one. */
export function fallbackCallsign(army, tech, base, i) {
  switch (army.callsigns) {
    case 'brit': return `${NUM_WORDS[(i + 1) % 10]} ${NUM_WORDS[(i % 3) + 1]}`;
    case 'numbers': return `${(i + 2) * 11}`;
    case 'words': return CALL_WORDS[i % 12];
    case 'words_de': return CALL_WORDS_DE[i % 12];
    case 'words_jp': return CALL_WORDS_JP[i % 12];
    case 'nato': return `${base || 'Kilo'} ${i + 1}${i + 1}`;
    default: return `${base || phonetic(tech, 4)} ${NUM_WORDS[(i % 9) + 1]}`;
  }
}

/** Service number in the army's and era's format. */
export function serviceNumber(army, year, rnd, officer = false) {
  const d = k => Array.from({ length: k }, () => Math.floor(rnd() * 10)).join('');
  switch (army.serial) {
    case 'us_army': if (year >= 1970) return `DOD ${d(10)}`; if (officer) return `O-${d(6)}`; return year < 1960 ? `3${d(1)} ${d(3)} ${d(3)}` : `US ${5}${d(1)} ${d(3)} ${d(3)}`;
    case 'usmc': return year >= 1972 ? `EDIPI ${d(10)}` : officer ? `O${d(5)}` : `${d(6)}${year > 1950 ? d(1) : ''}`;
    case 'brit': return year >= 1980 ? `${d(8)}` : officer ? `${d(6)}` : `${d(7)}`;
    case 'ger': return `EKM ${d(3)} – ${1 + Math.floor(rnd() * 12)}./I.R. ${10 + Math.floor(rnd() * 400)}`;
    case 'bw': return `${d(6)}-${String.fromCharCode(65 + Math.floor(rnd() * 26))}-${d(5)}`;
    case 'nva': return `NVA-${d(7)}`;
    case 'sov': return year >= 1960 ? `Voyenny bilet ${String.fromCharCode(1040 + Math.floor(rnd() * 20))}${String.fromCharCode(1040 + Math.floor(rnd() * 20))} ${d(7)}` : `Krasnoarmeyskaya knizhka No. ${d(6)}`;
    case 'jpn': return `Gun-bangō ${d(5)}`;
    case 'fr': return `Matricule ${d(5)}`;
    case 'ita': return `Matricola ${d(6)}`;
    case 'pol': return `${d(5)}/${d(2)}`;
    case 'ah': return `Grundbuchblatt ${d(5)}`;
    case 'ott': return `Askerî defter ${d(5)}`;
    case 'arg': return `DNI ${d(8)}`;
    case 'irq': return `${d(9)}`;
    case 'afg': return `ANA ${d(7)}`;
    case 'alc': return `ALC-${d(4)}-${d(3)}`;
    case 'varn': return `VF/${d(2)}/${d(6)}`;
    case 'kest': return `KR ${d(3)} ${d(3)} ${d(2)}`;
    case 'pavn': return `Số quân ${d(6)}`;
    case 'arvn': return `SQ ${d(2)}/${d(6)}`;
    case 'kpa': return `${d(6)}`;
    case 'pva': return `Volunteer ${d(5)}`;
    case 'rok': return `K${d(7)}`;
    default: return d(8);
  }
}

/** Draw a soldier from the pool. */
export function makeSoldier(ctx, { role, rankRole = 'private', unitId, weapon, notable = null } = {}) {
  const { army, eraId, rnd, tech } = ctx;
  const p = pool(army.names);
  const modern = tech >= 4 && p.firstModern;
  const first = pick(modern ? p.firstModern : p.first, rnd);
  let last = pick(p.last, rnd);
  for (let i = 0; i < 4 && ctx.usedNames?.has(last); i++) last = pick(p.last, rnd);
  ctx.usedNames?.add(last);
  const rk = roleRank(army, rankRole, rnd);
  const id = `p${++ctx.seq}`;
  return {
    id, name: `${first} ${last}`, first, last, rank: rk.abbr, rankFull: rk.full, rankKey: rk.key, role: role || 'rifleman', unitId, weapon: weapon || army.kit?.rifle || 'rifle',
    trait: notable?.trait || pick(forEra(TRAITS, eraId), rnd), nickname: notable?.nickname ?? (rnd() < 0.3 ? pick(NICKNAMES, rnd) : null), hometown: notable?.hometown || pick(p.towns, rnd),
    detail: notable?.detail || pick(forEra(DETAILS, eraId), rnd), breakingPoint: notable?.breakingPoint || pick(BREAKING_POINTS, rnd), age: Math.round(18 + rnd() * (rankRole === 'private' ? 8 : 16)),
    status: 'ok', wound: null, morale: Math.round(55 + rnd() * 30), fatigue: Math.round(10 + rnd() * 25), kills: 0, awards: [], mood: 'steady', said: [], leader: false, notable: !!notable
  };
}

/** Roles inside a unit, in order, by unit type and size. */
function rolesFor(unit, army) {
  const k = army.kit || {};
  const ty = unit.type, size = unit.size;
  if (ty === 'mg') return [['gunner', k.mg], ['assistant gunner', 'pistol and spare barrel'], ['ammunition bearer', k.rifle], ['ammunition bearer', k.rifle]];
  if (ty === 'mortar') return [['mortar gunner', k.mortar], ['assistant gunner', k.rifle], ['ammunition bearer', k.rifle]];
  if (ty === 'sniper') return [['sniper', k.sniper || k.rifle], ['spotter', k.rifle]];
  if (ty === 'armor') return [['tank commander', 'tank'], ['gunner', 'main gun'], ['driver', 'tank'], ['loader', 'tank'], ['bow gunner', 'hull machine gun']];
  if (ty === 'at') return [['gunner', k.at], ['loader', k.rifle], ['rifleman', k.rifle]];
  const base = [['automatic rifleman', k.auto || k.rifle], ['grenadier', k.rifle], ['rifleman', k.rifle], ['rifleman', k.rifle]];
  if (size === 'squad' || size === 'section') return [['assistant squad leader', k.smg || k.rifle], ...base, ['automatic rifleman', k.auto || k.rifle], ['rifleman', k.rifle], ['scout', k.rifle], ['rifleman', k.rifle], ['rifleman', k.rifle], ['rifleman', k.rifle], ['rifleman', k.rifle]];
  if (ty === 'engineer') return [['demolitions man', 'demolition charges'], ['mine clearer', 'mine detector'], ['rifleman', k.rifle], ['rifleman', k.rifle]];
  if (ty === 'recon') return [['scout', k.rifle], ['scout', k.smg || k.rifle], ['radio operator', 'radio'], ['scout', k.rifle]];
  return base;
}

/**
 * Build state.units and state.people from the truth.
 * ctx: { army, era, echelon, player: { name, background, hometown, age, platoonSgt }, rnd }
 */
export function buildForces(state, ctx) {
  const t = state.truth; const { army, echelon } = ctx;
  const n = state.grid.n;
  const rnd = ctx.rnd;
  const eraId = state.settings.eraId; const tech = state.era.tech;
  const c = { army, eraId, rnd, tech, seq: 0, usedNames: new Set() };
  const units = {}; const people = {};
  const named = echelon.namedCasualties === true;
  const year = new Date(state.clock.start).getUTCFullYear();

  // ---- the player
  const pr = playerRank(army, echelon.id, { platoonSgt: !!state.settings.platoonSgt, branch: state.settings.branchId });
  const p0 = {
    id: 'p0', name: ctx.player.name, first: ctx.player.name.split(' ')[0], last: ctx.player.name.split(' ').slice(-1)[0], rank: pr.abbr, rankFull: pr.full, rankKey: pr.key,
    role: echelon.id === 'platoon' && state.settings.platoonSgt ? 'platoon sergeant' : `${echelon.short.toLowerCase()} ${echelon.tier >= 3 ? 'commander' : 'leader'}`,
    unitId: 'u0', weapon: echelon.tier <= 2 ? (army.kit?.smg && echelon.tier >= 1 ? army.kit.smg : army.kit?.rifle) : army.kit?.sidearm || 'pistol', trait: ctx.player.backgroundName || '', nickname: null,
    hometown: ctx.player.hometown || pick(pool(army.names).towns, rnd), detail: '', breakingPoint: '', age: ctx.player.age || (echelon.tier <= 1 ? 22 : echelon.tier <= 3 ? 26 : 30 + echelon.tier * 4),
    status: 'ok', wound: null, morale: 70, fatigue: 15, kills: 0, awards: [], mood: 'steady', said: [], leader: true, isPlayer: true,
    serviceNumber: serviceNumber(army, year, rnd, echelon.tier >= 2 && !state.settings.platoonSgt), health: 100, stress: 15
  };
  people.p0 = p0;

  // ---- the player's command element
  const hqCell = parseRef(n, t.friendly.hqCell);
  const hqSize = { fireteam: 1, squad: tech >= 4 ? 2 : 1, platoon: 5, company: 12, battalion: 60, brigade: 180, division: 900, corps: 2500 }[echelon.id];
  units.u0 = makeUnit({ id: 'u0', side: 'friendly', name: `${echelon.short} HQ`, short: 'HQ', callsign: t.friendly.callsign || fallbackCallsign(army, tech, null, 5), type: 'hq', size: echelon.tier <= 1 ? 'team' : echelon.tier <= 3 ? 'team' : 'company', strength: hqSize, cell: hqCell >= 0 ? hqCell : 0, quality: 'regular', isHQ: true, leaderId: 'p0' });
  units.u0.members = ['p0'];
  const hqRoles = {
    squad: tech >= 4 ? [['radio operator', 'radio']] : [],
    platoon: [[state.settings.platoonSgt ? 'platoon leader' : 'platoon sergeant', state.settings.platoonSgt ? 'platoonLeader' : 'platoonSgt'], ['radio operator', 'private'], ['medic', 'private'], ['runner', 'private']],
    company: [['executive officer', 'companyXO'], ['first sergeant', 'firstSgt'], ['radio operator', 'private'], ['forward observer', 'staffCaptain'], ['medic', 'private'], ['runner', 'private']]
  }[echelon.id] || [];
  for (const [role, rr] of hqRoles) {
    const s = makeSoldier(c, { role, rankRole: rr === 'private' || rr === 'radio' ? 'private' : rr, unitId: 'u0', weapon: role === 'medic' ? 'aid bag' : role === 'radio operator' ? `${army.radios?.platoon || 'radio'}` : army.kit?.rifle });
    const fromAI = matchStaff(t.friendly.staff, ROLE_ALIASES[role] || [role]);
    if (fromAI) Object.assign(s, { ...splitName(stripRank(fromAI.name)), personality: str(fromAI.personality), voice: str(fromAI.voice), opinion: str(fromAI.opinion), competence: clamp(Math.round(num(fromAI.competence, 3)), 1, 5), notable: true });
    s.leader = role !== 'runner' && role !== 'radio operator' && role !== 'medic';
    people[s.id] = s; units.u0.members.push(s.id);
  }

  // ---- staff (battalion and up): characters with opinions, members of the HQ.
  if (echelon.tier >= 4) {
    const want = ['XO', 'S1', 'S2', 'S3', 'S4', 'FSO', 'Chaplain', 'Aide', 'Driver'];
    const staff = asArray(t.friendly.staff);
    for (const role of want) {
      const ai = matchStaff(staff, { XO: ['xo', 'executive', 'chief of staff', 'deputy'], S1: ['s1', 'g1', 'personnel', 'adjutant'], S2: ['s2', 'g2', 'intelligence'], S3: ['s3', 'g3', 'operations'], S4: ['s4', 'g4', 'logistics', 'supply', 'quartermaster'], FSO: ['fso', 'fire support', 'artillery', 'fsco'], Chaplain: ['chaplain', 'padre', 'priest', 'political'], Aide: ['aide'], Driver: ['driver'] }[role]);
      const rr = role === 'XO' || role === 'S3' ? 'staffMajor' : role === 'Driver' ? 'private' : role === 'Aide' ? 'companyXO' : 'staffCaptain';
      const s = makeSoldier(c, { role: staffRoleName(role), rankRole: echelon.tier >= 6 && rr === 'staffCaptain' ? 'staffMajor' : rr, unitId: 'u0', weapon: army.kit?.sidearm || 'pistol' });
      if (ai) Object.assign(s, { ...splitName(stripRank(ai.name)), personality: str(ai.personality), voice: str(ai.voice), opinion: str(ai.opinion), competence: clamp(Math.round(num(ai.competence, 3)), 1, 5), notable: true });
      s.staffRole = role; s.leader = role !== 'Driver';
      people[s.id] = s; units.u0.members.push(s.id);
    }
  }

  // ---- subordinate units
  const leaders = asArray(t.friendly.leaders);
  const notables = asArray(t.friendly.notables);
  t.friendly.units.forEach((u, i) => {
    const cell = parseRef(n, u.cell);
    const unit = makeUnit({ id: u.id, side: 'friendly', name: str(u.name), short: str(u.short) || shortName(u.name), callsign: str(u.callsign) || fallbackCallsign(army, tech, t.friendly.callsign, i), type: u.type, size: u.size, strength: u.strength, cell: cell >= 0 ? cell : units.u0.cell, quality: u.quality, vehicles: u.vehicles });
    unit.posture = u.posture === 'dug_in' ? 'dug_in' : u.posture === 'cover' ? 'cover' : 'halted';
    const L = leaders.find(l => str(l.unit) === u.id) || leaders[i];
    const leaderRole = unit.size === 'individual' ? 'private' : unit.size === 'team' ? 'teamLeader' : unit.size === 'squad' || unit.size === 'section' ? 'squadLeader' : unit.size === 'platoon' ? 'platoonLeader' : unit.size === 'company' ? 'companyCdr' : unit.size === 'battalion' ? 'battalionCdr' : unit.size === 'division' ? 'divisionCdr' : 'brigadeCdr';
    const lead = makeSoldier(c, { role: L ? str(L.role) : `${SIZES[unit.size]?.label || 'unit'} leader`, rankRole: leaderRole, unitId: u.id, weapon: unit.size === 'individual' ? (str(u.weapon) || army.kit?.rifle) : (army.kit?.smg || army.kit?.rifle) });
    if (L) Object.assign(lead, { ...splitName(stripRank(L.name)), personality: str(L.personality), voice: str(L.voice), secret: str(L.secret), nickname: str(L.nickname) || lead.nickname, hometown: str(L.hometown) || lead.hometown, detail: str(L.detail) || lead.detail, breakingPoint: str(L.breakingPoint) || lead.breakingPoint, competence: clamp(Math.round(num(L.competence, 3)), 1, 5), initiative: clamp(Math.round(num(L.initiative, 3)), 1, 5), trait: str(L.trait) || lead.trait });
    lead.competence = lead.competence || 3; lead.initiative = lead.initiative || 3;
    lead.leader = true; lead.notable = true;
    if (L && str(L.rank)) { lead.rank = str(L.rank); }
    people[lead.id] = lead; unit.leaderId = lead.id; unit.members = [lead.id];
    if (named && unit.size !== 'individual') {
      const roles = rolesFor(unit, army);
      for (let k = 1; k < unit.strength; k++) {
        const [role, weapon] = roles[(k - 1) % roles.length] || ['rifleman', army.kit?.rifle];
        const nb = notables.find(x => str(x.unit) === u.id && !x._used && str(x.role).toLowerCase().includes(role.split(' ')[0])) || (k === 1 ? notables.find(x => str(x.unit) === u.id && !x._used) : null);
        const s = makeSoldier(c, { role: nb ? str(nb.role) : role, rankRole: role === 'assistant squad leader' ? 'teamLeader' : 'private', unitId: u.id, weapon, notable: nb || null });
        if (nb) { Object.assign(s, splitName(stripRank(nb.name))); nb._used = true; s.notable = true; }
        people[s.id] = s; unit.members.push(s.id);
      }
    } else if (!named) {
      // Company and above: a few notables by name; the rest are numbers until a casualty needs a name.
      for (const nb of notables.filter(x => str(x.unit) === u.id).slice(0, 2)) { const s = makeSoldier(c, { role: str(nb.role) || 'soldier', unitId: u.id, notable: nb }); Object.assign(s, splitName(stripRank(nb.name))); people[s.id] = s; unit.members.push(s.id); }
    }
    units[u.id] = unit;
  });
  for (const nb of notables.filter(x => !x._used)) delete nb._used;

  // ---- enemy
  t.enemy.units.forEach((u, i) => {
    const cell = parseRef(n, u.cell);
    const unit = makeUnit({ id: u.id, side: 'enemy', name: str(u.name), short: str(u.short) || shortName(u.name), callsign: null, type: u.type, size: u.size, strength: u.strength, cell: cell >= 0 ? cell : 0, quality: u.quality, vehicles: u.vehicles });
    unit.posture = u.posture; unit.decoy = !!u.decoy; unit.fakeStrength = u.fakeStrength || null; unit.plan = u.orders; unit.reaction = u.reaction; unit.fallback = u.fallback ? parseRef(n, u.fallback) : -1; unit.planStep = -1;
    unit.dormant = !!u.reinforcement; // reinforcements appear when an event spawns them
    if (unit.decoy) { unit.strength = 0; unit.start = 0; }
    units[u.id] = unit;
  });
  // No two opposing units start in the same square.
  for (const e of Object.values(units).filter(x => x.side === 'enemy')) {
    if (Object.values(units).some(f => f.side === 'friendly' && f.cell === e.cell)) { const alt = neighbours(n, e.cell).find(k => !Object.values(units).some(f => f.cell === k)); if (alt != null) e.cell = alt; }
  }
  state.units = units; state.people = people; state.playerId = 'p0';
  state.nameSeq = c.seq;
  return state;
}

const ROLE_ALIASES = {
  'executive officer': ['xo', 'executive', 'second in command', '2ic'], 'first sergeant': ['first sergeant', '1sg', '1stsgt', 'sergeant major', 'csm', 'spieß', 'hauptfeldwebel', 'starshina'],
  'forward observer': ['forward observer', 'fo', 'observer', 'fist'], 'platoon sergeant': ['platoon sergeant', 'psg', 'plt sgt'], 'platoon leader': ['platoon leader', 'platoon commander', 'lieutenant']
};
function matchStaff(staff, aliases) {
  const list = asArray(staff).filter(x => x && !x._used);
  const hit = list.find(x => { const r = str(x.role).toLowerCase(); return aliases.some(a => r === a || r.startsWith(a + ' ') || r.includes(a) && a.length > 3); });
  if (hit) hit._used = true;
  return hit || null;
}
function staffRoleName(r) { return { XO: 'executive officer', S1: 'S1 (personnel)', S2: 'S2 (intelligence)', S3: 'S3 (operations)', S4: 'S4 (logistics)', FSO: 'fire support officer', Chaplain: 'chaplain', Aide: 'aide-de-camp', Driver: 'driver' }[r] || r; }
const RANK_PREFIX = /^(?:(?:pvt|pfc|spc|cpl|sgt|ssg|s\/sgt|t\/sgt|sfc|msg|1sg|lt|2lt|1lt|2nd lt|1st lt|capt|cpt|maj|ltc|lt col|col|gen|brig|cdr|private|corporal|sergeant|lieutenant|captain|major|colonel|general|cpl\.|sgt\.|lt\.|capt\.|maj\.|col\.)\.?\s+)+/i;
export function stripRank(name) { return str(name).trim().replace(RANK_PREFIX, '').trim(); }
export function splitName(name) { const parts = str(name).trim().split(/\s+/); return { name: parts.join(' '), first: parts[0] || '', last: parts.length > 1 ? parts[parts.length - 1] : parts[0] || '' }; }
function shortName(name) { const s = str(name); const m = s.match(/^(\d+\w*|[A-Z]\w*)\s+(\w)/); return m ? `${m[1]} ${m[2].toUpperCase()}`.slice(0, 8) : s.slice(0, 8); }

export function makeUnit({ id, side, name, short, callsign, type, size, strength, cell, quality = 'regular', vehicles = 0, isHQ = false, leaderId = null }) {
  return {
    id, side, name, short, callsign, type: UNIT_TYPES[type] ? type : 'infantry', size, strength, start: strength, max: strength, vehicles, vehiclesStart: vehicles, cell, quality,
    morale: side === 'enemy' ? 70 : 72, suppression: 0, fatigue: 15, ammo: 100, posture: 'halted', order: null, leaderId, members: [], radio: 'ok',
    reported: { cell, at: 0 }, path: [], progress: 0, engagedAt: -9999, lastFiredAt: -9999, isHQ, kills: 0, killed: 0, wounded: 0, missing: 0, captured: 0, surrendered: false, destroyed: false, history: []
  };
}

/** A name for a casualty in a unit that has no named rank and file (company level and up). */
export function nameOnDemand(state, unit, ctx) {
  const c = { army: ctx.army, eraId: state.settings.eraId, rnd: ctx.rnd || Math.random, tech: state.era.tech, seq: state.nameSeq || 500, usedNames: null };
  const s = makeSoldier(c, { role: 'soldier', unitId: unit.id });
  state.nameSeq = c.seq;
  state.people[s.id] = s; unit.members.push(s.id);
  return s;
}

/** Replacements between operations: strangers with new traits and no bonds. */
export function makeReplacements(state, unit, count, ctx) {
  const c = { army: ctx.army, eraId: state.settings.eraId, rnd: ctx.rnd || Math.random, tech: state.era.tech, seq: state.nameSeq || 500, usedNames: new Set() };
  const out = [];
  for (let i = 0; i < count; i++) {
    const s = makeSoldier(c, { role: 'rifleman (replacement)', unitId: unit.id });
    s.replacement = true; s.morale = 50; s.trait = s.trait || 'green replacement';
    state.people[s.id] = s; unit.members.push(s.id); out.push(s);
  }
  state.nameSeq = c.seq;
  return out;
}

export { seededRandom };
