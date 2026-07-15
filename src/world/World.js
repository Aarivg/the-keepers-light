import * as THREE from 'three';
import { loadTexture } from './TextureLibrary.js';
import { buildTerrain } from './Terrain.js';
import { buildProps } from './Props.js';
import { buildLighthouse } from './buildings/Lighthouse.js';
import { buildCottage } from './buildings/Cottage.js';
import { buildBoathouse } from './buildings/Boathouse.js';
import { buildCave } from './buildings/Cave.js';
import { buildEndingTrigger } from './EndingTrigger.js';
import { buildNPCs } from './NPCs.js';
import { WORLD_BOUND_RADIUS } from './layout.js';

const SKY_ZENITH = new THREE.Color('#232a3d');
const SKY_HORIZON = new THREE.Color('#d98a52');
const FOG_COLOR = new THREE.Color('#5b5266');

// Phase 4: the generated dusk skybox (see GENERATED_ASSETS.md) replaces the
// flat two-color gradient this dome used to render — same dome mesh, same
// BackSide/no-depth-write setup, just a photo-real-painted sky instead of a
// shader gradient. The 21:9 source image wraps once around the sphere's
// longitude (matching how it was prompted: "seamless left-to-right").
function buildSkyDome() {
  const geo = new THREE.SphereGeometry(400, 24, 16);
  const texture = loadTexture('/generated/skybox.png');
  const mat = new THREE.MeshBasicMaterial({
    map: texture,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
  return new THREE.Mesh(geo, mat);
}

export class World {
  constructor(scene) {
    this.scene = scene;
    this.worldBoundRadius = WORLD_BOUND_RADIUS;

    scene.background = SKY_HORIZON.clone().lerp(SKY_ZENITH, 0.5);
    // Halved from the original 0.011 — mid-distance geometry (the far
    // shoreline, the lighthouse from the dock) was unreadable before this;
    // still enough density that the island reads as foggy/isolated rather
    // than flat and clear at the horizon.
    scene.fog = new THREE.FogExp2(FOG_COLOR, 0.0055);
    scene.add(buildSkyDome());

    this._setupLighting();

    this._terrain = buildTerrain(scene);
    this.shoreMinY = this._terrain.shoreMinY;

    this._colliders = [];
    this._groundMeshes = [...this._terrain.groundMeshes];
    this._updatables = [];

    this._interactableBuildingsPending = []; // filled by attachInteraction()
  }

  // Brightness pass (this phase): every value below is raised from Phase 4's
  // originals (hemi 0.65, sun 1.6, fill 0.35) — colors are untouched, so the
  // dusk-orange/slate-blue mood holds, but the scene reads as "moody, not
  // murky." Kept as instance fields (`this.sun`/`this.fill`/`this.hemi`) so
  // `setNight()` (Chapter 3) can retune them later without rebuilding the
  // scene graph.
  _setupLighting() {
    const hemi = new THREE.HemisphereLight('#8892b0', '#2a2018', 0.95);
    this.scene.add(hemi);
    this.hemi = hemi;

    const sun = new THREE.DirectionalLight('#ffab6b', 2.3);
    sun.position.set(-60, 45, 30);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 260;
    sun.shadow.camera.left = -140;
    sun.shadow.camera.right = 140;
    sun.shadow.camera.top = 140;
    sun.shadow.camera.bottom = -140;
    sun.shadow.bias = -0.0015;
    this.scene.add(sun);
    this.sun = sun;

    const fill = new THREE.DirectionalLight('#4a5a7a', 0.6);
    fill.position.set(50, 30, -40);
    this.scene.add(fill);
    this.fill = fill;
  }

  /**
   * Chapter 3 ("The Reckoning") happens at night: dims the sun near to
   * nothing (there's no more daylight left to speak of), cools and slightly
   * dims the hemisphere fill (moonlight, not sunlight), and thickens the fog
   * a touch for a night-mist read — while staying well short of undoing the
   * brightness pass above; interior/beacon point lights carry legibility
   * once the sun's gone. Idempotent — safe to call once, from
   * Game.js on the Chapter 3 transition.
   */
  setNight() {
    this.sun.intensity = 0.12;
    this.hemi.intensity = 0.55;
    this.hemi.color.set('#5c6a8c');
    this.hemi.groundColor.set('#0d1016');
    this.fill.intensity = 0.4;
    this.fill.color.set('#3a4a6a');
    this.scene.fog.color.set('#20232e');
    this.scene.fog.density = 0.007;
    this.scene.background = new THREE.Color('#12141c');
  }

  /**
   * Builds the three structures, the sea cave, ambient props, and the ending
   * triggers. `journal` and `audio` are threaded through to the buildings so
   * clue objects can log to the journal and (for the radio) play a sound;
   * `getChapter` (a `() => chapterManager.chapter` closure from Game.js)
   * gates the two ending triggers (dock nudge / lamp-room finale — see
   * EndingTrigger.js and Lighthouse.js's `railing`); `onEnding` fires once
   * the player actually ends it at the lamp room; `onTalk(npcId,
   * displayName)` fires when the player interacts with Mara or Thomas.
   */
  attachInteraction(interactionSystem, uiManager, journal, audio, dialogue, getChapter, onEnding, onTalk) {
    const lighthouse = buildLighthouse(this.scene, interactionSystem, uiManager, journal, audio, getChapter, onEnding);
    const cottage = buildCottage(this.scene, interactionSystem, uiManager, journal);
    const boathouse = buildBoathouse(this.scene, interactionSystem, uiManager, journal);
    const cave = buildCave(this.scene, interactionSystem, uiManager, journal);
    const props = buildProps(this.scene, this._terrain);
    const ending = buildEndingTrigger(this.scene, interactionSystem, uiManager, journal, dialogue, getChapter);
    const npcs = buildNPCs(this.scene, interactionSystem, uiManager, this._terrain, onTalk);
    this.npcPortraits = npcs.portraits;
    this._npcs = npcs;

    for (const part of [lighthouse, cottage, boathouse, cave, ending, npcs]) {
      this._colliders.push(...part.colliders);
      this._groundMeshes.push(...part.groundMeshes);
      this._updatables.push(part);
    }
    this._colliders.push(...props.colliders);
    this._updatables.push(props);
  }

  /** Chapter 2 transition: Thomas "arrives" at the cottage — see NPCs.js. */
  revealThomas() {
    this._npcs.revealThomas((c) => this._colliders.push(c));
  }

  /** Chapter 3 transition: both NPCs converge on the lighthouse — see NPCs.js. */
  relocateNpcsForChapter3() {
    this._npcs.relocateForChapter3(this._terrain);
  }

  /** `activeNpcId` is set while the player is mid-conversation with an NPC, so NPCs.js can play a talking animation for that one. */
  update(dt, elapsed, activeNpcId = null) {
    for (const u of this._updatables) u.update?.(dt, elapsed, activeNpcId);
  }

  getGroundMeshes() {
    return this._groundMeshes;
  }

  getColliders() {
    return this._colliders;
  }
}
