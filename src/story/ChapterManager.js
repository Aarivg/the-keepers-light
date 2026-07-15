// Pure state/logic for the three-chapter structure — no DOM, mirrors
// JournalManager's shape (a `checkUnlocks()` call plus a change-listener
// list Game.js subscribes to for the chapter-transition title card).
//
// Unlock conditions (see README's authoring note for the full rationale):
//   Chapter 1 -> 2: at least 5 of the original 9 clues found, and Mara spoken to.
//   Chapter 2 -> 3: every clue found (original 9 + the 4 cave clues — derived
//     from clues.js's TOTAL_CLUE_COUNT, not hardcoded) and both NPCs spoken to.

export const CHAPTERS = {
  1: { id: 1, title: 'Chapter 1', subtitle: 'Arrival' },
  2: { id: 2, title: 'Chapter 2', subtitle: 'Deeper Waters' },
  3: { id: 3, title: 'Chapter 3', subtitle: 'The Reckoning' },
};

export class ChapterManager {
  constructor() {
    this.chapter = 1;
    this._listeners = new Set();
  }

  /** @param {(info: {id:number, title:string, subtitle:string}) => void} fn */
  onChapterChange(fn) {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }

  /**
   * Re-check unlock conditions against current journal/dialogue state. Cheap
   * and idempotent — call it after anything that could satisfy a gate (a
   * clue found, an NPC spoken to for the first time). Loops so a single call
   * can never leave a chapter one step behind if two conditions clear at once.
   */
  checkUnlocks(journal, dialogue) {
    let advanced = true;
    while (advanced) {
      advanced = false;
      if (this.chapter === 1 && journal.foundCount >= 5 && dialogue.hasSpokenTo('mara')) {
        this._advanceTo(2);
        advanced = true;
      } else if (
        this.chapter === 2 &&
        journal.allFound() &&
        dialogue.hasSpokenTo('mara') &&
        dialogue.hasSpokenTo('thomas')
      ) {
        this._advanceTo(3);
        advanced = true;
      }
    }
  }

  _advanceTo(chapter) {
    this.chapter = chapter;
    const info = CHAPTERS[chapter];
    this._listeners.forEach((fn) => fn(info));
  }

  /**
   * Restores a chapter number from a save without firing onChapterChange —
   * the title card / arrival toasts are transition celebrations, not
   * "welcome back" moments. Callers restoring from a save are responsible
   * for replaying whatever world-side-effects the skipped chapters needed
   * (see Game.js's `_applyChapterAndWorldEffects`).
   */
  setChapter(chapter) {
    this.chapter = chapter;
  }
}
