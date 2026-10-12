# War Stories · Chain of Command

A text-based military command game in your browser. An AI of your choice is the
Game Master: it describes what you see and hear and speaks for everyone around
you. The game itself runs the battle (positions, fire, casualties, ammunition,
radio delays, the enemy's plan), so the AI tells the story but can't make up
the results.

You choose the war, the army, the branch and your command level. As a squad
leader you're in the hedgerow with eight men you know by name, and a
machine gun you can't see is the whole war. As a three-star general you're
in a château forty miles back, reading reports that are six hours old and
deciding which division bleeds.

Everything is in one file, `index.html`. No install, no server, no account.
You bring your own API key.

---

## Quick start

1. **Download** [`WarStories.zip`](WarStories.zip) (on GitHub: click the file,
   then the download button), or use **Code → Download ZIP** for the whole
   repository.
2. **Unzip** it anywhere.
3. **Double-click `index.html`.** It opens in your browser.
4. **Pick a provider, paste your API key**, press *Test connection*, then
   *Report for duty*.
5. Choose your war, army, branch and command level, then press *Report to the
   front*. The Game Master writes the operation (about a minute), and you're in.

The key stays in your browser and goes only to the provider you picked. It's
saved only if you tick *Remember the key*.

### Playing on a phone or tablet

Phones won't run a downloaded HTML file properly (an iPhone can't open one
from the Files app at all), so put the folder on the web. All three of these
are free and take about two minutes:

- **Netlify Drop**: go to <https://app.netlify.com/drop> and drag the unzipped
  `WarStories` folder onto the page. You get a link to open on your phone.
- **Cloudflare Pages**: *Workers & Pages → Create → Pages → Upload assets*,
  then drop the folder.
- **GitHub Pages**: in this repository, *Settings → Pages → Deploy from a
  branch → main → / (root)*. The game is then at
  `https://<owner>.github.io/<repo>/`.

On the phone, use *Share → Add to Home Screen* and it opens full screen like
an app. The layout switches to a bottom tab bar on phones and to one panel at a
time on tablets.

---

## API keys and providers

| Provider | Get a key | Notes |
|---|---|---|
| Anthropic (Claude) | <https://console.anthropic.com/settings/keys> | Recommended. Keys start `sk-ant-`. |
| Google Gemini | <https://aistudio.google.com/apikey> | Has a free tier. |
| OpenAI | <https://platform.openai.com/api-keys> | Keys start `sk-`. |
| DeepSeek | <https://platform.deepseek.com/api_keys> | Inexpensive and good at role-play. Replies are capped, so the operation is written in three parts. |
| xAI (Grok) | <https://console.x.ai/> | Keys start `xai-`. |
| Groq | <https://console.groq.com/keys> | Very fast. Smaller models struggle with the long operation JSON. |
| Mistral | <https://console.mistral.ai/api-keys/> | |
| Ollama (local) | <https://ollama.com/> | No key. Start it with `OLLAMA_ORIGINS="*"` so the page may call it. Use a large model (30B+). |
| Custom | — | Any endpoint that speaks OpenAI's `POST /chat/completions` with streaming. Set the base URL. |

**About CORS.** The game calls the provider straight from your browser, with
no server in between. The providers above allow that. If you see a network or
CORS error, the endpoint doesn't accept browser calls. Use another provider,
or put an OpenAI-compatible proxy in front of it and pick *Custom*.

**What it costs.** You pay the provider for what you use. Writing an operation
is one large reply. Each turn after that sends the current situation (a few
thousand tokens) and gets a short reply. Big models write better; small fast
models are cheaper and get the JSON wrong more often (the game asks again when
that happens).

---

## How to play

### The screen

Panels open as windows on a laptop, one at a time on a tablet, and as tabs on a
phone.

| Panel | What it's for |
|---|---|
| **Log** | The story, radio traffic, reports. Your choices and the *Carry on* button are here. |
| **Map** | The grid map: terrain, your units as reported, enemy contacts (solid = seen, dashed = probable, dotted = possible; they fade with age). Draw phase lines, objectives, TRPs, checkpoints and boundaries. |
| **Orders** | Planning steps before H-hour, a quick-order form, the five-paragraph order, and the orders in effect. |
| **Roster** | Your people: who they are, how they're doing, what they last said. Talk to anyone, recommend awards, write to families. |
| **Radio** | Your nets, plus templates for SALUTE, SITREP, 9-line MEDEVAC, call for fire and resupply. |
| **Fires** | Mortars, artillery, air and what's available. |
| **Intel / Staff / Logistics** | Reports (with reliability grades), your staff's opinions (they disagree), ammo, water, fuel, casualties. |
| **You** | Your own condition, fatigue and stress. |
| **Journal / Letters / Record** | Your notes, letters home and from home, and your service record, including the Wall. |

