// The orders pipeline. The player writes orders in free text ("2nd squad,
// base of fire on the treeline; 1st squad, bound left to D5 in order to flank
// the MG"), by button, or on the map. The code parses what it can into tasks,
// scores how clear the order is, works out how long it takes to arrive by
// echelon and radio state, and sometimes lets a tired or mediocre subordinate
// misread it in a plausible way. What the parser cannot read goes to the GM.

import { parseRef, refOf, findFeature, distance, neighbours, colRow, idxOf, findPath } from './grid.js';
import { friendlyUnits, liveUnit, addDecision, personLabel } from './state.js';
import { TASKS } from './schema.js';
import { lightAt } from './clock.js';
import { clamp, str } from './util.js';

const ORD = { first: '1st', second: '2nd', third: '3rd', fourth: '4th', fifth: '5th', sixth: '6th', one: '1', two: '2', three: '3', four: '4' };

export const TASK_LABEL = { move: 'move to', assault: 'assault', suppress: 'suppress / base of fire on', defend: 'defend', dig_in: 'dig in at', withdraw: 'withdraw to', halt: 'halt and take cover', recon: 'reconnoitre', ambush: 'ambush at', patrol: 'patrol to', breach: 'breach at', reinforce: 'reinforce', counterattack: 'counterattack', hold: 'hold', screen: 'screen at', support: 'support by fire on' };

const VERBS = [
  ['dig_in', /\b(dig(ging)? in|dig|entrench|fortify|prepare (fighting )?positions)\b/],
  ['ambush', /\b(ambush|lay an ambush|set (up )?an? ambush)\b/],
  ['withdraw', /\b(withdraw|fall back|pull back|retreat|retire|break contact|disengage|get back|bug out)\b/],
  ['breach', /\b(breach|clear the (mines?|wire|minefield)|blow the wire|cut the wire|bangalore)\b/],
  ['suppress', /\b(suppress\w*|base of fire|support by fire|fire (on|at|into)|engage|open fire|shoot|lay down (fire|covering fire)|covering fire|pin (them )?down|keep their heads down|hose|rake|put fire on|overwatch)\b/],
  ['assault', /\b(attack|assault|storm|charge|seize|take (the|that|it|out)|clear|rush|overrun|close with|go in|counterattack|knock out|destroy)\b/],
  ['recon', /\b(recon\w*|scout|probe|check out|have a look|look at|observe)\b/],
  ['patrol', /\b(patrol)\b/],
  ['halt', /\b(halt|stop|hold (your )?position|hold fast|freeze|get down|take cover|stay (put|there)|wait)\b/],
  ['defend', /\b(defend|hold|establish (a |the )?defen\w*|block|occupy|man the|stand fast)\b/],
  ['reinforce', /\b(reinforce|join|link up with|back up|support)\b/],
  ['move', /\b(move|go|advance|bound|push|head|proceed|get to|displace|relocate|shift|cross|follow|flank|maneuver|manoeuvre|infiltrate|crawl|run|cross the ld|step off|mount up|get over|make for)\b/]
];

const FIRE_RE = /\b(fire mission|call (in |for )?(fire|artillery|arty|mortars?|the guns|air|an? air ?strike|naval gunfire|gunships?|a drone strike)|(artillery|arty|mortars?|the guns|naval gunfire|gunships?|air ?strike|cas|drone strike|stonk|barrage)\s+(on|onto|at|into)|smoke (on|at|onto)|illum\w* (on|over|at)|drop (smoke|rounds|fire)|request (fire|smoke|illum\w*))\b/i;

