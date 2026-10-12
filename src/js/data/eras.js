// Eras and theatres. Each era carries the technology that shapes play (how
// fast fire support answers, how reliable radios are, how long a wounded man
// has before surgery), a default interface theme, and its theatres with the
// armies that fought there. Wars still being fought in the real world are not
// offered; the near-future option covers modern high-intensity war.

export const ERAS = [
  {
    id: 'ww1', name: 'World War I', years: '1914–1918', tech: 1, theme: 'paper',
    fire: { mortar: 8, artillery: 20, naval: 25, air: 90, helicopter: null, drone: null, rocket: null, gas: 25 }, accuracy: 0.45,
    medicine: { goldenHour: 360, dowRate: 0.35, evac: 'stretcher-bearers to the regimental aid post, then by ambulance to the casualty clearing station' },
    comms: { reliability: 0.55, note: 'No radios forward. Runners, field telephones whose wire is cut by shellfire, flares, pigeons and signal lamps.' },
    night: 'flares and star shells', theatres: [
      { id: 'ww1_western', name: 'Western Front, 1916–18', start: '1916-07-01', from: '1916-02-21', to: '1918-11-10', lat: 50.0, terrain: 'trench lines, wire, shell craters, chalk ridges, ruined villages, shattered woods, sunken roads', bases: ['open', 'rubble', 'field'], armies: ['brit_ww1', 'cdn_ww1', 'anzac_ww1', 'fr_ww1', 'us_ww1', 'ger_ww1'], battles: ['Verdun, 1916', 'The Somme, July 1916', 'Vimy Ridge, April 1917', 'Messines, June 1917', 'Passchendaele, autumn 1917', 'Cambrai, November 1917', 'The German Spring Offensive, March 1918', 'Belleau Wood, June 1918', 'Amiens, August 1918', 'Meuse-Argonne, autumn 1918'] },
      { id: 'ww1_gallipoli', name: 'Gallipoli, 1915', start: '1915-05-19', from: '1915-04-25', to: '1916-01-08', lat: 40.2, terrain: 'steep scrub-covered ridges, ravines, narrow beaches, trenches yards apart', bases: ['rocky', 'open'], armies: ['brit_ww1', 'anzac_ww1', 'fr_ww1', 'ott_ww1'], battles: ['The landings, 25 April 1915', 'Krithia, May 1915', 'The Nek and Lone Pine, August 1915', 'Sari Bair and Chunuk Bair, August 1915', 'Suvla Bay, August 1915'] },
      { id: 'ww1_italy', name: 'Italian Front, 1917', start: '1917-08-19', from: '1915-06-23', to: '1918-11-04', lat: 45.9, terrain: 'Alpine peaks, the bare limestone of the Carso, river valleys, rock galleries', bases: ['rocky', 'open'], armies: ['ita_ww1', 'ah_ww1', 'brit_ww1', 'fr_ww1'], battles: ['The Eleventh Battle of the Isonzo, August 1917', 'Caporetto, October 1917', 'The Piave, June 1918', 'Vittorio Veneto, October 1918'] }
    ]
  },
  {
    id: 'ww2', name: 'World War II', years: '1939–1945', tech: 2, theme: 'paper',
    fire: { mortar: 5, artillery: 10, naval: 15, air: 45, helicopter: null, drone: null, rocket: 15, tank: 8 }, accuracy: 0.55,
    medicine: { goldenHour: 240, dowRate: 0.25, evac: 'aidmen and litter-bearers to the battalion aid station, jeep ambulance to the clearing station' },
    comms: { reliability: 0.7, note: 'Radios at platoon level and above are heavy and temperamental; wire and runners still carry much of the traffic.' },
    night: 'flares and illumination rounds', theatres: [
      { id: 'ww2_west', name: 'Western Europe, 1944–45', start: '1944-06-14', from: '1944-06-06', to: '1945-05-07', lat: 49.3, terrain: 'Norman bocage, hedgerows, orchards, stone farms, flooded marsh, river lines, forests of the Ardennes and the Hürtgen, Dutch polders, German towns', bases: ['field', 'hedgerow', 'woods'], armies: ['us_ww2', 'brit_ww2', 'cdn_ww2', 'pol_ww2', 'fr_ww2', 'ger_ww2'], battles: ['Normandy: the hedgerows, June 1944', 'Operation Cobra, July 1944', 'The Falaise Pocket, August 1944', 'Operation Market Garden, September 1944', 'The Scheldt, October 1944', 'The Hürtgen Forest, autumn 1944', 'The Ardennes (Battle of the Bulge), December 1944', 'The Reichswald, February 1945', 'Crossing the Rhine, March 1945'] },
      { id: 'ww2_italy', name: 'Italy, 1943–45', start: '1944-05-11', from: '1943-09-09', to: '1945-05-02', lat: 41.5, terrain: 'mountain ridgelines, terraced hillsides, stone villages on hilltops, river crossings, mud', bases: ['rocky', 'field'], armies: ['us_ww2', 'brit_ww2', 'cdn_ww2', 'pol_ww2', 'fr_ww2', 'ind_ww2', 'ger_ww2', 'ita_ww2'], battles: ['Salerno, September 1943', 'The Winter Line, December 1943', 'Ortona, December 1943', 'Monte Cassino, 1944', 'Anzio, 1944', 'The Gothic Line, autumn 1944'] },
      { id: 'ww2_east', name: 'Eastern Front, 1941–45', start: '1943-07-05', from: '1941-06-22', to: '1945-05-08', lat: 51.5, terrain: 'steppe, birch woods, balkas (ravines), collective farms, rivers, swamps, frozen ground, ruined cities', bases: ['field', 'open', 'woods'], armies: ['sov_ww2', 'ger_ww2'], battles: ['Barbarossa, summer 1941', 'Moscow, winter 1941', 'Stalingrad, autumn 1942', 'Kursk, July 1943', 'The Dnieper, autumn 1943', 'Operation Bagration, June 1944', 'The Vistula-Oder, January 1945', 'Berlin, April 1945'] },
      { id: 'ww2_africa', name: 'North Africa, 1941–43', start: '1942-10-23', from: '1941-03-24', to: '1943-05-13', lat: 30.8, terrain: 'open desert, escarpments, wadis, salt pans, minefields, ridges named by their height', bases: ['desert', 'rocky'], armies: ['brit_ww2', 'aus_ww2', 'ind_ww2', 'fr_ww2', 'us_ww2', 'ger_ww2', 'ita_ww2'], battles: ['The Siege of Tobruk, 1941', 'Operation Crusader, November 1941', 'Gazala and Bir Hakeim, May 1942', 'First Alamein, July 1942', 'Second Alamein, October 1942', 'Kasserine Pass, February 1943', 'Tunisia, spring 1943'] },
      { id: 'ww2_pacific', name: 'Pacific, 1942–45', start: '1944-07-21', from: '1942-08-07', to: '1945-08-15', lat: 13.4, terrain: 'jungle, coral ridges, caves, beaches, swamp, kunai grass, volcanic rock', bases: ['jungle', 'rocky'], armies: ['usmc_ww2', 'us_ww2', 'aus_ww2', 'ija_ww2'], battles: ['Guadalcanal, 1942', 'The Kokoda Track, 1942', 'Tarawa, November 1943', 'Saipan, June 1944', 'Guam, July 1944', 'Peleliu, September 1944', 'Leyte, October 1944', 'Iwo Jima, February 1945', 'Okinawa, April 1945'] },
      { id: 'ww2_burma', name: 'Burma, 1944–45', start: '1944-04-10', from: '1944-03-08', to: '1945-05-03', lat: 24.8, terrain: 'jungle-covered hills, paddy, teak forest, rivers, hill stations', bases: ['jungle', 'woods'], armies: ['ind_ww2', 'brit_ww2', 'ija_ww2'], battles: ['The Admin Box, February 1944', 'Kohima, April 1944', 'Imphal, 1944', 'Crossing the Irrawaddy, 1945', 'Meiktila, March 1945'] }
    ]
  },
  {
    id: 'korea', name: 'Korea', years: '1950–1953', tech: 3, theme: 'olive',
    fire: { mortar: 4, artillery: 8, naval: 15, air: 30, helicopter: null, drone: null, rocket: null, tank: 6 }, accuracy: 0.6,
    medicine: { goldenHour: 180, dowRate: 0.18, evac: 'litter teams, then H-13 helicopters with patients strapped in external pods to a MASH' },
    comms: { reliability: 0.7, note: 'Radios at platoon and company; the cold kills batteries; wire to the outposts.' },
    night: 'flares, searchlights reflected off clouds', theatres: [
      { id: 'korea', name: 'Korea, 1950–53', start: '1950-11-27', from: '1950-06-25', to: '1953-07-27', lat: 37.8, terrain: 'steep bare ridgelines, frozen rice paddies, narrow valleys, rivers, mud-walled villages, outposts on numbered hills', bases: ['rocky', 'field', 'open'], armies: ['us_korea', 'usmc_korea', 'brit_korea', 'rok_korea', 'pva_korea', 'kpa_korea'], battles: ['The Pusan Perimeter, August 1950', 'Inchon and Seoul, September 1950', 'The Chosin Reservoir, November 1950', 'The Chongchon River, November 1950', 'Chipyong-ni, February 1951', 'The Imjin River, April 1951', 'Kapyong, April 1951', 'Bloody and Heartbreak Ridge, 1951', 'The outpost war, 1952–53', 'Pork Chop Hill, 1953'] }
    ]
  },
  {
    id: 'vietnam', name: 'Vietnam', years: '1965–1972', tech: 4, theme: 'olive',
    fire: { mortar: 3, artillery: 5, naval: 12, air: 15, helicopter: 12, drone: null, rocket: null }, accuracy: 0.65,
    medicine: { goldenHour: 60, dowRate: 0.1, evac: 'Dustoff: a UH-1 MEDEVAC helicopter, often under fire, minutes to a surgical hospital' },
    comms: { reliability: 0.75, note: 'The PRC-25 everywhere, batteries heavy, the antenna draws fire; jungle and hills block the signal.' },
    night: 'starlight scopes (rare), flares, Spooky gunships', theatres: [
      { id: 'vietnam', name: 'Vietnam, 1965–72', start: '1968-02-02', from: '1965-03-08', to: '1972-12-29', lat: 15.9, terrain: 'triple-canopy jungle, elephant grass, rice paddies and dikes, hamlets with tree lines, rubber plantations, highlands, rivers, tunnels', bases: ['jungle', 'paddy', 'field'], armies: ['us_vietnam', 'usmc_vietnam', 'arvn', 'aus_vietnam', 'pavn', 'plaf'], battles: ['Ia Drang, November 1965', 'Long Tan, August 1966', 'Operation Cedar Falls, January 1967', 'Dak To, November 1967', 'The Tet Offensive, 1968', 'Hue, February 1968', 'Khe Sanh, 1968', 'Hamburger Hill, May 1969', 'Fire Support Base Ripcord, 1970', 'The Easter Offensive, 1972'] }
    ]
  },
  {
    id: 'falklands', name: 'Falklands', years: '1982', tech: 5, theme: 'amber',
    fire: { mortar: 3, artillery: 5, naval: 8, air: 25, helicopter: 15, drone: null, rocket: null }, accuracy: 0.7,
    medicine: { goldenHour: 120, dowRate: 0.08, evac: 'casevac by stretcher across peat and rock, then helicopter to the field hospital at Ajax Bay' },
    comms: { reliability: 0.8, note: 'Clansman radios; the cold and the wind; long distances on foot between positions.' },
    night: 'image intensifiers (some), illumination', theatres: [
      { id: 'falklands', name: 'Falklands, 1982', start: '1982-06-11', from: '1982-05-21', to: '1982-06-14', lat: -51.7, terrain: 'bare peat moorland, rock outcrops and stone runs, ridges in the dark, freezing wind, settlements of a few houses', bases: ['open', 'rocky'], armies: ['brit_falklands', 'arg_falklands'], battles: ['San Carlos, May 1982', 'Goose Green, 28 May 1982', 'Mount Harriet, 11 June 1982', 'Mount Longdon, 11 June 1982', 'Two Sisters, 11 June 1982', 'Wireless Ridge, 13 June 1982', 'Mount Tumbledown, 13 June 1982'] }
    ]
  },
  {
    id: 'coldwar', name: 'Cold War gone hot', years: '1985 (fictional war)', tech: 5, theme: 'amber',
    fire: { mortar: 3, artillery: 5, naval: null, air: 20, helicopter: 10, drone: null, rocket: 8, tank: 4 }, accuracy: 0.72,
    medicine: { goldenHour: 60, dowRate: 0.09, evac: 'M113 ambulances and UH-60 MEDEVAC, overwhelmed by mass casualties' },
    comms: { reliability: 0.65, note: 'Massive Soviet radio-electronic combat: jamming, direction-finding and artillery on any emitter.' },
    night: 'image intensifiers and thermal sights in tanks', fictionalWar: true, theatres: [
      { id: 'fulda', name: 'Fulda Gap, 1985 (hypothetical)', start: '1985-08-04', from: '1985-08-01', to: '1985-09-30', lat: 50.55, terrain: 'rolling Hessian hills, beech forests, villages with church towers, the Fulda river, autobahn and narrow roads, the inner German border', bases: ['field', 'woods'], armies: ['us_coldwar', 'bw_coldwar', 'brit_coldwar', 'sov_coldwar', 'nva_coldwar'], battles: ['First day: the covering force battle on the border', 'Defence of the Fulda Gap', 'The Hünfeld counterattack', 'Holding the Vogelsberg', 'The second-echelon army arrives', 'The North German Plain (BAOR sector)'] }
    ]
  },
  {
    id: 'gulf', name: 'Gulf War', years: '1991', tech: 6, theme: 'digital',
    fire: { mortar: 3, artillery: 4, naval: 10, air: 10, helicopter: 8, drone: null, rocket: 6, tank: 3 }, accuracy: 0.8,
    medicine: { goldenHour: 60, dowRate: 0.06, evac: 'MEDEVAC UH-60s and ground ambulances to MASH and combat support hospitals' },
    comms: { reliability: 0.85, note: 'SINCGARS frequency-hopping radios; GPS for the first time; long distances in empty desert.' },
    night: 'thermal sights and night-vision goggles: the night belongs to the coalition', theatres: [
      { id: 'gulf', name: 'Gulf War, 1991', start: '1991-02-25', from: '1991-01-17', to: '1991-02-28', lat: 29.5, terrain: 'flat open desert, berms and minefields, wadis, sand storms, oil fields set on fire, a few tracks and pipelines', bases: ['desert'], armies: ['us_gulf', 'usmc_gulf', 'brit_gulf', 'iraq_gulf'], battles: ['Khafji, January 1991', 'The breach, 24 February 1991', '73 Easting, 26 February 1991', 'Medina Ridge, 27 February 1991', 'Norfolk, 27 February 1991', 'Kuwait City, 26 February 1991'] }
    ]
  },
  {
    id: 'coin', name: 'Iraq and Afghanistan', years: '2003–2014', tech: 7, theme: 'digital',
    fire: { mortar: 3, artillery: 6, naval: null, air: 12, helicopter: 10, drone: 15, rocket: 8 }, accuracy: 0.85,
    medicine: { goldenHour: 60, dowRate: 0.05, evac: 'a 9-line MEDEVAC request; a UH-60 or Chinook in under an hour; tourniquets and combat lifesavers keep men alive until then' },
    comms: { reliability: 0.88, note: 'Radios, satellite links, Blue Force Tracker; the enemy listens to ICOM chatter and you listen to his.' },
    night: 'night vision for every soldier; the enemy fights by day', coin: true, theatres: [
      { id: 'iraq', name: 'Iraq, 2003–2011', start: '2004-11-08', from: '2003-03-20', to: '2011-12-18', lat: 33.35, terrain: 'dense towns of concrete houses and walled compounds, palm groves, canals, highways, desert, the Euphrates and the Tigris', bases: ['urban', 'desert', 'field'], armies: ['us_coin', 'usmc_coin', 'brit_coin', 'aus_coin', 'iraqi_coin'], battles: ['The march up, March 2003', 'Najaf, 2004', 'Second Fallujah, November 2004', 'Tal Afar, 2005', 'Ramadi, 2006', 'The surge in Baghdad, 2007', 'Basra, 2008'] },
      { id: 'afghanistan', name: 'Afghanistan, 2006–2014', start: '2010-07-14', from: '2006-01-01', to: '2014-12-28', lat: 31.6, terrain: 'the green zone of irrigated fields and tree lines, mud-walled compounds, dry riverbeds, mountains and valleys, poppy fields', bases: ['field', 'rocky', 'desert'], armies: ['us_coin', 'usmc_coin', 'brit_coin', 'cdn_coin', 'aus_coin', 'ana_coin'], battles: ['Operation Medusa, September 2006', 'Sangin, 2006–2010', 'Wanat, July 2008', 'Operation Moshtarak (Marjah), February 2010', 'Kandahar, summer 2010', 'The Korengal and the Pech, 2009–10', 'Helmand transition, 2013'] }
    ]
  },
  {
    id: 'future', name: 'Near-future peer war', years: '2030s (fictional nations)', tech: 8, theme: 'tactical',
    fire: { mortar: 2, artillery: 3, naval: 8, air: 15, helicopter: 10, drone: 2, rocket: 4, ew: 1 }, accuracy: 0.9,
    medicine: { goldenHour: 90, dowRate: 0.07, evac: 'robotic casualty carriers and tiltrotors, when the air above is not contested; often it is' },
    comms: { reliability: 0.6, note: 'Everything emits, and everything that emits is found. Jamming, spoofed navigation, drones overhead day and night.' },
    night: 'thermals everywhere, on both sides: night hides nothing', fictionalWar: true, theatres: [
      { id: 'future_merev', name: 'The Merev Plain, 2034 (fictional)', start: '2034-03-18', from: '2034-03-01', to: '2034-12-31', lat: 48.0, terrain: 'open farmland, tree belts, villages, a wide river and its bridges, power lines, ruined industrial towns, trenches dug by machines', bases: ['field', 'open'], armies: ['alc_future', 'kest_future', 'varn_future'], battles: ['The opening drone strikes', 'Holding the Merev bridges', 'The Ostrel salient', 'The winter line', 'The counteroffensive across the river'] },
      { id: 'future_strait', name: 'The Strait of Corran, 2036 (fictional)', start: '2036-06-02', from: '2036-05-20', to: '2036-10-01', lat: 24.0, terrain: 'island coasts, harbour towns, terraced hills, mangrove, airfields, the narrow strait under constant surveillance', bases: ['urban', 'jungle', 'rocky'], armies: ['alc_future', 'varn_future'], battles: ['The landings at Saltash', 'The fight for Port Alder', 'The hill forts', 'Holding the airfield'] }
    ]
  }
];

