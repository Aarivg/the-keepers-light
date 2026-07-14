# Generated art log (Phase 4, live Higgsfield calls)

This is the checkable record for the Phase 4 art pass: every `generate_image`
call made against the Higgsfield MCP server, its prompt, and its outcome.
Machine-readable version: `public/generated/manifest.json`. Raw source URLs
(CloudFront, time-limited) are in the manifest; the files actually committed
to this repo live under `public/generated/`.

**Model:** every call below was submitted with `model: "nano_banana_pro"`.
Higgsfield's API routed all nine jobs to `nano_banana_2` instead — visible in
`params.model` on every raw `job_status` response. That's a live-behavior
detail worth flagging, not a substitution made by this integration.

**Style prefix** (written once, reused verbatim in every prompt below):

> Moody painterly matte-illustration game art, flat-shaded low-poly aesthetic
> with soft directional lighting, warm dusk-orange and overcast slate-blue
> palette, isolated foggy coastal lighthouse-island mood, muted weathered
> color grading, subtle grain, no text, no watermark, no logo —

## AI-generated via Higgsfield (5/9) — downloaded to `public/generated/`, wired into the scene

| Asset | Job ID | Prompt (appended to the style prefix) | Used in |
|---|---|---|---|
| `textures/ground.png` | `a5031937-76a2-48d3-86dc-e805a348faa5` | a seamless tileable top-down texture of coastal dirt-and-gravel path ground, patchy dry grass and packed earth, small pebbles, flat even lighting with no shadows or highlights, no horizon, no objects, no characters | `Terrain.js` terrain mesh `map` |
| `textures/rock.png` | `fcb71e0d-87b0-43a9-b06f-c109a74864c2` | a seamless tileable top-down texture of weathered grey coastal rock and boulder surface, cracked stone with lichen patches, flat even lighting with no shadows or highlights, no horizon, no objects, no characters | `Props.js` boulder `map` |
| `textures/wood.png` | `88f9eff4-9251-457c-8966-34adfe6f0bd4` | a seamless tileable top-down texture of old weathered dark wood planks, salt-worn grain, faint cracks, flat even lighting with no shadows or highlights, no horizon, no objects, no characters | dock planks + all three buildings' `WOOD`/`WOOD_DARK` |
| `textures/metal.png` | `e7be6ee1-5aad-4a71-8e55-7f55bc748018` | a seamless tileable top-down texture of rusted worn metal plate, oxidized brass-and-iron surface with scratches and patina, flat even lighting with no shadows or highlights, no horizon, no objects, no characters | `METAL`/`BRASS` in Lighthouse/Cottage/Boathouse |
| `skybox.png` | `22bfbc30-4f1d-4364-9767-be2e3f386c4e` | a wide panoramic dusk sky vista over a lonely sea horizon, layered overcast clouds glowing orange near the horizon fading to deep slate-blue overhead, no ground, no islands, no buildings, no birds, no characters, seamless left-to-right horizon band | `World.js` sky dome `map` |

Each row's job ID can be re-queried with Higgsfield's `job_status` tool
(`sync: true`) — that's the actual API confirmation, not just a file on disk.

## Blocked at Higgsfield (4/9) — never started there, built procedurally instead

The workspace ran out of credits (`balance` → `{"credits": 0,
"subscription_plan_type": "free"}`) partway through the batch. These four all
returned an immediate, explicit error and **no job was ever created** for
them — nothing to poll, nothing to fall back to:

| Asset | Would-be prompt | Error |
|---|---|---|
| `props/photo-dock.png` | an aged vintage photograph, slightly faded warm sepia tone, of a middle-aged lighthouse keeper man and a younger laughing woman with wind-blown hair, standing together on a wooden dock, pencil-written corner, candid snapshot composition | `Error starting generation: Out of credits in the selected workspace.` |
| `props/photo-solo.png` | an aged vintage photograph, slightly less faded than an older photo, of the same middle-aged lighthouse keeper man now alone and older, standing on the same wooden dock in the same spot, self-timer snapshot, solemn expression, candid composition | same |
| `portraits/mara.png` | a character portrait, waist-up, three-quarter view, of Mara Kessel, a stocky weathered middle-aged female supply-boat captain with a gruff guarded expression and sun-worn skin, wearing a navy oilskin coat and a yellow sou'wester hat, coastal dock backdrop | same |
| `portraits/thomas.png` | a character portrait, waist-up, three-quarter view, of Thomas Voss, a lean young man in his late twenties outwardly grieving with careful anxious eyes and combed dark hair, wearing a long dark travel coat and a muted maroon scarf, cottage backdrop | same |

