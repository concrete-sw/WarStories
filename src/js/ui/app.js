// Main controller: screens, the AI connection, new games, the desktop and its
// panels, the turn loop with streaming narrative, the CONTACT! timer, saves,
// the after-action review and the road between operations.

import { $, $$, h, clear, toast, modal, append, esc } from './dom.js';
import { Typewriter } from './typewriter.js';
import { WindowManager } from './windows.js';
import { runBoot } from './boot.js';
import { wireSetup } from './setup.js';
import { registerPanels, dockOrder, PHONE_TABS, ALL_PANELS } from './panels/index.js';
import { renderEntry, speakerLabel } from './panels/log.js';
import { renderAAR, renderInterlude } from './aarView.js';
import { sitrepText } from './sitrep.js';
import * as sound from './audio.js';
import { PROVIDERS, getProvider, complete } from '../providers/index.js';
import { generateOperation } from '../engine/generator.js';
import { pickSeed } from '../prompts/operation.js';
import { runTurn, playerLine } from '../engine/gm.js';
import { newGameState, addLog, addFact, ctxOf, migrateState, personLabel, friendlyUnits, liveUnit } from '../engine/state.js';
import { computeAAR, writeAAR, fallbackAAR } from '../engine/aar.js';
import { recordOperation, canContinue, nextSettings, continuationText, buildCarry, mailCall, writeLetter } from '../engine/campaign.js';
import { makeInsignia, unitNumber } from '../engine/insignia.js';
import { eraById, theatreById, branchById } from '../data/eras.js';
import { armyById, playerRank } from '../data/armies.js';
import { echelonById, difficultyById } from '../data/echelons.js';
import { backgroundById } from '../data/people.js';
import { formatHM, formatDate, formatDay, relH, lightAt, formatDuration } from '../engine/clock.js';
import { refOf } from '../engine/grid.js';
import { averageAmmo } from '../engine/logistics.js';
import { strengthPct } from '../engine/objectives.js';
import { WEATHER } from '../data/terrain.js';
import * as store from '../engine/storage.js';

const SPEED = { off: 0, fast: 4, normal: 12, slow: 26 };

export class App {
  constructor() {
    this.state = null; this.ctx = null;
    this.settings = store.loadSettings();
    this.api = store.loadApiConfig();
    this.busy = false; this.abort = null; this.slot = 0;
    this.wm = null; this.sel = {}; this.badges = {};
    this.mapView = null; this.draft = null; this.pickMode = null; this.orderDraft = null; this.opordDraft = null;
    this.contactTimer = null;
  }

  // ---------------------------------------------------------------- startup
  async init() {
    this.applySettings();
    this.setBanners('UNCLASSIFIED', 'bar unclass');
    $('#insigniaLogin').innerHTML = makeInsignia({ seed: 'warstories-title', branch: 'infantry', number: '', motto: 'STAND FAST' }).svg;
    if (/^https?:/.test(location.protocol)) { const l = document.createElement('link'); l.rel = 'manifest'; l.href = 'manifest.webmanifest'; document.head.append(l); }
    this.setupLogin();
    wireSetup(this);
    this.setupSetupExtras();
    this.setupDesktop();
    await runBoot($('#bootLog'), { reduceMotion: this.settings.reduceMotion });
    this.showScreen('login');
    if (!this.isNarrow()) $('#apiKey').focus();
  }

  isNarrow() { return window.matchMedia('(max-width: 900px)').matches; }

  showScreen(name) {
    for (const s of $$('.screen')) s.classList.add('hidden');
    $(`#screen-${name}`).classList.remove('hidden');
    if (name !== 'desktop') this.stopContactTimer();
    if (['login', 'setup', 'boot'].includes(name)) { this.setBanners('UNCLASSIFIED', 'bar unclass'); this.applyTheme(null); }
  }

  toast(text, kind = '', ms) { toast(text, kind, ms); }

  applySettings() {
    const s = this.settings;
    document.body.classList.toggle('reduce-motion', !!s.reduceMotion);
    document.body.dataset.contrast = s.highContrast ? 'high' : 'normal';
    document.body.dataset.text = s.textSize || 'normal';
    sound.setSound(!!s.sound, s.volume ?? 0.4);
    this.applyTheme(this.state);
    store.saveSettings(s);
  }

  applyTheme(state) {
    const era = state ? eraById(state.settings.eraId) : null;
    const theme = this.settings.theme && this.settings.theme !== 'era' ? this.settings.theme : era?.theme || 'paper';
    document.body.dataset.theme = theme;
    const meta = document.querySelector('meta[name=theme-color]'); if (meta) meta.content = getComputedStyle(document.body).getPropertyValue('--panel-head').trim() || '#2b2418';
  }

  setBanners(text, cls) {
    for (const id of ['#bannerTop', '#bannerBottom']) { const el = $(id); el.className = `class-banner ${id === '#bannerTop' ? 'top' : 'bottom'} ${cls}`; el.textContent = text; }
  }

