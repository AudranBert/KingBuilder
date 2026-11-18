import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { startGame } from "../src/app.js";
import { createGame, RULES } from "../src/engine.js";
import { SAVE_KEY } from "../src/storage.js";

// Run the application event handlers with an in-memory DOM and storage.
function mount(t, savedGame) {
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
  const values = new Map(
    savedGame ? [[SAVE_KEY, JSON.stringify(savedGame)]] : [],
  );
  t.mock.method(globalThis, "setTimeout", () => 0);
  for (const [name, value] of Object.entries({
    document: {
      querySelector: (selector) => nodes.get(selector) || null,
      querySelectorAll: (selector) =>
        selector === "[data-game-mode]" ? modes : [],
      createElement: element,
      addEventListener() {},
    },
    window: {
      localStorage: {
        getItem: (k) => values.get(k),
        setItem: (k, v) => values.set(k, v),
      },
      addEventListener() {},
    },
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
    saved: () => JSON.parse(values.get(SAVE_KEY)),
    values,
  };
}

test("menu : lancement solo, retour et résultat après 25 tours", (t) => {
  const app = mount(t);
  assert.equal(app.node("#main-menu").hidden, false);
  assert.equal(app.node("main").hidden, true);
  assert.equal(app.values.has(SAVE_KEY), false);
  app.mode("solo").click();
  assert.equal(app.node("main").hidden, false);
  app.node("#end-turn").click();
  app.node("#menu-button").click();
  assert.equal(app.node("#main-menu").hidden, false);
  assert.equal(app.values.has(SAVE_KEY), true);
  app.mode("solo").click();
  assert.equal(app.node("#main-menu").hidden, true);
  for (let i = 0; i < RULES.rounds; i++) app.node("#end-turn").click();
  assert.equal(app.node("#result-dialog").open, true);
  assert.match(app.node("#winner").textContent, /Votre royaume : \d+ points/);
});

test("menu : ancienne sauvegarde ignorée et nouveau mode lancé directement", (t) => {
  const original = createGame();
  delete original.mode;
  original.round = 3;
  const app = mount(t, original);
  assert.equal(app.values.has(SAVE_KEY), true);
  app.mode("local").click();
  assert.equal(app.node("main").hidden, false);
  app.node("#end-turn").click();
  assert.equal(app.node("#round").innerHTML.includes("01"), true);
  app.node("#menu-button").click();
  app.mode("solo").click();
  assert.equal(app.node("#main-menu").hidden, true);
  assert.equal(app.node("main").hidden, false);
  app.node("#menu-button").click();
  app.mode("local").click();
  assert.equal(app.node("main").hidden, false);
  assert.equal(app.saved().round, 1);
  assert.equal(app.saved().mode, "local");
});

test("la molette pivote la carte survolée et garde le défilement ailleurs", (t) => {
  const app = mount(t);
  app.mode("solo").click();
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
