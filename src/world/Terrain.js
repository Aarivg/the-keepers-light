import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ValueNoise2D, smoothstep, lerp, flatMaterial } from './utils.js';
import { loadTexture } from './TextureLibrary.js';
import {
  ISLAND_RADIUS,
  WATER_LEVEL,
  LIGHTHOUSE,
  COTTAGE,
  BOATHOUSE,
  CAVE,
  DOCK,
  PATH_WAYPOINTS,
  PATH_WIDTH,
} from './layout.js';

const PADS = [LIGHTHOUSE, COTTAGE, BOATHOUSE, CAVE];

const GRASS_A = new THREE.Color('#4a5d3a');
const GRASS_B = new THREE.Color('#5c6f43');
const DIRT = new THREE.Color('#5a4632');
const ROCK = new THREE.Color('#6b6a63');
const ROCK_DARK = new THREE.Color('#4b4a45');
const SHORE_ROCK = new THREE.Color('#7d7869');
const GRAVEL = new THREE.Color('#8a8578');

function buildPathCurve() {
  const pts = PATH_WAYPOINTS.map(([x, z]) => new THREE.Vector3(x, 0, z));
  const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.4);
  const samples = curve.getPoints(260);
  return samples;
}

function distanceToSamples(x, z, samples) {
  let best = Infinity;
  for (let i = 0; i < samples.length; i++) {
    const dx = x - samples[i].x;
    const dz = z - samples[i].z;
    const d = dx * dx + dz * dz;
    if (d < best) best = d;
  }
  return Math.sqrt(best);
}

