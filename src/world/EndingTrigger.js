import * as THREE from 'three';
import { flatMaterial, lerp } from './utils.js';
import { DOCK } from './layout.js';

const ROPE = flatMaterial({ color: '#7a6a4a', roughness: 0.9 });
const CLEAT = flatMaterial({ color: '#4a4038', roughness: 0.6, metalness: 0.3 });

/**
 * A mooring cleat with a coiled line, near the sea end of the dock — "the
 * boat" the brief's ending points at. Always interactable, but the prompt
 * and behavior change depending on whether the journal is complete: before
 * that it's just a soft nudge to keep exploring, never a hard blocker.
 */
export function buildEndingTrigger(scene, interactionSystem, uiManager, journal, onEnding) {
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
    label: () => (journal.allFound() ? 'Leave the island' : 'The mooring line'),
    range: 3.5,
    onInteract: () => {
      if (journal.allFound()) {
        onEnding();
      } else {
        uiManager.showFeedback("Something keeps you here. There are still answers on this island.");
      }
    },
  });

  return { group, colliders: [], groundMeshes: [], update() {} };
}
