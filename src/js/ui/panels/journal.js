// The journal: facts established in play, your decisions in order, the
// events you witnessed, and your own notes.

import { h, append } from '../dom.js';
import { section, glossify } from './common.js';
import { formatHM } from '../../engine/clock.js';

export function registerJournal(app, { S, reg }) {
  reg({
    id: 'journal', title: 'Journal', sub: 'FACTS · DECISIONS · NOTES', icon: '✐', size: { w: 540, h: 560 }, x: 280, y: 120,
    render(body) {
      const s = S();
      const notes = h('textarea', { rows: '6', placeholder: 'Your own notes. Saved with the game.', 'aria-label': 'Notes', onInput: e => { s.journal.notes = e.target.value; app.scheduleSave(); } }, s.journal.notes || '');
      append(body, section('Notes', notes),
        section('Facts', s.journal.facts.length ? h('ul', { class: 'small' }, [...s.journal.facts].reverse().map(f => h('li', {}, h('span', { class: 'muted' }, `${formatHM(s, f.at)} `), glossify(f.text)))) : h('p', { class: 'muted small' }, 'Nothing established yet.')),
        section('Your decisions', s.decisions.length ? h('ol', { class: 'small timeline' }, s.decisions.map(d => h('li', {}, h('span', { class: 'muted' }, `${formatHM(s, d.at)} `), d.text))) : h('p', { class: 'muted small' }, 'No orders given yet.')));
    }
  });
}
