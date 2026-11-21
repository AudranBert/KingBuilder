import { UNIT_DEFINITIONS } from "../configuration.js";
import { iconHTML } from "./html.js";
export function piece(kind = "worker", owner = 0) {
  const path = (UNIT_DEFINITIONS[kind] || UNIT_DEFINITIONS.worker).icon;
  return iconHTML(owner === 1 && (kind === "worker" || kind === "soldier") ? path.replace(".svg", "-jade.svg") : path, "wood-piece");
}
