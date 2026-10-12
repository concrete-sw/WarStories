// Between operations: rest, refit, replacements who are strangers, mail call,
// promotions and reliefs, and the thread that ties one operation to the next.

import { buildMailCallPrompt } from '../prompts/aar.js';
import { extractJSON } from './json.js';
import { complete } from '../providers/index.js';
import { personLabel } from './state.js';
import { formatDate } from './clock.js';
import { asArray, str, clamp, num, uid } from './util.js';

export const LADDER = ['fireteam', 'squad', 'platoon', 'company', 'battalion', 'brigade', 'division', 'corps'];

/** Record the finished operation in the campaign log. */
export function recordOperation(state, aar) {
  const c = state.campaign;
  if (c.ops.some(o => o.codename === aar.codename && o.date === aar.date)) return;
  c.ops.push({ codename: aar.codename, title: aar.title, date: aar.date, place: aar.place, outcome: aar.outcome, grade: aar.rating.grade, score: aar.rating.score, kia: state.stats.friendlyKIA, wia: state.stats.friendlyWIA, echelon: state.settings.echelonId, rank: state.people.p0.rank });
  c.record.battles.push(`${aar.codename}: ${aar.title} (${aar.date})`);
  c.careerPoints = (c.careerPoints || 0) + (aar.consequences?.points || 0);
  if (aar.consequences?.promotion) { c.record.promotions.push({ to: aar.consequences.promotion, date: aar.date }); c.careerPoints = 0; }
  if (aar.consequences?.relieved) c.record.evaluations.push({ op: aar.codename, text: 'Relieved of command.' });
  c.record.evaluations.push({ op: aar.codename, text: `${aar.rating.grade} (${aar.rating.score}/100)` });
}

/** Can the story go on after this operation? */
export function canContinue(state) {
  const mode = state.settings.mode;
  if (mode === 'single') return false;
  if (['kia', 'captured'].includes(state.ended?.kind)) return false;
  if (state.settings.ironman && state.people.p0.status === 'kia') return false;
  if (mode === 'campaign' && state.campaign.index >= (state.campaign.total || 1)) return false;
  return true;
}

/** Settings for the next operation: same war; a higher command after a promotion. */
export function nextSettings(state, aar) {
  const s = { ...state.settings };
  if (aar.consequences?.promotion) { s.echelonId = aar.consequences.promotion; s.platoonSgt = false; }
  s.battle = null;
  return s;
}

/** The thread to the next operation, for the generation prompt. */
export function continuationText(state, aar) {
  const c = state.campaign; const p0 = state.people.p0;
  const ops = c.ops.map(o => `${o.codename} (${o.date}, ${o.place}): ${o.outcome}, ${o.grade}, ${o.kia} killed`).join('; ');
  const living = Object.values(state.people).filter(p => !p.isPlayer && ['ok', 'wia'].includes(p.status) && (p.leader || p.notable)).slice(0, 10).map(p => `${personLabel(state, p)} (${p.role})`).join(', ');
  return `This is operation ${c.index + 1}${c.total ? ` of ${c.total}` : ''} of a ${state.settings.mode}. Earlier operations: ${ops}. The last ended on ${aar.date} at ${aar.place}; set this one ${aar.consequences?.promotion ? 'some weeks' : 'several days to two weeks'} later (a real later date, inside the theatre's dates), with the war moving on. The player is ${p0.rank} ${p0.name}${aar.consequences?.promotion ? `, newly promoted to command a ${aar.consequences.promotion}` : aar.consequences?.relieved ? ', relieved after the last operation and given one more chance' : ''}. ${aar.consequences?.promotion ? 'A new command: new subordinate leaders, though one or two familiar faces may turn up.' : `Keep the same unit and these surviving leaders by name: ${living || 'none survive'}. Strangers fill the gaps: replacements.`} The men remember: ${state.campaign.wall.slice(-4).map(w => `${w.rank} ${w.name}`).join(', ') || 'no one has been lost yet'}.`;
}

