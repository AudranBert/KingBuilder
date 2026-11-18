import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { startGame } from "../dist/app.js";
import { createGame, RULES } from "../dist/engine.js";
import { SAVE_KEY } from "../dist/storage.js";

// Run the application event handlers with an in-memory DOM and storage.
function mount(t, savedGame) {
  const markup = readFileSync(
    new URL("../dist/index.html", import.meta.url),
    "utf8",
  );
  function element() {
    const listeners = new Map();
    return {
      dataset: {},
      style: {},
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
    "#new-dialog .cancel",
    "#new-dialog .confirm",
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

test("menu : lancement solo, retour, reprise et résultat après 20 tours", (t) => {
  const app = mount(t);
  assert.equal(app.node("#main-menu").hidden, false);
  assert.equal(app.node("main").hidden, true);
  assert.equal(app.node("#resume-button").hidden, true);
  assert.equal(app.values.has(SAVE_KEY), false);
  app.mode("solo").click();
  assert.equal(app.saved().mode, "solo");
  assert.equal(app.node("main").hidden, false);
  app.node("#end-turn").click();
  const saved = app.saved();
  app.node("#menu-button").click();
  assert.equal(app.node("#main-menu").hidden, false);
  assert.equal(app.node("#resume-button").hidden, false);
  app.node("#resume-button").click();
  assert.equal(app.node("#main-menu").hidden, true);
  assert.deepEqual(app.saved(), saved);
  for (let i = 1; i < RULES.rounds; i++) app.node("#end-turn").click();
  assert.equal(app.saved().finished, true);
  assert.equal(app.node("#result-dialog").open, true);
  assert.match(app.node("#winner").textContent, /Votre royaume : \d+ points/);
});

test("menu : ancienne sauvegarde préservée, annulation puis changement de mode confirmé", (t) => {
  const original = createGame();
  delete original.mode;
  original.round = 3;
  const app = mount(t, original);
  assert.equal(app.node("#resume-button").hidden, false);
  app.node("#resume-button").click();
  assert.equal(app.node("main").hidden, false);
  app.node("#end-turn").click();
  assert.equal(app.saved().active, 1);
  assert.equal(app.saved().round, 3);
  app.node("#menu-button").click();
  const saved = app.saved();
  app.mode("solo").click();
  assert.equal(app.node("#new-dialog").open, true);
  app.node("#new-dialog .cancel").click();
  assert.deepEqual(app.saved(), saved);
  assert.equal(app.node("#main-menu").hidden, false);
  app.mode("solo").click();
  app.node("#new-dialog .confirm").click();
  assert.equal(app.node("#new-dialog").open, false);
  assert.equal(app.saved().mode, "solo");
  assert.equal(app.saved().round, 1);
  assert.equal(app.node("main").hidden, false);
  app.node("#menu-button").click();
  app.mode("local").click();
  app.node("#new-dialog .confirm").click();
  assert.equal(app.saved().mode, "local");
  assert.equal(app.saved().players.length, 2);
});
