// The assignment form: the war, the theatre, the battle, the army, the branch,
// the command level, the mode, the mission, difficulty, Ironman, your name and
// background. Choices narrow each other: only the armies that fought in a
// theatre, only the branches an army had, only the ranks it used.

import { $, h, clear, append } from './dom.js';
import { ERAS, eraById, theatreById, branchesFor, BRANCHES } from '../data/eras.js';
import { armyById, playerRank } from '../data/armies.js';
import { ECHELONS, MODES, DIFFICULTIES, echelonById } from '../data/echelons.js';
import { PLAYER_BACKGROUNDS } from '../data/people.js';
import { MISSION_TABLE } from '../prompts/operation.js';

const opt = (value, text, selected = false) => h('option', { value, selected }, text);

export function wireSetup(app) {
  const era = $('#eraSelect'), th = $('#theatreSelect'), battle = $('#battleSelect'), army = $('#armySelect'), branch = $('#branchSelect'), ech = $('#echelonSelect'), mode = $('#modeSelect');
  for (const e of ERAS) era.append(opt(e.id, `${e.name} (${e.years})`, e.id === 'ww2'));
  for (const m of MODES) mode.append(opt(m.id, m.name, m.id === 'single'));
  const mission = $('#missionSelect');
  mission.append(opt('', 'From the mission table (rotates)', true));
  for (const m of MISSION_TABLE) mission.append(opt(String(m.n), `${m.n}. ${m.text}`));
  for (const d of DIFFICULTIES) $('#difficultySelect').append(opt(d.id, `${d.name}: ${d.blurb}`, d.id === 'regular'));
  $('#backgroundSelect').append(opt('', 'None in particular', true));
  for (const b of PLAYER_BACKGROUNDS) $('#backgroundSelect').append(opt(b.id, b.name));

  const fillTheatres = () => {
    const e = eraById(era.value); clear(th);
    for (const t of e.theatres) th.append(opt(t.id, t.name));
    fillBattles(); fillArmies();
  };
  const fillBattles = () => {
    const t = theatreById(th.value); clear(battle);
    battle.append(opt('', 'Let the Game Master choose', true));
    for (const b of t?.battles || []) battle.append(opt(b, b));
    if (!eraById(era.value)?.fictionalWar) battle.append(opt('fictional', 'A small action of my own: fictional, in this theatre'));
  };
  const fillArmies = () => {
    const t = theatreById(th.value); const prev = army.value; clear(army);
    for (const id of t?.armies || []) { const a = armyById(id); if (a) army.append(opt(id, `${a.name} (${a.side})`, id === prev)); }
    fillBranches();
  };
  const fillBranches = () => {
    const a = armyById(army.value); const e = eraById(era.value); const prev = branch.value; clear(branch);
    for (const b of branchesFor(a, e)) branch.append(opt(b.id, b.name, b.id === prev));
    fillEchelons();
  };
  const fillEchelons = () => {
    const a = armyById(army.value); const prev = ech.value || 'squad'; clear(ech);
    const max = a?.maxEchelon ? echelonById(a.maxEchelon).tier : 7;
    const career = mode.value === 'career';
    for (const x of ECHELONS) {
      if (x.tier > max) continue;
      if (career && x.tier > 1) continue;
      const r = a ? playerRank(a, x.id, { branch: branch.value }) : { full: '' };
      ech.append(opt(x.id, `${x.name}${r.full ? ` · ${r.full}` : ''}`, x.id === prev));
    }
    if (!ech.value) ech.value = career ? 'squad' : 'squad';
    preview();
  };
  const preview = () => {
    const a = armyById(army.value); const x = echelonById(ech.value); const e = eraById(era.value); const b = BRANCHES.find(y => y.id === branch.value);
    $('#psgRow').classList.toggle('hidden', x.id !== 'platoon');
    $('#campaignLenRow').classList.toggle('hidden', mode.value !== 'campaign');
    const r = a ? playerRank(a, x.id, { platoonSgt: $('#platoonSgt').checked && x.id === 'platoon', branch: branch.value }) : null;
    const box = clear($('#echelonPreview'));
    append(box,
      h('div', {}, h('b', {}, r ? r.full : ''), ` · ${x.name}${b ? `, ${b.name.toLowerCase()}` : ''}${a ? ` · ${a.name}` : ''}`),
      h('div', {}, `You command ${x.controls}. ${x.sees}`),
      h('div', {}, `Turns of ~${x.tick < 60 ? `${x.tick} min` : `${x.tick / 60} h`} in contact · map squares of ${x.cellM >= 1000 ? `${x.cellM / 1000} km` : `${x.cellM} m`} · ${x.risk}`),
      b ? h('div', { class: 'muted' }, b.blurb) : null,
      a?.note ? h('div', { class: 'muted' }, a.note) : null,
      e ? h('div', { class: 'muted' }, `Interface: ${{ paper: 'typed forms on paper', olive: 'olive drab and teletype', amber: 'amber terminal', digital: 'early digital battle command', tactical: 'tactical display' }[e.theme]}.`) : null,
      mode.value === 'career' ? h('div', { class: 'muted' }, 'Career: you start low. Survive and lead well to be promoted; each promotion changes the game.') : null);
    const d = DIFFICULTIES.find(y => y.id === $('#difficultySelect').value);
    $('#difficultyNote').textContent = `${d?.blurb || ''}${$('#ironman').checked ? ' Ironman: one life, one save.' : ''}`;
  };
  era.addEventListener('change', fillTheatres); th.addEventListener('change', () => { fillBattles(); fillArmies(); });
  army.addEventListener('change', fillBranches); branch.addEventListener('change', fillEchelons); ech.addEventListener('change', preview);
  mode.addEventListener('change', fillEchelons); $('#platoonSgt').addEventListener('change', preview); $('#difficultySelect').addEventListener('change', preview); $('#ironman').addEventListener('change', preview);
  fillTheatres();
  // Sensible default: a US squad in Normandy.
  if ([...army.options].some(o => o.value === 'us_ww2')) { army.value = 'us_ww2'; fillBranches(); }
  if ([...branch.options].some(o => o.value === 'infantry')) { branch.value = 'infantry'; fillEchelons(); }
  ech.value = 'squad'; preview();

  $('#setupForm').addEventListener('submit', async e => {
    e.preventDefault();
    const name = $('#playerName').value.trim();
    if (name.length < 2) { app.toast('Give your soldier a name.', 'warn'); $('#playerName').focus(); return; }
    const battleVal = battle.value;
    const settings = {
      eraId: era.value, theatreId: th.value, armyId: army.value, branchId: branch.value, echelonId: ech.value, platoonSgt: ech.value === 'platoon' && $('#platoonSgt').checked,
      mode: mode.value, campaignLength: Number($('#campaignLen').value) || 5, missionN: mission.value ? Number(mission.value) : null, start: $('#startSelect').value,
      difficulty: $('#difficultySelect').value, ironman: $('#ironman').checked, tone: $('#toneSelect').value, dice: $('#diceSelect').value, background: $('#backgroundSelect').value || null,
      battle: battleVal === 'fictional' ? `a small fictional action of the player's own in the ${theatreById(th.value)?.name}` : battleVal || null
    };
    await app.startNewGame(settings, { name, hometown: $('#playerHome').value.trim() });
  });
}