  gameBanner() {
    const s = this.state; if (!s) return;
    const army = this.ctx.army;
    const modern = s.era.tech >= 5;
    const level = (modern ? army.classification?.modern : army.classification?.old) || 'SECRET';
    const phase = s.ended ? 'AFTER-ACTION' : s.phase === 'planning' ? 'PLANNING' : s.phase === 'consolidation' ? 'CONSOLIDATION' : 'EXECUTION';
    const style = document.body.dataset.theme === 'paper' ? 'stamped' : 'bar';
    this.setBanners(`${level}//OPERATION ${s.truth.codename}//${phase} PHASE`, style);
  }

  get provider() { return getProvider(this.api.providerId); }
  get apiOpts() { return { provider: this.provider, apiKey: this.api.apiKey, model: this.api.model || this.provider.defaultModel, baseUrl: this.api.baseUrl || undefined }; }

  // ------------------------------------------------------------------ logon
  setupLogin() {
    const sel = $('#providerSelect');
    for (const p of PROVIDERS) sel.append(h('option', { value: p.id }, p.name));
    sel.value = this.api.providerId || 'anthropic';
    $('#apiKey').value = this.api.apiKey || '';
    $('#modelInput').value = this.api.model || '';
    $('#baseUrl').value = this.api.baseUrl || '';
    $('#rememberKey').checked = !!this.api.remember;
    const sync = () => {
      const p = getProvider(sel.value);
      $('#modelInput').placeholder = p.defaultModel || 'model id';
      const dl = clear($('#modelList')); for (const m of p.models) append(dl, h('option', { value: m }));
      $('#baseUrlRow').classList.toggle('hidden', !p.allowCustomBaseUrl);
      $('#baseUrl').placeholder = p.defaultBaseUrl;
      const notes = clear($('#providerNotes'));
      append(notes, p.notes ? `${p.notes} ` : '', p.keyUrl ? h('span', {}, 'Get a key: ', h('a', { href: p.keyUrl, target: '_blank', rel: 'noopener' }, p.keyUrl)) : null);
    };
    sel.addEventListener('change', sync); sync();
    const readForm = () => {
      this.api = { providerId: sel.value, apiKey: $('#apiKey').value.trim(), model: $('#modelInput').value.trim(), baseUrl: $('#baseUrl').value.trim(), remember: $('#rememberKey').checked };
      store.saveApiConfig({ ...this.api, apiKey: this.api.remember ? this.api.apiKey : '' });
    };
    $('#testConn').addEventListener('click', async () => {
      readForm();
      const st = $('#connStatus'); st.textContent = 'Testing...'; st.className = 'muted small';
      try {
        const text = await complete(this.provider, { ...this.apiOpts, json: false, maxTokens: 20, temperature: 0, messages: [{ role: 'user', content: 'Reply with the single word READY.' }] });
        st.textContent = text.trim() ? `Link OK (${this.apiOpts.model}): "${text.trim().slice(0, 40)}"` : 'Link OK (empty reply)'; st.className = 'ok small';
      } catch (err) { st.textContent = `Failed: ${err.message}`; st.className = 'danger small'; }
    });
    $('#forgetKey').addEventListener('click', () => { store.forgetApiKey(); $('#apiKey').value = ''; $('#rememberKey').checked = false; toast('Stored key removed.'); });
    $('#loginForm').addEventListener('submit', e => {
      e.preventDefault(); readForm();
      if (!this.api.apiKey && !['ollama', 'custom'].includes(this.provider.id)) { toast('Paste an API key for the Game Master.', 'warn'); $('#apiKey').focus(); return; }
      $('#setupOperator').textContent = `Game Master: ${this.provider.name}${this.apiOpts.model ? ` · ${this.apiOpts.model}` : ''}`;
      this.renderSlots();
      this.showScreen('setup');
      if (!this.isNarrow()) $('#playerName').focus();
    });
  }

  setupSetupExtras() {
    $('#genCancel').addEventListener('click', () => this.abort?.abort());
    $('#backToLogin').addEventListener('click', () => this.showScreen('login'));
    $('#importFile').addEventListener('change', async e => {
      const f = e.target.files[0]; if (!f) return;
      try { const st = await store.importStateFromFile(f); this.loadState(st, 0); toast('Save imported.'); } catch (err) { toast(`Import failed: ${err.message}`, 'danger'); }
      e.target.value = '';
    });
  }

  renderSlots() {
    const ul = clear($('#slotList'));
    for (const s of store.listSlots()) {
      const label = s.slot === 0 ? 'Autosave' : `Slot ${s.slot}`;
      if (s.empty) { append(ul, h('li', {}, h('span', { class: 'slot-info muted' }, h('b', {}, label), 'empty'))); continue; }
      append(ul, h('li', {},
        h('span', { class: 'slot-info' }, h('b', {}, `${label}: ${s.player} · ${s.codename || ''}`), `${s.title || ''} · ${s.era || ''} · ${s.echelon || ''} · turn ${s.turn}${s.ended ? ' · ended' : ''}${s.ironman ? ' · IRONMAN' : ''} · ${new Date(s.savedAt).toLocaleString()}`),
        h('span', { class: 'row tight' }, h('button', { class: 'btn small', type: 'button', onClick: () => this.loadState(store.loadSlot(s.slot), s.slot) }, 'Resume'),
          h('button', { class: 'btn small ghost danger', type: 'button', 'aria-label': `Delete ${label}`, onClick: async () => { if (await modal(`Delete ${label}?`, { buttons: [{ label: 'Delete', value: true, danger: true }, { label: 'Cancel', value: false }] })) { store.deleteSlot(s.slot); this.renderSlots(); } } }, '✕'))));
    }
  }

