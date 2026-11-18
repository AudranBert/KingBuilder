import { createPersistence } from "./storage.js";
import { parseKey } from "./geometry.js";
import { installDrag } from "./ui/drag.js";
import {
  RULES,
  createGame,
  GOLD,
  MISSIONS,
  buildingPayment,
  buildError,
  rerollMarket,
  rerollError,
  actor,
  movementPaths,
  attackPaths,
  selectArmy,
  pawns,
  explore,
  build,
  assign,
  endTurn,
  selectUnit,
  assignWorker,
  trainUnit,
  totalScore,
  key,
} from "./engine.js";
import { createUIState } from "./ui/state.js";
import { dragFromCard, dragPreview, moveUnitTo, placementGuidance } from "./ui/interactions.js";
import { piece } from "./ui/pieces.js";
import { createBoard } from "./ui/board.js";
import {
  e,
  costText,
  terrainDiagram,
  buildingDiagram,
} from "./ui/html.js";
import {
  playersView,
  missionsView,
  barracksView,
  workersView,
  terrainMarketView,
  buildingMarketView,
  buildingDetailsView,
  selectionView,
  resultsView,
  rulesView,
  harvestView,
  tradeView,
} from "./ui/views.js";

export function startGame() {
  const $ = (selector) => document.querySelector(selector),
    ui = createUIState(),
    markup = new WeakMap();
  let localStore;
  try { localStore = window.localStorage; } catch {}
  const persistence = createPersistence(localStore);
  let game = persistence.load(),
    toastTimer;
  let nextMode = game.mode || "local";
  let inMenu = true;
  function showMenu() {
    drag.cancel();
    inMenu = true;
    $("#main-menu").hidden = false;
    try { $("#resume-game").hidden = !localStore?.getItem("kingbuilder-save-v1"); }
    catch { $("#resume-game").hidden = true; }
    $("header").hidden = true;
    $("main").hidden = true;
    $("[data-game-mode='solo']").focus();
  }
  function enterGame() {
    inMenu = false;
    $("#main-menu").hidden = true;
    $("header").hidden = false;
    $("main").hidden = false;
    render();
    if (persistence.notice) { $("#game-notice").hidden = false; $("#game-notice").textContent = persistence.notice; }
    $("#menu-button").focus();
    if (game.finished) showResults();
  }
  const board = createBoard($("#board"), $("#map-scroll"), handleCell, previewPlacement);
  function placementHelp(message) {
    const choice = ui.drag || ui.placement;
    if (!choice || !["terrain", "building"].includes(choice.kind)) {
      $("#placement-help").textContent = "";
      return;
    }
    if (message) {
      $("#placement-help").textContent = message;
      return;
    }
    const count = [...placementGuidance(game, choice).values()].filter(result => !result.error).length;
    $("#placement-help").textContent = `${count} placement(s) possible(s) dans cette orientation. ${count ? "Choisissez une case verte ou glissez la carte." : "Essayez une rotation, une autre unité ou une autre carte."} R ou molette : pivoter · Échap : annuler.`;
  }
  function previewPlacement(pos) {
    if (ui.drag) return;
    const result = dragPreview(game, ui.placement, pos);
    board.preview(result);
    placementHelp(result?.error || (result ? "Placement possible · Cliquez pour placer." : null));
  }
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
  function act(action, { message } = {}) {
    try {
      const previousClaims = game.missions.claimed.length;
      action();
      const won = game.missions.claimed.slice(previousClaims);
      render();
      if (game.finished) showResults();
      if (won.length)
        toast(
          won
            .map(
              (c) =>
                `${MISSIONS[c.id].name} : +${MISSIONS[c.id].reward.gold} or`,
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
    $("#missions").style.setProperty("--mission-columns", RULES.missionMarketSize);
    $("#tile-market").style.setProperty("--terrain-columns", RULES.markets.terrainSize);
    for (const kind of ["terrain", "building"]) {
      const button = $("#reroll-" + kind),
        error = rerollError(game, kind);
      button.textContent = `↻ ${GOLD.rerollCost} or`;
      button.disabled = Boolean(error);
      button.title =
        error || `Remplacer les offres pour ${GOLD.rerollCost} or`;
    }
    html("#barracks-list", barracksView(game));
    html("#worker-list", workersView(game));
    html("#tile-market", terrainMarketView(game, ui));
    html("#building-market", buildingMarketView(game, ui));
    html("#selection", selectionView(game, ui));
    html("#harvest", harvestView(game));
    placementHelp();
    html("#trade-info", tradeView(game));
    $("#end-turn").innerHTML = game.finished
      ? "Voir les résultats →"
      : `<strong>Fin de tour →</strong><small>${harvestView(game).match(/Fin du tour : ([^<]+)/)?.[1] || "aucune récolte"}</small>`;
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
    if (!inMenu && !persistence.save(game)) {
      $("#game-notice").hidden = false;
      $("#game-notice").textContent = persistence.notice;
    }
  }
  function chooseUnit(id) {
    act(() => {
      selectUnit(game, id);
      ui.selected = null;
      ui.drag = null;
      ui.placement = null;
    });
  }
  function handleCell(x, y) {
    if (ui.drag) return;
    if (ui.placement) {
      const d = ui.placement;
      if (d.kind === "building") requestBuild({ x, y }, d.index, d.rotation);
      else act(() => {
        explore(game, d.index, x, y, d.rotation);
        ui.placement = null;
      });
      return;
    }
    const own = pawns(game, game.active).filter((p) => p.x === x && p.y === y);
    if (own.length && !game.finished && ui.mode !== "inspect" && !(actor(game).type === "soldier" && movementPaths(game).has(key(x,y)))) {
      chooseUnit((own.find((p) => p.id !== game.selectedUnitId) || own[0]).id);
      return;
    }
    ui.selected = { x, y };
    if (ui.mode === "move" && attackPaths(game).has(key(x,y))) {
      render();
      return;
    }
    if (ui.mode === "move" && movementPaths(game).has(key(x, y)))
      act(() => moveUnitTo(game, x, y));
    else render();
  }
  let pendingBuild = null;
  function requestBuild(pos, index, rotation) {
    const error = buildError(game, index, pos.x, pos.y, rotation, {
      allowGold: true,
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
    if (!payment.gold) {
      completeBuild(attempt);
      return;
    }
    pendingBuild = attempt;
    const missing = costText(payment.missing);
    $("#prestige-warning").textContent =
      `Il manque ${missing}. Acheter ces ressources à la banque pour ${payment.gold} or ? Les ressources disponibles seront aussi dépensées.`;
    $("#prestige-dialog .confirm").textContent =
      `Payer ${payment.gold} or`;
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
          allowGold: attempt.payment.gold > 0,
          expectedGold: attempt.payment.gold,
        });
        ui.placement = null;
        ui.selected = { x: attempt.x, y: attempt.y };
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
          ui.placement = null;
        },
        { message: "Marché renouvelé." },
      ),
    );
  function rotate(kind = ui.drag?.kind || ui.placement?.kind || "terrain", step = 1) {
    if (game.finished || !["terrain", "building"].includes(kind)) return;
    const field = kind === "building" ? "buildingRotation" : "rotation";
    ui[field] = (ui[field] + step + 4) % 4;
    if (ui.drag?.kind === kind) ui.drag.rotation = ui[field];
    if (ui.placement?.kind === kind) ui.placement.rotation = ui[field];
    render();
    drag.refresh();
  }
  $(".game-layout").addEventListener("wheel", (event) => {
    const hovered = event.target.closest?.("[data-tile],[data-building]");
    const kind = ui.drag?.kind || ui.placement?.kind ||
      (hovered?.hasAttribute("data-building") ? "building" :
        hovered?.hasAttribute("data-tile") ? "terrain" : null);
    if (game.finished || !["terrain", "building"].includes(kind)) return;
    event.preventDefault();
    rotate(kind, event.deltaY < 0 ? -1 : 1);
  }, { passive: false });
  function showResults() {
    const a = totalScore(game, 0),
      b = game.players.length > 1 ? totalScore(game, 1) : 0;
    $("#winner").textContent =
      game.victory === "conquest"
        ? `${game.players[game.winner].name} conquiert le donjon et remporte la partie !`
        : game.mode === "solo"
        ? `Votre royaume : ${a} points`
        : a === b
          ? "Deux couronnes, une victoire partagée."
          : `${game.players[a > b ? 0 : 1].name} l’emporte !`;
    html("#results", `<div class="result-grid">${resultsView(game)}</div>`);
    if (!$("#result-dialog").open) $("#result-dialog").showModal();
  }

  document.addEventListener("click", (event) => {
    const card = event.target.closest("[data-building],[data-tile]");
    const detail = event.target.closest("[data-building-details]");
    if (card && !game.finished) {
      ui.placement = dragFromCard(card, ui);
      ui.selected = null;
      render();
      return;
    }
    if (detail) {
      const type = detail.dataset.buildingDetails;
      const rotation = Number(detail.dataset.buildingOrientation || 0);
      html("#building-details-content", buildingDetailsView(type, rotation));
      $("#building-details-dialog").showModal();
      return;
    }
    const unit = event.target.closest("[data-unit]");
    if (unit) {
      chooseUnit(unit.dataset.unit === "" ? null : Number(unit.dataset.unit));
      return;
    }
    const mode = event.target.closest("[data-mode]");
    if (mode) {
      ui.mode = mode.dataset.mode;
      ui.placement = null;
      render();
      return;
    }
    const button = event.target.closest("[data-action]");
    if (!button || button.disabled) return;
    const position = button.dataset.position
      ? parseKey(button.dataset.position)
      : null;
    switch (button.dataset.action) {
      case "attack":
        act(() => moveUnitTo(game, ui.selected.x, ui.selected.y));
        break;
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
  document.addEventListener("change", event => {
    if (event.target.matches("[data-army-size]")) act(() => selectArmy(game,Number(event.target.value)));
  });
  $("#end-turn").addEventListener("click", () => {
    if (game.finished) {
      showResults();
      return;
    }
    act(() => {
      endTurn(game);
      ui.selected = null;
      ui.placement = null;
    });
    if (game.finished) showResults();
    else toast(`${game.players[game.active].name} : à vous de jouer.`);
  });
  $("#rules-button").addEventListener("click", () =>
    $("#rules-dialog").showModal(),
  );
  $("#building-details-dialog .close-building-details").addEventListener("click", () =>
    $("#building-details-dialog").close(),
  );
  $("#rules-dialog .close").addEventListener("click", () =>
    $("#rules-dialog").close(),
  );
  $(".close-rules").addEventListener("click", () => $("#rules-dialog").close());
  $("#menu-button").addEventListener("click", showMenu);
  $("#resume-game").addEventListener("click",enterGame);
  function requestNewGame(mode) {
    nextMode = mode;
    beginNewGame();
  }
  for (const button of document.querySelectorAll("[data-game-mode]"))
    button.addEventListener("click", () =>
      requestNewGame(button.dataset.gameMode),
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
      enterGame();
    }
  }
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
      ui.placement = null;
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
      ui.placement = null;
      ui.selected = null;
      if (ui.drag.kind === "unit" && ui.drag.id !== game.selectedUnitId) selectUnit(game, ui.drag.id);
      render();
    },
    preview(pos) {
      ui.drag.position = pos;
      const result = dragPreview(game, ui.drag, pos);
      board.preview(result);
      placementHelp(result?.error || (result ? "Placement possible · Relâchez pour placer." : null));
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
  showMenu();
}
