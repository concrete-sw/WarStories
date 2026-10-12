// The prompt that builds an operation: the hidden truth of one battle, sized to
// the player's echelon. Variety is binding: each operation is drawn from a seed
// (a mission from the table, a complication, the ground's character, weather,
// the enemy commander's temperament, the player's boss, a twist) and the game
// remembers what recent operations used.

import { TIMING, MISSION_TYPES } from '../engine/schema.js';
import { TERRAIN } from '../data/terrain.js';
import { SIZES, SUB_SIZES } from '../data/echelons.js';

export const MISSION_TABLE = [
  { n: 1, text: 'Hold a bridge or crossing', type: 'defend' }, { n: 2, text: 'Assault a fortified position', type: 'attack' }, { n: 3, text: 'Night reconnaissance patrol', type: 'recon' },
  { n: 4, text: 'Ambush a supply route', type: 'ambush' }, { n: 5, text: 'Beat back a counterattack', type: 'defend' }, { n: 6, text: 'Convoy escort', type: 'escort' },
  { n: 7, text: 'Contested river crossing', type: 'crossing' }, { n: 8, text: 'Urban clearance, block by block', type: 'clear' }, { n: 9, text: 'Relieve an encircled unit', type: 'relief' },
  { n: 10, text: 'Fighting withdrawal', type: 'delay' }, { n: 11, text: 'Raid to destroy a key asset', type: 'raid' }, { n: 12, text: 'Rescue downed aircrew or a lost patrol', type: 'rescue' },
  { n: 13, text: 'Secure a village full of civilians', type: 'secure' }, { n: 14, text: 'A prisoner dilemma', type: 'raid' }, { n: 15, text: 'Counter-sniper hunt', type: 'clear' },
  { n: 16, text: 'Breach mines, obstacles or IEDs', type: 'breach' }, { n: 17, text: 'Hold through brutal weather', type: 'hold' }, { n: 18, text: 'Resupply run under fire', type: 'escort' },
  { n: 19, text: 'Casualty evacuation under fire', type: 'rescue' }, { n: 20, text: 'Link up with allies who do not share a language', type: 'relief' }, { n: 21, text: 'Deception or feint', type: 'attack' },
  { n: 22, text: 'Guard a high-value site or VIP', type: 'defend' }, { n: 23, text: 'Infiltrators in the rear area', type: 'clear' }, { n: 24, text: 'Rest and refit, where discipline cracks surface', type: 'secure' },
  { n: 25, text: 'Green replacements before a big push', type: 'attack' }, { n: 26, text: 'A friendly-fire incident and its investigation', type: 'hold' }, { n: 27, text: 'A press embed or VIP visit with an agenda', type: 'patrol' },
  { n: 28, text: 'Disease or exposure sweeps the unit', type: 'hold' }, { n: 29, text: 'A soldier breaking: desertion or mutiny', type: 'defend' }, { n: 30, text: 'Humanitarian crisis: refugees or a starving town', type: 'secure' }
];

const COMPLICATIONS = ['the radios fail at the worst moment', 'a lost or misdirected adjacent unit', 'higher changes the plan mid-operation', 'supporting fires land short', 'civilians who will not leave', 'a war correspondent attached to you', 'a defector with a story', 'a bridge or road that is not where the map says', 'a key leader is sick or wounded before it starts', 'ammunition or water runs short early', 'the enemy is stronger than briefed', 'the enemy is not where he was reported', 'a friendly unit mistaken for the enemy', 'weather turns', 'a prisoner who might be lying', 'a booby-trapped position', 'a commander who wants it done faster than possible', 'a sniper who owns one stretch of ground'];
const TERRAIN_CHAR = ['broken and close: short sight lines', 'open and exposed: long fields of fire', 'dominated by one piece of high ground', 'cut by water: a river, canal or marsh', 'built-up: houses, walls, cellars', 'wooded and dark', 'a road and a choke point', 'mixed farmland with a village at its heart'];
const TEMPERAMENTS = ['methodical and patient', 'aggressive and impatient', 'cunning, fond of feints and ambushes', 'rigid, follows the plan to the letter', 'exhausted and fatalistic', 'young and reckless', 'a veteran who reads the ground well', 'politically anxious, afraid of his own superiors'];
const BOSSES = ['demanding and impatient, wants results by a deadline', 'calm and supportive, gives you room', 'micromanager on the radio every ten minutes', 'distant and silent: you are on your own', 'brilliant but cold', 'out of his depth and covering for it', 'a political appointee with an eye on the press', 'an old soldier who trusts you'];
const TWISTS = ['the objective matters less than everyone thinks; something nearby matters more', 'one intelligence report is planted', 'a friendly unit is not where it reports', 'the enemy is preparing his own attack at the same hour', 'the enemy commander will make one specific mistake', 'civilians know something important', 'the weather changes everything halfway through', 'the relief or reinforcement will be late', 'a decoy position draws fire', 'the enemy wants to surrender but cannot say so'];

