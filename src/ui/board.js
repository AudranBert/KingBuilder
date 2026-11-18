import { piece } from "./pieces.js";
import {
  RULES,
  TERRAINS,
  BUILDINGS,
  UNIT_DEFINITIONS,
  actor,
  pawns,
  movementPaths,
  productionAmount,
} from "../engine.js";
import { key, inside } from "../geometry.js";
import { e, coordinates } from "./html.js";

export function createBoard(element, scrollElement, onCell) {
  const cells = new Map();
  let focusPosition = null;
  for (let y = 0; y < RULES.size; y++) {
    const row = document.createElement("div");
    row.className = "board-row";
    row.setAttribute("role", "row");
    for (let x = 0; x < RULES.size; x++) {
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
  element.style.gridTemplateColumns = `repeat(${RULES.size},var(--cell))`;
  element.setAttribute("aria-rowcount", RULES.size);
  element.setAttribute("aria-colcount", RULES.size);
  element.setAttribute(
    "aria-label",
    `Plateau de ${RULES.size} par ${RULES.size} cases`,
  );
  element.addEventListener("click", (event) => {
    const cell = event.target.closest("[data-x]");
    if (cell) {
      focusPosition = key(+cell.dataset.x, +cell.dataset.y);
      onCell(+cell.dataset.x, +cell.dataset.y);
    }
  });
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
    if (!inside(x, y, RULES.size)) return;
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
      (RULES.size - 1) * number(frame.columnGap);
    const frameHeight =
      number(frame.paddingTop) +
      number(frame.paddingBottom) +
      number(frame.borderTopWidth) +
      number(frame.borderBottomWidth) +
      (RULES.size - 1) * number(frame.rowGap);
    const size =
      Math.floor(
        Math.min(
          (availableWidth - frameWidth) / RULES.size,
          (availableHeight - frameHeight) / RULES.size,
        ) * 10,
      ) / 10;
    if (size > 0) element.style.setProperty("--cell", `${size}px`);
  }
  new ResizeObserver(fitBoard).observe(scrollElement);
  requestAnimationFrame(fitBoard);
  function clearPreview() {
    for (const cell of cells.values())
      cell.classList.remove("preview-valid", "preview-invalid");
  }
  return {
    render(g, ui) {
      const exhausted = (pawn) =>
        g.finished ||
        (pawn.type === "king"
          ? pawn.owner === g.active && (g.kingEnded || g.acted)
          : pawn.ended || pawn.acted);
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
      const currentKey = key(current.x, current.y),
        paths = movementPaths(g);
      if (!cells.has(focusPosition)) focusPosition = currentKey;
      for (const [position, button] of cells) {
        const x = +button.dataset.x,
          y = +button.dataset.y,
          cell = g.board[position],
          b = cell?.building,
          occupants = pawnIndex.get(position) || [];
        const near = ui.mode === "move" && paths.has(position);
        const selected = ui.selected?.x === x && ui.selected?.y === y;
        button.className = `cell ${cell ? `terrain-${cell.terrain}` : "unknown"} ${b || cell?.overlay ? "built-tile" : ""} ${cell?.overlay?.role === "field" ? "field" : ""} ${near ? "reachable" : ""} ${selected ? "selected" : ""} ${currentKey === position ? "active-pawn" : ""} ${occupants.some((p) => p.type === "king") ? "king" : ""}`;
        button.style.backgroundColor = cell ? TERRAINS[cell.terrain].color : "";
        button.style.color = cell ? TERRAINS[cell.terrain].foreground : "";
        button.tabIndex = position === focusPosition ? 0 : -1;
        button.setAttribute("aria-selected", String(selected));
        const parts = [
          `${coordinates(x, y)} : ${cell ? TERRAINS[cell.terrain].name : "Inexploré"}`,
        ];
        if (b) parts.push(BUILDINGS[b.type].name, g.players[b.owner].name);
        if (cell?.overlay?.role === "field") parts.push("Champ");
        for (const pawn of occupants)
          parts.push(
            `${pawn.type === "king" ? "Roi" : UNIT_DEFINITIONS[pawn.type].name + " " + (pawn.id + 1)} · ${g.players[pawn.owner].name}${exhausted(pawn) ? " · Actions terminées" : ""}`,
          );
        if (workerIndex.has(position)) parts.push("Ouvrier affecté");
        if (currentKey === position) parts.push("Unité sélectionnée");
        button.setAttribute("aria-label", parts.join(", "));
        button.title = parts.join(" · ");
        let html = b
          ? `<span class="building-piece" aria-hidden="true">${e(BUILDINGS[b.type].icon)}</span><i class="owner-dot ${b.owner === 1 ? "jade" : ""}" aria-hidden="true"></i>`
          : cell?.overlay?.role === "field"
            ? '<span class="field-piece" aria-hidden="true">≋</span>'
            : cell
              ? `<span class="terrain-symbol" aria-hidden="true">${e(TERRAINS[cell.terrain].icon)}</span>`
              : "";
        if (b?.type && BUILDINGS[b.type].produces) {
          const amount = productionAmount(g, x, y);
          if (amount > BUILDINGS[b.type].production)
            html += `<span class="boost" aria-hidden="true">×${amount / BUILDINGS[b.type].production}</span>`;
        }
        if (workerIndex.has(position))
          html += `<span class="worker-piece ${workerIndex.get(position).owner === 1 ? "jade" : ""}" ${workerIndex.get(position).owner === g.active && !g.finished ? `data-worker-drag="${workerIndex.get(position).id}"` : ""} title="Ouvrier affecté">${piece("worker")}</span>`;
        for (const pawn of occupants.filter((p) => p.type === "king"))
          html += `<span class="king-piece ${pawn.owner === 1 ? "jade" : ""} ${exhausted(pawn) ? "exhausted" : ""}" ${pawn.owner === g.active && !g.finished && !g.acted && !g.kingEnded && g.moves > 0 ? `data-unit-drag=""` : ""} aria-hidden="true">${piece("king")}</span>`;
        for (let owner = 0; owner < g.players.length; owner++) {
          const units = occupants.filter(
            (p) => p.owner === owner && p.type !== "king",
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
            html += `<span class="military-piece ${owner === 1 ? "jade" : ""} ${units.every(exhausted) ? "exhausted" : ""}" ${owner === g.active && !g.finished && movable ? `data-unit-drag="${movable.id}"` : ""} aria-hidden="true">${piece(units[0].type)}${units.length > 1 ? `<sup>${units.length}</sup>` : ""}</span>`;
        }
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
