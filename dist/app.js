import { installTileDrag } from "./ui/drag.js";
import {
  RULES,
  createGame,
  PRESTIGE,
  MISSIONS,
  buildingPayment,
  buildError,
  rerollMarket,
  rerollError,
  RESOURCES,
  TERRAINS,
  BUILDINGS,
  actor,
  move,
  moveError,
  movementPaths,
  pawns,
  buildingAt,
  explore,
  exploreError,
  build,
  recruit,
  assign,
  endTurn,
  selectUnit,
  assignWorker,
  trainUnit,
  totalScore,
  key,
} from "./engine.js";
import { createPersistence } from "./storage.js";
import {
  createUIState,
  normalizeUI,
  cancelPlacement,
  entryIndex,
} from "./ui/state.js";
import { createBoard } from "./ui/board.js";
import { e, costHTML } from "./ui/html.js";
import { RECRUITMENT_COST } from "./configuration.js";
import {
  playersView,
  missionsView,
  barracksView,
  workersView,
  terrainMarketView,
  buildingMarketView,
  selectionView,
  turnView,
  resultsView,
  rulesView,
} from "./ui/views.js";

export function startGame() {
  const $ = (selector) => document.querySelector(selector),
    ui = createUIState(),
    markup = new WeakMap();
  let storage;
  try {
    storage = window.localStorage;
  } catch {
    storage = null;
  }
  const persistence = createPersistence(storage);
  let game = persistence.load(),
    toastTimer;
  const board = createBoard($("#board"), $("#map-scroll"), handleCell);
  function html(selector, value) {
    const node = $(selector);
    if (markup.get(node) !== value) {
      node.innerHTML = value;
      markup.set(node, value);
    }
  }
  function toast(message) {
    $("#toast").textContent = message;
    $("#toast").classList.add("visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(
      () => $("#toast").classList.remove("visible"),
      4500,
    );
  }
  function save() {
    const saved = persistence.save(game);
    $("#save-status").textContent = saved
      ? "Partie enregistrée dans ce navigateur"
      : "Sauvegarde indisponible · gardez cet onglet ouvert";
    $("#save-status").classList.toggle("save-unavailable", !saved);
    if (!saved) {
      $("#game-notice").textContent = persistence.notice;
      $("#game-notice").hidden = false;
    }
  }
  function act(action, { message, center = false } = {}) {
    try {
      const previousClaims = game.missions.claimed.length;
      action();
      const won = game.missions.claimed.slice(previousClaims);
      normalizeUI(game, ui);
      save();
      render();
      if (won.length)
        toast(
          won
            .map(
              (c) =>
                `${MISSIONS[c.id].name} : +${MISSIONS[c.id].reward.prestige} ✦`,
            )
            .join(" · "),
        );
      else if (message) toast(message);
      return true;
    } catch (error) {
      toast(error.message);
      return false;
    }
  }
  function render() {
    normalizeUI(game, ui);
    const worker = document.activeElement?.dataset.worker;
    html("#players", playersView(game));
    html("#missions", missionsView(game));
    for (const kind of ["terrain", "building"]) {
      const button = $("#reroll-" + kind),
        error = rerollError(game, kind);
      button.textContent = `↻ ${PRESTIGE.rerollCost} ✦`;
      button.disabled = Boolean(error);
      button.title =
        error || `Remplacer les 3 offres pour ${PRESTIGE.rerollCost} prestige`;
    }
    html("#barracks-list", barracksView(game));
    html("#worker-list", workersView(game));
    html("#tile-market", terrainMarketView(game, ui));
    html("#building-market", buildingMarketView(game, ui));
    html("#selection", selectionView(game, ui));
    const turn = turnView(game, ui);
    html("#recruit", `+ Ouvrier <small>${costHTML(RECRUITMENT_COST)}</small>`);
    $("#recruit").disabled = Boolean(turn.recruitReason);
    $("#recruit-reason").textContent = turn.recruitReason || "";
    $("#end-turn").textContent = game.finished
      ? "Voir les résultats →"
      : "Fin de tour →";
    $("#round").innerHTML =
      `${String(game.round).padStart(2, "0")} <small>/ ${RULES.rounds}</small>`;
    $("#rotation-label").textContent = `${ui.rotation * 90}°`;
    $("#building-rotation-label").textContent = `${ui.buildingRotation * 90}°`;
    $("#rotate").disabled = game.finished || ui.tileIndex === null;

    $("#rotate-building").disabled = game.finished || ui.buildingIndex === null;
    for (const button of document.querySelectorAll("[data-mode]")) {
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.mode === ui.mode),
      );
      button.classList.toggle("selected", button.dataset.mode === ui.mode);
    }
    board.render(game, ui);
    board.preview(game, ui);
    if (worker !== undefined)
      $(`[data-worker="${worker}"]`)?.focus({ preventScroll: true });
  }
  function chooseUnit(id) {
    act(
      () => {
        selectUnit(game, id);
        ui.selected = null;
        cancelPlacement(ui);
      },
      { center: true },
    );
  }
  function handleCell(x, y) {
    const own = pawns(game, game.active).filter((p) => p.x === x && p.y === y);
    if (own.length && !game.finished && ui.buildingIndex === null) {
      const next = own.find((p) => p.id !== game.selectedUnitId) || own[0];
      chooseUnit(next.id);
      return;
    }
    ui.selected = { x, y };
    ui.exploreTarget = null;
    if (game.finished || ui.mode === "inspect" || ui.buildingIndex !== null) {
      render();
      return;
    }
    const cell = game.board[key(x, y)],
      unit = actor(game);
    if (!cell) {
      if (!exploreError(game, ui.tileIndex, x, y, ui.rotation, ui.anchor))
        ui.exploreTarget = { x, y };
      render();
      return;
    }
    const path = movementPaths(game).get(key(x, y));
    if (path) {
      act(() => {
        for (const step of path) move(game, step.x, step.y);
      });
      return;
    }
    const occupied = game.players.some(
      (p) =>
        (p.x === x && p.y === y) || p.units.some((u) => u.x === x && u.y === y),
    );
    if (
      cell.building ||
      cell.overlay ||
      occupied ||
      moveError(game, x, y) ||
      (x === unit.x && y === unit.y)
    ) {
      render();
      return;
    }
    act(() => move(game, x, y));
  }
  let pendingBuild = null;
  function requestBuild(pos) {
    const index = ui.buildingIndex,
      rotation = ui.buildingRotation;
    const error = buildError(game, index, pos.x, pos.y, rotation, {
      allowPrestige: true,
    });
    if (error) {
      toast(error);
      return;
    }
    const payment = buildingPayment(game, index);
    const attempt = {
      game,
      owner: game.active,
      round: game.round,
      unit: game.selectedUnitId,
      index,
      type: game.buildingMarket[index],
      rotation,
      x: pos.x,
      y: pos.y,
      payment,
    };
    if (!payment.prestige) {
      completeBuild(attempt);
      return;
    }
    pendingBuild = attempt;
    const missing = Object.entries(payment.missing)
      .map(([id, n]) => `${n} ${RESOURCES[id]}`)
      .join(" + ");
    $("#prestige-warning").textContent =
      `Il manque ${missing}. Utiliser ${payment.prestige} point(s) de prestige ? Cela représente ${payment.prestige * RULES.points.prestige} points de fin de partie. Les ressources disponibles seront aussi dépensées.`;
    $("#prestige-dialog .confirm").textContent =
      `Utiliser ${payment.prestige} ✦`;
    $("#prestige-dialog").showModal();
  }
  function completeBuild(attempt) {
    return act(
      () => {
        if (
          attempt.game !== game ||
          attempt.owner !== game.active ||
          attempt.round !== game.round ||
          attempt.unit !== game.selectedUnitId ||
          attempt.type !== game.buildingMarket[attempt.index] ||
          JSON.stringify(attempt.payment) !==
            JSON.stringify(buildingPayment(game, attempt.index))
        )
          throw Error("Le placement ou son coût a changé. Réessayez.");
        build(game, attempt.index, attempt.x, attempt.y, attempt.rotation, {
          allowPrestige: attempt.payment.prestige > 0,
          expectedPrestige: attempt.payment.prestige,
        });
        cancelPlacement(ui);
      },
      { message: "Construction terminée." },
    );
  }
  $("#prestige-dialog .confirm").addEventListener("click", () => {
    if (pendingBuild && completeBuild(pendingBuild)) {
      pendingBuild = null;
      $("#prestige-dialog").close();
    }
  });
  $("#prestige-dialog .cancel").addEventListener("click", () =>
    $("#prestige-dialog").close(),
  );
  $("#prestige-dialog").addEventListener("close", () => {
    pendingBuild = null;
  });
  for (const kind of ["terrain", "building"])
    $("#reroll-" + kind).addEventListener("click", () =>
      act(
        () => {
          rerollMarket(game, kind);
          cancelPlacement(ui);
          ui.selected = null;
          ui.tileIndex = 0;
          ui.anchor = 0;
        },
        { message: "Marché renouvelé." },
      ),
    );
  function confirmExploration() {
    const pos = ui.exploreTarget;
    if (!pos) return;
    act(
      () => {
        explore(game, ui.tileIndex, pos.x, pos.y, ui.rotation, ui.anchor);
        ui.anchor = 0;
        ui.exploreTarget = null;
      },
      { message: "Le territoire a été révélé." },
    );
  }
  function rotate() {
    if (game.finished) return;
    if (ui.buildingIndex !== null)
      ui.buildingRotation = (ui.buildingRotation + 1) % 4;
    else if (ui.tileIndex !== null) ui.rotation = (ui.rotation + 1) % 4;
    render();
  }
  function cancel() {
    cancelPlacement(ui);
    ui.selected = null;
    render();
  }
  function showResults() {
    const a = totalScore(game, 0),
      b = totalScore(game, 1);
    $("#winner").textContent =
      a === b
        ? "Deux couronnes, une victoire partagée."
        : `${game.players[a > b ? 0 : 1].name} l’emporte !`;
    html("#results", `<div class="result-grid">${resultsView(game)}</div>`);
    if (!$("#result-dialog").open) $("#result-dialog").showModal();
  }

  document.addEventListener("click", (event) => {
    const unit = event.target.closest("[data-unit]");
    if (unit) {
      chooseUnit(unit.dataset.unit === "" ? null : Number(unit.dataset.unit));
      return;
    }
    const mode = event.target.closest("[data-mode]");
    if (mode) {
      ui.mode = mode.dataset.mode;
      cancelPlacement(ui);
      render();
      return;
    }
    const button = event.target.closest("[data-action]");
    if (!button || button.disabled) return;
    const position = button.dataset.position?.split(",").map(Number);
    switch (button.dataset.action) {
      case "cancel":
        cancel();
        break;
      case "move":
        act(() => move(game, ui.selected.x, ui.selected.y));
        break;
      case "assign":
        act(() => assign(game, ...position));
        break;
      case "build":
        requestBuild(ui.selected || actor(game));
        break;
      case "explore":
        confirmExploration();
        break;
      case "train":
        act(() => trainUnit(game, ...position, button.dataset.type), {
          message: "Unité recrutée. Elle sera active au prochain tour.",
        });
        break;
    }
  });
  $("#tile-market").addEventListener("click", (event) => {
    const button = event.target.closest("[data-tile]");
    if (!button || button.disabled) return;
    ui.tileIndex = Number(button.dataset.tile);
    ui.anchor = Math.max(0, entryIndex(game.tileMarket[ui.tileIndex]));
    ui.rotation = 0;
    ui.buildingIndex = null;
    render();
  });
  $("#building-market").addEventListener("click", (event) => {
    const button = event.target.closest("[data-building]");
    if (!button || button.disabled) return;
    const index = Number(button.dataset.building);
    ui.buildingIndex = ui.buildingIndex === index ? null : index;
    ui.buildingRotation = 0;
    ui.exploreTarget = null;
    ui.selected = { x: actor(game).x, y: actor(game).y };
    render();
  });
  $("#rotate").addEventListener("click", () => {
    ui.rotation = (ui.rotation + 1) % 4;
    render();
  });
  $("#rotate-building").addEventListener("click", rotate);
  $("#board").addEventListener("pointerover", (event) => {
    if (event.pointerType === "touch" || ui.mode === "inspect") return;
    const cell = event.target.closest("[data-x]");
    if (cell)
      board.preview(game, ui, {
        x: Number(cell.dataset.x),
        y: Number(cell.dataset.y),
      });
  });
  $("#board").addEventListener("pointerleave", () => board.preview(game, ui));
  $("#recruit").addEventListener("click", () =>
    act(() => recruit(game), {
      message: "Un ouvrier est disponible pour une affectation.",
    }),
  );
  $("#end-turn").addEventListener("click", () => {
    if (game.finished) {
      showResults();
      return;
    }
    act(
      () => {
        endTurn(game);
        ui.selected = null;
        ui.anchor = 0;
        cancelPlacement(ui);
      },
      { center: true },
    );
    if (game.finished) showResults();
    else toast(`${game.players[game.active].name} : à vous de jouer.`);
  });
  $("#rules-button").addEventListener("click", () =>
    $("#rules-dialog").showModal(),
  );
  $("#rules-dialog .close").addEventListener("click", () =>
    $("#rules-dialog").close(),
  );
  $(".close-rules").addEventListener("click", () => $("#rules-dialog").close());
  $("#new-button").addEventListener("click", () =>
    $("#new-dialog").showModal(),
  );
  $("#new-dialog .cancel").addEventListener("click", () =>
    $("#new-dialog").close(),
  );
  $("#new-dialog .confirm").addEventListener("click", () => {
    const created = act(
      () => {
        game = createGame();
        $("#game-notice").hidden = true;
        Object.assign(ui, createUIState());
      },
      { center: true, message: "Deux nouveaux royaumes s’éveillent." },
    );
    if (created) $("#new-dialog").close();
  });
  $(".close-results").addEventListener("click", () =>
    $("#result-dialog").close(),
  );
  document.addEventListener("keydown", (event) => {
    if (
      document.querySelector("dialog[open]") ||
      event.target.closest("input,select,textarea,[contenteditable]")
    )
      return;
    if (event.key === "Escape") {
      cancel();
      event.preventDefault();
    }
    if (
      event.key.toLowerCase() === "r" &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey
    ) {
      rotate();
      event.preventDefault();
    }
  });
  const layout = $(".game-layout");
  const lands = $("#tile-market").closest("section");
  const buildings = $("#building-market").closest("section");
  lands.classList.add("land-shop");
  buildings.classList.add("building-shop");
  const left = document.createElement("div");
  left.className = "land-column";
  const right = document.createElement("div");
  right.className = "building-column";
  left.append(lands, $("#worker-list").closest("section"));
  const training = document.createElement("div");
  training.id = "barracks-list";
  right.append(buildings, training);
  layout.prepend(left);
  layout.append(right);
  let dragKind = null,
    draggedWorker = null;
  installTileDrag({
    root: layout,
    begin(card) {
      dragKind =
        card.dataset.workerDrag !== undefined
          ? "worker"
          : card.dataset.tile !== undefined
            ? "terrain"
            : "building";
      draggedWorker = dragKind === "worker" ? +card.dataset.workerDrag : null;
      ui.exploreTarget = null;
      ui.selected = null;
      ui.mode = "move";
      if (dragKind === "terrain") {
        ui.tileIndex = +card.dataset.tile;
        ui.anchor = 0;
        ui.buildingIndex = null;
      } else if (dragKind === "building")
        ui.buildingIndex = +card.dataset.building;
      else ui.buildingIndex = null;
      render();
    },
    preview(pos) {
      if (dragKind !== "worker") {
        board.preview(game, ui, pos);
        return;
      }
      for (const cell of $("#board").querySelectorAll(
        ".preview-valid,.preview-invalid",
      ))
        cell.classList.remove("preview-valid", "preview-invalid");
      if (!pos) return;
      const site = buildingAt(game, pos.x, pos.y),
        target = site && key(site.x, site.y);
      const valid =
        !game.finished &&
        site?.building.owner === game.active &&
        BUILDINGS[site.building.type].produces &&
        !game.players[game.active].workerAssignments.some(
          (w) => w.id !== draggedWorker && w.building === target,
        );
      $("#board")
        .querySelector(`[data-x="${pos.x}"][data-y="${pos.y}"]`)
        ?.classList.add(valid ? "preview-valid" : "preview-invalid");
    },
    drop(pos) {
      if (pos.workerReserve) {
        if (dragKind === "worker")
          act(() => assignWorker(game, draggedWorker, null, null));
        return;
      }
      ui.selected = pos;
      if (dragKind === "worker")
        act(() => assignWorker(game, draggedWorker, pos.x, pos.y), {
          message: "Ouvrier affecté au bâtiment.",
        });
      else if (dragKind === "terrain") {
        ui.exploreTarget = pos;
        confirmExploration();
      } else requestBuild(pos);
    },
    end() {
      dragKind = null;
      render();
    },
  });
  html(".rules-content", rulesView());
  render();
  save();
  if (persistence.notice) {
    $("#game-notice").textContent = persistence.notice;
    $("#game-notice").hidden = false;
  }
  if (game.finished) showResults();
}
