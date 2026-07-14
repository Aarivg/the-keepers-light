// Owns all DOM/UI concerns: crosshair, interaction prompt, feedback toast,
// start screen, and pause/settings menu.
//
// Extension point for Phase 2: call `uiManager.registerPausePanel(el)` to
// inject a journal UI element into the pause menu, or read
// `uiManager.settings` for sensitivity/invert-y. Do not reach into the DOM
// from other systems directly — go through this class so Phase 2 has one
// place to add journal/clue UI without touching engine code.

export class UIManager {
  constructor() {
    this.crosshair = document.getElementById('crosshair');
    this.promptEl = document.getElementById('prompt');
    this.blockerEl = document.getElementById('blocker');
    this.startButton = document.getElementById('start-button');
    this.pauseMenuEl = document.getElementById('pause-menu');
    this.resumeButton = document.getElementById('resume-button');
    this.sensitivitySlider = document.getElementById('sensitivity-slider');
    this.sensitivityValue = document.getElementById('sensitivity-value');
    this.invertYToggle = document.getElementById('invert-y-toggle');
    this.journalSlot = document.getElementById('journal-panel-slot');

    this._toastTimer = null;
    this._toastEl = this._createToastEl();

    this.settings = this._loadSettings();
    this.sensitivitySlider.value = this.settings.sensitivity;
    this.sensitivityValue.textContent = this.settings.sensitivity.toFixed(2);
    this.invertYToggle.checked = this.settings.invertY;

    this._onSettingsChangeCallbacks = new Set();

    this.sensitivitySlider.addEventListener('input', () => {
      this.settings.sensitivity = parseFloat(this.sensitivitySlider.value);
      this.sensitivityValue.textContent = this.settings.sensitivity.toFixed(2);
      this._saveSettings();
      this._onSettingsChangeCallbacks.forEach((fn) => fn(this.settings));
    });

    this.invertYToggle.addEventListener('change', () => {
      this.settings.invertY = this.invertYToggle.checked;
      this._saveSettings();
      this._onSettingsChangeCallbacks.forEach((fn) => fn(this.settings));
    });
  }

  onSettingsChange(fn) {
    this._onSettingsChangeCallbacks.add(fn);
    return () => this._onSettingsChangeCallbacks.delete(fn);
  }

  _loadSettings() {
    const defaults = { sensitivity: 1, invertY: false };
    try {
      const raw = localStorage.getItem('keepers-light:settings');
      if (!raw) return defaults;
      return { ...defaults, ...JSON.parse(raw) };
    } catch {
      return defaults;
    }
  }

  _saveSettings() {
    try {
      localStorage.setItem('keepers-light:settings', JSON.stringify(this.settings));
    } catch {
      /* storage unavailable; non-critical */
    }
  }

  _createToastEl() {
    const el = document.createElement('div');
    el.id = 'feedback-toast';
    document.getElementById('hud').appendChild(el);
    return el;
  }

  showStartScreen(onStart) {
    this.blockerEl.classList.remove('hidden');
    const handler = () => {
      this.startButton.removeEventListener('click', handler);
      onStart();
    };
    this.startButton.addEventListener('click', handler);
  }

  hideStartScreen() {
    this.blockerEl.classList.add('hidden');
  }

  showPauseMenu() {
    this.pauseMenuEl.classList.remove('hidden');
  }

  hidePauseMenu() {
    this.pauseMenuEl.classList.add('hidden');
  }

  onResumeClicked(fn) {
    this.resumeButton.addEventListener('click', fn);
  }

  setCrosshairActive(active) {
    this.crosshair.classList.toggle('active', active);
  }

  showPrompt(text, keyLabel = 'E') {
    this.promptEl.innerHTML = `<span class="key">${keyLabel}</span>${text}`;
    this.promptEl.classList.remove('hidden');
  }

  hidePrompt() {
    this.promptEl.classList.add('hidden');
  }

  showFeedback(text, durationMs = 2600) {
    this._toastEl.textContent = text;
    this._toastEl.classList.add('visible');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      this._toastEl.classList.remove('visible');
    }, durationMs);
  }

  /** Phase 2 extension point: mount a journal/clue panel inside the pause menu. */
  registerPausePanel(element) {
    this.journalSlot.appendChild(element);
  }
}