export const BANNED = ['the sergeant who dies saving the new guy', 'the photo of the sweetheart in the helmet', 'a "we are not so different" speech from the enemy', 'the radio operator always dying first', 'a beach-landing opening (unless the mission is a landing)', 'a chaplain blessing the troops before the attack', 'a soldier who reveals he has a pregnant wife just before being hit', 'the lone hero charging the machine gun'];

const pick = (arr, rnd) => arr[Math.floor(rnd() * arr.length)];

/** A seed for this operation. recent: { missions: [n...] } so the table rotates. */
export function pickSeed(rnd = Math.random, recent = {}, opts = {}) {
  let mission;
  if (opts.missionN) mission = MISSION_TABLE.find(m => m.n === Number(opts.missionN));
  if (!mission) {
    const used = new Set((recent.missions || []).slice(0, 5));
    const avail = MISSION_TABLE.filter(m => !used.has(m.n) && (!opts.typeFilter || opts.typeFilter(m)));
    mission = pick(avail.length ? avail : MISSION_TABLE, rnd);
  }
  return { mission, complication: pick(COMPLICATIONS, rnd), terrain: pick(TERRAIN_CHAR, rnd), enemyTemperament: pick(TEMPERAMENTS, rnd), boss: pick(BOSSES, rnd), twist: pick(TWISTS, rnd) };
}

const UNIT_COUNTS = { fireteam: [3, 4], squad: [2, 4], platoon: [3, 6], company: [3, 7], battalion: [4, 8], brigade: [3, 7], division: [3, 7], corps: [3, 7] };
export const unitCountsFor = id => UNIT_COUNTS[id] || [2, 8];

function describeChoices(a) {
  const { era, theatre, army, branch, echelon, settings, player, background, rank, seed } = a;
  const subs = SUB_SIZES[echelon.id];
  const size = SIZES[subs[0]];
  const T = TIMING[echelon.id];
  const startNote = settings.start === 'contact' ? 'The operation opens ALREADY IN CONTACT: hHourMinutes is 0 and the enemy is close enough to fire at the player\'s people within the first few minutes.' : settings.start === 'hhour' ? `The operation opens about an hour before H-hour at this echelon's scale: hHourMinutes near ${Math.round((T[0] + T[1]) / 4)}.` : `The operation opens when the player receives the warning order, with the planning time this echelon needs: hHourMinutes between ${T[0]} and ${T[1]}.`;
  return [
    `THE PLAYER: ${rank.full} ${player.name}${player.hometown ? ` from ${player.hometown}` : ''}, ${echelon.name.toLowerCase()} in the ${army.name} (${army.adjective}, ${army.side}), ${branch.name.toLowerCase()} branch. Background: ${background ? `${background.name} (${background.bonus})` : 'none in particular'}.${settings.platoonSgt ? ' The player is the PLATOON SERGEANT, not the lieutenant; the platoon leader is a separate character in the HQ.' : ''}`,
    `THE WAR: ${era.name}, ${theatre.name}. Allowed dates ${theatre.from} to ${theatre.to}. Typical ground: ${theatre.terrain}.`,
    settings.battle && /fictional/.test(settings.battle) ? `BACKDROP: ${settings.battle}. Invent a small, plausible local action on a real date within the theatre's dates, on ground typical of the theatre. The player's unit and all its people are fictional.` :
    settings.battle ? `BACKDROP: ${settings.battle}. Set the operation inside this real battle or campaign, on a real date during it, on ground typical of it. The player's unit and all its people are fictional; real commanders stay off-stage.` : era.fictionalWar ? 'BACKDROP: this war is fictional. Invent a plausible place, date and operation within the theatre.' : 'BACKDROP: choose a real campaign or battle in this theatre for the date. The player\'s unit and all its people are fictional.',
    `ECHELON: ${echelon.name}. One map square is about ${a.cellM} m; the map is ${a.gridN}×${a.gridN} squares (about ${Math.round(a.cellM * a.gridN / 100) / 10} km across). The player commands ${echelon.controls}. ${echelon.sees}`,
    `SCALE OF FORCES: friendly.units lists the player's ${unitCountsFor(echelon.id)[0]}-${unitCountsFor(echelon.id)[1]} subordinate units of size "${subs.join('" or "')}" (strength ${size.min}-${size.max} each${echelon.id === 'fireteam' ? ': each is one named soldier, strength 1' : ''}), not the player's own command element (the game adds that at friendly.hqCell). Enemy units are of comparable scale.`,
    `TIMING (minutes after the start): ${startNote} endMinutes between ${T[2]} and ${T[3]}; nltMinutes between them. Turns at this echelon are about ${echelon.tick} minutes in contact.`,
    `DIFFICULTY: ${a.difficulty.name} (${a.difficulty.blurb}).${a.difficulty.id === 'green' ? ' Intelligence is mostly honest; the enemy is a little weaker than briefed.' : a.difficulty.id === 'veteran' ? ' Thin intelligence, a capable enemy that outnumbers or outguns the player locally, scarce supply.' : ''} TONE: ${settings.tone === 'gritty' ? 'gritty (heavier, harsher)' : 'cinematic (tense, restrained)'}.`,
    `SEED (binding; build the operation around these): mission #${seed.mission.n} "${seed.mission.text}" (mission.type "${seed.mission.type}" unless another type from the list clearly fits better); complication: ${seed.complication}; the ground: ${seed.terrain}; the enemy commander: ${seed.enemyTemperament}; the player's superior: ${seed.boss}; twist: ${seed.twist}. Scale the mission to the echelon: "hold a bridge" is a squad behind a parapet or a corps forcing a river line.`,
    `AVOID these clichés: ${BANNED.join('; ')}.`
  ].join('\n');
}

