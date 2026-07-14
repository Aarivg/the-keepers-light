// Small shared helper so every building module registers placeholder
// interactions the same way. Phase 2 replaces the `message` string with real
// clue/journal content — everything else (registry, raycast, prompt) stays.

export function registerExamine(interactionSystem, uiManager, object, label, message) {
  interactionSystem.register(object, {
    label,
    onInteract: () => {
      console.log(`[interact] ${label}: ${message}`);
      uiManager.showFeedback(message);
    },
  });
}
