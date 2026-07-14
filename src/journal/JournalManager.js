import { TOTAL_CLUE_COUNT } from './clues.js';

export const TAGS = {
  EXPLAINABLE: 'explainable',
  UNCANNY: 'uncanny',
};

/**
 * Pure state/logic for the clue journal and theory board — no DOM. Holds
 * everything in memory for the session (per the brief, cross-session
 * save/load is a later pass).
 *
 * "Flags" are a small side channel for clue-to-clue mechanics (e.g. finding
 * the photograph unlocks the chest) that don't need their own journal entry.
 */
export class JournalManager {
  constructor(totalClueCount = TOTAL_CLUE_COUNT) {
    this.totalClueCount = totalClueCount;
    this._entries = []; // { id, shortDescription, content, tag, foundAt }
    this._byId = new Map();
    this._flags = new Set();
    this._listeners = new Set();
  }

  /** Adds a clue if not already present. Returns true if newly added. */
  addClue(clue) {
    if (this._byId.has(clue.id)) return false;
    const entry = {
      id: clue.id,
      shortDescription: clue.shortDescription,
      content: clue.content,
      tag: null,
      foundAt: this._entries.length,
    };
    this._entries.push(entry);
    this._byId.set(clue.id, entry);
    this._emit();
    return true;
  }

  hasClue(id) {
    return this._byId.has(id);
  }

  setTag(id, tag) {
    const entry = this._byId.get(id);
    if (!entry) return;
    entry.tag = entry.tag === tag ? null : tag; // clicking the active tag clears it
    this._emit();
  }

  setFlag(name) {
    this._flags.add(name);
  }

  hasFlag(name) {
    return this._flags.has(name);
  }

  get entries() {
    return this._entries;
  }

  get foundCount() {
    return this._entries.length;
  }

  allFound() {
    return this._entries.length >= this.totalClueCount;
  }

  /** Counts for the theory board — flavor only, never a "correct answer". */
  getTally() {
    let explainable = 0;
    let uncanny = 0;
    for (const e of this._entries) {
      if (e.tag === TAGS.EXPLAINABLE) explainable++;
      else if (e.tag === TAGS.UNCANNY) uncanny++;
    }
    return {
      explainable,
      uncanny,
      untagged: this._entries.length - explainable - uncanny,
      total: this._entries.length,
    };
  }

  /** Subscribe to any change (new clue, tag update) — used by the journal UI to re-render. */
  onChange(fn) {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }

  _emit() {
    this._listeners.forEach((fn) => fn(this));
  }
}
