# The Keeper's Light — Phase 1: Engine & Environment

A first-person walking-sim foundation for a 3D mystery game. This phase is
purely the engine and island — movement, collision, atmosphere, and an
interaction scaffold. No dialogue, no AI, no clues that "mean" anything yet.
That comes in later phases.

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
| `Esc` | Pause / resume, adjust settings |

Mouse sensitivity and Y-axis invert are in the pause menu and persist across
sessions (`localStorage`).

## What's here

- **First-person controller** — WASD + pointer-lock mouse-look, sprint,
  distance-driven head-bob, and kinematic collision (no physics engine —
  a capsule-vs-box resolver, which is the right tradeoff for a walking sim:
  predictable, no jitter, easy to reason about). Ground height is sampled by
  raycasting straight down each frame against a "ground meshes" list, which
  is how stairs, floors, and terrain all just work without special cases.
- **Procedural low-poly island** — a single generated terrain mesh (value
  noise for rolling hills + a perturbed-radius shoreline), vertex-colored
  for grass/dirt/rock/gravel rather than textured, flat-shaded for the
  faceted Firewatch-esque look. A dirt path (Catmull-Rom spline) connects
  the dock, boathouse, cottage, and lighthouse. The shoreline doubles as an
  invisible world boundary — walking toward bare terrain below the waterline
  threshold is quietly rejected, so you can't wade out to sea or fall off
  the world.
- **Three enterable structures**: the lighthouse (16-gon tower, three wall
  bands, a helical staircase built from oriented tread meshes, a glazed lamp
  room with a slow-rotating beacon), the keeper's cottage (main room, study,
  bedroom, gabled roof), and the boathouse (one room, open front, a boat
  that's suspiciously still tied up).
- **Interaction scaffold** — center-screen raycast against a flat registry
  of interactable objects, range-checked, with a `[E] <label>` prompt and a
  placeholder feedback toast + console log on trigger. 10 objects are wired
  up across the three buildings (see below).
- **Procedural audio** — no sound files yet, so footsteps and the ambient
  wind drone are synthesized with the Web Audio API (filtered noise bursts /
  a slowly-modulated lowpass drone). Swap in real samples later without
  touching call sites.
- **UI shell** — crosshair, interaction prompt, start screen, and a pause
  menu with a sensitivity slider and invert-Y toggle. `UIManager` has a
  `registerPausePanel(element)` extension point for Phase 2's journal UI.
- **Atmosphere** — a gradient sky dome, `FogExp2`, a low dusk sun with warm/
  cool complementary fill light, and per-building ambient touches (a lit
  lantern in the boathouse, a rotating lighthouse beacon) so the island
  already feels like somewhere something happened, before any mystery
  content exists.

## Project structure

```
src/
  core/
    Game.js              orchestrates renderer, scene, camera, main loop, pause flow
    InputManager.js       keyboard state, pointer lock, mouse deltas, discrete key "actions"
  player/
    FirstPersonController.js   movement, mouse-look, collision, ground-follow, head-bob
  world/
    layout.js             single source of truth for building/dock/path/spawn coordinates
    utils.js               noise, flat-shaded material helper, collider helpers
    Terrain.js             island heightmap + vertex colors + water + dock
    Props.js                rocks, fence, gulls
    World.js                assembles terrain/buildings/props, lighting, fog, sky
    buildings/
      Lighthouse.js  Cottage.js  Boathouse.js
  interaction/
    InteractionSystem.js   raycast registry, range check, prompt, trigger
    registerExamine.js     shared helper for placeholder "examine" responses
  audio/
    AudioManager.js        procedural footsteps + wind (Web Audio API)
  ui/
    UIManager.js  ui.css    crosshair, prompt, start screen, pause/settings menu
  main.js                   entry point
```

## Adding a new interactable object (for Phase 2)

The whole point of the scaffold is that adding a clue object never touches
raycasting, prompts, or range checks — just register the mesh:

```js
import { registerExamine } from '../../interaction/registerExamine.js';

// quick placeholder-style registration (console log + toast):
registerExamine(
  interactionSystem,
  uiManager,
  someMesh,
  'Examine the torn letter',
  'Placeholder response text.'
);

// or register directly for full control over the callback, e.g. once
// Phase 2's journal exists:
interactionSystem.register(someMesh, {
  label: 'Examine the torn letter',
  range: 3.2,          // optional, defaults to the system's maxRange
  promptKey: 'E',      // optional, defaults to 'E'
  onInteract: (entry) => {
    journal.addEntry('torn-letter');
    uiManager.showFeedback('Added to journal: Torn Letter');
  },
});
```

`register()` accepts any `THREE.Object3D` (mesh or group) — every mesh
descendant becomes raycastable automatically. Call `interactionSystem.
unregister(object)` if an object needs to stop being interactable later
(e.g. consumed items).

If the object should also block movement (furniture, not small props),
push an AABB into the building's `colliders` array — see any of the
`boxCollider(...)` calls in `buildings/*.js` for the pattern, or
`colliderFromObject(mesh)` in `world/utils.js` to derive one from an
existing mesh's current world transform.

## Adding a new building or prop

`world/layout.js` is the single source of truth for where things sit —
building centers, floor heights, pad radii, the path spline, dock, and
spawn point. Terrain flattening, wall placement, and prop scattering all
read from it, so a new structure only needs an entry there plus a
`buildX(scene, interactionSystem, uiManager)` function under
`world/buildings/` that returns `{ group, colliders, groundMeshes, update() }`
and is wired into `World.attachInteraction()`.

## Known limitations (intentional, for this phase)

- No jumping — this is a walking sim, not a platformer.
- No save system, no journal/clue logic, no NPCs or dialogue — Phase 2+.
- Audio is procedural placeholder, not final sound design.
- Not tested against gamepad/touch input — keyboard + mouse only.
