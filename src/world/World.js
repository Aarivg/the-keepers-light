import * as THREE from 'three';
import { buildTerrain } from './Terrain.js';
import { buildProps } from './Props.js';
import { buildLighthouse } from './buildings/Lighthouse.js';
import { buildCottage } from './buildings/Cottage.js';
import { buildBoathouse } from './buildings/Boathouse.js';
import { WORLD_BOUND_RADIUS } from './layout.js';

const SKY_ZENITH = new THREE.Color('#232a3d');
const SKY_HORIZON = new THREE.Color('#d98a52');
const FOG_COLOR = new THREE.Color('#5b5266');

function buildSkyDome() {
  const geo = new THREE.SphereGeometry(400, 24, 16);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      topColor: { value: SKY_ZENITH },
      bottomColor: { value: SKY_HORIZON },
      offset: { value: 18 },
      exponent: { value: 0.9 },
    },
    vertexShader: `
      varying vec3 vWorldPosition;
      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 topColor;
      uniform vec3 bottomColor;
      uniform float offset;
      uniform float exponent;
      varying vec3 vWorldPosition;
      void main() {
        float h = normalize(vWorldPosition + vec3(0.0, offset, 0.0)).y;
        gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0);
      }
    `,
    side: THREE.BackSide,
    depthWrite: false,
  });
  return new THREE.Mesh(geo, mat);
}

export class World {
  constructor(scene) {
    this.scene = scene;
    this.worldBoundRadius = WORLD_BOUND_RADIUS;

    scene.background = SKY_HORIZON.clone().lerp(SKY_ZENITH, 0.5);
    scene.fog = new THREE.FogExp2(FOG_COLOR, 0.011);
    scene.add(buildSkyDome());

    this._setupLighting();

    this._terrain = buildTerrain(scene);
    this.shoreMinY = this._terrain.shoreMinY;

    this._colliders = [];
    this._groundMeshes = [...this._terrain.groundMeshes];
    this._updatables = [];

    this._interactableBuildingsPending = []; // filled by attachInteraction()
  }

  _setupLighting() {
    const hemi = new THREE.HemisphereLight('#8892b0', '#2a2018', 0.65);
    this.scene.add(hemi);

    const sun = new THREE.DirectionalLight('#ffab6b', 1.6);
    sun.position.set(-60, 45, 30);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 260;
    sun.shadow.camera.left = -140;
    sun.shadow.camera.right = 140;
    sun.shadow.camera.top = 140;
    sun.shadow.camera.bottom = -140;
    sun.shadow.bias = -0.0015;
    this.scene.add(sun);
    this.sun = sun;

    const fill = new THREE.DirectionalLight('#4a5a7a', 0.35);
    fill.position.set(50, 30, -40);
    this.scene.add(fill);
  }

  /** Builds the three structures and registers their placeholder interactables. */
  attachInteraction(interactionSystem, uiManager) {
    const lighthouse = buildLighthouse(this.scene, interactionSystem, uiManager);
    const cottage = buildCottage(this.scene, interactionSystem, uiManager);
    const boathouse = buildBoathouse(this.scene, interactionSystem, uiManager);
    const props = buildProps(this.scene, this._terrain);

    for (const part of [lighthouse, cottage, boathouse]) {
      this._colliders.push(...part.colliders);
      this._groundMeshes.push(...part.groundMeshes);
      this._updatables.push(part);
    }
    this._colliders.push(...props.colliders);
    this._updatables.push(props);
  }

  update(dt, elapsed) {
    for (const u of this._updatables) u.update?.(dt, elapsed);
  }

  getGroundMeshes() {
    return this._groundMeshes;
  }

  getColliders() {
    return this._colliders;
  }
}