/** Every name the player might use for a unit, longest first. */
export function unitAliases(state) {
  const out = [];
  const add = (alias, id) => { const a = alias.toLowerCase().replace(/\s+/g, ' ').trim(); if (a.length >= 2) out.push([a, id]); };
  for (const u of friendlyUnits(state)) {
    if (!liveUnit(u)) continue;
    add(u.id, u.id); add(u.name, u.id); if (u.short) add(u.short, u.id); if (u.callsign) add(u.callsign, u.id);
    const nm = u.name.toLowerCase();
    const m = nm.match(/^(\d+)(st|nd|rd|th)?\s+(\w+)/);
    if (m) { add(`${m[1]}${m[2] || ''} ${m[3]}`, u.id); add(`${m[3]} ${m[1]}`, u.id); add(`${m[1]} ${m[3]}`, u.id); add(`${m[1]}${m[3].slice(0, 2)}`, u.id); add(`${m[1]}${m[3][0]}`, u.id); }
    const t = nm.match(/^(alpha|bravo|charlie|delta|able|baker|dog|easy|fox|george)\b/);
    if (t) { add(t[1], u.id); add(`${t[1][0]} team`, u.id); add(`team ${t[1][0]}`, u.id); }
    const bare = nm.replace(/\s*\([^)]*\)\s*/g, ' ').trim();
    if (bare !== nm) add(bare, u.id);
    // Lettered companies, batteries and troops: "C Company", "C Co", "Charlie Company", "Charlie".
    const lc = bare.match(/^([a-z])\s+(company|co|battery|btry|troop|squadron|sqn)\b/);
    if (lc) {
      const L = lc[1]; const ph = { a: ['alpha', 'able'], b: ['bravo', 'baker'], c: ['charlie'], d: ['delta', 'dog'], e: ['echo', 'easy'], f: ['foxtrot', 'fox'], g: ['golf', 'george'], h: ['hotel', 'how'], i: ['india', 'item'], k: ['kilo', 'king'], l: ['lima', 'love'], m: ['mike'] }[L] || [];
      add(`${L} ${lc[2]}`, u.id); add(`${L} co`, u.id); add(`${L} company`, u.id); add(`${L}/co`, u.id);
      for (const p of ph) { add(`${p} company`, u.id); add(`${p} co`, u.id); add(p, u.id); }
    }
    const words = bare.split(/\s+/);
    if (words.length >= 2 && /^(scout|recon|mortar|tank|engineer|sniper|weapons|machine|anti|tow|support|headquarters)/.test(words[0])) add(words[0] + (words[0].endsWith('s') ? '' : 's'), u.id);
    const leader = state.people[u.leaderId];
    if (leader && !leader.isPlayer) { add(leader.last || leader.name.split(' ').slice(-1)[0], u.id); if (leader.nickname) add(leader.nickname, u.id); add(leader.name, u.id); }
    for (const pid of u.members || []) { const p = state.people[pid]; if (p && u.size === 'individual' && !p.isPlayer) { add(p.last || p.name.split(' ').slice(-1)[0], u.id); if (p.nickname) add(p.nickname, u.id); } }
    if (u.type === 'mg') { add('gun team', u.id); add('the gun', u.id); add('mg team', u.id); add('machine gun', u.id); add('machine guns', u.id); add('the guns', u.id); add('mgs', u.id); }
    if (u.type === 'mortar') { add('mortar section', u.id); add('our mortars', u.id); }
    if (u.type === 'armor') { add('tanks', u.id); add('the tanks', u.id); add('armor', u.id); add('armour', u.id); }
    if (u.type === 'recon') { add('scouts', u.id); add('recon', u.id); add('the recon', u.id); }
    if (u.type === 'engineer') { add('engineers', u.id); add('sappers', u.id); add('pioneers', u.id); }
    if (u.type === 'sniper') { add('sniper', u.id); add('snipers', u.id); }
  }
  for (const s of ['i', 'me', 'myself', 'hq', 'headquarters', 'command post', 'the cp', 'my group', 'tac', 'we']) out.push([s, 'u0']);
  return out.sort((a, b) => b[0].length - a[0].length);
}

