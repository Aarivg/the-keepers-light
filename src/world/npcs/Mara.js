import * as THREE from 'three';
import { flatMaterial } from '../utils.js';
import { buildLeg, buildArmPivot, buildHeadPivot, applyShadows, animateIdle } from './CharacterKit.js';

const COAT = flatMaterial({ color: '#3a4f5c', roughness: 0.85 });
const COAT_TRIM = flatMaterial({ color: '#25333c', roughness: 0.85 });
const BOOT = flatMaterial({ color: '#201c19', roughness: 0.7 });
const HAT = flatMaterial({ color: '#c9a83a', roughness: 0.75 });
const HAT_BRIM = flatMaterial({ color: '#a3842c', roughness: 0.75 });
const SKIN = flatMaterial({ color: '#b98a68', roughness: 0.8 });
const GLOVE = flatMaterial({ color: '#3a2b1e', roughness: 0.75 });
const ROPE = flatMaterial({ color: '#a4895c', roughness: 0.9 });

/**
 * Mara Kessel — stocky supply-boat captain: broad oilskin coat, a
 * sou'wester hat, a coil of dock rope at her hip. Built from the same
 * flat-shaded primitive kit as Thomas.js so the two read as part of one
 * world; feet sit at local y=0.
 */
export function buildMara() {
  const group = new THREE.Group();

  group.add(buildLeg(COAT, BOOT, -0.16));
  group.add(buildLeg(COAT, BOOT, 0.16));

  const upperBodyY = 0.86;
  const upperBody = new THREE.Group();
  upperBody.position.y = upperBodyY;
  group.add(upperBody);

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.72, 0.42), COAT);
  torso.position.y = 0.36;
  upperBody.add(torso);

  const collar = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.3), COAT_TRIM);
  collar.position.y = 0.68;
  upperBody.add(collar);

  const rope = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.045, 6, 10), ROPE);
  rope.rotation.x = Math.PI / 2;
  rope.position.set(0.38, 0.1, 0.05);
  upperBody.add(rope);

  const armRestZ = 0.18;
  const armL = buildArmPivot(COAT, GLOVE);
  armL.position.set(-0.42, 0.66, 0);
  armL.rotation.z = armRestZ;
  upperBody.add(armL);

  const armR = buildArmPivot(COAT, GLOVE);
  armR.position.set(0.42, 0.66, 0);
  armR.rotation.z = -armRestZ;
  upperBody.add(armR);

  const head = buildHeadPivot(SKIN, { headSize: [0.32, 0.32, 0.3] });
  head.position.y = 0.72;
  upperBody.add(head);

  // Sou'wester hat: wide flat brim + domed crown, sitting on the head pivot.
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.24, 0.05, 8), HAT_BRIM);
  brim.position.y = 0.33;
  head.add(brim);
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.22, 0.2, 8), HAT);
  crown.position.y = 0.44;
  head.add(crown);

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
