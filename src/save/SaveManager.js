// Thin, pure-storage layer over a single localStorage save slot. Knows
// nothing about Journal/Chapter/Dialogue/Controller shapes — Game.js builds
// and applies the actual save payload; this just gets bytes in and out of
// storage safely.
//
// A single slot is enough for v1 (see Phase 6 brief) — no multi-save UI.

const SAVE_KEY = 'keepers-light:save';

// Bump this whenever the save payload's shape changes. load() refuses
// anything that doesn't match — a future phase can add real migration by
// branching on the old version here, but until then "can't migrate" and
// "corrupted" both just mean "fall back to a fresh game."
export const SAVE_VERSION = 1;

export class SaveManager {
  /**
   * @returns {{data: object|null, corrupted: boolean}} `data` is null if
   *   there's nothing usable (either no save was ever written, or what's
   *   there couldn't be parsed / didn't match the current version).
   *   `corrupted` is true only in the latter case — used to show a
   *   one-time "your save couldn't be read" notice rather than silently
   *   treating a genuinely first-time player the same as a lost save.
   */
  load() {
    let raw;
    try {
      raw = localStorage.getItem(SAVE_KEY);
    } catch {
      return { data: null, corrupted: false }; // storage unavailable entirely
    }
    if (!raw) return { data: null, corrupted: false };

    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || parsed.saveVersion !== SAVE_VERSION) {
        return { data: null, corrupted: true };
      }
      return { data: parsed, corrupted: false };
    } catch {
      return { data: null, corrupted: true };
    }
  }

  hasSave() {
    return this.load().data !== null;
  }

  /** @returns {boolean} whether the write actually succeeded. */
  save(data) {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({ ...data, saveVersion: SAVE_VERSION }));
      return true;
    } catch {
      // Quota exceeded, storage disabled (private browsing in some
      // browsers), etc. — caller surfaces a small warning; nothing here
      // should ever throw into gameplay code.
      return false;
    }
  }

  clear() {
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch {
      /* storage unavailable — nothing to clean up */
    }
  }
}
