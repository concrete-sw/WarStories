// Orders: what higher told you (warning order, five-paragraph order, changes),
// the planning steps and what they cost in time, a quick-order builder, a full
// five-paragraph order of your own, and the orders in effect.

import { h, append, clear } from '../dom.js';
import { btn, section, tag, glossify } from './common.js';
import { formatHM, formatDuration } from '../../engine/clock.js';
import { friendlyUnits, liveUnit, personLabel } from '../../engine/state.js';
import { refOf } from '../../engine/grid.js';
import { orderText, TASK_LABEL } from '../../engine/orders.js';

export const TASK_PHRASE = { move: 'move to', assault: 'assault', suppress: 'suppress', defend: 'defend at', dig_in: 'dig in at', withdraw: 'withdraw to', halt: 'halt', recon: 'recon', ambush: 'ambush at', patrol: 'patrol to', breach: 'breach at' };

export function registerOrders(app, { S, reg, readOnly }) {
  reg({
    id: 'orders', title: 'Orders', sub: 'WARNO · OPORD · FRAGO', icon: '✎', size: { w: 640, h: 620 }, x: 90, y: 40,
    render(body) {
      const s = S(); const t = s.truth; const ech = app.ctx.echelon; const n = s.grid.n;
      const ro = readOnly();
      // Planning.
      if (s.phase === 'planning' && !ro) {
        const left = s.mission.hHour - s.clock.minutes;
        const [lo] = ech.planningMinutes;
        const bg = s.settings.background === 'staff' ? 0.8 : 1;
        const step = (id, label, mins, done, note) => h('div', { class: 'row tight' }, btn(`${done ? '✓ ' : ''}${label}`, () => app.act({ type: 'planning', step: id }), `small ${done ? 'ghost' : ''}`, { disabled: app.busy || (done && id !== 'execute') }), h('span', { class: 'muted small' }, `${mins ? formatDuration(Math.round(mins * bg)) : ''}${note ? ` · ${note}` : ''}`));
        append(body, section(`Planning · H-hour ${formatHM(s, s.mission.hHour)} · ${formatDuration(Math.max(0, left))} left`,
          h('p', { class: 'small muted' }, `Troop leading procedures. Every step costs time your subordinates need to prepare: use no more than a third of the time before H-hour yourself.`),
          step('warno', 'Issue the warning order', lo * 0.25, s.planning.warno, 'units start preparing'),
          step('recon', 'Leader\'s reconnaissance', lo * 0.8, s.planning.recon, 'may spot positions; it is not safe'),
          step('rehearsal', 'Rehearse the plan', lo * 0.8, s.planning.rehearsal, 'orders arrive faster, fewer mistakes'),
          h('div', { class: 'row tight' }, btn(`${s.planning.opord ? '✓ ' : ''}Give the orders (five paragraphs) ▾`, () => document.getElementById('opordForm')?.scrollIntoView({ behavior: 'smooth' }), 'small ghost'), h('span', { class: 'muted small' }, formatDuration(Math.round(lo * 0.5 * bg)))),
          step('execute', 'Execute now (move H-hour up)', 0, false, 'higher may not be ready')));
      }
      // Quick order builder.
      if (!ro) append(body, quickOrder(app, s));
      // In effect.
      const fr = friendlyUnits(s).filter(u => !u.dormant && (liveUnit(u) || u.isHQ));
      append(body, section('Orders in effect', h('table', {}, h('thead', {}, h('tr', {}, h('th', {}, 'Unit'), h('th', {}, 'Order'), h('th', {}, 'Where'), h('th', {}, 'Radio'))),
        h('tbody', {}, fr.map(u => h('tr', {}, h('td', {}, u.name, u.order?.misread ? tag('misread', 'warn') : null, u.order?.source === 'initiative' ? tag('initiative', 'info') : null), h('td', {}, orderText(s, u)), h('td', {}, refOf(n, (ech.tier >= 2 && !u.isHQ ? u.reported?.cell ?? u.cell : u.cell))), h('td', {}, u.isHQ ? '—' : u.radio)))))));
      if (ech.tier >= 4) append(body, syncMatrix(app, s));
      // Your own order.
      if (!ro) append(body, opordForm(app, s));
      // From higher.
      append(body, section('From higher',
        h('div', { class: 'typed' }, h('div', { class: 'typed-head' }, h('span', {}, 'WARNING ORDER'), h('span', {}, t.higher?.unit || '')), glossify(t.mission.warno)),
        h('div', { class: 'typed' }, h('div', { class: 'typed-head' }, h('span', {}, `OPERATION ORDER · ${t.codename}`), h('span', {}, 'COPY No. 3 OF 7')),
          h('b', {}, '1. SITUATION. '), glossify(t.mission.opord.situation), '\n\n', h('b', {}, '2. MISSION. '), glossify(t.mission.opord.mission), '\n\n', h('b', {}, '3. EXECUTION. '), glossify(t.mission.opord.execution), '\n\n', h('b', {}, '4. SUSTAINMENT. '), glossify(t.mission.opord.sustainment), '\n\n', h('b', {}, '5. COMMAND AND SIGNAL. '), glossify(t.mission.opord.commandSignal)),
        frags(app, s)));
    }
  });
}

