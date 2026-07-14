import * as THREE from 'three';
import { buildHumanoidPlaceholder } from './npcs/NPCPlaceholder.js';
import { boxCollider } from './utils.js';
import { MARA_POSITION, THOMAS_POSITION } from './layout.js';

const MARA_COAT = '#3a4f5c'; // weathered navy oilskin
const THOMAS_COAT = '#4a4438'; // muted, practical travel coat

/**
 * Builds Mara and Thomas as simple standing placeholders and registers them
 * with the interaction system. Talking to either replaces the usual
 * examine/clue flow with `onTalk(npcId, displayName)`, which Game.js wires
 * up to open the dialogue UI.
 */
export function buildNPCs(scene, interactionSystem, uiManager, terrain, onTalk) {
  const group = new THREE.Group();
  const colliders = [];

  const mara = buildHumanoidPlaceholder(MARA_COAT);
  const maraY = terrain.heightAt(MARA_POSITION.x, MARA_POSITION.z);
  mara.position.set(MARA_POSITION.x, maraY, MARA_POSITION.z);
  group.add(mara);
  colliders.push(boxCollider(MARA_POSITION.x, maraY, MARA_POSITION.z, 0.7, 1.9, 0.7));
  interactionSystem.register(mara, {
    label: 'Talk to Mara Kessel',
    range: 3.5,
    onInteract: () => onTalk('mara', 'Mara Kessel'),
  });

  const thomas = buildHumanoidPlaceholder(THOMAS_COAT);
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

  return { group, colliders, groundMeshes: [], update() {} };
}
