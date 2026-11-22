import { validateGame } from "./validation.js";

export const LOCAL_SAVE_KEY = "kingbuilder.localGame";

// Storage can be unavailable (private browsing, quota, browser settings).
// Saving must never prevent a move or erase a different tab's newer game.
export class LocalSave {
  constructor(storage = () => globalThis.localStorage) {
    this.storage = storage;
    this.id = null;
  }
  read() {
    try {
      const saved = JSON.parse(this.storage()?.getItem(LOCAL_SAVE_KEY) ?? "null");
      if (saved?.version !== 1 || typeof saved.id !== "string") return null;
      const game = validateGame(saved.game);
      if (game.finished || game.onlineCode) return null;
      return saved;
    } catch { return null; }
  }
  resume() {
    const saved = this.read();
    if (!saved) return null;
    this.id = saved.id;
    return saved.game;
  }
  start() {
    this.id = globalThis.crypto.randomUUID();
  }
  save(game) {
    if (game.onlineCode) return true;
    try {
      const storage = this.storage();
      if (!storage) return false;
      if (game.finished) {
        const saved = JSON.parse(storage.getItem(LOCAL_SAVE_KEY) ?? "null");
        if (saved?.id === this.id) storage.removeItem(LOCAL_SAVE_KEY);
      } else {
        if (!this.id) this.start();
        storage.setItem(LOCAL_SAVE_KEY, JSON.stringify({ version: 1, id: this.id, game }));
      }
      return true;
    } catch { return false; }
  }
}
