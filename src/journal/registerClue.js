// Journal-aware counterpart to interaction/registerExamine.js. Use this for
// the real mystery clues (tracked in the journal + theory board); keep
// plain registerExamine for ambient flavor objects that shouldn't clutter
// the journal.
//
// Phase 3 will likely want to hook dialogue/NPC reactions off clue
// discovery too — `onFirstFound` is the extension point for that (it
// already carries the side-effect for "finding the photograph unlocks the
// chest").

/**
 * @param {Object} opts
 * @param {() => boolean} [opts.isLocked] - if it returns true, interacting
 *   just shows `lockedMessage` and never touches the journal.
 * @param {string} [opts.lockedMessage]
 * @param {string} [opts.lockedLabel] - world prompt shown while locked (e.g.
 *   "Examine the locked chest"); defaults to the clue's normal promptLabel,
 *   but a locked container should generally override this — it's how the
 *   player learns anything is even there before it's open.
 * @param {(journal) => void} [opts.onFirstFound] - side effect run only the
 *   moment this clue is newly added (e.g. journal.setFlag(...)).
 * @param {() => void} [opts.onEveryInteract] - runs on every successful
 *   (unlocked) interaction, first time or not — e.g. replaying the radio's
 *   static burst each time it's examined.
 */
export function registerClue(interactionSystem, uiManager, journal, object, clue, opts = {}) {
  const { isLocked, lockedMessage, lockedLabel, onFirstFound, onEveryInteract } = opts;

  interactionSystem.register(object, {
    label: () => (isLocked?.() ? lockedLabel ?? clue.promptLabel : clue.promptLabel),
    onInteract: () => {
      if (isLocked?.()) {
        uiManager.showFeedback(lockedMessage ?? 'It\'s locked.');
        return;
      }

      onEveryInteract?.();

      const isNew = journal.addClue(clue);
      if (isNew) {
        onFirstFound?.(journal);
        uiManager.showFeedback(`Journal updated: ${clue.shortDescription}`);
      } else {
        uiManager.showFeedback('Already in your journal — press J to review.');
      }
    },
  });
}