export function buildTerrain(scene) {
  const noise = new ValueNoise2D(1337);
  const pathSamples = buildPathCurve();

  const size = 300;
  const segments = 130;
  const half = size / 2;
  const step = size / segments;

  const dockHalfWidth = DOCK.width / 2 + 3;
  const dockCorridorStart = DOCK.landZ + 2;
  const dockCorridorFadeIn = DOCK.landZ + 10;
  const dockCorridorEnd = DOCK.seaZ + 6;

  function rawHeight(x, z) {
    const dist = Math.hypot(x, z);
    const shape = noise.fbm(x * 0.01 + 50, z * 0.01 + 50, 3);
    const jag = noise.fbm(x * 0.05, z * 0.05, 2);
    const effectiveRadius = ISLAND_RADIUS + shape * 14 + jag * 5;

    const innerEdge = effectiveRadius - 24;
    const outerEdge = effectiveRadius;
    const seafloorEdge = effectiveRadius + 10;

    // Base height is kept comfortably above `shoreMinY` even at the noise's
    // worst-case extremes — a noise dip below the waterline mid-island would
    // both look like a phantom pond (the water plane bleeding through) and,
    // since the shoreline rule blocks any bare terrain below that threshold,
    // could create a confusing invisible wall far from the actual coast.
    const elevation =
      7.5 + noise.fbm(x * 0.018, z * 0.018, 4) * 5 + noise.fbm(x * 0.06, z * 0.06, 3) * 1.5;

    let y;
    if (dist <= innerEdge) {
      y = elevation;
    } else if (dist <= outerEdge) {
      const t = smoothstep(innerEdge, outerEdge, dist);
      const rockJag = noise.fbm(x * 0.15, z * 0.15, 3) * 2.2;
      y = lerp(elevation, 1.2 + rockJag, t);
    } else if (dist <= seafloorEdge) {
      const t2 = smoothstep(outerEdge, seafloorEdge, dist);
      y = lerp(1.4, -6, t2);
    } else {
      y = -6;
    }
    return y;
  }

  function heightAt(x, z) {
    let y = rawHeight(x, z);

    // Flatten building pads.
    for (const pad of PADS) {
      const d = Math.hypot(x - pad.x, z - pad.z);
      const r = pad.padRadius;
      if (d < r + 4) {
        const maskT = 1 - smoothstep(r - 3, r + 4, d);
        y = lerp(y, pad.floorY, maskT);
      }
    }

    // Gently grade the path so it doesn't inherit sharp hill noise.
    const pd = distanceToSamples(x, z, pathSamples);
    if (pd < PATH_WIDTH / 2 + 3) {
      const pathMaskT = 1 - smoothstep(PATH_WIDTH / 2, PATH_WIDTH / 2 + 3, pd);
      const gentle = 7 + noise.fbm(x * 0.018, z * 0.018, 2) * 2.5;
      y = lerp(y, gentle, pathMaskT);
    }

    // Carve a submerged corridor under the dock so it genuinely reaches over water.
    const lateral = Math.abs(x - DOCK.x);
    if (lateral < dockHalfWidth && z > dockCorridorStart && z < dockCorridorEnd) {
      const lateralT = 1 - smoothstep(DOCK.width / 2, dockHalfWidth, lateral);
      const longitudinalT = smoothstep(dockCorridorStart, dockCorridorFadeIn, z);
      const t = lateralT * longitudinalT;
      y = lerp(y, WATER_LEVEL - 1.6, t);
    }

    return y;
  }

  function colorAt(x, z, y) {
    const pd = distanceToSamples(x, z, pathSamples);
    let color;

    let onPad = false;
    for (const pad of PADS) {
      const d = Math.hypot(x - pad.x, z - pad.z);
      if (d < pad.padRadius + 2) onPad = true;
    }

    if (onPad || pd < PATH_WIDTH / 2 + 1.2) {
      const t = smoothstep(PATH_WIDTH / 2 + 1.2, PATH_WIDTH / 2 + 3, pd) * (onPad ? 0 : 1);
      color = GRAVEL.clone().lerp(DIRT, 0.5 + noise.fbm(x * 0.2, z * 0.2, 2) * 0.3);
      if (onPad) color = GRAVEL.clone();
      if (t > 0 && !onPad) color = color.lerp(GRASS_A, t);
    } else if (y < 0.9) {
      color = SHORE_ROCK.clone().lerp(ROCK_DARK, Math.abs(noise.fbm(x * 0.08, z * 0.08, 2)));
    } else if (y > 9.5) {
      color = ROCK.clone().lerp(ROCK_DARK, Math.max(0, noise.fbm(x * 0.1, z * 0.1, 2)));
    } else {
      const g = Math.abs(noise.fbm(x * 0.03, z * 0.03, 3));
      color = GRASS_A.clone().lerp(GRASS_B, g);
    }

    const jitter = 0.94 + noise.get(x * 0.4, z * 0.4) * 0.1;
    color.multiplyScalar(jitter);
    return color;
  }

  const positions = [];
  const colors = [];
  const uvs = [];
  const indices = [];

  // World-planar UVs (one tile every 16 units) so the generated ground
  // texture can be applied as a `map` alongside the existing vertex colors.
  const TEXTURE_TILE_SIZE = 16;

  for (let iz = 0; iz <= segments; iz++) {
    for (let ix = 0; ix <= segments; ix++) {
      const x = -half + ix * step;
      const z = -half + iz * step;
      const y = heightAt(x, z);
      positions.push(x, y, z);
      const c = colorAt(x, z, y);
      colors.push(c.r, c.g, c.b);
      uvs.push(x / TEXTURE_TILE_SIZE, z / TEXTURE_TILE_SIZE);
    }
  }

  for (let iz = 0; iz < segments; iz++) {
    for (let ix = 0; ix < segments; ix++) {
      const a = iz * (segments + 1) + ix;
      const b = a + 1;
      const c = a + (segments + 1);
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  const material = flatMaterial({
    vertexColors: true,
    map: loadTexture('/generated/textures/ground.png'),
    roughness: 0.95,
    metalness: 0.02,
  });
  const terrainMesh = new THREE.Mesh(geometry, material);
  terrainMesh.receiveShadow = true;
  terrainMesh.userData.isTerrain = true;
  scene.add(terrainMesh);

  // Water plane — cheap, static, blends into fog at the horizon.
  const waterGeo = new THREE.PlaneGeometry(900, 900, 1, 1);
  waterGeo.rotateX(-Math.PI / 2);
  const waterMat = flatMaterial({
    color: new THREE.Color('#1c3f4a'),
    roughness: 0.35,
    metalness: 0.1,
    transparent: true,
    opacity: 0.92,
  });
  const waterMesh = new THREE.Mesh(waterGeo, waterMat);
  waterMesh.position.y = WATER_LEVEL;
  scene.add(waterMesh);

  // Dock — a simple raised plank platform sloping down toward the water,
  // with a handful of piling posts for silhouette. Perf (Phase 7): planks
  // and pilings used to be ~28 separate draw calls; each instance's
  // transform is now baked into its own geometry clone before merging, so
  // the whole dock renders (and, for the planks, ground-raycasts) as 2.
  const dockGroup = new THREE.Group();
  const dockMat = flatMaterial({
    color: '#4a3a28',
    map: loadTexture('/generated/textures/wood.png'),
    roughness: 0.9,
  });
  const dockLength = DOCK.seaZ - DOCK.landZ;
  const plankCount = 16;
  const plankLength = dockLength / plankCount;
  const plankGeometries = [];
  for (let i = 0; i < plankCount; i++) {
    const z = DOCK.landZ + i * plankLength + plankLength / 2;
    const t = i / (plankCount - 1);
    const surfaceY = lerp(DOCK.surfaceYLand, DOCK.surfaceYSea, t);
    // Slight overlap (not a gap) between planks — the ground-follow raycast
    // must never find a hole here, or it reads as bare (underwater) terrain
    // just beneath the dock and freezes the player at the shoreline boundary.
    const geo = new THREE.BoxGeometry(DOCK.width, 0.18, plankLength * 1.05);
    geo.translate(DOCK.x, surfaceY, z);
    plankGeometries.push(geo);
  }
  const dockSurface = new THREE.Mesh(mergeGeometries(plankGeometries, false), dockMat);
  dockSurface.castShadow = true;
  dockSurface.receiveShadow = true;
  dockGroup.add(dockSurface);

  const pilingMat = flatMaterial({ color: '#3a2f22', roughness: 1 });
  const pilingCount = Math.floor(dockLength / 6);
  const pilingGeometries = [];
  for (let i = 0; i < pilingCount; i++) {
    const z = DOCK.landZ + 2 + i * 6.2;
    for (const side of [-1, 1]) {
      const geo = new THREE.CylinderGeometry(0.16, 0.2, 5, 6);
      geo.translate(DOCK.x + side * (DOCK.width / 2 - 0.1), -1.5, z);
      pilingGeometries.push(geo);
    }
  }
  const pilings = new THREE.Mesh(mergeGeometries(pilingGeometries, false), pilingMat);
  pilings.castShadow = true;
  dockGroup.add(pilings);

  scene.add(dockGroup);

  return {
    terrainMesh,
    waterMesh,
    dockGroup,
    groundMeshes: [terrainMesh, dockSurface],
    shoreMinY: 0.55,
    heightAt,
    colorAt,
    pathSamples,
  };
}
