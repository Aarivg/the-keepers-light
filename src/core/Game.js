import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
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
import { SaveManager } from '../save/SaveManager.js';
import { CLUE_BY_ID } from '../journal/clues.js';
import { FLAGS } from '../journal/flags.js';

// Mirrors the literal strings NPCs.js's onTalk callbacks pass — needed so a
// continued save can label the ending summary correctly even if the player
// never reopens a conversation with someone they'd already spoken to.
const NPC_DISPLAY_NAMES = { mara: 'Mara Kessel', thomas: 'Thomas Voss' };

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
    this.saveManager = new SaveManager();
    this._npcDisplayNames = {};

    // Peek at a save up front. The player's actual Continue-vs-New-Game
    // choice happens later at the start screen, but the world (cave grate
    // open/closed, Thomas revealed, night lighting) has to be built before
    // then — so we eagerly apply any save now and let "New Game" simply
    // reload the page rather than trying to unwind a live, partially-open
    // 3D scene back to a blank slate. See _startNewGame().
    const { data: pendingSave, corrupted } = this.saveManager.load();
    this._pendingSave = pendingSave;
    this._saveWasCorrupted = corrupted;
    if (this._pendingSave) this._applySavedJournalAndDialogue(this._pendingSave);

    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    // Perf (Phase 7): the shadow depth pass was re-rendering every single
    // frame by default, even though the sun is the only shadow-casting
    // light and almost everything it lights (terrain, buildings, props,
    // the dock) never moves — only the NPCs' subtle idle sway actually
    // needs it to stay current. Manual updates instead: one now (below,
    // after the scene is fully built) plus a slow periodic refresh while
    // playing (_tick()) — frequent enough that NPC shadows never look
    // stale, far cheaper than recomputing the whole depth pass 60x/second.
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    // Raised from 1.05 as part of the brightness pass — ACES rolls off
    // highlights aggressively, so this needed to move with the light
    // intensity increases in World.js, not instead of them.
    this.renderer.toneMappingExposure = 1.4;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 500);

    // Postprocessing (Phase 7): bloom, mainly for the lighthouse beacon — a
    // signature visual moment that had no glow at all before. (A vignette
    // pass was also tried here; pulled after it produced inconsistent,
    // scene-dependent over-darkening on this software renderer that I
    // couldn't fully root-cause in the time available — see the Phase 7
    // report. Cutting it was the safer call than shipping a rendering bug.)
    // A custom multisampled render target keeps the canvas's native MSAA
    // (`antialias: true` above) working through the composer chain —
    // EffectComposer's default target has no samples, which would otherwise
    // silently undo that antialiasing the moment a Pass beyond RenderPass
    // gets added.
    const pixelRatio = this.renderer.getPixelRatio();
    const renderTarget = new THREE.WebGLRenderTarget(
      window.innerWidth * pixelRatio,
      window.innerHeight * pixelRatio,
      { samples: 4, type: THREE.HalfFloatType }
    );
    this.composer = new EffectComposer(this.renderer, renderTarget);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    // threshold is deliberately high — only genuinely bright things (the
    // lamp's own glow, the beacon beam) should bloom; strength/radius kept
    // modest so this reads as a glow, not a haze over the whole scene.
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.55,
      0.4,
      0.82
    );
    this.composer.addPass(this.bloomPass);
    // Deliberately NOT adding an OutputPass: every material's fragment
    // shader already bakes in tone mapping + color-space conversion
    // unconditionally (it's keyed off renderer.toneMapping/outputColorSpace,
    // not the render target), so RenderPass's output is already
    // display-ready — an OutputPass here re-applies ACES on top of the
    // already-tone-mapped image, crushing contrast and saturating colors.
    // Confirmed empirically: with it, a passthrough-only chain (bloom
    // disabled) visibly darkened the scene versus a direct
    // renderer.render() call; without it, they match.

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

    this.journal.onChange(() => {
      this.chapters.checkUnlocks(this.journal, this.dialogue);
      this._autosave();
      this._markProgress();
    });
    this.chapters.onChapterChange((info) => this._onChapterChange(info));

    // World matrices are normally only computed inside renderer.render();
    // force one now so the very first ground raycast in spawnAt() sees
    // correctly-positioned meshes instead of their default identity transform.
    this.scene.updateMatrixWorld(true);
    const p = this._pendingSave?.player;
    if (p && [p.x, p.y, p.z, p.yaw, p.pitch].every(Number.isFinite)) {
      this.controller.restoreTransform(p.x, p.y, p.z, p.yaw, p.pitch);
    } else {
      this.controller.spawnAt(SPAWN.x, SPAWN.z, SPAWN.yaw);
    }

    // 'start' | 'playing' | 'paused' | 'journal' | 'ending' | 'dialogue'
    this._uiMode = 'start';
    this._playing = false;
    this._clock = new THREE.Clock();
    this._gameplayStarted = false; // first true 'playing' entry shows the Chapter 1 title card
    this._lastHintAt = -Infinity;
    this._endingShown = this._pendingSave?.endingShown === true;
    // Objective compass + stuck-nudge (Phase 7) — both throttled off this
    // accumulator rather than recomputed every frame; see _tick().
    this._objectiveUpdateAccum = 0;
    this._idleSeconds = 0;
    this._stuckNudgeShown = false;

    // Chapter number + its one-time world side effects (Thomas revealed,
    // night lighting, NPCs at the lighthouse) are restored last, now that
    // attachInteraction() has actually built the NPCs/terrain they touch.
    // Deliberately silent — no title card, no arrival toast; those are
    // transition celebrations, not "welcome back" moments.
    if (this._pendingSave) {
      const savedChapter = this._pendingSave.chapter;
      const chapter = [1, 2, 3].includes(savedChapter) ? savedChapter : 1;
      this._applyChapterAndWorldEffects(chapter);
    }

    // First (and, until gameplay starts, only) shadow depth pass — see the
    // shadowMap.autoUpdate note above. Placed last so it captures the fully
    // final initial state, including any save-restore world effects above.
    this.renderer.shadowMap.needsUpdate = true;

    this._bindLifecycle();
    window.addEventListener('resize', () => this._onResize());
  }

  _bindLifecycle() {
    this.uiManager.showIntro(() => {
      this.uiManager.showStartScreen({
        hasSave: this._pendingSave !== null,
        notice: this._saveWasCorrupted ? "Your last save couldn't be read — starting fresh." : null,
        onNewGame: () => this._startNewGame(),
        onContinue: () => this._continueFromSave(),
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
      this.uiManager.hideObjectiveIndicator();
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
    this.uiManager.onSaveClicked(() => this._autosave());
  }

  // ---------------- Save / load ----------------

  /** Applies a save's journal (clues, tags, flags) and dialogue (history,
   * spokenTo) onto the fresh manager instances — called early in the
   * constructor, before the world is built, so buildings that bake a
   * one-time visual state off a flag (the cave grate) see it already set. */
  _applySavedJournalAndDialogue(save) {
    const clues = Array.isArray(save.journal?.clues) ? save.journal.clues : [];
    for (const entry of clues) {
      const clue = CLUE_BY_ID.get(entry?.id);
      if (!clue) continue; // unknown id (e.g. a save from a future version) — skip, don't crash
      this.journal.addClue(clue);
      if (entry.tag) this.journal.setTag(entry.id, entry.tag);
    }
    const flags = Array.isArray(save.journal?.flags) ? save.journal.flags : [];
    for (const flag of flags) {
      if (typeof flag === 'string') this.journal.setFlag(flag);
    }

    this.dialogue.restoreState(save.dialogue ?? {});
    for (const npcId of Object.keys(NPC_DISPLAY_NAMES)) {
      if (this.dialogue.hasSpokenTo(npcId)) this._npcDisplayNames[npcId] = NPC_DISPLAY_NAMES[npcId];
    }
  }

  /** Replays the one-time chapter-transition world effects silently — no
   * title card, no arrival toast (see the constructor's call site). */
  _applyChapterAndWorldEffects(chapter) {
    this.chapters.setChapter(chapter);
    if (chapter >= 2) this.world.revealThomas();
    if (chapter >= 3) {
      this.world.setNight();
      this.world.relocateNpcsForChapter3();
    }
  }

  _buildSaveData() {
    return {
      savedAt: Date.now(),
      journal: {
        clues: this.journal.entries.map((e) => ({ id: e.id, tag: e.tag })),
        flags: this.journal.getFlags(),
      },
      chapter: this.chapters.chapter,
      dialogue: this.dialogue.serialize(),
      player: {
        x: this.controller.position.x,
        y: this.controller.position.y,
        z: this.controller.position.z,
        yaw: this.controller.yaw,
        pitch: this.controller.pitch,
      },
      endingShown: this._endingShown === true,
    };
  }

  /** @param {{silent?: boolean}} [opts] - silent skips the visible toast
   * (used mid-dialogue and right after the ending fires, where the toast
   * would just sit behind that panel — see the brief's "shouldn't interrupt
   * movement or dialogue"). The write itself always happens either way. */
  _autosave({ silent = false } = {}) {
    const ok = this.saveManager.save(this._buildSaveData());
    if (!ok) {
      this.uiManager.showSaveIndicator("Couldn't save — storage may be full or unavailable.", true);
    } else if (!silent) {
      this.uiManager.showSaveIndicator('Saved.');
    }
    return ok;
  }

  _startNewGame() {
    this.saveManager.clear();
    if (this._pendingSave) {
      // We already eagerly restored world/journal state for the save the
      // player just chose to discard (see the constructor) — reloading is
      // far simpler and safer than hand-unwinding a live 3D scene (an
      // opened grate, a revealed NPC, night lighting) back to a blank slate.
      window.location.reload();
      return;
    }
    this.audio.start();
    this.input.requestPointerLock();
  }

  _continueFromSave() {
    this._gameplayStarted = true; // suppress the Chapter-1 title card on first lock
    this.audio.start();
    this.input.requestPointerLock();
    this.uiManager.showFeedback('Progress restored.');
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
    this._autosave();
    this._markProgress();
  }

  // ---------------- Guidance: H-key hint, objective compass, stuck-nudge ----------------

  /** Resets the stuck-nudge idle clock — called on every "meaningful state
   * change" (same set as the autosave triggers) and on pressing H itself,
   * per the brief: dismissed immediately once the player makes progress or
   * asks for a hint directly. */
  _markProgress() {
    this._idleSeconds = 0;
    this._stuckNudgeShown = false;
  }

  _showHint() {
    if (this._uiMode !== 'playing') return;
    const now = performance.now();
    if (now - this._lastHintAt < 4000) return;
    this._lastHintAt = now;
    this._markProgress();

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

  /** Throttled (see _tick()) — points the HUD arrow at the same objective
   * the H-key hint would name (hides it if there's nothing left, or if the
   * player is already standing right on top of it), and hands the same
   * target + player position to the world-space beacon (Phase 8's
   * ObjectiveBeacon.js), which only actually shows once the player is
   * close enough for "somewhere that way" to become "right there." */
  _updateObjectiveIndicator() {
    const px = this.controller.position.x;
    const pz = this.controller.position.z;
    const obj = this.hints.resolveObjective({
      chapter: this.chapters.chapter,
      journal: this.journal,
      dialogue: this.dialogue,
      playerX: px,
      playerZ: pz,
      endingShown: this._endingShown === true,
    });

    if (!obj) {
      this.uiManager.hideObjectiveIndicator();
      this.world.setObjectiveTarget(null, px, pz);
      return;
    }
    this.world.setObjectiveTarget(obj.pos, px, pz);

    const dx = obj.pos.x - px;
    const dz = obj.pos.z - pz;
    if (Math.hypot(dx, dz) < 1.5) {
      // Standing right on the objective already — an arrow here would just
      // jitter with no useful direction to give; the beacon (set above)
      // still shows.
      this.uiManager.hideObjectiveIndicator();
      return;
    }

    // Yaw a player would need to face the objective directly, per this
    // codebase's convention (forward at yaw=0 is world -Z; see
    // FirstPersonController.update()'s moveX/moveZ derivation).
    const worldBearing = Math.atan2(-dx, -dz);
    const screenAngleDeg = THREE.MathUtils.radToDeg(this.controller.yaw - worldBearing);
    this.uiManager.showObjectiveIndicator(screenAngleDeg);
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
    this._autosave(); // "NPC conversation ending" — one of the brief's named autosave triggers
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
    // Chapter 3 wants a fresh conversation with each NPC, but
    // dialogue.hasSpokenTo() is a single whole-game flag (already true from
    // chapters 1/2, since that's a precondition for chapter 3 starting) —
    // so track the chapter-3 conversation separately for HintManager (Phase 8).
    if (this.chapters.chapter === 3) {
      if (npcId === 'mara') this.journal.setFlag(FLAGS.SPOKEN_MARA_CH3);
      else if (npcId === 'thomas') this.journal.setFlag(FLAGS.SPOKEN_THOMAS_CH3);
    }

    // If the player closed this conversation or opened a different NPC
    // while the request was in flight, the reply is already correctly
    // recorded in dialogue history — just skip rendering it into whatever
    // conversation is on screen now.
    if (this._currentNpcId !== npcId) return;
    this.uiManager.setDialogueBusy(false);
    this.uiManager.appendDialogueLine(displayName, reply, false);
    // Silent — the dialogue panel covers the toast's corner anyway, and a
    // visible "Saved" after every single line would be noisy mid-conversation.
    this._autosave({ silent: true });
    this._markProgress();
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
    this._autosave({ silent: true }); // the overlay covers the toast's corner
  }

  _onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.composer.setSize(window.innerWidth, window.innerHeight);
    this.bloomPass.resolution.set(window.innerWidth, window.innerHeight);
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

      // Objective compass + stuck-nudge: both explicitly throttled off a
      // slower interval rather than recomputed every frame (the brief calls
      // this out directly) — a quarter-second lag on a "general directional
      // nudge" is imperceptible.
      this._idleSeconds += dt;
      if (!this._stuckNudgeShown && this._idleSeconds > 90) {
        this._stuckNudgeShown = true;
        this.uiManager.showFeedback("Press H if you're not sure where to go.", 4500);
      }
      this._objectiveUpdateAccum += dt;
      if (this._objectiveUpdateAccum > 0.25) {
        this._objectiveUpdateAccum = 0;
        this._updateObjectiveIndicator();
        // Piggybacks on the same interval — see the shadowMap.autoUpdate
        // note in the constructor. Keeps NPC shadows visually current
        // without paying for a full depth pass every frame.
        this.renderer.shadowMap.needsUpdate = true;
      }
    }
    this.world.update(dt, elapsed, this._uiMode === 'dialogue' ? this._currentNpcId : null);

    this.composer.render();
  }
}
