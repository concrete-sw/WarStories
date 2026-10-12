// The after-action review: the numbers, the decisions, the deceptions, the roll
// call, a rating, awards and their fate up the chain, and what it means for the
// player's career. The code decides all of that; the AI writes the honest prose.

import { buildAARPrompt } from '../prompts/aar.js';
import { extractJSON } from './json.js';
import { complete } from '../providers/index.js';
import { awardsFor } from '../data/armies.js';
import { friendlyUnits, enemyUnits, liveUnit, membersOf, personLabel, ctxOf } from './state.js';
import { strengthPct, evaluateMission } from './objectives.js';
import { refOf } from './grid.js';
import { formatHM, formatDate, formatDuration } from './clock.js';
import { endText } from './gm.js';
import { clamp, asArray, str } from './util.js';
import { typeWord } from './sim.js';

export function rateOperation(state) {
  const s = state.stats; const o = state.ended?.outcome || state.mission.status;
  const own = strengthPct(state, 'friendly'); const theirs = strengthPct(state, 'enemy');
  const parts = [];
  const add = (label, v) => { parts.push({ label, v: Math.round(v) }); return v; };
  let score = add('Mission', o === 'success' ? 50 : o === 'partial' ? 30 : 10);
  score += add('Your losses', own >= 85 ? 15 : own >= 70 ? 8 : own >= 50 ? 0 : -12);
  score += add('Enemy losses', (100 - theirs) / 100 * 15);
  if (o === 'success' && state.mission.securedAt != null && state.mission.securedAt <= state.mission.nlt) score += add('On time', 5);
  const conduct = state.conduct.prisonersMistreated + state.conduct.civiliansHarmed + state.conduct.unlawful.length;
  if (conduct) score += add('Conduct', -Math.min(40, 12 + conduct * 2));
  if (s.fratricide) score += add('Friendly fire', -5 * s.fratricide);
  if (s.goodReports) score += add('Reports to higher', Math.min(8, s.goodReports * 2));
  const plan = ['warno', 'opord', 'rehearsal', 'recon'].filter(k => state.planning[k]).length;
  if (plan) score += add('Planning', plan * 2);
  if (s.medevacGood) score += add('Casualty care', Math.min(4, s.medevacGood * 2));
  if (state.ended?.kind === 'relieved') score += add('Relieved of command', -20);
  const mult = state.settings.difficulty === 'veteran' ? 1.1 : state.settings.difficulty === 'green' ? 0.9 : 1;
  score = clamp(Math.round(score * mult), 0, 100);
  const grade = score >= 82 ? 'Superior' : score >= 66 ? 'Excellent' : score >= 50 ? 'Satisfactory' : score >= 35 ? 'Marginal' : 'Unsatisfactory';
  return { score, grade, parts, own, theirs };
}

/** Decide the player's decorations and the fate of the ones they recommended. */
export function decideAwards(state, rating, ctx, rnd = Math.random) {
  const year = new Date(state.clock.start).getUTCFullYear();
  const list = awardsFor(ctx.army, year);
  const officer = ['lt2', 'lt1', 'cpt', 'maj', 'ltc', 'col', 'bg', 'mg', 'ltg'].includes(state.people.p0.rankKey);
  const eligible = a => (!a.officers || officer) && (!a.ranks || !officer);
  const byTier = t => list.filter(a => a.tier === t && eligible(a))[0] || list.filter(a => a.tier === t)[0] || null;
  const out = { player: [], recommended: [] };
  const p0 = state.people.p0;
  const exposed = ctx.echelon.tier <= 3 || state.decisions.some(d => d.kind === 'visit');
  const o = state.ended?.outcome;
  if (p0.wound) { const w = list.find(a => a.wound); if (w) out.player.push({ award: w, reason: `wounded (${p0.wound.severity}, ${p0.wound.part})` }); }
  let tier = 0;
  if (o === 'success' && rating.score >= 88 && exposed) tier = ctx.echelon.tier <= 2 ? 3 : 2;
  else if (o === 'success' && rating.score >= 72 && exposed) tier = 2;
  else if ((o === 'success' || o === 'partial') && rating.score >= 60) tier = 1;
  if (state.conduct.unlawful.length || state.conduct.prisonersMistreated || state.conduct.civiliansHarmed > 2) tier = 0;
  if (tier) { const a = byTier(tier) || byTier(tier - 1); if (a) out.player.push({ award: a, reason: tier >= 2 ? 'gallantry in action' : 'meritorious conduct' }); }
  if (p0.status === 'kia' && rating.score >= 60) { const a = byTier(Math.max(2, tier)); if (a && !out.player.some(x => x.award.id === a.id)) out.player.push({ award: a, reason: 'posthumous' }); }
  for (const r of state.recommendations || []) {
    const person = state.people[r.personId]; const want = list.find(a => a.id === r.awardId);
    if (!person || !want) continue;
    const deeds = (person.kills || 0) > 0 || person.status === 'kia' || person.status === 'wia' || person.leader;
    let p = { 1: 0.9, 2: 0.7, 3: 0.45, 4: 0.18, 5: 0.05 }[want.tier] ?? 0.5;
    p *= (deeds ? 1.2 : 0.7) * (rating.score / 65) * (str(r.citation).length > 60 ? 1.15 : 0.9);
    let status = 'approved', got = want;
    if (rnd() > clamp(p, 0.02, 0.97)) {
      const lower = list.filter(a => !a.wound && a.tier < want.tier && a.tier > 0).sort((a, b) => b.tier - a.tier)[0];
      if (lower && rnd() < 0.65) { status = 'downgraded'; got = lower; } else { status = 'denied'; got = null; }
    }
    if (got) person.awards.push({ id: got.id, name: got.name, op: state.truth.codename, ribbon: got.ribbon });
    out.recommended.push({ personId: person.id, name: personLabel(state, person), asked: want.name, status, got: got?.name || null, citation: r.citation });
  }
  for (const a of out.player) { p0.awards.push({ id: a.award.id, name: a.award.name, op: state.truth.codename, ribbon: a.award.ribbon, reason: a.reason }); state.campaign.record.awards.push({ name: a.award.name, op: state.truth.codename, ribbon: a.award.ribbon, reason: a.reason, date: formatDate(state) }); }
  // Everyone with a wound gets the wound award where the army has one.
  const w = list.find(a => a.wound);
  if (w) for (const p of Object.values(state.people)) if (!p.isPlayer && p.wound && ['wia', 'evac', 'kia'].includes(p.status) && !p.awards.some(x => x.id === w.id)) p.awards.push({ id: w.id, name: w.name, op: state.truth.codename, ribbon: w.ribbon });
  return out;
}

