// The Map panel: the operations map plus tools to draw control measures, and a
// details box for the selected square, unit or contact with the orders you can
// give from there.

import { h, append } from '../dom.js';
import { btn, tag, kv } from './common.js';
import { renderMapSVG } from '../mapView.js';
import { refOf, fullRef, describeCell, distance, bearing, compass } from '../../engine/grid.js';
import { friendlyUnits, liveUnit, personLabel } from '../../engine/state.js';
import { orderText } from '../../engine/orders.js';
import { typeWord } from '../../engine/sim.js';
import { formatHM } from '../../engine/clock.js';
import { assetBlocked } from '../../engine/fires.js';

const PL_NAMES = ['RED', 'BLUE', 'GREEN', 'GOLD', 'SILVER', 'BLACK', 'WHITE', 'COPPER', 'IRON', 'OAK'];
const OBJ_NAMES = ['HAMMER', 'ANVIL', 'TIGER', 'LANCE', 'BULL', 'FALCON', 'STONE', 'RIVER'];

export function registerMap(app, { S, reg, readOnly }) {
  reg({
    id: 'map', title: 'Map', sub: 'OPERATIONS MAP', icon: '⌖', size: { w: 680, h: 620 }, x: 670, y: 10, primary: true,
    render(body) {
      body.classList.add('col');
      const s = S(); const n = s.grid.n;
      const ro = readOnly();
      const view = app.mapView || (app.mapView = {});
      let svg;
      const sel = app.sel;
      const tools = h('div', { class: 'map-tools' },
        btn('+', () => svg.zoomIn(), 'small ghost', { 'aria-label': 'Zoom in' }), btn('−', () => svg.zoomOut(), 'small ghost', { 'aria-label': 'Zoom out' }), btn('Fit', () => svg.fit(), 'small ghost'), btn('Me', () => svg.centerOn(s.units.u0.cell), 'small ghost', { title: 'Centre on your position' }),
        ro ? null : h('span', { class: 'muted small' }, ' Draw:'),
        ro ? null : ['PL', 'OBJ', 'TRP', 'CP', 'boundary'].map(t => btn(t === 'boundary' ? 'Bdy' : t, () => startDraft(app, s, t), `small ghost ${app.draft?.type === t ? 'on' : ''}`, { title: `Draw a ${t === 'PL' ? 'phase line' : t === 'OBJ' ? 'objective' : t === 'TRP' ? 'target reference point' : t === 'CP' ? 'checkpoint' : 'boundary'}` })));
      append(body, tools);
      if (app.pickMode) append(body, h('div', { class: 'row tight' }, tag(app.pickMode.label, 'info'), btn('Cancel', () => { app.pickMode = null; app.refresh('map'); }, 'small ghost')));
      if (app.draft) append(body, h('div', { class: 'row tight' }, tag(`${app.draft.type} ${app.draft.name}: tap squares (${app.draft.cells.length})`, 'info'), btn('Finish', () => finishDraft(app), 'small', { disabled: !app.draft.cells.length }), btn('Cancel', () => { app.draft = null; app.refresh('map'); }, 'small ghost')));
      const wrapSvg = h('div', { class: 'map-svg-wrap grow' });
      svg = renderMapSVG(s, {
        view, selCell: sel.cell, selUnit: sel.unit || sel.contact, draft: app.draft,
        onCell: cell => onCell(app, s, cell), onUnit: id => { app.sel = { unit: id, cell: s.units[id]?.cell ?? null }; app.refresh('map'); },
        onContact: id => { app.sel = { contact: id, cell: s.picture.contacts[id]?.cell ?? null }; app.refresh('map'); },
        onLongPress: cell => { if (!ro) longPress(app, s, cell); }
      });
      wrapSvg.append(svg);
      append(body, h('div', { class: 'map' }, wrapSvg, details(app, s, ro),
        h('div', { class: 'legend' }, h('span', {}, '▭ friendly (as reported)'), h('span', {}, '◇ enemy (solid seen · dashed probable · dotted possible; fades with age)'), h('span', {}, `square = ${s.scale.cellM} m`))));
    }
  });
}

