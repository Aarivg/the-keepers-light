# The Keeper's Light — Phase 2: Clues, Journal & Theory Board

A first-person mystery game. Phase 1 built the engine and island; this phase
adds the actual mystery — nine findable clues, a journal that logs them, a
lightweight theory board for tagging your own read on the case, and a
minimal ending that reflects your tags back at you without resolving
anything. Still no NPCs, no dialogue, no AI calls — that's Phase 3+.

Built with **Three.js** (vanilla, no framework) and **Vite**. Fully
client-side and static — no backend.

## Running it

```bash
npm install
npm run dev
```

Open the printed local URL, click **"Click to begin"** to lock the mouse,
and walk around.

```bash
npm run build     # production build to dist/
npm run preview   # preview the production build
```

## Controls

| Input | Action |
|---|---|
| `W` `A` `S` `D` | Move |
| Mouse | Look |
| `Shift` | Sprint |
| `E` | Interact (when a prompt is on screen) |
| `J` or `Tab` | Open/close the journal & theory board |
| `Esc` | Pause / resume, adjust settings (also closes the journal) |

Mouse sensitivity and Y-axis invert are in the pause menu and persist across
sessions (`localStorage`). Journal/theory-board state is in-memory for the
session only — see "Known limitations" below.

## The mystery, and how to read the clues

Elias Voss, the island's keeper for 22 years, vanished three nights ago
during a storm. Nine clues are scattered across the lighthouse, the
cottage, and the boathouse. Every one of them is written to support **two
complete, contradictory readings** — a grounded story (undisclosed
payments, a falling-out, a staged disappearance) and an uncanny one (the
light "calling" its keepers, as local legend says it once did) — without
ever confirming either. The game will never tell you which one is true.

**If you add or edit a clue, preserve that discipline**: every clue in
`src/journal/clues.js` needs to read as consistent with both framings. Pair
anything eerie with a mundane-enough explanation, and anything mundane with
just enough strangeness that it doesn't fully resolve the question either.
Read back the full set after editing — if one clue tips the balance, soften
it before calling it done.

## What's here (Phase 2 additions)

- **Nine clues**, each attached to a physical object and logged in full in
  `src/journal/clues.js` (the single source of truth for clue text — the
  building files only decide *where* an object sits, never *what* it says):
  logbook and unsent letter (cottage study desk), hidden ledger (locked
  chest — the key is found tucked behind the bedroom photograph), family
  photograph (cottage bedroom), brass bell and the broken lamp bulb
  (lighthouse lamp room), the radio's last transmission and a strangely
  annotated tide chart (lighthouse ground floor), and the second boat with
  fresh damage and drag marks (boathouse).
