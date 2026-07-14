// Calls Claude Fable 5 for one NPC dialogue turn. Keeps the model-specific
// quirks (always-on thinking, refusal handling, server-side fallback) in one
// place so index.js just calls generateReply() and gets back either a reply
// string or null (meaning "fall back to the in-character brush-off").

import Anthropic from '@anthropic-ai/sdk';
import { buildSystemPrompt } from './npcs.js';

const client = new Anthropic(); // reads ANTHROPIC_API_KEY from the environment

const MODEL = 'claude-fable-5';
const MAX_TOKENS = 1024;

function toApiMessages(history) {
  // history is [{role: 'user'|'assistant', text: string}, ...]; the API
  // wants plain user/assistant turns with no system role mixed in.
  return history.map((turn) => ({
    role: turn.role === 'assistant' ? 'assistant' : 'user',
    content: turn.text,
  }));
}

function buildUserTurnContent(action) {
  if (action.type === 'presentEvidence') {
    return `[PRESENTING EVIDENCE: "${action.clue.shortDescription}"]\n${action.clue.content}`;
  }
  return action.text;
}

/** Pulls the visible reply out of a response, ignoring thinking/fallback marker blocks. */
function extractReplyText(response) {
  const text = response.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
    .trim();
  return text.length > 0 ? text : null;
}

async function callOnce(npcId, journalState, isFirstMessage, apiMessages) {
  const system = buildSystemPrompt(npcId, journalState, isFirstMessage);

  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system,
    messages: apiMessages,
    betas: ['server-side-fallback-2026-06-01'],
    fallbacks: [{ model: 'claude-opus-4-8' }],
  });

  if (response.stop_reason === 'refusal') {
    return { ok: false, reason: 'refusal' };
  }

  const text = extractReplyText(response);
  if (!text) {
    return { ok: false, reason: 'malformed' };
  }

  return { ok: true, text };
}

/**
 * @param {Object} opts
 * @param {string} opts.npcId
 * @param {{role: 'user'|'assistant', text: string}[]} opts.history - prior turns, not including this one
 * @param {{type: 'freeText', text: string} | {type: 'presentEvidence', clue: object}} opts.action
 * @param {{foundClueIds: string[]}} opts.journalState
 * @returns {Promise<string|null>} the reply text, or null if every attempt failed
 *   (caller should show the NPC's in-character brush-off in that case).
 */
export async function generateReply({ npcId, history, action, journalState }) {
  const isFirstMessage = history.length === 0;
  const apiMessages = [
    ...toApiMessages(history),
    { role: 'user', content: buildUserTurnContent(action) },
  ];

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const result = await callOnce(npcId, journalState, isFirstMessage, apiMessages);
      if (result.ok) return result.text;
      // Malformed output gets one retry; a refusal is not retried (retrying
      // the identical request is very unlikely to change a policy decline).
      if (result.reason === 'refusal') return null;
      console.warn(`[dialogue] malformed output from ${npcId}, attempt ${attempt + 1}`);
    } catch (err) {
      console.error(`[dialogue] API call failed for ${npcId}:`, err?.message ?? err);
      return null;
    }
  }
  return null;
}