/** Everything the review needs, computed by code. */
export function computeAAR(state, rnd = Math.random) {
  const ctx = ctxOf(state); const n = state.grid.n;
  if (!state.ended) state.ended = { kind: 'complete', at: state.clock.minutes };
  const ev = evaluateMission(state, { final: true });
  state.ended.outcome = state.ended.outcome || ev.status;
  const rating = rateOperation(state);
  const awards = decideAwards(state, rating, ctx, rnd);
  const fr = friendlyUnits(state).filter(u => !u.isHQ);
  const en = enemyUnits(state).filter(u => !u.decoy);
  const named = Object.values(state.people).filter(p => !p.isPlayer && p.status !== 'ok');
  const rollCall = named.map(p => ({ id: p.id, name: personLabel(state, p), role: p.role, unit: state.units[p.unitId]?.name || '', status: p.status, wound: p.wound ? `${p.wound.severity}${p.wound.part ? `, ${p.wound.part}` : ''}${p.wound.cause ? `, ${p.wound.cause}` : ''}` : '', at: p.wound ? formatHM(state, p.wound.at) : '' }));
  const unitLosses = fr.map(u => ({ unit: u.name, start: u.start, now: u.strength, kia: u.killed || 0, wia: u.wounded || 0, mia: u.missing || 0, captured: u.captured || 0 }));
  const deceptions = [
    ...asArray(state.truth.deceptions).map(d => ({ what: d, source: 'plan' })),
    ...en.length ? [] : [],
    ...enemyUnits(state).filter(u => u.decoy).map(u => ({ what: `${u.name} at ${refOf(n, u.cell)}`, truth: 'a decoy (dummy position or feint)', revealed: !!state.picture.contacts[u.id]?.decoyRevealed })),
    ...asArray(state.truth.intel).filter(i => !i.truthful).map(i => ({ what: `${i.source} report: ${i.text}`, truth: 'false or planted', received: state.intelDelivered.includes(i.id) }))
  ];
  const picture = Object.values(state.picture.contacts).filter(c => !c.cleared).map(c => ({ at: refOf(n, c.cell), type: c.type, size: c.size, confidence: c.confidence }));
  const truthAtEnd = enemyUnits(state).filter(u => !u.dormant).map(u => ({ id: u.id, name: u.name, at: refOf(n, u.cell), strength: `${u.strength}/${u.decoy ? 0 : u.start}`, decoy: !!u.decoy, status: u.destroyed ? 'destroyed' : u.surrendered ? 'surrendered' : u.posture === 'broken' ? 'broken' : 'intact', intent: u.history.slice(-2).map(h => h.why).join(', ') }));
  const consequences = careerConsequences(state, rating, ctx);
  const p0 = state.people.p0;
  const aar = {
    codename: state.truth.codename, title: state.truth.title, date: formatDate(state, 0), place: state.setting.place,
    endKind: state.ended.kind, endText: endText(state), outcome: state.ended.outcome, outcomeText: state.ended.text || ev.text,
    player: `${personLabel(state, p0)}, ${p0.role}, ${p0.status === 'ok' ? 'unhurt' : p0.status}`,
    duration: formatDuration(state.clock.minutes),
    stats: { ...state.stats, friendlyStrength: `${rating.own}%`, enemyStrength: `${rating.theirs}%`, unitLosses },
    timeline: state.decisions.map(d => ({ time: formatHM(state, d.at), text: d.text, kind: d.kind })),
    deceptions, picture, truthAtEnd, rollCall, conduct: state.conduct, rating, awards, consequences,
    wall: state.campaign.wall.filter(w => w.op === state.truth.codename)
  };
  return aar;
}