const SCHEMA = `{
  "title": "a short evocative title for this operation",
  "codename": "OPERATION CODENAME in caps, e.g. IRON HARROW (a plausible codename in the army's language)",
  "setting": {
    "place": "where, e.g. 'hedgerows north-east of Carentan, Normandy'",
    "date": "YYYY-MM-DD (real, inside the allowed dates)",
    "startTime": "HH:MM (24-hour local time when play begins)",
    "latitude": 49.3,
    "weather": "a short description",
    "weatherCode": "one of clear, overcast, rain, storm, fog, snow, heat, dust, wind, cold",
    "warSoFar": "120-220 words: how the war stands, the front, the player's side, the enemy, what the player does not know yet",
    "unitHistory": "40-100 words: the unit's history and reputation, its losses, its mood",
    "historicalOutcome": "for real battles: what actually happened around this date (40-80 words); null for fictional wars"
  },
  "terrain": {
    "size": 16,
    "base": "the commonest ground: one of ${Object.keys(TERRAIN).filter(k => k !== 'water').join(', ')}",
    "features": [
      { "id": "f1", "name": "Hill 30", "type": "hill", "at": "C2", "radius": 2, "elevation": 2 },
      { "id": "f2", "name": "Bois de Rots", "type": "woods", "area": "H6:K9" },
      { "id": "f3", "name": "the Carentan road", "type": "road", "line": ["A10", "H9", "P8"] },
      { "id": "f4", "name": "the Douve", "type": "river", "line": ["A3", "P5"] },
      { "id": "f5", "name": "the stone bridge", "type": "bridge", "at": "F4" },
      { "id": "f6", "name": "Les Forges farm", "type": "farm", "at": "J7" }
    ]
  },
  "mission": {
    "type": "one of ${MISSION_TYPES.join(', ')}",
    "statement": "who, what, when, where, why, in one or two sentences",
    "higherIntent": "the higher commander's intent: purpose and end state",
    "objective": { "name": "OBJ RED (the crossroads)", "cells": ["J7"] },
    "targetUnits": ["for raid or ambush: ids of the enemy units that are the target; otherwise []"],
    "hHourMinutes": 40, "nltMinutes": 160, "endMinutes": 240,
    "constraints": ["limits on the player: boundaries, no-fire areas, timings"],
    "roe": "rules of engagement in a sentence or two",
    "controlMeasures": [ { "type": "LD", "name": "LD (the sunken lane)", "cells": ["A12", "P12"] }, { "type": "PL", "name": "PL BLUE", "cells": ["A8", "P8"] }, { "type": "TRP", "name": "TRP 01", "cells": ["J6"] } ],
    "warno": "the warning order as received: 40-90 words",
    "opord": { "situation": "enemy forces, friendly forces, attachments, civilians, weather and light", "mission": "the mission statement", "execution": "commander's intent, concept, tasks to subordinate units by name, coordinating instructions", "sustainment": "ammunition, water, food, medical and evacuation", "commandSignal": "where the commander is, call signs, frequencies or signals, succession of command" },
    "success": "what success looks like", "partial": "what a partial success looks like", "failure": "what failure looks like"
  },
  "higher": { "unit": "the higher headquarters' name", "commander": { "name": "name with rank", "callsign": "call sign", "temperament": "a few words" } },
  "friendly": {
    "unitName": "the player's unit, e.g. '2nd Squad, 1st Platoon, Easy Company, 2nd Battalion, 506th PIR'",
    "callsign": "the player's call sign",
    "hqCell": "the square of the player's own position or command post at the start",
    "units": [ { "id": "u1", "name": "1st Squad", "short": "1SQ", "callsign": "Easy One-One", "type": "infantry", "size": "squad", "strength": 11, "quality": "regular", "cell": "D13", "posture": "halted" } ],
    "leaders": [ { "id": "L1", "unit": "u1", "name": "Frank Hayes", "rank": "S/Sgt", "role": "1st Squad leader", "personality": "a few words", "voice": "how he talks", "competence": 3, "initiative": 4, "secret": "something he hides", "nickname": "or null", "hometown": "town", "detail": "one personal detail", "breakingPoint": "what would break him" } ],
    "notables": [ { "unit": "u1", "name": "Tony Russo", "role": "BAR gunner", "trait": "a few words", "nickname": "or null", "hometown": "town", "detail": "one personal detail", "breakingPoint": "what would break him" } ],
    "staff": [ { "role": "XO | S1 | S2 | S3 | S4 | FSO | Chaplain | Aide | Driver | First Sergeant | Platoon Sergeant | Forward Observer", "name": "name", "personality": "a few words", "voice": "how they talk", "opinion": "what they think of the plan", "competence": 3 } ],
    "adjacent": [ { "name": "the unit on your left", "where": "left / right / behind", "callsign": "call sign" } ],
    "support": [ { "id": "a1", "type": "mortar | artillery | naval | air | helicopter | drone | rocket | tank", "name": "E Company 60 mm mortars", "callsign": "call sign", "missions": 6, "availableFromMinutes": 0, "availableToMinutes": 600, "responseMinutes": null } ]
  },
  "enemy": {
    "description": "who they are: unit, quality, state, what they have been through",
    "commander": { "name": "name", "temperament": "a few words", "mistake": "the one mistake he will make" },
    "intent": "what the enemy is trying to do",
    "plan": "the enemy plan in 2-4 sentences, including contingencies",
    "units": [ { "id": "e1", "name": "MG 42 position", "type": "mg", "size": "team", "strength": 3, "quality": "veteran", "cell": "J7", "posture": "dug_in", "decoy": false, "reinforcement": false, "reaction": "hold | counterattack | withdraw | delay | reinforce | ambush", "fallback": "square to fall back to, or null", "orders": [ { "atMinutes": 0, "task": "defend", "target": "J7" }, { "atMinutes": 150, "task": "withdraw", "target": "N4" } ] } ]
  },
  "people": [ { "id": "c1", "name": "the Lefèvre family", "kind": "civilian | prisoner | correspondent | defector | official | ally", "cell": "J8", "count": 4, "description": "who they are", "knows": "what they know", "wants": "what they want" } ],
  "events": [ { "atMinutes": 35, "kind": "comms | weather | enemy | reinforcement | higher | civilian | fire_support | friendly | logistics | press | other", "text": "what happens, in one or two sentences, without clock times", "visible": true, "urgent": false, "effects": { } } ],
  "intel": [ { "atMinutes": 0, "source": "higher | patrol | civilian | prisoner | air recon | intercept | captured document", "reliability": "B2", "text": "the report as the player receives it", "about": "e1 or null", "cell": "J7 or null", "truthful": true } ],
  "deceptions": ["each deceptive indicator and what it really is"],
  "complications": ["each complication in a sentence"]
}`;

