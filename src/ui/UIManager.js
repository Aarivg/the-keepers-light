// Owns all DOM/UI concerns: crosshair, interaction prompt, feedback toast,
// start screen, pause/settings menu, the clue journal + theory board, and
// the closing summary overlay. Other systems never touch the DOM directly —
// they call into this class (e.g. registerClue.js calls showFeedback()).

import { TAGS } from '../journal/JournalManager.js';
import { INTRO_BEATS } from '../story/introContent.js';

export class UIManager {
  constructor() {
    this.crosshair = document.getElementById('crosshair');
    this.promptEl = document.getElementById('prompt');
    this.objectiveArrowEl = document.getElementById('objective-arrow');
    this.objectiveArrowIconEl = document.getElementById('objective-arrow-icon');
    this.blockerEl = document.getElementById('blocker');
    this.startButton = document.getElementById('start-button');
    this.continueButton = document.getElementById('continue-button');
    this.startScreenNoticeEl = document.getElementById('start-screen-notice');

    this.chapterCardEl = document.getElementById('chapter-card');
    this.chapterCardTitleEl = document.getElementById('chapter-card-title');
    this.chapterCardSubtitleEl = document.getElementById('chapter-card-subtitle');
    this._chapterCardTimer = null;

    this.introScreenEl = document.getElementById('intro-screen');
    this.introBeatEl = document.getElementById('intro-beat');
    this.introSkipButton = document.getElementById('intro-skip-button');
    this.introContinueButton = document.getElementById('intro-continue-button');
    this.pauseMenuEl = document.getElementById('pause-menu');
    this.resumeButton = document.getElementById('resume-button');
    this.saveButton = document.getElementById('save-button');
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
    this._saveToastTimer = null;
    this._saveToastEl = this._createSaveToastEl();

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

  _createSaveToastEl() {
    const el = document.createElement('div');
    el.id = 'save-toast';
    document.getElementById('hud').appendChild(el);
    return el;
  }

  /** Small, separate indicator so an autosave never clobbers a feedback
   * toast the player is mid-reading (e.g. "Journal updated: ..."). */
  showSaveIndicator(text, isWarning = false) {
    this._saveToastEl.textContent = text;
    this._saveToastEl.classList.toggle('warning', isWarning);
    this._saveToastEl.classList.add('visible');
    clearTimeout(this._saveToastTimer);
    this._saveToastTimer = setTimeout(() => {
      this._saveToastEl.classList.remove('visible');
    }, isWarning ? 4000 : 1800);
  }

  // ---------------- Intro sequence ----------------

  /** Plays the pre-start-screen intro beats; `onComplete` fires on the last "Begin" click or Skip, either way — Game.js chains it into showStartScreen(). */
  showIntro(onComplete) {
    let i = 0;
    this.introScreenEl.classList.remove('hidden');

    const render = () => {
      this.introBeatEl.style.opacity = '0';
      setTimeout(() => {
        this.introBeatEl.textContent = INTRO_BEATS[i];
        this.introContinueButton.textContent = i === INTRO_BEATS.length - 1 ? 'Begin' : 'Continue';
        this.introBeatEl.style.opacity = '1';
      }, 220);
    };
    render();

    const finish = () => {
      this.introContinueButton.removeEventListener('click', onContinue);
      this.introSkipButton.removeEventListener('click', finish);
      this.introScreenEl.classList.add('hidden');
      onComplete();
    };
    const onContinue = () => {
      i++;
      if (i >= INTRO_BEATS.length) finish();
      else render();
    };

    this.introContinueButton.addEventListener('click', onContinue);
    this.introSkipButton.addEventListener('click', finish);
  }

  // ---------------- Chapter transition card ----------------

  /** @param {{title: string, subtitle: string}} info */
  showChapterCard(info) {
    clearTimeout(this._chapterCardTimer);
    this.chapterCardTitleEl.textContent = info.title;
    this.chapterCardSubtitleEl.textContent = info.subtitle;
    this.chapterCardEl.classList.remove('hidden');
    // rAF so the 'hidden' removal and 'visible' addition don't collapse into
    // the same style recalc — otherwise the opacity/transform transition has
    // nothing to animate from.
    requestAnimationFrame(() => this.chapterCardEl.classList.add('visible'));
    this._chapterCardTimer = setTimeout(() => {
      this.chapterCardEl.classList.remove('visible');
      this._chapterCardTimer = setTimeout(() => this.chapterCardEl.classList.add('hidden'), 650);
    }, 3400);
  }

  /**
   * @param {Object} opts
   * @param {boolean} opts.hasSave - toggles Continue's visibility and
   *   whether the primary button reads "Click to begin" or "New Game".
   * @param {string|null} [opts.notice] - shown above the buttons (e.g. "your
   *   save couldn't be read") — null/omitted hides the notice entirely.
   * @param {() => void} opts.onNewGame - fired after confirmation, if a save
   *   existed (starting fresh with no save present needs no confirmation).
   * @param {() => void} opts.onContinue - fired when Continue is clicked;
   *   only reachable when hasSave is true.
   */
  showStartScreen({ hasSave, notice = null, onNewGame, onContinue }) {
    this.blockerEl.classList.remove('hidden');

    this.startButton.textContent = hasSave ? 'New Game' : 'Click to begin';
    this.continueButton.classList.toggle('hidden', !hasSave);

    if (notice) {
      this.startScreenNoticeEl.textContent = notice;
      this.startScreenNoticeEl.classList.remove('hidden');
    } else {
      this.startScreenNoticeEl.classList.add('hidden');
    }

    const cleanup = () => {
      this.startButton.removeEventListener('click', startHandler);
      this.continueButton.removeEventListener('click', continueHandler);
    };
    const startHandler = () => {
      if (hasSave && !window.confirm('This will erase your current save — continue?')) return;
      cleanup();
      onNewGame();
    };
    const continueHandler = () => {
      cleanup();
      onContinue();
    };

    this.startButton.addEventListener('click', startHandler);
    this.continueButton.addEventListener('click', continueHandler);
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

  onSaveClicked(fn) {
    this.saveButton.addEventListener('click', fn);
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

  /** @param {number} angleDeg - bearing to the nearest objective, relative
   * to where the player is currently facing (0 = straight ahead). */
  showObjectiveIndicator(angleDeg) {
    this.objectiveArrowIconEl.style.transform = `rotate(${angleDeg}deg)`;
    this.objectiveArrowEl.classList.add('visible');
  }

  hideObjectiveIndicator() {
    this.objectiveArrowEl.classList.remove('visible');
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
