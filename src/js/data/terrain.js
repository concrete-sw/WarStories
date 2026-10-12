// Terrain types and unit types. Cover reduces casualties, concealment reduces
// the chance of being seen, foot and veh scale movement, block says whether the
// square stops line of sight. Colours are for the light (paper) and dark map.

export const TERRAIN = {
  open: { name: 'open ground', cover: 0.0, conceal: 0.1, foot: 1.0, veh: 1.0, block: false, light: '#e9e1c6', dark: '#1a2219' },
  field: { name: 'fields and crops', cover: 0.05, conceal: 0.35, foot: 0.9, veh: 0.85, block: false, light: '#e2dcb0', dark: '#1d2618' },
  desert: { name: 'desert', cover: 0.0, conceal: 0.05, foot: 0.85, veh: 0.95, block: false, light: '#efdfb4', dark: '#2a2416' },
  hedgerow: { name: 'hedgerows', cover: 0.5, conceal: 0.65, foot: 0.45, veh: 0.25, block: true, light: '#bfc98f', dark: '#1d3019' },
  woods: { name: 'woods', cover: 0.4, conceal: 0.7, foot: 0.6, veh: 0.3, block: true, light: '#b5c99a', dark: '#16301a' },
  forest: { name: 'dense forest', cover: 0.5, conceal: 0.8, foot: 0.4, veh: 0.15, block: true, light: '#9fbc86', dark: '#10291a' },
  jungle: { name: 'jungle', cover: 0.4, conceal: 0.9, foot: 0.35, veh: 0.08, block: true, light: '#98b77a', dark: '#0e2a14' },
  paddy: { name: 'paddies', cover: 0.1, conceal: 0.15, foot: 0.45, veh: 0.1, block: false, light: '#cfe0c0', dark: '#16261e' },
  marsh: { name: 'marsh', cover: 0.05, conceal: 0.35, foot: 0.3, veh: 0.05, block: false, light: '#c8d8c0', dark: '#172821' },
  village: { name: 'village', cover: 0.6, conceal: 0.6, foot: 0.55, veh: 0.5, block: true, light: '#d4c3a8', dark: '#2b2620' },
  urban: { name: 'town', cover: 0.7, conceal: 0.65, foot: 0.45, veh: 0.45, block: true, light: '#c9b8a0', dark: '#2e2822' },
  rubble: { name: 'ruins and craters', cover: 0.55, conceal: 0.5, foot: 0.45, veh: 0.2, block: true, light: '#cbbfae', dark: '#29241f' },
  rocky: { name: 'rocky high ground', cover: 0.45, conceal: 0.4, foot: 0.5, veh: 0.2, block: false, light: '#d8cdb8', dark: '#262420' },
  trench: { name: 'trench line', cover: 0.75, conceal: 0.55, foot: 0.5, veh: 0.2, block: false, light: '#cdb99a', dark: '#2a2219' },
  water: { name: 'water', cover: 0, conceal: 0, foot: 0, veh: 0, block: false, impassable: true, light: '#a9c8e0', dark: '#0f2233' },
  beach: { name: 'beach', cover: 0.0, conceal: 0.0, foot: 0.8, veh: 0.7, block: false, light: '#f1e6c2', dark: '#2c2a1c' }
};

/** Feature types the scenario can name and how each becomes terrain. */
export const FEATURE_TERRAIN = {
  hill: null, ridge: null, mountain: 'rocky', woods: 'woods', forest: 'forest', jungle: 'jungle', orchard: 'woods', plantation: 'woods',
  hedgerow: 'hedgerow', bocage: 'hedgerow', field: 'field', open: 'open', desert: 'desert', marsh: 'marsh', swamp: 'marsh', paddy: 'paddy', rice: 'paddy',
  village: 'village', farm: 'village', hamlet: 'village', compound: 'village', town: 'urban', city: 'urban', urban: 'urban', factory: 'urban', base: 'urban', airfield: 'open',
  ruins: 'rubble', rubble: 'rubble', craters: 'rubble', trench: 'trench', trenches: 'trench', wire: 'rubble', minefield: null,
  river: 'water', stream: 'water', canal: 'water', lake: 'water', sea: 'water', water: 'water', beach: 'beach', rocky: 'rocky', rocks: 'rocky',
  road: null, track: null, railway: null, bridge: null, ford: null, crossroads: null, church: 'village', cemetery: 'open', pass: 'rocky', wadi: 'desert', berm: 'desert'
};
export const LINE_FEATURES = ['road', 'track', 'railway', 'river', 'stream', 'canal', 'hedgerow', 'bocage', 'trench', 'trenches', 'ridge', 'wire', 'berm'];

