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
