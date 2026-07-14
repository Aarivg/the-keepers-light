import * as THREE from 'three';
import { flatMaterial, boxCollider } from '../utils.js';
import { COTTAGE } from '../layout.js';
import { registerExamine } from '../../interaction/registerExamine.js';

const WALL = flatMaterial({ color: '#c9bd9e', roughness: 0.9 });
const WOOD_DARK = flatMaterial({ color: '#3f2f22', roughness: 0.85 });
const WOOD = flatMaterial({ color: '#5c4630', roughness: 0.8 });
const ROOF = flatMaterial({ color: '#3a2a28', roughness: 0.95 });
const FABRIC = flatMaterial({ color: '#5e4550', roughness: 0.9 });

const WALL_H = 2.9;
const WALL_T = 0.3;

/** Adds an axis-aligned wall segment as both a mesh and an exact-fit collider. */
function addWall(group, colliders, cx, baseY, cz, sx, sy, sz, material = WALL) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), material);
  mesh.position.set(cx, baseY + sy / 2, cz);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  colliders.push(boxCollider(cx, baseY, cz, sx, sy, sz));
  return mesh;
}

export function buildCottage(scene, interactionSystem, uiManager) {
  const { x: ox, z: oz, floorY } = COTTAGE;
  const halfW = COTTAGE.width / 2;
  const halfD = COTTAGE.depth / 2;

  const group = new THREE.Group();
  const colliders = [];

  // --- Exterior walls (world-space; door gap in the south wall around
  // local x in [-4.2, -2.4], matching the ajar door prop below). ---
  addWall(group, colliders, ox - 5.35, floorY, oz + halfD, 2.3, WALL_H, WALL_T);
  addWall(group, colliders, ox + 2.05, floorY, oz + halfD, 8.9, WALL_H, WALL_T);
  // North wall (-Z), solid.
  addWall(group, colliders, ox, floorY, oz - halfD, COTTAGE.width, WALL_H, WALL_T);
  // West wall (-X), solid.
  addWall(group, colliders, ox - halfW, floorY, oz, WALL_T, WALL_H, COTTAGE.depth);
  // East wall (+X), solid.
  addWall(group, colliders, ox + halfW, floorY, oz, WALL_T, WALL_H, COTTAGE.depth);

  // --- Interior partition: separates the main room (west) from the study
  // and bedroom (east wing), with a doorway gap around local z in [2.2, 4.2].
  addWall(group, colliders, ox + 2, floorY, oz - 1.4, WALL_T, WALL_H, 7.2);
  addWall(group, colliders, ox + 2, floorY, oz + 4.6, WALL_T, WALL_H, 0.8);

  // --- Interior partition: separates the study (north) from the bedroom
  // (south) within the east wing, with a doorway gap around local x in [2.3, 4.3].
  addWall(group, colliders, ox + 2.15, floorY, oz, 0.3, WALL_H, WALL_T);
  addWall(group, colliders, ox + 5.4, floorY, oz, 2.2, WALL_H, WALL_T);

  // Gable roof, extruded along the depth axis.
  const overhang = 0.6;
  const ridgeH = 2.4;
  const shape = new THREE.Shape();
  shape.moveTo(-halfW - overhang, 0);
  shape.lineTo(0, ridgeH);
  shape.lineTo(halfW + overhang, 0);
  shape.lineTo(-halfW - overhang, 0);
  const roofGeo = new THREE.ExtrudeGeometry(shape, { depth: COTTAGE.depth + overhang * 2, bevelEnabled: false });
  roofGeo.translate(0, 0, -(COTTAGE.depth + overhang * 2) / 2);
  const roof = new THREE.Mesh(roofGeo, ROOF);
  roof.position.set(ox, floorY + WALL_H, oz);
  roof.castShadow = true;
  group.add(roof);

  // Chimney.
  const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.7, 2.2, 0.7), flatMaterial({ color: '#6b5a4a' }));
  chimney.position.set(ox - halfW * 0.4, floorY + WALL_H + 1.6, oz - halfD * 0.3);
  chimney.castShadow = true;
  group.add(chimney);

  // A door left ajar — visual only, no collider.
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.2, 0.08), WOOD_DARK);
  door.position.set(ox - 3.3, floorY + 1.1, oz + halfD + 0.02);
  door.rotation.y = 0.75;
  group.add(door);

  // ---------------- Furnishing: main room ----------------
  const desk = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.75, 0.7), WOOD);
  desk.position.set(ox - halfW + 1.4, floorY + 0.375, oz - halfD + 1.2);
  desk.castShadow = true;
  desk.receiveShadow = true;
  group.add(desk);
  colliders.push(boxCollider(ox - halfW + 1.4, floorY, oz - halfD + 1.2, 1.5, 0.75, 0.7));
  registerExamine(
    interactionSystem, uiManager, desk,
    'Examine the desk',
    'Papers scattered, mid-thought. Whatever he was writing, he didn\'t finish it. [Placeholder — Phase 2 clue content]'
  );

  const photoFrame = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.36, 0.03), flatMaterial({ color: '#2b241d' }));
  photoFrame.position.set(ox - halfW + 1.4, floorY + 0.85, oz - halfD + 1.55);
  photoFrame.rotation.x = -0.3;
  group.add(photoFrame);
  registerExamine(
    interactionSystem, uiManager, photoFrame,
    'Examine the photograph',
    'A family, on this same shore, years ago. One face has been scratched out. [Placeholder — Phase 2 clue content]'
  );

  const armchair = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.8, 0.9), FABRIC);
  armchair.position.set(ox - halfW + 1.5, floorY + 0.4, oz + halfD - 1.6);
  armchair.castShadow = true;
  group.add(armchair);
  colliders.push(boxCollider(ox - halfW + 1.5, floorY, oz + halfD - 1.6, 0.9, 0.8, 0.9));

  // ---------------- Furnishing: study (north-east) ----------------
  const studyDesk = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.75, 0.6), WOOD);
  studyDesk.position.set(ox + halfW - 1.0, floorY + 0.375, oz - halfD + 1.0);
  studyDesk.castShadow = true;
  group.add(studyDesk);
  colliders.push(boxCollider(ox + halfW - 1.0, floorY, oz - halfD + 1.0, 1.3, 0.75, 0.6));

  const bookshelf = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.1, 0.35), WOOD_DARK);
  bookshelf.position.set(ox + halfW - 0.2, floorY + 1.05, oz - halfD + 0.2);
  bookshelf.castShadow = true;
  group.add(bookshelf);
  colliders.push(boxCollider(ox + halfW - 0.2, floorY, oz - halfD + 0.2, 1.6, 2.1, 0.35));

  const chest = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.55, 0.55), WOOD_DARK);
  chest.position.set(ox + halfW - 1.3, floorY + 0.275, oz - 0.6);
  chest.castShadow = true;
  group.add(chest);
  colliders.push(boxCollider(ox + halfW - 1.3, floorY, oz - 0.6, 0.9, 0.55, 0.55));
  registerExamine(
    interactionSystem, uiManager, chest,
    'Examine the chest',
    'Locked. There\'s no key in sight. [Placeholder — Phase 2 clue content]'
  );

  // ---------------- Furnishing: bedroom (south-east) ----------------
  const bedFrame = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.5, 1.4), WOOD_DARK);
  bedFrame.position.set(ox + halfW - 1.3, floorY + 0.25, oz + halfD - 1.2);
  bedFrame.castShadow = true;
  group.add(bedFrame);
  const mattress = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.28, 1.25), flatMaterial({ color: '#d8d2c2' }));
  mattress.position.set(ox + halfW - 1.3, floorY + 0.64, oz + halfD - 1.2);
  group.add(mattress);
  colliders.push(boxCollider(ox + halfW - 1.3, floorY, oz + halfD - 1.2, 2.0, 0.5, 1.4));

  const nightstand = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), WOOD);
  nightstand.position.set(ox + halfW - 0.3, floorY + 0.25, oz + halfD - 1.9);
  nightstand.castShadow = true;
  group.add(nightstand);
  colliders.push(boxCollider(ox + halfW - 0.3, floorY, oz + halfD - 1.9, 0.5, 0.5, 0.5));

  const journal = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.05, 0.2), flatMaterial({ color: '#7a2f2f' }));
  journal.position.set(ox + halfW - 0.3, floorY + 0.53, oz + halfD - 1.9);
  journal.rotation.y = 0.4;
  group.add(journal);
  registerExamine(
    interactionSystem, uiManager, journal,
    'Examine the keeper\'s journal',
    'The handwriting grows harder to read toward the end. [Placeholder — Phase 2 clue content]'
  );

  scene.add(group);

  return { group, colliders, groundMeshes: [], update() {} };
}
