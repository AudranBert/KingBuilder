import {
  actor,
  key,
  movementPaths,
  move,
  patternAt,
  transformed,
  buildError,
  exploreError,
  workerAssignmentError,
} from "../engine.js";
export function dragFromCard(card, ui) {
  const data = card.dataset;
  if (data.unitDrag !== undefined)
    return {
      kind: "unit",
      id: data.unitDrag === "" ? null : Number(data.unitDrag),
    };
  if (data.workerDrag !== undefined)
    return { kind: "worker", id: Number(data.workerDrag) };
  return data.tile !== undefined
    ? { kind: "terrain", index: Number(data.tile), rotation: ui.rotation }
    : {
        kind: "building",
        index: Number(data.building),
        rotation: ui.buildingRotation,
      };
}
export function dragPreview(g, drag, pos) {
  if (!drag || !pos) return null;
  const { x, y } = pos;
  if (drag.kind === "unit") {
    const path = movementPaths(g).get(key(x, y));
    return {
      cells: path || [pos],
      error: path ? null : "Cette case est inaccessible.",
    };
  }
  if (drag.kind === "worker")
    return { cells: [pos], error: workerAssignmentError(g, drag.id, x, y) };
  if (drag.kind === "building")
    return {
      cells: patternAt(g.buildingMarket[drag.index], x, y, drag.rotation),
      error: buildError(g, drag.index, x, y, drag.rotation, {
        allowPrestige: true,
      }),
    };
  return {
    cells: transformed(g.tileMarket[drag.index], drag.rotation).map((c) => ({
      ...c,
      x: c.x + x,
      y: c.y + y,
    })),
    error: exploreError(g, drag.index, x, y, drag.rotation),
  };
}
export function moveUnitTo(g, x, y) {
  const unit = actor(g);
  if (unit.x === x && unit.y === y) return;
  const path = movementPaths(g).get(key(x, y));
  if (!path) throw Error("Cette case est inaccessible pour cette unité.");
  for (const step of path) move(g, step.x, step.y);
}