function normalise(text) {
  let t = ` ${String(text).toLowerCase()} `;
  for (const [w, d] of Object.entries(ORD)) t = t.replace(new RegExp(`\\b${w}\\b`, 'g'), d);
  return t.replace(/[“”"]/g, '"').replace(/\s+/g, ' ');
}

function findUnits(state, clause, aliases) {
  const t = normalise(clause);
  if (/\b(all units|everyone|everybody|all (squads|teams|platoons|companies|battalions|brigades|divisions|elements)|whole (squad|platoon|company|unit)|the lot of you)\b/.test(t)) return friendlyUnits(state).filter(u => liveUnit(u) && !u.isHQ).map(u => u.id);
  const found = [];
  let rest = t;
  for (const [a, id] of aliases) {
    const re = new RegExp(`(^|[^a-z0-9])${a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=[^a-z0-9]|$)`);
    if (re.test(rest)) {
      if (['i', 'me', 'we', 'myself'].includes(a) && !/\b(i|we)\s+(will\s+)?(move|go|head|displace|relocate|join|follow|advance|withdraw|fall back|dig|stay|go forward)|\b(move|take) me\b/.test(rest)) continue;
      if (!found.includes(id)) found.push(id);
      rest = rest.replace(re, '$1 ');
    }
  }
  return found;
}

/** Find a target square in a clause: a grid square, an objective, a control measure, a feature, an enemy contact, or a relative direction. */
export function findTarget(state, clause, unitId = null) {
  const n = state.grid.n;
  const raw = String(clause);
  const cell = findGridRef(n, raw);
  if (cell >= 0) return { cell, how: refOf(n, cell) };
  const low = normalise(clause);
  for (const cm of [...state.controlMeasures].sort((a, b) => b.name.length - a.name.length)) {
    const name = cm.name.toLowerCase();
    if (name.length >= 3 && low.includes(name)) { const c = cm.cells[Math.floor(cm.cells.length / 2)]; return { cell: cm.type === 'PL' || cm.type === 'boundary' || cm.type === 'LD' ? nearestCell(state, cm.cells, unitId) : c, how: cm.name, cm }; }
  }
  if (/\b(the )?(objective|obj)\b/.test(low) && state.mission.objectiveCells.length) return { cell: state.mission.objectiveCells[0], how: state.mission.name };
  // Enemy contacts by what they are or where.
  const contacts = Object.values(state.picture.contacts).filter(c => !c.cleared);
  if (contacts.length) {
    const kinds = [['mg', /\b(mg|machine ?gun|the gun|gun position|mg nest)\b/], ['armor', /\b(tank|tanks|armou?r|panzer)\b/], ['at', /\b(anti-?tank|at gun|atgm)\b/], ['sniper', /\bsniper\b/], ['mortar', /\bmortars?\b/], ['infantry', /\b(infantry|riflemen|troops)\b/]];
    for (const [k, re] of kinds) if (re.test(low)) { const c = contacts.filter(x => x.type === k).sort((a, b) => b.at - a.at)[0]; if (c) return { cell: c.cell, how: `the ${k === 'mg' ? 'machine gun' : k} reported at ${refOf(n, c.cell)}`, contactId: c.id }; }
    if (/\b(the enemy|them|that position|the position|bunker|strongpoint|the contact)\b/.test(low)) { const c = contacts.sort((a, b) => b.at - a.at)[0]; return { cell: c.cell, how: `the enemy at ${refOf(n, c.cell)}`, contactId: c.id }; }
  }
  // Named features: "the farm", "Hill 30", "the treeline", "the hedgerow".
  const words = low.replace(/\b(to|toward|towards|on|at|onto|into|the|behind|along|through|via|in|of|and|order|so|that)\b/g, ' ').split(/\s+/).filter(w => w.length > 2);
  for (let len = 4; len >= 1; len--) for (let i = 0; i + len <= words.length; i++) {
    const f = findFeature(state.grid, words.slice(i, i + len).join(' '));
    if (f) return { cell: nearestCell(state, f.cells, unitId), how: f.name, feature: f };
  }
  const generic = [['woods', /\b(tree ?line|treeline|woods|wood|forest|trees|jungle|tree line)\b/], ['hedgerow', /\b(hedge|hedgerow|hedges|bocage)\b/], ['village', /\b(farm|farmhouse|village|houses|buildings|compound|hamlet)\b/], ['urban', /\b(town|city|streets)\b/], ['rocky', /\b(rocks|ridge|high ground|crest)\b/]];
  for (const [ty, re] of generic) if (re.test(low)) {
    const u = state.units[unitId] || state.units.u0;
    const cells = state.grid.cells.map((c, i) => (c.t === ty || (ty === 'rocky' && c.elev >= 2) ? i : -1)).filter(i => i >= 0);
    if (cells.length) { const near = /\bnear\b/.test(low), far = /\b(far|distant|other)\b/.test(low); const sorted = cells.sort((a, b) => distance(n, u.cell, a) - distance(n, u.cell, b)); const c = far ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length / 2))] : sorted[near ? 0 : Math.min(1, sorted.length - 1)]; return { cell: c, how: `the ${ty === 'woods' ? 'treeline' : ty} at ${refOf(n, c)}`, generic: ty }; }
  }
  // Relative directions from the unit, using the objective as "forward".
  const rel = low.match(/\b(left|right|forward|back|backwards|rear|north|south|east|west)\b/);
  if (rel && unitId) {
    const u = state.units[unitId]; if (!u) return null;
    const m = low.match(/(\d{2,5})\s?(m|meters|metres|yards|km)\b/);
    let cells = 2;
    if (m) { const metres = Number(m[1]) * (m[2] === 'km' ? 1000 : m[2] === 'yards' ? 0.91 : 1); cells = clamp(Math.round(metres / state.scale.cellM), 1, 8); }
    const dir = directionVector(state, u.cell, rel[1]);
    const p = colRow(n, u.cell);
    const c = idxOf(n, clamp(Math.round(p.c + dir.dc * cells), 0, n - 1), clamp(Math.round(p.r + dir.dr * cells), 0, n - 1));
    return { cell: c, how: `${cells * state.scale.cellM} m ${rel[1]} (${refOf(n, c)})`, relative: true };
  }
  return null;
}

