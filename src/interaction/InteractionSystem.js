import * as THREE from 'three';

/**
 * The interaction scaffold Phase 2 will build on: a flat registry of
 * interactable objects, a per-frame raycast from the camera to find what's
 * being looked at, a range check, prompt display, and a trigger callback.
 *
 * Phase 2 should NOT need to touch raycasting/prompt logic at all — just
 * call `interactionSystem.register(mesh, { label, onInteract })` for every
 * new clue object, and optionally update `onInteract` on existing entries
 * once the journal/clue system exists.
 */
export class InteractionSystem {
  constructor({ camera, uiManager, input, maxRange = 3.2 }) {
    this.camera = camera;
    this.uiManager = uiManager;
    this.input = input;
    this.maxRange = maxRange;

    this._registry = []; // { object, label, range, onInteract, promptKey }
    this._meshToEntry = new Map();
    this._raycaster = new THREE.Raycaster();
    this._raycaster.far = maxRange + 2;
    this._current = null;

    this._unsubscribe = input.onAction('interact', () => this._onInteractPressed());
  }

  /**
   * Register an interactable object.
   * @param {THREE.Object3D} object - mesh (or group) to raycast against; all
   *   descendants are included automatically.
   * @param {Object} opts
   * @param {string|() => string} opts.label - prompt text, e.g. "Examine logbook".
   *   May be a function returning a string if the prompt should reflect
   *   changing state (a locked chest, a gated ending trigger, etc.).
   * @param {(entry) => void} opts.onInteract - called on interact key press
   * @param {number} [opts.range] - override maxRange for this object
   * @param {string} [opts.promptKey] - override the displayed key (default "E")
   */
  register(object, { label, onInteract, range, promptKey = 'E' }) {
    const entry = { object, label, onInteract, range: range ?? this.maxRange, promptKey };
    this._registry.push(entry);
    object.traverse((child) => {
      if (child.isMesh) this._meshToEntry.set(child, entry);
    });
    object.userData.interactable = true;
    return entry;
  }

  unregister(object) {
    const idx = this._registry.findIndex((e) => e.object === object);
    if (idx !== -1) this._registry.splice(idx, 1);
    object.traverse((child) => this._meshToEntry.delete(child));
  }

  update() {
    const targets = [...this._meshToEntry.keys()];
    this._current = null;

    if (targets.length) {
      this._raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
      const hits = this._raycaster.intersectObjects(targets, false);
      for (const hit of hits) {
        const entry = this._meshToEntry.get(hit.object);
        if (entry && hit.distance <= entry.range) {
          this._current = entry;
          break;
        }
      }
    }

    if (this._current) {
      const label =
        typeof this._current.label === 'function' ? this._current.label() : this._current.label;
      this.uiManager.showPrompt(label, this._current.promptKey);
      this.uiManager.setCrosshairActive(true);
    } else {
      this.uiManager.hidePrompt();
      this.uiManager.setCrosshairActive(false);
    }
  }

  _onInteractPressed() {
    if (this._current) {
      this._current.onInteract?.(this._current);
    }
  }

  dispose() {
    this._unsubscribe?.();
  }
}
