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

import { COTTAGE, LIGHTHOUSE, BOATHOUSE, CAVE } from '../world/layout.js';
import { FLAGS } from '../journal/flags.js';

const NOTHING_LEFT = "You've learned all you can here for now.";

const ORIGINAL_CLUE_SPOTS = [
  { id: 'logbook', pos: COTTAGE, text: "There's more to read in that cottage study — the keeper's own hand, if you look." },
  { id: 'letter', pos: COTTAGE, text: "That desk in the cottage had a drawer that wasn't quite shut." },
  { id: 'photograph', pos: COTTAGE, text: "There was a photograph on a nightstand in the cottage you didn't look closely at." },
  { id: 'ledger', pos: COTTAGE, text: "That chest in the cottage isn't locked anymore.", requiresFlag: FLAGS.CHEST_KEY },
  { id: 'radio', pos: LIGHTHOUSE, text: 'The radio in the lighthouse still has something queued up to play.' },
  { id: 'tidechart', pos: LIGHTHOUSE, text: "That chart on the lighthouse desk had marks that didn't look official." },
  { id: 'brokenlamp', pos: LIGHTHOUSE, text: "Something's wrong with the lamp itself, up in the lighthouse." },
  { id: 'bell', pos: LIGHTHOUSE, text: "There's an old bell in the lighthouse's lamp room worth a closer look." },
  { id: 'boat', pos: BOATHOUSE, text: "That boat in the boathouse isn't the one that should be there." },
];

const CAVE_CLUE_SPOTS = [
  { id: 'oldrourkelogbook', pos: CAVE, text: 'Something in that cave felt like it had been waiting to be read.' },
  { id: 'smugglingcache', pos: CAVE, text: "Those crates in the cave weren't just sitting there for no reason." },
  { id: 'thirdinitials', pos: CAVE, text: "There was a second ledger page in the cave — a name on it you haven't placed yet." },
  { id: 'cavewallmarks', pos: CAVE, text: 'Someone left marks on that cave wall. You should look again.' },
];

function dist(x1, z1, x2, z2) {
  return Math.hypot(x1 - x2, z1 - z2);
}

/** Among unfound, reachable (flag-gated) spots, returns the nearest one's line — or null if none remain. */
function nearestUnfoundLine(spots, journal, playerX, playerZ) {
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
  return best?.text ?? null;
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
   * @returns {string} one short in-character sentence
   */
  getHint({ chapter, journal, dialogue, playerX, playerZ, endingShown }) {
    if (endingShown) return "There's nothing left here for you now.";

    if (chapter === 1) {
      const clueHint = nearestUnfoundLine(ORIGINAL_CLUE_SPOTS, journal, playerX, playerZ);
      if (clueHint) return clueHint;
      if (!dialogue.hasSpokenTo('mara')) {
        return "You've seen enough here for now. That boat captain by the boathouse might know more than she's letting on.";
      }
      // foundCount>=5 and Mara spoken already satisfies Chapter 2's unlock —
      // ChapterManager re-checks on every relevant state change, so `chapter`
      // should already read 2 by the time this could be reached. Defensive
      // fallback only.
      return NOTHING_LEFT;
    }

    if (chapter === 2) {
      const originalHint = nearestUnfoundLine(ORIGINAL_CLUE_SPOTS, journal, playerX, playerZ);
      if (originalHint) return originalHint;

      if (!journal.hasFlag(FLAGS.CAVE_KEY)) {
        // The cave key comes from the ledger, itself one of ORIGINAL_CLUE_SPOTS
        // (gated on CHEST_KEY) — so the branch above already routes the
        // player there. This only fires if that ever changes.
        return "There's a locked chest in the cottage you haven't gotten into.";
      }
      if (!journal.hasFlag(FLAGS.CAVE_OPENED)) {
        return "That second key doesn't belong to anything in the cottage. There's a grate down past the cliffs, wasn't there.";
      }

      const caveHint = nearestUnfoundLine(CAVE_CLUE_SPOTS, journal, playerX, playerZ);
      if (caveHint) return caveHint;

      if (!dialogue.hasSpokenTo('thomas')) {
        return "Elias's nephew is at the cottage now. He deserves to know what's happened.";
      }
      // All clues found + both spoken already satisfies Chapter 3's unlock —
      // defensive fallback only, same reasoning as Chapter 1's tail case.
      return NOTHING_LEFT;
    }

    if (chapter === 3) {
      if (!dialogue.hasSpokenTo('mara')) return "Mara's here, at the lighthouse. Talk to her before this ends.";
      if (!dialogue.hasSpokenTo('thomas')) return 'Thomas is here too, at the lighthouse. Talk to him before this ends.';
      return "You know everything you're going to know. Whatever happens next happens at the light.";
    }

    return NOTHING_LEFT;
  }
}
