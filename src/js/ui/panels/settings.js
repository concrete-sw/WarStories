// Settings: theme, text, typewriter, motion, sound, the contact timer, saves,
// export and import, and ending or leaving the operation.

import { h, append } from '../dom.js';
import { btn, section, tag } from './common.js';
import * as store from '../../engine/storage.js';

export function registerSettings(app, { S, reg, readOnly }) {
  reg({
    id: 'settings', title: 'Settings', sub: 'OPTIONS · SAVES', icon: '⚙', size: { w: 520, h: 600 }, x: 340, y: 60,
    render(body) {
      const s = S(); const st = app.settings; const ro = readOnly();
      const sel = (label, key, opts, after) => h('label', {}, label, h('select', { onChange: e => { st[key] = e.target.value; app.applySettings(); after?.(); } }, opts.map(([v, t]) => h('option', { value: v, selected: String(st[key]) === String(v) }, t))));
      const chk = (label, key) => h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: !!st[key], onChange: e => { st[key] = e.target.checked; app.applySettings(); } }), label);
      append(body, section('Look and feel',
        sel('Theme', 'theme', [['era', 'Follow the war (default)'], ['paper', 'Paper: typed forms, 1914-1945'], ['olive', 'Olive drab: Korea, Vietnam'], ['amber', 'Amber terminal: Cold War'], ['digital', 'Digital battle command: 1991-2014'], ['tactical', 'Tactical display: near future']], () => app.wm.refreshAll()),
        sel('Text size', 'textSize', [['normal', 'Normal'], ['large', 'Large']]),
        sel('Typewriter', 'typeSpeed', [['normal', 'Normal'], ['fast', 'Fast'], ['slow', 'Slow'], ['off', 'Off (instant)']]),
        chk('Reduce motion', 'reduceMotion'), chk('High contrast', 'highContrast')),
        section('Sound', chk('Radio static and squelch (Web Audio)', 'sound'), h('label', {}, 'Volume', h('input', { type: 'range', min: '0', max: '1', step: '0.05', value: String(st.volume ?? 0.4), onInput: e => { st.volume = Number(e.target.value); app.applySettings(); } }))),
        section('Contact!', sel('Time to answer a sudden contact', 'contactTimer', [['20', '20 seconds'], ['30', '30 seconds'], ['12', '12 seconds (hard)'], ['0', 'No timer']])));
      if (s) {
        const iron = s.settings.ironman;
        const slots = store.listSlots();
        append(body, section('Saves', iron ? h('p', { class: 'small' }, tag('IRONMAN', 'bad'), ' This game saves to the autosave slot only. No reloads.') : h('ul', { class: 'slot-list' }, slots.filter(x => x.slot > 0).map(x => h('li', {}, h('span', { class: 'slot-info' }, h('b', {}, `Slot ${x.slot}`), x.empty ? 'empty' : `${x.player} · ${x.codename} · turn ${x.turn}`), h('span', { class: 'row tight' }, btn('Save here', () => app.saveTo(x.slot), 'small'), !x.empty ? btn('Load', () => app.loadFrom(x.slot), 'small ghost') : null)))),
          h('div', { class: 'row tight' }, btn('Export this game (.json)', () => store.exportState(s), 'small ghost'), btn('Reset window layout', () => app.resetLayout(), 'small ghost'))));
        append(body, section('The operation', h('div', { class: 'row tight' },
          !ro ? btn('End the operation now', () => app.endOperation(true), 'small danger') : btn('After-action review', () => app.showAAR(), 'small'),
          btn('Quit to the main menu', () => app.quitToMenu(), 'small ghost'))));
      }
      append(body, section('AI', h('p', { class: 'small muted' }, `Game Master: ${app.provider.name}${app.apiOpts.model ? ` · ${app.apiOpts.model}` : ''}`), btn('Change AI provider', () => app.quitToMenu('login'), 'small ghost')));
    }
  });
}
