import { t, definitionText, kingdomName } from "../i18n.js";
import { ruleIssueText } from "../rule-errors.js";
import { iconHTML } from "./html.js";
import { piece, playerColor } from "./pieces.js";
import {
  RULES,
  TERRAINS,
  BUILDINGS,
  UNIT_DEFINITIONS,
  actor,
  pawns,
  movementPaths,
  attackPaths,
  buildingAt,
  terrainAt,
  bridgeAt,
  productionAmount,
} from "../engine.js";
import { key, inside } from "../geometry.js";
import { e, coordinates } from "./html.js";
import { placementGuidance } from "./interactions.js";
import { hasSelectedUnit } from "./state.js";

export function territoryBorders(g, x, y) {
  const cell = g.board[key(x,y)];
  const owner = buildingAt(g,x,y)?.building.owner ?? cell?.flag?.owner;
  if (!g.players[owner]) return [];
  return [
    ["top", 0, -1],
    ["right", 1, 0],
    ["bottom", 0, 1],
    ["left", -1, 0],
  ].filter(([, dx, dy]) => (buildingAt(g,x+dx,y+dy)?.building.owner ?? g.board[key(x+dx,y+dy)]?.flag?.owner) !== owner)
    .map(([side]) => side);
}

export function createBoard(element, scrollElement, onCell, onPreview = () => {}) {
  const cells = new Map();
  let focusPosition = null,
    size = 0;
  function createCells(nextSize) {
    size = nextSize;
    cells.clear();
    focusPosition = null;
    if (element.replaceChildren) element.replaceChildren();
    else element.innerHTML = "";
    for (let y = 0; y < size; y++) {
      const row = document.createElement("div");
      row.className = "board-row";
      row.setAttribute("role", "row");
      for (let x = 0; x < size; x++) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "cell";
        button.dataset.x = x;
        button.dataset.y = y;
        button.setAttribute("role", "gridcell");
        button.setAttribute("aria-rowindex", y + 1);
        button.setAttribute("aria-colindex", x + 1);
        button.tabIndex = -1;
        row.append(button);
        cells.set(key(x, y), button);
      }
      element.append(row);
    }
    element.style.gridTemplateColumns = `repeat(${size},var(--cell))`;
    element.setAttribute("aria-rowcount", size);
    element.setAttribute("aria-colcount", size);
    element.setAttribute("aria-label", t("board.boardBySpaces", [size, size]));
    requestAnimationFrame(fitBoard);
  }
  createCells(RULES.size);
  element.addEventListener("click", (event) => {
    const cell = event.target.closest("[data-x]");
    if (cell) {
      focusPosition = key(+cell.dataset.x, +cell.dataset.y);
      const pawn = event.target.closest('[data-unit-select]');
      onCell(+cell.dataset.x, +cell.dataset.y, pawn?.dataset.unitSelect);
    }
  });
  for (const eventName of ["pointerover", "focusin"])
    element.addEventListener(eventName, event => {
      const cell = event.target.closest("[data-x]");
      if (cell) onPreview({ x: +cell.dataset.x, y: +cell.dataset.y });
    });
  element.addEventListener("pointerleave", () => onPreview(null));
  element.addEventListener("keydown", (event) => {
    const cell = event.target.closest("[data-x]");
    if (!cell) return;
    const directions = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    };
    const delta = directions[event.key];
    if (!delta) return;
    event.preventDefault();
    const x = +cell.dataset.x + delta[0],
      y = +cell.dataset.y + delta[1];
    if (!inside(x, y, size)) return;
    cell.tabIndex = -1;
    const next = cells.get(key(x, y));
    next.tabIndex = 0;
    focusPosition = key(x, y);
    next.focus();
  });
  function fitBoard() {
    const area = getComputedStyle(scrollElement),
      frame = getComputedStyle(element);
    const number = (value) => parseFloat(value) || 0;
    const availableWidth =
      scrollElement.clientWidth -
      number(area.paddingLeft) -
      number(area.paddingRight);
    const availableHeight =
      scrollElement.clientHeight -
      number(area.paddingTop) -
      number(area.paddingBottom);
    const frameWidth =
      number(frame.paddingLeft) +
      number(frame.paddingRight) +
      number(frame.borderLeftWidth) +
      number(frame.borderRightWidth) +
      (size - 1) * number(frame.columnGap);
    const frameHeight =
      number(frame.paddingTop) +
      number(frame.paddingBottom) +
      number(frame.borderTopWidth) +
      number(frame.borderBottomWidth) +
      (size - 1) * number(frame.rowGap);
    const cellSize =
      Math.floor(
        Math.min(
          (availableWidth - frameWidth) / size,
          (availableHeight - frameHeight) / size,
        ) * 10,
      ) / 10;
    const minimum = window.matchMedia?.('(pointer: coarse), (max-width: 540px)').matches ? 32 : 0;
    if (cellSize > 0) element.style.setProperty("--cell", `${Math.max(minimum, cellSize)}px`);
  }
  new ResizeObserver(fitBoard).observe(scrollElement);
  requestAnimationFrame(fitBoard);
  function clearPreview() {
    for (const cell of cells.values())
      cell.classList.remove("preview-valid", "preview-invalid");
  }
  return {
    render(g, ui, guidance = placementGuidance(g, ui.drag || ui.placement)) {
      if (size !== (g.boardSize ?? RULES.size)) createCells(g.boardSize ?? RULES.size);
      element.setAttribute("aria-label", t("board.boardBySpaces", [size, size]));
      const exhausted = pawn => g.finished || pawn.ended || (pawn.type === "soldier" ? pawn.acted || pawn.moves < 1 : pawn.acted && pawn.moves < 1);
      const current = actor(g), pawnIndex = new Map();
      for (let owner = 0; owner < g.players.length; owner++) {
        for (const pawn of pawns(g,owner)) {
          const position = key(pawn.x,pawn.y);
          if (!pawnIndex.has(position)) pawnIndex.set(position,[]);
          pawnIndex.get(position).push({...pawn,owner});
        }
      }
      const unitSelected = hasSelectedUnit(g, ui),
        currentKey = unitSelected ? key(current.x, current.y) : null,
        paths = unitSelected ? movementPaths(g) : new Map(),
        targets = unitSelected ? attackPaths(g, paths) : new Map();
      if (!cells.has(focusPosition)) focusPosition = key(current.x, current.y);
      for (const [position, button] of cells) {
        const x = +button.dataset.x,
          y = +button.dataset.y,
          cell = g.board[position],
          b = cell?.building,
          displayTerrain = terrainAt(g,x,y),
          bridge = bridgeAt(g,x,y),
          occupants = pawnIndex.get(position) || [];
        const near = !guidance.size && ui.mode === "move" && paths.has(position);
        const selected = ui.selected?.x === x && ui.selected?.y === y;
        button.className = `cell ${cell ? `terrain-${displayTerrain}` : "unknown"} ${b ? "built-tile" : ""} ${displayTerrain === "field" ? "field" : ""} ${near ? "reachable" : ""} ${selected ? "selected" : ""} ${currentKey === position ? "active-pawn" : ""} ${occupants.some((p) => p.type === "worker") ? "king" : ""}`;
        if (!guidance.size && ui.mode === "move" && targets.has(position)) button.classList.add("combat-target");
        button.style.backgroundImage = cell ? `url("${new URL(`../../${TERRAINS[displayTerrain].texture}`, import.meta.url).href}")` : "";
        button.style.backgroundColor = cell ? TERRAINS[displayTerrain].color : "";
        button.style.color = cell ? TERRAINS[displayTerrain].foreground : "";
        button.tabIndex = position === focusPosition ? 0 : -1;
        button.setAttribute("aria-selected", String(selected));
        const parts = [
          `${coordinates(x, y)} : ${cell ? definitionText("terrains", TERRAINS[displayTerrain]) : t("board.unexplored")}`,
        ];
        if (cell?.flag) parts.push(t("board.flag", [cell.flag.owner === null ? t("board.neutral") : kingdomName(g.players[cell.flag.owner].name)]));
        if (b) parts.push(definitionText("buildings", BUILDINGS[b.type]), kingdomName(g.players[b.owner].name));
        for (const pawn of occupants)
          parts.push(
            `${definitionText("units", UNIT_DEFINITIONS[pawn.type]) + " " + (pawn.id + 1)} · ${kingdomName(g.players[pawn.owner].name)}${exhausted(pawn) ? t("board.actionsComplete") : ""}`,
          );
        if (currentKey === position) parts.push(t("board.selectedUnit"));
        if (guidance.has(position)) parts.push(ruleIssueText(guidance.get(position).error, true) || t("board.validPlacement"));
        button.setAttribute("aria-label", parts.join(", "));
        button.title = parts.join(" · ");
        let html = b
          ? `<span class="building-piece" aria-hidden="true">${iconHTML(BUILDINGS[b.type].icon)}</span><i class="owner-dot ${playerColor(b.owner)}" aria-hidden="true"></i>`
          : bridge
            ? `<span class="building-piece" aria-hidden="true">${iconHTML(BUILDINGS.great_bridge.icon)}</span>`
          : displayTerrain === "field"
            ? `<span class="terrain-symbol" aria-hidden="true">${iconHTML(TERRAINS.field.icon)}</span>`
            : cell
              ? `<span class="terrain-symbol" aria-hidden="true">${iconHTML(TERRAINS[displayTerrain].icon)}</span>`
              : "";
        if (cell?.flag) html += `<span class="control-flag ${playerColor(cell.flag.owner)}" aria-hidden="true">⚑</span>`;
        if (b && BUILDINGS[b.type].garrison) html += `<span class="garrison-badge" title="${t("createBoard.fixedStrength", [BUILDINGS[b.type].garrison])}">♜</span>`;
        if (b?.type && BUILDINGS[b.type].produces) {
          const used = b.productionRound === g.round;
          html += `<span class="production-badge ${used ? 'used' : ''}" title="${e(t(used ? 'messages.productionUsed' : 'production.available'))}">${used ? '✓' : '+' + productionAmount(g,x,y)}</span>`;
        }
        for (let owner = 0; owner < g.players.length; owner++) {
          for (const kind of ["soldier", "worker"]) {
          const units = occupants.filter(
            (p) => p.owner === owner && p.type === kind,
          );
          const movable =
            units.find(
              (u) =>
                u.id === g.selectedUnitId &&
                !(u.type === "soldier" && u.acted) &&
                !u.ended &&
                u.moves > 0,
            ) || units.find((u) => !(u.type === "soldier" && u.acted) && !u.ended && u.moves > 0);
          if (units.length)
            html += `<span class="military-piece ${kind === "worker" ? "mobile-worker-piece" : ""} ${playerColor(owner)} ${units.every(exhausted) ? "exhausted" : ""}" ${owner === g.active && ui.mode !== "inspect" && !g.opening && !g.finished && movable ? `data-unit-drag="${movable.id}"` : ""} ${owner === g.active && ui.mode !== "inspect" && !g.opening && !g.finished ? `data-unit-select="${(movable || units[0]).id}"` : ""} aria-hidden="true">${piece(kind, owner)}${kind === "soldier" ? `<sup>${units.length}</sup>` : `<sup>${units.length > 1 ? units.length : units[0].id + 1}</sup>`}</span>`;
          }
        }
        const borders = territoryBorders(g, x, y);
        if (borders.length)
          html += `<span class="territory-border ${"territory-" + playerColor(buildingAt(g,x,y)?.building.owner ?? cell.flag?.owner)} ${borders.map(side => `border-${side}`).join(" ")}" aria-hidden="true"></span>`;
        if (button.innerHTML !== html) button.innerHTML = html;
      }
    },
    preview(result) {
      clearPreview();
      if (!result) return;
      for (const c of result.cells)
        cells
          .get(key(c.x, c.y))
          ?.classList.add(result.error ? "preview-invalid" : "preview-valid");
    },
  };
}
