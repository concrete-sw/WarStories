// Game state: creation, logs, lookups. The state is one plain JSON object so it
// saves, exports and reloads without ceremony.

import { echelonById, difficultyById } from '../data/echelons.js';
import { eraById, theatreById, branchById } from '../data/eras.js';
import { armyById } from '../data/armies.js';
import { backgroundById } from '../data/people.js';
import { buildGrid, parseRef, refOf } from './grid.js';
import { buildForces } from './forces.js';
import { parseStart, formatHM } from './clock.js';
import { asArray, num, str, clamp, seededRandom, uid } from './util.js';

export const VERSION = 1;

/** Look up the static data a state refers to (never stored in the save). */
export function ctxOf(state) {
  const army = armyById(state.settings.armyId);
  return { army, era: eraById(state.settings.eraId), theatre: theatreById(state.settings.theatreId), echelon: echelonById(state.settings.echelonId), branch: branchById(state.settings.branchId), difficulty: difficultyById(state.settings.difficulty), background: backgroundById(state.settings.background) };
}

/**
 * settings: { eraId, theatreId, armyId, branchId, echelonId, platoonSgt, mode, difficulty, ironman, tone, dice, battle, background }
 * player: { name, hometown, age }
 */
export function newGameState({ settings, truth, player, carry = null }) {
  const era = eraById(settings.eraId); const theatre = theatreById(settings.theatreId);
  const echelon = echelonById(settings.echelonId); const army = armyById(settings.armyId);
  const seed = `${truth.codename}:${truth.setting?.date}:${Date.now()}`;
  const rnd = seededRandom(seed);
  const grid = buildGrid(truth.terrain, seed);
  const start = parseStart(truth.setting?.date, truth.setting?.startTime);
  const m = truth.mission;
  const state = {
    version: VERSION, id: uid('op'), created: new Date().toISOString(), seed,
    settings: { ...settings },
    era: { id: era.id, name: era.name, tech: era.tech }, theatre: { id: theatre?.id, name: theatre?.name, lat: theatre?.lat },
    truth, grid,
    scale: { cellM: Math.round(echelon.cellM * (echelon.gridN / grid.n)), tick: echelon.tick, maxSpan: echelon.maxSpan },
    gridOrigin: { e: 400000 + Math.floor(rnd() * 90) * 1000, n: 5400000 + Math.floor(rnd() * 90) * 1000, zone: `${31 + Math.floor(rnd() * 3)}U`, sq: ['NB', 'PA', 'FV', 'UV', 'MB'][Math.floor(rnd() * 5)], sheet: `${50 + Math.floor(rnd() * 20)}${'abcd'[Math.floor(rnd() * 4)]}` },
    setting: { latitude: truth.setting?.latitude ?? theatre?.lat ?? 45, place: truth.setting?.place || '', weather: truth.setting?.weatherCode || 'clear', weatherText: truth.setting?.weather || '' },
    clock: { start, minutes: 0 },
    mission: {
      type: m.type, hHour: m.hHourMinutes, nlt: m.nltMinutes, end: m.endMinutes, name: m.objective.name,
      objectiveCells: asArray(m.objective.cells).map(x => parseRef(grid.n, x)).filter(x => x >= 0), targetUnits: asArray(m.targetUnits),
      status: 'pending', securedAt: null, heldTicks: 0, lostAt: null
    },
    phase: 'planning',
    controlMeasures: asArray(m.controlMeasures).map(c => ({ ...c, cells: asArray(c.cells).map(x => parseRef(grid.n, x)).filter(x => x >= 0) })).filter(c => c.cells.length),
    picture: { contacts: {} },
    fires: { assets: [], missions: [], nextId: 1 },
    logistics: { water: 85, food: 80, medical: 90, fuel: 90, batteries: 95, requests: [] },
    radio: { log: [], nets: [] },
    intelLog: [], log: [], history: [], summary: '',
    journal: { facts: [], notes: '' }, letters: [], decisions: [], trace: [], reports: [],
    stats: { friendlyKIA: 0, friendlyWIA: 0, friendlyMIA: 0, enemyKIA: 0, enemyWIA: 0, prisoners: 0, civilianCasualties: 0, firesCalled: 0, fratricide: 0, ordersIssued: 0, misreads: 0, reportsSent: 0, goodReports: 0, medevacs: 0, medevacGood: 0, hints: 0 },
    conduct: { prisonersTaken: 0, prisonersMistreated: 0, civiliansHarmed: 0, unlawful: [] },
    standing: { superiors: 60, troops: 62, staff: 60, political: 55 },
    planning: { warno: false, recon: false, rehearsal: false, opord: false, intent: '', quality: 0 },
    eventsFired: [], intelDelivered: [], pending: [],
    lastChoices: [], turnCount: 0, ended: null, aar: null, contactMoment: null,
    nextReportAt: echelon.reportEvery || null, flags: [],
    campaign: carry?.campaign || { mode: settings.mode, index: 1, total: settings.mode === 'campaign' ? clamp(Math.round(num(settings.campaignLength, 5)), 4, 8) : settings.mode === 'career' ? null : 1, ops: [], wall: [], record: { awards: [], promotions: [], evaluations: [], wounds: [], battles: [] }, careerPoints: 0, lettersReceived: [] }
  };
  buildForces(state, { army, era, echelon, player: { ...player, backgroundName: backgroundById(settings.background)?.name }, rnd });
  for (const x of asArray(truth.friendly?.staff)) delete x._used;
  for (const x of asArray(truth.friendly?.notables)) delete x._used;
  if (carry) applyCarry(state, carry);
  setupFires(state, era, army, rnd);
  setupNets(state, echelon, army);
  state.weatherNow = state.setting.weather;
  // Higher's control measures that name the objective are the objective.
  if (!state.mission.objectiveCells.length) { const obj = state.controlMeasures.find(c => c.type === 'OBJ'); if (obj) state.mission.objectiveCells = obj.cells; }
  // Defensive missions begin dug in where the scenario says, with the enemy attack at H-hour.
  if (['defend', 'hold', 'delay'].includes(state.mission.type)) for (const u of friendlyUnits(state)) if (u.posture === 'halted' && rnd() < 0.5) u.posture = 'cover';
  if (echelon.tier >= 4) state.standing.staff = 60;
  return state;
}

