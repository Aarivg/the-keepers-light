// Pure state-driven hint lookup — no AI call, no DOM. Given the player's
// current chapter, found clues, NPCs spoken to, and roughly where they're
// standing, picks the single most relevant unclaimed objective and returns
// one short in-character line pointing toward it. Never toward the
// mystery's answer — only toward the next physical thing to go do.
//
// Priority order (highest first), matching the game's actual critical path:
//   Chapter 1: nearest unfound original clue -> talk to Mara.
//   Chapter 2: nearest unfound original clue -> get the cave key (implied by
//     the ledger, already covered above) -> open the cave grate -> nearest
//     unfound cave clue -> talk to Thomas.
//   Chapter 3: talk to Mara -> talk to Thomas -> go end it at the light.
// A clue with no reachable candidate falls through to the next tier; a
// state with nothing left anywhere returns the "learned all you can" line.
//
// Phase 7: resolveObjective() is the shared core — it returns the target
// world position alongside the text, so the HUD's objective-indicator can
// reuse the exact same priority logic instead of duplicating it. getHint()
// (the H-key path) is a thin wrapper over it.
//
// Phase 8: every `pos` below is now the clue/NPC/door's exact 3D position
// (not just the building it's in) — coordinates read directly off the
// building files that place these objects (Cottage.js, Lighthouse.js,
// Boathouse.js, Cave.js), kept here rather than imported since nothing else
// needs a single object-position registry yet. This is what lets the HUD
// arrow point precisely and the world-space beacon (Game.js /
// ObjectiveBeacon.js) land exactly on the object once the player is close.

import {
  CAVE,
  MARA_POSITION,
  THOMAS_POSITION,
  MARA_CHAPTER3_POSITION,
  THOMAS_CHAPTER3_POSITION,
} from '../world/layout.js';
import { FLAGS } from '../journal/flags.js';

const NOTHING_LEFT = "You've learned all you can here for now.";
const ENDING_SHOWN_TEXT = "There's nothing left here for you now.";

// ---- Exact object positions (see building files for the matching math) ----
const COTTAGE_LOGBOOK_POS = { x: -32.5, y: 2.58, z: 2 };
const COTTAGE_LETTER_POS = { x: -32.5, y: 2.38, z: 2.32 };
const COTTAGE_PHOTOGRAPH_POS = { x: -31.8, y: 2.43, z: 9.1 };
const COTTAGE_CHEST_POS = { x: -32.8, y: 2.075, z: 5.4 };
const LIGHTHOUSE_RADIO_POS = { x: 1.85, y: 3.53, z: -66.95 };
const LIGHTHOUSE_TIDECHART_POS = { x: 1.3, y: 3.41, z: -66.65 };
const LIGHTHOUSE_LAMP_POS = { x: 0, y: 14.1, z: -68 };
const LIGHTHOUSE_BELL_POS = { x: -1.6, y: 14.75, z: -67 };
const LIGHTHOUSE_RAILING_POS = { x: 0, y: 14.15, z: -72.05 };
const BOATHOUSE_BOAT_POS = { x: 32.8, y: 1.05, z: 39.6 };
const CAVE_LOGBOOK_POS = { x: -79.5, y: 1.15, z: -36.8 };
const CAVE_CRATES_POS = { x: -78.6, y: 0.9, z: -31.4 };
const CAVE_LEDGER_PAGE_POS = { x: -78.1, y: 1.12, z: -31.1 };
const CAVE_WALL_MARKS_POS = { x: -64.5, y: 2.1, z: -35.48 };

const ORIGINAL_CLUE_SPOTS = [
  { id: 'logbook', pos: COTTAGE_LOGBOOK_POS, text: "There's more to read in that cottage study — the keeper's own hand, if you look." },
  { id: 'letter', pos: COTTAGE_LETTER_POS, text: "That desk in the cottage had a drawer that wasn't quite shut." },
  { id: 'photograph', pos: COTTAGE_PHOTOGRAPH_POS, text: "There was a photograph on a nightstand in the cottage you didn't look closely at." },
  { id: 'ledger', pos: COTTAGE_CHEST_POS, text: "That chest in the cottage isn't locked anymore.", requiresFlag: FLAGS.CHEST_KEY },
  { id: 'radio', pos: LIGHTHOUSE_RADIO_POS, text: 'The radio in the lighthouse still has something queued up to play.' },
  { id: 'tidechart', pos: LIGHTHOUSE_TIDECHART_POS, text: "That chart on the lighthouse desk had marks that didn't look official." },
  { id: 'brokenlamp', pos: LIGHTHOUSE_LAMP_POS, text: "Something's wrong with the lamp itself, up in the lighthouse." },
  { id: 'bell', pos: LIGHTHOUSE_BELL_POS, text: "There's an old bell in the lighthouse's lamp room worth a closer look." },
  { id: 'boat', pos: BOATHOUSE_BOAT_POS, text: "That boat in the boathouse isn't the one that should be there." },
];

