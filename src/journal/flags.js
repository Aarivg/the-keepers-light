// Shared journal-flag names used across building modules that don't
// otherwise import each other (Cottage.js sets these, Cave.js reads them) —
// centralized so the string literals can't drift out of sync.
export const FLAGS = {
  CHEST_KEY: 'chestKey', // photograph found -> chest unlocked (Phase 2)
  CAVE_KEY: 'caveKey', // chest opened -> also grants the sea cave's grate key (this phase)
  CAVE_OPENED: 'caveOpened', // grate unlocked -> cave interior accessible
  // dialogue.hasSpokenTo(npcId) is a single flag for the whole game, but
  // chapter 3 wants the player to talk to Mara/Thomas again at the
  // lighthouse — these track that chapter-3 conversation specifically, so
  // HintManager's chapter-3 branch doesn't see "already spoken to" (from
  // chapter 1/2, a precondition for chapter 3 even starting) and skip
  // straight past both NPCs to the ending (Phase 8).
  SPOKEN_MARA_CH3: 'spokenMaraCh3',
  SPOKEN_THOMAS_CH3: 'spokenThomasCh3',
};
