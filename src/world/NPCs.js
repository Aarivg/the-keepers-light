import * as THREE from 'three';
import { buildMara } from './npcs/Mara.js';
import { buildThomas } from './npcs/Thomas.js';
import { renderPortrait } from './npcs/PortraitRenderer.js';
import { boxCollider } from './utils.js';
import {
  MARA_POSITION,
  THOMAS_POSITION,
  MARA_CHAPTER3_POSITION,
  THOMAS_CHAPTER3_POSITION,
} from './layout.js';

/**
 * Builds Mara and Thomas and registers them with the interaction system.
 * Talking to either replaces the usual examine/clue flow with
 * `onTalk(npcId, displayName)`, which Game.js wires up to open the dialogue
 * UI. Each NPC plays a subtle idle animation (breathing, gentle sway) that
 * switches to a livelier "talking" variant while the player is in
 * conversation with them — see npcs/CharacterKit.js.
 *
 * Thomas is built (and portrait-rendered) up front like Mara, but starts
 * invisible and unregistered — per this phase's Chapter 1/2 split, he
 * "arrives" at the cottage only once Chapter 2 begins. Invisible objects are
 * skipped by InteractionSystem's raycaster, so no extra gating is needed
 * beyond `thomas.visible = false` — see `revealThomas()`.
 */
export function buildNPCs(scene, interactionSystem, uiManager, terrain, onTalk) {
  const group = new THREE.Group();
  const colliders = [];

  const mara = buildMara();
  const maraY = terrain.heightAt(MARA_POSITION.x, MARA_POSITION.z);
  mara.position.set(MARA_POSITION.x, maraY, MARA_POSITION.z);
  group.add(mara);
  const maraCollider = boxCollider(MARA_POSITION.x, maraY, MARA_POSITION.z, 0.7, 2.1, 0.7);
  colliders.push(maraCollider);
  interactionSystem.register(mara, {
    label: 'Talk to Mara Kessel',
    range: 3.5,
    onInteract: () => onTalk('mara', 'Mara Kessel'),
  });

  const thomas = buildThomas();
  const thomasY = terrain.heightAt(THOMAS_POSITION.x, THOMAS_POSITION.z);
  thomas.position.set(THOMAS_POSITION.x, thomasY, THOMAS_POSITION.z);
  thomas.visible = false;
  group.add(thomas);

  scene.add(group);

  // Dialogue-UI portraits: bust-framed snapshots of these same models, taken
  // once at build time (not re-rendered per frame) — see PortraitRenderer.js.
  // Framing is tuned per character: Mara's sou'wester adds height over
  // Thomas, so her camera sits back a touch further. Thomas's invisibility
  // doesn't affect this — renderPortrait() clones into its own offscreen
  // scene regardless of the source object's visibility.
  const portraits = {
    mara: renderPortrait(mara, { targetY: 1.55, distance: 2.6 }),
    thomas: renderPortrait(thomas, { targetY: 1.5, distance: 2.4 }),
  };

  let thomasRevealed = false;
  let thomasCollider = null;

  /** Called once, on the Chapter 2 transition — see Game.js. */
  function revealThomas(addCollider) {
    if (thomasRevealed) return;
    thomasRevealed = true;
    thomas.visible = true;
    thomasCollider = boxCollider(THOMAS_POSITION.x, thomasY, THOMAS_POSITION.z, 0.7, 1.9, 0.7);
    addCollider(thomasCollider);
    interactionSystem.register(thomas, {
      label: 'Talk to Thomas Voss',
      range: 3.5,
      onInteract: () => onTalk('thomas', 'Thomas Voss'),
    });
  }

  /** Called once, on the Chapter 3 transition — both NPCs converge on the lighthouse for the final conversation. Mutates the shared collider objects in place so they move with the meshes. */
  function relocateForChapter3(terrain) {
    const maraY3 = terrain.heightAt(MARA_CHAPTER3_POSITION.x, MARA_CHAPTER3_POSITION.z);
    mara.position.set(MARA_CHAPTER3_POSITION.x, maraY3, MARA_CHAPTER3_POSITION.z);
    Object.assign(maraCollider, boxCollider(MARA_CHAPTER3_POSITION.x, maraY3, MARA_CHAPTER3_POSITION.z, 0.7, 2.1, 0.7));

    if (thomasCollider) {
      const thomasY3 = terrain.heightAt(THOMAS_CHAPTER3_POSITION.x, THOMAS_CHAPTER3_POSITION.z);
      thomas.position.set(THOMAS_CHAPTER3_POSITION.x, thomasY3, THOMAS_CHAPTER3_POSITION.z);
      Object.assign(thomasCollider, boxCollider(THOMAS_CHAPTER3_POSITION.x, thomasY3, THOMAS_CHAPTER3_POSITION.z, 0.7, 1.9, 0.7));
    }
  }

  return {
    group,
    colliders,
    groundMeshes: [],
    portraits,
    revealThomas,
    relocateForChapter3,
    update(dt, elapsed, activeNpcId) {
      mara.userData.animate(elapsed, { talking: activeNpcId === 'mara' });
      thomas.userData.animate(elapsed, { talking: activeNpcId === 'thomas' });
    },
  };
}
