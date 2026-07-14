import * as THREE from 'three';
import { mulberry32, flatMaterial, boxCollider } from './utils.js';
import { LIGHTHOUSE, COTTAGE, BOATHOUSE, PATH_WIDTH } from './layout.js';

const ROCK_MAT = flatMaterial({ color: '#6b6a63', roughness: 0.95 });
const ROCK_MAT_DARK = flatMaterial({ color: '#565650', roughness: 0.97 });
const FENCE_MAT = flatMaterial({ color: '#5a4a38', roughness: 0.85 });
const GULL_MAT = flatMaterial({ color: '#e8e4d8', roughness: 0.7 });

const PADS = [LIGHTHOUSE, COTTAGE, BOATHOUSE];

function distanceToPath(x, z, pathSamples) {
  let best = Infinity;
  for (let i = 0; i < pathSamples.length; i++) {
    const dx = x - pathSamples[i].x;
    const dz = z - pathSamples[i].z;
    const d = dx * dx + dz * dz;
    if (d < best) best = d;
  }
  return Math.sqrt(best);
}

function isClear(x, z, pathSamples, minPadClearance = 4, minPathClearance = PATH_WIDTH / 2 + 1.5) {
  for (const pad of PADS) {
    if (Math.hypot(x - pad.x, z - pad.z) < pad.padRadius + minPadClearance) return false;
  }
  return distanceToPath(x, z, pathSamples) > minPathClearance;
}

/** Scatters low-poly rocks, a garden fence, and a few circling gulls. Returns colliders for the larger boulders. */
export function buildProps(scene, terrain) {
  const rand = mulberry32(4242);
  const colliders = [];
  const group = new THREE.Group();

  const rockCount = 42;
  for (let i = 0; i < rockCount; i++) {
    let x, z, attempts = 0;
    do {
      const angle = rand() * Math.PI * 2;
      const dist = 20 + rand() * 100;
      x = Math.cos(angle) * dist;
      z = Math.sin(angle) * dist;
      attempts++;
    } while (!isClear(x, z, terrain.pathSamples, 3, PATH_WIDTH / 2 + 1) && attempts < 12);
    if (attempts >= 12) continue;

    const y = terrain.heightAt(x, z);
    if (y < -3) continue; // skip rocks that landed underwater

    const scale = 0.35 + rand() * 1.5;
    const geo = new THREE.IcosahedronGeometry(scale, 0);
    const rock = new THREE.Mesh(geo, rand() > 0.6 ? ROCK_MAT_DARK : ROCK_MAT);
    rock.position.set(x, y + scale * 0.25, z);
    rock.rotation.set(rand() * Math.PI, rand() * Math.PI, rand() * Math.PI);
    rock.scale.y = 0.7 + rand() * 0.4;
    rock.castShadow = true;
    rock.receiveShadow = true;
    group.add(rock);

    if (scale > 1.0) {
      colliders.push(boxCollider(x, y - 0.2, z, scale * 1.5, scale * 1.6, scale * 1.5));
    }
  }

  // A short garden fence along the seaward side of the cottage.
  const fenceGroup = new THREE.Group();
  const postCount = 9;
  const fenceStartX = COTTAGE.x - 5;
  const fenceZ = COTTAGE.z + COTTAGE.padRadius * 0.75;
  for (let i = 0; i < postCount; i++) {
    const x = fenceStartX + i * 1.4;
    const y = terrain.heightAt(x, fenceZ);
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.9, 0.12), FENCE_MAT);
    post.position.set(x, y + 0.45, fenceZ);
    post.castShadow = true;
    fenceGroup.add(post);
    if (i > 0) {
      const prevX = fenceStartX + (i - 1) * 1.4;
      const prevY = terrain.heightAt(prevX, fenceZ);
      const railMidX = (x + prevX) / 2;
      const railMidY = (y + prevY) / 2 + 0.55;
      const rail = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.08, 0.06), FENCE_MAT);
      rail.position.set(railMidX, railMidY, fenceZ);
      fenceGroup.add(rail);
    }
  }
  group.add(fenceGroup);

  scene.add(group);

  // A handful of gulls, circling lazily near the shoreline for atmosphere.
  const gulls = [];
  const gullGroup = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const gull = buildGull();
    gull.userData.orbitRadius = 30 + rand() * 50;
    gull.userData.orbitSpeed = 0.06 + rand() * 0.05;
    gull.userData.orbitAngle = rand() * Math.PI * 2;
    gull.userData.orbitHeight = 14 + rand() * 10;
    gull.userData.centerX = (rand() - 0.5) * 60;
    gull.userData.centerZ = (rand() - 0.5) * 60;
    gullGroup.add(gull);
    gulls.push(gull);
  }
  scene.add(gullGroup);

  return {
    colliders,
    update(dt, elapsed) {
      for (const gull of gulls) {
        const d = gull.userData;
        d.orbitAngle += dt * d.orbitSpeed;
        gull.position.set(
          d.centerX + Math.cos(d.orbitAngle) * d.orbitRadius,
          d.orbitHeight + Math.sin(elapsed * 0.4 + d.orbitAngle) * 1.2,
          d.centerZ + Math.sin(d.orbitAngle) * d.orbitRadius
        );
        gull.rotation.y = -d.orbitAngle + Math.PI / 2;
        gull.rotation.z = Math.sin(elapsed * 3 + d.orbitAngle) * 0.25;
      }
    },
  };
}

function buildGull() {
  const gull = new THREE.Group();
  const body = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.5, 4), GULL_MAT);
  body.rotation.x = Math.PI / 2;
  gull.add(body);
  const wingGeo = new THREE.ConeGeometry(0.08, 0.9, 3);
  const wingL = new THREE.Mesh(wingGeo, GULL_MAT);
  wingL.rotation.z = Math.PI / 2;
  wingL.position.set(-0.4, 0, 0);
  const wingR = new THREE.Mesh(wingGeo, GULL_MAT);
  wingR.rotation.z = -Math.PI / 2;
  wingR.position.set(0.4, 0, 0);
  gull.add(wingL, wingR);
  return gull;
}
