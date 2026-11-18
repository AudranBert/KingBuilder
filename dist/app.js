import { parseKey } from "./geometry.js";
import { installDrag } from "./ui/drag.js";
import {
  RULES,
  createGame,
  PRESTIGE,
  MISSIONS,
  buildingPayment,
  buildError,
  rerollMarket,
  rerollError,
  actor,
  movementPaths,
  pawns,
  explore,
  build,
  recruit,
  recruitError,
  assign,
  endTurn,
  selectUnit,
  assignWorker,
  trainUnit,
  totalScore,
  key,
} from "./engine.js";
import { createPersistence, SAVE_KEY } from "./storage.js";
import { createUIState } from "./ui/state.js";
import { dragFromCard, dragPreview, moveUnitTo } from "./ui/interactions.js";
import { piece } from "./ui/pieces.js";
import { createBoard } from "./ui/board.js";
import {
  costHTML,
  costText,
  terrainDiagram,
  buildingDiagram,
} from "./ui/html.js";
import { RECRUITMENT_COST } from "./configuration.js";
import {
  playersView,
  missionsView,
  barracksView,
  workersView,
  terrainMarketView,
  buildingMarketView,
  selectionView,
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
  let hasSavedGame = false;
  try {
    hasSavedGame = Boolean(storage?.getItem(SAVE_KEY));
  } catch {}
  let game = persistence.load(),
    toastTimer;
  let nextMode = game.mode || "local";
  let inMenu = true;
  function showMenu() {
    drag.cancel();
    inMenu = true;
    $("#main-menu").hidden = false;
    $("header").hidden = true;
    $("main").hidden = true;
    $("#resume-button").hidden = !hasSavedGame;
    $("#resume-button").textContent =
      `Reprendre la partie ${game.mode === "solo" ? "solo" : "locale"} →`;
    $("[data-game-mode='solo']").focus();
  }
  function enterGame() {
    inMenu = false;
    $("#main-menu").hidden = true;
    $("header").hidden = false;
    $("main").hidden = false;
    render();
    $("#menu-button").focus();
    if (game.finished) showResults();
  }
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
    hasSavedGame = true;
    $("#save-status").textContent = saved
      ? "Partie enregistrée dans ce navigateur"
      : "Sauvegarde indisponible · gardez cet onglet ouvert";
    $("#save-status").classList.toggle("save-unavailable", !saved);
    if (!saved) {
      $("#game-notice").textContent = persistence.notice;
      $("#game-notice").hidden = false;
    }
  }
  function act(action, { message } = {}) {
    try {
      const previousClaims = game.missions.claimed.length;
      action();
      const won = game.missions.claimed.slice(previousClaims);
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
    const recruitReason = recruitError(game);
    html("#recruit", `+ Ouvrier <small>${costHTML(RECRUITMENT_COST)}</small>`);
    $("#recruit").disabled = Boolean(recruitReason);
    $("#recruit-reason").textContent = recruitReason || "";
    $("#end-turn").textContent = game.finished
      ? "Voir les résultats →"
      : "Fin de tour →";
    $("#round").innerHTML =
      `${String(game.round).padStart(2, "0")} <small>/ ${RULES.rounds}</small>`;
    $("#rotation-label").textContent = `${ui.rotation * 90}°`;
    $("#building-rotation-label").textContent = `${ui.buildingRotation * 90}°`;
    $("#rotate").disabled = game.finished || !game.tileMarket.length;

    $("#rotate-building").disabled =
      game.finished || !game.buildingMarket.length;
    for (const button of document.querySelectorAll("[data-mode]")) {
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.mode === ui.mode),
      );
      button.classList.toggle("selected", button.dataset.mode === ui.mode);
    }
    board.render(game, ui);
    board.preview(dragPreview(game, ui.drag, ui.drag?.position));
  }
  function chooseUnit(id) {
    act(() => {
      selectUnit(game, id);
      ui.selected = null;
      ui.drag = null;
    });
  }
  function handleCell(x, y) {
    if (ui.drag) return;
    const own = pawns(game, game.active).filter((p) => p.x === x && p.y === y);
    if (own.length && !game.finished) {
      chooseUnit((own.find((p) => p.id !== game.selectedUnitId) || own[0]).id);
      return;
    }
    ui.selected = { x, y };
    if (ui.mode === "move" && movementPaths(game).has(key(x, y)))
      act(() => moveUnitTo(game, x, y));
    else render();
  }
  let pendingBuild = null;
  function requestBuild(pos, index, rotation) {
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
    const missing = costText(payment.missing);
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
          ui.selected = null;
        },
        { message: "Marché renouvelé." },
      ),
    );
  function rotate(kind = ui.drag?.kind || "terrain") {
    if (game.finished || !["terrain", "building"].includes(kind)) return;
    const field = kind === "building" ? "buildingRotation" : "rotation";
    ui[field] = (ui[field] + 1) % 4;
    if (ui.drag?.kind === kind) ui.drag.rotation = ui[field];
    render();
    drag.refresh();
  }
  function showResults() {
    const a = totalScore(game, 0),
      b = game.players.length > 1 ? totalScore(game, 1) : 0;
    $("#winner").textContent =
      game.mode === "solo"
        ? `Votre royaume : ${a} points`
        : a === b
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
      render();
      return;
    }
    const button = event.target.closest("[data-action]");
    if (!button || button.disabled) return;
    const position = button.dataset.position
      ? parseKey(button.dataset.position)
      : null;
    switch (button.dataset.action) {
      case "move":
        act(() => moveUnitTo(game, ui.selected.x, ui.selected.y));
        break;
      case "assign":
        act(() => assign(game, ...position));
        break;
      case "train":
        act(() => trainUnit(game, ...position, button.dataset.type), {
          message: "Unité recrutée. Elle sera active au prochain tour.",
        });
        break;
    }
  });
  $("#rotate").addEventListener("click", () => rotate("terrain"));
  $("#rotate-building").addEventListener("click", () => rotate("building"));
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
    act(() => {
      endTurn(game);
      ui.selected = null;
    });
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
  $("#menu-button").addEventListener("click", showMenu);
  $("#resume-button").addEventListener("click", enterGame);
  function requestNewGame(mode) {
    nextMode = mode;
    if (hasSavedGame) $("#new-dialog").showModal();
    else beginNewGame();
  }
  for (const button of document.querySelectorAll("[data-game-mode]"))
    button.addEventListener("click", () =>
      requestNewGame(button.dataset.gameMode),
    );
  $("#new-dialog .cancel").addEventListener("click", () =>
    $("#new-dialog").close(),
  );
  function beginNewGame() {
    const created = act(
      () => {
        game = createGame(Math.random, nextMode);
        $("#game-notice").hidden = true;
        Object.assign(ui, createUIState());
      },
      {
        message:
          nextMode === "solo"
            ? "Votre royaume s’éveille."
            : "Deux nouveaux royaumes s’éveillent.",
      },
    );
    if (created) {
      $("#new-dialog").close();
      enterGame();
    }
  }
  $("#new-dialog .confirm").addEventListener("click", beginNewGame);
  $(".close-results").addEventListener("click", () =>
    $("#result-dialog").close(),
  );
  document.addEventListener("keydown", (event) => {
    if (
      inMenu ||
      document.querySelector("dialog[open]") ||
      event.target.closest("input,select,textarea,[contenteditable]")
    )
      return;
    if (event.key === "Escape") {
      drag.cancel();
      ui.selected = null;
      render();
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
  const drag = installDrag({
    root: $(".game-layout"),
    begin(card) {
      ui.drag = dragFromCard(card, ui);
      ui.selected = null;
      if (ui.drag.kind === "unit") selectUnit(game, ui.drag.id);
      render();
    },
    preview(pos) {
      ui.drag.position = pos;
      board.preview(dragPreview(game, ui.drag, pos));
    },
    ghost() {
      const d = ui.drag;
      if (!d) return "";
      if (d.kind === "terrain")
        return terrainDiagram(game.tileMarket[d.index], d.rotation);
      if (d.kind === "building")
        return buildingDiagram(game.buildingMarket[d.index], d.rotation);
      return piece(d.kind === "worker" ? "worker" : actor(game).type);
    },
    drop(pos) {
      const d = ui.drag;
      ui.drag = null;
      if (pos.workerReserve) {
        if (d.kind === "worker")
          act(() => assignWorker(game, d.id, null, null));
      } else if (d.kind === "unit") act(() => moveUnitTo(game, pos.x, pos.y));
      else if (d.kind === "worker")
        act(() => assignWorker(game, d.id, pos.x, pos.y));
      else if (d.kind === "terrain")
        act(() => explore(game, d.index, pos.x, pos.y, d.rotation));
      else requestBuild(pos, d.index, d.rotation);
    },
    end() {
      ui.drag = null;
      render();
    },
  });
  html(".rules-content", rulesView());
  render();
  if (persistence.notice) {
    $("#game-notice").textContent = persistence.notice;
    $("#game-notice").hidden = false;
  }
  showMenu();
}
