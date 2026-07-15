import * as THREE from 'three';
import { flatMaterial, boxCollider, mulberry32 } from '../utils.js';
import { loadTexture } from '../TextureLibrary.js';
import { CAVE } from '../layout.js';
import { CLUES } from '../../journal/clues.js';
import { registerClue } from '../../journal/registerClue.js';
import { FLAGS } from '../../journal/flags.js';

const ROCK_TEXTURE = loadTexture('/generated/textures/rock.png');
const ROCK = flatMaterial({ color: '#5c5a52', map: ROCK_TEXTURE, roughness: 0.97 });
const ROCK_DARK = flatMaterial({ color: '#403e38', map: ROCK_TEXTURE, roughness: 0.98 });
const CRATE_WOOD = flatMaterial({ color: '#4a3a28', map: loadTexture('/generated/textures/wood.png'), roughness: 0.85 });
const METAL = flatMaterial({ color: '#7a7a78', map: loadTexture('/generated/textures/metal.png'), roughness: 0.5, metalness: 0.55 });
const PAGE = flatMaterial({ color: '#d8d2be', roughness: 0.9 });

const WT = 0.6; // wall thickness

function addWall(group, colliders, cx, baseY, cz, sx, sy, sz, material) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), material);
  mesh.position.set(cx, baseY + sy / 2, cz);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  colliders.push(boxCollider(cx, baseY, cz, sx, sy, sz));
  return mesh;
}

/** Moves a collider far off the map instead of splicing it out of World's shared array — simplest way to make a reference already pushed into that array permanently inert. */
function disableCollider(c) {
  c.minX = c.maxX = 99999;
  c.minZ = c.maxZ = 99999;
}

/**
 * The Chapter 2 sea cave — a padlocked grate at the mouth (unlocked by the
 * second key retrofitted onto Cottage.js's chest), a short tunnel, and a
 * chamber holding the four new clues. Entirely its own light sources; no
 * daylight reaches here. See clues.js for the ambiguity-discipline notes on
 * the clue content itself.
 */
