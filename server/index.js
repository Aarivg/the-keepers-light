import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { NPCS } from './npcs.js';
import { generateReply } from './dialogue.js';
import { CLUE_LIST } from '../src/journal/clues.js';

const CLUE_BY_ID = new Map(CLUE_LIST.map((c) => [c.id, c]));

const app = express();
app.use(cors());
app.use(express.json({ limit: '256kb' }));

const HISTORY_TURN_LIMIT = 40; // generous cap; conversations are short in practice

function isValidHistory(history) {
  return (
    Array.isArray(history) &&
    history.length <= HISTORY_TURN_LIMIT &&
    history.every(
      (turn) =>
        turn &&
        (turn.role === 'user' || turn.role === 'assistant') &&
        typeof turn.text === 'string'
    )
  );
}

function isValidAction(action, journalState) {
  if (!action || typeof action !== 'object') return false;
  if (action.type === 'freeText') {
    return typeof action.text === 'string' && action.text.trim().length > 0 && action.text.length <= 2000;
  }
  if (action.type === 'presentEvidence') {
    // Only allow presenting clues the player has actually found — the
    // client is expected to only offer these, but the server is the trust
    // boundary and must not take clue content from the request body.
    return typeof action.clueId === 'string' && journalState.foundClueIds?.includes(action.clueId);
  }
  return false;
}

app.post('/api/dialogue', async (req, res) => {
  const { npcId, history, journal, action } = req.body ?? {};

  if (!NPCS[npcId]) {
    return res.status(400).json({ error: 'Unknown npcId' });
  }
  const journalState = {
    foundClueIds: Array.isArray(journal?.foundClueIds) ? journal.foundClueIds.filter((id) => typeof id === 'string') : [],
    // Theory-board tags aren't currently used to gate any NPC reveal — the
    // brief's dialogue-gating rules key off found clues only — but they're
    // part of "the player's current journal state" the frontend sends, and
    // the ending summary (built client-side) is where they actually matter.
    tags: journal?.tags && typeof journal.tags === 'object' ? journal.tags : {},
  };
  if (!isValidHistory(history)) {
    return res.status(400).json({ error: 'Invalid history' });
  }
  if (!isValidAction(action, journalState)) {
    return res.status(400).json({ error: 'Invalid action' });
  }

  // Resolve a presentEvidence action's clue server-side from the shared
  // clue data rather than trusting any clue content the client might send.
  let resolvedAction = action;
  if (action.type === 'presentEvidence') {
    const clue = CLUE_BY_ID.get(action.clueId);
    if (!clue) return res.status(400).json({ error: 'Unknown clueId' });
    resolvedAction = { type: 'presentEvidence', clue };
  }

  const reply = await generateReply({
    npcId,
    history,
    action: resolvedAction,
    journalState,
  });

  if (reply === null) {
    return res.json({ reply: NPCS[npcId].brushOff, fellBack: true });
  }
  return res.json({ reply, fellBack: false });
});

app.get('/api/health', (_req, res) => res.json({ ok: true }));

const port = process.env.PORT || 8787;
app.listen(port, () => {
  console.log(`The Keeper's Light dialogue server listening on http://localhost:${port}`);
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn(
      'WARNING: ANTHROPIC_API_KEY is not set. Copy server/.env.example to server/.env and add your key — until then, every NPC conversation will fall back to the in-character brush-off.'
    );
  }
});
