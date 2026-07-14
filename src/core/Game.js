import * as THREE from 'three';
import { InputManager } from './InputManager.js';
import { UIManager } from '../ui/UIManager.js';
import { AudioManager } from '../audio/AudioManager.js';
import { World } from '../world/World.js';
import { FirstPersonController } from '../player/FirstPersonController.js';
import { InteractionSystem } from '../interaction/InteractionSystem.js';
import { JournalManager } from '../journal/JournalManager.js';
import { DialogueManager } from '../dialogue/DialogueManager.js';
import { SPAWN } from '../world/layout.js';

export class Game {
  constructor() {
    this.canvas = document.getElementById('scene');
    this.uiManager = new UIManager();
    this.audio = new AudioManager();
    this.input = new InputManager(this.canvas);
    this.journal = new JournalManager();
    this.dialogue = new DialogueManager(this.journal);

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

    this._npcDisplayNames = {};

    this.world.attachInteraction(
      this.interaction,
      this.uiManager,
      this.journal,
      this.audio,
      this.dialogue,
      () => this._triggerEnding(),
      (npcId, displayName) => this._openDialogue(npcId, displayName)
    );

    // World matrices are normally only computed inside renderer.render();
    // force one now so the very first ground raycast in spawnAt() sees
    // correctly-positioned meshes instead of their default identity transform.
    this.scene.updateMatrixWorld(true);
    this.controller.spawnAt(SPAWN.x, SPAWN.z, SPAWN.yaw);

    // 'start' | 'playing' | 'paused' | 'journal' | 'ending' | 'dialogue'
    this._uiMode = 'start';
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

    // Pointer lock is only ever (re)acquired when we want to return to
    // active play — from the start screen, the pause menu's Resume button,
    // closing the journal, dismissing the ending overlay, or ending a
    // conversation — so this handler can unconditionally treat it as "back
    // to playing."
    this.input.onAction('lock', () => {
      this.uiManager.hideStartScreen();
      this.uiManager.hidePauseMenu();
      this.uiManager.hideJournal();
      this.uiManager.hideEnding();
      this.uiManager.hideDialogue();
      this._uiMode = 'playing';
      this.controller.setEnabled(true);
      this._playing = true;
      this.audio.resume();
    });

    // Losing pointer lock means either the player pressed Escape (browser
    // exits lock automatically) or we deliberately released it ourselves
    // (opening the journal/ending/dialogue, which already set _uiMode
    // beforehand) — only fall back to the pause menu if none of those
    // claimed the mode.
    this.input.onAction('unlock', () => {
      this.controller.setEnabled(false);
      this._playing = false;
      this.uiManager.hidePrompt();
      if (!['journal', 'ending', 'dialogue'].includes(this._uiMode)) {
        this._uiMode = 'paused';
        this.uiManager.showPauseMenu();
      }
    });

    this.input.onAction('journal', () => this._toggleJournal());

    this.input.onAction('escape', () => {
      if (this._uiMode === 'journal') this._toggleJournal();
      else if (this._uiMode === 'dialogue') this._closeDialogue();
    });

    this.uiManager.onResumeClicked(() => this.input.requestPointerLock());
    this.uiManager.onEndingContinue(() => this.input.requestPointerLock());
    this.uiManager.onDialogueSubmit((text) => this._sendDialogueAction({ type: 'freeText', text }));
  }

  _toggleJournal() {
    if (this._uiMode === 'journal') {
      this.uiManager.hideJournal();
      this.input.requestPointerLock(); // 'lock' handler restores _uiMode = 'playing'
    } else if (this._uiMode === 'playing') {
      this._uiMode = 'journal';
      this.uiManager.showJournal(this.journal);
      this.input.exitPointerLock();
    }
  }

  _openDialogue(npcId, displayName) {
    if (this._uiMode !== 'playing') return;
    this._uiMode = 'dialogue';
    this._currentNpcId = npcId;
    this._npcDisplayNames[npcId] = displayName;

    this.uiManager.clearDialogueLog();
    for (const turn of this.dialogue.getHistory(npcId)) {
      this.uiManager.appendDialogueLine(
        turn.role === 'user' ? 'You' : displayName,
        turn.text,
        turn.role === 'user'
      );
    }
    this.uiManager.renderEvidenceButtons(this.journal.entries, (clueId) =>
      this._sendDialogueAction({ type: 'presentEvidence', clueId })
    );
    this.uiManager.showDialogue(displayName, this.world.npcPortraits?.[npcId]);
    this.input.exitPointerLock();
  }

  _closeDialogue() {
    this.uiManager.hideDialogue();
    this.input.requestPointerLock(); // 'lock' handler restores _uiMode = 'playing'
  }

  async _sendDialogueAction(action) {
    const npcId = this._currentNpcId;
    if (!npcId) return;
    const displayName = this._npcDisplayNames[npcId];

    if (action.type === 'freeText') {
      this.uiManager.appendDialogueLine('You', action.text, true);
    } else {
      const clue = this.journal.entries.find((e) => e.id === action.clueId);
      this.uiManager.appendDialogueLine('You', `[present: ${clue?.shortDescription ?? action.clueId}]`, true);
    }

    this.uiManager.setDialogueBusy(true);
    const { reply } = await this.dialogue.send(npcId, action);

    // If the player closed this conversation or opened a different NPC
    // while the request was in flight, the reply is already correctly
    // recorded in dialogue history — just skip rendering it into whatever
    // conversation is on screen now.
    if (this._currentNpcId !== npcId) return;
    this.uiManager.setDialogueBusy(false);
    this.uiManager.appendDialogueLine(displayName, reply, false);
  }

  _triggerEnding() {
    this._uiMode = 'ending';
    const body = [
      "The boat that isn't his rocks against the dock. Behind you, the light keeps turning, on schedule, for no one.",
      '',
      "You didn't find him. You found what he left behind — and it doesn't agree with itself.",
    ].join('\n');

    const npcSummaries = this.dialogue.spokenToIds.map((npcId) => ({
      npcName: this._npcDisplayNames[npcId] ?? npcId,
      quote: this.dialogue.lastReply(npcId),
    }));

    this.uiManager.showEnding(this.journal, body, npcSummaries);
    this.input.exitPointerLock();
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
      // The interaction raycast reads camera.matrixWorld, which otherwise
      // only gets refreshed inside renderer.render() — updating it here
      // keeps the prompt in sync with this frame's camera move instead of
      // trailing one frame behind (imperceptible at 60fps, but free to fix).
      this.camera.updateMatrixWorld();
      this.interaction.update();
    }
    this.world.update(dt, elapsed, this._uiMode === 'dialogue' ? this._currentNpcId : null);

    this.renderer.render(this.scene, this.camera);
  }
}
