import * as THREE from 'three';

// Phase 8: the world-space half of the guidance system — a soft glowing
// marker that appears ON the actual clue/NPC/door once the player is close
// enough that "somewhere in that direction" (the HUD arrow) should become
// "right there" (see Game.js's throttled _updateObjectiveIndicator(), which
// drives this via setTarget()). Bright enough to catch the bloom pass
// (Phase 7) for a genuine glow rather than a flat-colored blob.
//
// One shared instance, built once and reused — setTarget(null) just hides
// it rather than tearing anything down.

const GLOW_COLOR = new THREE.Color('#ffdca0');
const PROXIMITY_RADIUS = 14; // "same room" — inside a building this covers the whole interior; outside it's a generous "getting close" range

export function buildObjectiveBeacon(scene) {
  const group = new THREE.Group();
  group.visible = false;

  const core = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.22, 1),
    new THREE.MeshBasicMaterial({ color: GLOW_COLOR, toneMapped: false })
  );
  group.add(core);

  // A faint, larger translucent shell reads as "glow" even before bloom
  // blurs the core outward — belt-and-suspenders for scenes where bloom's
  // threshold doesn't quite catch it (e.g. a very bright exterior sky
  // behind the marker raises the local average and can suppress bloom's
  // relative pass).
  const halo = new THREE.Mesh(
    new THREE.SphereGeometry(0.5, 12, 8),
    new THREE.MeshBasicMaterial({ color: GLOW_COLOR, transparent: true, opacity: 0.25, toneMapped: false, depthWrite: false })
  );
  group.add(halo);

  const light = new THREE.PointLight(GLOW_COLOR, 6, 6, 2);
  group.add(light);

  scene.add(group);

  let target = null; // {x, y, z} | null
  let playerPos = null; // set each frame by update() via Game.js's throttled call

  return {
    /** @param {{x:number, y?:number, z:number}|null} pos - y defaults to a
     * comfortable hover height above ground/head level when omitted (NPC
     * spots only carry x/z — see layout.js). */
    setTarget(pos) {
      target = pos ? { x: pos.x, y: pos.y ?? 2.2, z: pos.z } : null;
    },
    setPlayerPosition(x, z) {
      playerPos = { x, z };
    },
    update(dt, elapsed) {
      if (!target || !playerPos) {
        group.visible = false;
        return;
      }
      const d = Math.hypot(playerPos.x - target.x, playerPos.z - target.z);
      group.visible = d < PROXIMITY_RADIUS;
      if (!group.visible) return;

      group.position.set(target.x, target.y + Math.sin(elapsed * 1.6) * 0.08, target.z);
      const pulse = 1 + Math.sin(elapsed * 2.4) * 0.15;
      core.scale.setScalar(pulse);
      halo.scale.setScalar(pulse * 1.15);
      // Fade in as the player crosses into range instead of popping.
      const fadeT = THREE.MathUtils.smoothstep(PROXIMITY_RADIUS - d, 0, 3);
      halo.material.opacity = 0.25 * fadeT;
      light.intensity = 6 * fadeT;
    },
    isVisible: () => group.visible,
    getPosition: () => group.position.toArray(),
  };
}
