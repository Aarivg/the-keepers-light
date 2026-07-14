import * as THREE from 'three';
import { flatMaterial } from '../utils.js';

const EYE = flatMaterial({ color: '#1c1712', roughness: 0.5 });

/**
 * Shared low-level parts for building humanoid NPCs out of the same
 * flat-shaded primitives as the rest of the island — a leg (thigh + boot),
 * an arm pivoted at the shoulder (so rotating it swings naturally), and a
 * head pivoted at the neck (so it can nod/turn). Mara.js and Thomas.js
 * compose these into two visually distinct characters; feet sit at local
 * y=0 on the returned root.
 */

export function buildLeg(coatMat, bootMat, x) {
  const group = new THREE.Group();
  const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.78, 0.24), coatMat);
  thigh.position.set(x, 0.47, 0);
  const boot = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.16, 0.3), bootMat);
  boot.position.set(x, 0.08, 0.03);
  group.add(thigh, boot);
  return group;
}

/** Returns a Group pivoted at the shoulder joint, containing upper arm + forearm + hand. */
export function buildArmPivot(sleeveMat, handMat, { upperLength = 0.32, foreLength = 0.28, width = 0.16 } = {}) {
  const pivot = new THREE.Group();
  const upper = new THREE.Mesh(new THREE.BoxGeometry(width, upperLength, width), sleeveMat);
  upper.position.set(0, -upperLength / 2, 0);
  const fore = new THREE.Mesh(new THREE.BoxGeometry(width * 0.9, foreLength, width * 0.9), sleeveMat);
  fore.position.set(0, -upperLength - foreLength / 2, 0);
  const hand = new THREE.Mesh(new THREE.BoxGeometry(width * 0.8, 0.14, width * 0.8), handMat);
  hand.position.set(0, -upperLength - foreLength - 0.07, 0);
  pivot.add(upper, fore, hand);
  return pivot;
}

/** Returns a Group pivoted at the neck, containing the head (+eyes) sized by `headSize`. */
export function buildHeadPivot(skinMat, { headSize = [0.3, 0.32, 0.28] } = {}) {
  const [w, h, d] = headSize;
  const pivot = new THREE.Group();
  const headMesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), skinMat);
  headMesh.position.set(0, h / 2, 0);
  pivot.add(headMesh);

  const eyeGeo = new THREE.BoxGeometry(0.035, 0.035, 0.02);
  const eyeL = new THREE.Mesh(eyeGeo, EYE);
  eyeL.position.set(-w * 0.22, h * 0.55, d / 2 + 0.005);
  const eyeR = eyeL.clone();
  eyeR.position.x = w * 0.22;
  pivot.add(eyeL, eyeR);

  pivot.userData.headMesh = headMesh;
  return pivot;
}

export function applyShadows(root) {
  root.traverse((c) => {
    if (c.isMesh) {
      c.castShadow = true;
      c.receiveShadow = true;
    }
  });
}

/**
 * Drives a character's idle/talking animation from its `userData.rig`
 * (set by Mara.js/Thomas.js): a slow breathing bob + gentle sway always
 * play; while `talking` is true, the head and lead arm pick up a faster,
 * more animated cadence to read as "mid-conversation." Angles are computed
 * fresh each call from `rig.rest`, not accumulated, so there's no drift.
 */
export function animateIdle(character, elapsed, { talking = false } = {}) {
  const { upperBody, head, armL, armR, rest } = character.userData.rig;
  const phase = character.userData.phase;

  upperBody.position.y = rest.upperBodyY + Math.sin(elapsed * 1.1 + phase) * 0.012;
  upperBody.rotation.z = rest.upperBodyRotZ + Math.sin(elapsed * 0.35 + phase) * 0.035;

  if (talking) {
    head.rotation.x = rest.headRotX + Math.sin(elapsed * 3.2 + phase) * 0.09;
    head.rotation.y = rest.headRotY + Math.sin(elapsed * 1.7 + phase) * 0.12;
    armR.rotation.z = rest.armR + Math.sin(elapsed * 2.6 + phase) * 0.16;
  } else {
    head.rotation.x = rest.headRotX;
    head.rotation.y = rest.headRotY + Math.sin(elapsed * 0.22 + phase * 1.3) * 0.08;
    armR.rotation.z = rest.armR;
  }
  armL.rotation.z = rest.armL + Math.sin(elapsed * 0.28 + phase + Math.PI) * 0.02;
}
