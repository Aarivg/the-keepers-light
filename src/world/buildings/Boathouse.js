import * as THREE from 'three';
import { flatMaterial, boxCollider } from '../utils.js';
import { loadTexture } from '../TextureLibrary.js';
import { BOATHOUSE } from '../layout.js';
import { registerExamine } from '../../interaction/registerExamine.js';
import { CLUES } from '../../journal/clues.js';
import { registerClue } from '../../journal/registerClue.js';

const WOOD_TEXTURE = loadTexture('/generated/textures/wood.png');
const WALL = flatMaterial({ color: '#8a7a5c', roughness: 0.9 });
const WOOD_DARK = flatMaterial({ color: '#3f2f22', map: WOOD_TEXTURE, roughness: 0.85 });
const WOOD = flatMaterial({ color: '#5c4630', map: WOOD_TEXTURE, roughness: 0.8 });
const ROOF = flatMaterial({ color: '#2f2a26', roughness: 0.95 });
const HULL = flatMaterial({ color: '#4a5a52', roughness: 0.7 });
const METAL = flatMaterial({ color: '#7a7a78', map: loadTexture('/generated/textures/metal.png'), roughness: 0.5, metalness: 0.5 });

const WALL_H = 2.6;
const WALL_T = 0.28;

function addWall(group, colliders, cx, baseY, cz, sx, sy, sz, material = WALL) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), material);
  mesh.position.set(cx, baseY + sy / 2, cz);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  colliders.push(boxCollider(cx, baseY, cz, sx, sy, sz));
  return mesh;
}

export function buildBoathouse(scene, interactionSystem, uiManager, journal) {
  const { x: ox, z: oz, floorY } = BOATHOUSE;
  const halfW = BOATHOUSE.width / 2;
  const halfD = BOATHOUSE.depth / 2;

  const group = new THREE.Group();
  const colliders = [];

  // South wall (+Z) has a wide gap — the boathouse door faces the dock and
  // is simply left open.
  addWall(group, colliders, ox - 2.9, floorY, oz + halfD, halfW - 2.9 + 1, WALL_H, WALL_T);
  addWall(group, colliders, ox + 2.9, floorY, oz + halfD, halfW - 2.9 + 1, WALL_H, WALL_T);
  addWall(group, colliders, ox, floorY, oz - halfD, BOATHOUSE.width, WALL_H, WALL_T);
  addWall(group, colliders, ox - halfW, floorY, oz, WALL_T, WALL_H, BOATHOUSE.depth);
  addWall(group, colliders, ox + halfW, floorY, oz, WALL_T, WALL_H, BOATHOUSE.depth);

  // Simple lean-to roof (single slanted slab — smaller structure, simpler roof).
  const roof = new THREE.Mesh(new THREE.BoxGeometry(BOATHOUSE.width + 0.8, 0.2, BOATHOUSE.depth + 0.8), ROOF);
  roof.position.set(ox, floorY + WALL_H + 0.1, oz);
  roof.rotation.z = 0.06;
  roof.castShadow = true;
  group.add(roof);

  // ---------------- Interior ----------------
  const boatHullGeo = new THREE.BoxGeometry(1.5, 0.7, 3.6);
  const boat = new THREE.Mesh(boatHullGeo, HULL);
  boat.position.set(ox - 1.2, floorY + 0.35, oz - 0.4);
  boat.castShadow = true;
  boat.receiveShadow = true;
  group.add(boat);
  colliders.push(boxCollider(ox - 1.2, floorY, oz - 0.4, 1.5, 0.7, 3.6));
  registerClue(interactionSystem, uiManager, journal, boat, CLUES.BOAT);

  // Drag marks on the floor, angled off toward the water instead of the
  // usual launch rails — a purely visual detail backing up the clue text.
  const dragMarks = new THREE.Mesh(
    new THREE.PlaneGeometry(0.9, 3.2),
    flatMaterial({ color: '#241f1a', transparent: true, opacity: 0.35 })
  );
  dragMarks.rotation.x = -Math.PI / 2;
  dragMarks.rotation.z = 0.5;
  dragMarks.position.set(ox - 0.3, floorY + 0.01, oz + 1.4);
  group.add(dragMarks);

  const toolChest = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.5, 0.5), WOOD_DARK);
  toolChest.position.set(ox + 2.4, floorY + 0.25, oz - 1.8);
  toolChest.castShadow = true;
  group.add(toolChest);
  colliders.push(boxCollider(ox + 2.4, floorY, oz - 1.8, 0.9, 0.5, 0.5));
  registerExamine(
    interactionSystem, uiManager, toolChest,
    'Examine the tool chest',
    'Rope, tar, a rusted hook. Ordinary boathouse tools.'
  );

  const workbench = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.75, 0.6), WOOD);
  workbench.position.set(ox + 2.0, floorY + 0.375, oz + 0.6);
  workbench.castShadow = true;
  group.add(workbench);
  colliders.push(boxCollider(ox + 2.0, floorY, oz + 0.6, 2.2, 0.75, 0.6));

  const lanternPost = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.4, 6), METAL);
  lanternPost.position.set(ox + 2.0, floorY + 1.45, oz + 1.1);
  group.add(lanternPost);
  const lantern = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.3, 0.22), METAL);
  lantern.position.set(ox + 2.0, floorY + 2.05, oz + 1.1);
  group.add(lantern);
  const lanternLight = new THREE.PointLight('#ffb35c', 1.9, 9, 2);
  lanternLight.position.copy(lantern.position);
  group.add(lanternLight);

  // A second fill light over the boat itself — the lantern alone left the
  // far (boat/drag-marks) side of the room too dim to read comfortably.
  const boatLight = new THREE.PointLight('#ffb35c', 1.1, 7, 2);
  boatLight.position.set(ox - 1.0, floorY + 2.0, oz - 0.6);
  group.add(boatLight);
  registerExamine(
    interactionSystem, uiManager, lantern,
    'Examine the oil lantern',
    'Cold. Hasn\'t been lit in days.'
  );

  scene.add(group);

  return { group, colliders, groundMeshes: [], update() {} };
}
