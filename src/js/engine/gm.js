// The Game Master turn loop. The code resolves everything first (orders, the
// clock, movement, fire, casualties, events), then the GM narrates inside those
// results, voices everyone, and proposes soft changes (moods, facts, orders it
// understood, intelligence from conversation), which are validated before
// anything is applied.

import { GM_SYSTEM_PROMPT, eraPack } from '../prompts/gmSystem.js';
import { buildSummaryPrompt } from '../prompts/summary.js';
import { extractJSON, extractPartialNarrative, looksTruncated } from './json.js';
import { complete, completeWithMeta } from '../providers/index.js';
import { clamp, asArray, num, str } from './util.js';
import { simulate, simCtx, newReport, continueSpan, typeWord } from './sim.js';
import { parseOrders, issueOrder, orderQuality, orderText, TASK_LABEL, findGridRef } from './orders.js';
import { requestFire, callForFireQuality, announceFire } from './fires.js';
import { requestSupply, redistributeAmmo, averageAmmo } from './logistics.js';
import { evaluateMission, strengthPct } from './objectives.js';
import { addLog, addFact, addRadio, addIntelItem, addDecision, friendlyUnits, enemyUnits, liveUnit, membersOf, personLabel, ctxOf } from './state.js';
import { refOf, parseRef, distance, describeCell, neighbours } from './grid.js';
import { formatHM, formatDate, formatStamp, relH, lightAt, formatDuration } from './clock.js';
import { normTask } from './schema.js';
import { woundPerson } from './casualties.js';
import { WEATHER } from '../data/terrain.js';

const RECENT_TURNS = 8;
const SUMMARIZE_AFTER = 16;

const moraleWord = m => (m >= 75 ? 'high' : m >= 55 ? 'steady' : m >= 35 ? 'shaken' : m >= 18 ? 'breaking' : 'broken');

/** Minutes a short action takes at this echelon (a word with someone, a radio call). */
export function shortMinutes(state, f = 0.5) { return clamp(Math.round(state.scale.tick * f), 1, 120); }

/** Visible state the GM is given each turn. Compact on purpose. */
export function buildSnapshot(state, ctx) {
  const n = state.grid.n; const now = state.clock.minutes; const p = state.people.p0; const u0 = state.units.u0;
  const named = ctx.echelon.namedCasualties === true;
  const fr = friendlyUnits(state).filter(u => !u.dormant).map(u => {
    const L = state.people[u.leaderId];
    const reported = u.reported?.cell ?? u.cell;
    return {
      id: u.id, name: u.name, callsign: u.callsign, type: u.type, size: u.size, square: refOf(n, u.cell), reportedSquare: reported !== u.cell ? refOf(n, reported) : undefined,
      strength: `${u.strength}/${u.start}`, morale: moraleWord(u.morale), suppressed: u.suppression >= 60 ? 'pinned' : u.suppression >= 30 ? 'under fire' : undefined, ammo: `${Math.round(u.ammo)}%`, posture: u.posture,
      order: orderText(state, u), radio: u.radio !== 'ok' ? u.radio : undefined, lost: u.lost || undefined, leader: L ? { id: L.id, name: personLabel(state, L), mood: L.mood, status: L.status !== 'ok' ? L.status : undefined } : null,
      vehicles: u.vehicles ? `${u.vehicles}/${u.vehiclesStart}` : undefined, status: u.destroyed ? 'destroyed' : u.surrendered ? 'captured' : u.posture === 'broken' ? 'broken' : undefined
    };
  });
  const peopleList = Object.values(state.people).filter(x => !x.isPlayer && (x.leader || x.notable || x.staffRole || x.status !== 'ok' || x.said.length)).slice(0, named ? 40 : 30).map(x => ({ id: x.id, name: personLabel(state, x), role: x.role, unit: x.unitId, status: x.status === 'wia' ? `wounded (${x.wound?.severity}, ${x.wound?.part})` : x.status, mood: x.mood, trait: x.trait, personality: x.personality || undefined, said: x.said.slice(-2).map(s => s.text) }));
  const contacts = Object.values(state.picture.contacts).filter(c => !c.cleared).map(c => ({ id: c.id, square: refOf(n, c.cell), confidence: c.confidence, ageMinutes: now - c.at, size: c.size, type: c.type, source: c.source }));
  const wounded = Object.values(state.people).filter(x => x.status === 'wia').map(x => `${personLabel(state, x)} (${x.wound?.severity})`);
  const dead = state.campaign.wall.filter(w => w.op === state.truth.codename).map(w => `${w.rank} ${w.name}`);
  return {
    time: formatHM(state), date: formatDate(state), fromHHour: relH(state), phase: state.phase, light: lightAt(state).label, weather: (WEATHER[state.weatherNow] || WEATHER.clear).name,
    echelon: ctx.echelon.name, mapSquare: `${state.scale.cellM} m`,
    player: { id: 'p0', name: personLabel(state, p), role: p.role, square: refOf(n, u0.cell), condition: p.status === 'ok' ? 'unhurt' : `wounded (${p.wound?.severity}, ${p.wound?.part})`, fatigue: Math.round(p.fatigue), stress: Math.round(p.stress || 0), withUnit: state.playerWith || undefined },
    standing: state.standing,
    mission: { name: state.mission.name, type: state.mission.type, objective: state.mission.objectiveCells.map(c => refOf(n, c)), hHour: formatHM(state, state.mission.hHour), nlt: formatHM(state, state.mission.nlt), ends: formatHM(state, state.mission.end), status: state.mission.status, statusText: state.mission.statusText || undefined, intent: state.planning.intent || undefined },
    planning: { warningOrderIssued: state.planning.warno, leadersRecon: state.planning.recon, rehearsed: state.planning.rehearsal, ordersIssued: state.planning.opord },
    units: fr, hq: membersOf(state, u0).filter(x => !x.isPlayer).map(x => ({ id: x.id, name: personLabel(state, x), role: x.role, status: x.status, mood: x.mood, opinion: x.opinion || undefined })),
    people: peopleList,
    contacts, controlMeasures: state.controlMeasures.filter(c => c.from === 'player').map(c => ({ type: c.type, name: c.name, squares: c.cells.map(x => refOf(n, x)) })),
    fireSupport: state.fires.assets.map(a => ({ id: a.id, name: a.name, type: a.type, missionsLeft: a.left, responseMin: a.response })),
    pendingFire: state.fires.missions.filter(m => m.status === 'pending' && m.side === 'friendly').map(m => ({ on: refOf(n, m.cell), arrivesIn: m.impactAt - now })),
    supply: { water: Math.round(state.logistics.water), food: Math.round(state.logistics.food), medical: Math.round(state.logistics.medical), batteries: Math.round(state.logistics.batteries), fuel: friendlyUnits(state).some(u => u.vehicles) ? Math.round(state.logistics.fuel) : undefined, averageAmmo: averageAmmo(state) },
    losses: { kia: state.stats.friendlyKIA, wia: state.stats.friendlyWIA, mia: state.stats.friendlyMIA, deadByName: dead.slice(-10), woundedByName: wounded.slice(-10) },
    enemyLosses: { kia: state.stats.enemyKIA, wia: state.stats.enemyWIA, prisoners: state.stats.prisoners },
    civiliansNearby: asArray(state.truth.people).filter(c => c.cell && parseRef(n, c.cell) >= 0 && friendlyUnits(state).some(u => distance(n, u.cell, parseRef(n, c.cell)) <= 3)).map(c => ({ id: c.id, name: c.name, kind: c.kind, square: c.cell })),
    recentRadio: state.radio.log.slice(-5).map(r => `${formatHM(state, r.at)} ${r.from}→${r.to}: ${r.text}`),
    facts: state.journal.facts.slice(-15).map(f => f.text), flags: state.flags, conduct: state.conduct.unlawful.length ? state.conduct : undefined, turn: state.turnCount
  };
}

