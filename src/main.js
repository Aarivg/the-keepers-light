import './ui/ui.css';
import { Game } from './core/Game.js';

const game = new Game();
game.start();

// Debug hook for manual inspection in the console / automated smoke tests —
// harmless in production, doesn't affect gameplay.
window.__KEEPERS_LIGHT__ = game;