The user declined to purchase credits. Before building anything, I re-checked
live whether the free plan had any no-cost path (`balance`,
`show_plans_and_credits`): no daily/monthly free-tier reset exists on the
free plan. The only $0 option is a 3-day trial that requires a card on file
and auto-charges $49/mo afterward unless cancelled — a purchase-adjacent
commitment, not a free path, so it wasn't used either.

**These four are now built procedurally instead — not AI-generated, and not
placeholder/missing.** Distinguishing which-is-which matters if this gets
revisited later, so to be explicit:

| Asset | Source | Built by |
|---|---|---|
| `textures/ground.png`, `rock.png`, `wood.png`, `metal.png`, `skybox.png` | **AI-generated** (Higgsfield, `nano_banana_pro`→`nano_banana_2`) | committed PNGs under `public/generated/` |
| Dock photo (Elias & Rina) | **Procedural** — Canvas2D | `src/journal/PhotoArt.js` → `renderDockPhoto()` |
| Solo photo (Elias alone) | **Procedural** — Canvas2D | `src/journal/PhotoArt.js` → `renderSoloPhoto()` |
| Mara dialogue portrait | **Procedural** — offscreen Three.js snapshot of the real in-world model | `src/world/npcs/PortraitRenderer.js` → `renderPortrait(mara, ...)` |
| Thomas dialogue portrait | **Procedural** — offscreen Three.js snapshot of the real in-world model | `src/world/npcs/PortraitRenderer.js` → `renderPortrait(thomas, ...)` |

**Photographs** (`PhotoArt.js`): flat-shaded, low-poly-silhouette figures
(trapezoid coats, circle heads, no facial detail — these read as found
photographs, not portraits) drawn on a Canvas2D dusk-sky/dock-plank
background using the exact same hex colors as `World.js`'s sky gradient and
`Terrain.js`'s dock wood, then aged with a sepia multiply-tint, vignette, and
grain so they read as artifacts rather than in-engine renders. `vignette()`
is exported and reused by the portrait renderer so both procedural asset
kinds share one "aging" treatment. Wired into `Cottage.js`: two
`THREE.CanvasTexture`s created once at module load, mapped onto
`PlaneGeometry` planes parented to the existing `photoFrame` prop — the dock
photo sits flush on the front face, the solo photo is offset to visibly poke
out from behind the frame's right edge (the frame box is only 30×22cm, too
small for a subtle within-bounds peek to read at gameplay distance).

**Portraits** (`PortraitRenderer.js`): rather than a separate 2D image, this
clones the *actual* built `mara`/`thomas` groups from `Mara.js`/`Thomas.js`,
renders a bust-framed snapshot with a temporary offscreen `WebGLRenderer` and
its own three-point lighting rig using the same key/fill light colors as
`World.js`'s sun/fill lights (`#ffab6b` / `#4a5a7a`) so the lighting mood
matches the island, then composites the same `vignette()` on top via a
second Canvas2D pass (a canvas can only bind one context type, so the WebGL
output is `drawImage()`'d onto a separate 2D canvas before vignetting).
Rendered once per NPC in `NPCs.js`'s `buildNPCs()` at world-build time, not
per frame — the resulting data URLs are stored on the returned `portraits`
object, threaded through `World.attachInteraction()` →
`World.npcPortraits` → `Game._openDialogue()` → `UIManager.showDialogue()`,
which sets `<img id="dialogue-npc-portrait">`'s `src`. This guarantees the
dialogue portrait and the in-world character are pixel-consistent (arguably
stronger than a separately generated 2D image would have been).

If Higgsfield credits become available later, these four can still be
regenerated with the same style prefix and model and dropped into
`public/generated/props/` and `public/generated/portraits/` — but nothing
about the current implementation requires that; the procedural versions are
the real, shipped assets, not stand-ins.

## Caching

**AI-generated assets:** `src/world/TextureLibrary.js` caches loaded
`THREE.Texture` objects in memory by path so the 5 Higgsfield assets (wood
reused 3x, metal reused 2x) are each fetched/uploaded once per session. The
real "don't regenerate" cache is disk itself: the files already committed
under `public/generated/` are the source of truth — re-running the
generation step should check for an existing file at the target path before
calling Higgsfield again.

**Procedural assets:** the two photographs and two portraits have no disk
cache — there's no external API call to avoid repeating, so "regenerating"
just means re-running deterministic drawing code. What's cached is the
*render*, not a prompt result: `Cottage.js` creates its two
`THREE.CanvasTexture`s once at module load (not per frame, not per
`buildCottage()` call), and `NPCs.js`'s `buildNPCs()` calls
`renderPortrait()` exactly once per NPC at world-build time, storing the
result on the returned `portraits` object rather than re-rendering on every
dialogue open.
