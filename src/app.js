import { ruleIssueText } from "./rule-errors.js";
import { missionRewardText } from "./mission-rewards.js";
import { t, definitionText, translateMessage, kingdomName, getLanguage, setLanguage, restoreLanguage, translateDocument } from "./i18n.js";
import { parseKey } from "./geometry.js";
import { MAPS } from "./maps.js";
import { OnlineClient } from './online.js';
import { monitorServerHealth } from './server-health.js';
import { installDrag } from "./ui/drag.js";
import {
  RULES,
  GAME_DEFAULTS,
  createGame,
  buyTerrain as localBuyTerrain,
  startOpening,
  placeOpeningTile as localPlaceOpeningTile,
  GOLD,
  MISSIONS,
  RESOURCE_DEFINITIONS,
  buildingPayment,
  buildIssue,
  rerollMarket as localRerollMarket,
  rerollIssue,
  actor,
  moveUnitTo as localMoveUnitTo,
  buildingAt,
  movementPaths,
  attackPaths,
  selectArmy,
  pawns,
  explore as localExplore,
  build as localBuild,
  produce as localProduce,
  endTurn as localEndTurn,
  selectUnit,
  trainUnit as localTrainUnit,
  totalScore,
  key,
} from "./engine.js";
import { createUIState, hasSelectedUnit } from "./ui/state.js";
import { dragFromCard, dragPreview, placementOrigin, placementGuidance, placementErrorText } from "./ui/interactions.js";
import { piece } from "./ui/pieces.js";
import { createBoard } from "./ui/board.js";
import {
  e,
  costText,
  resourceTextHTML,
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
  harvestGains,
} from "./ui/views.js";

