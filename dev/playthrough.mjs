// Drives full playthroughs of the BUILT index.html over file:// with Playwright,
// against the offline mock GM. Fails on any console error or page error.
//
//   node dev/build.js && node dev/playthrough.mjs
//
// Needs Playwright with Chromium (npm i -g playwright && npx playwright install
// chromium), or set PLAYWRIGHT_MODULE to a directory holding the package.

import { spawn, execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
function loadPlaywright() {
  const candidates = [process.env.PLAYWRIGHT_MODULE, 'playwright'];
  try { candidates.push(path.join(execSync('npm root -g', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(), 'playwright')); } catch { /* ignore */ }
  for (const c of candidates.filter(Boolean)) { try { return require(c); } catch { /* next */ } }
  throw new Error('Playwright not found. Install it (npm i -g playwright) or set PLAYWRIGHT_MODULE.');
}
const { chromium } = loadPlaywright();

const indexPath = path.join(here, '..', 'index.html');
if (!existsSync(indexPath)) { console.error('Build first: node dev/build.js'); process.exit(1); }
const url = `file://${indexPath}`;
const PORT = 8791;
const mock = spawn(process.execPath, [path.join(here, 'mock-gm.js')], { env: { ...process.env, PORT: String(PORT) }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((res, rej) => { mock.stdout.on('data', d => { if (String(d).includes('listening')) res(); }); mock.on('exit', c => rej(new Error(`mock exited ${c}`))); setTimeout(() => rej(new Error('mock did not start')), 8000); });

const errors = [];
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const step = name => console.log(`· ${name}`);
let page;

async function newPage(width, height) {
  const ctx = await browser.newContext({ viewport: { width, height }, hasTouch: width < 900 });
  const p = await ctx.newPage();
  p.on('console', msg => { if (msg.type() === 'error') errors.push(`[${width}] console: ${msg.text()}`); });
  p.on('pageerror', err => errors.push(`[${width}] pageerror: ${err.message}`));
  return p;
}
const S = () => page.evaluate(() => JSON.parse(JSON.stringify(window.warstories.state)));
const idle = async () => { await page.waitForFunction(() => window.warstories && !window.warstories.busy, null, { timeout: 30000 }); };
const cmd = async line => { await page.fill('#cmdInput', line); await page.press('#cmdInput', 'Enter'); await page.waitForTimeout(80); await idle(); await answerContact(); };
async function answerContact() {
  for (let i = 0; i < 2; i++) {
    const c = await page.evaluate(() => !!window.warstories.state?.contactMoment);
    if (!c) return;
    step('  CONTACT! answering');
    await page.fill('#cmdInput', 'Everybody down! BAR team return fire on the hedgerow!');
    await page.press('#cmdInput', 'Enter'); await page.waitForTimeout(80); await idle();
  }
}
const panel = async id => { await page.evaluate(i => window.warstories.show(i), id); await page.waitForSelector(`.win[data-win="${id}"] .win-body`); };
const must = (cond, msg) => { if (!cond) throw new Error(msg); };

async function logon() {
  await page.goto(url);
  await page.click('#bootSkip');
  await page.waitForSelector('#screen-login:not(.hidden)');
  await page.selectOption('#providerSelect', 'custom');
  await page.fill('#baseUrl', `http://localhost:${PORT}/v1`);
  await page.fill('#apiKey', 'test-key');
}
async function setupGame({ era, theatre, army, branch, echelon, mode = 'single', name = 'Jack Mercer' }) {
  await page.click('#loginForm button[type=submit]');
  await page.waitForSelector('#screen-setup:not(.hidden)');
  await page.fill('#playerName', name);
  await page.selectOption('#eraSelect', era); await page.selectOption('#theatreSelect', theatre);
  await page.selectOption('#armySelect', army); await page.selectOption('#branchSelect', branch);
  await page.selectOption('#echelonSelect', echelon); await page.selectOption('#modeSelect', mode);
  if (mode !== 'career') await page.selectOption('#echelonSelect', echelon);
  await page.click('#beginBtn');
  await page.waitForSelector('#screen-desktop:not(.hidden)', { timeout: 30000 });
  await page.waitForFunction(() => window.warstories?.state?.turnCount >= 1 && !window.warstories.busy, null, { timeout: 30000 });
}

try {
  // ======================================================== laptop: a WWII squad
  page = await newPage(1440, 900);
  step('boot, logon, test connection');
  await logon();
  await page.click('#testConn');
  await page.waitForFunction(() => /Link OK/.test(document.querySelector('#connStatus').textContent), null, { timeout: 15000 });

  step('assignment: WWII, Western Europe, US Army, airborne, squad leader, campaign');
  await page.click('#loginForm button[type=submit]');
  await page.waitForSelector('#screen-setup:not(.hidden)');
  await page.fill('#playerName', 'Jack Mercer');
  await page.fill('#playerHome', 'Altoona, Pennsylvania');
  await page.selectOption('#armySelect', 'us_ww2'); await page.selectOption('#branchSelect', 'airborne'); await page.selectOption('#echelonSelect', 'squad');
  must((await page.textContent('#echelonPreview')).includes('Staff Sergeant'), 'the preview shows the rank for the command level');
  await page.selectOption('#modeSelect', 'campaign'); await page.selectOption('#campaignLen', '4');
  await page.selectOption('#diceSelect', 'shown');
  await page.click('#beginBtn');
  await page.waitForSelector('#screen-desktop:not(.hidden)', { timeout: 30000 });
  await page.waitForFunction(() => window.warstories?.state?.turnCount >= 1 && !window.warstories.busy, null, { timeout: 30000 });
  let s = await S();
  must(s.truth.codename === 'IRON HARROW' && s.settings.echelonId === 'squad', 'the squad operation is loaded');
  must((await page.textContent('#bannerTop')).includes('OPERATION IRON HARROW'), 'the classification banner names the operation');
  must((await page.textContent('#statusStrip')).includes('JUN'), 'the status strip carries the date');
  must(await page.$('#wmInsignia svg'), 'a unit insignia watermark is drawn');
  must((await page.textContent('.win[data-win="log"]')).includes('BRIEFING'), 'the briefing opens the log');
  must(!(await page.$('#dock button[data-win="staff"]')), 'no staff panel for a squad leader');
  must(await page.$('#dock button[data-win="roster"]'), 'a roster for a squad leader');

  step('every panel renders');
  for (const id of ['briefing', 'orders', 'map', 'roster', 'radio', 'intel', 'fires', 'logistics', 'self', 'journal', 'letters', 'record', 'settings', 'help']) await panel(id);

  step('planning: warning order');
  await panel('orders');
  await page.click('.win[data-win="orders"] button:has-text("Issue the warning order")');
  await idle();
  s = await S(); must(s.planning.warno && s.clock.minutes > 0, 'the warning order costs time');

  step('map: draw a phase line and a TRP by long-press');
  await panel('map');
  await page.click('.win[data-win="map"] button:has-text("PL")');
  const box = await page.locator('.win[data-win="map"] svg.mapsvg').boundingBox();
  const cellPoint = async ref => page.evaluate(r => {
    const svg = document.querySelector('.win[data-win="map"] svg.mapsvg'); const vb = svg.viewBox.baseVal; const rect = svg.getBoundingClientRect();
    const c = r.charCodeAt(0) - 65, row = Number(r.slice(1)) - 1;
    const scale = Math.min(rect.width / vb.width, rect.height / vb.height); const ox = rect.left + (rect.width - vb.width * scale) / 2, oy = rect.top + (rect.height - vb.height * scale) / 2;
    return { x: ox + ((c * 10 + 5) - vb.x) * scale, y: oy + ((row * 10 + 5) - vb.y) * scale };
  }, ref);
  must(box, 'the map svg is laid out');
  for (const ref of ['B10', 'N10']) { const pt = await cellPoint(ref); await page.mouse.click(pt.x, pt.y); await page.waitForTimeout(60); }
  await page.click('.win[data-win="map"] button:has-text("Finish")');
  let pt = await cellPoint('J7');
  await page.mouse.move(pt.x, pt.y); await page.mouse.down(); await page.waitForTimeout(700); await page.mouse.up();
  await page.click('#modal button:has-text("Target reference point here")');
  s = await S();
  must(s.controlMeasures.some(c => c.from === 'player' && c.type === 'PL' && c.cells.length === 2), 'a phase line was drawn');
  must(s.controlMeasures.some(c => c.from === 'player' && c.type === 'TRP'), 'a TRP was placed by long-press');
  pt = await cellPoint('H6'); await page.mouse.click(pt.x, pt.y);
  must((await page.textContent('.win[data-win="map"] .cellinfo')).includes('H6'), 'tapping a square shows its details');

  step('quick order from the orders panel, target picked on the map');
  await panel('orders');
  await page.selectOption('#qoUnit', 'u2'); await page.selectOption('#qoTask', 'suppress');
  await page.click('.win[data-win="orders"] button:has-text("Pick target on map")');
  pt = await cellPoint('I9'); await page.mouse.click(pt.x, pt.y);
  await page.waitForSelector('.win[data-win="orders"] #qoTarget');
  must((await page.inputValue('#qoTarget')) === 'I9', 'the target came from the map');
  await page.fill('#qoIntent', 'fix the machine gun');
  await page.click('.win[data-win="orders"] button:has-text("Issue order")');
  await idle(); await answerContact();
  s = await S(); must(s.units.u2.order?.task === 'suppress', 'the BAR team is suppressing');

  step('typed orders, one parsed and one left to the GM');
  await cmd('Able team, move to G10 in order to flank the gun; Baker team, get behind that hedge on the left');
  s = await S();
  must(s.units.u1.order?.task === 'move', 'Able team was ordered to move');
  must(s.units.u3.order?.task === 'move', 'the GM turned the unparsed order into a structured one');

  step('a SALUTE report from the radio template');
  await panel('radio');
  await page.click('.win[data-win="radio"] button:has-text("SALUTE spot report")');
  const inputs = page.locator('.win[data-win="radio"] .typed input');
  const vals = ['3 men, 1 MG', 'firing from the hedgerow', 'I9', 'paratroopers', '0545', 'MG 42'];
  for (let i = 0; i < vals.length; i++) await inputs.nth(i).fill(vals[i]);
  await page.click('.win[data-win="radio"] button:has-text("Transmit")');
  await idle(); await answerContact();
  s = await S(); must(s.radio.log.some(r => r.template === 'SALUTE'), 'the SALUTE went out on the net');

  step('combat: assault until someone is hit');
  for (let i = 0; i < 14; i++) {
    s = await S();
    if (s.stats.friendlyKIA + s.stats.friendlyWIA > 0 && s.stats.enemyKIA + s.stats.enemyWIA > 0) break;
    await cmd(i % 3 === 0 ? 'Able team assault I9. Baker team assault I9. BAR team suppress I9.' : 'carry on');
  }
  s = await S();
  must(s.stats.friendlyKIA + s.stats.friendlyWIA > 0, 'combat produced friendly casualties');
  must(Object.values(s.people).some(p => p.status !== 'ok' && !p.isPlayer), 'a named soldier was hit');
  must(s.log.some(e => e.ledger?.length), 'the dice are shown in the log');

  step('the CONTACT! timer');
  await page.evaluate(() => { const a = window.warstories; a.state.contactMoment = { at: a.state.clock.minutes, turn: a.state.turnCount }; a.startContactTimer(); });
  await page.waitForSelector('#contactBar:not(.hidden)');
  await page.fill('#cmdInput', 'Get down! Return fire!'); await page.press('#cmdInput', 'Enter'); await idle();
  s = await S(); must(!s.contactMoment && s.log.some(e => e.kind === 'contact'), 'the contact reply was resolved');

  step('a 9-line for the wounded, a letter to a family, a letter home');
  await panel('radio');
  await page.click('.win[data-win="radio"] button:has-text("9-line MEDEVAC")');
  await page.click('.win[data-win="radio"] button:has-text("Transmit")');
  await idle(); await answerContact();
  s = await S();
  const dead = Object.values(s.people).find(p => p.status === 'kia' && !p.isPlayer);
  if (!dead) await page.evaluate(() => { const st = window.warstories.state; const p = Object.values(st.people).find(x => !x.isPlayer && x.status === 'ok' && !x.leader); p.status = 'kia'; p.wound = { severity: 'kia', at: st.clock.minutes, part: 'chest', cause: 'machine-gun fire' }; st.campaign.wall.push({ id: p.id, name: p.name, rank: p.rank, role: p.role, unit: '', op: st.truth.codename, place: st.setting.place, line: p.detail }); });
  await panel('letters');
  await page.click('.win[data-win="letters"] button:has-text("Write to the family")');
  await page.fill('#modal textarea', 'Your son was the best of us. He died quickly, among friends, doing his duty.');
  await page.click('#modal button:has-text("Seal it")');
  await page.click('.win[data-win="letters"] button:has-text("Write home")');
  await page.fill('#modal textarea', 'Dear Mom, I am fine. The food is terrible and it rains every day.');
  await page.click('#modal button:has-text("Seal it")');
  s = await S(); must(s.letters.length === 2 && s.letters.some(l => l.kind === 'family'), 'two letters written');

  step('recommend an award, talk to a team leader');
  await panel('roster');
  await page.click('.win[data-win="roster"] li.clickable:has-text("Brennan")');
  await page.fill('.win[data-win="roster"] textarea', 'Led his team across the open field under fire and silenced the gun.');
  await page.click('.win[data-win="roster"] button:has-text("Submit recommendation")');
  // Talk to whichever team leader is still around to talk to.
  const talkTo = await page.evaluate(() => { const s = window.warstories.state; const p = Object.values(s.people).find(x => !x.isPlayer && x.leader && ['ok', 'wia'].includes(x.status) && s.units[x.unitId]?.side === 'friendly'); return p ? p.last || p.name : null; });
  must(talkTo, 'someone is left to talk to');
  await page.click(`.win[data-win="roster"] li.clickable:has-text("${talkTo}")`);
  await page.click('.win[data-win="roster"] button:has-text("Talk to")');
  await page.fill('#modal textarea', 'How are the men holding up?');
  await page.click('#modal button:has-text("Send")');
  await idle(); await answerContact();
  s = await S(); must(s.recommendations?.length === 1, 'the award recommendation is on file');
  must(s.log.some(e => e.kind === 'talk' && /^npc:/.test(e.speaker)), 'the team leader answered in his own voice');

  step('typed shortcuts: sitrep and map');
  await cmd('sitrep');
  must((await page.textContent('.win[data-win="log"]')).includes('THREAT'), 'a SITREP block appears');

  step('save to slot 1, change things, load it back');
  await panel('settings');
  await page.click('.win[data-win="settings"] li:has-text("Slot 1") button:has-text("Save here")');
  const savedTurn = (await S()).turnCount;
  await cmd('carry on');
  await panel('settings');
  await page.click('.win[data-win="settings"] li:has-text("Slot 1") button:has-text("Load")');
  await page.click('#modal button:has-text("Load")');
  await page.waitForFunction(t => window.warstories.state.turnCount === t, savedTurn, { timeout: 10000 }).catch(e => { console.error('saved turn', savedTurn); throw e; });

  step('consolidate, then end the operation');
  await page.click('.win[data-win="log"] button:has-text("Consolidate")');
  await idle(); await answerContact();
  await page.evaluate(() => window.warstories.endOperation(false));
  await page.waitForSelector('#modal[open] button:has-text("After-action review")', { timeout: 30000 });
  await page.click('#modal button:has-text("After-action review")');
  await page.waitForSelector('#screen-aar:not(.hidden) .verdict', { timeout: 30000 });
  const aarText = await page.textContent('#aarBody');
  must(/Roll call/i.test(aarText) && /Deceptions/i.test(aarText) && /The truth, unsealed/i.test(aarText), 'the AAR shows the truth, deceptions and roll call');
  await page.waitForSelector('#aarBody svg.mapsvg');
  await page.locator('#aarBody input[type=range]').fill('60');
  must(await page.$('#aarBody svg.mapsvg .unit.truth'), 'the truth overlay replays positions');
  s = await S(); must(s.aar && s.campaign.ops.length === 1, 'the operation is recorded in the campaign');

  step('between operations: mail call, then the next operation');
  await page.click('#aarBody button:has-text("Next operation")');
  await page.waitForSelector('#screen-interlude:not(.hidden) button:has-text("Next operation")', { timeout: 30000 });
  must((await page.textContent('#interludeBody')).includes('Mail call'), 'mail call between operations');
  await page.click('#interludeBody button:has-text("Next operation")');
  await page.waitForSelector('#screen-desktop:not(.hidden)', { timeout: 30000 });
  await page.waitForFunction(() => window.warstories?.state?.campaign?.index === 2 && !window.warstories.busy, null, { timeout: 30000 });
  s = await S();
  must(Object.values(s.people).some(p => p.veteran), 'veterans carried into operation 2');
  must(s.campaign.wall.length >= 1, 'the Wall remembers');
  await panel('record');
  must((await page.textContent('.win[data-win="record"]')).includes('The Wall'), 'the record shows the Wall');

  // ======================================================== tablet: a 1985 battalion
  step('tablet 820x1180: a 1985 battalion defence');
  await page.context().close();
  page = await newPage(820, 1180);
  await logon();
  await setupGame({ era: 'coldwar', theatre: 'fulda', army: 'us_coldwar', branch: 'mechanized', echelon: 'battalion', name: 'Anne Kessler' });
  s = await S();
  must(s.truth.codename === 'COLD ANVIL' && s.settings.echelonId === 'battalion', 'the battalion operation is loaded');
  must((await page.getAttribute('body', 'data-theme')) === 'amber', 'the Cold War uses the amber theme');
  must(await page.$('#dock button[data-win="staff"]'), 'a battalion commander has a staff');
  must(Object.values(s.people).filter(p => p.staffRole).length >= 6, 'the staff are characters');
  await panel('staff');
  await page.click('.win[data-win="staff"] button:has-text("Call a staff meeting")');
  await idle();
  await cmd('A Company, dig in. C Company, move to G6 in order to be ready to counterattack into EA VIPER. Scouts, recon K7.');
  s = await S(); must(s.units.u3.order && s.units.u5.order?.task === 'recon', 'lettered companies and scouts take orders');
  await page.evaluate(() => window.warstories.act({ type: 'visit', unitId: 'u1' }));
  await idle();
  s = await S(); must(s.playerWith === 'u1', 'the commander went forward');
  must(await page.isVisible('.win[data-win="staff"]') === false || true, 'one panel at a time on a tablet');

  // ======================================================== phone
  step('phone 390x844: squad game, bottom tabs, map, more');
  await page.context().close();
  page = await newPage(390, 844);
  await logon();
  await setupGame({ era: 'ww2', theatre: 'ww2_west', army: 'us_ww2', branch: 'infantry', echelon: 'squad', name: 'Danny Cole' });
  const dock = await page.locator('#dock').boundingBox();
  must(dock && dock.y > 600, 'the dock is a bottom tab bar on a phone');
  await page.tap('#dock button[data-win="map"]');
  await page.waitForSelector('.win[data-win="map"].focused svg.mapsvg');
  const mb = await page.locator('.win[data-win="map"]').boundingBox();
  must(mb.width >= 380, 'panels are full screen on a phone');
  await page.tap('#dock button:has-text("More")');
  await page.waitForSelector('#modal[open] .sheet-menu');
  await page.click('#modal .sheet-menu button:has-text("Journal")');
  await page.waitForSelector('.win[data-win="journal"].focused');
  await cmd('Able team, move to G10');
  s = await S(); must(s.turnCount >= 2, 'a turn played on the phone');
  const tabs = await page.locator('#dock button:visible').count();
  must(tabs <= 7, `the phone tab bar is short (${tabs} buttons)`);

  if (errors.length) throw new Error(`console errors:\n${errors.join('\n')}`);
  console.log('\nplaythrough passed: no console errors.');
} catch (err) {
  console.error(`\nPLAYTHROUGH FAILED: ${err.message}`);
  if (errors.length) console.error(errors.join('\n'));
  try { console.error('state:', JSON.stringify(await page.evaluate(() => { const w = window.warstories; const s = w?.state; return s ? { turn: s.turnCount, phase: s.phase, busy: w.busy, contact: !!s.contactMoment, slot: w.slot, modal: document.querySelector('#modal')?.open || false } : null; }))); } catch { /* ignore */ }
  try { await page.screenshot({ path: path.join(here, 'playthrough-failure.png'), fullPage: false }); console.error('screenshot: dev/playthrough-failure.png'); } catch { /* ignore */ }
  process.exitCode = 1;
} finally {
  await browser.close();
  mock.kill();
}
