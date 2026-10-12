// Engine check: the code-owned systems in Node, no browser and no API key.
// Schema and samples, the grid, the orders parser, combat determinism, fires,
// comms, casualties and evacuation, morale, logistics, era gating, mission
// outcomes, the after-action review and campaign carry-over, the tolerant JSON
// parser, and operation generation through the provider layer against the mock
// (including a reply cut off at the output limit and continued).
//
//   node dev/engine-check.mjs

import { readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const R = p => import(path.join(here, '..', 'src', 'js', p));
const { validateOperation, normalizeOperation, deepClean } = await R('engine/schema.js');
const { newGameState, friendlyUnits, enemyUnits } = await R('engine/state.js');
const { echelonById, ECHELONS } = await R('data/echelons.js');
const { simulate, simCtx } = await R('engine/sim.js');
const { preResolve, checkEnd, buildSnapshot, describeAction, applyGMChanges } = await R('engine/gm.js');
const { parseOrders, findGridRef } = await R('engine/orders.js');
const { requestFire, processFires } = await R('engine/fires.js');
const { woundPerson, tickWounded } = await R('engine/casualties.js');
const { requestSupply } = await R('engine/logistics.js');
const { evaluateMission } = await R('engine/objectives.js');
const { computeAAR } = await R('engine/aar.js');
const { buildCarry, continuationText, recordOperation } = await R('engine/campaign.js');
const { refOf, parseRef, hasLOS, findPath } = await R('engine/grid.js');
const { extractJSON, extractPartialNarrative } = await R('engine/json.js');
const { seededRandom } = await R('engine/util.js');
const { armyById, playerRank } = await R('data/armies.js');
const { eraById, branchesFor, ALL_THEATRES } = await R('data/eras.js');
const { makeInsignia } = await R('engine/insignia.js');
const { generateOperation } = await R('engine/generator.js');
const { getProvider } = await R('providers/index.js');
const { pickSeed } = await R('prompts/operation.js');
const { dockOrder } = await R('ui/panels/index.js').catch(() => ({ dockOrder: null }));

let failures = 0, passes = 0;
const ok = (cond, msg) => { if (cond) passes++; else { failures++; console.error(`  ✗ ${msg}`); } };
const section = t => console.log(`· ${t}`);
const sample = name => deepClean(JSON.parse(readFileSync(path.join(here, 'samples', name), 'utf8')));
const SQUAD_SETTINGS = { eraId: 'ww2', theatreId: 'ww2_west', armyId: 'us_ww2', branchId: 'airborne', echelonId: 'squad', mode: 'campaign', campaignLength: 4, difficulty: 'regular', ironman: false, tone: 'cinematic', dice: 'shown', background: 'hunter' };
const BN_SETTINGS = { eraId: 'coldwar', theatreId: 'fulda', armyId: 'us_coldwar', branchId: 'mechanized', echelonId: 'battalion', mode: 'single', difficulty: 'regular', ironman: false, tone: 'cinematic', dice: 'hidden', background: 'staff' };
function squadGame() { const op = sample('squad-attack-1944.json'); normalizeOperation(op, { echelon: echelonById('squad') }); return newGameState({ settings: SQUAD_SETTINGS, truth: op, player: { name: 'Jack Mercer', hometown: 'Altoona PA' } }); }
function bnGame() { const op = sample('battalion-defense-1985.json'); normalizeOperation(op, { echelon: echelonById('battalion') }); return newGameState({ settings: BN_SETTINGS, truth: op, player: { name: 'Anne Kessler' } }); }

section('schema and samples');
ok(validateOperation(sample('squad-attack-1944.json'), { echelonId: 'squad', unitCounts: [2, 4] }).length === 0, 'squad sample validates');
ok(validateOperation(sample('battalion-defense-1985.json'), { echelonId: 'battalion', unitCounts: [4, 8] }).length === 0, 'battalion sample validates');
const broken = sample('squad-attack-1944.json'); broken.terrain.features[0].line = ['Z99', 'A1']; delete broken.mission.opord; broken.intel = [];
const probs = validateOperation(broken, { echelonId: 'squad', unitCounts: [2, 4] });
ok(probs.some(p => /invalid square/.test(p)) && probs.some(p => /opord/.test(p)) && probs.some(p => /intel/.test(p)), `broken operation reports its problems (${probs.length})`);
ok(deepClean({ a: 'null', b: ['N/A', 'x'], c: { d: 'none' } }).a === null && deepClean({ b: ['N/A', 'x'] }).b.length === 1, 'deepClean turns "null", "N/A", "none" into nothing');

section('grid');
const s1 = squadGame(); const n = s1.grid.n;
ok(refOf(n, parseRef(n, 'C4')) === 'C4' && parseRef(n, 'Z9') === -1 && parseRef(n, 'c-12') === parseRef(n, 'C12'), 'grid references round-trip');
ok(s1.grid.cells[parseRef(n, 'H6')].road && s1.grid.cells[parseRef(n, 'A10')].road, 'roads are rasterised');
ok(s1.grid.cells[parseRef(n, 'N3')].elev >= 2, 'Hill 30 has elevation');
ok(!hasLOS(s1.grid, parseRef(n, 'H14'), parseRef(n, 'H8')), 'the hedgerow at row 12 blocks line of sight from the sunken lane to row 8');
ok(findPath(s1.grid, parseRef(n, 'H14'), parseRef(n, 'H6'), 'foot').length > 0, 'a path exists to the objective');
const sb = bnGame();
ok(sb.grid.cells[parseRef(sb.grid.n, 'D3')].water || sb.grid.cells[parseRef(sb.grid.n, 'E3')].water, 'the Fulda is water');
ok(sb.grid.cells.some(c => c.bridge), 'the B27 crosses the Fulda on a bridge');
ok(findGridRef(16, 'send a 2-man team to C4') === parseRef(16, 'C4') && findGridRef(16, 'a 2 minute halt') === -1 && findGridRef(16, 'move to d5') === parseRef(16, 'D5'), 'grid references in prose are found, "a 2-man" is not A2');

section('orders parser');
let p = parseOrders(s1, 'BAR team, base of fire on I9; Able team, bound left to G10 in order to flank the gun.');
ok(p.orders.length === 2 && p.orders[0].unitIds[0] === 'u2' && p.orders[0].task === 'suppress' && refOf(n, p.orders[0].cell) === 'I9', 'BAR team suppress I9');
ok(p.orders[1].unitIds[0] === 'u1' && p.orders[1].task === 'move' && refOf(n, p.orders[1].cell) === 'G10' && p.orders[1].quality >= 2, 'Able team move G10 with a purpose scores higher');
p = parseOrders(s1, 'Brennan, assault the farm');
ok(p.orders[0]?.unitIds[0] === 'u1' && p.orders[0]?.task === 'assault' && refOf(n, p.orders[0].cell)[0] === 'I', 'a leader\'s name and a feature name work');
p = parseOrders(s1, 'I move to H12');
ok(p.orders[0]?.unitIds[0] === 'u0', 'orders to yourself');
p = parseOrders(s1, 'mortars on I9, fire for effect');
ok(p.fire && refOf(n, p.fire.cell) === 'I9' && p.fire.method === 'ffe', 'a call for fire in prose');
p = parseOrders(s1, 'Tell the men they did well and ask Russo about his hands');
ok(!p.orders.length && p.unparsed.length, 'speech is left for the GM');
p = parseOrders(sb, 'C Company, move to G6. Charlie, assault H7. Scouts recon K7. All units dig in.');
ok(p.orders[0]?.unitIds[0] === 'u3' && p.orders[0]?.task === 'move', 'lettered companies');
ok(p.orders.some(o => o.task === 'recon' && o.unitIds[0] === 'u5'), 'scouts by type');
ok(p.orders.some(o => o.task === 'dig_in' && o.unitIds.length === 5), 'all units');

section('combat determinism');
const run = seed => { const st = squadGame(); const ctx = simCtx(st, seededRandom(seed)); preResolve(st, { type: 'free', text: 'Able team assault I9. BAR team suppress I9. Baker team move to H10.' }, ctx); simulate(st, 120, { ctx }); return JSON.stringify({ u: Object.values(st.units).map(u => [u.cell, u.strength, Math.round(u.morale)]), s: st.stats }); };
ok(run('d1') === run('d1'), 'same seed, same battle');
ok(run('d1') !== run('d2'), 'different seed, different battle');
{
  const st = squadGame(); const ctx = simCtx(st, seededRandom('kill'));
  preResolve(st, { type: 'free', text: 'Able team assault I9. BAR team suppress I9. Baker team assault I9' }, ctx);
  simulate(st, 200, { ctx });
  ok(st.stats.enemyKIA + st.stats.enemyWIA + st.stats.friendlyKIA + st.stats.friendlyWIA > 0, 'an attack produces casualties');
  ok(Object.values(st.people).some(x => x.status !== 'ok'), 'casualties fall on named soldiers at squad level');
}

section('fires');
{
  const st = squadGame(); const ctx = simCtx(st, seededRandom('f'));
  const r = requestFire(st, { cell: parseRef(n, 'I9'), kind: 'HE', quality: 0.9, method: 'adjust' }, ctx);
  ok(r.ok && r.delay >= 1 && st.fires.assets[0].left === 4, 'a fire mission is accepted and uses a mission');
  st.clock.minutes = r.mission.impactAt; const rep = { lines: [], casualties: [], enemyHits: [], fires: [] };
  processFires(st, ctx, rep);
  ok(r.mission.status === 'done' && r.mission.impact >= 0 && rep.lines.length, 'it lands and is reported');
  let off = 0; for (let i = 0; i < 40; i++) { const r2 = requestFire(st, { cell: parseRef(n, 'K6'), assetId: 'a1', kind: 'HE', quality: 0.1 }, ctx); if (!r2.ok) { st.fires.assets[0].left = 5; continue; } st.clock.minutes = r2.mission.impactAt; processFires(st, ctx, { lines: [], casualties: [], enemyHits: [], fires: [] }); if (!r2.mission.hit) off++; st.fires.assets[0].left = 5; }
  ok(off >= 6, `a sloppy call for fire often lands off target (${off}/40)`);
  st.clock.minutes = 0; const blocked = requestFire(st, { cell: parseRef(n, 'K6'), assetId: 'a2', kind: 'HE', quality: 1 }, ctx);
  ok(!blocked.ok && /not available/.test(blocked.reason), 'an asset outside its window refuses');
}

section('comms and delays');
{
  const st = bnGame(); const ctx = simCtx(st, seededRandom('c'));
  const a = preResolve(st, { type: 'free', text: 'A Company, move to H8' }, ctx).issued[0];
  st.units.u2.radio = 'down';
  const b = preResolve(st, { type: 'free', text: 'B Company, move to G5' }, ctx).issued[0];
  ok(a.delay > 0 && b.delay > a.delay, `orders take time at battalion, longer by runner (${a.delay} vs ${b.delay} min)`);
  st.clock.minutes = 89; simulate(st, 2, { ctx });
  ok(st.flags.includes('jammed'), 'the jamming event fires on time');
}

section('casualties and evacuation');
{
  const st = squadGame(); const ctx = simCtx(st, seededRandom('w'));
  const victim = Object.values(st.people).find(x => !x.isPlayer && !x.leader);
  woundPerson(st, victim, ctx, 'fire', 'serious');
  ok(victim.status === 'wia' && victim.wound.evacAt > 0, 'a serious wound needs evacuation');
  const out = preResolve(st, { type: 'radio', template: 'medevac', fields: { l1: 'H13', l2: 'Easy One-Two', l3: '1 urgent', l4: 'none', l5: '1 litter', l6: 'no enemy', l7: 'smoke', l8: 'US military', l9: 'none' } }, ctx);
  ok(victim.wound.medevacAsked && out.radio.quality === 1, 'a complete casualty request is accepted');
  st.clock.minutes = victim.wound.evacAt + 1; tickWounded(st, ctx, { lines: [], casualties: [] });
  ok(['evac', 'kia'].includes(victim.status), 'the wounded man is evacuated (or died first)');
  const p0 = st.people.p0; woundPerson(st, p0, ctx, 'fire', 'kia');
  ok(p0.status !== 'kia', 'on Regular the player cannot be killed');
}

section('morale and surrender');
{
  const st = squadGame(); const ctx = simCtx(st, seededRandom('m'));
  const u = st.units.u3; u.morale = 10; u.suppression = 90; u.engagedAt = st.clock.minutes + 1;
  const e = st.units.e1; e.cell = parseRef(n, 'I12'); st.picture.contacts.e1 = { id: 'e1', cell: e.cell, at: 1, confidence: 'confirmed' }; st.enemyKnows = { u3: { cell: u.cell, at: 1 } };
  const rep = simulate(st, 4, { ctx });
  ok(u.posture === 'broken' || rep.moraleBreaks.length, 'a shattered team breaks');
}

section('logistics');
{
  const st = squadGame(); const ctx = simCtx(st, seededRandom('l'));
  const w0 = st.logistics.water; simulate(st, 120, { ctx }); ok(st.logistics.water < w0, 'water is drunk');
  const r = requestSupply(st, 'ammo', ctx); ok(r.ok && r.request.eta > st.clock.minutes, 'a resupply request takes time');
  st.clock.minutes = r.request.eta - 1; simulate(st, 2, { ctx }); ok(['delivered', 'failed'].includes(r.request.status), 'and then arrives or fails');
}

section('era gating');
ok(!branchesFor(armyById('us_ww1'), eraById('ww1')).some(b => b.id === 'airborne'), 'no airborne in 1916');
ok(branchesFor(armyById('usmc_ww2'), eraById('ww2')).some(b => b.id === 'marines'), 'marines for the Marine Corps');
ok(playerRank(armyById('brit_ww2'), 'company').full === 'Major' && playerRank(armyById('ger_ww2'), 'corps', { branch: 'armor' }).full === 'General der Panzertruppe' && playerRank(armyById('us_vietnam'), 'squad').abbr === 'SSG', 'rank titles by army and era');
ok(ALL_THEATRES.every(t => t.armies.every(a => armyById(a))), 'every theatre\'s armies exist');
ok(!ALL_THEATRES.some(t => /ukrain|gaza|sudan|myanmar/i.test(t.name)), 'no ongoing wars offered');
ok(ECHELONS.find(e => e.id === 'fireteam').panels.includes('roster') && !ECHELONS.find(e => e.id === 'fireteam').panels.includes('staff'), 'panels by command level');
ok(makeInsignia({ seed: 'a' }).svg.includes('<svg') && makeInsignia({ seed: 'a' }).svg !== makeInsignia({ seed: 'b' }).svg, 'insignia generated per unit');

section('mission outcomes, the review and the campaign');
{
  const st = squadGame(); const ctx = simCtx(st, seededRandom('o'));
  for (const id of ['e1', 'e2', 'e4']) { st.units[id].destroyed = true; st.units[id].strength = 0; }
  st.units.u1.cell = parseRef(n, 'H6'); st.units.u3.cell = parseRef(n, 'I5'); st.clock.minutes = 100;
  evaluateMission(st); evaluateMission(st); const ev = evaluateMission(st);
  ok(ev.status === 'success', `holding the objective is a success (${ev.status})`);
  for (const x of Object.values(st.people).filter(q => !q.isPlayer && !q.leader).slice(0, 3)) x.status = 'kia';
  st.ended = { kind: 'complete', at: st.clock.minutes, outcome: 'success' };
  st.recommendations = [{ personId: st.units.u1.leaderId, awardId: 'bsv', citation: 'Led the assault on the crossroads under fire and carried a wounded man back.' }];
  const aar = computeAAR(st, seededRandom('aar'));
  ok(aar.rating.score > 0 && aar.rating.grade && aar.awards.recommended.length === 1, 'the review rates the operation and decides awards');
  ok(aar.deceptions.some(d => /decoy|dummy|false/i.test(`${d.truth} ${d.what}`)), 'deceptions are unsealed');
  recordOperation(st, aar);
  const carry = buildCarry(st, aar);
  ok(carry.veterans.length > 5 && carry.campaign.index === 2, 'survivors carry into the next operation');
  ok(/operation 2/.test(continuationText(st, aar)), 'the next operation is told what came before');
  const op2 = sample('squad-attack-1944.json'); normalizeOperation(op2, { echelon: echelonById('squad') });
  const st2 = newGameState({ settings: SQUAD_SETTINGS, truth: op2, player: { name: 'Jack Mercer' }, carry });
  ok(Object.values(st2.people).some(x => x.veteran) && Object.values(st2.people).some(x => x.replacement), 'veterans and replacements in the next operation');
}

section('the GM turn plumbing');
{
  const st = squadGame(); const ctx = simCtx(st, seededRandom('g'));
  const pre = preResolve(st, { type: 'free', text: 'Able team move to G10. Tell Russo to keep his head down.' }, ctx);
  const rep = simulate(st, pre.minutes, { ctx });
  const txt = describeAction(st, { type: 'free', text: 'x' }, pre, rep, ctx);
  ok(/ORDERS UNDERSTOOD BY THE GAME/.test(txt) && /NOT PARSED BY THE GAME/.test(txt) && /WHAT HAPPENED/.test(txt), 'the action text carries orders, unparsed clauses and results');
  const snap = buildSnapshot(st, ctx); ok(snap.units.length >= 4 && snap.mission.objective.length === 2 && JSON.stringify(snap).length < 20000, 'the snapshot is compact');
  const notices = applyGMChanges(st, { orders: [{ unit: 'u3', task: 'move', target: 'H10' }, { unit: 'e1', task: 'withdraw', target: 'P1' }], mood: { [st.units.u1.leaderId]: 'grim' }, standing: { superiors: 50 }, facts: ['The orchard is quiet.'] }, ctx, { issued: [] });
  ok(st.units.u3.order?.task === 'move' && st.units.e1.order?.task !== 'withdraw', 'GM orders are validated: friendly yes, enemy no');
  ok(st.standing.superiors <= 65 && notices.length >= 1, 'GM changes are clamped');
  st.people.p0.status = 'kia'; checkEnd(st, rep, {}, ctx); ok(st.ended?.kind === 'kia', 'the code ends the operation');
}

section('tolerant JSON');
ok(extractJSON('Sure! ```json\n{"narrative": "a", "choices": ["x",],}\n```').narrative === 'a', 'fences and trailing commas');
ok(extractJSON('{"narrative": "cut off here", "changes": {"facts": ["one"').narrative === 'cut off here', 'a cut-off object is repaired');
ok(extractPartialNarrative('{"narrative": "The rain \\"hisses\\" on') === 'The rain "hisses" on', 'partial narrative for the typewriter');

section('operation generation through the provider layer (mock, cut off and continued)');
{
  const PORT = 8794;
  const mock = spawn(process.execPath, [path.join(here, 'mock-gm.js')], { env: { ...process.env, PORT: String(PORT), MOCK_TRUNCATE: '1' }, stdio: ['ignore', 'pipe', 'inherit'] });
  await new Promise((res, rej) => { mock.stdout.on('data', d => { if (String(d).includes('listening')) res(); }); setTimeout(() => rej(new Error('mock did not start')), 8000); });
  try {
    const provider = getProvider('custom');
    const army = armyById('us_ww2'); const echelon = echelonById('squad');
    const args = { era: eraById('ww2'), theatre: ALL_THEATRES.find(t => t.id === 'ww2_west'), army, branch: { id: 'infantry', name: 'Infantry' }, echelon, difficulty: { id: 'regular', name: 'Regular', blurb: '' }, settings: { ...SQUAD_SETTINGS, start: 'orders' }, player: { name: 'Test' }, background: null, rank: playerRank(army, 'squad'), seed: pickSeed(seededRandom('s')), cellM: 100, gridN: 16 };
    const msgs = [];
    const op = await generateOperation({ provider, apiKey: 'x', model: 'mock', baseUrl: `http://localhost:${PORT}/v1`, args, onProgress: m => msgs.push(m) });
    ok(op.codename === 'IRON HARROW' && msgs.some(m => /cut off/.test(m)), 'a cut-off operation is continued and stitched');
  } catch (err) { ok(false, `generation through the mock: ${err.message}`); }
  finally { mock.kill(); }
}

void friendlyUnits; void enemyUnits; void dockOrder;
console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