/** Campaign carry-over: the people who survived the last operation come with you. */
function applyCarry(state, carry) {
  const p0 = state.people.p0;
  if (carry.player) { Object.assign(p0, { serviceNumber: carry.player.serviceNumber || p0.serviceNumber, awards: carry.player.awards || [], kills: carry.player.kills || 0, stress: clamp(num(carry.player.stress, 20) - 10, 5, 90), age: carry.player.age || p0.age, hometown: carry.player.hometown || p0.hometown }); }
  if (carry.standing) state.standing = { ...state.standing, ...carry.standing, superiors: clamp(num(carry.standing.superiors, 60), 25, 90) };
  // Veterans of the last operation take the places of the generated soldiers of the same unit slot, keeping their names and histories.
  if (Array.isArray(carry.veterans) && carry.sameCommand) {
    const slots = Object.values(state.people).filter(p => !p.isPlayer && !p.staffRole);
    let k = 0;
    for (const v of carry.veterans) {
      const slot = slots[k++]; if (!slot) break;
      Object.assign(slot, { name: v.name, first: v.first, last: v.last, nickname: v.nickname, hometown: v.hometown, detail: v.detail, trait: v.trait, breakingPoint: v.breakingPoint, age: v.age, kills: v.kills || 0, awards: v.awards || [], said: [], veteran: true, morale: clamp(num(v.morale, 60), 30, 85), personality: v.personality || slot.personality, voice: v.voice || slot.voice, rank: v.rank || slot.rank });
    }
    // Everyone else is a replacement: a stranger nobody knows yet.
    for (; k < slots.length; k++) { const slot = slots[k]; if (slot.leader && slot.notable) continue; slot.replacement = true; slot.morale = Math.min(slot.morale, 55); }
  }
}

function setupFires(state, era, army, rnd) {
  const fireTimes = era.fire || {};
  const t = state.truth;
  for (const a of asArray(t.friendly.support)) {
    const base = fireTimes[a.type] ?? fireTimes.artillery ?? 10;
    state.fires.assets.push({ ...a, response: a.responseMinutes || Math.max(1, Math.round(base * (0.8 + rnd() * 0.4))), left: a.missions, used: 0 });
  }
  // Every echelon from platoon up with an army that has mortars gets something to call, if the scenario forgot.
  if (!state.fires.assets.length && state.settings.echelonId !== 'fireteam' && (army.support || []).includes('mortar')) {
    state.fires.assets.push({ id: 'a1', type: 'mortar', name: 'company mortars', callsign: null, missions: 4, left: 4, used: 0, availableFromMinutes: 0, availableToMinutes: 1e7, response: fireTimes.mortar || 6 });
  }
}

