// Centralizes keyboard + mouse-look input so other systems never touch
// DOM events directly. FirstPersonController reads movement state;
// InteractionSystem and UIManager subscribe to discrete key "actions".

export class InputManager {
  constructor(domElement) {
    this.domElement = domElement;

    this.keys = new Set();
    this.mouseDeltaX = 0;
    this.mouseDeltaY = 0;
    this.pointerLocked = false;

    this._actionListeners = new Map(); // action name -> Set<fn>

    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);
    this._onMouseMove = this._onMouseMove.bind(this);
    this._onPointerLockChange = this._onPointerLockChange.bind(this);

    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    document.addEventListener('mousemove', this._onMouseMove);
    document.addEventListener('pointerlockchange', this._onPointerLockChange);
  }

  onAction(action, fn) {
    if (!this._actionListeners.has(action)) this._actionListeners.set(action, new Set());
    this._actionListeners.get(action).add(fn);
    return () => this._actionListeners.get(action)?.delete(fn);
  }

  _emit(action) {
    this._actionListeners.get(action)?.forEach((fn) => fn());
  }

  isDown(code) {
    return this.keys.has(code);
  }

  requestPointerLock() {
    // requestPointerLock() returns a Promise in modern browsers that can
    // reject (e.g. denied by the user, or unsupported in some automated/
    // embedded contexts) — swallow that instead of letting it surface as
    // an unhandled rejection.
    const result = this.domElement.requestPointerLock();
    if (result && typeof result.catch === 'function') {
      result.catch((err) => console.warn('Pointer lock request failed:', err));
    }
  }

  exitPointerLock() {
    if (document.pointerLockElement) document.exitPointerLock();
  }

  /** Call once per frame after reading deltas. */
  consumeMouseDelta() {
    const dx = this.mouseDeltaX;
    const dy = this.mouseDeltaY;
    this.mouseDeltaX = 0;
    this.mouseDeltaY = 0;
    return { dx, dy };
  }

  _onKeyDown(e) {
    // Tab would otherwise cycle focus off the canvas (and, per spec, drop
    // pointer lock along with it) — stop that so it can double as a
    // journal-toggle key like the brief asks for. Arrow keys have no other
    // use in this game, so prevent their default (page-scroll) behavior too
    // — matters mainly while not pointer-locked (paused, menus).
    if (e.code === 'Tab' || e.code.startsWith('Arrow')) e.preventDefault();

    if (!this.keys.has(e.code)) {
      this.keys.add(e.code);
      if (e.code === 'KeyE') this._emit('interact');
      if (e.code === 'Escape') this._emit('escape');
      if (e.code === 'KeyJ' || e.code === 'Tab') this._emit('journal');
      if (e.code === 'KeyH') this._emit('hint');
    } else {
      this.keys.add(e.code);
    }
  }

  _onKeyUp(e) {
    this.keys.delete(e.code);
  }

  _onMouseMove(e) {
    if (!this.pointerLocked) return;
    this.mouseDeltaX += e.movementX || 0;
    this.mouseDeltaY += e.movementY || 0;
  }

  _onPointerLockChange() {
    this.pointerLocked = document.pointerLockElement === this.domElement;
    this._emit(this.pointerLocked ? 'lock' : 'unlock');
  }

  dispose() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    document.removeEventListener('mousemove', this._onMouseMove);
    document.removeEventListener('pointerlockchange', this._onPointerLockChange);
  }
}