export function buildCave(scene, interactionSystem, uiManager, journal) {
  const {
    x, z, floorY, mouthWidth, mouthHeight,
    tunnelLength, tunnelWidth, tunnelHeight,
    chamberWidth, chamberDepth, chamberHeight,
  } = CAVE;

  const group = new THREE.Group();
  const colliders = [];
  const groundMeshes = [];

  const tunnelCenterX = x - tunnelLength / 2;
  const tunnelInnerX = x - tunnelLength; // where the tunnel opens into the chamber
  const chamberCenterX = tunnelInnerX - chamberDepth / 2;
  const chamberBackX = tunnelInnerX - chamberDepth;

  // ---- Tunnel shell ----
  addWall(group, colliders, tunnelCenterX, floorY, z - tunnelWidth / 2, tunnelLength, tunnelHeight, WT, ROCK);
  addWall(group, colliders, tunnelCenterX, floorY, z + tunnelWidth / 2, tunnelLength, tunnelHeight, WT, ROCK);

  const tunnelFloor = new THREE.Mesh(new THREE.BoxGeometry(tunnelLength + 1, 0.3, tunnelWidth), ROCK_DARK);
  tunnelFloor.position.set(tunnelCenterX, floorY - 0.15, z);
  tunnelFloor.receiveShadow = true;
  group.add(tunnelFloor);
  groundMeshes.push(tunnelFloor);

  const tunnelCeiling = new THREE.Mesh(new THREE.BoxGeometry(tunnelLength + 1, 0.3, tunnelWidth + WT * 2), ROCK_DARK);
  tunnelCeiling.position.set(tunnelCenterX, floorY + tunnelHeight + 0.15, z);
  group.add(tunnelCeiling);

  // ---- Chamber shell ----
  addWall(group, colliders, chamberBackX, floorY, z, WT, chamberHeight, chamberWidth, ROCK);
  addWall(group, colliders, chamberCenterX, floorY, z - chamberWidth / 2, chamberDepth, chamberHeight, WT, ROCK);
  addWall(group, colliders, chamberCenterX, floorY, z + chamberWidth / 2, chamberDepth, chamberHeight, WT, ROCK);
  // Front wall, split around the tunnel opening (same addWall-with-a-gap
  // pattern Cottage.js uses for its door).
  const frontGapHalf = tunnelWidth / 2;
  const frontSegWidth = chamberWidth / 2 - frontGapHalf;
  addWall(group, colliders, tunnelInnerX, floorY, z - frontGapHalf - frontSegWidth / 2, WT, chamberHeight, frontSegWidth, ROCK);
  addWall(group, colliders, tunnelInnerX, floorY, z + frontGapHalf + frontSegWidth / 2, WT, chamberHeight, frontSegWidth, ROCK);

  const chamberFloor = new THREE.Mesh(new THREE.BoxGeometry(chamberDepth + 1, 0.3, chamberWidth), ROCK_DARK);
  chamberFloor.position.set(chamberCenterX, floorY - 0.15, z);
  chamberFloor.receiveShadow = true;
  group.add(chamberFloor);
  groundMeshes.push(chamberFloor);

  const chamberCeiling = new THREE.Mesh(new THREE.BoxGeometry(chamberDepth + 1, 0.3, chamberWidth + WT * 2), ROCK_DARK);
  chamberCeiling.position.set(chamberCenterX, floorY + chamberHeight + 0.15, z);
  group.add(chamberCeiling);

  // A scatter of loose rubble along the chamber floor for texture/atmosphere
  // — same jittered-icosahedron technique Props.js uses for the island's
  // rocks, purely decorative (no colliders; small enough to not matter).
  const rand = mulberry32(9911);
  for (let i = 0; i < 10; i++) {
    const rx = chamberBackX + 1 + rand() * (chamberDepth - 2);
    const rz = z - chamberWidth / 2 + 0.8 + rand() * (chamberWidth - 1.6);
    const scale = 0.12 + rand() * 0.22;
    const rubble = new THREE.Mesh(new THREE.IcosahedronGeometry(scale, 0), rand() > 0.5 ? ROCK : ROCK_DARK);
    rubble.position.set(rx, floorY + scale * 0.3, rz);
    rubble.rotation.set(rand() * Math.PI, rand() * Math.PI, rand() * Math.PI);
    rubble.castShadow = true;
    group.add(rubble);
  }

  // ---- Lighting: entirely its own — no daylight reaches this deep. ----
  // Intensities are far higher than the other interiors' point lights
  // (~1-2 there) for the same visible brightness: ROCK/ROCK_DARK's albedo
  // (#5c5a52/#403e38) is much darker than the buildings' wall materials, and
  // this chamber is larger than any room in them, so the same numbers left
  // it essentially unlit — confirmed by direct scene-light + screenshot
  // comparison against the cottage/boathouse/lighthouse interiors.
  const mouthLight = new THREE.PointLight('#8fb0c4', 16, 10, 2); // cool — the sea outside, through the grate
  mouthLight.position.set(x - 1, floorY + 2, z);
  group.add(mouthLight);

  const tunnelLight = new THREE.PointLight('#ffb35c', 18, 9, 2);
  tunnelLight.position.set(tunnelCenterX, floorY + 2, z);
  group.add(tunnelLight);

  const chamberLightA = new THREE.PointLight('#ffb35c', 26, 12, 2);
  chamberLightA.position.set(tunnelInnerX - 2.5, floorY + 2.6, z - 2);
  group.add(chamberLightA);

  const chamberLightB = new THREE.PointLight('#ffb35c', 24, 12, 2);
  chamberLightB.position.set(chamberBackX + 3, floorY + 2.6, z + 2);
  group.add(chamberLightB);

  // ---- The grate — blocks the mouth until the chest's second key is found ----
  const grateGroup = new THREE.Group();
  const barCount = 5;
  for (let i = 0; i < barCount; i++) {
    const bz = z - mouthWidth / 2 + (i / (barCount - 1)) * mouthWidth;
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, mouthHeight, 8), METAL);
    bar.position.set(x + 0.02, floorY + mouthHeight / 2, bz);
    grateGroup.add(bar);
  }
  const grateFrame = new THREE.Mesh(new THREE.BoxGeometry(0.12, mouthHeight, mouthWidth + 0.15), METAL);
  grateFrame.position.set(x + 0.02, floorY + mouthHeight / 2, z);
  grateGroup.add(grateFrame);
  grateGroup.traverse((c) => {
    if (c.isMesh) {
      c.castShadow = true;
      c.receiveShadow = true;
    }
  });
  group.add(grateGroup);

  const grateCollider = boxCollider(x + 0.02, floorY, z, 0.3, mouthHeight, mouthWidth);
  colliders.push(grateCollider);

  interactionSystem.register(grateGroup, {
    label: () => (journal.hasFlag(FLAGS.CAVE_KEY) ? 'Unlock the grate' : "An old iron grate, padlocked shut"),
    range: 3,
    onInteract: () => {
      if (!journal.hasFlag(FLAGS.CAVE_KEY)) {
        uiManager.showFeedback("Locked. Whatever's back there, someone wanted it to stay that way.");
        return;
      }
      journal.setFlag(FLAGS.CAVE_OPENED);
      grateGroup.visible = false;
      interactionSystem.unregister(grateGroup);
      disableCollider(grateCollider);
      uiManager.showFeedback('The old padlock gives more easily than it should have. The grate swings open.');
    },
  });

  // Save/load: if the player already opened the grate in a previous
  // session, replay that same effect at build time — journal.hasFlag alone
  // being true doesn't retroactively hide a mesh that's about to be built
  // visible by default.
  if (journal.hasFlag(FLAGS.CAVE_OPENED)) {
    grateGroup.visible = false;
    interactionSystem.unregister(grateGroup);
    disableCollider(grateCollider);
  }

  // ---- Clue objects ----
  const shelfA = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.6, 0.35), ROCK_DARK);
  shelfA.position.set(chamberBackX + 0.5, floorY + 0.3, z - 2.8);
  group.add(shelfA);
  colliders.push(boxCollider(chamberBackX + 0.5, floorY, z - 2.8, 0.7, 0.6, 0.35));

  const rourkeLogbook = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.06, 0.22), CRATE_WOOD);
  rourkeLogbook.position.set(chamberBackX + 0.5, floorY + 0.65, z - 2.8);
  rourkeLogbook.rotation.y = 0.4;
  rourkeLogbook.castShadow = true;
  group.add(rourkeLogbook);
  registerClue(interactionSystem, uiManager, journal, rourkeLogbook, CLUES.OLD_ROURKE_LOGBOOK);

  const crateGroup = new THREE.Group();
  const cratePositions = [
    [0, 0.25, 0],
    [0.5, 0.25, 0.1],
    [0.25, 0.75, 0.05],
    [-0.4, 0.25, -0.15],
  ];
  for (const [dx, dy, dz] of cratePositions) {
    const size = 0.45 + rand() * 0.15;
    const crate = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), CRATE_WOOD);
    crate.position.set(chamberBackX + 1.4 + dx, floorY + dy, z + 2.6 + dz);
    crate.rotation.y = (rand() - 0.5) * 0.5;
    crate.castShadow = true;
    crate.receiveShadow = true;
    crateGroup.add(crate);
  }
  group.add(crateGroup);
  colliders.push(boxCollider(chamberBackX + 1.4, floorY, z + 2.6, 1.6, 1.1, 1.4));
  registerClue(interactionSystem, uiManager, journal, crateGroup, CLUES.SMUGGLING_CACHE);

  const ledgerPage = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.01, 0.12), PAGE);
  ledgerPage.position.set(chamberBackX + 1.9, floorY + 0.62, z + 2.9);
  ledgerPage.rotation.set(-0.1, 0.6, 0);
  group.add(ledgerPage);
  registerClue(interactionSystem, uiManager, journal, ledgerPage, CLUES.THIRD_INITIALS);

  // Wall marks, partway down the tunnel's left-hand wall.
  const markPanel = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.9), ROCK_DARK);
  markPanel.position.set(tunnelCenterX + 2, floorY + 1.6, z - tunnelWidth / 2 + 0.02);
  group.add(markPanel);
  registerClue(interactionSystem, uiManager, journal, markPanel, CLUES.CAVE_WALL_MARKS);

  scene.add(group);

  return { group, colliders, groundMeshes, update() {} };
}