export function startGame({ initialGame = null } = {}) {
  restoreLanguage();
  translateDocument(document, resourceTextHTML);
  const $ = (selector) => document.querySelector(selector),
    ui = createUIState(),
    markup = new WeakMap();
  let game = initialGame ?? createGame(),
    toastTimer;
  let undoState = null;
  let pendingBuild = null;
  let nextMode = "local",
    nextSettings = structuredClone(GAME_DEFAULTS);
  let inMenu = true;
  let unitCellClick = null;
  let announcedTurn = null;
  function announceTurn() {
    if (inMenu || game.finished || game.mode === 'solo') return;
    const turn = `${game.onlineCode || 'local'}:${game.round}:${game.active}:${game.opening?.step ?? 'play'}`;
    if (announcedTurn === turn) return;
    announcedTurn = turn;
    if (online.session && game.active !== online.session.player) return;
    toast(online.session ? t("app.yourTurn") : t("app.turnForTheKingdom", [game.active === 0 ? t("app.ofAmber") : t("app.ofJade")]));
  }
  let queuedCommand = null;
  const online = new OnlineClient(result => {
    const changed = result.code !== game.onlineCode || result.revision !== game.onlineRevision;
    if (changed) {
      const selected = game.selectedUnitId, army = game.armySelection;
      const selection = ui.unitSelection;
      const sameTurn = game.active === result.game.active && game.round === result.game.round && game.onlineCode === result.code;
      game = result.game;
      if (sameTurn && game.active === result.player && selected !== null && game.players[game.active].units.some(u => u.id === selected)) {
        game.selectedUnitId = selected; game.armySelection = army;
      }
      game.onlineRevision = result.revision;
      game.onlineCode = result.code;
      undoState = null; pendingBuild = null;
      Object.assign(ui, createUIState());
      if (sameTurn && selection) ui.unitSelection = selection;
    }
    render();
    if (changed && game.finished && !inMenu) showResults();
    if (!result.started) showLobby(result, changed);
    else if (inMenu) { $('#game-settings-dialog').close(); enterGame(); }
  }, error => { $('#online-status').textContent = t("app.connectionInterruptedRetrying", [translateMessage(error.message)]); });
  function showLobby(session, syncSettings = true) {
    inMenu = true;
    $('#lobby-info').hidden = false;
    $('#settings-title').textContent = session.joined ? t("app.gameReady") : t("app.waitingForTheSecondPlayer");
    $('#setting-clock-row').hidden = false;
    $('#setting-clock').disabled = session.player !== 0;
    $('#setting-missions').disabled = session.player !== 0;
    $('#setting-map').disabled = session.player !== 0;
    if (syncSettings && (session.player !== 0 || !$('#game-settings-dialog').open)) $('#setting-map').value = session.settings.mapId ?? GAME_DEFAULTS.mapId;
    updateMapDescription();
    if (syncSettings && (session.player !== 0 || !$('#game-settings-dialog').open)) $('#setting-clock').value = session.settings.turnSeconds ?? 0;
    if (syncSettings && (session.player !== 0 || !$('#game-settings-dialog').open)) $('#setting-missions').checked = session.settings.missionsEnabled ?? GAME_DEFAULTS.missionsEnabled;
    $('#settings-mode').textContent = session.player === 0 ? t("app.youAreTheHost") : t("app.guest");
    $('#lobby-code').textContent = session.code;
    $('#lobby-players').textContent = t("app.amber", [kingdomName(session.game.players[0].name), session.joined ? kingdomName(session.game.players[1].name) + ' (Jade)' : t("app.waitingForTheSecondPlayer2")]);
    $('#settings-start').hidden = true;
    $('#lobby-start').hidden = session.player !== 0;
    $('#lobby-start').disabled = !session.joined || online.busy;
    for (const [name, [selector]] of Object.entries(settingInputs)) {
      $(selector).disabled = session.player !== 0;
      if (syncSettings && (session.player !== 0 || !$('#game-settings-dialog').open)) $(selector).value = session.settings.resources[name] ?? session.settings[name] ?? GAME_DEFAULTS[name];
    }
    updateSettingLabels();
    if (!$('#game-settings-dialog').open) $('#game-settings-dialog').showModal();
  }
  const mutation = (type, fn) => (state, ...args) => {
    if (online.session) {
      if (online.busy || !online.session.joined || state.active !== online.session.player) throw Error(t("app.waitForYourTurn"));
      queuedCommand = { type, args, unit: state.selectedUnitId, army: state.armySelection?.length ?? null };
      return;
    }
    return fn(state, ...args);
  };
  const buyTerrain = mutation('buyTerrain', localBuyTerrain), placeOpeningTile = mutation('placeOpeningTile', localPlaceOpeningTile),
    rerollMarket = mutation('rerollMarket', localRerollMarket), explore = mutation('explore', localExplore),
    build = mutation('build', localBuild), produce = mutation('produce', localProduce), endTurn = mutation('endTurn', localEndTurn),
    trainUnit = mutation('trainUnit', localTrainUnit),
    moveUnitTo = mutation('moveUnitTo', localMoveUnitTo);
  function showMenu() {
    refreshHistory();
    clearTimeout(toastTimer);
    $('#toast').classList.remove('visible');
    announcedTurn = null;
    drag.cancel();
    inMenu = true;
    $("#main-menu").hidden = false;
    $("header").hidden = true;
    $("main").hidden = true;
    $("[data-game-mode='solo']").focus();
  }
  async function refreshHistory() {
    if (!globalThis.location?.href || !/^https?:/.test(globalThis.location.href)) return;
    const preview = new URL(globalThis.location.href).searchParams.get('previewHistory') === '1';
    if (preview) {
      $('#game-history').hidden = false;
      html('#history-list', `<div class="history-row"><span>${t("refreshHistory.alice")}<strong>24</strong></span><span class="history-versus">${t("refreshHistory.versus")}</span><span>${t("refreshHistory.bob")}<strong>18</strong></span><span class="history-winner">${t("refreshHistory.alice2")}</span></div><p class="history-preview-note">${t("refreshHistory.previewFictionalGame")}</p>`);
      return;
    }
    try {
      const client = new OnlineClient(() => {}, () => {});
      await client.configure();
      const result = await client.request('/history');
      $('#game-history').hidden = !result.enabled;
      html('#history-list', result.games.length ? result.games.map(item =>
        `<div class="history-row"><span>${e(item.names[0])} <strong>${e(item.scores[0])}</strong></span><span class="history-versus">${t("refreshHistory.versus")}</span><span>${e(item.names[1])} <strong>${e(item.scores[1])}</strong></span><span class="history-winner">${item.winner === null ? t("app.draw") : `♛ ${e(item.names[item.winner])}`}</span></div>`
      ).join('') : `<p>${t("refreshHistory.noCompletedGamesYet")}</p>`);
    } catch { $('#game-history').hidden = true; }
  }
  function enterGame() {
    inMenu = false;
    html('.rules-content', rulesView(game));
    $("#main-menu").hidden = true;
    $("header").hidden = false;
    $("main").hidden = false;
    render();
    $("#menu-button").focus();
    if (game.finished) showResults();
  }
  const board = createBoard($("#board"), $("#map-scroll"), handleCell, previewPlacement);
  function placementHelp(result) {
    const choice = ui.drag || ui.placement;
    const mobile = window.matchMedia("(pointer: coarse), (max-width: 850px)").matches;
    $(".game-layout").classList.toggle("has-placement", Boolean(choice));
    $('#placement-rotation-label').textContent = `${(choice?.kind === 'building' ? ui.buildingRotation : ui.rotation) % 4 * 90}°`;
    $("#rotate-placement").disabled = game.finished || !["terrain", "building"].includes(choice?.kind);
    $("#mirror-placement").disabled = $("#rotate-placement").disabled;
    $("#mirror-placement").setAttribute("aria-pressed", String((choice?.kind === "building" ? ui.buildingRotation : ui.rotation) >= 4));
    $("#cancel-placement").disabled = !choice;
    if (!choice) {
      $("#placement-help").innerHTML = resourceTextHTML(game.opening
        ? t("app.chooseATerrainTile")
        : !hasSelectedUnit(game, ui) ? t("placement.selectUnitFirst")
        : mobile ? t("placement.touchGuide") : t("placement.chooseDestination"));
      return;
    }
    if (result?.error) {
      $("#placement-help").innerHTML = resourceTextHTML(placementErrorText(result.error, true));
      return;
    }
    if (result && ui.drag) {
      $("#placement-help").innerHTML = resourceTextHTML(t("app.releaseToPlace"));
      return;
    }
    if (["terrain", "building", "single-terrain"].includes(choice.kind)) {
      const options = [...placementGuidance(game, choice).values()];
      if (!options.some(option => !option.error)) {
        const reasons = new Set(options.map(option => JSON.stringify(option.error)));
        $("#placement-help").innerHTML = resourceTextHTML(reasons.size === 1
          ? placementErrorText(options[0].error, true)
          : t("app.cannotPlaceHereRotateOrChooseAnother"));
        return;
      }
    }
    const action = mobile ? t("app.tap") : t("app.click");
    const instruction = choice.kind === "unit" ? t("app.aReachableSpaceToMoveTheUnit")
      : t("app.aGreenSpaceToPlace", [choice.kind === "building" ? t("app.theBuilding") : choice.kind === "single-terrain" ? t("app.theTerrain") : t("app.theTerrainTile")]);
    $("#placement-help").innerHTML = resourceTextHTML(`${action} ${instruction}`);
  }
  function previewPlacement(pos) {
    if (ui.drag) return;
    const result = dragPreview(game, ui.placement, pos);
    board.preview(result);
    placementHelp(result);
  }
  function html(selector, value) {
    const node = $(selector);
    if (markup.get(node) !== value) {
      node.innerHTML = value;
      markup.set(node, value);
    }
  }
  function toastError(error) {
    toast(error.issue ? ruleIssueText(error.issue, true) : error.message);
  }
  function toast(message) {
    $("#toast").innerHTML = resourceTextHTML(translateMessage(message));
    $("#toast").classList.add("visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(
      () => $("#toast").classList.remove("visible"),
      4500,
    );
  }
  function act(action, { message, undoable = true, clearUndo = false } = {}) {
    queuedCommand = null;
    const before = undoable ? structuredClone(game) : null;
    const signature = undoable ? JSON.stringify(game) : null;
    try {
      const previousClaims = game.missions.claimed.length;
      action();
      if (queuedCommand) {
        const command = queuedCommand;
        online.send(command).then(() => { if (game.finished) showResults(); }).catch(error => toastError(error)).finally(render);
        render();
        return true;
      }
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
                t("app.missionReward", [definitionText("missions", MISSIONS[c.id]), missionRewardText(MISSIONS[c.id].reward)]),
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
      toastError(error);
      return false;
    }
  }
  function render() {
    if (ui.unitSelection && !hasSelectedUnit(game, ui)) ui.unitSelection = null;
    announceTurn();
    const session = online.session;
    $('#online-status').hidden = !session;
    if (session) {
      const invite = new URL(globalThis.location.href); invite.hash = `join=${session.code}`;
      $('#online-status').textContent = t("app.gameYouInvitation", [session.code, kingdomName(game.players[session.player].name), !session.joined ? t("app.waitingForAnOpponent") : online.busy ? t("app.sendingMove") : game.active === session.player ? t("app.yourTurn") : t("app.opponentSTurn"), invite.href]);
      if (session.deadline && !game.finished) $('#online-status').textContent += t("app.timeLeftS", [Math.max(0, Math.ceil((session.deadline - session.serverNow) / 1000))]);
      $('#menu-button').textContent = game.finished ? t("app.mainMenu") : t("app.leaveGame");
    } else {
      $('#menu-button').textContent = t("app.mainMenu");
    }
    const opening = game.opening;
    $(".game-layout").classList.toggle("opening", Boolean(opening));
    $("#opening-status").hidden = !opening;
    $("#opening-status").textContent = opening
      ? t("app.setupTilesToChooseFrom", [opening.step + 1, opening.totalPlacements, kingdomName(game.players[game.active].name), opening.tiles.length])
      : "";
    html("#players", playersView(game));
    html("#missions", missionsView(game));
    $('#missions').hidden = game.missionsEnabled === false;
    $("#missions").style.setProperty("--mission-columns", RULES.missionMarketSize);
    $("#tile-market").style.setProperty("--terrain-columns", opening ? 3 : RULES.markets.terrainSize);
    for (const kind of ["terrain", "building"]) {
      const button = $("#reroll-" + kind),
        error = session ? session.rerollErrors[kind] : rerollIssue(game, kind);
      button.innerHTML = `↻ ${GOLD.rerollCost} ${iconHTML(RESOURCE_DEFINITIONS.gold.icon)}`;
      button.disabled = Boolean(error) || ui.mode === 'inspect';
      button.title =
        ruleIssueText(error, true) || t("app.replaceOffersForGold", [GOLD.rerollCost]);
    }
    html("#barracks-list", barracksView(game, ui));
    html("#worker-list", workersView(game, ui));
    html("#tile-market", terrainMarketView(game, ui));
    html("#single-terrain", singleTerrainView(game, ui));
    html("#building-market", buildingMarketView(game, ui));
    html("#selection", selectionView(game, ui));
    html("#harvest", harvestView(game));
    placementHelp();
    $("#end-turn").disabled = Boolean(opening);
    const automaticGains = harvestGains(game);
    $("#end-turn").innerHTML = opening
      ? t("app.placeATerrainTile")
      : game.finished
      ? t("app.viewResults")
      : `<strong>${t("render.endTurn")}</strong>${automaticGains !== t("production.noAutomatic") ? `<small>${automaticGains}</small>` : ""}`;
    $("#round").innerHTML = opening
      ? `0 <small>/ ${game.turnLimit}</small>`
      : `${String(game.round).padStart(2, "0")} <small>/ ${game.turnLimit}</small>`;
    $("#rotation-label").textContent = `${ui.rotation % 4 * 90}°`;
    $("#building-rotation-label").textContent = `${ui.buildingRotation % 4 * 90}°`;
    $("#rotate").disabled = game.finished || !game.tileMarket.length;

    $("#rotate-building").disabled =
      game.finished || Boolean(opening) || !game.buildingMarket.length;
    for (const [id, rotation] of [["", ui.rotation], ["-building", ui.buildingRotation]]) {
      $("#mirror" + id).disabled = $("#rotate" + id).disabled;
      $("#mirror" + id).setAttribute("aria-pressed", String(rotation >= 4));
    }
    $("#undo-action").disabled = Boolean(session) || !undoState;
    if (session && (online.busy || !session.joined || game.active !== session.player)) $('#end-turn').disabled = true;
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
      ui.unitSelection = { id, owner: game.active, round: game.round };
      ui.selected = null;
      ui.drag = null;
      ui.placement = null;
    }, { undoable: false });
  }
  function handleCell(x, y, clickedUnitId) {
    const previousUnitClick = unitCellClick;
    unitCellClick = null;
    if (ui.drag) return;
    if (ui.placement) {
      const d = ui.placement;
      ({ x, y } = placementOrigin(game, d, { x, y }));
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
    if (clickedUnitId !== undefined && !game.finished && !game.opening && ui.mode !== 'inspect') {
      chooseUnit(clickedUnitId === '' ? null : Number(clickedUnitId));
      return;
    }
    if (hasSelectedUnit(game, ui)) {
      const unit = actor(game);
      if (unit.ended || (unit.type === "soldier" && (unit.acted || unit.moves < 1 && !attackPaths(game).has(key(x,y))))) {
        ui.unitSelection = null;
        if (unit.x === x && unit.y === y) {
          ui.selected = { x, y };
          render();
          return;
        }
      }
    }
    if (hasSelectedUnit(game, ui) && own.length && buildingAt(game, x, y) &&
        previousUnitClick?.game === game && previousUnitClick.owner === game.active &&
        previousUnitClick.x === x && previousUnitClick.y === y &&
        previousUnitClick.id === game.selectedUnitId &&
        actor(game).x === x && actor(game).y === y) {
      ui.selected = { x, y };
      render();
      return;
    }
    if (own.length && !game.finished && !game.opening && ui.mode !== "inspect" && !(hasSelectedUnit(game, ui) && movementPaths(game).has(key(x,y)))) {
      chooseUnit((hasSelectedUnit(game, ui) ? own.find((p) => p.id !== game.selectedUnitId) || own[0] : own[0]).id);
      unitCellClick = { game, owner: game.active, x, y, id: game.selectedUnitId };
      return;
    }
    ui.selected = { x, y };
    if (hasSelectedUnit(game, ui) && attackPaths(game).has(key(x,y))) {
      render();
      return;
    }
    if (hasSelectedUnit(game, ui) && movementPaths(game).has(key(x, y)))
      act(() => moveUnitTo(game, x, y));
    else render();
  }
  function requestBuild(pos, index, rotation) {
    const error = buildIssue(game, index, pos.x, pos.y, rotation, {
      allowGold: true,
    });
    if (error) {
      toast(ruleIssueText(error, true));
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
    $("#prestige-warning").innerHTML =
      resourceTextHTML(t("app.missingBuyTheseResourcesFromTheBank", [missing, payment.gold]));
    $("#prestige-dialog .confirm").innerHTML =
      resourceTextHTML(t("app.payGold", [payment.gold]));
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
          throw Error(t("app.thePlacementOrItsCostHasChanged"));
        build(game, attempt.index, attempt.x, attempt.y, attempt.rotation, {
          allowGold: attempt.payment.gold > 0,
          expectedGold: attempt.payment.gold,
        });
        ui.placement = null;
        ui.selected = { x: attempt.x, y: attempt.y };
      },
      { message: t("app.constructionComplete") },
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
        { message: t("app.marketRefreshed") },
      ),
    );
  function mirror(kind = ui.drag?.kind || ui.placement?.kind || "terrain") {
    if (game.finished || !["terrain", "building"].includes(kind)) return;
    const field = kind === "building" ? "buildingRotation" : "rotation";
    ui[field] ^= 4;
    if (ui.drag?.kind === kind) ui.drag.rotation = ui[field];
    if (ui.placement?.kind === kind) ui.placement.rotation = ui[field];
    render();
    drag.refresh();
  }
  function rotate(kind = ui.drag?.kind || ui.placement?.kind || "terrain", step = 1) {
    if (game.finished || !["terrain", "building"].includes(kind)) return;
    const field = kind === "building" ? "buildingRotation" : "rotation";
    ui[field] = (ui[field] & 4) + ((ui[field] + step + 4) % 4);
    if (ui.drag?.kind === kind) ui.drag.rotation = ui[field];
    if (ui.placement?.kind === kind) ui.placement.rotation = ui[field];
    render();
    drag.refresh();
  }
  $(".game-layout").addEventListener("wheel", (event) => {
    const hovered = event.target.closest?.("[data-tile],[data-building]");
    const kind = ui.drag?.kind ||
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
      game.victory === 'resignation'
        ? t("app.winsByResignation", [kingdomName(game.players[game.winner].name)])
        : game.victory === "conquest"
        ? t("app.conquersTheKeepAndWinsTheGame", [kingdomName(game.players[game.winner].name)])
        : game.mode === "solo"
        ? t("app.yourKingdomPoints", [a])
        : a === b
          ? t("app.twoCrownsASharedVictory")
          : t("app.wins", [kingdomName(game.players[a > b ? 0 : 1].name)]);
    html("#results", `<div class="result-grid">${resultsView(game)}</div>`);
    if (!$("#result-dialog").open) $("#result-dialog").showModal();
  }

  document.addEventListener("click", (event) => {
    if (event.target.closest('[data-close-dialog]')) {
      $(`#${event.target.closest('[data-close-dialog]').dataset.closeDialog}`).close();
      return;
    }
    if (!event.target.closest("#board")) unitCellClick = null;
    const card = event.target.closest("[data-building],[data-tile],[data-single-terrain]");
    const detail = event.target.closest("[data-building-details]");
    if (card && !game.finished && !(game.opening && card.hasAttribute("data-building"))) {
      if (ui.mode === 'inspect') return;
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
    const workerSelect = event.target.closest('[data-worker-select]');
    if (workerSelect && !workerSelect.disabled) { chooseUnit(Number(workerSelect.dataset.workerSelect)); return; }
    const mode = event.target.closest("[data-mode]");
    if (mode) {
      ui.mode = mode.dataset.mode;
      ui.unitSelection = null;
      game.selectedUnitId = null;
      game.armySelection = null;
      ui.placement = null;
      render();
      return;
    }
    const button = event.target.closest("[data-action]");
    if (!button || button.disabled || ui.mode === 'inspect') return;
    const position = button.dataset.position
      ? parseKey(button.dataset.position)
      : null;
    switch (button.dataset.action) {
      case "attack":
        if (!hasSelectedUnit(game, ui)) return;
        act(() => moveUnitTo(game, ui.selected.x, ui.selected.y));
        break;
      case "move":
        if (!hasSelectedUnit(game, ui)) return;
        act(() => moveUnitTo(game, ui.selected.x, ui.selected.y));
        break;
      case "produce":
        if (!hasSelectedUnit(game, ui)) return;
        act(() => produce(game));
        break;
      case "train":
        act(() => trainUnit(game, ...position, button.dataset.type), {
          message: t("app.unitRecruitedItWillBeActiveNext"),
        });
        break;
    }
  });
  $("#rotate").addEventListener("click", () => rotate("terrain"));
  $("#rotate-building").addEventListener("click", () => rotate("building"));
  $("#mirror").addEventListener("click", () => mirror("terrain"));
  $("#mirror-building").addEventListener("click", () => mirror("building"));
  $("#mirror-placement").addEventListener("click", () => mirror());
  $("#rotate-placement").addEventListener("click", () => rotate());
  $("#cancel-placement").addEventListener("click", () => {
    drag.cancel();
    ui.placement = null;
    render();
    board.preview(null);
  });
  document.addEventListener("change", event => {
    if (event.target.matches("[data-army-size]") && hasSelectedUnit(game, ui)) act(() => {
      selectArmy(game,Number(event.target.value));
      ui.unitSelection.id = game.selectedUnitId;
    }, { undoable: false });
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
    toast(t("app.lastActionUndone"));
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
  });
  function openRules() {
    html(".rules-content", rulesView(inMenu ? undefined : game));
    $("#rules-dialog").showModal();
  }
  $("#rules-button").addEventListener("click", openRules);
  $('#menu-rules-button').addEventListener('click', openRules);
  $("#building-details-dialog .close-building-details").addEventListener("click", () =>
    $("#building-details-dialog").close(),
  );
  $("#rules-dialog .close").addEventListener("click", () =>
    $("#rules-dialog").close(),
  );
  $("#menu-button").addEventListener("click", async () => {
    if (online.session) {
      try {
        if (!game.finished && online.session.started) await online.resign();
        else online.stop();
      } catch (error) { toastError(error); return; }
    }
    showMenu();
  });
  const catalogueFilters = { tier: "all", tileSize: "all", terrain: "all", tileSort: "size", mapSize: GAME_DEFAULTS.boardSize };
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
  function openCatalogue() {
    renderCatalogue();
    selectCatalogueSection("buildings");
    $("#catalogue-dialog").showModal();
    $("#catalogue-dialog").scrollTop = 0;
  }
  $("#catalogue-button").addEventListener("click", openCatalogue);
  $('#game-catalogue-button').addEventListener('click', openCatalogue);
  function selectCatalogueSection(section) {
    catalogueSection = section;
    for (const name of ["buildings", "tiles", "maps"]) {
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
    $('#setting-map').disabled = false;
    $('#setting-missions').disabled = false;
    $('#setting-clock-row').hidden = true;
    online.stop();
    $('#lobby-info').hidden = true;
    $('#lobby-start').hidden = true;
    $('#settings-title').textContent = t("app.setUpYourKingdom");
    $('#settings-start').hidden = false;
    $('#settings-start').textContent = t("app.startGame");
    for (const [, [selector]] of Object.entries(settingInputs)) $(selector).disabled = false;
    nextMode = mode;
    $("#settings-mode").textContent = mode === "solo" ? t("app.soloGame") : mode === 'online' ? t("app.onlineGame") : t("app.localGame");
    $("#game-settings-dialog").showModal();
  }
  for (const button of document.querySelectorAll("[data-game-mode]"))
    button.addEventListener("click", () =>
      requestNewGame(button.dataset.gameMode),
    );
  function beginNewGame() {
    if (nextMode === 'online') {
      online.connect(null, nextSettings).catch(error => toastError(error));
      return;
    }
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
            ? t("app.yourKingdomAwakens")
            : t("app.newKingdomsAwaken"),
      },
    );
    if (created) {
      $("#game-settings-dialog").close();
      enterGame();
    }
  }
  const settingInputs = {
    rounds: ["#setting-rounds", "#setting-rounds-value"],
    openingTilesPerPlayer: ["#setting-opening", "#setting-opening-value"],
    boardSize: ["#setting-board", "#setting-board-value"],
    material: ["#setting-material", "#setting-material-value"],
    food: ["#setting-food", "#setting-food-value"],
    gold: ["#setting-gold", "#setting-gold-value"],
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
    input.addEventListener('change', scheduleLobbySave);
  }
  let lobbySaveTimer;
  function updateMapDescription() {
    const map = MAPS.find(map => map.id === $('#setting-map').value);
    $('#setting-map-description').textContent = map ? definitionText('maps', map, 'description') : t('maps.randomHelp');
  }
  function renderMapOptions() {
    const current = $('#setting-map').value || GAME_DEFAULTS.mapId;
    html('#setting-map', `<option value="random">${e(t('maps.random'))}</option>${MAPS.map(map => `<option value="${e(map.id)}">${e(definitionText('maps', map))}</option>`).join('')}`);
    $('#setting-map').value = current;
    updateMapDescription();
  }
  renderMapOptions();
  $('#setting-map').addEventListener('change', () => { updateMapDescription(); scheduleLobbySave(); });
  $('#setting-missions').checked = GAME_DEFAULTS.missionsEnabled;
  $('#setting-missions').addEventListener('change', scheduleLobbySave);
  $('#setting-clock').addEventListener('change', scheduleLobbySave);
  function scheduleLobbySave() {
    clearTimeout(lobbySaveTimer);
    if (!online.session || online.session.started || online.session.player !== 0) return;
    lobbySaveTimer = setTimeout(async () => {
      if (!online.session || online.session.started) return;
      if (online.busy) { scheduleLobbySave(); return; }
      try { await online.lobby(collectSettings()); } catch (error) { toast(t("app.settingsNotSaved", [translateMessage(error.message)])); }
    }, 300);
  }
  updateSettingLabels();
  $("#settings-cancel").addEventListener("click", () => {
    if (online.session && !online.session.started) online.stop();
    $("#game-settings-dialog").close();
  });
  $('#game-settings-dialog').addEventListener('cancel', () => { if (online.session && !online.session.started) online.stop(); });
  function collectSettings() {
    nextSettings = {
      turnSeconds: Number($('#setting-clock').value || 0),
      rounds: Number($("#setting-rounds").value),
      mapId: $('#setting-map').value,
      openingTilesPerPlayer: Number($('#setting-opening').value),
      boardSize: Number($("#setting-board").value),
      missionsEnabled: $('#setting-missions').checked,
      resources: {
        material: Number($("#setting-material").value),
        food: Number($("#setting-food").value),
        gold: Number($("#setting-gold").value),
      },
    };
    return nextSettings;
  }
  $("#settings-start").addEventListener("click", () => {
    collectSettings();
    if (online.session && !online.session.started) online.lobby(nextSettings).then(() => toast(t("app.settingsSaved"))).catch(error => toastError(error));
    else beginNewGame();
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
      ui.unitSelection = null;
      game.selectedUnitId = null;
      game.armySelection = null;
      render();
      event.preventDefault();
    }
    if (
      ["r", "s"].includes(event.key.toLowerCase()) &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey
    ) {
      if (event.key.toLowerCase() === "s") mirror();
      else rotate();
      event.preventDefault();
    }
  });
  $(".game-layout").addEventListener("contextmenu", event => {
    event.preventDefault();
    drag.cancel();
    ui.selected = null;
    ui.placement = null;
    ui.drag = null;
    ui.unitSelection = null;
    game.selectedUnitId = null;
    game.armySelection = null;
    render();
  });
  const drag = installDrag({
    root: $(".game-layout"),
    canStart: card => ui.mode !== 'inspect' && (!game.opening || card.hasAttribute('data-tile')),
    begin(card) {
      ui.drag = dragFromCard(card, ui);
      ui.placement = null;
      ui.selected = null;
      if (ui.drag.kind === "unit") {
        selectUnit(game, ui.drag.id);
        ui.unitSelection = { id: ui.drag.id, owner: game.active, round: game.round };
      }
      render();
    },
    preview(pos) {
      ui.drag.position = pos;
      const result = dragPreview(game, ui.drag, pos);
      board.preview(result);
      placementHelp(result);
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
      return piece(actor(game).type, game.active);
    },
    drop(pos) {
      const d = ui.drag;
      pos = placementOrigin(game, d, pos);
      ui.drag = null;
      if (d.kind === "unit") act(() => moveUnitTo(game, pos.x, pos.y));
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
  $('#online-create').addEventListener('click', () => {
    $('#online-dialog').close();
    online.connect(null, GAME_DEFAULTS, $('#nickname').value).catch(error => toastError(error));
  });
  let stopHealthCheck, resumeCheck = 0;
  function openOnlineDialog() {
    $('#online-dialog').showModal();
    $('#online-resume').disabled = true;
    stopHealthCheck?.();
    resumeCheck++;
    stopHealthCheck = monitorServerHealth(async healthy => {
      const check = ++resumeCheck;
      const status = $('#online-health');
      status.textContent = healthy === true ? t("app.serverAvailable") : healthy === null ? t("app.checkingServer") : t("app.serverUnavailableRetryingIn10s");
      status.classList.toggle('healthy', healthy === true);
      $('#online-create').disabled = healthy !== true;
      $('#online-join').disabled = healthy !== true;
      $('#online-resume').disabled = true;
      if (healthy === true) {
        try {
          const available = await online.canResume();
          if (check === resumeCheck && $('#online-dialog').open) $('#online-resume').disabled = !available;
        } catch { /* Keep the saved session after temporary network failures. */ }
      }
    });
  }
  $('#online-dialog').addEventListener('close', () => { resumeCheck++; stopHealthCheck?.(); });
  $('#online-menu').addEventListener('click', openOnlineDialog);
  $('#online-close').addEventListener('click', () => $('#online-dialog').close());
  $('#lobby-start').addEventListener('click', () => {
    clearTimeout(lobbySaveTimer);
    online.lobby(collectSettings(), true).catch(error => toastError(error));
  });
  for (const [id, link] of [['lobby-copy-link', true], ['lobby-copy-code', false]]) $( '#' + id).addEventListener('click', async () => {
    try {
      const url = new URL(globalThis.location.href); url.hash = `join=${online.session.code}`;
      await navigator.clipboard.writeText(link ? url.href : online.session.code);
      toast(link ? t("app.linkCopied") : t("app.codeCopied"));
    } catch { toast(t("app.couldNotCopyTheCodeIsDisplayed")); }
  });
  $('#online-join').addEventListener('click', () => {
    const code = $('#online-code').value.trim().toUpperCase();
    if (!/^[A-F0-9]{10}$/.test(code)) return toast(t("app.enterA10CharacterGameCode"));
    $('#online-dialog').close();
    online.connect(code, undefined, $('#nickname').value).catch(error => toastError(error));
  });
  $('#online-resume').addEventListener('click', () => { $('#online-dialog').close(); online.resume().catch(error => toastError(error)); });
  if (globalThis.location?.hash?.startsWith('#join=')) { $('#online-code').value = globalThis.location.hash.slice(6); openOnlineDialog(); }
  function updateLanguageFlag() {
    $('#language-flag').src = new URL(`../assets/textures/interface/flag-${getLanguage()}.svg`, import.meta.url).href;
    $('#language-toggle').setAttribute('aria-label', t('language.switch'));
  }
  updateLanguageFlag();
  $('#language-toggle').addEventListener('click', () => {
    setLanguage(getLanguage() === 'fr' ? 'en' : 'fr');
    clearTimeout(toastTimer);
    $('#toast').textContent = '';
    $('#toast').classList.remove('visible');
    translateDocument(document, resourceTextHTML);
    renderMapOptions();
    updateLanguageFlag();
    html('.rules-content', rulesView(game));
    if ($('#catalogue-dialog').open) renderCatalogue();
    render();
    refreshHistory();
  });
  render();
  if (initialGame) enterGame();
  else showMenu();
}