function frags(app, s) {
  const items = s.radio.log.filter(r => r.net === 'higher' && r.dir !== 'out').slice(-6);
  if (!items.length) return null;
  return h('div', {}, h('h3', {}, 'Changes from higher (FRAGOs and traffic)'), items.map(r => h('div', { class: 'radio-line' }, h('span', { class: 'dtg' }, formatHM(s, r.at)), h('span', { class: 'call' }, `${r.from}: `), h('span', { class: 'txt' }, r.text))));
}

function quickOrder(app, s) {
  const n = s.grid.n;
  const units = friendlyUnits(s).filter(u => liveUnit(u) && !u.dormant);
  const q = app.orderDraft || (app.orderDraft = { unit: units.find(u => !u.isHQ)?.id || 'u0', task: 'move', target: '', intent: '', queue: [] });
  const unitSel = h('select', { id: 'qoUnit', 'aria-label': 'Unit', onChange: e => { q.unit = e.target.value; } }, h('option', { value: '*' }, 'All units'), units.map(u => h('option', { value: u.id, selected: q.unit === u.id }, u.isHQ ? `Me (${u.name})` : u.name)));
  if (q.unit === '*') unitSel.value = '*';
  const taskSel = h('select', { id: 'qoTask', 'aria-label': 'Task', onChange: e => { q.task = e.target.value; } }, Object.keys(TASK_PHRASE).map(k => h('option', { value: k, selected: q.task === k }, TASK_LABEL[k] || k)));
  const tgt = h('input', { id: 'qoTarget', type: 'text', placeholder: 'square, e.g. D5', value: q.target, maxlength: '40', onInput: e => { q.target = e.target.value; } });
  const intent = h('input', { id: 'qoIntent', type: 'text', placeholder: 'in order to… (optional: purpose makes orders clearer)', value: q.intent, maxlength: '160', onInput: e => { q.intent = e.target.value; } });
  const phrase = () => {
    const u = q.unit === '*' ? null : s.units[q.unit];
    const who = q.unit === '*' ? 'All units' : u?.isHQ ? 'I' : u?.name || '';
    const needsTarget = !['halt'].includes(q.task);
    const tgtTxt = needsTarget && q.target.trim() ? ` ${q.target.trim()}` : '';
    const verb = u?.isHQ ? { move: 'move to', withdraw: 'move back to', dig_in: 'dig in at', halt: 'stay here' }[q.task] || TASK_PHRASE[q.task] : TASK_PHRASE[q.task];
    return `${who}${u?.isHQ ? ' ' : ', '}${verb}${tgtTxt}${q.intent.trim() ? ` in order to ${q.intent.trim().replace(/^in order to\s+/i, '')}` : ''}`;
  };
  const queue = h('ol', { class: 'small' }, q.queue.map((o, i) => h('li', {}, o, ' ', btn('✕', () => { q.queue.splice(i, 1); app.refresh('orders'); }, 'small ghost', { 'aria-label': 'Remove' }))));
  return section('Quick order',
    h('div', { class: 'form-grid' }, h('label', {}, 'Unit', unitSel), h('label', {}, 'Task', taskSel), h('label', {}, 'Target', tgt), h('label', {}, 'Intent', intent)),
    h('div', { class: 'row tight' },
      btn('Pick target on map', () => { app.pickMode = { field: 'qoTarget', label: 'Tap a square for the target' }; app.show('map'); }, 'small ghost'),
      btn('Add to orders', () => { q.queue.push(phrase()); q.target = ''; app.refresh('orders'); }, 'small ghost'),
      btn(q.queue.length ? `Issue ${q.queue.length + (q.target ? 1 : 0)} orders` : 'Issue order', () => { const all = [...q.queue, ...(q.target || q.task === 'halt' || q.task === 'dig_in' || q.task === 'defend' ? [phrase()] : [])]; if (!all.length) return; q.queue = []; q.target = ''; app.sendText(all.join('; ')); }, 'small primary', { disabled: app.busy })),
    q.queue.length ? queue : null,
    h('p', { class: 'muted small' }, 'Or just type in the command bar: ', h('code', {}, '2nd squad, suppress E6; 1st squad, move to D5 in order to flank the gun')));
}

