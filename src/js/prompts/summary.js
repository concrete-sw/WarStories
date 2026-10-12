// Folding older turns into a running summary so the GM keeps the thread.

export function buildSummaryPrompt({ previousSummary, turns }) {
  return `Update the running summary of a military command game. Keep everything that matters later: orders given and how they went, who was killed or wounded and how, promises and grudges, what the player was told and by whom, what the enemy was seen doing, prisoners and civilians, decisions about conduct, the state of supply and radios. Plain prose, past tense, under 350 words. Do not invent anything.

PREVIOUS SUMMARY:
${previousSummary || '(none)'}

TURNS TO FOLD IN:
${turns.map(t => `${t.role === 'user' ? 'GAME/PLAYER' : 'GM'}: ${t.content}`).join('\n\n')}

Write only the updated summary.`;
}