  // --------------------------------------------------------------- new game
  operationArgs(settings, player, continuation = null) {
    const era = eraById(settings.eraId); const theatre = theatreById(settings.theatreId); const army = armyById(settings.armyId);
    const branch = branchById(settings.branchId); const echelon = echelonById(settings.echelonId); const difficulty = difficultyById(settings.difficulty);
    const rank = playerRank(army, echelon.id, { platoonSgt: settings.platoonSgt, branch: branch.id });
    const recent = store.loadRecent();
    const typeFilter = echelon.tier >= 5 ? (m => !['Counter-sniper hunt', 'Night reconnaissance patrol', 'A soldier breaking: desertion or mutiny'].includes(m.text)) : null;
    const seed = pickSeed(Math.random, recent, { missionN: settings.missionN, typeFilter });
    return { era, theatre, army, branch, echelon, difficulty, settings, player, background: backgroundById(settings.background), rank, seed, cellM: echelon.cellM, gridN: echelon.gridN, continuation };
  }

  async startNewGame(settings, player, { continuation = null, carry = null, statusEl = null } = {}) {
    const st = statusEl || $('#genStatus');
    const btn = $('#beginBtn');
    btn.disabled = true; $('#genCancel').classList.remove('hidden'); $('#genProgress').classList.remove('hidden'); st.className = 'muted small';
    this.abort = new AbortController();
    try {
      const args = this.operationArgs(settings, player, continuation);
      const truth = await generateOperation({ ...this.apiOpts, args, signal: this.abort.signal, onProgress: msg => { st.textContent = msg; } });
      const s = newGameState({ settings, truth, player, carry });
      store.rememberOperation(args.seed);
      this.state = s; this.ctx = ctxOf(s); this.slot = 0; this.sel = {}; this.mapView = null; this.orderDraft = null; this.opordDraft = null;
      addLog(s, 'system', `${carry ? `Operation ${s.campaign.index}. ` : ''}${personLabel(s, s.people.p0)}, ${s.people.p0.role}, ${truth.friendly.unitName}. Operation ${truth.codename}: "${truth.title}". ${truth.setting.place}.`, 'system');
      addLog(s, 'briefing', 'Briefing issued.', 'system');
      addFact(s, `H-hour is ${formatHM(s, s.mission.hHour)}. Objective: ${s.mission.name}.`, 'game');
      this.autosave();
      st.textContent = '';
      this.enterDesktop(true);
    } catch (err) {
      st.textContent = this.abort.signal.aborted ? 'Cancelled.' : `Could not build the operation: ${err.message}`;
      st.className = 'danger small';
      if (err.raw) { this.lastRawOperation = err.raw; console.warn('[warstories] last raw operation reply (also at window.warstories.lastRawOperation):\n', err.raw); }
      if (!this.abort.signal.aborted && !document.querySelector('#screen-setup').classList.contains('hidden')) toast('The Game Master could not build the operation. See the message under the button.', 'danger', 8000);
    } finally { btn.disabled = false; $('#genCancel').classList.add('hidden'); $('#genProgress').classList.add('hidden'); this.abort = null; }
  }

  loadState(state, slot) {
    if (!state) { toast('That save is empty.', 'warn'); return; }
    this.state = migrateState(state); this.ctx = ctxOf(this.state);
    this.slot = state.settings.ironman ? 0 : (slot || 0);
    this.sel = {}; this.mapView = null; this.draft = null; this.pickMode = null;
    if (state.ended && state.aar) { this.showAARScreen(); return; }
    this.enterDesktop(false);
    if (state.ended && !state.aar) this.afterEnd();
  }

  autosave() {
    if (!this.state) return;
    this.lastSave = Date.now();
    // Manual slots are checkpoints: only "Save here" writes them.
    store.saveSlot(0, this.state);
  }
  scheduleSave() { clearTimeout(this._saveT); this._saveT = setTimeout(() => this.autosave(), 800); }
  saveTo(slot) { if (this.state.settings.ironman) { toast('Ironman games save to the autosave only.', 'warn'); return; } this.slot = slot; store.saveSlot(slot, this.state); toast(`Saved to slot ${slot}.`, 'info'); this.refresh('settings'); }
  async loadFrom(slot) { if (this.busy) return; if (!await modal(`Load slot ${slot}? Unsaved progress since the last autosave is kept in the autosave slot.`, { buttons: [{ label: 'Load', value: true, primary: true }, { label: 'Cancel', value: false }] })) return; this.loadState(store.loadSlot(slot), slot); }