export function setupNets(state, echelon, army) {
  const r = army.radios || {};
  const tier = echelon.tier;
  const nets = [];
  const voice = tier <= 1 && !r.squad;
  nets.push({ id: 'own', name: tier <= 1 ? (voice ? 'Voice and hand signals' : 'Squad net') : `${echelon.short} net`, kind: tier <= 1 && voice ? 'voice' : 'radio' });
  const up = tier <= 1 ? r.platoon : tier === 2 ? r.company : r.battalion;
  nets.push({ id: 'higher', name: tier <= 1 ? 'Platoon (runner or handset)' : 'Higher command net', kind: up ? 'radio' : 'runner', via: up || 'runner' });
  if (state.fires.assets.length) nets.push({ id: 'fires', name: 'Fires', kind: 'radio' });
  nets.push({ id: 'medevac', name: state.era.tech >= 4 ? 'MEDEVAC' : 'Casualty evacuation', kind: state.era.tech >= 3 ? 'radio' : 'runner' });
  if (tier >= 4) nets.push({ id: 'admin', name: 'Admin and logistics', kind: 'radio' });
  state.radio.nets = nets;
}

// ------------------------------------------------------------- lookups
export const unitsOf = (state, side) => Object.values(state.units).filter(u => u.side === side);
export const friendlyUnits = state => unitsOf(state, 'friendly');
export const enemyUnits = state => unitsOf(state, 'enemy');
export const liveUnit = u => u && !u.destroyed && !u.surrendered && !u.dormant && (u.strength > 0 || u.decoy);
export const getUnit = (state, id) => state.units[id] || null;
export const getPerson = (state, id) => state.people[id] || null;
export const player = state => state.people[state.playerId];
export const playerUnit = state => state.units.u0;
export const ref = (state, idx) => refOf(state.grid.n, idx);
export const membersOf = (state, u) => (u?.members || []).map(id => state.people[id]).filter(Boolean);
export const activeMembers = (state, u) => membersOf(state, u).filter(p => p.status === 'ok' || (p.status === 'wia' && p.wound?.severity === 'light'));

export function personLabel(state, p) {
  if (!p) return '';
  return `${p.rank ? p.rank + ' ' : ''}${p.name}${p.nickname ? ` "${p.nickname}"` : ''}`;
}

// ------------------------------------------------------------- logs
export function addLog(state, kind, text, speaker = 'narrator', extra = {}) {
  if (text == null || text === '') return null;
  const e = { id: uid('l'), at: state.clock.minutes, turn: state.turnCount, kind, text: String(text), speaker, ...extra };
  state.log.push(e);
  if (state.log.length > 600) state.log.splice(0, state.log.length - 600);
  return e;
}

export function addFact(state, text, source = 'gm') {
  const t = str(text).trim(); if (!t) return false;
  if (state.journal.facts.some(f => f.text.toLowerCase() === t.toLowerCase())) return false;
  state.journal.facts.push({ at: state.clock.minutes, text: t, source });
  if (state.journal.facts.length > 200) state.journal.facts.shift();
  return true;
}

/** A radio (or runner, or shouted) message. garble: 0..1 of words lost. */
export function addRadio(state, { net = 'own', from, to, text, garble = 0, dir = 'in', template = null, noAck = false }) {
  const msg = { id: uid('r'), at: state.clock.minutes, net, from: str(from), to: str(to), text: garble > 0 ? garbleText(String(text), garble) : String(text), clean: String(text), garbled: garble > 0, dir, template, noAck };
  state.radio.log.push(msg);
  if (state.radio.log.length > 300) state.radio.log.shift();
  return msg;
}

export function garbleText(text, amount, rnd = Math.random) {
  return text.split(/(\s+)/).map(w => (/\S/.test(w) && rnd() < amount ? (rnd() < 0.5 ? '…' : '—static—') : w)).join('').replace(/(…\s*){2,}/g, '… ').replace(/(—static—\s*){2,}/g, '—static— ');
}

export function addDecision(state, text, kind = 'order') { state.decisions.push({ at: state.clock.minutes, turn: state.turnCount, text: str(text).slice(0, 220), kind }); if (state.decisions.length > 300) state.decisions.shift(); }

export function addIntelItem(state, item) {
  const it = { id: item.id || uid('in'), at: state.clock.minutes, source: item.source || 'report', reliability: item.reliability || 'C3', text: str(item.text), cell: item.cell ?? null, about: item.about || null, truthful: item.truthful !== false, kind: item.kind || 'report' };
  state.intelLog.push(it);
  if (state.intelLog.length > 300) state.intelLog.shift();
  return it;
}

export function nowLabel(state) { return formatHM(state); }

/** Fill in fields older saves lack. */
export function migrateState(s) {
  s.flags = s.flags || []; s.reports = s.reports || []; s.pending = s.pending || [];
  s.standing = s.standing || { superiors: 60, troops: 60, staff: 60, political: 55 };
  s.campaign = s.campaign || { mode: s.settings?.mode || 'single', index: 1, total: 1, ops: [], wall: [], record: { awards: [], promotions: [], evaluations: [], wounds: [], battles: [] }, careerPoints: 0, lettersReceived: [] };
  return s;
}
