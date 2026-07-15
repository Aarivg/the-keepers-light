import * as THREE from 'three';
import { InputManager } from './InputManager.js';
import { UIManager } from '../ui/UIManager.js';
import { AudioManager } from '../audio/AudioManager.js';
import { World } from '../world/World.js';
import { FirstPersonController } from '../player/FirstPersonController.js';
import { InteractionSystem } from '../interaction/InteractionSystem.js';
import { JournalManager } from '../journal/JournalManager.js';
import { DialogueManager } from '../dialogue/DialogueManager.js';
import { ChapterManager, CHAPTERS } from '../story/ChapterManager.js';
import { HintManager } from '../story/HintManager.js';
import { SPAWN } from '../world/layout.js';

export class Game {
  constructor() {
    this.canvas = document.getElementById('scene');
    this.uiManager = new UIManager();
    this.audio = new AudioManager();
    this.input = new InputManager(this.canvas);
    this.journal = new JournalManager();
    this.dialogue = new DialogueManager(this.journal);
    this.chapters = new ChapterManager();
    this.hints = new HintManager();

    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    // Raised from 1.05 as part of the brightness pass — ACES rolls off
    // highlights aggressively, so this needed to move with the light
    // intensity increases in World.js, not instead of them.
    this.renderer.toneMappingExposure = 1.4;

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
      () => this.chapters.chapter,
      () => this._triggerEnding(),
      (npcId, displayName) => this._openDialogue(npcId, displayName)
    );

    this.journal.onChange(() => this.chapters.checkUnlocks(this.journal, this.dialogue));
    this.chapters.onChapterChange((info) => this._onChapterChange(info));

    // World matrices are normally only computed inside renderer.render();
    // force one now so the very first ground raycast in spawnAt() sees
    // correctly-positioned meshes instead of their default identity transform.
    this.scene.updateMatrixWorld(true);
    this.controller.spawnAt(SPAWN.x, SPAWN.z, SPAWN.yaw);

    // 'start' | 'playing' | 'paused' | 'journal' | 'ending' | 'dialogue'
    this._uiMode = 'start';
    this._playing = false;
    this._clock = new THREE.Clock();
    this._gameplayStarted = false; // first true 'playing' entry shows the Chapter 1 title card
    this._lastHintAt = -Infinity;

    this._bindLifecycle();
    window.addEventListener('resize', () => this._onResize());
  }

  _bindLifecycle() {
    this.uiManager.showIntro(() => {
      this.uiManager.showStartScreen(() => {
        this.audio.start();
        this.input.requestPointerLock();
      });
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

      if (!this._gameplayStarted) {
        this._gameplayStarted = true;
        this.uiManager.showChapterCard(CHAPTERS[this.chapters.chapter]);
      }
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
    this.input.onAction('hint', () => this._showHint());

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

  _onChapterChange(info) {
    this.uiManager.showChapterCard(info);
    if (info.id === 2) {
      this.world.revealThomas();
      setTimeout(() => this.uiManager.showFeedback('Thomas Voss has arrived at the cottage.'), 1800);
    } else if (info.id === 3) {
      this.world.setNight();
      this.world.relocateNpcsForChapter3();
      setTimeout(() => this.uiManager.showFeedback('Mara and Thomas have made their way to the lighthouse.'), 1800);
    }
  }

  _showHint() {
    if (this._uiMode !== 'playing') return;
    const now = performance.now();
    if (now - this._lastHintAt < 4000) return;
    this._lastHintAt = now;

    const text = this.hints.getHint({
      chapter: this.chapters.chapter,
      journal: this.journal,
      dialogue: this.dialogue,
      playerX: this.controller.position.x,
      playerZ: this.controller.position.z,
      endingShown: this._endingShown === true,
    });
    this.uiManager.showFeedback(text);
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
    this.chapters.checkUnlocks(this.journal, this.dialogue);

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
    this._endingShown = true;
    // Chapter 3 requires every clue found (original 9 + the 4 cave clues —
    // see ChapterManager), so by the time this fires the player necessarily
    // has all of it; the cave threads (bigger/older smuggling operation, the
    // unresolved third initials, Old Rourke's echoing final entries) are
    // folded in unconditionally rather than checked for.
    const body = [
      'The lamp keeps turning behind you, indifferent, exactly on schedule. Whatever was here has already happened; nothing in this room needs you to understand it.',
      '',
      "You know more now than you did when the boat dropped you at the dock — a bigger, older arrangement than one captain's word accounted for; a name that doesn't belong to anyone you've met; a bell, a broken lamp, and a logbook decades older than Elias's, saying the same thing his did.",
      '',
      "None of it agrees with itself. You didn't find him. You found what he left behind, and what was left behind before him — and it still doesn't add up to one answer.",
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