function opordForm(app, s) {
  const f = app.opordDraft || (app.opordDraft = { situation: '', mission: '', execution: '', sustainment: '', command: '', intent: s.planning.intent || '' });
  const ta = (k, label, ph) => h('label', {}, label, h('textarea', { rows: k === 'execution' ? '4' : '2', placeholder: ph, onInput: e => { f[k] = e.target.value; } }, f[k]));
  return h('div', { id: 'opordForm' }, section(s.phase === 'planning' ? 'Your orders (five-paragraph order)' : 'Change the plan (FRAGO)',
    h('p', { class: 'muted small' }, 'Clear intent, tasks, purpose, control measures and timing make orders arrive faster and be understood. Tasks written in Execution are parsed like typed orders.'),
    ta('intent', 'Commander\'s intent', 'What you want achieved and why, so they can adapt when the plan breaks.'),
    ta('situation', '1. Situation', 'Enemy, friendly, attachments, civilians, weather.'),
    ta('mission', '2. Mission', 'Who, what, when, where, why.'),
    ta('execution', '3. Execution', 'e.g. Able team, suppress I9. BAR team, move to G10 in order to flank. Baker team, assault I5 on my signal.'),
    ta('sustainment', '4. Sustainment', 'Ammunition, water, casualties, prisoners.'),
    ta('command', '5. Command and signal', 'Where you will be, signals, succession.'),
    h('div', { class: 'row tight' }, btn(s.phase === 'planning' ? 'Hold the orders group' : 'Issue the FRAGO', () => {
      if (s.phase === 'planning') app.act({ type: 'planning', step: 'opord', fields: { ...f } });
      else { if (f.intent.trim()) s.planning.intent = f.intent.trim(); app.sendText([f.execution, f.intent ? `Intent: ${f.intent}` : ''].filter(Boolean).join('. ') || 'Stand by for new orders.'); }
    }, 'small primary', { disabled: app.busy }))));
}

function syncMatrix(app, s) {
  const n = s.grid.n; const tick = s.scale.tick;
  const cols = [0, 1, 2, 3, 4].map(k => s.clock.minutes + k * tick);
  const rows = friendlyUnits(s).filter(u => liveUnit(u) && !u.isHQ).map(u => {
    const o = u.order;
    const eta = o && o.status !== 'done' && u.path?.length ? Math.round(u.path.length * tick * 1.2) : 0;
    return h('tr', {}, h('td', {}, u.name), cols.map(t => {
      let txt = '';
      if (o && o.status === 'pending' && t < o.startAt) txt = '…order in transit';
      else if (o && (o.status === 'active' || o.status === 'pending')) txt = t < s.clock.minutes + eta ? `${o.task} → ${o.cell != null && o.cell >= 0 ? refOf(n, o.cell) : ''}` : `${o.task === 'move' ? 'arrived' : o.task}`;
      else txt = u.posture;
      return h('td', { class: 'small' }, txt);
    }));
  });
  return section('Synchronisation matrix', h('table', {}, h('thead', {}, h('tr', {}, h('th', {}, 'Unit'), cols.map(t => h('th', {}, formatHM(s, t))))), h('tbody', {}, rows)));
}

export { clear, personLabel };
