export function createUIState() {
  return {
    selected: null,
    mode: "move",
    rotation: 0,
    buildingRotation: 0,
    drag: null,
    placement: null,
  };
}