  // ---------------------------------------------------------------- desktop
  setupDesktop() {
    this.wm = new WindowManager($('#windowArea'), $('#dock'), {
      geometry: this.settings.windows || {},
      onGeometry: (id, g) => { this.settings.windows = this.settings.windows || {}; this.settings.windows[id] = g; store.saveSettings(this.settings); }
    });
    registerPanels(this);
    $('#cmdBar').addEventListener('submit', e => { e.preventDefault(); const v = $('#cmdInput').value.trim(); if (!v) return; $('#cmdInput').value = ''; this.sendText(v); });
    $('#carryOnBtn').addEventListener('click', () => { if (this.state?.contactMoment) this.sendText(''); else this.act({ type: 'continue' }); });
    document.addEventListener('keydown', e => {
      if (!this.state || $('#screen-desktop').classList.contains('hidden')) return;
      if (e.target.matches('input, textarea, select') && e.key !== 'Escape') return;
      if (e.key === '/') { e.preventDefault(); $('#cmdInput').focus(); }
      if (e.altKey && /^[1-9]$/.test(e.key)) { const ids = dockOrder(this).filter(x => !['---', 'tile', 'more', 'settings', 'help'].includes(x)); const id = ids[Number(e.key) - 1]; if (id) { e.preventDefault(); this.show(id); } }
      else if (!e.altKey && !e.ctrlKey && !e.metaKey && /^[1-4]$/.test(e.key) && !this.busy && !this.state.ended) { const c = this.state.lastChoices[Number(e.key) - 1]; if (c) { e.preventDefault(); this.sendText(c); } }
    });
    window.addEventListener('beforeunload', () => this.autosave());
    window.addEventListener('resize', () => { clearTimeout(this._rz); this._rz = setTimeout(() => { if (this.state && !$('#screen-desktop').classList.contains('hidden')) this.wm.refreshAll(); }, 250); });
  }

  enterDesktop(fresh) {
    const s = this.state;
    this.ctx = ctxOf(s);
    this.wm.closeAll();
    this.applyTheme(s);
    document.body.classList.toggle('feel-ops', this.ctx.echelon.feel === 'ops');
    document.body.classList.toggle('feel-field', this.ctx.echelon.feel !== 'ops');
    this.wm.buildDock(dockOrder(this), {
      more: { icon: '⋯', title: 'More panels', label: 'More', run: () => this.morePanels(), cls: 'phone-only' },
      tile: { icon: '⊞', title: 'Tile windows', run: () => this.wm.tile() }
    }, [...PHONE_TABS, 'more']);
    for (const b of $$('#dock button.phone-only')) b.classList.add('phone-show');
    const ins = makeInsignia({ seed: `${s.truth.friendly.unitName}:${s.settings.armyId}`, branch: s.settings.branchId, number: unitNumber(s.truth.friendly.unitName) });
    $('#wmInsignia').innerHTML = ins.svg;
    s.insigniaMotto = ins.motto;
    this.showScreen('desktop');
    this.gameBanner();
    this.updateStrip();
    $('#cmdPrompt').textContent = `${s.units.u0.callsign || 'ORDERS'}>`;
    this.wm.show('log');
    if (!this.isNarrow()) {
      this.wm.show('map'); if (this.ctx.echelon.tier >= 4 && window.innerWidth >= 1600) this.wm.show('staff');
      const saved = this.settings.windows || {};
      if (!saved.log && !saved.map) this.wm.tile();
      this.wm.focus('log');
    }
    this.wm.refreshAll();
    if (!this.isNarrow()) $('#cmdInput').focus();
    if (fresh && s.turnCount === 0) this.act({ type: 'opening' });
    else if (s.contactMoment && !s.ended) this.startContactTimer();
  }

  morePanels() {
    const ids = dockOrder(this).filter(x => !['---', 'tile', 'more'].includes(x));
    const body = h('div', {}, h('h2', {}, 'Panels'), h('div', { class: 'sheet-menu' }, ids.map(id => { const def = this.wm.defs.get(id); return def ? h('button', { class: 'btn', type: 'button', onClick: () => { $('#modal').close(); this.show(id); } }, `${def.icon} ${def.title}`) : null; })));
    modal(body, { buttons: [{ label: 'Close', value: null }] });
  }

  show(id) { if (this.wm.defs.has(id)) { this.wm.show(id); this.badges[id] = 0; this.wm.setBadge(id, 0); } }
  refresh(id) { if (this.wm.isOpen(id)) this.wm.refresh(id); }
  resetLayout() { this.settings.windows = {}; store.saveSettings(this.settings); this.wm.forgetGeometry(); this.wm.closeAll(); this.wm.cascade = 0; this.wm.show('log'); if (!this.isNarrow()) { this.wm.show('map'); this.wm.focus('log'); } }

