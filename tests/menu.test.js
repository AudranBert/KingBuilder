import { createFixedGame as createGame } from "./helpers.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { startGame } from "../src/app.js";
import { RULES } from "../src/engine.js";
import { LANGUAGE_KEY } from "../src/i18n.js";
import { createArmyTestGame } from "../src/test-scenarios.js";
import { ruleIssue, ruleIssueText } from "../src/rule-errors.js";

// Run the application event handlers with an in-memory DOM.
function mount(t, initialGame = null) {
  const markup = readFileSync(
    new URL("../public/index.html", import.meta.url),
    "utf8",
  );
  function element() {
    const listeners = new Map();
    const attributes = new Map();
    return {
      dataset: {},
      children: [],
      style: { setProperty() {} },
      innerHTML: "",
      hidden: false,
      open: false,
      classList: { add() {}, remove() {}, toggle() {} },
      append(child) { this.children.push(child); },
      replaceChildren() { this.children = []; },
      setAttribute(name, value) { attributes.set(name, value); },
      getAttribute(name) { return attributes.get(name); },
      focus() {},
      addEventListener(type, fn) {
        listeners.set(type, fn);
      },
      click() {
        listeners.get("click")?.({ target: this });
      },
      dispatch(type, event) {
        listeners.get(type)?.(event);
      },
      wheel(event) {
        listeners.get("wheel")?.(event);
      },
      showModal() {
        this.open = true;
      },
      close() {
        this.open = false;
      },
    };
  }
  const nodes = new Map(
    [...markup.matchAll(/id="([^"]+)"/g)].map((m) => ["#" + m[1], element()]),
  );
  for (const selector of [
    "header",
    "main",
    ".game-layout",
    ".rules-content",
    "#prestige-dialog .confirm",
    "#prestige-dialog .cancel",
    "#rules-dialog .close",
    "#building-details-dialog .close-building-details",
    ".close-rules",
    ".close-results",
  ])
    nodes.set(selector, element());
  const modes = ["solo", "local"].map((mode) => {
    const button = element();
    button.dataset.gameMode = mode;
    nodes.set(`[data-game-mode='${mode}']`, button);
    return button;
  });
  t.mock.method(globalThis, "setTimeout", () => 0);
  const documentListeners = new Map();
  for (const [name, value] of Object.entries({
    document: {
      querySelector: (selector) => nodes.get(selector) || null,
      querySelectorAll: (selector) =>
        selector === "[data-game-mode]" ? modes : [],
      createElement: element,
      addEventListener(type, fn) { documentListeners.set(type, fn); },
    },
    window: { addEventListener() {}, matchMedia: () => ({ matches: false }) },
    ResizeObserver: class {
      observe() {}
    },
    requestAnimationFrame() {},
  })) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, {
      configurable: true,
      writable: true,
      value,
    });
    t.after(() =>
      previous
        ? Object.defineProperty(globalThis, name, previous)
        : delete globalThis[name],
    );
  }
  startGame({ initialGame });
  return {
    node: (selector) => nodes.get(selector),
    mode: (mode) => modes.find((b) => b.dataset.gameMode === mode),
    start(mode) {
      this.mode(mode).click();
      nodes.get("#settings-start").click();
    },
    selectTile() {
      const card = { dataset: { tile: "0" }, hasAttribute: name => name === "data-tile", closest: selector => selector.startsWith("[data-building],[data-tile]") ? card : null };
      documentListeners.get("click")({ target: card });
    },
    action(name) {
      const button={dataset:{action:name},disabled:false,closest: selector => selector === '[data-action]' ? button : null};
      documentListeners.get('click')({target:button});
    },
    selectWorker() {
      const worker = { dataset: { workerSelect: '0' }, closest: selector => selector === '[data-worker-select]' ? worker : null };
      documentListeners.get('click')({ target: worker });
    },
    cells() { return nodes.get('#board').children.flatMap(row => row.children); },
    king() { return this.cells().find(cell => cell.innerHTML.includes('mobile-worker-piece') && cell.innerHTML.includes('>1</sup>')) || this.cells().find(cell => cell.innerHTML.includes('mobile-worker-piece')); },
    cell(x, y) { return this.cells().find(cell => +cell.dataset.x === x && +cell.dataset.y === y); },
    clickCell(x, y, unitSelect) {
      const cell = this.cell(x, y);
      nodes.get('#board').dispatch('click', { target: { closest: selector => selector === '[data-unit-select]' ? (unitSelect === undefined ? null : { dataset: { unitSelect } }) : cell } });
    },
    setMode(mode) {
      const button = { dataset: { mode }, closest: selector => selector === '[data-mode]' ? button : null };
      documentListeners.get('click')({ target: button });
    },
    prepare(count) {
      for (let i = 0; i < count; i++) {
        const before = nodes.get("#opening-status").textContent;
        this.selectTile();
        for (let y = 0; y < 13 && nodes.get("#opening-status").textContent === before; y++)
          for (let x = 0; x < 13 && nodes.get("#opening-status").textContent === before; x++) {
            const cell = { dataset: { x, y } };
            nodes.get("#board").dispatch("click", { target: { closest: () => cell } });
          }
        assert.notEqual(nodes.get("#opening-status").textContent, before);
      }
    },
  };
}