/** A grid square written in text: "C4", "grid c4", "to d5". Lower-case single letters need a preposition so "a 2-man team" is not A2. */
export function findGridRef(n, text) {
  const re = /(\b(?:grid|square|to|at|on|onto|into|toward|towards|near|from|in|over|of)\s+)?\b([A-Ta-t])(\s?-?)(\d{1,2})\b(?!\s*(?:min|minutes|m\b|km|hours|hrs|h\b|men|rounds|man\b|-man|mm|x\b))/g;
  let m;
  while ((m = re.exec(String(text)))) {
    const letter = m[2]; const sep = m[3]; const prep = !!m[1];
    // "c4" needs a preposition; "I 9" could be the pronoun, "I9" cannot.
    if (letter === letter.toLowerCase() && !prep && (sep || !/^[a-t]\d/.test(m[0].trim()) || letter === 'a' || letter === 'i')) continue;
    if (letter === 'I' && sep && !prep) continue;
    const idx = parseRef(n, `${letter}${m[4]}`);
    if (idx >= 0) return idx;
  }
  return -1;
}

function nearestCell(state, cells, unitId) { const u = state.units[unitId] || state.units.u0; return [...cells].sort((a, b) => distance(state.grid.n, u.cell, a) - distance(state.grid.n, u.cell, b))[0]; }

function directionVector(state, from, word) {
  const n = state.grid.n;
  if (word === 'north') return { dc: 0, dr: -1 }; if (word === 'south') return { dc: 0, dr: 1 }; if (word === 'east') return { dc: 1, dr: 0 }; if (word === 'west') return { dc: -1, dr: 0 };
  const obj = state.mission.objectiveCells[0] ?? state.grid.n * Math.floor(n / 2) + Math.floor(n / 2);
  const a = colRow(n, from), b = colRow(n, obj);
  let fx = b.c - a.c, fy = b.r - a.r; const L = Math.hypot(fx, fy) || 1; fx /= L; fy /= L;
  if (word === 'forward') return { dc: fx, dr: fy };
  if (['back', 'backwards', 'rear'].includes(word)) return { dc: -fx, dr: -fy };
  // Facing (fx, fy) with north up: left is (fy, -fx), right is (-fy, fx).
  return word === 'left' ? { dc: fy, dr: -fx } : { dc: -fy, dr: fx };
}

/** How clear is this order? 0..3: task and target, purpose, timing, control measures, route. */
export function orderQuality(text) {
  const t = String(text).toLowerCase();
  let q = 1;
  if (/\b(in order to|so that|so we can|to allow|to let|intent|purpose|because|to prevent|to deny|to keep|to fix|to protect|which lets)\b/.test(t)) q += 1;
  if (/\b(at \d{3,4}|nlt|no later than|on my (signal|command|order|mark)|when (you|we|they)|once|after|before|h-?hour|by \d{3,4}|then)\b/.test(t)) q += 0.5;
  if (/\b(pl|phase line|obj|objective|trp|cp|checkpoint|ld|line of departure|loa|boundary|rally point|rp)\b/.test(t)) q += 0.5;
  if (/\b(via|along|through|by way of|using the|following the|behind the|covered route|dead ground|defilade)\b/.test(t)) q += 0.3;
  return clamp(q, 0, 3);
}

/** Split a message into order-sized clauses. */
export function clauses(text) {
  return String(text).split(/;|\n|(?<=[.!?])\s+(?=[A-Z0-9])|\bthen\b|,\s*(?=(?:and\s+)?(?:\d|first|second|third|fourth|alpha|bravo|charlie|delta|able|baker|all|everyone)\b)/i).map(s => s.trim()).filter(s => s.length > 1);
}

/**
 * Parse a free-text message. Returns { orders: [{ unitIds, task, cell, how, clause, quality }], fire: { cell, kind, assetType } | null, unparsed: [clauses] }.
 */
