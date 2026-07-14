import * as THREE from 'three';
import { InputManager } from './InputManager.js';
import { UIManager } from '../ui/UIManager.js';
import { AudioManager } from '../audio/AudioManager.js';
import { World } from '../world/World.js';
import { FirstPersonController } from '../player/FirstPersonController.js';
import { InteractionSystem } from '../interaction/InteractionSystem.js';
import { SPAWN } from '../world/layout.js';

export class Game {
  constructor() {
    this.canvas = document.getElementById('scene');
    this.uiManager = new UIManager();
    this.audio = new AudioManager();
    this.input = new InputManager(this.canvas);

    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 500);

    this.world = new World(this.scene);

    this.controller = new FirstPersonController({
      camera: this.camera,
      domElement: this.canvas,
      input: this.input,
      world: this.world,
      uiManager: this.uiManager,
    });
    this.controller.onFootstep = (speedRatio) => this.audio.footstep(speedRatio);

    this.interaction = new InteractionSystem({
      camera: this.camera,
      uiManager: this.uiManager,
      input: this.input,
      maxRange: 3.2,
    });

    this.world.attachInteraction(this.interaction, this.uiManager);

    // World matrices are normally only computed inside renderer.render();
    // force one now so the very first ground raycast in spawnAt() sees
    // correctly-positioned meshes instead of their default identity transform.
    this.scene.updateMatrixWorld(true);
    this.controller.spawnAt(SPAWN.x, SPAWN.z, SPAWN.yaw);

    this._playing = false;
    this._clock = new THREE.Clock();

    this._bindLifecycle();
    window.addEventListener('resize', () => this._onResize());
  }

  _bindLifecycle() {
    this.uiManager.showStartScreen(() => {
      this.audio.start();
      this.input.requestPointerLock();
    });

    this.input.onAction('lock', () => {
      this.uiManager.hideStartScreen();
      this.uiManager.hidePauseMenu();
      this.controller.setEnabled(true);
      this._playing = true;
      this.audio.resume();
    });

    this.input.onAction('unlock', () => {
      this.controller.setEnabled(false);
      this._playing = false;
      this.uiManager.hidePrompt();
      this.uiManager.showPauseMenu();
    });

    this.uiManager.onResumeClicked(() => this.input.requestPointerLock());
  }

  _onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  start() {
    this.renderer.setAnimationLoop(() => this._tick());
  }

  _tick() {
    const dt = Math.min(this._clock.getDelta(), 0.05);
    const elapsed = this._clock.getElapsedTime();

    if (this._playing) {
      this.controller.update(dt);
      this.interaction.update();
    }
    this.world.update(dt, elapsed);

    this.renderer.render(this.scene, this.camera);
  }
}
