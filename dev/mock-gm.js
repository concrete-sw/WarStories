// Offline mock Game Master. Speaks the OpenAI chat-completions protocol with
// SSE streaming so the whole game can be exercised end to end without an API
// key. It serves two hand-written operations (a 1944 squad attack and a 1985
// battalion defence) and scripted replies keyed on the game's ACTION tags.
//
//   node dev/mock-gm.js            # listens on http://localhost:8787/v1
//
// In the game pick "Custom (OpenAI-compatible)", base URL http://localhost:8787/v1,
// any key. It is for development and testing, not for play.
//
// MOCK_TRUNCATE=1 cuts the operation reply short (finish_reason "length") and
// serves the rest on the continuation request. MOCK_MAX_TOKENS=N rejects
// requests asking for more than N output tokens; MOCK_NO_JSON=1 rejects JSON mode.

import http from 'node:http';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const SQUAD = readFileSync(path.join(here, 'samples', 'squad-attack-1944.json'), 'utf8');
const BATTALION = readFileSync(path.join(here, 'samples', 'battalion-defense-1985.json'), 'utf8');
const PORT = Number(process.env.PORT || 8787);
const TRUNCATE = process.env.MOCK_TRUNCATE === '1';
const MAX_TOKENS = Number(process.env.MOCK_MAX_TOKENS || 0);
const NO_JSON = process.env.MOCK_NO_JSON === '1';
let lastServed = SQUAD;

const J = (narrative, extra = {}) => JSON.stringify({ narrative, speaker: 'narrator', radio: [], choices: [], changes: {}, ...extra });
const cut = full => { lastServed = full; return TRUNCATE ? { text: full.slice(0, Math.floor(full.length * 0.6)), finish: 'length' } : full; };
const pickOp = text => (/ECHELON: (Battalion|Brigade|Division|Corps|Company)/.test(text) ? BATTALION : SQUAD);

function said(text) { const m = text.match(/says or does: "([^"]*)"/) || text.match(/: "([^"]*)"\n/); return m ? m[1] : ''; }
function casualtyLine(text) { const m = text.match(/FRIENDLY CASUALTIES BY NAME[^:]*: ([^\n]+)/); return m ? m[1] : ''; }
function ids(text, re) { return [...text.matchAll(re)].map(m => m[1]); }

