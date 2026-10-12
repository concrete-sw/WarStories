// The Radio: nets by echelon with call signs, the log of every transmission,
// and message templates (SALUTE, SITREP, 9-line MEDEVAC, call for fire,
// resupply). A clean, complete message gets faster, better answers.

import { h, append } from '../dom.js';
import { btn, section, tag } from './common.js';
import { formatHM, formatDTG } from '../../engine/clock.js';
import { refOf } from '../../engine/grid.js';
import { assetBlocked } from '../../engine/fires.js';

const TEMPLATES = {
  salute: { title: 'SALUTE spot report', fields: [['size', 'Size', 'e.g. 5-6 men, 1 MG'], ['activity', 'Activity', 'dug in, firing, moving north'], ['location', 'Location', 'grid, e.g. I9'], ['unit', 'Unit / uniform', 'paratroopers, camouflage smocks'], ['time', 'Time', 'when seen'], ['equipment', 'Equipment', 'MG 42, rifles']] },
  sitrep: { title: 'SITREP', fields: [['location', 'Location', 'where you are'], ['status', 'Status', 'strength, casualties, ammunition'], ['enemy', 'Enemy', 'what you see'], ['actions', 'Actions', 'what you are doing'], ['needs', 'Needs', 'what you need']] },
  medevac: { title: '9-line MEDEVAC', fields: [['l1', '1. Location of pickup', 'grid'], ['l2', '2. Frequency and call sign', 'your call sign'], ['l3', '3. Patients by precedence', 'e.g. 2 urgent, 1 routine'], ['l4', '4. Special equipment', 'none / hoist'], ['l5', '5. Patients by type', 'litter / walking'], ['l6', '6. Security at pickup', 'no enemy / possible / hot'], ['l7', '7. Marking', 'smoke, panels, flare'], ['l8', '8. Nationality and status', 'friendly military'], ['l9', '9. Terrain / contamination', 'obstacles, NBC']] },
  cff: { title: 'Call for fire', fields: [['observer', 'Observer', 'your call sign'], ['warning', 'Warning order', 'adjust fire / fire for effect'], ['location', 'Target location', 'grid, e.g. I9'], ['description', 'Target description', 'MG team dug in'], ['method', 'Method of engagement', 'HE, smoke, illumination'], ['control', 'Method of fire and control', 'at my command / when ready']] },
  resupply: { title: 'Resupply request', fields: [['item', 'Item', 'ammo / water / food / medical / batteries / fuel'], ['note', 'Details', 'how much, where']] }
};

