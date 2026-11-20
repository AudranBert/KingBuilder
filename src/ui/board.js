import { t, definitionText, translateMessage, kingdomName } from "../i18n.js";
import { iconHTML } from "./html.js";
import { piece } from "./pieces.js";
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
    render(g, ui) {
      if (size !== (g.boardSize ?? RULES.size)) createCells(g.boardSize ?? RULES.size);
      element.setAttribute("aria-label", t("board.boardBySpaces", [size, size]));
      const exhausted = (pawn) =>
        g.finished ||
        (pawn.type === "king"
          ? pawn.owner === g.active && (g.kingEnded || g.acted || g.moves < 1)
          : pawn.ended || pawn.acted || pawn.moves < 1);
      const current = actor(g),
        pawnIndex = new Map(),
        workerIndex = new Map();
      for (let owner = 0; owner < g.players.length; owner++) {
        for (const pawn of pawns(g, owner)) {
          const position = key(pawn.x, pawn.y);
          if (!pawnIndex.has(position)) pawnIndex.set(position, []);
          pawnIndex.get(position).push({ ...pawn, owner });
        }
        for (const worker of g.players[owner].workerAssignments)
          if (worker.building)
            workerIndex.set(worker.building, { owner, id: worker.id });
      }
      const unitSelected = hasSelectedUnit(g, ui),
        currentKey = unitSelected ? key(current.x, current.y) : null,
        paths = unitSelected ? movementPaths(g) : new Map(),
        targets = unitSelected ? attackPaths(g) : new Map(),
        guidance = placementGuidance(g, ui.drag || ui.placement);
      if (!cells.has(focusPosition)) focusPosition = key(current.x, current.y);
      for (const [position, button] of cells) {
        const x = +button.dataset.x,
          y = +button.dataset.y,
          cell = g.board[position],
          b = cell?.building,
          occupants = pawnIndex.get(position) || [];
        const near = !guidance.size && ui.mode === "move" && paths.has(position);
        const selected = ui.selected?.x === x && ui.selected?.y === y;
        button.className = `cell ${cell ? `terrain-${cell.terrain}` : "unknown"} ${b || cell?.overlay ? "built-tile" : ""} ${cell?.overlay?.role === "field" ? "field" : ""} ${near ? "reachable" : ""} ${selected ? "selected" : ""} ${currentKey === position ? "active-pawn" : ""} ${occupants.some((p) => p.type === "king") ? "king" : ""}`;
        if (!guidance.size && ui.mode === "move" && targets.has(position)) button.classList.add("combat-target");
        button.style.backgroundImage = cell ? `url("${new URL(`../../${TERRAINS[cell.terrain].texture}`, import.meta.url).href}")` : "";
        button.style.backgroundColor = cell ? TERRAINS[cell.terrain].color : "";
        button.style.color = cell ? TERRAINS[cell.terrain].foreground : "";
        button.tabIndex = position === focusPosition ? 0 : -1;
        button.setAttribute("aria-selected", String(selected));
        const parts = [
          `${coordinates(x, y)} : ${cell ? definitionText("terrains", TERRAINS[cell.terrain]) : t("board.unexplored")}`,
        ];
        if (cell?.flag) parts.push(t("board.flag", [cell.flag.owner === null ? t("board.neutral") : kingdomName(g.players[cell.flag.owner].name)]));
        if (b) parts.push(definitionText("buildings", BUILDINGS[b.type]), kingdomName(g.players[b.owner].name));
        if (cell?.overlay?.role === "field") parts.push(t("board.field"));
        for (const pawn of occupants)
          parts.push(
            `${pawn.type === "king" ? definitionText("units", UNIT_DEFINITIONS.king) : definitionText("units", UNIT_DEFINITIONS[pawn.type]) + " " + (pawn.id + 1)} · ${kingdomName(g.players[pawn.owner].name)}${exhausted(pawn) ? t("board.actionsComplete") : ""}`,
          );
        if (workerIndex.has(position)) parts.push(t("board.assigned", [definitionText("units", UNIT_DEFINITIONS.worker)]));
        if (currentKey === position) parts.push(t("board.selectedUnit"));
        if (guidance.has(position)) parts.push(translateMessage(guidance.get(position).error) || t("board.validPlacement"));
        button.setAttribute("aria-label", parts.join(", "));
        button.title = parts.join(" · ");
        let html = b
          ? `<span class="building-piece" aria-hidden="true">${iconHTML(BUILDINGS[b.type].icon)}</span><i class="owner-dot ${b.owner === 1 ? "jade" : ""}" aria-hidden="true"></i>`
          : cell?.overlay?.role === "field"
            ? `<span class="terrain-symbol" aria-hidden="true">${iconHTML(TERRAINS.field.icon)}</span>`
            : cell
              ? `<span class="terrain-symbol" aria-hidden="true">${iconHTML(TERRAINS[cell.terrain].icon)}</span>`
              : "";
        if (cell?.flag) html += `<span class="control-flag ${cell.flag.owner === 0 ? "amber" : cell.flag.owner === 1 ? "jade" : "neutral"}" aria-hidden="true">⚑</span>`;
        if (b && BUILDINGS[b.type].garrison) html += `<span class="garrison-badge" title="${t("createBoard.fixedGarrison1Defense1")}">♜</span>`;
        if (b?.type && BUILDINGS[b.type].produces) {
          const amount = productionAmount(g, x, y);
          if (!amount) html += `<span class="inactive-producer" title="${t("createBoard.withoutNoProduction", [e(definitionText("units", UNIT_DEFINITIONS.worker).toLowerCase())])}" aria-label="${t("createBoard.withoutNoProduction", [e(definitionText("units", UNIT_DEFINITIONS.worker).toLowerCase())])}">!</span>`;
          if (amount > BUILDINGS[b.type].production)
            html += `<span class="boost" aria-hidden="true">×${amount / BUILDINGS[b.type].production}</span>`;
        }
        if (workerIndex.has(position))
          html += `<span class="worker-piece ${workerIndex.get(position).owner === 1 ? "jade" : ""}" ${workerIndex.get(position).owner === g.active && !g.finished && ui.mode !== 'inspect' ? `data-worker-drag="${workerIndex.get(position).id}"` : ""} title="${t("createBoard.assigned", [e(definitionText("units", UNIT_DEFINITIONS.worker))])}">${piece("worker")}</span>`;
        for (const pawn of occupants.filter((p) => p.type === "king"))
          html += `<span class="king-piece ${pawn.owner === 1 ? "jade" : ""} ${exhausted(pawn) ? "exhausted" : ""}" ${pawn.owner === g.active && ui.mode !== "inspect" && !g.opening && !g.finished && !g.acted && !g.kingEnded && g.moves > 0 ? `data-unit-drag=""` : ""} ${pawn.owner === g.active && ui.mode !== "inspect" && !g.opening && !g.finished ? 'data-unit-select=""' : ""} aria-hidden="true">${piece("king")}</span>`;
        for (let owner = 0; owner < g.players.length; owner++) {
          for (const kind of ["soldier", "emissary"]) {
          const units = occupants.filter(
            (p) => p.owner === owner && p.type === kind,
          );
          const movable =
            units.find(
              (u) =>
                u.id === g.selectedUnitId &&
                !u.acted &&
                !u.ended &&
                u.moves > 0,
            ) || units.find((u) => !u.acted && !u.ended && u.moves > 0);
          if (units.length)
            html += `<span class="military-piece ${kind === "emissary" ? "emissary-piece" : ""} ${owner === 1 ? "jade" : ""} ${units.every(exhausted) ? "exhausted" : ""}" ${owner === g.active && ui.mode !== "inspect" && !g.opening && !g.finished && movable ? `data-unit-drag="${movable.id}"` : ""} ${owner === g.active && ui.mode !== "inspect" && !g.opening && !g.finished ? `data-unit-select="${(movable || units[0]).id}"` : ""} aria-hidden="true">${piece(kind)}${kind === "soldier" ? `<sup>${units.length}</sup>` : ""}</span>`;
          }
        }
        const borders = territoryBorders(g, x, y);
        if (borders.length)
          html += `<span class="territory-border ${(buildingAt(g,x,y)?.building.owner ?? cell.flag?.owner) === 1 ? "territory-jade" : "territory-gold"} ${borders.map(side => `border-${side}`).join(" ")}" aria-hidden="true"></span>`;
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
