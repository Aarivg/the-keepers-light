// Talks to the backend's /api/dialogue endpoint and keeps per-NPC
// conversation history in memory for the session (mirrors JournalManager's
// "in-memory for now" persistence choice from Phase 2).
//
// The Anthropic API key never touches this file, or any browser code — the
// backend (server/) is the only thing that holds it.

const API_BASE = import.meta.env.VITE_DIALOGUE_API_URL || 'http://localhost:8787';

export class DialogueManager {
  constructor(journal) {
    this.journal = journal;
    this._history = new Map(); // npcId -> [{role, text}]
    this._spokenTo = new Set();
  }

  getHistory(npcId) {
    if (!this._history.has(npcId)) this._history.set(npcId, []);
    return this._history.get(npcId);
  }

  hasSpokenTo(npcId) {
    return this._spokenTo.has(npcId);
  }

  /** Every NPC id that's had at least one exchange — used by the ending summary. */
  get spokenToIds() {
    return [...this._spokenTo];
  }

  /** Last reply from an NPC, for the ending summary. Null if never spoken to. */
  lastReply(npcId) {
    const history = this._history.get(npcId);
    if (!history) return null;
    for (let i = history.length - 1; i >= 0; i--) {
      if (history[i].role === 'assistant') return history[i].text;
    }
    return null;
  }

  /**
   * @param {string} npcId
   * @param {{type: 'freeText', text: string} | {type: 'presentEvidence', clueId: string}} action
   * @returns {Promise<{reply: string, fellBack: boolean}>}
   */
  async send(npcId, action) {
    const history = this.getHistory(npcId);

    const journalPayload = {
      foundClueIds: this.journal.entries.map((e) => e.id),
      tags: Object.fromEntries(this.journal.entries.map((e) => [e.id, e.tag])),
    };

    let response;
    try {
      const res = await fetch(`${API_BASE}/api/dialogue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ npcId, history, journal: journalPayload, action }),
      });
      response = await res.json();
    } catch (err) {
      console.error('[dialogue] request failed:', err);
      response = { reply: NPC_OFFLINE_BRUSH_OFF, fellBack: true };
    }

    const userTurnText =
      action.type === 'freeText' ? action.text : `[presented evidence: ${action.clueId}]`;
    history.push({ role: 'user', text: userTurnText });
    history.push({ role: 'assistant', text: response.reply });
    this._spokenTo.add(npcId);

    return response;
  }
}

const NPC_OFFLINE_BRUSH_OFF =
  '"...Not now." They turn away. (The dialogue server may not be running — see the README.)';
