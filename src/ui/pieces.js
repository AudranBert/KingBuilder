import { UNIT_DEFINITIONS } from "../configuration.js";
import { iconHTML } from "./html.js";
export const playerColor = owner => ["amber", "jade", "sapphire", "ruby"][owner] || "neutral";
export function piece(kind = "worker", owner = 0) {
  const path = (UNIT_DEFINITIONS[kind] || UNIT_DEFINITIONS.worker).icon;
  return iconHTML(owner >= 1 && owner <= 3 && (kind === "worker" || kind === "soldier") ? path.replace(".svg", `-${playerColor(owner)}.svg`) : path, "wood-piece");
}
