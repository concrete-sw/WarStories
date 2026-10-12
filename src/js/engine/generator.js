// Generates and validates the hidden operation truth. A reply cut off at the
// model's output limit is continued and stitched together; an invalid
// operation is regenerated with the validation errors fed back; models with
// small output limits write it in three parts, each seeing the parts before it.

import { buildOperationPrompt, buildPartPrompt, OPERATION_PARTS, unitCountsFor } from '../prompts/operation.js';
import { validateOperation, normalizeOperation, deepClean } from './schema.js';
import { extractJSON, looksTruncated } from './json.js';
import { completeWithMeta } from '../providers/index.js';
import { asArray } from './util.js';

const MAX_CONTINUATIONS = 2;
const SYSTEM = 'You are a meticulous military historian and wargame designer who outputs only valid JSON: no markdown fences, no commentary, no comments inside the JSON.';
const PARTS_BELOW_CAP = 16384;

/**
 * args: { era, theatre, army, branch, echelon, difficulty, settings, player, background, rank, seed, cellM, gridN, continuation }
 */
export async function generateOperation({ provider, apiKey, model, baseUrl, args, onProgress, maxAttempts = 3, signal }) {
  const opts = { apiKey, model, baseUrl, json: true, maxTokens: 32000, temperature: 0.9, effort: 'medium', signal, system: SYSTEM };
  const vopts = { echelonId: args.echelon.id, unitCounts: unitCountsFor(args.echelon.id) };
  const cap = typeof provider.outputCap === 'function' ? provider.outputCap(model) : Infinity;
  const strategy = args.settings.generation && args.settings.generation !== 'auto' ? args.settings.generation : (provider.worldInParts || cap <= PARTS_BELOW_CAP) ? 'parts' : 'single';
  const thinking = /reason|think|\bo[1-9]\b|gpt-5|\br1\b/i.test(String(model || provider.defaultModel || ''));
  const note = thinking ? ' (a thinking model works in silence for a while before any text appears)' : '';
  const finish = op => { op.seed = { mission: args.seed.mission, complication: args.seed.complication, twist: args.seed.twist, boss: args.seed.boss, enemyTemperament: args.seed.enemyTemperament }; return normalizeOperation(op, { echelon: args.echelon }); };
  if (strategy === 'single') {
    const r = await generateSingle({ provider, opts, args, vopts, onProgress, maxAttempts, signal, note });
    if (r.op) return finish(r.op);
    if (!r.truncated) throw r.error;
    onProgress?.('The whole operation does not fit this model\'s output limit; writing it in three parts instead...');
  }
  const r = await generateInParts({ provider, opts, args, vopts, onProgress, maxRounds: maxAttempts, signal, note });
  if (r.op) return finish(r.op);
  throw r.error;
}

async function callWithContinuation({ provider, opts, messages, firstKey, onProgress, label }) {
  let chars = 0;
  let { text, finishReason } = await completeWithMeta(provider, { ...opts, messages }, (chunk, t) => { chars = t.length; onProgress?.(`${label}... ${chars} chars`); });
  if (finishReason === 'refusal') throw new Error('The model declined to write this operation. Try another war, army or model.');
  for (let c = 0; c < MAX_CONTINUATIONS && (finishReason === 'length' || (finishReason == null && looksTruncated(text))); c++) {
    onProgress?.(`${label}: the reply was cut off at ${chars} chars; asking the model to continue (${c + 1} of ${MAX_CONTINUATIONS})...`);
    const tail = text.slice(-160).replace(/\s+/g, ' ');
    const cont = await completeWithMeta(provider, {
      ...opts, json: false,
      messages: [...messages, { role: 'assistant', content: text }, { role: 'user', content: `Your output was cut off before the JSON ended. It currently ends with: ${tail}\nContinue EXACTLY from where it stopped, starting with the very next character after that. Output only the remaining JSON: do not repeat anything already written, do not restart the object, no fences, no commentary.` }]
    }, (chunk, t) => { onProgress?.(`${label}: continuing... ${chars + t.length} chars`); });
    const restart = new RegExp(`^\\s*(?:\`\`\`(?:json)?\\s*)?\\{\\s*"${firstKey}"\\s*:`);
    text = restart.test(cont.text) ? cont.text : stitch(text, cont.text);
    chars = text.length;
    finishReason = cont.finishReason;
  }
  return { text, finishReason, truncated: finishReason === 'length' || looksTruncated(text) };
}

