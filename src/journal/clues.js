// Single source of truth for the mystery's text content. Building modules
// (world/buildings/*.js) only decide WHERE a clue physically sits — the
// WHAT lives here, so the two never drift out of sync and so the whole
// mystery can be read/edited/balanced in one place.
//
// Every entry here must stay readable under BOTH of the game's two framings
// (a grounded smuggling-and-inheritance story, and an uncanny "the light
// calls its keepers" story) without confirming either. See README for the
// full authoring note. If you add a clue, do not let it tip the balance —
// pair anything eerie with a mundane-enough explanation, and vice versa.

export const CLUES = {
  LOGBOOK: {
    id: 'logbook',
    shortDescription: "Elias's logbook — the final weeks",
    promptLabel: "Examine the keeper's logbook",
    content: [
      "Most pages are routine — weather, oil levels, gull counts, notes on the tide. But the last two weeks read differently.",
      '',
      'Ten days ago: "Slept badly. Something in the lamp room — a feeling, like being watched from below, though there\'s nothing below but stairs."',
      '',
      'Six days ago: "The feeling again tonight. Rina used to say the light had a mind of its own. I never believed her. I\'m starting to."',
      '',
      'Three nights ago, the final entry — harder to read, the hand less steady, a few words lost to a water stain:',
      '',
      '"The light doesn\'t need me anymore. I understand now. I\'m going up."',
      '',
      'Nothing after.',
    ].join('\n'),
  },

  LEDGER: {
    id: 'ledger',
    shortDescription: 'A second, private ledger',
    promptLabel: 'Examine the hidden ledger',
    content: [
      "Tucked beneath where the logbook usually sits is a smaller book, bound in plain leather — not the lighthouse's official record. A private one.",
      '',
      'Column after column: a date, a cash amount, and two initials — "M.K." — repeated for months.',
      '',
      'No cargo manifest. No explanation of what the money was for. The most recent entry is dated four days before he disappeared.',
      '',
      "Wedged into the binding, a second key — smaller than the one that opened this chest, and not shaped for any lock in the cottage. Whatever it opens, it isn't here.",
    ].join('\n'),
  },

  BELL: {
    id: 'bell',
    shortDescription: "An old ship's bell",
    promptLabel: 'Examine the brass bell',
    content: [
      'Green with age, hung from a bracket that looks older than the lamp room around it. An inscription, worn nearly smooth:',
      '',
      '"...TO THE ONE WHO ANSWERS THE LIGHT, THE SEA GIVES ONE WARNING AND NO MORE..."',
      '',
      "The rest has corroded away. It doesn't look like it's been rung in a long time — or perhaps it rings, and no one hears it from the water.",
    ].join('\n'),
  },

  PHOTOGRAPH: {
    id: 'photograph',
    shortDescription: 'A photograph, and another behind it',
    promptLabel: 'Examine the photograph',
    content: [
      'Elias and a woman — younger, laughing, the wind pulling her hair sideways — standing on this same dock. No date on the back, just "R. & E." in pencil.',
      '',
      "Behind it, tucked into the frame, a second photograph — newer, the paper less faded. Elias alone, older, standing in the exact spot where she stood in the first one. No one else took this picture. He must have set it up himself, and waited for the timer.",
      '',
      'Something small and metal slides out from behind the frame as you move it — a key.',
    ].join('\n'),
  },

  BROKEN_LAMP: {
    id: 'brokenlamp',
    shortDescription: 'The shattered lamp bulb',
    promptLabel: 'Examine the broken lamp',
    content: [
      'The great bulb at the heart of the lens is broken — but wrong. The glass has burst outward, scattered across the platform in a wide ring, as if something inside pushed its way out.',
      '',
      "There's no corresponding damage to the housing or the lens from the outside. No stone, no impact, nothing that explains it from that direction.",
    ].join('\n'),
  },

  BOAT: {
    id: 'boat',
    shortDescription: "The boat that shouldn't be here",
    promptLabel: 'Examine the boat',
    content: [
      "Elias's own boat — the one he used every week for supply runs — is gone, along with its mooring line. In its place, tied where it doesn't belong, sits a smaller boat that isn't his.",
      '',
      'Fresh scrapes score one side, deep enough to be recent. Drag marks scar the boathouse floor, running not toward the usual launch rails but off at an angle, straight for the water — as if it was pulled out in a hurry, by someone who didn\'t know or didn\'t care how it was normally done.',
    ].join('\n'),
  },

  RADIO: {
    id: 'radio',
    shortDescription: 'The last transmission',
    promptLabel: 'Play the last radio transmission',
    content: [
      'The dial is still set to the mainland weather frequency. A label taped beside it, in Elias\'s hand: "PLAY LAST — DO NOT ERASE."',
      '',
      '[PLAYBACK — mostly storm static]',
      '',
      '"...conditions holding, wind out of the nor\'east, nothing to report—"',
      '',
      'A pause. Something changes in his voice.',
      '',
      '"—the light, it\'s calling h—"',
      '',
      'Static. Then nothing. No sign-off. No one has erased it.',
    ].join('\n'),
  },

  LETTER: {
    id: 'letter',
    shortDescription: 'An unfinished letter to Thomas',
    promptLabel: 'Examine the unsent letter',
    content: [
      'Half a page, in Elias\'s hand, addressed to his nephew:',
      '',
      '"Thomas — I\'ve been turning it over and I think it\'s time. I\'m tired in a way sleep doesn\'t fix. I want to talk to you about signing the deed over — the lighthouse, the cottage, all of it — before something happens that makes the decision for me. I need to get off this rock before it takes me too, one way or another.',
      '',
      'I don\'t know how to say the rest of it yet. I\'ll try again tomorrow."',
      '',
      "There's no \"tomorrow\" entry. The letter was never finished, never sent.",
    ].join('\n'),
  },

  TIDE_CHART: {
    id: 'tidechart',
    shortDescription: 'A tide chart, strangely marked',
    promptLabel: 'Examine the tide chart',
    content: [
      "A standard nautical chart of the shoals north of the island — but someone has added their own marks in pencil, dozens of small x's clustered along one narrow, unmarked channel through the rocks.",
      '',
      "Dates are noted beside some of the x's, always a night or two either side of a new moon, when the water would be darkest. The handwriting matches the logbook.",
      '',
      "Whether the marks were made to keep a boat safe, or to keep track of something else entirely, the chart doesn't say.",
    ].join('\n'),
  },
  // ---------------- Chapter 2: Deeper Waters (the sea cave) ----------------
  // Same discipline as above, raised stakes: these four should deepen both
  // readings and introduce one genuinely unresolved thread, not tip the
  // balance toward either. Re-read against README's authoring note before
  // editing.

  OLD_ROURKE_LOGBOOK: {
    id: 'oldrourkelogbook',
    shortDescription: "Old Rourke's own logbook — decades old",
    promptLabel: 'Examine the weathered logbook',
    content: [
      "The leather's cracked and soft with damp, the ink gone the color of rust in places — but the handwriting is careful, older than Elias's by decades.",
      '',
      'Most of it is unremarkable: storm damage, a broken davit, three weeks with no supply boat one winter. Whoever kept this record was thorough about the ordinary things.',
      '',
      'The last five entries are different. "The lamp doesn\'t need my hand on it some nights. It knows the rhythm better than I do now." Then, two nights later: "I keep hearing my name from the gallery when I know I\'m alone in the tower." The final entry, dated some six weeks before it simply stops: "I understand now why they never found the last one either. The light doesn\'t need me anymore."',
      '',
      "There's no name signed anywhere in the book. But the bell upstairs, and what's left of its inscription, make a guess easy enough.",
    ].join('\n'),
  },

  SMUGGLING_CACHE: {
    id: 'smugglingcache',
    shortDescription: 'A hidden cache of unmarked crates',
    promptLabel: 'Examine the crates',
    content: [
      "Stacked three deep against the back wall, half-covered by a tarp gone stiff with salt: a dozen crates and barrels, no shipping company markings, no customs stamps — the same absence of paperwork as the ledger in the cottage.",
      '',
      "But these aren't all the same age. Some of the wood is recent, pale where it's been handled. Other crates underneath are grayed and split, the rope binding them rotted through. A faded stencil on one of the oldest — mostly illegible — might be a date. If it is, it's from years before Elias ever took over the light.",
      '',
      "Whatever this arrangement was, it didn't start with him. Whether he inherited it, stumbled onto it, or started his own version of something older, nothing here says which.",
    ].join('\n'),
  },

  THIRD_INITIALS: {
    id: 'thirdinitials',
    shortDescription: 'A second ledger page, water-stained',
    promptLabel: 'Examine the loose ledger page',
    content: [
      "Tucked between two crates, folded small and gone soft with damp: a single page, torn from a book. The handwriting matches the hidden ledger from the cottage — same columns, same terse shorthand for dates and amounts.",
      '',
      'But the initials repeated down this page aren\'t "M.K." They\'re "T.H." — three letters, appearing a dozen times over what looks like a much longer span than the M.K. entries, going back further than Elias\'s tenure at the light.',
      '',
      "No name in the cottage, on the boat, or on the island so far matches. Whoever T.H. was — or is — this page doesn't say, and nothing else found yet explains it.",
    ].join('\n'),
  },

  CAVE_WALL_MARKS: {
    id: 'cavewallmarks',
    shortDescription: 'Marks scratched into the cave wall',
    promptLabel: 'Examine the marks on the wall',
    content: [
      "Deep gouges in the rock near the tunnel mouth, too regular to be natural — tally marks, dozens of them, grouped in fives, running the length of an arm's reach before stopping abruptly.",
      '',
      "Beneath them, a name was started and then scored through so hard it gouged the stone; only a few letters are legible before the rest is destroyed, deliberately, by whoever held the blade.",
      '',
      "Sailors mark tallies for all kinds of reasons — trips made, nights waited out, cargo counted. It could be exactly that. It could also be someone counting something else, and changing their mind partway through about wanting their name attached to it.",
    ].join('\n'),
  },
};

export const CLUE_LIST = Object.values(CLUES);

// Derived, not hardcoded — adding a clue above automatically raises the
// "found everything" bar the ending trigger checks against.
export const TOTAL_CLUE_COUNT = CLUE_LIST.length;