export const UNIT_TYPES = {
  infantry: { name: 'infantry', fp: 1.0, protect: 0, at: 0.3, spot: 1.0, mobility: 'foot', icon: 'inf' },
  mg: { name: 'machine guns', fp: 2.2, protect: 0, at: 0.1, spot: 0.9, mobility: 'foot', icon: 'mg' },
  mortar: { name: 'mortars', fp: 0.5, protect: 0, at: 0, spot: 0.8, mobility: 'foot', icon: 'mortar', indirect: true },
  armor: { name: 'armor', fp: 3.2, protect: 0.8, at: 1.0, spot: 0.8, mobility: 'tracked', icon: 'armor' },
  mech: { name: 'mechanized infantry', fp: 1.5, protect: 0.45, at: 0.6, spot: 0.9, mobility: 'tracked', icon: 'mech' },
  recon: { name: 'reconnaissance', fp: 0.9, protect: 0.1, at: 0.2, spot: 1.6, mobility: 'light', icon: 'recon' },
  engineer: { name: 'engineers', fp: 0.9, protect: 0, at: 0.4, spot: 0.9, mobility: 'foot', icon: 'eng' },
  artillery: { name: 'artillery', fp: 0.3, protect: 0, at: 0.2, spot: 0.7, mobility: 'wheeled', icon: 'arty', indirect: true },
  at: { name: 'anti-tank', fp: 1.0, protect: 0, at: 1.4, spot: 0.9, mobility: 'foot', icon: 'at' },
  hq: { name: 'headquarters', fp: 0.4, protect: 0.1, at: 0.1, spot: 1.0, mobility: 'wheeled', icon: 'hq' },
  sniper: { name: 'sniper', fp: 3.0, protect: 0, at: 0, spot: 1.5, mobility: 'foot', icon: 'sniper' },
  aviation: { name: 'aviation', fp: 4.0, protect: 0.3, at: 1.2, spot: 1.8, mobility: 'air', icon: 'avn' },
  support: { name: 'support', fp: 0.3, protect: 0, at: 0, spot: 0.7, mobility: 'wheeled', icon: 'spt' },
  militia: { name: 'irregulars', fp: 0.8, protect: 0, at: 0.3, spot: 1.2, mobility: 'foot', icon: 'inf' }
};
export const UNIT_TYPE_IDS = Object.keys(UNIT_TYPES);

export const MOBILITY = { foot: { kmh: 1, road: 1.25 }, light: { kmh: 2.5, road: 3.5 }, wheeled: { kmh: 1.8, road: 5 }, tracked: { kmh: 2.2, road: 3.5 }, air: { kmh: 12, road: 12 } };

export const QUALITY = { green: 0.8, regular: 1.0, veteran: 1.15, elite: 1.3 };

export const POSTURES = { moving: { cover: -0.15, conceal: -0.25 }, halted: { cover: 0, conceal: 0 }, cover: { cover: 0.15, conceal: 0.15 }, dug_in: { cover: 0.35, conceal: 0.25 }, assault: { cover: -0.2, conceal: -0.35 }, withdrawing: { cover: -0.1, conceal: -0.1 }, pinned: { cover: 0.1, conceal: 0.05 }, broken: { cover: -0.1, conceal: -0.1 }, ambush: { cover: 0.2, conceal: 0.4 } };

export const WEATHER = {
  clear: { name: 'clear', sight: 1.0, move: 1.0, air: true },
  overcast: { name: 'overcast', sight: 0.9, move: 1.0, air: true },
  rain: { name: 'rain', sight: 0.7, move: 0.85, air: false },
  storm: { name: 'storm', sight: 0.5, move: 0.7, air: false },
  fog: { name: 'fog', sight: 0.35, move: 0.9, air: false },
  snow: { name: 'snow', sight: 0.6, move: 0.7, air: false },
  heat: { name: 'heat', sight: 0.95, move: 0.85, air: true },
  dust: { name: 'dust storm', sight: 0.4, move: 0.8, air: false },
  wind: { name: 'high wind', sight: 0.9, move: 0.9, air: false },
  cold: { name: 'bitter cold', sight: 1.0, move: 0.8, air: true }
};
