// localStorage persistence: settings, API config, an autosave slot and five
// manual slots, export and import. Ironman games live in the autosave slot only.

const KEY_SETTINGS = 'warstories.settings';
const KEY_API = 'warstories.api';
const KEY_SLOT = n => `warstories.slot.${n}`;
const KEY_RECENT = 'warstories.recent';
export const SLOT_COUNT = 5;

function read(key, fallback) { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; } }
function write(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; } }

export const DEFAULT_SETTINGS = { reduceMotion: false, typeSpeed: 'normal', theme: 'era', highContrast: false, sound: false, volume: 0.4, contactTimer: 20, textSize: 'normal', windows: {} };
export const loadSettings = () => ({ ...DEFAULT_SETTINGS, ...read(KEY_SETTINGS, {}) });
export const saveSettings = s => write(KEY_SETTINGS, s);

export const loadApiConfig = () => read(KEY_API, { providerId: 'anthropic', apiKey: '', model: '', baseUrl: '', remember: false });
export const saveApiConfig = c => write(KEY_API, c);
export const forgetApiKey = () => { const c = loadApiConfig(); c.apiKey = ''; c.remember = false; write(KEY_API, c); };

/** What recent operations used, so the mission table rotates. */
export const loadRecent = () => read(KEY_RECENT, { missions: [], complications: [] });
export function rememberOperation(seed) {
  const r = loadRecent();
  if (seed?.mission?.n) r.missions = [seed.mission.n, ...(r.missions || []).filter(x => x !== seed.mission.n)].slice(0, 8);
  if (seed?.complication) r.complications = [seed.complication, ...(r.complications || []).filter(x => x !== seed.complication)].slice(0, 6);
  return write(KEY_RECENT, r);
}

// Slot 0 is the autosave; slots 1..SLOT_COUNT are manual.
export function listSlots() {
  const out = [];
  for (let i = 0; i <= SLOT_COUNT; i++) {
    const s = read(KEY_SLOT(i), null); const st = s?.state;
    out.push(st ? { slot: i, savedAt: s.savedAt, codename: st.truth?.codename, title: st.truth?.title, player: st.people?.p0 ? `${st.people.p0.rank} ${st.people.p0.name}` : '', echelon: st.settings?.echelonId, era: st.era?.name, ironman: !!st.settings?.ironman, ended: !!st.ended, turn: st.turnCount, aar: !!st.aar } : { slot: i, empty: true });
  }
  return out;
}
export function saveSlot(n, state) { return write(KEY_SLOT(n), { savedAt: new Date().toISOString(), state }); }
export function loadSlot(n) { return read(KEY_SLOT(n), null)?.state || null; }
export function deleteSlot(n) { try { localStorage.removeItem(KEY_SLOT(n)); } catch { /* ignore */ } }

export function exportState(state) {
  const blob = new Blob([JSON.stringify({ app: 'warstories', version: 1, savedAt: new Date().toISOString(), state }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${(state.truth?.codename || 'operation').replace(/[^\w-]+/g, '_')}.warstories.json`;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export function importStateFromFile(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(new Error('Could not read file'));
    r.onload = () => {
      try {
        const parsed = JSON.parse(r.result);
        const state = parsed?.state || parsed;
        if (!state?.truth || !state?.units || !state?.clock) throw new Error('Not a War Stories save file');
        resolve(state);
      } catch (e) { reject(e); }
    };
    r.readAsText(file);
  });
}