export const ALL_THEATRES = ERAS.flatMap(e => e.theatres.map(t => ({ ...t, eraId: e.id })));
export const eraById = id => ERAS.find(e => e.id === id) || null;
export const theatreById = id => ALL_THEATRES.find(t => t.id === id) || null;
export const eraOfTheatre = id => eraById(theatreById(id)?.eraId);

// Branches. "make" lists the unit types the player's subordinates are built from.
export const BRANCHES = [
  { id: 'infantry', name: 'Infantry', blurb: 'The rifle, the shovel and your feet. Every war comes down to this.', make: ['infantry', 'infantry', 'infantry', 'mg'], mobility: 'foot' },
  { id: 'airborne', name: 'Airborne', blurb: 'Light infantry delivered by air: scattered, surrounded, outgunned and expected to hold.', make: ['infantry', 'infantry', 'infantry', 'mg'], mobility: 'foot', minTech: 2 },
  { id: 'marines', name: 'Marines', blurb: 'Infantry from the sea: beaches, islands, and the corps that never leaves its people.', make: ['infantry', 'infantry', 'infantry', 'mg'], mobility: 'foot', minTech: 2 },
  { id: 'armor', name: 'Armor', blurb: 'Tanks: speed, shock and a steel box that burns. Fuel and mechanics are your life.', make: ['armor', 'armor', 'armor', 'mech'], mobility: 'tracked' },
  { id: 'mechanized', name: 'Mechanized', blurb: 'Infantry riding into battle in tracks or half-tracks, fighting mounted and dismounted.', make: ['mech', 'mech', 'mech', 'armor'], mobility: 'tracked', minTech: 2 },
  { id: 'special_ops', name: 'Special operations', blurb: 'Raids, reconnaissance, small teams far from help. In the trenches: the raiding parties.', make: ['infantry', 'infantry', 'recon', 'mg'], mobility: 'foot' },
  { id: 'recon', name: 'Reconnaissance', blurb: 'See without being seen. Find the enemy, report him, and get out alive.', make: ['recon', 'recon', 'recon', 'infantry'], mobility: 'light' },
  { id: 'artillery', name: 'Artillery', blurb: 'The guns. At low echelons you are the forward observer with the infantry; higher, you mass fires.', make: ['infantry', 'infantry', 'artillery', 'mg'], mobility: 'foot', observer: true },
  { id: 'engineer', name: 'Combat engineers', blurb: 'Breach the wire, clear the mines, blow the bridge, build the bridge. Under fire.', make: ['engineer', 'engineer', 'infantry', 'mg'], mobility: 'foot' }
];
export const branchById = id => BRANCHES.find(b => b.id === id) || BRANCHES[0];

/** Branches an army can field, in the order of BRANCHES. */
export function branchesFor(army, era) {
  const allowed = army?.branches || BRANCHES.map(b => b.id);
  return BRANCHES.filter(b => allowed.includes(b.id) && (!b.minTech || (era?.tech || 9) >= b.minTech));
}