const EFFECTS_DOC = `Event "effects" keys (use only these; omit when none): {"comms": {"unit": "u2" or "all", "state": "down" | "intermittent" | "ok"}}, {"jamming": true}, {"weather": "fog"}, {"spawnEnemy": "e5", "spawnCell": "P3"} (for an enemy unit listed with "reinforcement": true, which stays off the map until then), {"spawnFriendly": "u5"}, {"enemyOrder": {"unit": "e2", "task": "assault", "target": "F6"}}, {"support": {"id": "a1", "available": false, "reason": "the guns are re-tasked"}}, {"nltMinutes": 200}, {"objectiveCells": ["K5"]} (a FRAGO that changes the objective), {"civilians": {"cell": "G7", "count": 12, "name": "refugees on the road"}}, {"friendlyLoss": {"unit": "u3", "count": 1, "cause": "accident"}}, {"logistics": {"item": "water", "amount": -30}}, {"standing": {"superiors": -5}}.`;

const RULES = `RULES
- Squares are written like "C4": a letter for the column (A is west, left) and a number for the row (1 is north, top). Valid columns run A to the size-th letter; rows 1 to size. Every square you write must be valid.
- terrain: 6-14 features with real names, covering the ground the fight is about: the objective, cover and dead ground, roads, water, villages, high ground. Lines (roads, rivers, hedgerows, trenches, ridges) use "line" with 2-5 squares; areas use "area" as "C3:F6" or "at" with "radius"; single places use "at".
- Friendly units start on the player's side of the map, enemy units on theirs, at least 3 squares apart unless the operation opens in contact. No two opposing units share a square.
- friendly.leaders: one named leader per subordinate unit (ids L1, L2... with "unit" set). At squad and platoon level add 2-5 notables: soldiers with a nickname, a hometown and a detail. From company up add "staff" (company: XO, First Sergeant, Forward Observer; platoon: Platoon Sergeant or Platoon Leader; battalion and up: XO, S1, S2, S3, S4, FSO, Chaplain, Aide, Driver) with personalities and opinions that disagree.
- friendly.support: the fire support this army in this era could really give this echelon (0-1 at fireteam and squad unless the player is a forward observer, 1-2 at platoon, 2-3 at company, 2-5 above). "missions" is how many fire missions the player may call.
- enemy.units: the TRUE enemy order of battle, 2-12 units, with positions, reactions and timed orders (atMinutes, task, target). Tasks: move, assault, defend, dig_in, withdraw, halt, recon, ambush, patrol, counterattack, reinforce. Include at least one reserve or counterattack force, and 1-2 decoy positions ("decoy": true, strength 0, a dummy position or a feint) or false intel.
- intel: 3-8 items the player receives over time; at least 2 deceptive indicators in total: intel with "truthful": false (a planted or mistaken report) and/or decoy units. Reliability uses the A-F source and 1-6 information grades.
- events: 4-10 timed events of friction and story: a radio failure, the weather, higher changing the plan, civilians on the road, a fire mission landing short, a correspondent, a defector, a reinforcement that is late, the enemy's moves. Use effects to make them real.
- people: civilians, prisoners, neutrals in the area (0-5 entries), with squares.
- Era accuracy everywhere: weapons, radios, units, ranks, tactics, slang. Names fit the army's nationality. Real historical figures may be mentioned at a distance only.
- Write the warning order and the five-paragraph order as the player would receive them from higher: crisp, military, in period style.
- Keep every text field tight; no padding. Output only the JSON object: no fences, no comments.`;