function truthForGM(state) {
  const t = { ...state.truth };
  return t;
}

// ------------------------------------------------------------------ pre-resolution
/**
 * Everything the code decides before the GM speaks. Mutates state.
 * Returns { minutes, stopOnInterrupt, notes: [], issued: [], unparsed: [], fire, ... }.
 */
export function preResolve(state, action, ctx) {
  const pre = { minutes: 0, stopOnInterrupt: false, notes: [], issued: [], unparsed: [], fire: null, kind: action.type };
  const now = state.clock.minutes; const n = state.grid.n; const ech = ctx.echelon;
  const execTick = state.phase === 'planning' ? Math.max(5, Math.round(state.scale.tick * (ech.tier >= 4 ? 0.5 : 1))) : state.scale.tick;
  const late = action.type === 'contact' && action.late;
  const issueFromText = (text, extraDelay = 0) => {
    const parsed = parseOrders(state, text);
    const intent = /\b(in order to|so that|intent|purpose)\b/i.test(text) ? text.slice(0, 220) : '';
    for (const o of parsed.orders) for (const uid of o.unitIds) {
      const r = issueOrder(state, uid, { task: o.task, cell: o.cell, how: o.how, clause: o.clause, quality: o.quality, intent }, ctx);
      if (r) { if (extraDelay) { r.order.startAt += extraDelay; r.order.status = 'pending'; r.delay += extraDelay; } pre.issued.push(r); }
    }
    if (/\b(hold (your )?fire|cease fire|check (your )?fire|don'?t shoot|weapons tight)\b/i.test(text)) { for (const u of friendlyUnits(state)) u.holdFire = true; pre.notes.push('HOLD FIRE given: units fire only if fired upon.'); }
    if (/\b(open fire|weapons free|fire at will)\b/i.test(text)) { for (const u of friendlyUnits(state)) u.holdFire = false; pre.notes.push('Weapons free.'); }
    if (parsed.fire) {
      const q = clamp(0.35 + (/\b(adjust|fire for effect|ffe|over)\b/i.test(text) ? 0.15 : 0) + (/\b[A-T]\d{1,2}\b/.test(parsed.fire.clause) ? 0.2 : 0) + (/\b(infantry|mg|machine gun|tanks?|bunker|trench|position|troops|vehicles?)\b/i.test(parsed.fire.clause) ? 0.1 : 0), 0, 1);
      const r = requestFire(state, { cell: parsed.fire.cell, assetType: parsed.fire.assetType, kind: parsed.fire.kind, method: parsed.fire.method, quality: q }, ctx);
      pre.fire = { ...r, how: parsed.fire.how };
      if (r.ok) announceFire(state, r);
      addDecision(state, `Fire mission on ${refOf(n, parsed.fire.cell)}${r.ok ? '' : ` (refused: ${r.reason})`}`, 'fire');
    }
    pre.unparsed.push(...parsed.unparsed);
    return parsed;
  };
  switch (action.type) {
    case 'opening': pre.minutes = 0; break;
    case 'contact':
      if (late) { pre.notes.push('The player hesitated: the men reacted by training first (took cover and returned fire); the player\'s orders land one beat late.'); for (const u of friendlyUnits(state)) if (liveUnit(u) && now - u.engagedAt <= state.scale.tick) u.posture = u.posture === 'dug_in' ? 'dug_in' : 'cover'; }
      issueFromText(action.text || '', late ? state.scale.tick : 0);
      pre.minutes = state.scale.tick; break;
    case 'free': case 'choice': case 'orders':
      issueFromText(action.text || '');
      if (/\b(warning order|warno)\b/i.test(action.text || '') && state.phase === 'planning' && !state.planning.warno) { state.planning.warno = true; pre.notes.push('Warning order issued (counts as the planning step).'); }
      pre.minutes = execTick; break;
    case 'continue': pre.minutes = continueSpan(state, ctx); pre.stopOnInterrupt = true; break;
    case 'wait': pre.minutes = clamp(Math.round(num(action.minutes, state.scale.tick)), 1, state.scale.maxSpan * 2); pre.stopOnInterrupt = true; break;
    case 'talk': pre.minutes = shortMinutes(state, 0.5); break;
    case 'staff': pre.minutes = clamp(Math.round(state.scale.tick * 0.5), 15, 180); break;
    case 'checkmen': {
      pre.minutes = shortMinutes(state, 0.6);
      const hq = state.units.u0;
      for (const u of friendlyUnits(state)) if (liveUnit(u) && distance(n, u.cell, hq.cell) <= 2) { u.morale = clamp(u.morale + 4, 0, 100); for (const p of membersOf(state, u)) if (p.status === 'ok') p.morale = clamp(p.morale + 3, 0, 100); }
      state.standing.troops = clamp(state.standing.troops + 1, 0, 100);
      break;
    }
    case 'hint': pre.minutes = shortMinutes(state, 0.3); state.stats.hints += 1; state.standing.superiors = clamp(state.standing.superiors - 2, 0, 100); break;
    case 'radio': {
      pre.minutes = shortMinutes(state, 0.5);
      const f = action.fields || {};
      pre.radio = { template: action.template, fields: f, text: action.text || '' };
      const tpl = action.template;
      if (tpl === 'salute') {
        const cell = findGridRef(n, f.location || '');
        const real = enemyUnits(state).find(e => liveUnit(e) && !e.decoy && cell >= 0 && distance(n, e.cell, cell) <= 1.5);
        const filled = ['size', 'activity', 'location', 'unit', 'time', 'equipment'].filter(k => str(f[k]).trim()).length;
        pre.radio.quality = filled / 6; pre.radio.accurate = !!real;
        state.stats.reportsSent += 1;
        if (filled >= 5 && real) { state.stats.goodReports += 1; state.standing.superiors = clamp(state.standing.superiors + 2, 0, 100); }
        else if (filled < 3) state.standing.superiors = clamp(state.standing.superiors - 1, 0, 100);
        addRadio(state, { net: 'higher', from: state.units.u0.callsign, to: state.truth.higher?.commander?.callsign || 'Higher', text: `SPOT REPORT. Size: ${f.size || '—'}. Activity: ${f.activity || '—'}. Location: ${f.location || '—'}. Unit: ${f.unit || '—'}. Time: ${f.time || formatHM(state)}. Equipment: ${f.equipment || '—'}. Over.`, dir: 'out', template: 'SALUTE' });
      } else if (tpl === 'sitrep') {
        state.stats.reportsSent += 1;
        const filled = ['location', 'status', 'enemy', 'actions', 'needs'].filter(k => str(f[k]).trim()).length;
        pre.radio.quality = filled / 5;
        if (filled >= 4) { state.stats.goodReports += 1; state.standing.superiors = clamp(state.standing.superiors + 2, 0, 100); }
        addRadio(state, { net: 'higher', from: state.units.u0.callsign, to: state.truth.higher?.commander?.callsign || 'Higher', text: `SITREP. Location: ${f.location || '—'}. Status: ${f.status || '—'}. Enemy: ${f.enemy || '—'}. Actions: ${f.actions || '—'}. Needs: ${f.needs || '—'}. Over.`, dir: 'out', template: 'SITREP' });
      } else if (tpl === 'medevac') {
        const filled = ['l1', 'l2', 'l3', 'l4', 'l5', 'l6', 'l7', 'l8', 'l9'].filter(k => str(f[k]).trim()).length;
        const q = filled / 9; pre.radio.quality = q;
        const loc = findGridRef(n, f.l1 || '');
        const wounded = Object.values(state.people).filter(p => p.status === 'wia' && !p.wound?.evacuatedAt);
        const base = ctx.era.tech >= 4 ? 35 : ctx.era.tech >= 3 ? 60 : 90;
        const eta = Math.round(base * (q >= 0.8 ? 0.8 : q >= 0.5 ? 1 : 1.5) * (loc >= 0 ? 1 : 1.4));
        for (const p of wounded) { p.wound.medevacAsked = true; p.wound.evacAt = Math.min(p.wound.evacAt ?? Infinity, now + eta); }
        state.stats.medevacs += 1; if (q >= 0.8 && loc >= 0) state.stats.medevacGood += 1;
        pre.radio.eta = eta; pre.radio.patients = wounded.length;
        addRadio(state, { net: 'medevac', from: state.units.u0.callsign, to: ctx.era.tech >= 4 ? 'Dustoff' : 'Aid station', text: `${ctx.era.tech >= 4 ? 'MEDEVAC request' : 'Request stretcher-bearers and evacuation'}. Line 1: ${f.l1 || '—'}. Line 2: ${f.l2 || '—'}. Line 3: ${f.l3 || '—'}. Line 4: ${f.l4 || '—'}. Line 5: ${f.l5 || '—'}. Line 6: ${f.l6 || '—'}. Line 7: ${f.l7 || '—'}. Line 8: ${f.l8 || '—'}. Line 9: ${f.l9 || '—'}. Over.`, dir: 'out', template: '9-LINE' });
      } else if (tpl === 'cff') {
        const cell = findGridRef(n, f.location || '');
        const q = callForFireQuality(state, { observer: f.observer, warning: f.warning, cell, description: f.description, method: f.method, control: f.control });
        const r = requestFire(state, { cell, assetId: f.assetId || null, kind: /smoke/i.test(f.method || f.description || '') ? 'smoke' : /illum/i.test(f.method || f.description || '') ? 'illum' : 'HE', method: /effect/i.test(f.warning || '') ? 'ffe' : 'adjust', quality: q }, ctx);
        pre.fire = { ...r, how: refOf(n, cell) }; pre.radio.quality = q;
        if (r.ok) announceFire(state, r);
        addRadio(state, { net: 'fires', from: f.observer || state.units.u0.callsign, to: r.asset?.callsign || 'Fire direction', text: `${f.warning || 'Adjust fire'}, over. Grid ${f.location || '—'}, over. ${f.description || 'target'}, ${f.method || ''}, over.`, dir: 'out', template: 'CALL FOR FIRE' });
        addDecision(state, `Call for fire on ${f.location || '?'}${r.ok ? '' : ` (refused: ${r.reason})`}`, 'fire');
      } else if (tpl === 'resupply') {
        const r = requestSupply(state, f.item || 'ammo', ctx);
        pre.radio.supply = r;
        addRadio(state, { net: ctx.echelon.tier >= 4 ? 'admin' : 'higher', from: state.units.u0.callsign, to: 'Higher', text: `Request resupply: ${f.item || 'ammunition'}${f.note ? `, ${f.note}` : ''}. Over.`, dir: 'out', template: 'RESUPPLY' });
      } else {
        addRadio(state, { net: action.net || 'own', from: state.units.u0.callsign, to: action.to || 'all stations', text: action.text || '', dir: 'out' });
        issueFromText(action.text || '');
      }
      break;
    }
    case 'planning': {
      const [lo, hi] = ech.planningMinutes;
      const step = action.step;
      const bg = state.settings.background === 'staff' ? 0.8 : 1;
      if (step === 'warno') { pre.minutes = Math.round(lo * 0.25 * bg); state.planning.warno = true; for (const u of friendlyUnits(state)) u.morale = clamp(u.morale + 2, 0, 100); }
      else if (step === 'recon') {
        pre.minutes = Math.round(lo * 0.8 * bg);
        state.planning.recon = true;
        const obj = state.mission.objectiveCells;
        let found = 0;
        for (const e of enemyUnits(state)) if (liveUnit(e) && !e.dormant && obj.some(c => distance(n, c, e.cell) <= 3) && ctx.rnd() < 0.5) { const cell = ctx.rnd() < 0.6 ? e.cell : neighbours(n, e.cell)[0]; state.picture.contacts[e.id] = state.picture.contacts[e.id] || { id: e.id, cell, at: now, confidence: 'possible', size: Math.round((e.fakeStrength || e.strength) * (0.6 + ctx.rnd() * 0.8)), type: ctx.rnd() < 0.5 ? e.type : 'unknown', source: 'leader\'s reconnaissance', firstAt: now }; found++; }
        pre.notes.push(`Leader's reconnaissance: ${found ? `${found} possible enemy position${found > 1 ? 's' : ''} marked on the map` : 'nothing definite seen'}.`);
        // Going forward to look is not free.
        if (ctx.rnd() < 0.08 * ech.playerRisk * (ctx.difficulty.id === 'veteran' ? 1.5 : 1)) { const r = woundPerson(state, state.people.p0, ctx, 'sniper on the reconnaissance', 'light'); pre.notes.push(`On the reconnaissance the player was hit: ${r.severity} wound to the ${r.part}.`); pre.reconHit = r; }
      } else if (step === 'rehearsal') { pre.minutes = Math.round(lo * 0.8 * bg); state.planning.rehearsal = true; for (const u of friendlyUnits(state)) { u.morale = clamp(u.morale + 3, 0, 100); u.fatigue = clamp(u.fatigue + 5, 0, 100); } }
      else if (step === 'opord') {
        pre.minutes = Math.round(lo * 0.5 * bg);
        const f = action.fields || {};
        const filled = ['situation', 'mission', 'execution', 'sustainment', 'command'].filter(k => str(f[k]).trim().length > 8).length;
        state.planning.opord = true; state.planning.quality = filled / 5 + (str(f.intent).length > 15 ? 0.4 : 0);
        if (str(f.intent).trim()) state.planning.intent = str(f.intent).trim().slice(0, 300);
        state.planning.opordText = f;
        pre.notes.push(`Orders group held. Quality of the order: ${filled}/5 paragraphs${state.planning.intent ? ', with a clear intent' : ', no commander\'s intent given'}.`);
        if (str(f.execution).trim()) issueFromText(f.execution);
      } else if (step === 'execute') {
        pre.minutes = 1;
        if (state.phase === 'planning') { state.mission.hHour = now + 1; pre.notes.push('The player moved H-hour up: the attack starts now, earlier than higher\'s timeline. Adjacent units and supporting fires may not be ready.'); state.standing.superiors = clamp(state.standing.superiors - 1, 0, 100); }
      }
      addDecision(state, `Planning: ${step}`, 'planning');
      break;
    }
    case 'rest': {
      const hq = state.units.u0;
      if (Object.values(state.units).some(u => u.side === 'friendly' && liveUnit(u) && now - u.engagedAt <= state.scale.tick * 2)) { pre.notes.push('The player tried to rest but the unit is in contact; no rest was possible.'); pre.minutes = shortMinutes(state, 0.3); break; }
      pre.minutes = clamp(Math.round(num(action.hours, 2) * 60), 30, 720); pre.stopOnInterrupt = true; pre.resting = true; state.resting = true;
      pre.notes.push(`The player hands over to ${ctx.echelon.tier >= 2 ? 'the second in command' : 'the senior team leader'} and sleeps.`);
      void hq; break;
    }
    case 'visit': {
      const u = state.units[action.unitId];
      if (!u) break;
      const d = distance(n, state.units.u0.cell, u.cell) * state.scale.cellM / 1000;
      pre.minutes = clamp(Math.round(d / (ctx.era.tech >= 2 ? 25 : 6) * 60 + 20), 10, 600);
      state.playerWith = u.id; pre.visit = u.id;
      pre.notes.push(`The player goes forward to ${u.name} at ${refOf(n, u.cell)} (${formatDuration(pre.minutes)} on the road). Narrate the visit at squad scale: the ground truth, up close.`);
      for (const e of enemyUnits(state)) if (liveUnit(e) && !e.dormant && distance(n, e.cell, u.cell) <= 2.5) { state.picture.contacts[e.id] = { id: e.id, cell: e.cell, at: now + pre.minutes, confidence: e.decoy ? 'possible' : 'confirmed', size: e.decoy ? (e.fakeStrength || 5) : e.strength, type: e.type, source: 'your own eyes', firstAt: now, cleared: e.decoy ? false : undefined }; }
      u.reported = { cell: u.cell, at: now };
      u.morale = clamp(u.morale + 8, 0, 100);
      state.standing.troops = clamp(state.standing.troops + 2, 0, 100);
      addDecision(state, `Went forward to ${u.name}`, 'visit');
      break;
    }
    case 'return': { pre.minutes = clamp(Math.round(state.scale.tick * 0.3), 10, 300); state.playerWith = null; pre.notes.push('The player returns to the command post.'); break; }
    case 'consolidate': {
      pre.minutes = Math.max(5, state.scale.tick * 2);
      const avg = redistributeAmmo(state);
      for (const u of friendlyUnits(state)) if (liveUnit(u) && !u.isHQ && u.posture !== 'broken' && (!u.order || u.order.status !== 'active')) { u.order = null; issueOrder(state, u.id, { task: 'dig_in', cell: u.cell, clause: 'consolidate' }, ctx); }
      for (const p of Object.values(state.people)) if (p.status === 'wia' && p.wound?.severity === 'serious' && !p.wound.evacuatedAt) p.wound.evacAt = Math.min(p.wound.evacAt ?? Infinity, now + Math.round((ctx.era.medicine?.goldenHour || 120) * 0.5));
      if (state.phase === 'execution' && state.mission.securedAt != null) state.phase = 'consolidation';
      pre.notes.push(`Consolidation: ammunition redistributed (average now ${avg}%), everyone digging in, casualties moving back to the aid post.`);
      addDecision(state, 'Consolidated: redistributed ammunition, dug in, evacuated casualties', 'consolidate');
      break;
    }
    case 'end': pre.minutes = 0; pre.endRequested = true; break;
    default: issueFromText(action.text || ''); pre.minutes = execTick;
  }
  return pre;
}

// ------------------------------------------------------------------ action text
export function describeAction(state, action, pre, report, ctx) {
  const n = state.grid.n; const L = [];
  const words = str(action.text).trim();
  const head = `${formatHM(state)} · ${formatDate(state)} · ${relH(state)} · ${state.phase.toUpperCase()} · ${lightAt(state).label} · ${(WEATHER[state.weatherNow] || WEATHER.clear).name}`;
  const p = state.people.p0;
  if (action.type === 'opening') {
    L.push(`[OPENING · ${head}] This is the first scene. The player has read the briefing (the war so far, the unit, the roster, the warning order) on screen; do not read it back. Open at ${refOf(n, state.units.u0.cell)} (${describeCell(state, state.units.u0.cell)}) with pressure already in it, in the middle of something: the warning order has just arrived, or the men are waiting at the line of departure, or the enemy is already close, as the truth's timeline says (H-hour is at ${formatHM(state, state.mission.hHour)}). Bring in 2-3 of the player's people by name, with their own voices, at least one disagreeing. ${ctx.echelon.tier >= 4 ? 'At this echelon the scene is a headquarters: staff, maps, phones, a decision that cannot wait.' : ''} End at the first decision. 150-280 words. Offer 2-4 choices.`);
    return L.join('\n');
  }
  const verb = { contact: 'REACTION TO CONTACT', free: 'ORDERS / ACTION', choice: 'ORDERS / ACTION', orders: 'ORDERS', continue: 'CONTINUE (let time run to the next decision point)', wait: 'WAIT', talk: 'TALK', staff: 'STAFF MEETING', checkmen: 'CHECK ON THE MEN', hint: 'ASKS FOR ADVICE', radio: 'RADIO', planning: 'PLANNING', rest: 'REST', visit: 'GO FORWARD', return: 'RETURN TO THE COMMAND POST', consolidate: 'CONSOLIDATE', end: 'END THE OPERATION' }[action.type] || 'ACTION';
  L.push(`[ACTION: ${verb} · ${head}]`);
  if (action.type === 'contact') L.push(`The player answered the CONTACT! moment${action.late ? ' TOO LATE (they hesitated): the men fell back on their training first' : ' in time'}: "${words}"`);
  else if (action.type === 'talk') { const who = state.people[action.personId]; L.push(`The player (${personLabel(state, p)}) speaks to ${who ? `${personLabel(state, who)} [id ${who.id}], ${who.role}, mood ${who.mood}, ${who.status}` : 'someone'}: "${words}"\nAnswer in their voice (speaker "npc:${action.personId}"), from their personality, what they have been through and what they said before. Set changes.mood/said for them.`); }
  else if (action.type === 'staff') L.push(`The player calls the staff together${words ? `: "${words}"` : ''}. Each staff officer speaks briefly from their own lane and personality (S2 on the enemy picture, S3 on the plan, S4 on supply, FSO on fires, XO pulls it together); they disagree where their opinions differ. Base everything on the snapshot and the contacts (the player's picture), not on the hidden truth.`);
  else if (action.type === 'checkmen') L.push(`The player moves among the men and checks on them${words ? `: "${words}"` : ''}. Show 2-3 of them by name, honest about how they are. Their morale rose a little (already applied).`);
  else if (action.type === 'hint') L.push(`The player asks ${ctx.echelon.hintGiver} for advice${words ? `: "${words}"` : ''}. Give ONE vague, in-character nudge from what the player's side knows. Never reveal hidden enemy positions or plans and never solve the mission. It costs a little of the player's standing (already applied).`);
  else if (action.type === 'radio') {
    const r = pre.radio || {};
    L.push(`The player transmits${r.template ? ` a ${r.template.toUpperCase()} in the template` : ''}${r.text ? `: "${r.text}"` : ''}. Format quality: ${r.quality != null ? Math.round(r.quality * 100) + '%' : 'free text'}.`);
    if (r.template === 'salute') L.push(r.accurate ? 'The report matches a real enemy position; higher takes it seriously.' : 'The report does not match anything higher can confirm.');
    if (r.template === 'medevac') L.push(`${r.patients} wounded will be evacuated in about ${r.eta} minutes (decided by the game; a clean request is faster).`);
    if (r.template === 'resupply') L.push(r.supply?.ok ? `Resupply is on its way, expected in about ${r.supply.request.eta - state.clock.minutes + (report.minutes || 0)} minutes (it may still fail).` : `No resupply: ${r.supply?.reason}.`);
    L.push('Voice the answer on the net (radio array), with era-correct procedure. "Say again" if the format was sloppy.');
  } else if (action.type === 'planning') L.push(`Planning step: ${action.step}. ${words ? `The player: "${words}"` : ''} It took ${formatDuration(pre.minutes)} (decided by the game). Let the NCOs or staff talk; show the preparation.`);
  else if (action.type === 'rest') L.push('The player sleeps while the second in command holds the unit. Narrate the waking and what changed while they slept.');
  else if (action.type === 'end') L.push('The player reports the operation complete and closes it.');
  else if (words) L.push(`The player (${personLabel(state, p)}, ${p.role}) says or does: "${words}"`);
  for (const nt of pre.notes) L.push(`NOTE: ${nt}`);
  if (pre.issued.length) {
    L.push('ORDERS UNDERSTOOD BY THE GAME (delivery and execution are the game\'s; voice the acknowledgments):');
    for (const r of pre.issued) {
      const L0 = state.people[r.unit.leaderId];
      L.push(`- ${r.unit.name}${L0 ? ` (${personLabel(state, L0)})` : ''}: ${TASK_LABEL[r.order.task] || r.order.task}${r.order.cell != null && r.order.cell >= 0 ? ` ${refOf(n, r.order.cell)}` : ''}${r.order.how && r.order.how !== refOf(n, r.order.cell) ? ` ("${r.order.how}")` : ''} · ${r.delay ? `reaches them in about ${r.delay} min (${r.unit.radio === 'down' ? 'by runner' : ctx.echelon.tier <= 1 ? 'by runner or shouting' : 'by radio'})` : 'received at once'}${r.misread ? ` · MISREAD: ${r.misread}` : ''}`);
    }
  }
  if (pre.unparsed.length && ['free', 'choice', 'orders', 'contact', 'radio'].includes(action.type)) L.push(`NOT PARSED BY THE GAME: ${pre.unparsed.map(c => `"${c}"`).join(' · ')}. If any of these is an order to a unit, decide how the subordinate understood it and add it to changes.orders (unit id, task, target square). If it is speech or the player's own action, narrate it.`);
  if (pre.fire) L.push(pre.fire.ok ? `FIRE MISSION accepted: ${pre.fire.asset.name} on ${refOf(n, pre.fire.mission.cell)} (${pre.fire.mission.kind}), rounds expected in about ${pre.fire.delay} min${pre.fire.mission.dangerClose.length ? '; DANGER CLOSE' : ''}.` : `FIRE MISSION REFUSED: ${pre.fire.reason}. Voice the refusal on the fires net.`);
  // What happened.
  if (report && report.minutes > 0) {
    L.push(`WHAT HAPPENED OVER THE NEXT ${formatDuration(report.minutes)} (decided by the game; narrate exactly this, add no casualties, change no outcome):`);
    const lines = report.lines.slice(0, 40);
    if (!lines.length && !report.events.length && !report.contacts.length) L.push('- Nothing decisive. Movement, waiting, the small sounds of the war.');
    for (const l of lines) L.push(`- ${l}`);
    for (const c of report.contacts) L.push(`- NEW CONTACT: ${state.units[c.by]?.name || 'your people'} saw ${c.size > 1 ? `about ${c.size}` : 'one'} ${typeWord(c.type)} at ${refOf(n, c.cell)} (${c.confidence}).`);
    for (const e of report.events) L.push(`- ${e.visible ? 'EVENT' : 'HIDDEN EVENT (the player does not see it; show only indirect signs if any)'}${e.flash ? ' · FLASH TRAFFIC' : ''}: ${e.text}${e.applied?.length ? ` [game effects: ${e.applied.join('; ')}]` : ''}`);
    for (const it of report.intel) L.push(`- INTELLIGENCE RECEIVED (${it.source}, ${it.reliability}): ${it.text}`);
    for (const i of report.initiative) L.push(`- INITIATIVE: ${i.text}`);
    const fc = report.casualties.filter(c => c.label);
    if (fc.length) L.push(`FRIENDLY CASUALTIES BY NAME (name them; do not add others): ${fc.map(c => `${c.label} — ${c.status === 'kia' ? (c.dow ? 'died of wounds' : 'KILLED') : `wounded (${c.severity}, ${c.part})`}${c.friendlyFire ? ' — FRIENDLY FIRE' : ''}`).join('; ')}`);
    const fn = report.casualties.filter(c => c.count);
    if (fn.length) L.push(`FRIENDLY LOSSES (numbers): ${fn.map(c => `${state.units[c.unitId]?.name}: ${c.kia} killed, ${c.wia} wounded${c.mia ? `, ${c.mia} missing` : ''}`).join('; ')}`);
    if (report.fratricide) L.push('FRIENDLY FIRE happened this turn. It has consequences: shock, anger, an inquiry later.');
    if (report.civilians) L.push(`CIVILIANS were hurt or killed by your fire: ${report.civilians}.`);
    if (report.decoysRevealed.length) L.push('A DECOY was revealed this turn: the position was a dummy.');
    if (report.objective) L.push(`MISSION STATUS CHANGED: ${report.objective.status.toUpperCase()} — ${report.objective.text}`);
    if (report.playerHit) L.push(`THE PLAYER WAS HIT: ${report.playerHit.status === 'kia' ? 'KILLED' : `${report.playerHit.severity} wound to the ${report.playerHit.part}`}.`);
    if (state.settings.dice === 'shown' && report.ledger.length) L.push(`(Dice are shown to the player in the log; you need not mention them.)`);
  }
  if (report?.contactMoment && state.contactMoment && state.contactMoment.turn === state.turnCount) L.push('CONTACT! This is a sudden, surprising attack on the player\'s own position. Stop mid-scene: one or two lines on what just happened, then end with exactly: "What do you do in the next five seconds?" No choices.');
  if (state.ended) L.push(`THE OPERATION HAS ENDED: ${endText(state)}. Narrate the last moments briefly (80-160 words), no choices; the after-action review is separate.`);
  L.push(`It is now ${formatHM(state)} (${relH(state)}). Mission: ${state.mission.name} · status ${state.mission.status}${state.mission.statusText ? ` (${state.mission.statusText})` : ''} · NLT ${formatHM(state, state.mission.nlt)} · operation ends ${formatHM(state, state.mission.end)}.`);
  return L.join('\n');
}

export function endText(state) {
  const e = state.ended; if (!e) return '';
  return { kia: 'the player has been killed', wounded: 'the player is seriously wounded and evacuated; their part in this operation is over', relieved: 'the player has been relieved of command', failure: 'the force is broken and the operation has failed', time: 'the operation\'s time is up', complete: 'the player has reported the mission complete', captured: 'the player has been captured' }[e.kind] || e.kind;
}

// ------------------------------------------------------------------ apply GM changes
export function applyGMChanges(state, ch, ctx, pre) {
  const notices = [];
  if (!ch || typeof ch !== 'object') return notices;
  const n = state.grid.n; const now = state.clock.minutes;
  for (const o of asArray(ch.orders).slice(0, 8)) {
    const u = state.units[str(o?.unit)];
    if (!u || u.side !== 'friendly' || !liveUnit(u)) continue;
    if (pre.issued.some(r => r.unit.id === u.id)) continue;
    const cell = parseRef(n, o.target);
    const task = normTask(o.task);
    if (cell < 0 && !['halt', 'dig_in', 'defend', 'hold', 'suppress'].includes(task)) continue;
    const r = issueOrder(state, u.id, { task, cell: cell >= 0 ? cell : u.cell, how: cell >= 0 ? refOf(n, cell) : null, clause: 'as understood by the subordinate', quality: 1.2 }, ctx);
    if (r) { notices.push(`${u.name}: ${TASK_LABEL[task] || task}${cell >= 0 ? ` ${refOf(n, cell)}` : ''}${r.delay ? ` (in ${r.delay} min)` : ''}`); pre.issued.push(r); }
  }
  for (const [id, mood] of Object.entries(ch.mood || {})) { const p = state.people[id]; if (p && typeof mood === 'string') p.mood = mood.slice(0, 24).toLowerCase(); }
  for (const [id, d] of Object.entries(ch.morale || {})) {
    const v = clamp(Math.round(num(d, 0)), -10, 10); if (!v) continue;
    if (state.people[id]) state.people[id].morale = clamp(state.people[id].morale + v, 0, 100);
    else if (state.units[id]?.side === 'friendly') state.units[id].morale = clamp(state.units[id].morale + v, 0, 100);
  }
  for (const [id, text] of Object.entries(ch.said || {})) { const p = state.people[id]; if (p && str(text)) { p.said.push({ at: now, text: str(text).slice(0, 240) }); if (p.said.length > 8) p.said.shift(); } }
  for (const f of asArray(ch.facts).slice(0, 5)) if (addFact(state, str(f).slice(0, 240), 'gm')) notices.push(`Noted: ${str(f).slice(0, 80)}`);
  for (const it of asArray(ch.intel).slice(0, 3)) {
    if (!str(it?.text)) continue;
    const cell = it.cell ? parseRef(n, it.cell) : -1;
    addIntelItem(state, { source: str(it.source) || 'report', reliability: /^[A-F][1-6]$/.test(str(it.reliability)) ? it.reliability : 'C3', text: str(it.text).slice(0, 300), cell: cell >= 0 ? cell : null, about: str(it.about) || null, kind: 'gm' });
    if (cell >= 0) {
      const real = state.units[str(it.about)];
      const key = real && real.side === 'enemy' && distance(n, real.cell, cell) <= 1.5 ? real.id : `g-${now}-${cell}`;
      if (!state.picture.contacts[key] || state.picture.contacts[key].confidence === 'possible') state.picture.contacts[key] = { id: key, cell, at: now, confidence: 'possible', size: null, type: real?.type || 'unknown', source: str(it.source) || 'report', firstAt: now, falseContact: !real };
    }
    notices.push(`Intel: ${str(it.text).slice(0, 80)}`);
  }
  if (ch.standing && typeof ch.standing === 'object') for (const k of ['superiors', 'troops', 'staff', 'political']) { const v = clamp(Math.round(num(ch.standing[k], 0)), -5, 5); if (v) state.standing[k] = clamp(state.standing[k] + v, 0, 100); }
  if (ch.conduct && typeof ch.conduct === 'object') {
    const pm = clamp(Math.round(num(ch.conduct.prisonersMistreated, 0)), 0, 100), ch2 = clamp(Math.round(num(ch.conduct.civiliansHarmed, 0)), 0, 500);
    if (pm || ch2 || str(ch.conduct.note)) {
      state.conduct.prisonersMistreated += pm; state.conduct.civiliansHarmed += ch2; state.stats.civilianCasualties += ch2;
      if (str(ch.conduct.note)) state.conduct.unlawful.push({ at: now, note: str(ch.conduct.note).slice(0, 240) });
      if (pm || ch2) { state.standing.troops = clamp(state.standing.troops - 4, 0, 100); state.standing.superiors = clamp(state.standing.superiors - 6, 0, 100); if (!state.flags.includes('conduct_investigation')) state.flags.push('conduct_investigation'); }
    }
  }
  const s = clamp(Math.round(num(ch.stress, 0)), -10, 10); if (s) state.people.p0.stress = clamp((state.people.p0.stress || 0) + s, 0, 100);
  for (const f of asArray(ch.flags).slice(0, 4)) if (/^[a-z0-9_]{3,40}$/.test(str(f)) && !state.flags.includes(f)) state.flags.push(f);
  return notices;
}

function normalizeSpeaker(state, s, action) {
  s = str(s).trim();
  if (s === 'narrator') return s;
  if (/^net:/.test(s)) return s.slice(0, 40);
  const m = s.match(/^npc:(.+)$/);
  if (m && state.people[m[1]]) return s;
  if (action.type === 'talk' && action.personId) return `npc:${action.personId}`;
  return 'narrator';
}

function netFor(state, from) {
  const f = str(from).toLowerCase();
  if (state.fires.assets.some(a => a.callsign && a.callsign.toLowerCase() === f) || /fire|redleg|guns|battery|mortar|fdc/.test(f)) return 'fires';
  if (/dustoff|medevac|aid/.test(f)) return 'medevac';
  const hc = str(state.truth.higher?.commander?.callsign).toLowerCase();
  if (hc && f === hc) return 'higher';
  return 'own';
}

// ------------------------------------------------------------------ the turn
/**
 * Run one turn. Returns { narrative, speaker, choices, notices, report, pre, fallback, ended }.
 */
export async function runTurn({ state, action, provider, apiKey, model, baseUrl, onNarrative, onStatus, signal, rnd }) {
  const ctx = simCtx(state, rnd || Math.random);
  const pre = preResolve(state, action, ctx);
  let report = null;
  if (pre.minutes > 0) report = simulate(state, pre.minutes, { ctx, stopOnInterrupt: pre.stopOnInterrupt });
  else { report = newReport(state); report.end = state.clock.minutes; }
  if (pre.resting) {
    state.resting = false;
    const p0 = state.people.p0; p0.fatigue = clamp(p0.fatigue - (report.minutes / 60) * 12, 0, 100); p0.stress = clamp((p0.stress || 0) - (report.minutes / 60) * 3, 0, 100);
  }
  if (pre.reconHit) report.casualties.push(pre.reconHit);
  // The CONTACT! moment: a surprise on the player's own position at the lower echelons.
  if (report.contactMoment && ctx.echelon.tier <= 3 && action.type !== 'contact' && (state.lastContactTurn == null || state.turnCount - state.lastContactTurn >= 6)) {
    state.contactMoment = { at: state.clock.minutes, turn: state.turnCount, by: report.contactMoment.by };
    state.lastContactTurn = state.turnCount;
  } else if (action.type === 'contact') state.contactMoment = null;
  checkEnd(state, report, pre, ctx);
  const actionText = describeAction(state, action, pre, report, ctx);
  const snapshot = buildSnapshot(state, ctx);
  const system = `${GM_SYSTEM_PROMPT}\n\n${eraPack(state, ctx)}\n\n======================================================================\nOPERATION TRUTH (hidden; never reveal what the player's people could not know)\n======================================================================\n${JSON.stringify(truthForGM(state))}`;
  const context = ['CURRENT STATE (the player\'s side; "contacts" is the player\'s picture of the enemy):', JSON.stringify(snapshot), '', state.summary ? `SUMMARY OF EARLIER PLAY:\n${state.summary}` : 'SUMMARY OF EARLIER PLAY: (the operation has just begun)', `SETTINGS: tone ${state.settings.tone || 'cinematic'}; difficulty ${state.settings.difficulty}; ${state.settings.ironman ? 'IRONMAN' : 'normal saves'}.`].join('\n');
  const messages = [
    { role: 'user', content: `${context}\n\n(The transcript of recent turns follows as separate messages. Reply only to the final ACTION.)` },
    { role: 'assistant', content: '{"narrative": "Understood. Standing by.", "speaker": "narrator", "radio": [], "choices": [], "changes": {}}' },
    ...state.history.slice(-RECENT_TURNS * 2),
    { role: 'user', content: actionText }
  ];
  let raw = '', parsed = null, fallback = false, cutOff = false;
  for (let attempt = 1; attempt <= 2; attempt++) {
    onStatus?.(attempt === 1 ? 'Transmitting...' : 'Garbled reply; asking again...');
    let lastShown = '';
    const nag = cutOff ? 'Your previous reply was cut off at the output limit. Keep the narrative under 180 words and the JSON compact.' : 'Your previous reply was not valid JSON. Reply with exactly one JSON object as specified, "narrative" first, no fences or commentary.';
    const msgs = attempt === 1 ? messages : [...messages.slice(0, -1), { role: 'user', content: `${actionText}\n\n(${nag})` }];
    try {
      const r = await completeWithMeta(provider, { apiKey, model, baseUrl, json: true, system, messages: msgs, maxTokens: 6000, temperature: 0.85, effort: 'low', signal }, (chunk, text) => {
        const nr = extractPartialNarrative(text);
        if (nr != null && nr !== lastShown) { lastShown = nr; onNarrative?.(nr); }
      });
      raw = r.text;
      if (r.finishReason === 'refusal') throw new Error('The model declined to continue this scene. Try a different action.');
      cutOff = r.finishReason === 'length' || looksTruncated(raw);
    } catch (err) {
      if (signal?.aborted || attempt === 2 || /declined/.test(err.message)) throw err;
      continue;
    }
    try { parsed = extractJSON(raw); if (typeof parsed.narrative !== 'string') throw new Error('no narrative'); break; } catch { parsed = null; }
  }
  if (!parsed) {
    fallback = true;
    const nr = extractPartialNarrative(raw);
    parsed = { narrative: (nr && nr.length > 20) ? nr : raw.replace(/^[{\s"]*narrative"?\s*:?\s*"?/, '').trim(), speaker: 'narrator', choices: [], changes: {}, radio: [] };
  }
  onNarrative?.(parsed.narrative);
  const notices = fallback ? [] : applyGMChanges(state, parsed.changes || {}, ctx, pre);
  // Radio lines the GM voiced.
  for (const r of asArray(parsed.radio).slice(0, 8)) if (r && str(r.text)) addRadio(state, { net: netFor(state, r.from), from: str(r.from).slice(0, 40) || 'unknown', to: str(r.to).slice(0, 40), text: str(r.text).slice(0, 400), garble: 0 });
  state.lastChoices = state.contactMoment && state.contactMoment.turn === state.turnCount ? [] : asArray(parsed.choices).filter(c => typeof c === 'string' && c.trim()).slice(0, 4).map(c => c.trim().slice(0, 160));
  if (state.ended) state.lastChoices = [];
  const speaker = normalizeSpeaker(state, parsed.speaker, action);
  if (action.type === 'talk' && action.personId && state.people[action.personId]) { const pp = state.people[action.personId]; pp.said.push({ at: state.clock.minutes, text: `(to the player) ${parsed.narrative.slice(0, 200)}`, q: str(action.text).slice(0, 160) }); if (pp.said.length > 8) pp.said.shift(); }
  addLog(state, action.type, parsed.narrative, speaker, { playerLine: playerLine(state, action) || null, report: compactReport(state, report), ledger: state.settings.dice === 'shown' ? report.ledger.slice(0, 12) : undefined, contact: !!(state.contactMoment && state.contactMoment.turn === state.turnCount) });
  state.history.push({ role: 'user', content: actionText }, { role: 'assistant', content: JSON.stringify({ narrative: parsed.narrative, speaker, choices: state.lastChoices }) });
  state.turnCount += 1;
  if (state.history.length > SUMMARIZE_AFTER * 2) {
    const old = state.history.splice(0, state.history.length - RECENT_TURNS * 2);
    try {
      onStatus?.('Updating the record...');
      const turns = old.map(t => ({ role: t.role, content: t.role === 'assistant' ? safeNarrative(t.content) : t.content.slice(0, 1500) }));
      state.summary = (await complete(provider, { apiKey, model, baseUrl, json: false, system: 'You summarise war-game transcripts precisely.', messages: [{ role: 'user', content: buildSummaryPrompt({ previousSummary: state.summary, turns }) }], maxTokens: 1500, temperature: 0.3, effort: 'low', signal })).trim();
    } catch { state.history.unshift(...old); }
  }
  return { narrative: parsed.narrative, speaker, choices: state.lastChoices, notices, report, pre, fallback, ended: state.ended };
}

function safeNarrative(json) { try { return JSON.parse(json).narrative || json; } catch { return json; } }

/** The line shown in the log for what the player did. */
export function playerLine(state, a) {
  const n = state.grid.n;
  switch (a.type) {
    case 'opening': return null;
    case 'continue': return 'Carry on.';
    case 'wait': return `Wait ${a.minutes} min.`;
    case 'talk': return `To ${personLabel(state, state.people[a.personId])}: "${a.text}"`;
    case 'staff': return `Staff meeting${a.text ? `: "${a.text}"` : '.'}`;
    case 'checkmen': return 'Check on the men.';
    case 'hint': return `Ask ${a.giver || 'for advice'}${a.text ? `: "${a.text}"` : '.'}`;
    case 'radio': return a.template ? `Radio: ${a.template.toUpperCase()} sent.` : `Radio: "${a.text}"`;
    case 'planning': return { warno: 'Issue the warning order.', recon: 'Leader\'s reconnaissance.', rehearsal: 'Rehearse the plan.', opord: 'Give the orders (five paragraphs).', execute: 'Execute now.' }[a.step] || 'Planning.';
    case 'rest': return `Sleep ${a.hours} h.`;
    case 'visit': return `Go forward to ${state.units[a.unitId]?.name}.`;
    case 'return': return 'Back to the command post.';
    case 'consolidate': return 'Consolidate.';
    case 'end': return 'Report the operation complete.';
    default: return a.text || '';
  }
}

function compactReport(state, r) {
  if (!r || !r.minutes) return null;
  const n = state.grid.n;
  return {
    minutes: r.minutes,
    casualties: r.casualties.filter(c => c.label).map(c => `${c.label}: ${c.status === 'kia' ? 'KIA' : `WIA (${c.severity})`}`),
    contacts: r.contacts.map(c => `${typeWord(c.type)} at ${refOf(n, c.cell)} (${c.confidence})`),
    enemyHits: r.enemyHits.reduce((s, x) => s + x.count, 0),
    events: r.events.filter(e => e.visible).map(e => e.text)
  };
}

/** Death, evacuation, relief, the clock, a broken force: the code ends the operation. */
export function checkEnd(state, report, pre, ctx) {
  if (state.ended) return;
  const p = state.people.p0;
  if (p.status === 'kia') state.ended = { kind: 'kia', at: state.clock.minutes };
  else if (p.status === 'wia' && p.wound?.severity === 'serious') state.ended = { kind: 'wounded', at: state.clock.minutes };
  else if (p.status === 'mia') state.ended = { kind: 'captured', at: state.clock.minutes };
  else if (state.standing.superiors <= 12 && ctx.echelon.tier >= 2) state.ended = { kind: 'relieved', at: state.clock.minutes };
  else if (state.mission.status === 'failure' && friendlyUnits(state).filter(u => !u.isHQ).every(u => !liveUnit(u) || u.posture === 'broken' || u.strength <= 0)) state.ended = { kind: 'failure', at: state.clock.minutes };
  else if (state.clock.minutes >= state.mission.end) state.ended = { kind: 'time', at: state.clock.minutes };
  else if (pre?.endRequested) state.ended = { kind: 'complete', at: state.clock.minutes };
  if (state.ended) {
    const ev = evaluateMission(state, { final: true });
    state.ended.outcome = ev.status; state.ended.text = ev.text;
    state.phase = 'ended';
  }
}

export { strengthPct, ctxOf };