  updateStrip() {
    const s = this.state; if (!s) return;
    const strip = clear($('#statusStrip'));
    const light = lightAt(s); const w = WEATHER[s.weatherNow] || WEATHER.clear;
    const own = strengthPct(s, 'friendly');
    const u0 = s.units.u0;
    const contacts = Object.values(s.picture.contacts).filter(c => !c.cleared && s.clock.minutes - c.at <= s.scale.tick * 3).length;
    const threat = s.ended ? 1 : Math.max(1, Math.min(5, contacts ? 4 : s.phase === 'execution' ? 3 : s.phase === 'planning' ? 2 : 1) + (Object.values(s.units).some(u => u.side === 'friendly' && s.clock.minutes - u.engagedAt <= s.scale.tick && liveUnit(u)) ? 1 : 0));
    const nextPL = s.phase === 'planning' ? `H-hour in ${formatDuration(Math.max(0, s.mission.hHour - s.clock.minutes))}` : s.clock.minutes < s.mission.nlt ? `NLT ${formatHM(s, s.mission.nlt)} (${formatDuration(s.mission.nlt - s.clock.minutes)})` : `ends ${formatHM(s, s.mission.end)}`;
    const cell = (label, val, cls = '', opt = false) => h('span', { class: `cell ${cls} ${opt ? 'opt' : ''}` }, h('b', {}, label), val);
    append(strip,
      h('span', { class: 'cell clock' }, `${formatHM(s)} · ${formatDay(s)} ${new Date(s.clock.start).getUTCFullYear()}`),
      cell('', relH(s), '', true),
      cell('LIGHT', `${light.label} · ${w.name}`, '', true),
      h('span', { class: 'cell' }, h('b', {}, 'THREAT'), h('span', { class: 'threat', 'aria-label': `threat ${threat} of 5` }, [1, 2, 3, 4, 5].map(i => h('i', { class: i <= threat ? 'on' : '' })))),
      cell('FORCE', `${own}%`, own < 50 ? 'sev-bad' : own < 75 ? 'sev-warn' : ''),
      cell('AMMO', `${averageAmmo(s)}%`, averageAmmo(s) < 25 ? 'sev-bad' : averageAmmo(s) < 50 ? 'sev-warn' : '', true),
      cell('NET', u0.radio === 'ok' && !s.flags.includes('jammed') ? 'up' : s.flags.includes('jammed') ? 'JAMMED' : u0.radio, u0.radio !== 'ok' || s.flags.includes('jammed') ? 'sev-bad' : '', true),
      cell('', nextPL, s.phase !== 'planning' && s.clock.minutes > s.mission.nlt - s.scale.tick * 2 && s.mission.status === 'pending' ? 'sev-warn' : ''),
      cell('OBJ', s.mission.status.toUpperCase(), s.mission.status === 'success' ? '' : s.mission.status === 'failure' ? 'sev-bad' : '', true),
      h('span', { class: `busy ${this.busy ? 'on' : ''}`, id: 'busyText' }, this.statusText || ''));
    const p0 = s.people.p0;
    $('#wmText').replaceChildren(h('div', { class: 'wm-name' }, `${p0.rank} ${p0.name}`), h('div', { class: 'wm-id' }, p0.serviceNumber || ''), h('div', { class: 'wm-unit' }, s.truth.friendly.unitName), s.insigniaMotto ? h('div', { class: 'wm-unit' }, s.insigniaMotto) : null);
    this.gameBanner();
  }

  setStatus(text, busy = false) { this.statusText = text; const el = $('#busyText'); if (el) { el.textContent = text || ''; el.classList.toggle('on', busy); } }

  // ---------------------------------------------------------------- actions
  sendText(text) {
    const s = this.state; if (!s || s.ended) return;
    if (s.contactMoment) { const late = !!this.contactLate; this.stopContactTimer(); return this.act({ type: 'contact', text, late }); }
    if (!text) return;
    if (this.shortcut(text)) return;
    return this.act({ type: 'free', text });
  }

