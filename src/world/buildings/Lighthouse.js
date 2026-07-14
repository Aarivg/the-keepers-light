import * as THREE from 'three';
import { flatMaterial, placeOnRadius, boxCollider, colliderFromObject } from '../utils.js';
import { LIGHTHOUSE } from '../layout.js';
import { registerExamine } from '../../interaction/registerExamine.js';

const STONE = flatMaterial({ color: '#7a746a', roughness: 0.92 });
const STONE_DARK = flatMaterial({ color: '#5c574f', roughness: 0.95 });
const WOOD = flatMaterial({ color: '#4a3a28', roughness: 0.85 });
const GLASS = flatMaterial({
  color: '#bcd8de',
  roughness: 0.15,
  metalness: 0.1,
  transparent: true,
  opacity: 0.35,
});
const METAL = flatMaterial({ color: '#8a8f92', roughness: 0.4, metalness: 0.7 });
const LAMP_GLOW = new THREE.Color('#ffdca0');

const SEGMENTS = 16;

function buildRing({ cx, cz, baseY, height, radius, thickness, doorAngle, material, colliders }) {
  const group = new THREE.Group();
  const chord = 2 * radius * Math.sin(Math.PI / SEGMENTS) + 0.06;
  const doorIndex = doorAngle !== null ? Math.round((doorAngle / (Math.PI * 2)) * SEGMENTS) : -1;

  for (let i = 0; i < SEGMENTS; i++) {
    if (i === doorIndex) continue;
    const angle = (i / SEGMENTS) * Math.PI * 2;
    const seg = new THREE.Mesh(new THREE.BoxGeometry(chord, height, thickness), material);
    placeOnRadius(seg, cx, cz, angle, radius - thickness / 2, baseY + height / 2);
    seg.castShadow = true;
    seg.receiveShadow = true;
    group.add(seg);
    seg.updateMatrixWorld();
    colliders.push(colliderFromObject(seg));
  }
  return group;
}

