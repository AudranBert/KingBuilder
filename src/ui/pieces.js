import { UNIT_DEFINITIONS } from "../configuration.js";
import { iconHTML } from "./html.js";
export function piece(kind = "worker") {
  return iconHTML((UNIT_DEFINITIONS[kind] || UNIT_DEFINITIONS.worker).icon, "wood-piece");
}