function reply(text, msgs, req) {
  if (text.includes('Reply with the single word READY')) return 'READY';
  if (text.includes('Continue EXACTLY from where it stopped')) {
    const partial = [...msgs].reverse().find(m => m.role === 'assistant')?.content || '';
    return { text: lastServed.slice(Math.max(0, partial.length - 24)), finish: 'stop' };
  }
  const part = text.match(/YOU ARE WRITING PART (\d) OF (\d)/);
  if (part) {
    const keys = [...(text.match(/ONLY these top-level keys, each complete and final: ([^\n]+)/)?.[1] || '').matchAll(/"([a-zA-Z]+)"/g)].map(m => m[1]);
    const w = JSON.parse(pickOp(text)); const out = {}; for (const k of keys) if (k in w) out[k] = w[k];
    return cut(JSON.stringify(out));
  }
  if (text.includes('designing the hidden ground truth')) return cut(pickOp(text));
  if (text.includes('operation has ENDED')) {
    return JSON.stringify({
      verdict: 'The plan was sound and the men were brave; the reserve was committed late and the price was paid at the crossroads.',
      whatHappened: 'The enemy held the crossroads with a machine gun sited to enfilade the open field and a rifle group in the farm, with a reserve hidden in the sunken road ready to counterattack the moment the farm fell. The orchard was a dummy. An assault gun came up the road an hour after H-hour.',
      sustain: ['Fire and movement: one element fixed the gun while another moved.', 'Reports to higher were complete and on time.'],
      improve: ['The flank was exposed to the hidden reserve.', 'The mortars were called late.'],
      deceptions: [{ what: 'The dug-in position in the orchard', truth: 'a dummy position', fooled: false }, { what: '1st Squad\'s report that the track was clear', truth: 'wrong: the gun covered it', fooled: true }],
      enemyView: 'They came straight at the gun, as I hoped. Then they did not. I had not expected that.',
      higherView: 'Doyle wants you on the next one. He says so to the captain, which is as close to praise as he gets.',
      theMen: 'They say you do not waste them. Some of them say it with an edge.',
      history: 'The bocage fighting of June 1944 cost the US First Army thousands of casualties for a few miles of ground.',
      citation: 'For gallantry in action near Carentan, France, on 14 June 1944. Under heavy machine-gun fire he moved among his men, directed their fire and led the final rush onto the objective.',
      epitaph: null
    });
  }
  if (text.includes('it is MAIL CALL')) {
    const sold = text.match(/"id":"(p\d+)"/);
    return JSON.stringify({ letters: [
      { to: 'p0', from: 'your mother', replyTo: null, text: 'Your father reads the paper every morning looking for your division. We pray for you and all the boys. The garden came in well this year. Write when you can, even a line.', morale: 3 },
      ...(sold ? [{ to: sold[1], from: 'his sister', replyTo: null, text: 'The farm is managing, don\'t worry. Dad\'s back is better. Everyone at church asks after you. Come home.', morale: 4 }] : [])
    ] });
  }
  if (text.includes('Update the running summary')) return 'The squad crossed the line of departure at dawn, was stopped by a machine gun at the middle hedgerow, and worked a team around the flank while the BAR team suppressed.';

  // ---- turns
  const w = said(text);
  const cas = casualtyLine(text);
  const casNote = cas ? `\n\n${cas.split(';')[0].split(' — ')[0].trim()} is hit. Somebody yells for a medic who is not there.` : '';
  const units = ids(text, /"id":"(u\d)"/g);
  if (text.includes('[OPENING')) {
    const batt = text.includes('Anvil');
    return J(batt ? 'The TOC smells of diesel and coffee. On the map board the S2 has drawn three red arrows; the S3 has drawn two. "Main effort comes down the B27," Raman says. "Through Hünfeld," Brandt says, louder. The radios hiss. Somewhere east a flare goes up and hangs.' : 'Rain drips off the hedgerow. Brennan crouches beside you in the sunken lane, watch in his palm. "Forty minutes, Sarge." Russo is cleaning the BAR for the third time. Kowalczyk wants to know which hedgerow is the middle one. Nobody has an answer that makes them feel better.',
      { choices: batt ? ['Ask the S2 for her estimate', 'Order all companies to dig in', 'Call a staff meeting'] : ['Send Able team forward to look', 'BAR team, set up a base of fire on the hedgerow corner', 'Ask Brennan what he thinks'], radio: [{ from: batt ? 'Iron Six' : 'Easy One-Six', to: batt ? 'Anvil Six' : 'Easy One-Two', text: 'Radio check, over.' }] });
  }
  if (/CONTACT! This is a sudden/.test(text)) return J(`The hedgerow ahead erupts. A machine gun, close, the sound of ripping canvas, and the leaves come down on your helmet.${casNote}\n\nWhat do you do in the next five seconds?`, { choices: [] });
  if (/\[ACTION: TALK/.test(text)) {
    const id = (text.match(/\[id (p\d+)\]/) || [])[1] || 'p1';
    return J(`"${w.length > 30 ? 'I hear you.' : 'Yeah?'}" He wipes rain off his face. "We go where you say. Just say it clear."`, { speaker: `npc:${id}`, choices: ['Tell him the plan', 'Ask how the men are'], changes: { mood: { [id]: 'steady' }, said: { [id]: 'We go where you say. Just say it clear.' } } });
  }
  if (/\[ACTION: STAFF MEETING/.test(text) || /\[ACTION: CHECK ON THE MEN/.test(text)) return J('They gather around the map with their own versions of the truth. The S2 hedges; the S3 does not; the S4 counts fuel. Nobody agrees, which is how you know they are telling you what they think.', { choices: ['Back the S2', 'Back the S3', 'Commit the reserve now'], changes: { facts: ['The staff disagrees about the enemy main effort.'] } });
  if (/\[ACTION: ASKS FOR ADVICE/.test(text)) return J('"Can\'t tell you what\'s over there, Sarge," he says. "But I wouldn\'t walk across that field standing up."', { choices: ['Find another way around', 'Call the mortars first'] });
  if (/\[ACTION: RADIO/.test(text)) return J('The handset crackles. "Roger, understood, wait, out." Then nothing but rain on the antenna.', { speaker: 'net:higher', radio: [{ from: text.includes('Anvil') ? 'Iron Six' : 'Easy One-Six', to: 'you', text: 'Roger your last. Wait, out.' }], choices: ['Carry on', 'Check the map'] });
  if (/\[ACTION: PLANNING/.test(text)) return J('The leaders squat in the mud around a map case and you talk it through twice. Russo asks the question everyone was thinking. You answer it. They go back to their men.', { choices: ['Rehearse it once more', 'Carry on to H-hour'] });
  if (/\[ACTION: REST/.test(text)) return J('You sleep in a hole that smells of turnips and wake to Brennan\'s hand on your shoulder.', { choices: ['Get a report', 'Carry on'] });
  if (/\[ACTION: GO FORWARD/.test(text)) return J('The jeep bucks over the ruts. Up close the company is smaller than it looks on the board, and much more tired. A sergeant shows you the ground with his rifle barrel.', { choices: ['Return to the command post', 'Talk to the company commander'] });
  if (/\[ACTION: END THE OPERATION|THE OPERATION HAS ENDED/.test(text)) return J('It is over, the way these things end: not with a moment but with a gradual silence, and then somebody lighting a cigarette.', { choices: [] });
  if (/\[ACTION: CONSOLIDATE/.test(text)) return J(`Ammunition goes from hand to hand. The wounded go back on doors and ponchos. The men dig without being told.${casNote}`, { choices: ['Report to higher', 'Check on the men'] });
  // Orders the parser could not read: hand one back as structured orders.
  const unparsed = (text.match(/NOT PARSED BY THE GAME: ([^\n]+)/) || [])[1] || '';
  const changes = {};
  if (/hedge|flank|left/i.test(unparsed) && units.includes('u3')) changes.orders = [{ unit: 'u3', task: 'move', target: 'G10' }];
  if (/prisoner/i.test(w)) changes.intel = [{ text: 'A prisoner says the gun on the road comes every morning.', cell: 'P5', source: 'prisoner', reliability: 'C3', about: null }];
  const lines = [...text.matchAll(/^- (.+)$/gm)].map(m => m[1]).slice(0, 2).join(' ');
  return J(`${w ? `"${w.slice(0, 80)}," you say, and the men move. ` : ''}${lines ? `${lines.replace(/\(decided[^)]*\)/g, '').slice(0, 300)} ` : 'Rain, the smell of cordite, someone praying under his breath. '}${casNote}`.trim(), { choices: ['Carry on', 'Check on the men', 'Call for fire on the hedgerow corner'], changes });
}

const server = http.createServer((req, res) => {
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
  if (req.method !== 'POST' || !req.url.endsWith('/chat/completions')) { res.writeHead(404, cors); return res.end('not found'); }
  let body = '';
  req.on('data', c => { body += c; });
  req.on('end', () => {
    let msgs = [], parsed = {};
    try { parsed = JSON.parse(body); msgs = parsed.messages || []; } catch { /* ignore */ }
    const asked = parsed.max_tokens ?? parsed.max_completion_tokens;
    if (MAX_TOKENS && asked > MAX_TOKENS) { res.writeHead(400, { ...cors, 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ error: { message: `Invalid max_tokens value, the valid range of max_tokens is [1, ${MAX_TOKENS}]` } })); }
    if (NO_JSON && parsed.response_format) { res.writeHead(400, { ...cors, 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ error: { message: 'This model does not support response_format json_object' } })); }
    const last = [...msgs].reverse().find(m => m.role === 'user')?.content || '';
    const out = reply(typeof last === 'string' ? last : JSON.stringify(last), msgs, parsed);
    const text = typeof out === 'string' ? out : out.text;
    const finish = typeof out === 'string' ? 'stop' : out.finish;
    res.writeHead(200, { ...cors, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' });
    const chunks = text.match(/[\s\S]{1,80}/g) || [];
    let i = 0;
    const tick = () => {
      if (i < chunks.length) { res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: chunks[i++] } }] })}\n\n`); setTimeout(tick, 2); }
      else { res.write(`data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: finish }] })}\n\n`); res.write('data: [DONE]\n\n'); res.end(); }
    };
    tick();
  });
});
server.listen(PORT, () => console.log(`mock GM listening on http://localhost:${PORT}/v1`));