### Giving orders

Type in the command bar, or use the quick-order form.

```
2nd squad, move to D5
BAR team, base of fire on I9; Able team, move to G10 in order to flank the gun
Bravo, assault the farm
all units dig in
mortars on I9, fire for effect
I move to H12
hold fire        weapons free
```

- **Map squares** are a column letter and a row number (`C4`); north is up.
- **Several orders at once**: separate them with `;` or full stops.
- **Clear orders arrive faster and get misread less.** A purpose ("in order
  to…"), timing ("on my signal"), a control measure ("to PL BLUE") or a route
  ("via the sunken lane") all help.
- Orders take time to arrive, and longer the higher you are. They can be
  misunderstood, and the enemy has his own plan.
- Anything the game can't parse goes to the Game Master, who decides how your
  subordinate understood it.
- **Carry on** lets time run until something needs you: contact, a casualty,
  a report, an arrival, H-hour.
- **CONTACT!** When something hits you suddenly, the game stops and gives you a
  few seconds to answer. If you hesitate, your men act on their training and
  your order lands late.
- Before H-hour your troops hold their fire unless they're fired on or ordered
  to shoot, so they don't give their positions away. Say *weapons free* to
  change that.

Typed shortcuts: `map`, `roster`, `comms`, `sitrep`, `carry on`,
`write home`, `talk to Brennan`, `save`.
Keys: `/` jumps to the command bar, `1`–`4` pick a choice, `Alt+1`–`9` open
panels, `Esc` closes one.

### Your command level changes the game

| Level | You control | You see | Your risk | A turn in contact | Map square |
|---|---|---|---|---|---|
| Fireteam leader | 3–4 soldiers by name | Only your own eyes | In the fight; you can die | ~1 min | 50 m |
| Squad leader | 2–3 fireteams, 8–13 named men | Your eyes, shouting, hand signals | In the dirt with them | ~2 min | 100 m |
| Platoon leader / sergeant | 3–4 squads, attachments | Your sector, squad reports, company net | High | ~5 min | 200 m |
| Company commander | 3–4 platoons, mortars | Company map, platoon reports | Moderate; your CP gets shelled | ~15 min | 400 m |
| Battalion commander | Companies, fire support, a staff | Ops map, briefings, reports up to an hour old | Low, unless you go forward | ~1 h | 1 km |
| Brigade / regiment | Battalions, aviation, engineers | Intel estimates, reports hours old | Low | ~4 h | 2.5 km |
| Division (2-star) | Brigades, division artillery, air | The theatre by the day; politics; the press | Very low | ~12 h | 5 km |
| Corps (3-star) | Divisions, allies, theatre logistics | Late, inflated and wrong reports | You'll be relieved before you're killed | ~1 day | 10 km |

- **Squad and platoon** play like survival. Everyone has a name and a voice.
  You see what you see, you shout orders, and the casualties are people you
  were talking to an hour ago.
- **Company** is the hinge. You still know your platoon leaders, but you fight
  by radio and map, and your mortars matter more than your rifle.
- **Battalion and up** is a command post. The staff briefs you and argues with
  you; reports are late and sometimes wrong; units are symbols until you go
  forward to look (*visit*), which costs time and puts you at risk.
- **Division and corps** run in days. You weigh the main effort, the reserve,
  logistics, allies and the press, and casualties come in as numbers until
  you read the names.

### Eras

World War I (Western Front, Gallipoli, Italy), World War II (Western Europe,
Italy, Eastern Front, North Africa, Pacific, Burma), Korea, Vietnam, the
Falklands, a Cold War that went hot in 1985 (Fulda Gap), the Gulf War,
Iraq and Afghanistan, and a near-future war between fictional nations. There
are 54 armies with their own ranks, kit, radios, slang, awards and names. The
look changes with the era: typewriter paper, olive drab, amber phosphor,
digital and tactical night themes.

No war that's still being fought is offered.

### Campaigns, saves and Ironman

- **Single operation** or a **campaign** of several. In a campaign, survivors
  carry over (with their wounds, their kills and what they've been through),
  replacements arrive green, mail comes, and promotion can move you up a
  command level.
- The **after-action review** shows how it really went: a rating, the enemy's
  actual positions and plan, what fooled you, the roll call and awards
  (yours and the ones you recommended, approved or not).
- **Saves**: the game autosaves. There are five manual slots (*Settings →
  Save here*); a manual slot only changes when you save to it. You can also
  export a game to a file (*Settings*) and import it on the setup screen
  (*Resume → Import a save*).
- **Ironman**: no reloads, losses are permanent, and the autosave is the only
  save.

---

## For developers

The game is plain JavaScript modules in `src/`, bundled into the single
`index.html` by a small script with no dependencies.

```
src/index.html          page shell (screens, banners, dock, command bar)
src/css/style.css       themes, windows, map, phone/tablet layouts
src/js/main.js          entry point
src/js/providers/       Anthropic, Gemini, OpenAI-compatible (+ SSE parsing)
src/js/data/            eras, theatres, armies, ranks, names, terrain, echelons
src/js/engine/          grid, sim, combat, orders, fires, enemy AI, logistics,
                        casualties, generator, GM turn loop, AAR, campaign
src/js/prompts/         GM system prompt, operation prompt, AAR and mail prompts
src/js/ui/              app, window manager, map view, panels
dev/build.js            bundler: writes index.html, icons, manifest, WarStories.zip
dev/mock-gm.js          offline OpenAI-compatible mock Game Master
dev/samples/            two sample operations (WWII squad attack, 1985 battalion defence)
dev/engine-check.mjs    engine tests (no browser)
dev/playthrough.mjs     full Playwright playthrough at laptop, tablet and phone widths
```

### Rebuild

```
node dev/build.js
```

This writes `index.html`, `WarStories.zip`, the icons and the manifest. Commit
the built files, since they're what players download. Modules are wrapped in
functions, so the bundle runs from `file://` (no ES-module loading, which
browsers block on local files). Keep each `import` on one line; import cycles
are refused at build time.

### Test

```
node dev/engine-check.mjs     # ~60 engine checks, about a second
node dev/mock-gm.js           # mock GM on http://localhost:8787/v1
node dev/playthrough.mjs      # needs Playwright + Chromium; starts its own mock
npm test                      # build + engine check + playthrough
```

To play against the mock: run `node dev/mock-gm.js`, open `index.html`, choose
*Custom*, set the base URL to `http://localhost:8787/v1`, and enter any key and
model. The mock serves the two sample operations and canned turns, so the
whole game (including the AAR and mail call) runs without spending tokens.

### Adding a provider

Anything that speaks OpenAI's chat-completions protocol is one entry in
`src/js/providers/index.js`:

```js
makeOpenAICompatible({
  id: 'myprovider', name: 'My Provider', baseUrl: 'https://api.example.com/v1',
  defaultModel: 'model-name', models: ['model-name'],
  keyUrl: 'https://example.com/keys', notes: 'Shown under the key field.'
})
```

For a different protocol, copy `anthropic.js` or `gemini.js`. A provider is an
object with `id`, `name`, `defaultModel`, `models`, `keyUrl`, `notes` and an
async generator `stream({ apiKey, model, system, messages, json, maxTokens,
temperature, signal })` that yields text chunks and returns a finish reason
(`'stop'`, `'length'`, `'refusal'` or `null`). Then rebuild.

### Adding an era or army

Eras and theatres are in `src/js/data/eras.js`, armies (kit, radios, vehicles,
support, branches, slang) in `src/js/data/armies.js`, and rank tables and
awards in its `FAMILIES`. Name pools are in `src/js/data/names.js`. Run the
engine check after a change; it checks era gating (no airborne in 1916), rank
titles, and that every theatre's armies exist.

---

## A note on the content

War Stories is fiction set in real wars. The battles and armies are historical
(except the 1985 war and the near-future one, which are invented), but the
operations, units and people are made up by the Game Master each time. It aims
for the weight of the real thing: fear, confusion, orders that arrive late,
men who don't come back, letters to families. It doesn't glorify war.

The game offers no war that's still being fought. You can play any side of the
wars it covers, including armies that fought for regimes that committed
atrocities. Those are portrayed honestly and never celebrated. There are no
Waffen-SS units. Ethnic slurs are kept out of the dialogue.
