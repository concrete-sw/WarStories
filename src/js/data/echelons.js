// The command levels. This table is the heart of the design: the same engine
// plays very differently at each echelon because the clock, the map scale, what
// the player controls, what they can see, how risky it is for them personally,
// and which panels exist all come from here. Nothing else in the code should
// branch on "if squad leader"; it should read a field from this table.

export const ECHELONS = [
  {
    id: 'fireteam', tier: 0, name: 'Fireteam leader', short: 'Fireteam', commands: 'individuals',
    controls: '3-4 soldiers by name, individual weapons',
    sees: 'Only what your own eyes see, plus shouting and hand signals.',
    risk: 'You are in the fight. You can be wounded or killed.',
    feel: 'field', subSize: 'individual', mySize: 'team',
    tick: 1, maxSpan: 6,              // minutes per turn in contact; furthest a quiet turn compresses
    cellM: 50, gridN: 14,              // metres per grid square, squares per side
    footKmh: 2, lethality: 0.05, orderDelay: 0, reportEvery: 0,
    sightKm: 0.6, smallArmsKm: 0.4, playerRisk: 1.0,
    planningMinutes: [10, 30], strengthWord: 'men', namedCasualties: true,
    panels: ['log', 'briefing', 'orders', 'map', 'roster', 'self', 'intel', 'journal', 'letters', 'record'],
    hintGiver: 'your squad leader'
  },
  {
    id: 'squad', tier: 1, name: 'Squad leader', short: 'Squad', commands: 'teams',
    controls: '2-3 fireteams, 8-13 named soldiers',
    sees: 'Your eyes, your team leaders shouting, hand signals. The big picture reaches you as rumour.',
    risk: 'You are in the dirt with your men. You can be wounded or killed.',
    feel: 'field', subSize: 'team', mySize: 'squad',
    tick: 2, maxSpan: 12,
    cellM: 100, gridN: 16,
    footKmh: 2, lethality: 0.05, orderDelay: 0, reportEvery: 0,
    sightKm: 0.8, smallArmsKm: 0.5, playerRisk: 0.8,
    planningMinutes: [15, 45], strengthWord: 'men', namedCasualties: true,
    panels: ['log', 'briefing', 'orders', 'map', 'roster', 'radio', 'fires', 'self', 'intel', 'logistics', 'journal', 'letters', 'record'],
    hintGiver: 'your platoon sergeant'
  },
  {
    id: 'platoon', tier: 2, name: 'Platoon leader', short: 'Platoon', commands: 'squads',
    controls: '3-4 squads, attached weapons, a radio to company',
    sees: 'Your sector, what your squad leaders report, the company net.',
    risk: 'High. Platoon leaders lead from the front and are hit often.',
    feel: 'field', subSize: 'squad', mySize: 'platoon',
    tick: 5, maxSpan: 30,
    cellM: 200, gridN: 16,
    footKmh: 2, lethality: 0.055, orderDelay: 2, reportEvery: 15,
    sightKm: 1.0, smallArmsKm: 0.6, playerRisk: 0.55,
    planningMinutes: [30, 90], strengthWord: 'men', namedCasualties: true,
    panels: ['log', 'briefing', 'orders', 'map', 'roster', 'radio', 'fires', 'intel', 'logistics', 'self', 'journal', 'letters', 'record'],
    hintGiver: 'your platoon sergeant'
  },
  {
    id: 'company', tier: 3, name: 'Company commander', short: 'Company', commands: 'platoons',
    controls: '3-4 platoons, mortars, attachments',
    sees: 'The company sector map, platoon reports, the battalion net.',
    risk: 'Moderate. Your command post is close enough to be shelled.',
    feel: 'field', subSize: 'platoon', mySize: 'company',
    tick: 15, maxSpan: 90,
    cellM: 400, gridN: 16,
    footKmh: 1.6, lethality: 0.045, orderDelay: 8, reportEvery: 30,
    sightKm: 1.6, smallArmsKm: 0.8, playerRisk: 0.3,
    planningMinutes: [60, 180], strengthWord: 'men', namedCasualties: 'leaders',
    panels: ['log', 'briefing', 'orders', 'map', 'roster', 'radio', 'fires', 'intel', 'logistics', 'staff', 'self', 'journal', 'letters', 'record'],
    hintGiver: 'your first sergeant'
  },
  {
    id: 'battalion', tier: 4, name: 'Battalion commander', short: 'Battalion', commands: 'companies',
    controls: 'Companies, fire support, a staff (XO, S1-S4, FSO)',
    sees: 'The operations map, staff briefings, reports up to an hour old.',
    risk: 'Low, unless you go forward.',
    feel: 'ops', subSize: 'company', mySize: 'battalion',
    tick: 60, maxSpan: 240,
    cellM: 1000, gridN: 16,
    footKmh: 1.5, lethality: 0.045, orderDelay: 30, reportEvery: 60,
    sightKm: 2.0, smallArmsKm: 1.0, playerRisk: 0.12,
    planningMinutes: [120, 360], strengthWord: 'men', namedCasualties: 'leaders',
    panels: ['log', 'briefing', 'orders', 'map', 'staff', 'roster', 'radio', 'fires', 'intel', 'logistics', 'self', 'journal', 'letters', 'record'],
    hintGiver: 'your executive officer'
  },
  {
    id: 'brigade', tier: 5, name: 'Brigade / regiment commander', short: 'Brigade', commands: 'battalions',
    controls: 'Battalions, aviation, engineers, logistics',
    sees: 'The operational picture, intelligence estimates, reports hours old.',
    risk: 'Low.',
    feel: 'ops', subSize: 'battalion', mySize: 'brigade',
    tick: 240, maxSpan: 720,
    cellM: 2500, gridN: 18,
    footKmh: 0.6, lethality: 0.035, orderDelay: 90, reportEvery: 240,
    sightKm: 4, smallArmsKm: 2.5, playerRisk: 0.05,
    planningMinutes: [240, 720], strengthWord: 'men', namedCasualties: 'leaders',
    panels: ['log', 'briefing', 'orders', 'map', 'staff', 'roster', 'radio', 'fires', 'intel', 'logistics', 'self', 'journal', 'letters', 'record'],
    hintGiver: 'your deputy commander'
  },
  {
    id: 'division', tier: 6, name: 'Division commander (2-star)', short: 'Division', commands: 'brigades',
    controls: 'Brigades or regiments, division artillery, air support, logistics',
    sees: 'The theatre picture by the day. Politics. The press.',
    risk: 'Very low. A visit to the front changes that.',
    feel: 'ops', subSize: 'brigade', mySize: 'division',
    tick: 720, maxSpan: 1440,
    cellM: 5000, gridN: 18,
    footKmh: 0.6, lethality: 0.03, orderDelay: 240, reportEvery: 720,
    sightKm: 10, smallArmsKm: 5, playerRisk: 0.02,
    planningMinutes: [480, 1440], strengthWord: 'men', namedCasualties: 'leaders',
    panels: ['log', 'briefing', 'orders', 'map', 'staff', 'roster', 'radio', 'fires', 'intel', 'logistics', 'self', 'journal', 'letters', 'record'],
    hintGiver: 'your chief of staff'
  },
  {
    id: 'corps', tier: 7, name: 'Corps commander (3-star)', short: 'Corps', commands: 'divisions',
    controls: 'Divisions, allies, theatre logistics',
    sees: 'The strategic picture. Coalition and political pressure. Reports that are late, inflated or wrong.',
    risk: 'Minimal. You are more likely to be relieved than killed.',
    feel: 'ops', subSize: 'division', mySize: 'corps',
    tick: 1440, maxSpan: 2880,
    cellM: 10000, gridN: 20,
    footKmh: 0.8, lethality: 0.028, orderDelay: 480, reportEvery: 1440,
    sightKm: 20, smallArmsKm: 10, playerRisk: 0.01,
    planningMinutes: [720, 2880], strengthWord: 'men', namedCasualties: 'leaders',
    panels: ['log', 'briefing', 'orders', 'map', 'staff', 'roster', 'radio', 'fires', 'intel', 'logistics', 'self', 'journal', 'letters', 'record'],
    hintGiver: 'your chief of staff'
  }
];

