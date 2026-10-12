// Help: how to play at each command level, how to write orders, the
// shortcuts, and the glossary.

import { h, append } from '../dom.js';
import { section } from './common.js';
import { ECHELONS } from '../../data/echelons.js';
import { GLOSSARY } from '../../data/glossary.js';

export function registerHelp(app, { reg }) {
  reg({
    id: 'help', title: 'Help', sub: 'HOW TO PLAY · GLOSSARY', icon: '?', size: { w: 600, h: 620 }, x: 360, y: 50,
    render(body) {
      const ech = app.ctx?.echelon;
      const q = h('input', { type: 'text', placeholder: 'Search the glossary', 'aria-label': 'Search the glossary', onInput: e => { const v = e.target.value.toLowerCase(); for (const li of gl.children) li.classList.toggle('hidden', !!v && !li.textContent.toLowerCase().includes(v)); } });
      const gl = h('ul', { class: 'small' }, Object.entries(GLOSSARY).sort((a, b) => a[0].localeCompare(b[0])).map(([k, v]) => h('li', {}, h('b', {}, k), ` · ${v}`)));
      append(body,
        section('The idea', h('p', { class: 'small' }, 'The game runs the battle; the Game Master tells you what you see and hear and speaks for everyone. You give orders. They take time to arrive, can be misunderstood, and meet an enemy who has his own plan. Squares on the map are named like C4 (letter across, number down; north is up).')),
        section('Giving orders', h('ul', { class: 'small' },
          h('li', {}, h('code', {}, '2nd squad, move to D5'), ' · ', h('code', {}, 'Alpha team suppress E6'), ' · ', h('code', {}, 'Bravo, assault the farm'), ' · ', h('code', {}, 'all units dig in')),
          h('li', {}, 'Several orders at once: separate them with ";" or full stops.'),
          h('li', {}, 'Purpose ("in order to…"), timing ("at 0600", "on my signal"), control measures (PL, OBJ, TRP) and routes ("via the sunken lane") make orders clearer: they arrive faster and are misread less often.'),
          h('li', {}, 'Tasks: move, assault, suppress (base of fire), defend, dig in, withdraw, halt, recon, ambush, patrol, breach.'),
          h('li', {}, 'Fire: ', h('code', {}, 'mortars on I9'), ', ', h('code', {}, 'fire mission G4 smoke'), ', or the call-for-fire template on the Radio.'),
          h('li', {}, 'Yourself: ', h('code', {}, 'I move to H12'), '. Talk to anyone from the Roster. Anything else in plain words: the Game Master handles it.'),
          h('li', {}, 'Carry on lets time run to the next decision point: a contact, a casualty, an arrival, an event.'),
          h('li', {}, 'Before H-hour your troops hold their fire unless fired on or ordered to shoot. ', h('code', {}, 'weapons free'), ' and ', h('code', {}, 'hold fire'), ' change that.'))),
        section('Your command level', ech ? h('p', { class: 'small' }, h('b', {}, `${ech.name}: `), `${ech.controls}. ${ech.sees} ${ech.risk} A turn in contact is about ${ech.tick} minutes; a map square is about ${app.state?.scale?.cellM || ech.cellM} m.`) : null,
          h('details', {}, h('summary', { class: 'small' }, 'All command levels'), h('ul', { class: 'small' }, ECHELONS.map(e => h('li', {}, h('b', {}, e.name), ` · ${e.controls}. ${e.sees} Turns of ~${e.tick < 60 ? `${e.tick} min` : `${e.tick / 60} h`}.`))))),
        section('Contact!', h('p', { class: 'small' }, 'When something hits you suddenly, the game stops and asks what you do in the next five seconds. Answer before the timer runs out. If you hesitate, your men react by their training first, and your order lands late.')),
        section('Shortcuts', h('ul', { class: 'small' }, h('li', {}, h('kbd', {}, '/'), ' command bar · ', h('kbd', {}, '1'), '-', h('kbd', {}, '4'), ' pick a choice · ', h('kbd', {}, 'Alt'), '+', h('kbd', {}, '1'), '-', h('kbd', {}, '9'), ' panels · ', h('kbd', {}, 'Esc'), ' close panel'), h('li', {}, 'Map: scroll or pinch to zoom, drag to pan, arrows move, + and − zoom, 0 fits; long-press or right-click a square to place a control measure.'), h('li', {}, 'Click streaming text to skip the typewriter.'))),
        section('Glossary', q, gl));
    }
  });
}
