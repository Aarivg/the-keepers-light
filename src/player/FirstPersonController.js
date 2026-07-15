import * as THREE from 'three';

const UP = new THREE.Vector3(0, 1, 0);

/**
 * First-person movement: WASD + mouse-look via pointer lock, sprint,
 * gravity-free terrain-following (raycast straight down each frame against
 * the world's "ground" group so slopes/stairs/floors all just work), and
 * AABB-vs-cylinder collision against the world's collider list.
 *
 * Deliberately NOT a physics body — this is a kinematic controller, which
 * is the right tradeoff for a walking-simulator-style mystery game: no
 * jumping, no falling, predictable and easy to reason about for level design.
 */
export class FirstPersonController {
  constructor({ camera, domElement, input, world, uiManager }) {
    this.camera = camera;
    this.domElement = domElement;
    this.input = input;
    this.world = world;
    this.uiManager = uiManager;

    this.position = new THREE.Vector3(0, 0, 0);
    this.yaw = 0;
    this.pitch = 0;

    this.eyeHeight = 1.7;
    this.crouchRadius = 0.36; // player "capsule" radius used for wall collision
    this.walkSpeed = 3.4;
    this.sprintSpeed = 6.2;
    this.acceleration = 22;
    this.deceleration = 26;

    this.velocity = new THREE.Vector3();
    this.currentSpeed = 0;

    this.sensitivity = uiManager?.settings.sensitivity ?? 1;
    this.invertY = uiManager?.settings.invertY ?? false;
    uiManager?.onSettingsChange((s) => {
      this.sensitivity = s.sensitivity;
      this.invertY = s.invertY;
    });

    // Head-bob state — driven by distance traveled, not wall-clock time, so
    // it never fights the movement feel when the player stops/starts.
    this.bobPhase = 0;
    this.bobAmplitude = 0.045;
    this.bobFrequency = 1.8; // cycles per meter traveled
    this._lastBobSin = 0;
    this._currentBobOffset = 0;

    this.onFootstep = null; // set by Game: (speedRatio) => void

    this._raycaster = new THREE.Raycaster();
    this._downVec = new THREE.Vector3(0, -1, 0);
    this._groundedY = 0;

    this._enabled = false;
  }

  setEnabled(enabled) {
    this._enabled = enabled;
  }

  spawnAt(x, z, yaw = 0) {
    this.position.set(x, 0, z);
    const groundY = this._sampleGroundHeight(x, z);
    this.position.y = groundY ?? 0;
    this._groundedY = this.position.y;
    this.yaw = yaw;
    this.pitch = 0;
    this._applyCameraTransform();
  }

  /**
   * Restores an exact saved transform (used on Continue) instead of
   * re-sampling ground height — the save already carries a known-good y, and
   * re-sampling risks a visible pop if terrain geometry ever shifts slightly
   * between builds.
   */
  restoreTransform(x, y, z, yaw, pitch) {
    this.position.set(x, y, z);
    this._groundedY = y;
    this.yaw = yaw;
    this.pitch = pitch;
    this._applyCameraTransform();
  }

  handleMouseLook(dx, dy) {
    const s = 0.0022 * this.sensitivity;
    this.yaw -= dx * s;
    this.pitch -= dy * s * (this.invertY ? -1 : 1);
    const limit = Math.PI / 2 - 0.05;
    this.pitch = Math.max(-limit, Math.min(limit, this.pitch));
  }