async function generateSingle({ provider, opts, args, vopts, onProgress, maxAttempts, signal, note }) {
  const prompt = buildOperationPrompt(args);
  let lastProblems = [], lastText = '', truncated = false, everTruncated = false;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const label = `Building the operation (attempt ${attempt} of ${maxAttempts})${note}`;
    onProgress?.(`${label}...`);
    const messages = [{ role: 'user', content: prompt }];
    if (attempt > 1 && lastProblems.length) messages[0].content += `\n\nYOUR PREVIOUS ATTEMPT FAILED VALIDATION. Fix every problem below and output the complete corrected JSON:\n- ${lastProblems.join('\n- ')}`;
    try {
      const r = await callWithContinuation({ provider, opts, messages, firstKey: 'title', onProgress, label });
      lastText = r.text; truncated = r.truncated; everTruncated = everTruncated || truncated;
      const parsed = deepClean(extractJSON(r.text));
      lastProblems = validateOperation(parsed, vopts);
      if (lastProblems.length === 0) return { op: parsed };
      if (truncated) break;
      onProgress?.(`Validation failed: ${lastProblems.slice(0, 3).join('; ')}`);
    } catch (err) {
      if (signal?.aborted || /declined/.test(err.message)) throw err;
      if (truncated || looksTruncated(lastText)) { everTruncated = true; lastProblems = ['Your output was cut off at the output token limit and could not be parsed.']; break; }
      const tail = lastText ? ` The reply ended with: …${lastText.slice(-120).replace(/\s+/g, ' ')}` : '';
      lastProblems = [`Output was not parseable JSON (${err.message}).${tail} Output the whole object as valid JSON with no comments, fences or trailing text.`];
      onProgress?.(`Attempt ${attempt} failed: ${err.message}`);
    }
  }
  const error = new Error(`Could not build a valid operation after ${maxAttempts} attempts. Last problems: ${lastProblems.join('; ')} A stronger model (Claude Sonnet, GPT-4.1, Gemini 2.5 Flash, DeepSeek) usually fixes this.`);
  error.raw = lastText;
  return { error, truncated: everTruncated };
}

async function generateInParts({ provider, opts, args, vopts, onProgress, maxRounds, signal, note }) {
  const parts = {};
  const pending = Object.fromEntries(OPERATION_PARTS.map(p => [p.id, []]));
  let lastProblems = [], lastText = '', truncated = false;
  const written = exclude => { const o = {}; let any = false; for (const p of OPERATION_PARTS) if (p.id !== exclude && parts[p.id]) { Object.assign(o, parts[p.id]); any = true; } return any ? o : null; };
  for (let round = 1; round <= maxRounds; round++) {
    for (const part of OPERATION_PARTS) {
      if (parts[part.id] && !pending[part.id].length) continue;
      const n = OPERATION_PARTS.indexOf(part) + 1;
      const label = `Building the operation: part ${n} of ${OPERATION_PARTS.length}${round > 1 ? ` (round ${round})` : ''}${note}`;
      onProgress?.(`${label}...`);
      const messages = [{ role: 'user', content: buildPartPrompt(args, { part, soFar: written(part.id), problems: pending[part.id] }) }];
      let r;
      try { r = await callWithContinuation({ provider, opts, messages, firstKey: part.keys[0], onProgress, label }); }
      catch (err) { if (signal?.aborted || /declined/.test(err.message)) throw err; pending[part.id] = [`The request failed (${err.message}); write the part again.`]; lastProblems = pending[part.id]; continue; }
      lastText = r.text; truncated = r.truncated;
      let obj = null;
      try { obj = deepClean(extractJSON(r.text)); } catch (err) { pending[part.id] = [r.truncated ? 'Your output was cut off at the output token limit: write this part more compactly.' : `Output was not parseable JSON (${err.message}). Output the whole part as valid JSON.`]; }
      if (obj && typeof obj === 'object') {
        const missing = part.keys.filter(k => obj[k] === undefined).map(k => `missing top-level key "${k}"`);
        if (missing.length) pending[part.id] = missing;
        else { const picked = {}; for (const k of part.keys) picked[k] = obj[k]; parts[part.id] = picked; pending[part.id] = []; continue; }
      }
      lastProblems = pending[part.id];
      onProgress?.(`Part ${n} needs another pass: ${pending[part.id][0]}`);
    }
    if (OPERATION_PARTS.some(p => !parts[p.id])) continue;
    const merged = Object.assign({}, ...OPERATION_PARTS.map(p => parts[p.id]));
    lastProblems = validateOperation(merged, vopts);
    if (!lastProblems.length) return { op: merged };
    for (const p of OPERATION_PARTS) pending[p.id] = [];
    for (const prob of lastProblems) pending[partFor(prob)].push(prob);
    onProgress?.(`Validation failed: ${lastProblems.slice(0, 3).join('; ')}`);
  }
  const error = new Error(`Could not build a valid operation after ${maxRounds} rounds. Last problems: ${lastProblems.join('; ')}${truncated ? ' Even one part did not fit this model\'s output limit: pick a model with a larger output limit.' : ' A stronger model usually fixes this.'}`);
  error.raw = lastText;
  return { error };
}

export function partFor(problem) {
  const p = String(problem).toLowerCase();
  if (/^(friendly|enemy)|units?\[|leaders|hqcell|decoy unit/.test(p)) return 'forces';
  if (/^(intel|events|people|deceptive|deceptions|complications)/.test(p)) return 'story';
  if (/deceptive indicators/.test(p)) return 'story';
  return 'setting';
}

export function stitch(head, tail) {
  const t = String(tail || '').replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
  const max = Math.min(400, head.length, t.length);
  for (let k = max; k >= 3; k--) if (head.endsWith(t.slice(0, k))) return head + t.slice(k);
  return head + t;
}

export { asArray };
