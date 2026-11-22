import { ruleIssueText, ruleIssue } from "../rule-errors.js";
import { message as sourceMessage, t, definitionText } from "../i18n.js";
import { rotatePoint } from "../geometry.js";
import {
  actor,
  RULES,
  key,
  movementPaths,
  attackPaths,
  combatPreview,
  patternAt,
  buildingPattern,
  transformed,
  buildIssue,
  exploreIssue,
  buyTerrainIssue,
  openingIssue,
  TERRAINS,
} from "../engine.js";

export function placementErrorText(issue, localized = false) {
  const textFor = localized ? t : sourceMessage;
  if (issue?.code === "terrainMismatch") return textFor("messages.cannotPlaceRequiresHere", [
    issue.required.map(id => (localized ? definitionText("terrains", TERRAINS[id]) : TERRAINS[id].name).toLowerCase()).join(textFor("messages.or")),
  ]);
  const short = {
    thePatternMustFitOnEmptySpaces: "theTileMustFitOnEmptySpaces",
    yourBuildingExplorationActionIsAlreadyComplete: "thisUnitHasAlreadyActed",
    thisUnitHasAlreadyCompletedItsAction: "thisUnitHasAlreadyActed",
    allSpacesInThePatternMustBe: "exploreAllSpacesInThePattern",
    thePatternOverlapsABuildingSpaceOr: "aBuildingOrFieldOccupiesThePattern",
    thePatternExtendsBeyondTheBoard: "theTileExtendsBeyondTheBoard",
    chooseYourOwnProductionBuilding: "chooseOneOfYourProductionBuildings",
  };
  const text = short[issue?.code] ? textFor("messages." + short[issue.code]) : ruleIssueText(issue, localized);
  return textFor("messages.cannotPlace", [text.charAt(0).toLowerCase() + text.slice(1)]);
}
export function placementGuidance(g, placement) {
  const results = new Map();
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
    const movement = movementPaths(g);
    const combat = attackPaths(g, movement).get(key(x,y));
    if (combat) {
      const preview = combatPreview(g,x,y);
      return { cells: [...combat,pos], error: null, combat: preview };
    }
    const path = movement.get(key(x, y));
    return {
      cells: path || [pos],
      error: path ? null : ruleIssue("messages.thisSpaceIsUnreachable"),
    };
  }
  if (drag.kind === "building")
    return {
      cells: patternAt(g.buildingMarket[drag.index], x, y, drag.rotation),
      error: buildIssue(g, drag.index, x, y, drag.rotation, {
        allowGold: true,
      }),
    };
  if (drag.kind === "single-terrain")
    return { cells: [{ x, y }], error: buyTerrainIssue(g, drag.terrain, x, y) };
  return {
    cells: transformed(g.opening ? g.opening.tiles[drag.index] : g.tileMarket[drag.index], drag.rotation).map((c) => ({
      ...c,
      x: c.x + x,
      y: c.y + y,
    })),
    error: g.opening ? openingIssue(g, drag.index, x, y, drag.rotation)
      : exploreIssue(g, drag.index, x, y, drag.rotation),
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
