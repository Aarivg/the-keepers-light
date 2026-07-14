import * as THREE from 'three';

// Generated art (Phase 4) lives under public/generated/ and is fetched at
// runtime from Vite's static root — see GENERATED_ASSETS.md at the repo
// root for the prompts and generation log. Cached per-path so re-requesting
// the same texture (e.g. wood used by three buildings) reuses one GPU upload.
const _cache = new Map();

export function loadTexture(path, { repeat = 1 } = {}) {
  if (_cache.has(path)) return _cache.get(path);

  const texture = new THREE.TextureLoader().load(path);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeat, repeat);
  _cache.set(path, texture);
  return texture;
}
