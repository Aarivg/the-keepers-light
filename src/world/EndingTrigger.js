import * as THREE from 'three';
import { flatMaterial, lerp } from './utils.js';
import { DOCK } from './layout.js';

const ROPE = flatMaterial({ color: '#7a6a4a', roughness: 0.9 });
const CLEAT = flatMaterial({ color: '#4a4038', roughness: 0.6, metalness: 0.3 });

/**
 * A mooring cleat with a coiled line, near the sea end of the dock. Used to
 * be where the game ended; this phase moves that to the lighthouse's lamp
 * room instead (Chapter 3, "The Reckoning" — see Lighthouse.js's
 * `buildLampRoomEnding` and README's chapter-structure note), so this spot's
 * job now is purely a soft nudge: while Chapter 1/2 conditions aren't met
 * yet, gently explain why; once Chapter 3 has begun, redirect the player
 * back to the light rather than ending the game here.
 */
export function buildEndingTrigger(scene, interactionSystem, uiManager, journal, dialogue, getChapter) {
  const group = new THREE.Group();

  const z = DOCK.seaZ - 3;
  const t = (z - DOCK.landZ) / (DOCK.seaZ - DOCK.landZ);
  const y = lerp(DOCK.surfaceYLand, DOCK.surfaceYSea, t);

  const cleat = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.14, 0.4), CLEAT);
  cleat.position.set(DOCK.x + 1.3, y + 0.07, z);
  cleat.castShadow = true;
  group.add(cleat);

  const rope = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.045, 8, 16), ROPE);
  rope.rotation.x = Math.PI / 2;
  rope.position.set(DOCK.x + 1.3, y + 0.1, z);
  rope.castShadow = true;
  group.add(rope);

  scene.add(group);

  interactionSystem.register(cleat, {
    label: 'The mooring line',
    range: 3.5,
    onInteract: () => {
      const chapter = getChapter();
      if (chapter >= 3) {
        uiManager.showFeedback("This isn't where it ends anymore. Go back to the light.");
      } else if (!journal.allFound()) {
        uiManager.showFeedback('Something keeps you here. There are still answers on this island.');
      } else if (!dialogue.hasSpokenTo('mara')) {
        uiManager.showFeedback('The boat captain by the dock might know more than she\'s letting on.');
      } else {
        uiManager.showFeedback("You should talk to both of them before you go.");
      }
    },
  });

  return { group, colliders: [], groundMeshes: [], update() {} };
}