export function parseOrders(state, text) {
  const aliases = unitAliases(state);
  const out = { orders: [], fire: null, unparsed: [] };
  const all = clauses(text);
  let lastUnits = null;
  for (const c of all) {
    const low = normalise(c);
    if (FIRE_RE.test(c)) {
      const tgt = findTarget(state, c, 'u0');
      const kind = /\bsmoke\b/i.test(c) ? 'smoke' : /\billum/i.test(c) ? 'illum' : 'HE';
      const assetType = /\b(mortar)/i.test(c) ? 'mortar' : /\b(naval|ship)/i.test(c) ? 'naval' : /\b(air ?strike|cas|aircraft|planes?|jabo|fighter|bomb)/i.test(c) ? 'air' : /\b(gunships?|helicopters?|helos?|cobras?|apaches?)/i.test(c) ? 'helicopter' : /\bdrone/i.test(c) ? 'drone' : /\b(arty|artillery|guns|battery|barrage|stonk|howitzers?)/i.test(c) ? 'artillery' : null;
      if (tgt) { out.fire = { cell: tgt.cell, how: tgt.how, kind, assetType, method: /\b(fire for effect|ffe)\b/i.test(c) ? 'ffe' : 'adjust', clause: c }; continue; }
    }
    let unitIds = findUnits(state, c, aliases);
    let task = null;
    for (const [k, re] of VERBS) if (re.test(low)) { task = k; break; }
    if (!unitIds.length && task && lastUnits && !/\b(i|we)\b/.test(low)) unitIds = lastUnits;
    if (!unitIds.length || !task) { out.unparsed.push(c); continue; }
    lastUnits = unitIds;
    const tgt = findTarget(state, c, unitIds[0]);
    if (!tgt && !['halt', 'dig_in', 'defend', 'hold', 'withdraw', 'suppress'].includes(task)) { out.unparsed.push(c); continue; }
    if (task === 'reinforce' && !tgt) {
      const other = findUnits(state, c.replace(/^[^,]*,/, ''), aliases).find(x => !unitIds.includes(x));
      if (other) { out.orders.push({ unitIds, task: 'move', cell: state.units[other].cell, how: state.units[other].name, clause: c, quality: orderQuality(c) }); continue; }
    }
    let t = task;
    if (task === 'move' && /\bflank\b/.test(low) && tgt) t = 'move';
    out.orders.push({ unitIds, task: t, cell: tgt ? tgt.cell : null, how: tgt?.how || null, clause: c, quality: orderQuality(c), contactId: tgt?.contactId || null });
  }
  return out;
}

/**
 * Issue an order to a unit: compute delay and misreading, record it. Returns { unit, order, delay, misread }.
 * ctx: { echelon, rnd, era }
 */
