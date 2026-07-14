import * as THREE from 'three';
import { buildMara } from './npcs/Mara.js';
import { buildThomas } from './npcs/Thomas.js';
import { renderPortrait } from './npcs/PortraitRenderer.js';
import { boxCollider } from './utils.js';
import { MARA_POSITION, THOMAS_POSITION } from './layout.js';

/**
 * Builds Mara and Thomas and registers them with the interaction system.
 * Talking to either replaces the usual examine/clue flow with
 * `onTalk(npcId, displayName)`, which Game.js wires up to open the dialogue
 * UI. Each NPC plays a subtle idle animation (breathing, gentle sway) that
 * switches to a livelier "talking" variant while the player is in
 * conversation with them — see npcs/CharacterKit.js.
 */
export function buildNPCs(scene, interactionSystem, uiManager, terrain, onTalk) {
  const group = new THREE.Group();
  const colliders = [];

  const mara = buildMara();
  const maraY = terrain.heightAt(MARA_POSITION.x, MARA_POSITION.z);
  mara.position.set(MARA_POSITION.x, maraY, MARA_POSITION.z);
  group.add(mara);
  colliders.push(boxCollider(MARA_POSITION.x, maraY, MARA_POSITION.z, 0.7, 2.1, 0.7));
  interactionSystem.register(mara, {
    label: 'Talk to Mara Kessel',
    range: 3.5,
    onInteract: () => onTalk('mara', 'Mara Kessel'),
  });

  const thomas = buildThomas();
  const thomasY = terrain.heightAt(THOMAS_POSITION.x, THOMAS_POSITION.z);
  thomas.position.set(THOMAS_POSITION.x, thomasY, THOMAS_POSITION.z);
  group.add(thomas);
  colliders.push(boxCollider(THOMAS_POSITION.x, thomasY, THOMAS_POSITION.z, 0.7, 1.9, 0.7));
  interactionSystem.register(thomas, {
    label: 'Talk to Thomas Voss',
    range: 3.5,
    onInteract: () => onTalk('thomas', 'Thomas Voss'),
  });

  scene.add(group);

  // Dialogue-UI portraits: bust-framed snapshots of these same models, taken
  // once at build time (not re-rendered per frame) — see PortraitRenderer.js.
  // Framing is tuned per character: Mara's sou'wester adds height over
  // Thomas, so her camera sits back a touch further.
  const portraits = {
    mara: renderPortrait(mara, { targetY: 1.55, distance: 2.6 }),
    thomas: renderPortrait(thomas, { targetY: 1.5, distance: 2.4 }),
  };

  return {
    group,
    colliders,
    groundMeshes: [],
    portraits,
    update(dt, elapsed, activeNpcId) {
      mara.userData.animate(elapsed, { talking: activeNpcId === 'mara' });
      thomas.userData.animate(elapsed, { talking: activeNpcId === 'thomas' });
    },
  };
}