function onCell(app, s, cell) {
  if (app.pickMode) {
    const pm = app.pickMode; app.pickMode = null;
    const ref = refOf(s.grid.n, cell);
    if (pm.field === 'qoTarget' && app.orderDraft) app.orderDraft.target = ref;
    if (pm.onPick) pm.onPick(ref, cell);
    app.sel = { cell };
    app.show(pm.back || 'orders');
    return;
  }
  if (app.draft) {
    const d = app.draft;
    if (d.cells[d.cells.length - 1] !== cell) d.cells.push(cell);
    if (d.type === 'TRP' || d.type === 'CP') { finishDraft(app); return; }
    app.refresh('map'); return;
  }
  app.sel = { cell };
  app.refresh('map');
}

function startDraft(app, s, type) {
  const count = s.controlMeasures.filter(c => c.type === type && c.from === 'player').length;
  const name = type === 'PL' ? `PL ${PL_NAMES[count % PL_NAMES.length]}` : type === 'OBJ' ? `OBJ ${OBJ_NAMES[count % OBJ_NAMES.length]}` : type === 'TRP' ? `TRP ${String(count + 11).padStart(2, '0')}` : type === 'CP' ? `CP ${count + 1}` : `BDY ${count + 1}`;
  app.draft = { type, name, cells: [] };
  app.sel = {};
  app.refresh('map');
}

function finishDraft(app) {
  const d = app.draft; app.draft = null;
  if (d && d.cells.length) app.addControlMeasure({ type: d.type, name: d.name, cells: d.cells });
  app.refresh('map');
}

async function longPress(app, s, cell) {
  const ref = refOf(s.grid.n, cell);
  const choice = await app.menu(`Square ${ref}`, [
    { label: `Target reference point here`, value: 'TRP' }, { label: 'Checkpoint here', value: 'CP' }, { label: 'Start a phase line here', value: 'PL' }, { label: 'Objective here', value: 'OBJ' },
    s.fires.assets.length ? { label: `Fire mission on ${ref}`, value: 'fire' } : null, { label: 'Cancel', value: null }
  ].filter(Boolean));
  if (!choice) return;
  if (choice === 'fire') { app.fireOn(cell); return; }
  startDraft(app, s, choice);
  app.draft.cells.push(cell);
  if (choice === 'TRP' || choice === 'CP') finishDraft(app); else app.refresh('map');
}