test('placement errors are readable in board accessibility labels', t => {
  const app = mount(t);
  app.start('solo');
  app.selectTile();
  const labels = app.cells().map(cell => cell.getAttribute('aria-label'));
  assert.ok(labels.every(label => !label.includes('[object Object]')));
  const occupied = ruleIssueText(ruleIssue('messages.chooseAnUnexploredSpace'), true);
  assert.ok(labels.some(label => label.includes(occupied)));
});

test("annulation : un déplacement peut être repris, puis le bouton se désactive", (t) => {
  const app = mount(t);
  app.start("solo");
  const x = +app.king().dataset.x, y = +app.king().dataset.y;
  app.clickCell(x, y);
  app.clickCell(x + 1, y);
  assert.equal(+app.king().dataset.x, x + 1);
  assert.equal(app.node("#undo-action").disabled, false);
  app.node("#undo-action").click();
  assert.equal(+app.king().dataset.x, x);
  assert.equal(app.node("#undo-action").disabled, true);
});

test("clic droit : la sélection de tuile est effacée", (t) => {
  const app = mount(t);
  app.start("solo");
  app.selectTile();
  assert.match(app.node("#placement-help").innerHTML, /case verte|Impossible :/);
  let prevented = false;
  app.node(".game-layout").dispatch("contextmenu", { preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  assert.match(app.node("#placement-help").innerHTML, /Sélectionnez un ouvrier/);
});

test("menu : lancement solo, retour et résultat après 25 tours", (t) => {
  const app = mount(t);
  assert.equal(app.node("#main-menu").hidden, false);
  assert.equal(app.node("main").hidden, true);
  assert.equal(app.node("#resume-game"), undefined);
  app.start("solo");
  assert.equal(app.node("main").hidden, false);
  app.node("#end-turn").click();
  app.node("#menu-button").click();
  assert.equal(app.node("#main-menu").hidden, false);
  app.start("solo");
  assert.equal(app.node("#main-menu").hidden, true);
  for (let i = 0; i < RULES.rounds; i++) app.node("#end-turn").click();
  assert.equal(app.node("#result-dialog").open, true);
  assert.match(app.node("#winner").textContent, /Votre royaume : \d+ points/);
});

test("menu : choisir un mode relance toujours une partie neuve", (t) => {
  const app = mount(t);
  app.start("local");
  assert.equal(app.node("main").hidden, false);
  app.node("#end-turn").click();
  assert.equal(app.node("#opening-status").hidden, true);
  app.node("#menu-button").click();
  app.start("solo");
  assert.equal(app.node("#main-menu").hidden, true);
  assert.equal(app.node("main").hidden, false);
  app.node("#menu-button").click();
  app.start("local");
  assert.equal(app.node("main").hidden, false);
  assert.equal(app.node("#opening-status").hidden, true);
});

test("menu : les curseurs configurent la nouvelle partie avant son lancement", (t) => {
  const app = mount(t);
  app.mode("local").click();
  assert.equal(app.node("#game-settings-dialog").open, true);
  assert.equal(app.node("main").hidden, true);
  app.node("#setting-rounds").value = 20;
  assert.equal(app.node("#setting-map").value, "base");
  app.node("#setting-map").value = "valley";
  app.node("#setting-board").value = 9;
  app.node("#setting-material").value = 6;
  app.node("#setting-food").value = 4;
  app.node("#setting-gold").value = 2;
  app.node("#settings-start").click();
  assert.equal(app.node("#game-settings-dialog").open, false);
  assert.match(app.node("#round").innerHTML, /20/);
  assert.equal(app.node("#opening-status").hidden, true);
  assert.match(app.node(".rules-content").innerHTML, /Préparer le plateau/);
});

test("la molette pivote la carte survolée et garde le défilement ailleurs", (t) => {
  const app = mount(t);
  app.start("solo");
  const layout = app.node(".game-layout");
  let prevented = 0;
  const target = (attribute) => ({
    closest: () => ({ hasAttribute: (name) => name === attribute }),
  });
  layout.wheel({ target: target("data-tile"), deltaY: 1, preventDefault: () => prevented++ });
  assert.equal(app.node("#rotation-label").textContent, "90°");
  layout.wheel({ target: target("data-building"), deltaY: -1, preventDefault: () => prevented++ });
  assert.equal(app.node("#building-rotation-label").textContent, "270°");
  layout.wheel({ target: { closest: () => null }, deltaY: 1, preventDefault: () => prevented++ });
  assert.equal(prevented, 2);
});

test("les commandes tactiles pivotent la sélection et permettent de l’annuler", (t) => {
  const app = mount(t);
  app.start("solo");
  assert.equal(app.node("#rotate-placement").disabled, true);
  app.selectTile();
  assert.equal(app.node("#rotate-placement").disabled, false);
  assert.equal(app.node("#cancel-placement").disabled, false);
  app.node("#rotate-placement").click();
  assert.equal(app.node("#rotation-label").textContent, "90°");
  app.node("#cancel-placement").click();
  assert.equal(app.node("#rotate-placement").disabled, true);
  assert.equal(app.node("#cancel-placement").disabled, true);
  app.selectWorker();
  assert.equal(app.node("#cancel-placement").disabled, true);
  assert.equal(app.node("#rotate-placement").disabled, true);
  assert.match(app.node("#placement-help").innerHTML, /Choisissez une destination/);
});

test("langue : français par défaut, bascule immédiate et choix mémorisé", (t) => {
  const saved = new Map();
  const previous = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: { getItem: key => saved.get(key), setItem: (key, value) => saved.set(key, value) },
  });
  t.after(() => previous ? Object.defineProperty(globalThis, "localStorage", previous) : delete globalThis.localStorage);
  const app = mount(t);
  assert.match(app.node("#language-flag").src, /flag-fr\.svg$/);
  assert.match(app.node(".rules-content").innerHTML, /Le but/);
  app.node("#language-toggle").click();
  assert.match(app.node("#language-flag").src, /flag-en\.svg$/);
  assert.equal(saved.get(LANGUAGE_KEY), "en");
  assert.match(app.node(".rules-content").innerHTML, /The goal/);
  assert.match(app.node("#players").innerHTML, /Kingdom of Amber/);
  app.start("solo");
  assert.equal(app.node("#opening-status").hidden, true);
  assert.match(app.node("#setting-map").innerHTML, /Random map/);
  assert.match(app.node("#tile-market").innerHTML, /spaces/);
  assert.match(app.node("#end-turn").innerHTML, /End turn/);
  for (let i = 0; i < RULES.rounds; i++) app.node("#end-turn").click();
  assert.match(app.node("#winner").textContent, /Your kingdom : \d+ points|Your kingdom: \d+ points/);
  const reloaded = mount(t);
  assert.match(reloaded.node("#language-flag").src, /flag-en\.svg$/);
  assert.match(reloaded.node(".rules-content").innerHTML, /The goal/);
  reloaded.node("#language-toggle").click();
  assert.match(reloaded.node("#language-flag").src, /flag-fr\.svg$/);
  assert.equal(saved.get(LANGUAGE_KEY), "fr");
  assert.match(reloaded.node(".rules-content").innerHTML, /Le but/);
});