- **Journal system** (`src/journal/`) — `JournalManager` is plain
  state/logic (found clues in order, per-clue tags, a couple of mechanical
  flags like the chest key, no DOM); `registerClue.js` is the interaction
  helper clue objects use instead of `registerExamine` (which still exists,
  for ambient flavor objects that shouldn't appear in the journal at all —
  the boathouse's tool chest and lantern, for instance).
- **Journal & theory board UI** (`J`/`Tab`) — a two-pane panel: clue list on
  the left (in the order found, with a small dot showing its tag), full
  text + tag buttons on the right, and a live tally footer ("Explainable /
  Uncanny / Untagged"). Tagging is pure flavor — nothing in the code ever
  surfaces a "correct" reading.
- **Non-blocking discovery toast** — examining a clue for the first time
  shows a brief "Journal updated: …" toast (`UIManager.showFeedback`, the
  same placeholder-response mechanism from Phase 1) without pausing
  movement; the full text is read later, at your leisure, in the journal.
- **A locked chest with a real (small) puzzle** — the cottage study chest
  won't open until you've examined the bedroom photograph, which reveals a
  key hidden behind the frame (`journal.setFlag('chestKey')`). The chest's
  prompt text itself changes once it's unlocked.
- **Procedural radio static** — `AudioManager.playRadioStatic()` synthesizes
  a crackling burst (filtered noise + two beating LFOs) each time the radio
  clue is examined, while the transcript renders as clue text — consistent
  with Phase 1's "no audio assets, everything procedural" approach.
- **A minimal ending** — a mooring cleat at the sea end of the dock. Before
  all nine clues are found it just nudges you to keep exploring; once
  they're all logged, interacting there opens a closing overlay that quotes
  your own theory-board tally back at you and nothing more.

## Project structure

```
src/
  core/
    Game.js              orchestrates renderer, scene, camera, main loop,
                          and the playing/paused/journal/ending UI-mode state machine
    InputManager.js       keyboard state, pointer lock, mouse deltas, discrete key "actions"
  player/
    FirstPersonController.js   movement, mouse-look, collision, ground-follow, head-bob
  world/
    layout.js             single source of truth for building/dock/path/spawn coordinates
    utils.js               noise, flat-shaded material helper, collider helpers
    Terrain.js             island heightmap + vertex colors + water + dock
    Props.js                rocks, fence, gulls
    EndingTrigger.js        the dock mooring-cleat ending trigger
    World.js                assembles terrain/buildings/props/ending, lighting, fog, sky
    buildings/
      Lighthouse.js  Cottage.js  Boathouse.js
  interaction/
    InteractionSystem.js   raycast registry, range check, prompt (labels may be
                            a function, for state-dependent prompts), trigger
    registerExamine.js     ambient/flavor "examine" helper — no journal entry
  journal/
    clues.js                the mystery's actual text content (single source of truth)
    JournalManager.js        found-clue list, tags, flags, tally — no DOM
    registerClue.js          journal-aware interaction registration (locked gate,
                             first-time vs. repeat feedback, onEveryInteract hook)
  audio/
    AudioManager.js        procedural footsteps, wind, and radio static (Web Audio API)
  ui/
    UIManager.js  ui.css    crosshair, prompt, start screen, pause/settings menu,
                            journal & theory board panel, ending overlay
  main.js                   entry point
```

## Adding a new clue

1. Add an entry to `CLUES` in `src/journal/clues.js` — `id`, `shortDescription`
   (what shows in the journal list and the discovery toast), `promptLabel`
   (what shows in the `[E] ...` world prompt), and `content` (the full text,
   read in the journal detail pane). `TOTAL_CLUE_COUNT` is derived from this
   object automatically, so the ending trigger's "all clues found" check
   stays in sync without any other change.
2. In the relevant `world/buildings/*.js` file, register the physical object:

```js
import { CLUES } from '../../journal/clues.js';
import { registerClue } from '../../journal/registerClue.js';

registerClue(interactionSystem, uiManager, journal, someMesh, CLUES.MY_NEW_CLUE);

// Gate it behind a flag (a locked container, say):
registerClue(interactionSystem, uiManager, journal, chestMesh, CLUES.MY_NEW_CLUE, {
  isLocked: () => !journal.hasFlag('someKey'),
  lockedMessage: "It's locked.",
});

// Or run a side effect only the moment it's newly logged (unlocking
// something else, playing a sound the first time, etc.):
registerClue(interactionSystem, uiManager, journal, someMesh, CLUES.MY_NEW_CLUE, {
  onFirstFound: (journal) => journal.setFlag('someKey'),
  onEveryInteract: () => audio.playRadioStatic(), // fires every time, not just first
});
```

3. Read the new clue back against the existing nine — does it still leave
   both readings intact? If it only makes sense one way, rewrite it.

For objects that should stay pure ambient flavor (not part of the mystery,
no journal entry), keep using `registerExamine` exactly as in Phase 1.

## Adding a new interactable object (non-clue) or a new building/prop

Unchanged from Phase 1 — see `registerExamine` for ambient objects and
`boxCollider`/`colliderFromObject` in `world/utils.js` for collision.
`world/layout.js` remains the single source of truth for where buildings,
the path, the dock, and spawn sit.

## Known limitations (intentional, for this phase)

- No jumping — this is a walking sim, not a platformer.
- Journal/theory-board state is in-memory only — closing the tab resets it.
  Full save/load is a later pass.
- No NPCs, no dialogue, no AI/LLM calls of any kind — Phase 3+.
- Audio is procedural placeholder, not final sound design.
- Not tested against gamepad/touch input — keyboard + mouse only.
