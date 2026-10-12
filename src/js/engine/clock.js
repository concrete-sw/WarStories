// The code owns the clock. Minutes since the operation began, the calendar from
// the scenario's real date, light from the date and latitude (sunrise, sunset,
// twilight, moon), and the date-time groups the radio log uses.

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const pad = (x, n = 2) => String(x).padStart(n, '0');

export function parseStart(date, time) {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(date || '').trim());
  const t = /^(\d{1,2}):(\d{2})$/.exec(String(time || '').trim());
  if (!d) return Date.UTC(1944, 5, 14, 5, 0);
  return Date.UTC(Number(d[1]), Number(d[2]) - 1, Number(d[3]), t ? Math.min(23, Number(t[1])) : 6, t ? Number(t[2]) : 0);
}

export function dateAt(state, minutes = state.clock.minutes) { return new Date(state.clock.start + minutes * 60000); }
export function formatHM(state, minutes = state.clock.minutes) { const d = dateAt(state, minutes); return `${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}`; }
export function formatDate(state, minutes = state.clock.minutes) { const d = dateAt(state, minutes); return `${pad(d.getUTCDate())} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`; }
export function formatDay(state, minutes = state.clock.minutes) { const d = dateAt(state, minutes); return `${DAYS[d.getUTCDay()]} ${pad(d.getUTCDate())} ${MONTHS[d.getUTCMonth()]}`; }
export function formatDTG(state, minutes = state.clock.minutes) { const d = dateAt(state, minutes); return `${pad(d.getUTCDate())}${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${MONTHS[d.getUTCMonth()]}${String(d.getUTCFullYear()).slice(2)}`; }
export function formatStamp(state, minutes = state.clock.minutes) { return `${formatHM(state, minutes)} · ${formatDate(state, minutes)}`; }
export function longDate(state, minutes = state.clock.minutes) { return dateAt(state, minutes).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }); }

/** "1 h 20 min", "3 days 4 h". */
export function formatDuration(min) {
  min = Math.round(min);
  if (min < 60) return `${min} min`;
  if (min < 1440) { const h = Math.floor(min / 60), m = min % 60; return `${h} h${m ? ` ${m} min` : ''}`; }
  const d = Math.floor(min / 1440), h = Math.round((min % 1440) / 60); return `${d} day${d === 1 ? '' : 's'}${h ? ` ${h} h` : ''}`;
}

/** Relative time from H-hour: "H-0:40", "H+2:15", "H+3 days". */
export function relH(state, minutes = state.clock.minutes) {
  const d = minutes - state.mission.hHour;
  const a = Math.abs(d), s = d < 0 ? '-' : '+';
  if (a >= 2880) return `H${s}${Math.round(a / 1440)}d`;
  return `H${s}${Math.floor(a / 60)}:${pad(a % 60)}`;
}

function dayOfYear(d) { return Math.floor((d - Date.UTC(d.getUTCFullYear(), 0, 0)) / 86400000); }

/** Sunrise, sunset and civil twilight as local solar hours for the date and latitude. */
export function sunTimes(dateMs, lat = 45) {
  const d = new Date(dateMs);
  const N = dayOfYear(d);
  const decl = -23.44 * Math.cos((2 * Math.PI / 365) * (N + 10)) * Math.PI / 180;
  const phi = lat * Math.PI / 180;
  const ha = alt => { const c = (Math.sin(alt * Math.PI / 180) - Math.sin(phi) * Math.sin(decl)) / (Math.cos(phi) * Math.cos(decl)); if (c <= -1) return 12; if (c >= 1) return 0; return Math.acos(c) * 180 / Math.PI / 15; };
  const h = ha(-0.833), tw = ha(-6);
  // Wartime and summer clocks ran ahead of the sun; one hour is close enough for the theatres played here.
  const noon = 12.8;
  return { sunrise: noon - h, sunset: noon + h, dawn: noon - tw, dusk: noon + tw };
}

export function moonIllumination(dateMs) {
  const age = ((dateMs - Date.UTC(2000, 0, 6, 18, 14)) / 86400000) % 29.530588853;
  const a = age < 0 ? age + 29.530588853 : age;
  return { age: a, illum: (1 - Math.cos(2 * Math.PI * a / 29.530588853)) / 2 };
}

/** The light right now: 'day' | 'dawn' | 'dusk' | 'night', plus the moon. */
export function lightAt(state, minutes = state.clock.minutes) {
  const ms = state.clock.start + minutes * 60000;
  const d = new Date(ms);
  const h = d.getUTCHours() + d.getUTCMinutes() / 60;
  const s = sunTimes(ms, state.setting?.latitude ?? state.theatre?.lat ?? 45);
  const moon = moonIllumination(ms);
  let phase = 'night';
  if (h >= s.sunrise && h < s.sunset) phase = 'day';
  else if (h >= s.dawn && h < s.sunrise) phase = 'dawn';
  else if (h >= s.sunset && h < s.dusk) phase = 'dusk';
  const moonLabel = moon.illum > 0.85 ? 'full moon' : moon.illum > 0.5 ? 'bright moon' : moon.illum > 0.2 ? 'part moon' : 'no moon';
  return { phase, moon: moon.illum, moonLabel, sunrise: s.sunrise, sunset: s.sunset, label: phase === 'night' ? `night, ${moonLabel}` : phase };
}

export function hoursToHM(h) { const hh = Math.floor(h), mm = Math.round((h - hh) * 60); return `${pad(hh % 24)}${pad(mm === 60 ? 0 : mm)}`; }

/** Sight multiplier from light (night-vision gear helps). */
export function lightFactor(light, nightVision = false) {
  if (light.phase === 'day') return 1;
  if (light.phase === 'dawn' || light.phase === 'dusk') return nightVision ? 0.9 : 0.6;
  const moon = 0.15 + light.moon * 0.25;
  return nightVision ? 0.75 : moon;
}
