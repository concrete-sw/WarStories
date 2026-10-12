// The after-action review and the letters between operations.

export function buildAARPrompt({ state, aar, truth }) {
  return `A military command game operation has ENDED. Write the after-action review as an honest, experienced officer would: what was supposed to happen, what happened, why, what to sustain and what to improve. No moralising, no flattery; name names. Stay consistent with the facts below and the operation truth; do not invent casualties or events.

OPERATION TRUTH (now unsealed):
${JSON.stringify(truth)}

HOW IT ENDED: ${aar.endText} · outcome ${aar.outcome.toUpperCase()} · ${aar.outcomeText || ''}
THE PLAYER: ${aar.player}
STATISTICS: ${JSON.stringify(aar.stats)}
DECISIONS IN ORDER: ${aar.timeline.map(d => `${d.time} ${d.text}`).join(' | ').slice(0, 5000)}
WHAT THE PLAYER BELIEVED ABOUT THE ENEMY AT THE END: ${JSON.stringify(aar.picture)}
WHERE THE ENEMY REALLY WAS AT THE END: ${JSON.stringify(aar.truthAtEnd)}
DECEPTIONS: ${JSON.stringify(aar.deceptions)}
ROLL CALL: ${JSON.stringify(aar.rollCall).slice(0, 3000)}
CONDUCT: ${JSON.stringify(aar.conduct)}
RATING BY THE GAME: ${aar.rating.grade} (${aar.rating.score}/100)
AWARDS DECIDED BY THE GAME: ${JSON.stringify(aar.awards)}
GAME SUMMARY SO FAR: ${state.summary || '(none)'}

Output ONE JSON object, no fences:
{
  "verdict": "two or three sentences: the honest bottom line",
  "whatHappened": "the true story of the operation, now that the truth is unsealed: the enemy's plan, what he did, what the player never saw (120-220 words)",
  "sustain": ["2-4 things the player did right, specific"],
  "improve": ["2-4 things missed or done wrong, specific"],
  "deceptions": [ { "what": "the deceptive indicator", "truth": "what it really was", "fooled": true } ],
  "enemyView": "how the enemy commander saw this fight, in his voice, 40-90 words",
  "higherView": "how the player's superior sees them now, 30-70 words",
  "theMen": "how the soldiers talk about the player now, 30-70 words",
  "history": "how history records this action (for real battles, against what actually happened), 30-80 words",
  "citation": "if the game awarded the player a decoration: the citation in period style (60-120 words); otherwise null",
  "epitaph": "if the player was killed: one honest sentence for them; otherwise null"
}`;
}

export function buildMailCallPrompt({ state, letters, soldiers, families, opSummary }) {
  return `Between operations in a military command game it is MAIL CALL. Write the letters that arrive, shaped by what actually happened. Era: ${state.era.name}; army: ${state.settings.armyId}. Letters take time: news may be weeks old, families may not know yet what happened, or may have just heard.

WHAT HAPPENED IN THE LAST OPERATION: ${opSummary}
THE PLAYER: ${state.people.p0.rank} ${state.people.p0.name} from ${state.people.p0.hometown}.
LETTERS THE PLAYER WROTE (home, and to families of the dead): ${JSON.stringify(letters).slice(0, 4000)}
SOLDIERS WHO MAY GET MAIL (id, name, hometown, detail): ${JSON.stringify(soldiers).slice(0, 3000)}
FAMILIES OF THE FALLEN THE PLAYER WROTE TO: ${JSON.stringify(families).slice(0, 2000)}

Write 2-5 letters: replies to the player's own letters home (if any), replies from families the player wrote to (grief, anger, gratitude, questions; honest, never sentimental cliché), and letters to 1-3 soldiers (home news: a farm struggling, a girl who married someone else, a new baby, a brother wounded elsewhere). Each in the writer's own voice and period style, 60-160 words.

Output ONE JSON object, no fences:
{ "letters": [ { "to": "p0 or a soldier id", "from": "who writes, e.g. 'his mother, Edna Kowalski'", "replyTo": "id of the player's letter this answers, or null", "text": "the letter", "morale": <-10..10> } ] }`;
}
