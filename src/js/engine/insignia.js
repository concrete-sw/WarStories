// An original unit insignia for every game: a shield, a division of the field,
// a charge for the branch, the unit number and a motto. Generated from a seed,
// never a copy of a real unit's patch, and never a regime's symbol.

import { seededRandom } from './util.js';

const SHIELDS = [
  'M20,18 H180 V108 C180,168 142,204 100,224 C58,204 20,168 20,108 Z',
  'M100,12 L186,42 V122 C186,178 142,208 100,228 C58,208 14,178 14,122 V42 Z',
  'M22,18 H178 V150 Q178,214 100,226 Q22,214 22,150 Z',
  'M30,14 H170 L188,40 V140 L100,228 L12,140 V40 Z',
  'M100,14 C150,14 186,50 186,104 C186,168 140,210 100,226 C60,210 14,168 14,104 C14,50 50,14 100,14 Z'
];
const MOTTOS = ['STAND FAST', 'NEC ASPERA TERRENT', 'SEMPER VIGILANS', 'HOLD THE LINE', 'EVER FORWARD', 'STEADFAST', 'PER ARDUA', 'NONE SHALL PASS', 'FIDELIS ET FORTIS', 'SINE MORA', 'AD FINEM', 'NUNQUAM RETRORSUM', 'VIGILATE', 'FIRM AND TRUE', 'WE FINISH IT', 'NOTHING STOPS US', 'FROM THE MUD', 'PATIENS ET FORTIS', 'ONWARD STILL', 'THE LONG ROAD'];
const BRANCH_COLORS = {
  infantry: ['#1f4fa0', '#e9e4d0'], airborne: ['#1f4fa0', '#e9e4d0'], marines: ['#7a1414', '#e3c15a'], armor: ['#2c5e2e', '#e3c15a'], mechanized: ['#2c5e2e', '#1f4fa0'],
  special_ops: ['#1b1d1a', '#5a7d3a'], recon: ['#c9a227', '#7a1414'], artillery: ['#9e1b1b', '#e3c15a'], engineer: ['#9e1b1b', '#e9e4d0']
};

function star(cx, cy, r) { let d = ''; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5; const rr = i % 2 ? r * 0.42 : r; d += `${i ? 'L' : 'M'}${(cx + rr * Math.cos(a)).toFixed(1)},${(cy + rr * Math.sin(a)).toFixed(1)}`; } return `${d}Z`; }

function charge(kind, fg) {
  switch (kind) {
    case 'star': return `<path d="${star(100, 112, 40)}" fill="${fg}"/>`;
    case 'bolt': return `<path d="M112,58 L76,122 H102 L86,170 L128,100 H102 Z" fill="${fg}"/>`;
    case 'arrow': return `<path d="M100,56 L134,112 H112 V168 H88 V112 H66 Z" fill="${fg}"/>`;
    case 'sword': return `<g fill="${fg}"><path d="M96,52 H104 V140 H96 Z"/><path d="M76,140 H124 V150 H76 Z"/><path d="M96,150 H104 V172 H96 Z"/><circle cx="100" cy="178" r="7"/><path d="M96,52 L100,42 L104,52 Z"/></g>`;
    case 'tower': return `<g fill="${fg}"><path d="M70,84 H82 V96 H94 V84 H106 V96 H118 V84 H130 V168 H70 Z"/><path d="M92,168 V140 Q100,130 108,140 V168 Z" fill="#00000055"/></g>`;
    case 'wings': return `<g fill="${fg}"><path d="M100,110 C80,92 52,88 32,96 C52,104 70,112 100,124 Z"/><path d="M100,110 C120,92 148,88 168,96 C148,104 130,112 100,124 Z"/><circle cx="100" cy="114" r="10"/><path d="M96,124 H104 V170 H96 Z"/></g>`;
    case 'anchor': return `<g fill="none" stroke="${fg}" stroke-width="9" stroke-linecap="round"><circle cx="100" cy="66" r="10"/><path d="M100,76 V170"/><path d="M76,96 H124"/><path d="M58,140 Q64,172 100,172 Q136,172 142,140"/></g>`;
    case 'cannons': return `<g stroke="${fg}" stroke-width="12" stroke-linecap="round"><path d="M62,160 L138,72"/><path d="M138,160 L62,72"/></g>`;
    case 'wheel': return `<g fill="none" stroke="${fg}" stroke-width="8"><circle cx="100" cy="114" r="40"/><circle cx="100" cy="114" r="10" fill="${fg}"/><path d="M100,74 V154 M60,114 H140 M72,86 L128,142 M128,86 L72,142"/></g>`;
    case 'bridge': return `<g fill="none" stroke="${fg}" stroke-width="9"><path d="M50,150 Q100,70 150,150"/><path d="M44,150 H156"/><path d="M76,112 V150 M100,98 V150 M124,112 V150"/></g>`;
    case 'eye': return `<g><path d="M44,114 Q100,60 156,114 Q100,168 44,114 Z" fill="${fg}"/><circle cx="100" cy="114" r="18" fill="#00000088"/></g>`;
    default: return `<path d="M100,60 L140,114 L100,168 L60,114 Z" fill="${fg}"/>`;
  }
}
const BRANCH_CHARGES = { infantry: ['star', 'sword', 'arrow', 'tower'], airborne: ['wings', 'arrow', 'bolt'], marines: ['anchor', 'star', 'sword'], armor: ['wheel', 'bolt', 'tower'], mechanized: ['wheel', 'arrow', 'bolt'], special_ops: ['sword', 'arrow', 'eye'], recon: ['eye', 'arrow', 'star'], artillery: ['cannons', 'bolt', 'star'], engineer: ['bridge', 'tower', 'sword'] };