/** What survives into the next operation. */
export function buildCarry(state, aar) {
  const promoted = !!aar.consequences?.promotion;
  const veterans = Object.values(state.people).filter(p => !p.isPlayer && !p.staffRole && (p.status === 'ok' || (p.status === 'wia' && p.wound?.severity === 'light') || (p.status === 'evac' && p.wound?.severity === 'light')))
    .map(p => ({ name: p.name, first: p.first, last: p.last, nickname: p.nickname, hometown: p.hometown, detail: p.detail, trait: p.trait, breakingPoint: p.breakingPoint, age: p.age, kills: p.kills, awards: p.awards, morale: p.morale - 5, personality: p.personality, voice: p.voice, rank: p.rank, leader: p.leader }));
  const p0 = state.people.p0;
  return {
    campaign: { ...state.campaign, index: state.campaign.index + 1 },
    player: { serviceNumber: p0.serviceNumber, awards: p0.awards, kills: p0.kills, stress: p0.stress, age: p0.age, hometown: p0.hometown },
    standing: { ...state.standing, superiors: aar.consequences?.relieved ? 45 : clamp(state.standing.superiors + (aar.outcome === 'success' ? 5 : aar.outcome === 'failure' ? -8 : 0), 25, 90) },
    veterans: promoted ? [] : veterans.sort((a, b) => (b.leader ? 1 : 0) - (a.leader ? 1 : 0)),
    sameCommand: !promoted,
    lettersReceived: state.campaign.lettersReceived
  };
}

/** Mail call: letters from home, replies from families, written by the AI. */
export async function mailCall({ state, aar, provider, apiKey, model, baseUrl, signal }) {
  const letters = state.letters.filter(l => !l.answered).slice(-6).map(l => ({ id: l.id, kind: l.kind, to: l.toName, text: l.text.slice(0, 600) }));
  const soldiers = Object.values(state.people).filter(p => !p.isPlayer && p.status === 'ok').slice(0, 14).map(p => ({ id: p.id, name: p.name, hometown: p.hometown, detail: p.detail }));
  const families = state.letters.filter(l => l.kind === 'family').map(l => ({ about: l.toName, letterId: l.id }));
  const opSummary = `${aar.title} (${aar.codename}): ${aar.outcome}. ${aar.outcomeText || ''} Killed: ${aar.wall.map(w => `${w.rank} ${w.name}`).join(', ') || 'none'}.`;
  try {
    const text = await complete(provider, { apiKey, model, baseUrl, json: true, maxTokens: 3000, temperature: 0.9, effort: 'low', signal, system: 'You write period letters for a war game. Output only JSON.', messages: [{ role: 'user', content: buildMailCallPrompt({ state, letters, soldiers, families, opSummary }) }] });
    const j = extractJSON(text);
    const out = [];
    for (const l of asArray(j.letters).slice(0, 6)) {
      if (!str(l?.text)) continue;
      const to = state.people[str(l.to)] ? str(l.to) : 'p0';
      const m = clamp(Math.round(num(l.morale, 0)), -10, 10);
      if (state.people[to]) state.people[to].morale = clamp(state.people[to].morale + m, 0, 100);
      const rec = { id: uid('mail'), to, toName: personLabel(state, state.people[to]), from: str(l.from).slice(0, 80), text: str(l.text).slice(0, 2000), replyTo: str(l.replyTo) || null, date: formatDate(state), op: state.truth.codename, morale: m };
      out.push(rec);
      const orig = state.letters.find(x => x.id === rec.replyTo); if (orig) orig.answered = true;
    }
    state.campaign.lettersReceived = [...asArray(state.campaign.lettersReceived), ...out];
    return out;
  } catch { return []; }
}

/** The player writes a letter. kind: 'home' | 'family' | 'citation'. */
export function writeLetter(state, { kind, toPersonId = null, toName = '', text }) {
  const l = { id: uid('ltr'), kind, toPersonId, toName: toName || (toPersonId ? `the family of ${personLabel(state, state.people[toPersonId])}` : 'home'), text: str(text).slice(0, 4000), at: state.clock.minutes, date: formatDate(state), op: state.truth.codename, answered: false };
  state.letters.push(l);
  if (kind === 'family' && toPersonId && state.people[toPersonId]) state.people[toPersonId].letterWritten = true;
  if (kind === 'family') state.standing.troops = clamp(state.standing.troops + 1, 0, 100);
  return l;
}
