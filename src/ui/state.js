export function createUIState() {
  return {
    selected: null,
    unitSelection: null,
    mode: "move",
    rotation: 0,
    buildingRotation: 0,
    drag: null,
    placement: null,
  };
}

export function hasSelectedUnit(game, ui) {
  const selection = ui.unitSelection;
  if (!selection || game.opening || game.finished || ui.mode === 'inspect') return false;
  if (selection.owner !== game.active || selection.round !== game.round || selection.id !== game.selectedUnitId) return false;
  return selection.id === null || game.players[game.active].units.some(unit => unit.id === selection.id);
}

// Clearing placement alone preserves the chosen unit; other exits clear both.
export function clearSelection(game, ui, { unit = true } = {}) {
  ui.selected = null;
  ui.placement = null;
  ui.drag = null;
  if (unit) {
    ui.unitSelection = null;
    if (game) {
      game.selectedUnitId = null;
      game.armySelection = null;
    }
  }
}