export function buildLighthouse(scene, interactionSystem, uiManager) {
  const { x: cx, z: cz, floorY, towerRadius, wallThickness, doorAngle } = LIGHTHOUSE;
  const innerRadius = towerRadius - wallThickness;

  const groundBandH = 2.6;
  const midBandH = 8.0;
  const lampBandH = 2.4;
  const lampFloorY = floorY + groundBandH + midBandH;
  const topY = lampFloorY + lampBandH;

  const group = new THREE.Group();
  const colliders = [];
  const groundMeshes = [];

  group.add(
    buildRing({
      cx, cz, baseY: floorY, height: groundBandH, radius: towerRadius,
      thickness: wallThickness, doorAngle, material: STONE, colliders,
    })
  );
  group.add(
    buildRing({
      cx, cz, baseY: floorY + groundBandH, height: midBandH, radius: towerRadius,
      thickness: wallThickness, doorAngle: null, material: STONE_DARK, colliders,
    })
  );
  group.add(
    buildRing({
      cx, cz, baseY: lampFloorY, height: lampBandH, radius: towerRadius,
      thickness: wallThickness * 0.6, doorAngle: null, material: GLASS, colliders,
    })
  );

  // Conical roof cap.
  const roof = new THREE.Mesh(new THREE.ConeGeometry(towerRadius + 0.4, 2.1, SEGMENTS), STONE_DARK);
  roof.position.set(cx, topY + 1.05, cz);
  roof.castShadow = true;
  group.add(roof);

  // Central newel pillar (also doubles as the collider that keeps players
  // out of the open stairwell shaft).
  const newel = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.9, topY - floorY, 10), STONE_DARK);
  newel.position.set(cx, (floorY + topY) / 2, cz);
  group.add(newel);
  colliders.push(boxCollider(cx, floorY - 0.5, cz, 2, topY - floorY + 1, 2));

  // Spiral staircase.
  const stairRadius = innerRadius - 1.05;
  const climbHeight = lampFloorY - floorY;
  const numSteps = 56;
  const numTurns = 2.75;
  const angleStep = (numTurns * Math.PI * 2) / numSteps;
  const rise = climbHeight / numSteps;
  const treadWidth = 1.35;
  const treadDepth = 1.05;
  const treadThickness = 0.22;

  for (let i = 0; i < numSteps; i++) {
    const angle = doorAngle + Math.PI + i * angleStep; // start opposite the door
    const yTop = floorY + i * rise + rise;
    const tread = new THREE.Mesh(
      new THREE.BoxGeometry(treadWidth, treadThickness, treadDepth),
      i % 2 === 0 ? WOOD : STONE
    );
    placeOnRadius(tread, cx, cz, angle, stairRadius, yTop - treadThickness / 2);
    tread.castShadow = true;
    tread.receiveShadow = true;
    group.add(tread);
    groundMeshes.push(tread);
  }

  // Landing at the top of the stairwell, flush with the lamp room floor.
  const landing = new THREE.Mesh(
    new THREE.CylinderGeometry(innerRadius - 0.15, innerRadius - 0.15, 0.2, 24),
    WOOD
  );
  landing.position.set(cx, lampFloorY - 0.1, cz);
  landing.receiveShadow = true;
  group.add(landing);
  groundMeshes.push(landing);

  // Ground-floor furnishings near the entrance.
  const deskTop = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.08, 0.8), WOOD);
  deskTop.position.set(cx + 1.6, floorY + 0.75, cz + 1.2);
  const deskLeg = (dx, dz) => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.75, 0.1), WOOD);
    leg.position.set(cx + 1.6 + dx, floorY + 0.375, cz + 1.2 + dz);
    return leg;
  };
  const desk = new THREE.Group();
  desk.add(deskTop, deskLeg(0.7, 0.3), deskLeg(-0.7, 0.3), deskLeg(0.7, -0.3), deskLeg(-0.7, -0.3));
  desk.traverse((c) => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
  group.add(desk);
  colliders.push(colliderFromObjectSafe(deskTop));

  const logbook = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.05, 0.24), flatMaterial({ color: '#3a2f22' }));
  logbook.position.set(cx + 1.9, floorY + 0.82, cz + 1.1);
  logbook.rotation.y = 0.3;
  logbook.castShadow = true;
  group.add(logbook);
  registerExamine(
    interactionSystem, uiManager, logbook,
    'Examine keeper\'s logbook',
    'The logbook\'s last entry trails off mid-sentence. [Placeholder — Phase 2 clue content]'
  );

  const chart = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.02, 0.4), flatMaterial({ color: '#cfc2a0' }));
  chart.position.set(cx + 1.3, floorY + 0.81, cz + 1.35);
  chart.rotation.y = -0.2;
  group.add(chart);
  registerExamine(
    interactionSystem, uiManager, chart,
    'Examine tide chart',
    'A hand-marked chart of the shoals north of the island. [Placeholder — Phase 2 clue content]'
  );

  // The lamp mechanism at the top — broken, per the brief.
  const lampHousing = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.0, 1.4, 12), METAL);
  lampHousing.position.set(cx, lampFloorY + 0.9, cz);
  lampHousing.castShadow = true;
  group.add(lampHousing);
  const lampLensGeo = new THREE.SphereGeometry(0.55, 10, 8);
  const lampLens = new THREE.Mesh(lampLensGeo, GLASS);
  lampLens.position.set(cx, lampFloorY + 1.75, cz);
  lampLens.scale.y = 0.6;
  group.add(lampLens);
  colliders.push(colliderFromObjectSafe(lampHousing));
  registerExamine(
    interactionSystem, uiManager, lampHousing,
    'Examine the lamp mechanism',
    'The rotation gears are jammed. Someone forced it to stop. [Placeholder — Phase 2 clue content]'
  );

  // The beacon still turns even though the keeper is gone — a slow-rotating
  // spotlight plus a faint additive cone standing in for the light beam.
  const beaconGlow = new THREE.PointLight(LAMP_GLOW, 2.2, 14, 2);
  beaconGlow.position.set(cx, lampFloorY + 1.6, cz);
  group.add(beaconGlow);

  const beaconGroup = new THREE.Group();
  beaconGroup.position.set(cx, lampFloorY + 1.6, cz);
  const beam = new THREE.SpotLight(LAMP_GLOW, 8, 90, Math.PI / 14, 0.5, 1.2);
  beam.position.set(0, 0, 0);
  beam.target.position.set(20, -1, 0);
  beaconGroup.add(beam, beam.target);
  const beamCone = new THREE.Mesh(
    new THREE.ConeGeometry(3.2, 24, 12, 1, true),
    flatMaterial({ color: LAMP_GLOW, transparent: true, opacity: 0.05, depthWrite: false })
  );
  beamCone.rotation.z = Math.PI / 2;
  beamCone.position.set(11, 0, 0);
  beaconGroup.add(beamCone);
  group.add(beaconGroup);

  // A slightly-ajar door prop at the entrance — purely visual, no collider,
  // hinting something was left in a hurry.
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.1, 2.1, 0.08), WOOD);
  const doorHingeAngle = doorAngle;
  placeOnRadius(door, cx, cz, doorHingeAngle, towerRadius + 0.02, floorY + 1.05);
  door.rotateY(0.9);
  group.add(door);

  scene.add(group);

  return {
    group,
    colliders,
    groundMeshes,
    update(dt) {
      beaconGroup.rotation.y += dt * 0.35;
    },
  };
}

function colliderFromObjectSafe(mesh) {
  mesh.updateMatrixWorld();
  return colliderFromObject(mesh);
}