export const echelonById = id => ECHELONS.find(e => e.id === id) || ECHELONS[1];
export const echelonByTier = t => ECHELONS[Math.max(0, Math.min(ECHELONS.length - 1, t))];

// Unit sizes: typical strength ranges and the NATO echelon mark drawn over a unit symbol.
export const SIZES = {
  individual: { min: 1, max: 1, mark: '', label: 'soldier' },
  team: { min: 2, max: 6, mark: 'Ø', label: 'team' },
  squad: { min: 6, max: 14, mark: '●', label: 'squad' },
  section: { min: 6, max: 14, mark: '●●', label: 'section' },
  platoon: { min: 18, max: 50, mark: '●●●', label: 'platoon' },
  company: { min: 60, max: 220, mark: 'I', label: 'company' },
  battalion: { min: 300, max: 1000, mark: 'II', label: 'battalion' },
  regiment: { min: 1500, max: 4500, mark: 'III', label: 'regiment' },
  brigade: { min: 1500, max: 5500, mark: 'X', label: 'brigade' },
  division: { min: 6000, max: 22000, mark: 'XX', label: 'division' },
  corps: { min: 20000, max: 80000, mark: 'XXX', label: 'corps' }
};

/** The size of the player's own subordinate units at an echelon (what a "unit" means on the map). */
export const SUB_SIZES = { fireteam: ['individual'], squad: ['team'], platoon: ['squad', 'section', 'team'], company: ['platoon', 'section'], battalion: ['company', 'platoon'], brigade: ['battalion', 'company'], division: ['brigade', 'regiment', 'battalion'], corps: ['division', 'brigade'] };

export const MODES = [
  { id: 'single', name: 'Single operation', blurb: 'One mission, about one to three hours of play.' },
  { id: 'campaign', name: 'Campaign', blurb: 'Four to eight linked operations, with rest, refit and replacements between them.' },
  { id: 'career', name: 'Career', blurb: 'Start as a fireteam or squad leader. Survive and lead well to be promoted; each promotion changes the game and the interface.' }
];

export const DIFFICULTIES = [
  { id: 'green', name: 'Green', blurb: 'Forgiving, with honest intel. You cannot be killed.', intelNoise: 0.15, enemySkill: 0.85, supply: 1.25, playerDeath: false, falseIntel: 0.5 },
  { id: 'regular', name: 'Regular', blurb: 'Realistic. You can be badly wounded, not killed.', intelNoise: 0.3, enemySkill: 1.0, supply: 1.0, playerDeath: false, falseIntel: 1 },
  { id: 'veteran', name: 'Veteran', blurb: 'Thin intel, a capable enemy, scarce supply. You can be killed.', intelNoise: 0.5, enemySkill: 1.15, supply: 0.75, playerDeath: true, falseIntel: 1.5 }
];
export const difficultyById = id => DIFFICULTIES.find(d => d.id === id) || DIFFICULTIES[1];