/** The whole operation in one reply. */
export function buildOperationPrompt(a) {
  return `You are designing the hidden ground truth of one military operation for a command game. Output ONE JSON object exactly matching the schema.\n\n${describeChoices(a)}\n${a.continuation ? `\nCONTINUATION (campaign): ${a.continuation}\n` : ''}\nSCHEMA:\n${SCHEMA}\n\n${EFFECTS_DOC}\n\n${RULES}`;
}

export const OPERATION_PARTS = [
  { id: 'setting', keys: ['title', 'codename', 'setting', 'terrain', 'mission', 'higher'], what: 'the setting, the ground and the mission' },
  { id: 'forces', keys: ['friendly', 'enemy'], what: 'the friendly and enemy forces and their people' },
  { id: 'story', keys: ['people', 'events', 'intel', 'deceptions', 'complications'], what: 'the people on the battlefield, the timed events, the intelligence and the deceptions' }
];

/** One part of the operation, for models that cannot write it all at once. */
export function buildPartPrompt(a, { part, soFar, problems = [] }) {
  const n = OPERATION_PARTS.indexOf(part) + 1;
  return `You are designing the hidden ground truth of one military operation for a command game. YOU ARE WRITING PART ${n} OF ${OPERATION_PARTS.length}: ${part.what}.\nOutput ONE JSON object with ONLY these top-level keys, each complete and final: ${part.keys.map(k => `"${k}"`).join(', ')}\n\n${describeChoices(a)}\n${a.continuation ? `\nCONTINUATION (campaign): ${a.continuation}\n` : ''}${soFar ? `\nPARTS ALREADY WRITTEN (stay consistent with them; refer to their ids and squares):\n${JSON.stringify(soFar)}\n` : ''}\nFULL SCHEMA (write only your keys):\n${SCHEMA}\n\n${EFFECTS_DOC}\n\n${RULES}${problems.length ? `\n\nYOUR PREVIOUS ATTEMPT AT THIS PART HAD PROBLEMS. Fix every one:\n- ${problems.join('\n- ')}` : ''}`;
}