function details(app, s, ro) {
  const n = s.grid.n; const sel = app.sel; const box = h('div', { class: 'cellinfo' });
  const hq = s.units.u0;
  if (sel.unit && s.units[sel.unit]?.side === 'friendly') {
    const u = s.units[sel.unit]; const L = s.people[u.leaderId];
    append(box, h('b', {}, u.name), ` · ${u.callsign || ''}`, u.isHQ ? tag('you', 'info') : null,
      kv([['Leader', L ? `${personLabel(s, L)}${L.mood ? ` (${L.mood})` : ''}` : '—'], ['Strength', `${u.strength}/${u.start}${u.vehicles ? ` · ${u.vehicles} vehicles` : ''}`], ['State', `${u.posture}, morale ${Math.round(u.morale)}, suppression ${Math.round(u.suppression)}, ammo ${Math.round(u.ammo)}%`], ['Order', orderText(s, u)], ['Where', `${refOf(n, u.reported?.cell ?? u.cell)}${u.reported && u.reported.cell !== u.cell && app.ctx.echelon.tier >= 2 ? ' (as last reported)' : ''} · radio ${u.radio}`]]));
    if (!ro && !u.isHQ) append(box, h('div', { class: 'row tight' },
      btn('Order…', () => { app.orderDraft = { ...(app.orderDraft || {}), unit: u.id, task: 'move', target: '', intent: '', queue: app.orderDraft?.queue || [] }; app.show('orders'); }, 'small'),
      L ? btn(`Talk to ${L.last || L.name}`, () => app.talkTo(L.id), 'small ghost') : null,
      app.ctx.echelon.tier >= 4 ? btn('Go forward', () => app.act({ type: 'visit', unitId: u.id }), 'small ghost', { disabled: app.busy }) : null));
    return box;
  }
  if (sel.contact && s.picture.contacts[sel.contact]) {
    const c = s.picture.contacts[sel.contact]; const age = s.clock.minutes - c.at;
    append(box, h('b', {}, `Enemy ${typeWord(c.type)}`), tag(c.confidence, c.confidence === 'confirmed' ? 'bad' : 'warn'),
      kv([['Where', `${refOf(n, c.cell)} · ${fullRef(s, c.cell)}`], ['Size', c.size ? `about ${c.size}` : 'unknown'], ['Last seen', `${formatHM(s, c.at)} (${age} min ago) by ${c.source}`]]));
    if (!ro) append(box, unitOrderRow(app, s, c.cell, ['suppress', 'assault']), s.fires.assets.length ? h('div', { class: 'row tight' }, btn(`Fire mission on ${refOf(n, c.cell)}`, () => app.fireOn(c.cell), 'small'), btn('Spot report (SALUTE)', () => app.saluteFor(c), 'small ghost')) : h('div', { class: 'row tight' }, btn('Spot report (SALUTE)', () => app.saluteFor(c), 'small ghost')));
    return box;
  }
  if (sel.cell != null && sel.cell >= 0) {
    const cell = sel.cell;
    const d = distance(n, hq.cell, cell) * s.scale.cellM;
    const here = friendlyUnits(s).filter(u => liveUnit(u) && (u.reported?.cell ?? u.cell) === cell).map(u => u.name);
    const cons = Object.values(s.picture.contacts).filter(c => !c.cleared && c.cell === cell).map(c => `enemy ${typeWord(c.type)} (${c.confidence})`);
    const cms = s.controlMeasures.filter(c => c.cells.includes(cell));
    append(box, h('b', {}, describeCell(s, cell)), h('div', { class: 'small muted' }, `Grid ${fullRef(s, cell)} · ${Math.round(d)} m ${compass(bearing(n, hq.cell, cell))} of you`),
      here.length ? h('div', { class: 'small' }, 'Yours here: ', here.join(', ')) : null, cons.length ? h('div', { class: 'small danger' }, 'Reported here: ', cons.join(', ')) : null,
      cms.length ? h('div', { class: 'small' }, 'Control measures: ', cms.map(c => h('span', {}, `${c.name} `, c.from === 'player' && !ro ? btn('✕', () => app.removeControlMeasure(c.id), 'small ghost', { 'aria-label': `Remove ${c.name}` }) : null))) : null);
    if (!ro) {
      append(box, unitOrderRow(app, s, cell, ['move', 'assault', 'suppress', 'recon', 'dig_in']));
      if (s.fires.assets.length) append(box, h('div', { class: 'row tight' }, btn(`Fire mission on ${refOf(n, cell)}`, () => app.fireOn(cell), 'small')));
    }
    return box;
  }
  append(box, h('span', { class: 'muted small' }, 'Tap a square, a unit or a contact. Long-press (or right-click) a square to place a control measure.'));
  return box;
}

/** A unit picker and task buttons that send a typed order. */
function unitOrderRow(app, s, cell, tasks) {
  const units = friendlyUnits(s).filter(u => liveUnit(u) && !u.isHQ && !u.dormant);
  if (!units.length) return null;
  const ref = refOf(s.grid.n, cell);
  const selId = app.mapUnitPick && s.units[app.mapUnitPick] && liveUnit(s.units[app.mapUnitPick]) ? app.mapUnitPick : units[0].id;
  const pick = h('select', { 'aria-label': 'Which unit', onChange: e => { app.mapUnitPick = e.target.value; } }, units.map(u => h('option', { value: u.id, selected: u.id === selId }, u.name)));
  const phrase = { move: 'move to', assault: 'assault', suppress: 'suppress', recon: 'recon', dig_in: 'dig in at' };
  return h('div', { class: 'row tight' }, pick, tasks.map(t => btn(`${t === 'dig_in' ? 'Dig in' : t[0].toUpperCase() + t.slice(1)}`, () => { const u = s.units[pick.value]; app.sendText(`${u.name}, ${phrase[t]} ${ref}`); }, 'small ghost', { disabled: app.busy })), btn('Me', () => app.sendText(`I move to ${ref}`), 'small ghost', { disabled: app.busy, title: `Move your own command post to ${ref}` }));
}

export { assetBlocked };
