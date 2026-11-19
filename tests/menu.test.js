import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { startGame } from "../src/app.js";
import { RULES } from "../src/engine.js";

// Run the application event handlers with an in-memory DOM.
function mount(t) {
  const markup = readFileSync(
    new URL("../public/index.html", import.meta.url),
    "utf8",
  );
  function element() {
    const listeners = new Map();
    return {
      dataset: {},
      style: { setProperty() {} },
      innerHTML: "",
      hidden: false,
      open: false,
      classList: { add() {}, remove() {}, toggle() {} },
      append() {},
      setAttribute() {},
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
    window: { addEventListener() {} },
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
  startGame();
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

test("annulation : une seule pose peut être reprise, puis le bouton se désactive", (t) => {
  const app = mount(t);
  app.start("solo");
  app.prepare(1);
  assert.equal(app.node("#undo-action").disabled, false);
  app.node("#undo-action").click();
  assert.match(app.node("#opening-status").textContent, /Préparation 1\/2/);
  assert.equal(app.node("#undo-action").disabled, true);
  app.node("#undo-action").click();
  assert.match(app.node("#opening-status").textContent, /Préparation 1\/2/);
});

test("clic droit : la sélection de tuile est effacée", (t) => {
  const app = mount(t);
  app.start("solo");
  app.selectTile();
  assert.match(app.node("#placement-help").textContent, /placement/);
  let prevented = false;
  app.node(".game-layout").dispatch("contextmenu", { preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  assert.match(app.node("#placement-help").textContent, /Choisissez une tuile/);
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
  app.prepare(2);
  for (let i = 0; i < RULES.rounds; i++) app.node("#end-turn").click();
  assert.equal(app.node("#result-dialog").open, true);
  assert.match(app.node("#winner").textContent, /Votre royaume : \d+ points/);
});

test("menu : choisir un mode relance toujours une partie neuve", (t) => {
  const app = mount(t);
  app.start("local");
  assert.equal(app.node("main").hidden, false);
  app.node("#end-turn").click();
  assert.equal(app.node("#opening-status").textContent.includes("1/4"), true);
  app.node("#menu-button").click();
  app.start("solo");
  assert.equal(app.node("#main-menu").hidden, true);
  assert.equal(app.node("main").hidden, false);
  app.node("#menu-button").click();
  app.start("local");
  assert.equal(app.node("main").hidden, false);
  assert.equal(app.node("#opening-status").textContent.includes("1/4"), true);
});

test("menu : les curseurs configurent la nouvelle partie avant son lancement", (t) => {
  const app = mount(t);
  app.mode("local").click();
  assert.equal(app.node("#game-settings-dialog").open, true);
  assert.equal(app.node("main").hidden, true);
  app.node("#setting-rounds").value = 20;
  app.node("#setting-opening").value = 4;
  app.node("#setting-board").value = 7;
  app.node("#setting-material").value = 6;
  app.node("#setting-food").value = 4;
  app.node("#setting-gold").value = 2;
  app.node("#settings-start").click();
  assert.equal(app.node("#game-settings-dialog").open, false);
  assert.match(app.node("#round").innerHTML, /20/);
  assert.match(app.node("#opening-status").textContent, /Préparation 1\/8/);
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
