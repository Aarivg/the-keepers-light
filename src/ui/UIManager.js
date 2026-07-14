// Owns all DOM/UI concerns: crosshair, interaction prompt, feedback toast,
// start screen, pause/settings menu, the clue journal + theory board, and
// the closing summary overlay. Other systems never touch the DOM directly —
// they call into this class (e.g. registerClue.js calls showFeedback()).

import { TAGS } from '../journal/JournalManager.js';

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

    this.journalMenuEl = document.getElementById('journal-menu');
    this.journalProgressEl = document.getElementById('journal-progress');
    this.journalListEl = document.getElementById('journal-list');
    this.journalDetailEl = document.getElementById('journal-detail');
    this.journalTallyEl = document.getElementById('journal-tally');

    this.endingOverlayEl = document.getElementById('ending-overlay');
    this.endingBodyEl = document.getElementById('ending-body');
    this.endingTallyEl = document.getElementById('ending-tally');
    this.endingNpcSummariesEl = document.getElementById('ending-npc-summaries');
    this.endingContinueButton = document.getElementById('ending-continue-button');

    this.dialogueMenuEl = document.getElementById('dialogue-menu');
    this.dialogueNpcNameEl = document.getElementById('dialogue-npc-name');
    this.dialoguePortraitEl = document.getElementById('dialogue-npc-portrait');
    this.dialogueLogEl = document.getElementById('dialogue-log');
    this.dialogueTypingEl = document.getElementById('dialogue-typing');
    this.dialogueEvidenceListEl = document.getElementById('dialogue-evidence-list');
    this.dialogueFormEl = document.getElementById('dialogue-input-form');
    this.dialogueInputEl = document.getElementById('dialogue-input');
    this.dialogueSendButton = document.getElementById('dialogue-send-button');

    this._selectedClueId = null;

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

  // ---------------- Journal / theory board ----------------

  showJournal(journal) {
    this._journal = journal;
    if (!this._selectedClueId && journal.entries.length) {
      this._selectedClueId = journal.entries[journal.entries.length - 1].id;
    }
    this._renderJournal();
    this.journalMenuEl.classList.remove('hidden');
  }

  hideJournal() {
    this.journalMenuEl.classList.add('hidden');
  }

  _renderJournal() {
    const journal = this._journal;
    if (!journal) return;

    this.journalProgressEl.textContent = `${journal.foundCount} / ${journal.totalClueCount} found`;

    this.journalListEl.innerHTML = '';
    if (!journal.entries.length) {
      const empty = document.createElement('div');
      empty.id = 'journal-empty-state';
      empty.textContent = 'Nothing logged yet. Go examine something.';
      this.journalListEl.appendChild(empty);
    }
    for (const entry of journal.entries) {
      const li = document.createElement('li');
      li.className = entry.id === this._selectedClueId ? 'selected' : '';
      const dot = document.createElement('span');
      dot.className = `tag-dot${entry.tag ? ` ${entry.tag}` : ''}`;
      const label = document.createElement('span');
      label.textContent = entry.shortDescription;
      li.append(dot, label);
      li.addEventListener('click', () => {
        this._selectedClueId = entry.id;
        this._renderJournal();
      });
      this.journalListEl.appendChild(li);
    }

    this._renderJournalDetail(journal);
    this._renderTally(this.journalTallyEl, journal.getTally());
  }

  _renderJournalDetail(journal) {
    const entry = journal.entries.find((e) => e.id === this._selectedClueId);
    this.journalDetailEl.innerHTML = '';

    if (!entry) {
      const hint = document.createElement('p');
      hint.className = 'journal-empty-hint';
      hint.textContent = 'Select a clue on the left to read it.';
      this.journalDetailEl.appendChild(hint);
      return;
    }

    const title = document.createElement('h3');
    title.textContent = entry.shortDescription;
    const body = document.createElement('p');
    body.className = 'clue-text';
    body.textContent = entry.content;

    const tagRow = document.createElement('div');
    tagRow.className = 'tag-buttons';
    for (const tag of [TAGS.EXPLAINABLE, TAGS.UNCANNY]) {
      const btn = document.createElement('button');
      btn.className = `tag-button ${tag}${entry.tag === tag ? ' active' : ''}`;
      btn.textContent = tag === TAGS.EXPLAINABLE ? 'Explainable' : 'Uncanny';
      btn.addEventListener('click', () => {
        journal.setTag(entry.id, tag);
        this._renderJournal();
      });
      tagRow.appendChild(btn);
    }

    this.journalDetailEl.append(title, body, tagRow);
  }

  _renderTally(container, tally) {
    container.innerHTML = `
      <span class="explainable">Explainable: ${tally.explainable}</span>
      <span class="uncanny">Uncanny: ${tally.uncanny}</span>
      <span class="untagged">Untagged: ${tally.untagged}</span>
    `;
  }

  // ---------------- Ending overlay ----------------

  /** @param {{npcName: string, quote: string|null}[]} npcSummaries */
  showEnding(journal, bodyText, npcSummaries = []) {
    this.endingBodyEl.textContent = bodyText;
    this._renderTally(this.endingTallyEl, journal.getTally());

    this.endingNpcSummariesEl.innerHTML = '';
    if (!npcSummaries.length) {
      const empty = document.createElement('p');
      empty.className = 'npc-summary-empty';
      empty.textContent = "You never spoke to anyone else on the island.";
      this.endingNpcSummariesEl.appendChild(empty);
    }
    for (const { npcName, quote } of npcSummaries) {
      const p = document.createElement('p');
      p.className = 'npc-summary';
      const name = document.createElement('span');
      name.className = 'npc-name';
      name.textContent = `${npcName}:`;
      const q = document.createElement('span');
      q.className = 'npc-quote';
      // Dialogue lines (including the fallback brush-offs) already read as
      // natural speech and often carry their own quote marks — don't
      // double-wrap them.
      q.textContent = quote || '(had nothing more to say)';
      p.append(name, q);
      this.endingNpcSummariesEl.appendChild(p);
    }

    this.endingOverlayEl.classList.remove('hidden');
  }

  hideEnding() {
    this.endingOverlayEl.classList.add('hidden');
  }

  onEndingContinue(fn) {
    this.endingContinueButton.addEventListener('click', fn);
  }

  // ---------------- Dialogue (NPC conversation) ----------------

  /** @param {string} [portraitSrc] - data: URL from World.npcPortraits; omitted hides the portrait image */
  showDialogue(npcName, portraitSrc) {
    this.dialogueNpcNameEl.textContent = npcName;
    this.dialoguePortraitEl.src = portraitSrc || '';
    this.dialogueInputEl.value = '';
    this.dialogueMenuEl.classList.remove('hidden');
    this.dialogueInputEl.focus();
  }

  hideDialogue() {
    this.dialogueMenuEl.classList.add('hidden');
  }

  clearDialogueLog() {
    this.dialogueLogEl.innerHTML = '';
  }

  appendDialogueLine(speakerName, text, isPlayer) {
    const line = document.createElement('p');
    line.className = `line ${isPlayer ? 'player' : 'npc'}`;
    const speaker = document.createElement('span');
    speaker.className = 'speaker';
    speaker.textContent = `${speakerName}:`;
    const body = document.createElement('span');
    body.textContent = text;
    line.append(speaker, body);
    this.dialogueLogEl.appendChild(line);
    this.dialogueLogEl.scrollTop = this.dialogueLogEl.scrollHeight;
  }

  setDialogueBusy(busy) {
    this.dialogueTypingEl.classList.toggle('hidden', !busy);
    this.dialogueInputEl.disabled = busy;
    this.dialogueSendButton.disabled = busy;
    for (const btn of this.dialogueEvidenceListEl.querySelectorAll('button')) {
      btn.disabled = busy;
    }
  }

  /** @param {{id: string, shortDescription: string}[]} clueEntries */
  renderEvidenceButtons(clueEntries, onPick) {
    this.dialogueEvidenceListEl.innerHTML = '';
    for (const entry of clueEntries) {
      const btn = document.createElement('button');
      btn.className = 'evidence-button';
      btn.type = 'button';
      btn.textContent = entry.shortDescription;
      btn.addEventListener('click', () => onPick(entry.id));
      this.dialogueEvidenceListEl.appendChild(btn);
    }
  }

  onDialogueSubmit(fn) {
    this.dialogueFormEl.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = this.dialogueInputEl.value.trim();
      if (!text) return;
      this.dialogueInputEl.value = '';
      fn(text);
    });
  }
}
