// Letters: write home, write to the families of the men you lost, and read
// the mail that arrives between operations.

import { h, append } from '../dom.js';
import { btn, section, tag } from './common.js';
import { personLabel } from '../../engine/state.js';

export function registerLetters(app, { S, reg, readOnly }) {
  reg({
    id: 'letters', title: 'Letters', sub: 'HOME · FAMILIES · MAIL CALL', icon: '✉', size: { w: 560, h: 580 }, x: 300, y: 70,
    render(body) {
      const s = S(); const ro = readOnly();
      const dead = Object.values(s.people).filter(p => p.status === 'kia' && !p.isPlayer);
      if (!ro || s.settings.mode !== 'single') append(body, h('div', { class: 'row tight' }, btn('Write home', () => app.writeHome(), 'small', { disabled: s.people.p0.status === 'kia' })));
      append(body, section('The men you lost', dead.length ? h('ul', { class: 'list' }, dead.map(p => h('li', {}, h('b', {}, personLabel(s, p)), ` · ${p.role} · from ${p.hometown || 'unknown'}`, p.letterWritten ? tag('letter written', 'ok') : btn('Write to the family', () => app.writeFamily(p.id), 'small ghost')))) : h('p', { class: 'muted small' }, 'No one, yet.')));
      const mine = [...s.letters].reverse();
      append(body, section('Letters you wrote', mine.length ? mine.map(l => h('div', { class: 'letter' }, h('div', { class: 'from' }, `To ${l.toName} · ${l.date}${l.answered ? ' · answered' : ''}`), l.text)) : h('p', { class: 'muted small' }, 'None yet. Families are told by telegram; a letter from the man\'s commander is something else.')));
      const got = [...(s.campaign.lettersReceived || [])].reverse();
      if (got.length) append(body, section('Mail call', got.map(l => h('div', { class: 'letter' }, h('div', { class: 'from' }, `From ${l.from} · to ${l.toName} · ${l.date}`), l.text))));
      else if (s.settings.mode !== 'single') append(body, h('p', { class: 'muted small' }, 'Mail comes between operations.'));
    }
  });
}
