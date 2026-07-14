import * as THREE from 'three';
import { flatMaterial } from '../utils.js';

const SKIN = flatMaterial({ color: '#c9a883', roughness: 0.8 });

/**
 * A simple low-poly "voxel person" standing in for real character art —
 * consistent with the rest of the island's flat-shaded, primitive-built
 * look. Feet sit at local y=0. `coatColor` is the main distinguishing color
 * between NPCs until Phase 4 brings in real models.
 */
export function buildHumanoidPlaceholder(coatColor) {
  const coat = flatMaterial({ color: coatColor, roughness: 0.85 });
  const group = new THREE.Group();

  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.8, 0.24), coat);
  legL.position.set(-0.14, 0.4, 0);
  const legR = legL.clone();
  legR.position.x = 0.14;
  group.add(legL, legR);

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.34), coat);
  torso.position.set(0, 1.16, 0);
  group.add(torso);

  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.62, 0.2), coat);
  armL.position.set(-0.42, 1.14, 0);
  const armR = armL.clone();
  armR.position.x = 0.42;
  group.add(armL, armR);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.34, 0.3), SKIN);
  head.position.set(0, 1.7, 0);
  group.add(head);

  group.traverse((c) => {
    if (c.isMesh) {
      c.castShadow = true;
      c.receiveShadow = true;
    }
  });

  return group;
}