/** Returns { svg, motto, number }. */
export function makeInsignia({ seed, branch = 'infantry', number = '', motto = null }) {
  const rnd = seededRandom(`insignia:${seed}`);
  const pick = arr => arr[Math.floor(rnd() * arr.length)];
  const shield = pick(SHIELDS);
  const [c1, c2] = BRANCH_COLORS[branch] || BRANCH_COLORS.infantry;
  const division = pick(['plain', 'pale', 'bend', 'chief', 'chevron', 'quarterly', 'plain']);
  const ch = pick(BRANCH_CHARGES[branch] || BRANCH_CHARGES.infantry);
  const m = motto || pick(MOTTOS);
  const num = String(number || '').slice(0, 5);
  const cid = `ins${Math.floor(rnd() * 1e9).toString(36)}`;
  let field = `<path d="${shield}" fill="${c1}"/>`;
  const clip = `<clipPath id="${cid}"><path d="${shield}"/></clipPath>`;
  if (division === 'pale') field += `<rect x="100" y="0" width="100" height="240" fill="${c2}" opacity=".85" clip-path="url(#${cid})"/>`;
  if (division === 'bend') field += `<path d="M0,0 L200,240 V0 Z" fill="${c2}" opacity=".85" clip-path="url(#${cid})"/>`;
  if (division === 'chief') field += `<rect x="0" y="0" width="200" height="58" fill="${c2}" clip-path="url(#${cid})"/>`;
  if (division === 'chevron') field += `<path d="M0,190 L100,120 L200,190 V170 L100,100 L0,170 Z" fill="${c2}" clip-path="url(#${cid})"/>`;
  if (division === 'quarterly') field += `<g clip-path="url(#${cid})" fill="${c2}" opacity=".85"><rect x="100" y="0" width="100" height="116"/><rect x="0" y="116" width="100" height="124"/></g>`;
  const fg = division === 'plain' ? c2 : '#f2ecd8';
  const numberEl = num ? `<text x="100" y="${division === 'chief' ? 46 : 52}" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-weight="700" font-size="${num.length > 3 ? 26 : 32}" fill="${division === 'chief' ? c1 : fg}" stroke="#00000055" stroke-width=".6">${num}</text>` : '';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 270" role="img" aria-label="Unit insignia"><defs>${clip}</defs>${field}<g>${charge(ch, fg)}</g>${numberEl}<path d="${shield}" fill="none" stroke="#111" stroke-width="5"/><path d="${shield}" fill="none" stroke="${c2}" stroke-width="2" transform="translate(100 120) scale(.93) translate(-100 -120)"/><path d="M14,236 Q30,226 44,236 H156 Q170,226 186,236 L178,252 Q168,246 156,252 H44 Q32,246 22,252 Z" fill="#efe6c8" stroke="#111" stroke-width="2.5"/><text x="100" y="248" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="${m.length > 16 ? 9.5 : 11.5}" letter-spacing="1.5" fill="#1a1a1a">${m}</text></svg>`;
  return { svg, motto: m, number: num };
}

/** A unit number pulled from the unit name ("506th PIR" -> 506). */
export function unitNumber(name) {
  const nums = String(name || '').match(/\b(\d{1,4})(st|nd|rd|th|e|\.)?\b/g);
  if (!nums) return '';
  const last = nums[nums.length - 1].replace(/\D/g, '');
  return last;
}