test('jeu : il faut choisir le roi avant de le déplacer ; inspection, annulation et nouveau tour désélectionnent', t => {
  const app = mount(t);
  app.mode('solo').click();
  app.node('#settings-start').click();
  const x = +app.king().dataset.x, y = +app.king().dataset.y;
  assert.doesNotMatch(app.king().className, /active-pawn/);
  assert.doesNotMatch(app.king().getAttribute('aria-label'), /Unité sélectionnée/);
  assert.ok(app.cells().every(cell => !cell.className.includes('reachable')));
  app.clickCell(x + 1, y);
  assert.equal(+app.king().dataset.x, x);
  assert.doesNotMatch(app.node('#selection').innerHTML, /data-action="move"/);

  app.setMode('inspect');
  assert.doesNotMatch(app.king().innerHTML, /data-unit-drag/);
  app.clickCell(x, y);
  app.clickCell(x + 1, y);
  assert.equal(+app.king().dataset.x, x);
  app.setMode('move');
  assert.doesNotMatch(app.king().className, /active-pawn/);
  app.clickCell(x + 1, y);
  assert.equal(+app.king().dataset.x, x);

  app.clickCell(x, y);
  assert.match(app.king().className, /active-pawn/);
  assert.match(app.node('#selection').innerHTML, /selected-unit-icon[^>]*role="img" aria-label="Ouvrier"/);
  assert.match(app.node('#selection').innerHTML, /selected-unit-moves[^>]*Déplacements restants : 3/);
  assert.doesNotMatch(app.node('#selection').innerHTML, /data-army-stat|data-army-size/);
  assert.match(app.cell(x + 1, y).className, /reachable/);
  app.clickCell(x + 1, y);
  assert.equal(+app.king().dataset.x, x + 1);
  assert.match(app.node('#selection').innerHTML, /Déplacements restants : 2/);
  app.setMode('inspect');
  app.setMode('move');
  app.clickCell(x, y);
  assert.equal(+app.king().dataset.x, x + 1);
  app.clickCell(x + 1, y);
  app.node('.game-layout').dispatch('contextmenu', { preventDefault() {} });
  assert.doesNotMatch(app.king().className, /active-pawn/);
  app.clickCell(x, y);
  assert.equal(+app.king().dataset.x, x + 1);
  app.clickCell(x + 1, y);
  app.node('#end-turn').click();
  assert.doesNotMatch(app.king().className, /active-pawn/);
  app.clickCell(x, y);
  assert.equal(+app.king().dataset.x, x + 1);
});

