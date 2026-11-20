import { message as sourceMessage } from "../i18n.js";
import { rotatePoint } from "../geometry.js";
import {
  actor,
  RULES,
  key,
  movementPaths,
  move,
  attack,
  attackPaths,
  combatPreview,
  patternAt,
  buildingPattern,
  transformed,
  buildError,
  exploreError,
  buyTerrainError,
  openingError,
  workerAssignmentError,
  BUILDINGS,
} from "../engine.js";

export function placementErrorText(error) {
  const terrain = error.match(/terrain incompatible, il faut (.*?) à la place de /);
  if (terrain) return sourceMessage("messages.cannotPlaceRequiresHere", [terrain[1]]);
  const adjacency = Object.values(BUILDINGS).find(b =>
    b.adjacency?.length && error === `${b.name} : ${b.pattern}`);
  if (adjacency?.adjacency.every(rule => rule.terrain === "field" && rule.owned && rule.range === "edge"))
    return sourceMessage("messages.cannotPlaceTheEntranceMustTouchOne");
  const short = {
    [sourceMessage("messages.thePatternMustFitOnEmptySpaces")]: sourceMessage("messages.theTileMustFitOnEmptySpaces"),
    [sourceMessage("messages.yourBuildingExplorationActionIsAlreadyComplete")]: sourceMessage("messages.thisUnitHasAlreadyActed"),
    [sourceMessage("messages.thisUnitHasAlreadyCompletedItsAction")]: sourceMessage("messages.thisUnitHasAlreadyActed"),
    [sourceMessage("messages.allSpacesInThePatternMustBe")]: sourceMessage("messages.exploreAllSpacesInThePattern"),
    [sourceMessage("messages.thePatternOverlapsABuildingSpaceOr")]: sourceMessage("messages.aBuildingOrFieldOccupiesThePattern"),
    [sourceMessage("messages.thePatternExtendsBeyondTheBoard")]: sourceMessage("messages.theTileExtendsBeyondTheBoard"),
    [sourceMessage("messages.chooseYourOwnProductionBuilding")]: sourceMessage("messages.chooseOneOfYourProductionBuildings"),
  };
  const message = short[error] || error.replace(/^(Impossible|Erreur)\s*:\s*/i, "");
  return sourceMessage("messages.cannotPlace", [message.charAt(0).toLowerCase() + message.slice(1)]);
}
export function placementGuidance(g, placement) {
  const results = new Map();
  if (placement?.kind === 'worker') {
    for (const [position, cell] of Object.entries(g.board)) {
      if (cell.building?.owner !== g.active || !BUILDINGS[cell.building.type].produces) continue;
      const [x, y] = position.split(',').map(Number);
      results.set(position, dragPreview(g, placement, { x, y }));
    }
    return results;
  }
  if (!placement || !["terrain", "building", "single-terrain"].includes(placement.kind)) return results;
  for (let y = 0; y < (g.boardSize ?? RULES.size); y++)
    for (let x = 0; x < (g.boardSize ?? RULES.size); x++)
      results.set(key(x, y), dragPreview(g, placement, { x, y }));
  return results;
}
export function dragFromCard(card, ui) {
  const data = card.dataset;
  if (data.unitDrag !== undefined)
    return {
      kind: "unit",
      id: data.unitDrag === "" ? null : Number(data.unitDrag),
    };
  if (data.workerDrag !== undefined)
    return { kind: "worker", id: Number(data.workerDrag) };
  if (data.singleTerrain !== undefined)
    return { kind: "single-terrain", terrain: data.singleTerrain };
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
  const { x, y } = placementOrigin(g, drag, pos);
  if (drag.kind === "unit") {
    const combat = attackPaths(g).get(key(x,y));
    if (combat) {
      const preview = combatPreview(g,x,y);
      return { cells: [...combat,pos], error: null, combat: preview };
    }
    const path = movementPaths(g).get(key(x, y));
    return {
      cells: path || [pos],
      error: path ? null : sourceMessage("messages.thisSpaceIsUnreachable"),
    };
  }
  if (drag.kind === "worker")
    return { cells: [pos], error: workerAssignmentError(g, drag.id, x, y) };
  if (drag.kind === "building")
    return {
      cells: patternAt(g.buildingMarket[drag.index], x, y, drag.rotation),
      error: buildError(g, drag.index, x, y, drag.rotation, {
        allowGold: true,
      }),
    };
  if (drag.kind === "single-terrain")
    return { cells: [{ x, y }], error: buyTerrainError(g, drag.terrain, x, y) };
  return {
    cells: transformed(g.opening ? g.opening.tiles[drag.index] : g.tileMarket[drag.index], drag.rotation).map((c) => ({
      ...c,
      x: c.x + x,
      y: c.y + y,
    })),
    error: g.opening ? openingError(g, drag.index, x, y, drag.rotation)
      : exploreError(g, drag.index, x, y, drag.rotation),
  };
}
// Keep the same occupied central cell under the pointer through every orientation.
// Only UI coordinates change: engine commands and saved building anchors stay intact.
export function placementOrigin(g, placement, pos) {
  const cells = placement?.kind === "building"
    ? buildingPattern(g.buildingMarket[placement.index])
    : placement?.kind === "terrain"
      ? transformed((g.opening ? g.opening.tiles : g.tileMarket)[placement.index])
      : [];
  if (!cells.length) return pos;
  const sumX = cells.reduce((sum, c) => sum + c.x, 0);
  const sumY = cells.reduce((sum, c) => sum + c.y, 0);
  const distance = c => (c.x * cells.length - sumX) ** 2 + (c.y * cells.length - sumY) ** 2;
  const center = cells.reduce((best, c) => distance(c) < distance(best) ? c : best);
  const offset = rotatePoint(center.x, center.y, placement.rotation);
  return { x: pos.x - offset.x, y: pos.y - offset.y };
}
export function moveUnitTo(g, x, y) {
  const unit = actor(g);
  if (unit.x === x && unit.y === y) return;
  const combat = attackPaths(g).get(key(x,y));
  const path = combat || movementPaths(g).get(key(x, y));
  if (!path) throw Error(sourceMessage("messages.thisSpaceIsUnreachableForThisUnit"));
  for (const step of path) move(g, step.x, step.y);
  if (combat) attack(g,x,y);
}
