import * as THREE from 'three';
import { flatMaterial } from '../utils.js';
import { buildLeg, buildArmPivot, buildHeadPivot, applyShadows, animateIdle } from './CharacterKit.js';

const COAT = flatMaterial({ color: '#3d3830', roughness: 0.82 });
const BOOT = flatMaterial({ color: '#1e1a16', roughness: 0.7 });
const SCARF = flatMaterial({ color: '#5c3a3a', roughness: 0.85 });
const SKIN = flatMaterial({ color: '#d8bd9c', roughness: 0.75 });
const HAIR = flatMaterial({ color: '#2b211a', roughness: 0.55 });

/**
 * Thomas Voss — leaner, in a long dark travel coat and a wool scarf,
 * shoulders drawn slightly forward. Same flat-shaded primitive kit as
 * Mara.js; feet sit at local y=0.
 */
export function buildThomas() {
  const group = new THREE.Group();

  group.add(buildLeg(COAT, BOOT, -0.13));
  group.add(buildLeg(COAT, BOOT, 0.13));

  const upperBodyY = 0.86;
  const upperBody = new THREE.Group();
  upperBody.position.y = upperBodyY;
  upperBody.rotation.x = 0.05; // a slight, grief-worn forward stoop
  group.add(upperBody);

  // Long coat skirt flaring over the hips, ahead of the torso box itself.
  const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.42, 0.42, 8), COAT);
  skirt.position.y = -0.05;
  upperBody.add(skirt);

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.68, 0.32), COAT);
  torso.position.y = 0.34;
  upperBody.add(torso);

  const scarf = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.14, 0.28), SCARF);
  scarf.position.y = 0.64;
  upperBody.add(scarf);

  const armRestZ = 0.08;
  const armL = buildArmPivot(COAT, SKIN);
  armL.position.set(-0.34, 0.62, 0);
  armL.rotation.set(-0.1, 0, armRestZ);
  upperBody.add(armL);

  const armR = buildArmPivot(COAT, SKIN);
  armR.position.set(0.34, 0.62, 0);
  armR.rotation.set(-0.1, 0, -armRestZ);
  upperBody.add(armR);

  const head = buildHeadPivot(SKIN, { headSize: [0.28, 0.3, 0.26] });
  head.position.y = 0.68;
  upperBody.add(head);

  // Side-parted hair, offset slightly for a less symmetric silhouette.
  const hair = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.1, 0.28), HAIR);
  hair.position.set(-0.01, 0.26, -0.01);
  head.add(hair);

  applyShadows(group);

  group.userData.rig = {
    upperBody,
    head,
    armL,
    armR,
    rest: {
      upperBodyY,
      upperBodyRotZ: 0,
      headRotX: 0,
      headRotY: 0,
      armL: armRestZ,
      armR: -armRestZ,
    },
  };
  group.userData.phase = Math.random() * Math.PI * 2;
  group.userData.animate = (elapsed, opts) => animateIdle(group, elapsed, opts);

  return group;
}