  update(dt) {
    if (!this._enabled) return;

    const { dx, dy } = this.input.consumeMouseDelta();
    if (dx || dy) this.handleMouseLook(dx, dy);

    const strafe = (this.input.isDown('KeyD') ? 1 : 0) - (this.input.isDown('KeyA') ? 1 : 0);
    const moveForward = (this.input.isDown('KeyW') ? 1 : 0) - (this.input.isDown('KeyS') ? 1 : 0);
    const sprinting = this.input.isDown('ShiftLeft') || this.input.isDown('ShiftRight');

    const inputDir = new THREE.Vector2(strafe, moveForward);
    const hasInput = inputDir.lengthSq() > 0;
    if (hasInput) inputDir.normalize();

    const targetSpeed = hasInput ? (sprinting ? this.sprintSpeed : this.walkSpeed) : 0;
    const rate = targetSpeed > this.currentSpeed ? this.acceleration : this.deceleration;
    this.currentSpeed = THREE.MathUtils.damp(this.currentSpeed, targetSpeed, rate, dt);
    if (Math.abs(this.currentSpeed) < 0.01) this.currentSpeed = 0;

    // Build a world-space movement vector from camera yaw (ignore pitch —
    // looking up/down should never change ground speed).
    const sinYaw = Math.sin(this.yaw);
    const cosYaw = Math.cos(this.yaw);
    const moveX = (inputDir.x * cosYaw - inputDir.y * sinYaw) * this.currentSpeed * dt;
    const moveZ = (-(inputDir.x * sinYaw) - inputDir.y * cosYaw) * this.currentSpeed * dt;

    const desired = new THREE.Vector2(this.position.x + moveX, this.position.z + moveZ);
    const resolved = this._resolveCollisions(this.position.x, this.position.z, desired.x, desired.y);

    // The shoreline itself acts as an invisible boundary: if the resolved
    // spot is bare terrain below the waterline threshold (as opposed to a
    // dock/floor mesh, which is always walkable), reject the move instead
    // of letting the player wade out to sea.
    const groundHit = this._sampleGround(resolved.x, resolved.y);
    const shoreMinY = this.world.shoreMinY ?? -Infinity;
    const blockedByShore = groundHit && groundHit.isTerrain && groundHit.y < shoreMinY;

    if (groundHit && !blockedByShore) {
      this.position.x = resolved.x;
      this.position.z = resolved.y;
      // Smooth small step-ups (stairs) instead of snapping, but track fast
      // enough that stairs still feel solid underfoot.
      this._groundedY = THREE.MathUtils.damp(this._groundedY, groundHit.y, 18, dt);
    }

    // Head bob, distance-driven.
    const distanceThisFrame = Math.hypot(moveX, moveZ);
    let bobOffset = 0;
    if (distanceThisFrame > 0 && this.currentSpeed > 0.05) {
      this.bobPhase += distanceThisFrame * this.bobFrequency * Math.PI * 2;
      const s = Math.sin(this.bobPhase);
      bobOffset = s * this.bobAmplitude * Math.min(1, this.currentSpeed / this.walkSpeed);

      // Fire a footstep each time the bob sine crosses zero going upward.
      if (this._lastBobSin < 0 && s >= 0 && this.onFootstep) {
        this.onFootstep(this.currentSpeed / this.sprintSpeed);
      }
      this._lastBobSin = s;
    } else {
      this._lastBobSin = 0;
    }
    this._currentBobOffset = THREE.MathUtils.damp(this._currentBobOffset, bobOffset, 20, dt);

    this.position.y = this._groundedY;
    this._applyCameraTransform();
  }

  _applyCameraTransform() {
    this.camera.position.set(
      this.position.x,
      this.position.y + this.eyeHeight + this._currentBobOffset,
      this.position.z
    );
    this.camera.rotation.set(0, 0, 0);
    this.camera.rotateOnWorldAxis(UP, this.yaw);
    this.camera.rotateX(this.pitch);
  }

  _sampleGroundHeight(x, z) {
    const hit = this._sampleGround(x, z);
    return hit ? hit.y : null;
  }

  _sampleGround(x, z) {
    const meshes = this.world.getGroundMeshes();
    if (!meshes.length) return null;
    this._raycaster.set(new THREE.Vector3(x, 200, z), this._downVec);
    this._raycaster.far = 400;
    const hits = this._raycaster.intersectObjects(meshes, false);
    if (hits.length === 0) return null;
    return { y: hits[0].point.y, isTerrain: !!hits[0].object.userData.isTerrain };
  }

  /** Cylinder-vs-AABB resolution: player is a vertical capsule, colliders are 3D boxes. */
  _resolveCollisions(fromX, fromZ, toX, toZ) {
    const r = this.crouchRadius;
    const feetY = this.position.y;
    const headY = feetY + this.eyeHeight + 0.15;
    const colliders = this.world.getColliders();

    let x = toX;
    let z = toZ;

    for (let iter = 0; iter < 3; iter++) {
      for (const box of colliders) {
        if (headY < box.minY || feetY > box.maxY) continue; // no vertical overlap

        const closestX = Math.max(box.minX, Math.min(x, box.maxX));
        const closestZ = Math.max(box.minZ, Math.min(z, box.maxZ));
        const dx = x - closestX;
        const dz = z - closestZ;
        const distSq = dx * dx + dz * dz;

        if (distSq < r * r) {
          const dist = Math.sqrt(distSq);
          if (dist > 1e-5) {
            const push = r - dist;
            x += (dx / dist) * push;
            z += (dz / dist) * push;
          } else {
            // Center exactly on the box edge (rare) — push out along the
            // shallowest axis.
            const overlapX = Math.min(x - box.minX, box.maxX - x);
            const overlapZ = Math.min(z - box.minZ, box.maxZ - z);
            if (overlapX < overlapZ) {
              x += x < (box.minX + box.maxX) / 2 ? -r : r;
            } else {
              z += z < (box.minZ + box.maxZ) / 2 ? -r : r;
            }
          }
        }
      }
    }

    // Safety net: keep the player within the generous world bounds so a
    // collision edge case can never strand them off in the void.
    const bound = this.world.worldBoundRadius ?? 140;
    const distFromCenter = Math.hypot(x, z);
    if (distFromCenter > bound) {
      const scale = bound / distFromCenter;
      x *= scale;
      z *= scale;
    }

    return new THREE.Vector2(x, z);
  }
}