test('une armée sans déplacement est grisée et un clic hors du pion la désélectionne', t => {
  const game = createArmyTestGame();
  const player = game.players[0];
  for (const unit of player.units) unit.moves = 0;
  const app = mount(t, game);
  const { x, y } = player.home;
  assert.match(app.cell(x, y).innerHTML, /military-piece[^\"]*exhausted/);
  app.clickCell(x, y, String(player.units.find(u=>u.type==='soldier').id));
  assert.match(app.node('#selection').innerHTML, /^<span class="selected-unit-icon/);
  assert.match(app.node('#selection').innerHTML, /selected-unit-moves[^>]*Déplacements restants : 0/);
  assert.match(app.node('#selection').innerHTML, /boots\.svg/);
  assert.match(app.node('#selection').innerHTML, /selected-unit-icon/);
  assert.match(app.node('#selection').innerHTML, /data-army-stat="attack"/);
  app.clickCell(x, y);
  assert.match(app.node('#selection').innerHTML, /selected-building/);
  assert.doesNotMatch(app.node('#selection').innerHTML, /data-army-stat/);
  assert.doesNotMatch(app.cell(x, y).className, /active-pawn/);
  app.clickCell(x, y, String(player.units.find(u=>u.type==='soldier').id));
  app.clickCell(x + 1, y);
  assert.doesNotMatch(app.node('#selection').innerHTML, /data-army-stat/);
  app.clickCell(x, y, String(player.units.find(u=>u.type==='soldier').id));
  player.units[0].moves=3;
  app.clickCell(x, y, String(player.units[0].id));
  assert.match(app.cell(x + 1, y).className, /reachable/);
});

test('le réglage des missions retire les objectifs et conserve le livret fixe', t => {
  const app = mount(t);
  app.mode('solo').click();
  assert.equal(app.node('#setting-missions').checked, true);
  app.node('#setting-missions').checked = false;
  app.node('#settings-start').click();
  assert.equal(app.node('#missions').hidden, true);
  assert.equal(app.node('#missions').innerHTML, '');
  app.node('#rules-button').click();
  assert.match(app.node('.rules-content').innerHTML, /Les missions sont optionnelles/);
  assert.doesNotMatch(app.node('.rules-content').innerHTML, /missions sont désactivées/);
  app.node('#rules-dialog .close').click();
  app.node('#menu-button').click();
  app.mode('solo').click();
  app.node('#setting-missions').checked = true;
  app.node('#settings-start').click();
  assert.equal(app.node('#missions').hidden, false);
  assert.match(app.node('#missions').innerHTML, /mission-card/);
});


test('ouvrier : produire gagne immédiatement et conserve les déplacements et la sélection', t => {
  const game=createGame(() => .42,'solo',{openingTilesPerPlayer:0,missionsEnabled:false});
  const app=mount(t,game);const x=+app.king().dataset.x,y=+app.king().dataset.y;
  const food=game.players[0].resources.food;
  app.clickCell(x,y);app.clickCell(x+1,y);
  assert.match(app.node('#selection').innerHTML,/data-action="produce"/);
  app.action('produce');
  assert.equal(game.players[0].resources.food,food+1);
  assert.match(app.node('#selection').innerHTML,/Action utilisée/);
  assert.match(app.node('#selection').innerHTML,/Déplacements restants : 2/);
  app.clickCell(x,y-1);assert.match(app.node('#selection').innerHTML,/Déplacements restants : 0/);
});


test('solo and local games do not write automatic saves', t => {
  const values = new Map();
  const before = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key),
  } });
  t.after(() => before ? Object.defineProperty(globalThis, 'localStorage', before) : delete globalThis.localStorage);
  const app = mount(t);
  for (const mode of ['solo', 'local']) {
    app.start(mode);
    const x = +app.king().dataset.x, y = +app.king().dataset.y;
    app.clickCell(x, y); app.clickCell(x + 1, y);
    app.node('#undo-action').click();
    app.node('#end-turn').click();
    app.node('#menu-button').click();
    assert.equal(values.has('kingbuilder.localGame'), false);
    assert.equal(app.node('#local-resume'), undefined);
  }
});
