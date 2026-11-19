import { parseKey } from "./geometry.js";
import { installDrag } from "./ui/drag.js";
import {
  RULES,
  GAME_DEFAULTS,
  createGame,
  buyTerrain,
  startOpening,
  placeOpeningTile,
  GOLD,
  MISSIONS,
  RESOURCE_DEFINITIONS,
  buildingPayment,
  buildError,
  rerollMarket,
  rerollError,
  actor,
  buildingAt,
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
  iconHTML,
  terrainDiagram,
  buildingDiagram,
} from "./ui/html.js";
import {
  playersView,
  missionsView,
  barracksView,
  workersView,
  terrainMarketView,
  singleTerrainView,
  buildingMarketView,
  buildingDetailsView,
  selectionView,
  resultsView,
  rulesView,
  catalogueView,
  harvestView,
  tradeView,
} from "./ui/views.js";

export function startGame() {
  const $ = (selector) => document.querySelector(selector),
    ui = createUIState(),
    markup = new WeakMap();
  let game = createGame(),
    toastTimer;
  let undoState = null;
  let pendingBuild = null;
  let nextMode = "local",
    nextSettings = structuredClone(GAME_DEFAULTS);
  let inMenu = true;
  let unitCellClick = null;
  function showMenu() {
    drag.cancel();
    inMenu = true;
    $("#main-menu").hidden = false;
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
    $("#menu-button").focus();
    if (game.finished) showResults();
  }
  const board = createBoard($("#board"), $("#map-scroll"), handleCell, previewPlacement);
  function placementHelp(message) {
    const choice = ui.drag || ui.placement;
    if (!choice || !["terrain", "building", "single-terrain"].includes(choice.kind)) {
      $("#placement-help").textContent = game.opening
        ? "Choisissez une tuile, puis posez-la sur des cases vides. R : pivoter."
        : "";
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
  function act(action, { message, undoable = true, clearUndo = false } = {}) {
    const before = undoable ? structuredClone(game) : null;
    const signature = undoable ? JSON.stringify(game) : null;
    try {
      const previousClaims = game.missions.claimed.length;
      action();
      if (clearUndo) undoState = null;
      else if (undoable && JSON.stringify(game) !== signature) undoState = before;
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
      if (undoable && JSON.stringify(game) !== signature) {
        game = before;
        render();
      }
      toast(error.message);
      return false;
    }
  }
  function render() {
    const opening = game.opening;
    $(".game-layout").classList.toggle("opening", Boolean(opening));
    $("#opening-status").hidden = !opening;
    $("#opening-status").textContent = opening
      ? `Préparation ${opening.step + 1}/${opening.totalPlacements} · ${game.players[game.active].name} · ${opening.tiles.length} tuiles au choix`
      : "";
    html("#players", playersView(game));
    html("#missions", missionsView(game));
    $("#missions").style.setProperty("--mission-columns", RULES.missionMarketSize);
    $("#tile-market").style.setProperty("--terrain-columns", opening ? 3 : RULES.markets.terrainSize);
    for (const kind of ["terrain", "building"]) {
      const button = $("#reroll-" + kind),
        error = rerollError(game, kind);
      button.innerHTML = `↻ ${GOLD.rerollCost} ${iconHTML(RESOURCE_DEFINITIONS.gold.icon)}`;
      button.disabled = Boolean(error);
      button.title =
        error || `Remplacer les offres pour ${GOLD.rerollCost} or`;
    }
    html("#barracks-list", barracksView(game));
    html("#worker-list", workersView(game));
    html("#tile-market", terrainMarketView(game, ui));
    html("#single-terrain", singleTerrainView(game, ui));
    html("#building-market", buildingMarketView(game, ui));
    html("#selection", selectionView(game, ui));
    html("#harvest", harvestView(game));
    placementHelp();
    html("#trade-info", tradeView(game));
    $("#end-turn").disabled = Boolean(opening);
    $("#end-turn").innerHTML = opening
      ? "Posez une tuile terrain"
      : game.finished
      ? "Voir les résultats →"
      : `<strong>Fin de tour →</strong><small>${harvestView(game).match(/Fin du tour : ([^<]+)/)?.[1] || "aucune récolte"}</small>`;
    $("#round").innerHTML = opening
      ? `0 <small>/ ${game.turnLimit}</small>`
      : `${String(game.round).padStart(2, "0")} <small>/ ${game.turnLimit}</small>`;
    $("#rotation-label").textContent = `${ui.rotation * 90}°`;
    $("#building-rotation-label").textContent = `${ui.buildingRotation * 90}°`;
    $("#rotate").disabled = game.finished || !game.tileMarket.length;

    $("#rotate-building").disabled =
      game.finished || Boolean(opening) || !game.buildingMarket.length;
    $("#undo-action").disabled = !undoState;
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
    unitCellClick = null;
    act(() => {
      selectUnit(game, id);
      ui.selected = null;
      ui.drag = null;
      ui.placement = null;
    }, { undoable: false });
  }
  function handleCell(x, y) {
    const previousUnitClick = unitCellClick;
    unitCellClick = null;
    if (ui.drag) return;
    if (ui.placement) {
      const d = ui.placement;
      if (d.kind === "building") requestBuild({ x, y }, d.index, d.rotation);
      else act(() => {
        if (d.kind === "single-terrain") buyTerrain(game, d.terrain, x, y);
        else if (game.opening) placeOpeningTile(game, d.index, x, y, d.rotation);
        else explore(game, d.index, x, y, d.rotation);
        ui.placement = null;
      });
      return;
    }
    const own = pawns(game, game.active).filter((p) => p.x === x && p.y === y);
    if (ui.mode !== "inspect" && own.length && buildingAt(game, x, y) &&
        previousUnitClick?.game === game && previousUnitClick.owner === game.active &&
        previousUnitClick.x === x && previousUnitClick.y === y &&
        previousUnitClick.id === game.selectedUnitId &&
        actor(game).x === x && actor(game).y === y) {
      ui.selected = { x, y };
      render();
      return;
    }
    if (own.length && !game.finished && ui.mode !== "inspect" && !(actor(game).type === "soldier" && movementPaths(game).has(key(x,y)))) {
      chooseUnit((own.find((p) => p.id !== game.selectedUnitId) || own[0]).id);
      unitCellClick = { game, owner: game.active, x, y, id: game.selectedUnitId };
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
    if (!event.target.closest("#board")) unitCellClick = null;
    const card = event.target.closest("[data-building],[data-tile],[data-single-terrain]");
    const detail = event.target.closest("[data-building-details]");
    if (card && !game.finished && !(game.opening && card.hasAttribute("data-building"))) {
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
    if (event.target.matches("[data-army-size]")) act(() => selectArmy(game,Number(event.target.value)), { undoable: false });
  });
  $("#undo-action").addEventListener("click", () => {
    if (!undoState) return;
    game = undoState;
    undoState = null;
    pendingBuild = null;
    ui.selected = null;
    ui.placement = null;
    ui.drag = null;
    if ($("#result-dialog").open) $("#result-dialog").close();
    render();
    toast("Dernière action annulée.");
  });
  $("#end-turn").addEventListener("click", () => {
    if (game.opening) return;
    if (game.finished) {
      showResults();
      return;
    }
    act(() => {
      endTurn(game);
      ui.selected = null;
      ui.placement = null;
    }, { undoable: false, clearUndo: true });
    if (game.finished) showResults();
    else toast(`${game.players[game.active].name} : à vous de jouer.`);
  });
  $("#rules-button").addEventListener("click", () => {
    html(".rules-content", rulesView(game));
    $("#rules-dialog").showModal();
  });
  $("#building-details-dialog .close-building-details").addEventListener("click", () =>
    $("#building-details-dialog").close(),
  );
  $("#rules-dialog .close").addEventListener("click", () =>
    $("#rules-dialog").close(),
  );
  $(".close-rules").addEventListener("click", () => $("#rules-dialog").close());
  $("#menu-button").addEventListener("click", showMenu);
  const catalogueFilters = { tier: "all", tileSize: "all", terrain: "all", tileSort: "size" };
  let catalogueSection = "buildings";
  function renderCatalogue() {
    html("#catalogue-content", catalogueView(catalogueFilters));
    selectCatalogueSection(catalogueSection);
  }
  $("#catalogue-content").addEventListener("click", event => {
    const button = event.target.closest("[data-catalogue-tier]");
    if (!button) return;
    catalogueFilters.tier = button.dataset.catalogueTier;
    renderCatalogue();
    $(`[data-catalogue-tier="${catalogueFilters.tier}"]`).focus({ preventScroll: true });
  });
  $("#catalogue-content").addEventListener("change", event => {
    const field = event.target.dataset.catalogueFilter;
    if (!Object.hasOwn(catalogueFilters, field)) return;
    catalogueFilters[field] = event.target.value;
    renderCatalogue();
    $(`[data-catalogue-filter="${field}"]`).focus({ preventScroll: true });
  });
  $("#catalogue-button").addEventListener("click", () => {
    renderCatalogue();
    selectCatalogueSection("buildings");
    $("#catalogue-dialog").showModal();
    $("#catalogue-dialog").scrollTop = 0;
  });
  function selectCatalogueSection(section) {
    catalogueSection = section;
    for (const name of ["buildings", "tiles"]) {
      $(`#catalogue-${name}`).hidden = name !== section;
      $(`[data-catalogue-section="${name}"]`).setAttribute("aria-pressed", String(name === section));
    }
  }
  document.querySelectorAll("[data-catalogue-section]").forEach(button => {
    button.addEventListener("click", () => selectCatalogueSection(button.dataset.catalogueSection));
  });
  document.querySelectorAll("#catalogue-dialog .close, .close-catalogue").forEach(button => {
    button.addEventListener("click", () => $("#catalogue-dialog").close());
  });
  function requestNewGame(mode) {
    nextMode = mode;
    $("#settings-mode").textContent = mode === "solo" ? "Partie solo" : "Partie locale";
    $("#game-settings-dialog").showModal();
  }
  for (const button of document.querySelectorAll("[data-game-mode]"))
    button.addEventListener("click", () =>
      requestNewGame(button.dataset.gameMode),
    );
  function beginNewGame() {
    const created = act(
      () => {
        game = createGame(Math.random, nextMode, nextSettings);
        startOpening(game);
        Object.assign(ui, createUIState());
      },
      {
        undoable: false,
        clearUndo: true,
        message:
          nextMode === "solo"
            ? "Votre royaume s’éveille."
            : "Deux nouveaux royaumes s’éveillent.",
      },
    );
    if (created) {
      $("#game-settings-dialog").close();
      enterGame();
    }
  }
  const settingInputs = {
    rounds: ["#setting-rounds", "#setting-rounds-value", "tours"],
    openingTilesPerPlayer: ["#setting-opening", "#setting-opening-value", "tuiles"],
    boardSize: ["#setting-board", "#setting-board-value", "grille"],
    material: ["#setting-material", "#setting-material-value", "bois"],
    food: ["#setting-food", "#setting-food-value", "blé"],
    gold: ["#setting-gold", "#setting-gold-value", "or"],
  };
  function updateSettingLabels() {
    for (const [name, [inputSelector, outputSelector]] of Object.entries(settingInputs)) {
      const value = Number($(inputSelector).value),
        output = $(outputSelector);
      output.textContent = name === "boardSize" ? `${value} × ${value}` : String(value);
    }
  }
  for (const [name, [inputSelector]] of Object.entries(settingInputs)) {
    const input = $(inputSelector),
      defaultValue = Object.hasOwn(GAME_DEFAULTS.resources, name)
        ? GAME_DEFAULTS.resources[name]
        : GAME_DEFAULTS[name];
    input.value = defaultValue;
    input.addEventListener("input", updateSettingLabels);
  }
  updateSettingLabels();
  $("#settings-cancel").addEventListener("click", () =>
    $("#game-settings-dialog").close(),
  );
  $("#settings-start").addEventListener("click", () => {
    nextSettings = {
      rounds: Number($("#setting-rounds").value),
      openingTilesPerPlayer: Number($("#setting-opening").value),
      boardSize: Number($("#setting-board").value),
      resources: {
        material: Number($("#setting-material").value),
        food: Number($("#setting-food").value),
        gold: Number($("#setting-gold").value),
      },
    };
    beginNewGame();
  });
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
      game.selectedUnitId = null;
      game.armySelection = null;
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
  $(".game-layout").addEventListener("contextmenu", event => {
    event.preventDefault();
    drag.cancel();
    ui.selected = null;
    ui.placement = null;
    ui.drag = null;
    game.selectedUnitId = null;
    game.armySelection = null;
    render();
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
        return terrainDiagram((game.opening ? game.opening.tiles : game.tileMarket)[d.index], d.rotation);
      if (d.kind === "building")
        return buildingDiagram(game.buildingMarket[d.index], d.rotation);
      if (d.kind === "single-terrain")
        return terrainDiagram({ cells: [{ x: 0, y: 0, terrain: d.terrain }] });
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
        act(() => game.opening
          ? placeOpeningTile(game, d.index, pos.x, pos.y, d.rotation)
          : explore(game, d.index, pos.x, pos.y, d.rotation));
      else if (d.kind === "single-terrain")
        act(() => buyTerrain(game, d.terrain, pos.x, pos.y));
      else requestBuild(pos, d.index, d.rotation);
    },
    end() {
      ui.drag = null;
      render();
    },
  });
  html(".rules-content", rulesView(game));
  render();
  showMenu();
}