const CAVE_CLUE_SPOTS = [
  // Tightened from "Something in that cave felt like it had been waiting to
  // be read." — every sibling line here names the object, not just a vague
  // "something"; this one didn't, so it read weaker than the rest.
  { id: 'oldrourkelogbook', pos: CAVE_LOGBOOK_POS, text: "There's an old logbook in that cave, half-buried — older than anything else you've found." },
  { id: 'smugglingcache', pos: CAVE_CRATES_POS, text: "Those crates in the cave weren't just sitting there for no reason." },
  { id: 'thirdinitials', pos: CAVE_LEDGER_PAGE_POS, text: "There was a second ledger page in the cave — a name on it you haven't placed yet." },
  { id: 'cavewallmarks', pos: CAVE_WALL_MARKS_POS, text: 'Someone left marks on that cave wall. You should look again.' },
];

function dist(x1, z1, x2, z2) {
  return Math.hypot(x1 - x2, z1 - z2);
}

/** Among unfound, reachable (flag-gated) spots, returns the nearest one itself — or null if none remain. */
function nearestUnfound(spots, journal, playerX, playerZ) {
  let best = null;
  let bestDist = Infinity;
  for (const s of spots) {
    if (journal.hasClue(s.id)) continue;
    if (s.requiresFlag && !journal.hasFlag(s.requiresFlag)) continue;
    const d = dist(playerX, playerZ, s.pos.x, s.pos.z);
    if (d < bestDist) {
      bestDist = d;
      best = s;
    }
  }
  return best;
}

export class HintManager {
  /**
   * @param {Object} ctx
   * @param {number} ctx.chapter
   * @param {import('../journal/JournalManager.js').JournalManager} ctx.journal
   * @param {import('../dialogue/DialogueManager.js').DialogueManager} ctx.dialogue
   * @param {number} ctx.playerX
   * @param {number} ctx.playerZ
   * @param {boolean} [ctx.endingShown]
   * @returns {{pos: {x:number,y:number,z:number}, text: string} | null} the
   *   single most relevant unclaimed objective's exact position and its
   *   in-character line, or null if there's genuinely nothing left to point
   *   toward right now (used by the H-key hint, the HUD arrow, and the
   *   world-space beacon — see getHint() below and Game.js).
   */
  resolveObjective({ chapter, journal, dialogue, playerX, playerZ, endingShown }) {
    if (endingShown) return null;

    if (chapter === 1) {
      const spot = nearestUnfound(ORIGINAL_CLUE_SPOTS, journal, playerX, playerZ);
      if (spot) return { pos: spot.pos, text: spot.text };
      if (!dialogue.hasSpokenTo('mara')) {
        return {
          pos: MARA_POSITION,
          text: "You've seen enough here for now. That boat captain by the boathouse might know more than she's letting on.",
        };
      }
      // foundCount>=5 and Mara spoken already satisfies Chapter 2's unlock —
      // ChapterManager re-checks on every relevant state change, so `chapter`
      // should already read 2 by the time this could be reached. Defensive
      // fallback only.
      return null;
    }

    if (chapter === 2) {
      const originalSpot = nearestUnfound(ORIGINAL_CLUE_SPOTS, journal, playerX, playerZ);
      if (originalSpot) return { pos: originalSpot.pos, text: originalSpot.text };

      if (!journal.hasFlag(FLAGS.CAVE_KEY)) {
        // The cave key comes from the ledger, itself one of ORIGINAL_CLUE_SPOTS
        // (gated on CHEST_KEY) — so the branch above already routes the
        // player there. This only fires if that ever changes.
        return { pos: COTTAGE_CHEST_POS, text: "There's a locked chest in the cottage you haven't gotten into." };
      }
      if (!journal.hasFlag(FLAGS.CAVE_OPENED)) {
        return {
          pos: { x: CAVE.x, y: CAVE.floorY + 1.5, z: CAVE.z },
          text: "That second key doesn't belong to anything in the cottage. There's a grate down past the cliffs, wasn't there.",
        };
      }

      const caveSpot = nearestUnfound(CAVE_CLUE_SPOTS, journal, playerX, playerZ);
      if (caveSpot) return { pos: caveSpot.pos, text: caveSpot.text };

      if (!dialogue.hasSpokenTo('thomas')) {
        return { pos: THOMAS_POSITION, text: "Elias's nephew is at the cottage now. He deserves to know what's happened." };
      }
      // All clues found + both spoken already satisfies Chapter 3's unlock —
      // defensive fallback only, same reasoning as Chapter 1's tail case.
      return null;
    }

    if (chapter === 3) {
      if (!dialogue.hasSpokenTo('mara')) {
        return { pos: MARA_CHAPTER3_POSITION, text: "Mara's here, at the lighthouse. Talk to her before this ends." };
      }
      if (!dialogue.hasSpokenTo('thomas')) {
        return { pos: THOMAS_CHAPTER3_POSITION, text: 'Thomas is here too, at the lighthouse. Talk to him before this ends.' };
      }
      // Both spoken to, everything found — the only thing left is the
      // ending trigger itself, up in the lamp room.
      return { pos: LIGHTHOUSE_RAILING_POS, text: "You know everything you're going to know. Whatever happens next happens at the light." };
    }

    return null;
  }

  /** @returns {string} one short in-character sentence — the H-key hint text. */
  getHint(ctx) {
    if (ctx.endingShown) return ENDING_SHOWN_TEXT;
    return this.resolveObjective(ctx)?.text ?? NOTHING_LEFT;
  }
}
