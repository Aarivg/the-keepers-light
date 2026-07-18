import * as THREE from 'three';

// Generated art (Phase 4) lives under public/generated/ and is fetched at
// runtime from Vite's static root — see GENERATED_ASSETS.md at the repo
// root for the prompts and generation log. Cached per-path so re-requesting
// the same texture (e.g. wood used by three buildings) reuses one GPU upload.
const _cache = new Map();

// One shared loader instead of `new THREE.TextureLoader()` per call — cheap,
// but there's no reason to make a fresh one for every texture request.
const _loader = new THREE.TextureLoader();

// A fixed anisotropy request rather than plumbing the renderer in just to
// call getMaxAnisotropy() — WebGL clamps this to whatever the hardware
// actually supports, so this is safe on lower-end GPUs too. Mainly fixes
// ground/floor textures viewed at grazing angles (the classic first-person
// "blurry floor" look), which is exactly the case Phase 7 calls out.
const ANISOTROPY = 8;

export function loadTexture(path, { repeat = 1 } = {}) {
  if (_cache.has(path)) return _cache.get(path);

  const texture = _loader.load(path);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeat, repeat);
  texture.anisotropy = ANISOTROPY;
  _cache.set(path, texture);
  return texture;
}
