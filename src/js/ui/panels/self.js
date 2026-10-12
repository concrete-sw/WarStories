// You: your condition (wounds, fatigue, stress), your standing with superiors,
// troops, staff and politicians, your background, and the things only you can
// do: sleep, go forward, write home.

import { h, append } from '../dom.js';
import { btn, section, meter, kv, tag } from './common.js';
import { personLabel } from '../../engine/state.js';
import { backgroundById } from '../../data/people.js';
import { formatHM } from '../../engine/clock.js';
import { makeRack } from '../ribbons.js';

export function registerSelf(app, { S, reg, readOnly }) {
  reg({
    id: 'self', title: 'You', sub: 'CONDITION · STANDING', icon: '☺', size: { w: 520, h: 560 }, x: 260, y: 110,
    render(body) {
      const s = S(); const p = s.people.p0; const ro = readOnly(); const tier = app.ctx.echelon.tier;
      const bg = backgroundById(s.settings.background);
      append(body, h('h2', {}, personLabel(s, p)), h('p', { class: 'small muted' }, `${p.role} · ${p.serviceNumber} · ${p.hometown || ''}`), p.awards.length ? makeRack(p.awards) : null,
        section('Condition',
          h('p', {}, p.status === 'ok' ? (p.wound ? `Wounded (${p.wound.severity}, ${p.wound.part}) at ${formatHM(s, p.wound.at)}, still in command.` : 'Unhurt.') : p.status === 'wia' ? `Wounded: ${p.wound?.severity}, ${p.wound?.part}.` : p.status.toUpperCase()),
          meter('Fatigue', p.fatigue || 0, { inverse: true }), meter('Stress', p.stress || 0, { inverse: true }), p.health != null ? meter('Health', p.health) : null,
          (p.fatigue || 0) > 75 ? h('p', { class: 'small warn' }, 'You are exhausted: orders come out muddled and take longer. Sleep when the men can cover you.') : null),
        section('Standing', meter('Higher\'s confidence', s.standing.superiors), meter('The troops\' trust', s.standing.troops), tier >= 3 ? meter('Your staff', s.standing.staff) : null, tier >= 6 ? meter('Political capital', s.standing.political) : null,
          s.standing.superiors < 25 ? h('p', { class: 'small danger' }, 'Higher is losing faith in you. Relief is a real possibility.') : null),
        bg ? section('Background', kv([[bg.name, bg.bonus]])) : null,
        s.conduct.unlawful.length ? section('Under investigation', h('ul', { class: 'small' }, s.conduct.unlawful.map(c => h('li', {}, `${formatHM(s, c.at)} · ${c.note}`)))) : null);
      if (!ro) append(body, h('div', { class: 'row' },
        btn('Sleep 2 h', () => app.act({ type: 'rest', hours: 2 }), 'small', { disabled: app.busy }), btn('Sleep 6 h', () => app.act({ type: 'rest', hours: 6 }), 'small ghost', { disabled: app.busy }),
        tier >= 4 ? btn('Go forward…', () => app.chooseVisit(), 'small ghost', { disabled: app.busy }) : null, s.playerWith ? btn('Return to the CP', () => app.act({ type: 'return' }), 'small ghost', { disabled: app.busy }) : null,
        btn('Write home', () => app.writeHome(), 'small ghost')), s.playerWith ? tag(`with ${s.units[s.playerWith]?.name}`, 'info') : null);
    }
  });
}
