// Shared journal-flag names used across building modules that don't
// otherwise import each other (Cottage.js sets these, Cave.js reads them) —
// centralized so the string literals can't drift out of sync.
export const FLAGS = {
  CHEST_KEY: 'chestKey', // photograph found -> chest unlocked (Phase 2)
  CAVE_KEY: 'caveKey', // chest opened -> also grants the sea cave's grate key (this phase)
  CAVE_OPENED: 'caveOpened', // grate unlocked -> cave interior accessible
};