const LADDER = ['fireteam', 'squad', 'platoon', 'company', 'battalion', 'brigade', 'division', 'corps'];

function careerConsequences(state, rating, ctx) {
  const c = { points: 0, promotion: null, relieved: false, investigation: false, notes: [] };
  const o = state.ended.outcome;
  c.points = Math.round(rating.score / 10) + (o === 'success' ? 4 : o === 'partial' ? 1 : -2);
  if (state.ended.kind === 'relieved' || (rating.score < 30 && ctx.echelon.tier >= 2)) { c.relieved = true; c.notes.push('You are relieved of command. A staff posting, a chance to prove yourself again, or the end of your career.'); }
  if (state.conduct.unlawful.length || state.conduct.prisonersMistreated || state.conduct.civiliansHarmed > 2) { c.investigation = true; c.notes.push('An investigation is opened into what happened under your command.'); }
  if (state.stats.fratricide) c.notes.push('A board of inquiry will look into the friendly-fire incident.');
  const total = (state.campaign.careerPoints || 0) + c.points;
  const idx = LADDER.indexOf(state.settings.echelonId);
  const need = 10 + idx * 2;
  if (state.settings.mode === 'career' && !c.relieved && !c.investigation && o !== 'failure' && total >= need && idx < LADDER.length - 1 && state.people.p0.status !== 'kia') {
    c.promotion = LADDER[idx + 1];
    c.notes.push(`Recommended for promotion: you will take a ${LADDER[idx + 1]}.`);
  }
  if (state.settings.mode === 'campaign' && o === 'success' && rating.score >= 80) c.notes.push('Your name is mentioned at higher headquarters.');
  return c;
}

/** The AI's honest prose for the review, with a code fallback. */
export async function writeAAR({ state, aar, provider, apiKey, model, baseUrl, signal }) {
  try {
    const text = await complete(provider, { apiKey, model, baseUrl, json: true, maxTokens: 4000, temperature: 0.7, effort: 'low', signal, system: 'You are a senior officer writing an honest after-action review. Output only JSON.', messages: [{ role: 'user', content: buildAARPrompt({ state, aar, truth: state.truth }) }] });
    const j = extractJSON(text);
    return { verdict: str(j.verdict), whatHappened: str(j.whatHappened), sustain: asArray(j.sustain).map(str), improve: asArray(j.improve).map(str), deceptions: asArray(j.deceptions), enemyView: str(j.enemyView), higherView: str(j.higherView), theMen: str(j.theMen), history: str(j.history), citation: j.citation ? str(j.citation) : null, epitaph: j.epitaph ? str(j.epitaph) : null };
  } catch (err) {
    return fallbackAAR(state, aar, err);
  }
}

export function fallbackAAR(state, aar, err = null) {
  const t = state.truth;
  return {
    verdict: `${aar.outcome === 'success' ? 'Mission accomplished' : aar.outcome === 'partial' ? 'A partial success' : 'The mission failed'}. ${aar.outcomeText || ''} Rated ${aar.rating.grade}.`,
    whatHappened: `${t.enemy?.description || ''} ${t.enemy?.intent ? `Their intent: ${t.enemy.intent}` : ''} ${t.enemy?.plan || ''}`.trim(),
    sustain: aar.rating.parts.filter(p => p.v > 0).map(p => p.label),
    improve: aar.rating.parts.filter(p => p.v < 0).map(p => p.label),
    deceptions: aar.deceptions.map(d => ({ what: d.what, truth: d.truth || 'see the operation plan', fooled: null })),
    enemyView: t.enemy?.commander ? `${t.enemy.commander.name || 'The enemy commander'}: ${t.enemy.commander.temperament || ''}. His mistake: ${t.enemy.commander.mistake || 'unknown'}.` : '',
    higherView: '', theMen: '', history: t.setting?.historicalOutcome || '', citation: null, epitaph: null, offline: err ? err.message : null
  };
}

export { typeWord, liveUnit, membersOf };
