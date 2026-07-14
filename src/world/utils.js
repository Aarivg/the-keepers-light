import * as THREE from 'three';

/** Deterministic PRNG so the island layout is stable across reloads. */
export function mulberry32(seed) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Simple seeded 2D value noise (smoothed random grid) — cheap, good enough for terrain. */
export class ValueNoise2D {
  constructor(seed = 1, gridSize = 256) {
    this.gridSize = gridSize;
    const rand = mulberry32(seed);
    this.grid = new Float32Array(gridSize * gridSize);
    for (let i = 0; i < this.grid.length; i++) this.grid[i] = rand() * 2 - 1;
  }

  _sample(xi, zi) {
    const g = this.gridSize;
    const x = ((xi % g) + g) % g;
    const z = ((zi % g) + g) % g;
    return this.grid[z * g + x];
  }

  get(x, z) {
    const xi = Math.floor(x);
    const zi = Math.floor(z);
    const tx = x - xi;
    const tz = z - zi;
    const sx = tx * tx * (3 - 2 * tx);
    const sz = tz * tz * (3 - 2 * tz);

    const v00 = this._sample(xi, zi);
    const v10 = this._sample(xi + 1, zi);
    const v01 = this._sample(xi, zi + 1);
    const v11 = this._sample(xi + 1, zi + 1);

    const a = v00 + (v10 - v00) * sx;
    const b = v01 + (v11 - v01) * sx;
    return a + (b - a) * sz;
  }

  /** Fractal Brownian motion — layered octaves for natural-looking terrain. */
  fbm(x, z, octaves = 4, lacunarity = 2, gain = 0.5) {
    let amp = 1;
    let freq = 1;
    let sum = 0;
    let ampSum = 0;
    for (let i = 0; i < octaves; i++) {
      sum += this.get(x * freq, z * freq) * amp;
      ampSum += amp;
      amp *= gain;
      freq *= lacunarity;
    }
    return sum / ampSum;
  }
}

export function smoothstep(edge0, edge1, x) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/** Flat-shaded standard material — the low-poly look throughout the island. */
export function flatMaterial(options) {
  return new THREE.MeshStandardMaterial({ flatShading: true, ...options });
}

/** World-space AABB collider from any object's current transform. */
export function colliderFromObject(object, { padY = 0 } = {}) {
  const box = new THREE.Box3().setFromObject(object);
  return {
    minX: box.min.x,
    maxX: box.max.x,
    minY: box.min.y - padY,
    maxY: box.max.y + padY,
    minZ: box.min.z,
    maxZ: box.max.z,
  };
}

/**
 * Positions a mesh on a circle of the given radius/angle around (cx, cz) at
 * height y, orienting it so local +X faces tangentially (for ring walls and
 * spiral-stair treads) and local +Z faces radially outward. Avoids having
 * to hand-derive a rotateY sign convention for every curved placement.
 */
export function placeOnRadius(mesh, cx, cz, angle, radius, y) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  mesh.position.set(cx + radius * cos, y, cz + radius * sin);
  const tangent = new THREE.Vector3(-sin, 0, cos);
  const up = new THREE.Vector3(0, 1, 0);
  const radial = new THREE.Vector3(cos, 0, sin);
  mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(tangent, up, radial));
  return mesh;
}

export function boxCollider(cx, cy, cz, sx, sy, sz) {
  return {
    minX: cx - sx / 2,
    maxX: cx + sx / 2,
    minY: cy,
    maxY: cy + sy,
    minZ: cz - sz / 2,
    maxZ: cz + sz / 2,
  };
}
