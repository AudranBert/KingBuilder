import { TERRAINS } from "../configuration.js";
export function createUIState() {
  return {
    selected: null,
    exploreTarget: null,
    mode: "move",
    tileIndex: 0,
    buildingIndex: null,
    rotation: 0,
    buildingRotation: 0,
    anchor: 0,
  };
}
export function entryIndex(tile) {
  return tile?.cells.length ? 0 : -1;
}
export function normalizeUI(game, ui) {
  ui.tileIndex = game.tileMarket.length
    ? Math.min(Math.max(ui.tileIndex ?? 0, 0), game.tileMarket.length - 1)
    : null;
  if (ui.buildingIndex !== null && !game.buildingMarket[ui.buildingIndex])
    ui.buildingIndex = null;
  const tile = game.tileMarket[ui.tileIndex];
  if (!tile || !tile.cells[ui.anchor])
    ui.anchor = Math.max(0, entryIndex(tile));
  return ui;
}
export function cancelPlacement(ui) {
  ui.buildingIndex = null;
  ui.exploreTarget = null;
}
