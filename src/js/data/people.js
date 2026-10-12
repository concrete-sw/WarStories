// What makes a soldier a person: traits, personal details, breaking points,
// and the player's own background. Era tags keep a 1916 rifleman from owning a
// transistor radio. The AI writes leaders; code draws the rank and file from here.

const E = (text, eras = null) => ({ text, eras });

export const TRAITS = [
  E('steady under fire'), E('hothead'), E('quiet, watches everything'), E('the platoon comedian'), E('devout, prays before every move'), E('card sharp'),
  E('crack shot, grew up hunting'), E('farm boy, can fix anything with wire'), E('former mechanic'), E('big talker, small deeds'), E('hates officers'),
  E('good with radios'), E('former boxer'), E('chain smoker'), E('can\'t swim and won\'t admit it'), E('writes poetry nobody is allowed to read'),
  E('scrounger: finds what the army cannot'), E('sleepwalker'), E('loner'), E('everybody\'s big brother'), E('superstitious about everything'),
  E('lied about his age to enlist'), E('volunteered twice'), E('a reluctant conscript'), E('former schoolteacher'), E('reads anything with words on it'),
  E('cook\'s son, feeds everyone'), E('sharp-eyed, first to spot movement'), E('slow but never quits'), E('freezes the first time, never again'),
  E('speaks a little of the local language'), E('fast runner, natural messenger'), E('cannot stop counting things'), E('gambler'), E('musician'),
  E('former miner, unafraid of tunnels'), E('city kid, hates the dark'), E('sees too much and says too little'), E('stubborn as a mule'), E('pathological optimist')
];

export const DETAILS = [
  E('writes to his mother every single day'), E('owes half the squad money'), E('is trying to grow a moustache and failing'), E('was a seminarian before the war'),
  E('collects shell fragments as souvenirs'), E('carries his father\'s pocket watch'), E('has a baby daughter he has never seen'), E('keeps a list of every town he has passed through'),
  E('can recite whole baseball seasons', ['ww2', 'korea', 'vietnam']), E('swears he will open a bakery after the war'), E('his brother is in another theatre'),
  E('learned to read from the newspapers in his barracks'), E('is engaged to a girl who stopped writing'), E('is the first in his family to leave the county'),
  E('sends half his pay home to the farm'), E('keeps a rosary he says he doesn\'t believe in'), E('was a railway clerk and knows every timetable'),
  E('sketches the men in a pocket notebook'), E('his wife is expecting in the spring'), E('cuts everyone\'s hair'), E('carries a harmonica'), E('keeps the squad\'s lucky deck of cards'),
  E('wants to be a doctor'), E('has a twin in the same regiment'), E('is still angry at the recruiter'), E('talks about his dog more than his girl'),
  E('plays chess by mail with his old teacher'), E('was a lifeguard'), E('was in prison before the army took him'), E('learned his trade on fishing boats'),
  E('records voice messages for his kids', ['coin', 'future']), E('keeps a photo of his motorcycle', ['korea', 'vietnam', 'falklands', 'coldwar', 'gulf', 'coin', 'future']),
  E('streams nothing, posts nothing, misses his gaming nights', ['future']), E('has a phone full of his daughter\'s drawings', ['coin', 'future'])
];

export const BREAKING_POINTS = [
  'losing his buddy', 'being left behind', 'night', 'artillery', 'killing at close range', 'seeing civilians hurt', 'being trapped underground', 'the screams of the wounded',
  'a pointless order', 'fire', 'being blamed', 'waiting without news from home', 'the smell of the dead', 'a friend\'s cowardice', 'being wounded again', 'snipers', 'gas', 'drones overhead', 'mines', 'water and drowning'
];

export const NICKNAMES = ['Doc', 'Tex', 'Red', 'Slim', 'Shorty', 'Preacher', 'Professor', 'Lucky', 'Kid', 'Pop', 'Bear', 'Sparks', 'Chief', 'Hollywood', 'Moose', 'Whitey', 'Smitty', 'Ski', 'Dutch', 'Mac', 'Rebel', 'Cookie', 'Hoss', 'Brains', 'Sarge', 'Tiny', 'Deacon', 'Flash', 'Gator', 'Ace', 'Book', 'Bones', 'Rabbit', 'Ghost', 'Jinx'];

export const PLAYER_BACKGROUNDS = [
  { id: 'mechanic', name: 'Former mechanic', bonus: 'Vehicles and weapons stay working longer; resupply of parts and fuel goes further.', effect: { maintenance: 1 } },
  { id: 'rotc', name: 'College ROTC / officer school', bonus: 'Your orders are clearer: fewer misread orders, faster execution.', effect: { orders: 1 } },
  { id: 'reenlisted', name: 'Reenlisted after a previous war', bonus: 'The men trust a veteran: morale holds a little longer, and you spot ambushes sooner.', effect: { morale: 1, spot: 1 } },
  { id: 'language', name: 'Speaks the local language', bonus: 'Civilians and prisoners tell you more; interrogation and liaison go better.', effect: { language: 1 } },
  { id: 'hunter', name: 'Hunter from the backcountry', bonus: 'You read ground and spot movement others miss.', effect: { spot: 1 } },
  { id: 'outdoors', name: 'Scout and woodsman', bonus: 'You do not get lost; your units stray less at night.', effect: { navigation: 1 } },
  { id: 'radio', name: 'Radio ham', bonus: 'Your nets stay up longer and your calls for fire are cleaner.', effect: { comms: 1 } },
  { id: 'medic', name: 'Medical training', bonus: 'More of your wounded survive.', effect: { medicine: 1 } },
  { id: 'athlete', name: 'Athlete', bonus: 'You tire more slowly and can go forward faster.', effect: { fatigue: 1 } },
  { id: 'staff', name: 'Staff college graduate', bonus: 'Planning takes less time and your staff works faster.', effect: { planning: 1 } },
  { id: 'mustang', name: 'Came up from the ranks', bonus: 'The soldiers know you were one of them: trust rises faster.', effect: { morale: 1 } }
];
export const backgroundById = id => PLAYER_BACKGROUNDS.find(b => b.id === id) || null;

/** Era-appropriate items from an E() list. */
export function forEra(list, eraId) { return list.filter(x => !x.eras || x.eras.includes(eraId)).map(x => x.text); }
