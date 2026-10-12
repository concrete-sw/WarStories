// The opening teletype.

const LINES = [
  ['SIGNAL CENTRE · MESSAGE TRAFFIC', 0],
  ['Checking the line to higher headquarters ........ OK', 1],
  ['Loading maps of the sector ...................... OK', 1],
  ['Rolls of the dead and the living ................ OK', 1],
  ['Weather and light tables ........................ OK', 1],
  ['Game Master uplink .............................. DEFERRED (key required)', 2],
  ['', 0],
  ['"Everything in war is very simple, but the simplest thing is difficult."', 0],
  ['', 0],
  ['Press any key or wait.', 0]
];

export function runBoot(el, { reduceMotion = false } = {}) {
  return new Promise(resolve => {
    let i = 0; let finished = false;
    const finish = () => { if (finished) return; finished = true; document.removeEventListener('keydown', finish); document.removeEventListener('pointerdown', finish); resolve(); };
    document.addEventListener('keydown', finish);
    document.addEventListener('pointerdown', finish);
    const step = () => {
      if (finished) return;
      if (i >= LINES.length) { setTimeout(finish, reduceMotion ? 0 : 600); return; }
      const [text, kind] = LINES[i++];
      const span = document.createElement('span');
      span.textContent = text.replace(/OK$/, '');
      if (/OK$/.test(text)) { const ok = document.createElement('span'); ok.className = 'ok'; ok.textContent = 'OK'; span.append(ok); }
      if (kind === 2) span.className = 'warn';
      el.append(span, '\n');
      setTimeout(step, reduceMotion ? 0 : 110 + Math.random() * 170);
    };
    step();
  });
}