export function issueOrder(state, unitId, { task, cell, how, clause = '', quality = 1, intent = '', source = 'player' }, ctx) {
  const u = state.units[unitId];
  if (!u || !liveUnit(u)) return null;
  if (!TASKS.includes(task)) task = 'move';
  const { echelon, rnd } = ctx;
  const now = state.clock.minutes;
  const n = state.grid.n;
  const hq = state.units.u0;
  const leader = state.people[u.leaderId];
  const comp = leader?.competence || 3;
  const dist = distance(n, hq.cell, u.cell);
  let delay = 0;
  if (unitId !== 'u0') {
    if (echelon.tier <= 1) {
      // Voice and hand signals within a few hundred metres; a runner beyond that.
      const voiceCells = Math.max(1, Math.round(250 / state.scale.cellM));
      if (dist > voiceCells) delay = Math.round(dist * state.scale.cellM / 120);
    } else {
      const radio = u.radio === 'down' ? 3 : u.radio === 'intermittent' ? 1.8 : 1;
      delay = echelon.orderDelay * radio + (u.radio === 'down' ? dist * state.scale.cellM / 150 : 0);
    }
    delay *= (1.25 - comp * 0.08) * (quality >= 2 ? 0.8 : quality < 1.2 ? 1.15 : 1);
    if (state.planning.rehearsal) delay *= 0.85;
    const p0 = state.people.p0;
    if ((p0.fatigue || 0) > 75) delay *= 1.25;
    if (state.settings.background === 'staff' && echelon.tier >= 3) delay *= 0.8;
    delay = Math.max(0, Math.round(delay * (0.8 + rnd() * 0.4)));
  }
  // Misreading: plausible, not random.
  let misread = null;
  let target = cell;
  if (unitId !== 'u0' && cell != null && cell >= 0) {
    const light = lightAt(state);
    let p = 0.04 + (quality < 1.2 ? 0.12 : quality < 2 ? 0.05 : 0) + (comp <= 2 ? 0.08 : comp >= 4 ? -0.03 : 0) + (light.phase === 'night' ? 0.06 : 0) + (u.radio === 'intermittent' ? 0.08 : u.radio === 'down' ? 0.12 : 0) + ((state.people.p0.fatigue || 0) > 75 ? 0.1 : 0) - (state.settings.background === 'rotc' ? 0.05 : 0) - (state.planning.opord ? 0.03 : 0);
    if (/\b[A-T]\d{1,2}\b/.test(clause)) p *= 0.5; // a grid reference is hard to misunderstand
    if (rnd() < clamp(p, 0.01, 0.4)) {
      const nb = neighbours(n, cell).filter(k => state.grid.cells[k].t === state.grid.cells[cell].t && k !== cell);
      const alt = nb.length ? nb[Math.floor(rnd() * nb.length)] : neighbours(n, cell)[Math.floor(rnd() * neighbours(n, cell).length)];
      if (alt != null && alt >= 0) { target = alt; misread = `${leader ? personLabel(state, leader) : u.name} understood the order as ${refOf(n, alt)} instead of ${refOf(n, cell)}${how ? ` (${how})` : ''}.`; state.stats.misreads += 1; }
    }
  }
  const order = { id: `o${now}-${unitId}-${Math.floor(rnd() * 1000)}`, unitId, task, cell: target, intendedCell: cell, how: how || (target != null && target >= 0 ? refOf(n, target) : null), clause: str(clause).slice(0, 200), quality, intent: intent || state.planning.intent || '', issuedAt: now, startAt: now + delay, status: delay > 0 ? 'pending' : 'active', misread, source, origin: u.cell };
  u.order = order;
  if (delay === 0) activate(state, u);
  state.stats.ordersIssued += 1;
  addDecision(state, `${u.name}: ${TASK_LABEL[task] || task}${order.how ? ` ${order.how}` : ''}${clause ? ` — "${str(clause).slice(0, 120)}"` : ''}`);
  return { unit: u, order, delay, misread };
}

/** An order becomes active: plan the route and set the posture. */
export function activate(state, u) {
  const o = u.order; if (!o) return;
  o.status = 'active'; o.activeAt = state.clock.minutes;
  const mob = u.type === 'armor' || u.type === 'mech' ? 'tracked' : u.type === 'recon' ? 'light' : ['hq', 'artillery', 'support'].includes(u.type) && state.era.tech >= 2 && state.settings.echelonId !== 'squad' && state.settings.echelonId !== 'fireteam' ? 'wheeled' : 'foot';
  u.mobility = mob;
  if (['move', 'assault', 'withdraw', 'recon', 'patrol', 'ambush', 'reinforce', 'counterattack', 'breach', 'screen'].includes(o.task) && o.cell != null && o.cell >= 0 && o.cell !== u.cell) {
    u.path = findPath(state.grid, u.cell, o.cell, mob);
    u.progress = 0;
    if (!u.path.length) { o.status = 'failed'; o.failReason = 'no route'; }
    else u.posture = o.task === 'assault' || o.task === 'counterattack' ? 'moving' : o.task === 'withdraw' ? 'withdrawing' : 'moving';
  } else {
    u.path = [];
    if (o.task === 'halt') u.posture = 'cover';
    if (o.task === 'defend' || o.task === 'hold' || o.task === 'screen') u.posture = u.posture === 'dug_in' ? 'dug_in' : 'cover';
    if (o.task === 'ambush') u.posture = 'ambush';
    if (o.task === 'dig_in') { o.digUntil = state.clock.minutes + Math.max(30, state.scale.tick * 3); u.posture = 'cover'; }
    if (o.task === 'suppress' || o.task === 'support') u.posture = u.posture === 'dug_in' ? 'dug_in' : 'cover';
  }
}

/** One-line description of a unit's current order. */
export function orderText(state, u) {
  const o = u.order; if (!o) return 'no orders';
  const n = state.grid.n;
  const tgt = o.cell != null && o.cell >= 0 ? ` ${refOf(n, o.cell)}` : '';
  const st = o.status === 'pending' ? ` (in ${Math.max(0, o.startAt - state.clock.minutes)} min)` : o.status === 'done' ? ' (done)' : o.status === 'failed' ? ` (failed${o.failReason ? `: ${o.failReason}` : ''})` : '';
  return `${TASK_LABEL[o.task] || o.task}${tgt}${st}`;
}
