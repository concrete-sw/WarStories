// Every panel, in dock order. Which ones appear depends on the command level
// (ECHELONS[].panels), the war (no radio panel without radios in the
// field), and whether there is fire support.

import { registerLog } from './log.js';
import { registerBriefing } from './briefing.js';
import { registerOrders } from './orders.js';
import { registerMap } from './map.js';
import { registerRadio } from './radio.js';
import { registerRoster } from './roster.js';
import { registerIntel } from './intel.js';
import { registerFires } from './fires.js';
import { registerLogistics } from './logistics.js';
import { registerStaff } from './staff.js';
import { registerSelf } from './self.js';
import { registerJournal } from './journal.js';
import { registerLetters } from './letters.js';
import { registerRecord } from './record.js';
import { registerSettings } from './settings.js';
import { registerHelp } from './help.js';

export const ALL_PANELS = ['log', 'map', 'orders', 'roster', 'radio', 'briefing', 'staff', 'intel', 'fires', 'logistics', 'self', 'journal', 'letters', 'record'];
/** On a phone these sit in the bottom bar; the rest live under "More". */
export const PHONE_TABS = ['log', 'map', 'orders', 'roster', 'radio'];

export function registerPanels(app) {
  const ctx = { S: () => app.state, reg: def => app.wm.register(def), readOnly: () => !!app.state?.ended };
  for (const fn of [registerLog, registerBriefing, registerOrders, registerMap, registerRadio, registerRoster, registerIntel, registerFires, registerLogistics, registerStaff, registerSelf, registerJournal, registerLetters, registerRecord, registerSettings, registerHelp]) fn(app, ctx);
}

/** The dock for this game. */
export function dockOrder(app) {
  const ech = app.ctx.echelon; const s = app.state;
  const allowed = new Set(ech.panels);
  if (!s.fires.assets.length) allowed.delete('fires');
  const order = ALL_PANELS.filter(id => allowed.has(id) || id === 'staff' && ech.tier >= 3);
  return [...order, '---', 'more', 'tile', 'settings', 'help'];
}