export function registerRadio(app, { S, reg, readOnly }) {
  reg({
    id: 'radio', title: 'Radio', sub: 'NETS · TEMPLATES', icon: '☏', size: { w: 600, h: 600 }, x: 120, y: 60,
    render(body) {
      const s = S(); const n = s.grid.n; const ro = readOnly();
      const net = app.radioNet || 'all';
      const nets = s.radio.nets;
      append(body, h('div', { class: 'net-tabs' }, btn('All', () => { app.radioNet = 'all'; app.refresh('radio'); }, `small ${net === 'all' ? 'on' : 'ghost'}`), nets.map(x => btn(`${x.name}${x.kind !== 'radio' ? ` (${x.kind})` : ''}`, () => { app.radioNet = x.id; app.refresh('radio'); }, `small ${net === x.id ? 'on' : 'ghost'}`))));
      const u0 = s.units.u0;
      append(body, h('p', { class: 'small muted' }, `Your call sign: `, h('b', {}, u0.callsign || '—'), ` · higher: ${s.truth.higher?.commander?.callsign || '—'} · your set: ${app.ctx.army.radios?.[app.ctx.echelon.tier <= 1 ? 'squad' : app.ctx.echelon.tier === 2 ? 'platoon' : app.ctx.echelon.tier === 3 ? 'company' : 'battalion'] || 'none: runners and voice'}`, u0.radio !== 'ok' ? tag(`your radio: ${u0.radio}`, 'bad') : null, s.flags.includes('jammed') ? tag('JAMMED', 'bad') : null));
      const log = s.radio.log.filter(r => net === 'all' || r.net === net).slice(-60);
      const box = h('div', { class: 'radio-log' }, log.length ? log.map(r => h('div', { class: `radio-line ${r.dir === 'out' ? 'out' : ''} ${r.garbled ? 'garbled' : ''}` }, h('span', { class: 'dtg' }, app.ctx.era.tech >= 5 ? formatDTG(s, r.at) : formatHM(s, r.at)), h('span', { class: 'call' }, `${r.from}${r.to ? ` → ${r.to}` : ''}: `), h('span', { class: 'txt' }, r.text), r.template ? tag(r.template, 'info') : null)) : h('p', { class: 'muted small' }, 'Quiet on the net.'));
      append(body, box);
      if (ro) return;
      const tpl = app.radioTemplate;
      append(body, section('Send', h('div', { class: 'row tight' }, Object.entries(TEMPLATES).map(([id, t]) => btn(t.title, () => { app.radioTemplate = id; app.radioFields = prefill(app, s, id); app.refresh('radio'); }, `small ${tpl === id ? 'on' : 'ghost'}`)))));
      if (tpl) {
        const t = TEMPLATES[tpl]; const f = app.radioFields || (app.radioFields = {});
        const form = h('div', { class: 'form-grid' }, t.fields.map(([k, label, ph]) => h('label', {}, label, k === 'item' ? h('select', { onChange: e => { f[k] = e.target.value; } }, ['ammo', 'water', 'food', 'medical', 'batteries', 'fuel'].map(x => h('option', { value: x, selected: f[k] === x }, x))) : h('input', { type: 'text', value: f[k] || '', placeholder: ph, onInput: e => { f[k] = e.target.value; } }))));
        if (tpl === 'cff') append(form, h('label', {}, 'Fire unit', h('select', { onChange: e => { f.assetId = e.target.value || null; } }, h('option', { value: '' }, 'best available'), s.fires.assets.map(a => h('option', { value: a.id, selected: f.assetId === a.id }, `${a.name} (${a.left} left${assetBlocked(s, a) ? `, ${assetBlocked(s, a)}` : ''})`)))));
        append(body, h('div', { class: 'typed' }, h('div', { class: 'typed-head' }, h('span', {}, t.title.toUpperCase()), h('span', {}, `${u0.callsign}`)), form,
          h('div', { class: 'row tight' }, btn('Transmit', () => { const fields = { ...f }; app.radioTemplate = null; app.radioFields = null; app.act({ type: 'radio', template: tpl, fields }); }, 'small primary', { disabled: app.busy }), btn('Cancel', () => { app.radioTemplate = null; app.refresh('radio'); }, 'small ghost'))));
      }
      const free = h('input', { type: 'text', placeholder: 'Free transmission, e.g. "Easy One-Six, this is One-Two, request smoke on the farm, over"', id: 'radioFree' });
      append(body, h('div', { class: 'row tight' }, free, btn('Send', () => { const v = free.value.trim(); if (!v) return; app.act({ type: 'radio', text: v, net: net === 'all' ? 'higher' : net }); }, 'small', { disabled: app.busy })));
    }
  });
}

function prefill(app, s, id) {
  const n = s.grid.n; const u0 = s.units.u0;
  const recent = Object.values(s.picture.contacts).filter(c => !c.cleared).sort((a, b) => b.at - a.at)[0];
  const wounded = Object.values(s.people).filter(p => p.status === 'wia' && !p.wound?.evacuatedAt);
  if (id === 'salute' && recent) return { size: recent.size ? `about ${recent.size}` : '', activity: '', location: refOf(n, recent.cell), unit: '', time: formatHM(s, recent.at), equipment: '' };
  if (id === 'sitrep') return { location: refOf(n, u0.cell), status: '', enemy: recent ? `enemy at ${refOf(n, recent.cell)}` : 'no contact', actions: '', needs: '' };
  if (id === 'medevac') return { l1: refOf(n, u0.cell), l2: u0.callsign || '', l3: wounded.length ? `${wounded.filter(p => p.wound?.severity === 'serious').length} urgent, ${wounded.filter(p => p.wound?.severity === 'light').length} routine` : '', l4: 'none', l5: '', l6: '', l7: '', l8: 'friendly military', l9: '' };
  if (id === 'cff') return { observer: u0.callsign || '', warning: 'adjust fire', location: app.sel?.cell != null ? refOf(n, app.sel.cell) : recent ? refOf(n, recent.cell) : '', description: recent ? `enemy ${recent.type}` : '', method: 'HE', control: 'when ready' };
  if (id === 'resupply') return { item: 'ammo', note: '' };
  return {};
}

export { TEMPLATES };