  /** A handful of typed commands work without the Game Master. A leading "/" forces one; anything else goes to the GM. */
  shortcut(raw) {
    const forced = raw.startsWith('/');
    const t = raw.replace(/^\//, '').trim().toLowerCase().replace(/[.!]+$/, '');
    const panels = { map: 'map', roster: 'roster', comms: 'radio', radio: 'radio', record: 'record', wall: 'record', orders: 'orders', intel: 'intel', briefing: 'briefing', help: 'help', journal: 'journal', letters: 'letters', fires: 'fires', logistics: 'logistics', staff: 'staff', settings: 'settings' };
    if (panels[t]) { this.show(panels[t]); return true; }
    if (/^(carry on|continue|skip ahead|next|press on|go on|wait)$/.test(t)) { this.act({ type: 'continue' }); return true; }
    if (t === 'sitrep') { addLog(this.state, 'system', sitrepText(this.state, this.ctx), 'system'); this.wm.refreshAll(); return true; }
    if (/^write home$/.test(t)) { this.writeHome(); return true; }
    if (/^check on the men$/.test(t)) { this.act({ type: 'checkmen' }); return true; }
    if (/^(save)$/.test(t)) { this.autosave(); if (this.slot && !this.state.settings.ironman) this.saveTo(this.slot); else toast('Saved.', 'info'); return true; }
    const talk = raw.replace(/^\//, '').match(/^talk to ([\w'.-]+(?: [\w'.-]+)?)[,:]?\s*(.*)$/i);
    if (talk) {
      const who = talk[1].toLowerCase();
      const p = Object.values(this.state.people).find(x => !x.isPlayer && ['ok', 'wia'].includes(x.status) && (x.name.toLowerCase().includes(who) || (x.nickname || '').toLowerCase() === who || (x.staffRole || '').toLowerCase() === who));
      if (p) { if (talk[2]) this.act({ type: 'talk', personId: p.id, text: talk[2] }); else this.talkTo(p.id); return true; }
    }
    if (forced) { toast('Commands: map, roster, comms, orders, intel, record, sitrep, carry on, write home, check on the men, talk to <name>.', 'info', 7000); return true; }
    return false;
  }

  async act(action) {
    const s = this.state;
    if (!s || s.ended) return null;
    if (this.busy) { toast('Wait for the current transmission to finish.', 'warn'); return null; }
    if (s.contactMoment && action.type !== 'contact') { const late = !!this.contactLate; this.stopContactTimer(); action = { type: 'contact', text: action.text || '', late }; }
    this.busy = true; this.setStatus('Transmitting...', true);
    this.abort = new AbortController();
    const prevFocused = [...this.wm.open.entries()].find(([, w]) => w.el.classList.contains('focused'))?.[0] || null;
    const target = this.liveTarget(prevFocused);
    const line = playerLine(s, action);
    const liveWrap = h('div', { class: 'entry live narrator' }, h('div', { class: 'who' }, 'INCOMING'), h('div', { class: 'stream' }));
    if (target) {
      if (line) append(target, h('div', { class: 'entry player' }, h('div', { class: 'who' }, `${formatHM(s)} · ${personLabel(s, s.people.p0)}`), h('div', { class: 'narr' }, line)));
      append(target, liveWrap); liveWrap.scrollIntoView?.({ block: 'end' });
    }
    const tw = new Typewriter(liveWrap.querySelector('.stream'), { speedMs: SPEED[this.settings.typeSpeed ?? 'normal'] ?? 12, reduceMotion: this.settings.reduceMotion });
    liveWrap.addEventListener('click', () => tw.skip());
    for (const b of $$('.choices .btn, .quick .btn')) b.disabled = true;
    if (action.type === 'radio') sound.squelch();
    let result = null;
    try {
      result = await runTurn({ state: s, action, ...this.apiOpts, signal: this.abort.signal, onNarrative: text => tw.update(text), onStatus: t => this.setStatus(t, true) });
      liveWrap.querySelector('.who').textContent = `${formatHM(s)} · ${speakerLabel(s, result.speaker)}`;
      liveWrap.className = `entry ${result.speaker.split(':')[0]} ${s.contactMoment ? 'contact' : ''}`;
      tw.finish(result.narrative);
      if (result.report?.casualties?.length || s.contactMoment) sound.crack(); else if (result.speaker.startsWith('net:')) sound.staticBurst();
      await this.waitTypewriter(tw);
      for (const n of result.notices.slice(0, 4)) toast(n, /Intel|Noted/.test(n) ? 'info' : '');
      const cas = result.report?.casualties?.filter(c => c.label) || [];
      for (const c of cas.slice(0, 3)) toast(`${c.label}: ${c.status === 'kia' ? 'killed' : `wounded (${c.severity})`}`, 'danger', 7000);
      if (result.fallback) toast('The reply was garbled; shown as plain text, no changes applied.', 'warn');
      this.afterTurn(result);
    } catch (err) {
      tw.finish('');
      liveWrap.className = 'entry system';
      liveWrap.querySelector('.stream').textContent = this.abort.signal.aborted ? 'Transmission cancelled.' : `LINK ERROR: ${err.message}`;
      toast(err.message, 'danger', 9000);
    } finally {
      this.busy = false; this.abort = null; this.setStatus('');
      this.updateStrip();
      this.autosave();
      this.wm.refreshAll();
      // Bring the panel the player was working in back to the front now that the narrative is done.
      if (prevFocused && prevFocused !== 'log' && this.wm.open.has(prevFocused) && !this.isNarrow()) this.wm.focus(prevFocused);
      if (s.contactMoment && !s.ended) this.startContactTimer();
      if (s.ended && !s.aar) this.afterEnd();
    }
    return result;
  }

  waitTypewriter(tw) { return new Promise(res => { const poll = () => (tw.shown >= tw.target.length ? res() : setTimeout(poll, 50)); poll(); }); }

  liveTarget(prevFocused) {
    let w = this.wm.open.get('log');
    if (!w) w = this.wm.show('log');
    if (this.isNarrow() || !prevFocused || prevFocused === 'log') this.wm.focus('log');
    const stream = w.body.querySelector('.log-stream') || w.body;
    for (const q of $$('.composer', w.body)) q.remove();
    return stream;
  }

  afterTurn(result) {
    const r = result.report;
    const bump = id => { if (!this.wm.defs.has(id)) return; const w = this.wm.open.get(id); if (w && w.el.classList.contains('focused')) return; this.badges[id] = (this.badges[id] || 0) + 1; this.wm.setBadge(id, this.badges[id]); };
    if (r?.contacts?.length || r?.intel?.length) bump('intel');
    if (r?.casualties?.length) bump('roster');
    if (r?.contacts?.length || r?.arrivals?.length) bump('map');
    if (r?.fires?.length) bump('fires');
    if (this.state.radio.log.length !== this._radioSeen) { this._radioSeen = this.state.radio.log.length; bump('radio'); }
    for (const e of r?.events || []) if (e.flash || (e.urgent && e.kind === 'higher')) { toast(`FLASH TRAFFIC: ${e.text}`, 'danger', 10000); sound.staticBurst(1.2); }
    if (r?.objective) toast(`Mission status: ${r.objective.status.toUpperCase()}. ${r.objective.text}`, r.objective.status === 'failure' ? 'danger' : 'info', 8000);
  }

  // ------------------------------------------------------------ CONTACT!
  startContactTimer() {
    this.stopContactTimer();
    const secs = Number(this.settings.contactTimer ?? 20);
    const bar = $('#contactBar'); bar.classList.remove('hidden');
    $('#cmdInput').placeholder = 'What do you do in the next five seconds?';
    if (!this.isNarrow()) $('#cmdInput').focus();
    this.contactLate = false;
    if (!secs) { $('#contactCount').textContent = ''; $('#contactMeter').style.width = '100%'; return; }
    let left = secs;
    const tick = () => {
      $('#contactCount').textContent = left > 0 ? `${left}s` : 'TOO LATE';
      $('#contactMeter').style.width = `${Math.max(0, left / secs * 100)}%`;
      if (left <= 0) { this.contactLate = true; clearInterval(this.contactTimer); this.contactTimer = null; return; }
      left -= 1;
    };
    tick();
    this.contactTimer = setInterval(tick, 1000);
  }
  stopContactTimer() { if (this.contactTimer) clearInterval(this.contactTimer); this.contactTimer = null; $('#contactBar')?.classList.add('hidden'); const i = $('#cmdInput'); if (i) i.placeholder = 'Give orders, ask, act. e.g. \'2nd squad move to D5\''; }

  // ------------------------------------------------------------ helpers for panels
  async menu(title, items) {
    const body = h('div', {}, h('h2', {}, title), h('div', { class: 'sheet-menu' }, items.map(it => h('button', { class: `btn ${it.value == null ? 'ghost' : ''}`, type: 'button', onClick: () => { $('#modal').close(); this._menuResolve?.(it.value); } }, it.label))));
    return new Promise(res => { this._menuResolve = res; modal(body, { buttons: [] }).then(v => { if (v === null) res(null); }); });
  }

  async ask(title, { placeholder = '', rows = 4, ok = 'Send', intro = null, value = '' } = {}) {
    const ta = h('textarea', { rows: String(rows), placeholder, style: 'width:100%' }, value);
    const body = h('div', {}, intro ? h('p', { class: 'small muted' }, intro) : null, ta);
    setTimeout(() => ta.focus(), 50);
    const go = await modal(body, { title, buttons: [{ label: ok, value: true, primary: true }, { label: 'Cancel', value: false }] });
    return go ? ta.value.trim() : null;
  }

  async talkTo(personId) {
    const p = this.state.people[personId]; if (!p) return;
    const text = await this.ask(`Talk to ${personLabel(this.state, p)}`, { placeholder: 'What do you say?', rows: 3, intro: `${p.role}${p.mood ? ` · ${p.mood}` : ''}${p.personality ? ` · ${p.personality}` : ''}` });
    if (text) this.act({ type: 'talk', personId, text });
  }

  async askHint() {
    const text = await this.ask(`Ask ${this.ctx.echelon.hintGiver.replace(/^your /, 'the ')}`, { placeholder: 'What are you unsure about? (Advice costs a little of your standing.)', rows: 2, ok: 'Ask' });
    if (text !== null) this.act({ type: 'hint', text, giver: this.ctx.echelon.hintGiver });
  }

  async writeHome() {
    const text = await this.ask('A letter home', { placeholder: 'Dear…', rows: 8, ok: 'Seal it', intro: 'It will go out with the next mail. Replies come between operations.' });
    if (text) { writeLetter(this.state, { kind: 'home', toName: 'home', text }); toast('Letter sealed for the mail.', 'info'); this.autosave(); this.refresh('letters'); }
  }

  async writeFamily(personId) {
    const p = this.state.people[personId];
    const text = await this.ask(`To the family of ${personLabel(this.state, p)}`, { placeholder: `Dear Mr. and Mrs. ${p.last || ''}…`, rows: 9, ok: 'Seal it', intro: `${p.role}, from ${p.hometown || 'home'}. ${p.detail ? `He ${p.detail}.` : ''} Killed ${p.wound?.cause ? `by ${p.wound.cause}` : 'in action'}.` });
    if (text) { writeLetter(this.state, { kind: 'family', toPersonId: personId, text }); toast('Letter sealed. It matters.', 'info'); this.autosave(); this.wm.refreshAll(); }
  }

  fireOn(cell) { this.sendText(`Fire mission on ${refOf(this.state.grid.n, cell)}`); }
  saluteFor(c) { this.radioTemplate = 'salute'; this.radioFields = { size: c.size ? `about ${c.size}` : '', activity: '', location: refOf(this.state.grid.n, c.cell), unit: '', time: formatHM(this.state, c.at), equipment: '' }; this.show('radio'); }

  async chooseVisit() {
    const s = this.state;
    const v = await this.menu('Go forward to…', [...friendlyUnits(s).filter(u => liveUnit(u) && !u.isHQ).map(u => ({ label: `${u.name} (${refOf(s.grid.n, u.cell)})`, value: u.id })), { label: 'Cancel', value: null }]);
    if (v) this.act({ type: 'visit', unitId: v });
  }

  addControlMeasure(cm) {
    const s = this.state;
    s.controlMeasures.push({ id: `pcm${Date.now().toString(36)}`, type: cm.type, name: cm.name, cells: cm.cells, from: 'player' });
    toast(`${cm.name} drawn on the map. Use its name in orders.`, 'info');
    this.scheduleSave();
  }
  removeControlMeasure(id) { const s = this.state; s.controlMeasures = s.controlMeasures.filter(c => c.id !== id); this.refresh('map'); this.scheduleSave(); }

  async endOperation(confirmFirst = false) {
    if (confirmFirst && !await modal('End the operation now and go to the after-action review? Whatever is unfinished stays unfinished.', { buttons: [{ label: 'End it', value: true, danger: true }, { label: 'Carry on', value: false }] })) return;
    await this.act({ type: 'end' });
  }

  async quitToMenu(screen = 'setup') {
    if (this.busy) { this.abort?.abort(); }
    this.autosave();
    this.wm.closeAll();
    this.renderSlots();
    this.showScreen(screen);
  }

  // ------------------------------------------------------------ after the end
  async afterEnd() {
    const s = this.state; if (!s?.ended) return;
    this.stopContactTimer();
    this.gameBanner();
    const kind = s.ended.kind;
    const msg = { kia: 'You have been killed.', wounded: 'You are badly hurt. Stretcher-bearers carry you back; for you, this operation is over.', captured: 'You have been taken prisoner.', relieved: 'You have been relieved of command.', failure: 'Your force is broken.', time: 'Time is up.', complete: 'You report the operation complete.' }[kind] || 'The operation is over.';
    await modal(h('div', {}, h('p', { class: 'narr' }, msg), h('p', { class: 'small muted' }, 'The after-action review unseals the truth: where the enemy really was, what he intended, what you missed, and who did not come back.')), { title: 'The operation has ended', buttons: [{ label: 'After-action review ▸', value: true, primary: true }] });
    await this.showAAR();
  }

  async showAAR() {
    const s = this.state; if (!s) return;
    if (!s.ended) { await this.endOperation(true); return; }
    if (!s.aar) {
      this.showScreen('aar');
      clear($('#aarBody')).append(h('h2', {}, 'After-action review'), h('p', { class: 'muted' }, 'The staff is writing it up...'), h('div', { class: 'progress' }, h('div')));
      const aar = computeAAR(s);
      recordOperation(s, aar);
      let prose;
      try { prose = await writeAAR({ state: s, aar, ...this.apiOpts }); } catch (err) { prose = fallbackAAR(s, aar, err); }
      s.aar = { ...aar, prose };
      this.autosave();
    }
    this.showAARScreen();
  }

  showAARScreen() {
    const s = this.state;
    this.ctx = ctxOf(s);
    this.applyTheme(s);
    this.showScreen('aar');
    this.gameBanner();
    renderAAR(this, s, $('#aarBody'));
  }

  /** Between operations: refit, mail, promotion, then the next operation. */
  async toNextOperation() {
    const s = this.state; const aar = s.aar;
    const settings = nextSettings(s, aar);
    const carry = buildCarry(s, aar);
    this.showScreen('interlude');
    const body = $('#interludeBody');
    clear(body).append(h('h2', {}, 'Between operations'), h('p', { class: 'muted' }, 'Rest, refit, mail call...'), h('div', { class: 'progress' }, h('div')));
    let mail = [];
    try { mail = await mailCall({ state: s, aar, ...this.apiOpts }); } catch { mail = []; }
    carry.campaign.lettersReceived = s.campaign.lettersReceived;
    renderInterlude(this, s, body, { aar, mail, settings, carry, onNext: async statusEl => {
      const player = { name: s.people.p0.name, hometown: s.people.p0.hometown, age: s.people.p0.age };
      await this.startNewGame(settings, player, { continuation: continuationText(s, aar), carry, statusEl });
    } });
  }

  newGame() { this.state = null; this.renderSlots(); this.showScreen('setup'); }
}

export { esc };
