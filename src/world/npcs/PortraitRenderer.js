import * as THREE from 'three';
import { vignette } from '../../journal/PhotoArt.js';

// Dialogue-UI NPC portraits (Phase 4). Higgsfield generation for these was
// blocked by a zero-credit workspace with no free path (see
// GENERATED_ASSETS.md) — instead of a separate 2D image, this renders a
// bust-framed snapshot of the *actual* procedural 3D model built in
// Mara.js/Thomas.js, once, to an offscreen canvas, using the same
// warm-orange key / slate-blue fill light colors as World.js's sun/fill
// lights so the portrait's lighting mood matches the rest of the island.
// Guarantees the dialogue portrait and the in-world character are the same
// model — stronger consistency than a separately generated image would have
// given anyway.

const KEY_LIGHT_COLOR = '#ffab6b'; // World.js `sun`
const FILL_LIGHT_COLOR = '#4a5a7a'; // World.js `fill`
const BACKDROP_COLOR = '#2a2f3c'; // dusk-slate, distinct from the dialogue panel behind it

/**
 * @param {THREE.Object3D} characterGroup - the built Mara/Thomas group (as returned by buildMara()/buildThomas())
 * @param {{ targetY: number, distance: number, fov?: number }} framing - bust-framing params tuned per character in NPCs.js
 * @returns {string} a data: URL PNG, ready to use as an <img src>
 */
export function renderPortrait(characterGroup, { targetY, distance, fov = 42, width = 320, height = 400 }) {
  // A canvas can only ever bind one context type (webgl xor 2d) — render to
  // a throwaway WebGL canvas, then drawImage() it onto a separate 2D canvas
  // to composite the vignette and produce the final data URL.
  const glCanvas = document.createElement('canvas');
  glCanvas.width = width;
  glCanvas.height = height;

  const renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setSize(width, height, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.35; // brighter than in-world dusk lighting so the portrait reads clearly at dialogue-UI size

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(BACKDROP_COLOR);

  scene.add(new THREE.HemisphereLight('#8892b0', '#2a2018', 0.8));
  const key = new THREE.DirectionalLight(KEY_LIGHT_COLOR, 2.1);
  key.position.set(-1.5, 2.5, 3);
  scene.add(key);
  const fill = new THREE.DirectionalLight(FILL_LIGHT_COLOR, 0.6);
  fill.position.set(2, 1, -1.5);
  scene.add(fill);

  // Clone so this never touches the live in-world character (still mid-idle-
  // animation in the main scene) — reset to origin since the original's
  // position/rotation reflect its placement on the island, not its pose.
  const clone = characterGroup.clone(true);
  clone.position.set(0, 0, 0);
  clone.rotation.set(0, 0, 0);
  scene.add(clone);

  const camera = new THREE.PerspectiveCamera(fov, width / height, 0.1, 10);
  camera.position.set(0, targetY, distance);
  camera.lookAt(0, targetY, 0);

  renderer.render(scene, camera);

  const outCanvas = document.createElement('canvas');
  outCanvas.width = width;
  outCanvas.height = height;
  const ctx = outCanvas.getContext('2d');
  ctx.drawImage(glCanvas, 0, 0);
  vignette(ctx, width, height, 0.3);

  const dataUrl = outCanvas.toDataURL('image/png');

  renderer.dispose();
  scene.traverse((obj) => {
    obj.geometry?.dispose?.();
    if (obj.material) {
      for (const m of Array.isArray(obj.material) ? obj.material : [obj.material]) m.dispose?.();
    }
  });

  return dataUrl;
}
