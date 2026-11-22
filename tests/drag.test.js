import { test } from "node:test";
import assert from "node:assert/strict";
import { installDrag } from "../src/ui/drag.js";

// Exercise pointer events without requiring a browser or changing game state.
function surface() {
  const listeners = new Map();
  return {
    classList: { add() {}, remove() {} },
    setPointerCapture() {},
    addEventListener(type, callback) {
      listeners.set(type, callback);
    },
    fire(type, extra = {}) {
      const e = {
        pointerId: 1,
        button: 0,
        clientX: 20,
        clientY: 20,
        preventDefault() {
          this.prevented = true;
        },
        stopImmediatePropagation() {
          this.stopped = true;
        },
        ...extra,
      };
      listeners.get(type)?.(e);
      return e;
    },
  };
}
test("un clic ne déclenche aucun placement ; glisser dépose une seule fois et absorbe le clic suivant", () => {
  const root = surface(),
    doc = surface(),
    win = surface(),
    calls = [];
  let hit = {
    closest: (s) =>
      s === "#board [data-x]" ? { dataset: { x: "2", y: "6" } } : null,
  };
  const ghost = {
    classList: { add() {} },
    style: {},
    removeAttribute() {},
    setAttribute() {},
    remove() {},
  };
  const card = {
    matches() { return true; },
    closest(selector) {
      return selector === '[data-card-drag]' ? null : this;
    },
    cloneNode() {
      return ghost;
    },
    getBoundingClientRect() {
      return { width: 80 };
    },
  };
  const oldDoc = globalThis.document,
    oldWin = globalThis.window;
  globalThis.document = Object.assign(doc, {
    elementFromPoint: () => hit,
    body: { append() {} },
  });
  globalThis.window = win;
  try {
    const drag = installDrag({
      root,
      begin: () => calls.push("begin"),
      preview: (p) => calls.push(p),
      drop: (p) => calls.push(["drop", p]),
      end: () => calls.push("end"),
    });
    root.fire("pointerdown", { target: card, pointerType: "touch" });
    const swipe = doc.fire("pointermove", { pointerType: "touch", clientY: 80 });
    doc.fire("pointerup", { pointerType: "touch" });
    assert.deepEqual(calls, [], "balayer une carte au doigt doit laisser défiler la page");
    assert.equal(swipe.prevented, undefined);
    root.fire("pointerdown", { target: card });
    doc.fire("pointerup");
    assert.deepEqual(calls, []);
    root.fire("pointerdown", { target: card });
    doc.fire("pointermove", { clientX: 24 });
    assert.deepEqual(calls, []);
    doc.fire("pointermove", { clientX: 30 });
    doc.fire("pointerup");
    assert.deepEqual(calls, [
      "begin",
      { x: 2, y: 6 },
      ["drop", { x: 2, y: 6 }],
      "end",
    ]);
    assert.equal(root.fire("click").stopped, true);
    calls.length = 0;
    root.fire("pointerdown", { target: card });
    doc.fire("pointermove", { clientX: 30 });
    drag.cancel();
    doc.fire("pointerup");
    assert.deepEqual(calls, ["begin", { x: 2, y: 6 }, "end"]);
    calls.length = 0;
    hit = null;
    root.fire("pointerdown", { target: card });
    doc.fire("pointermove", { clientX: 30 });
    doc.fire("pointerup");
    assert.deepEqual(calls, [
      "begin",
      null,
            "end",
    ]);
  } finally {
    globalThis.document = oldDoc;
    globalThis.window = oldWin;
  }
});

test('au doigt : les poignées des cartes, ouvriers et unités permettent le dépôt, les gestes annulés ne déposent rien', t => {
  const root = surface(), doc = surface(), win = surface(), calls = [];
  const ghost = { classList: { add() {} }, style: {}, removeAttribute() {}, setAttribute() {}, remove() {} };
  const beforeDoc = globalThis.document, beforeWin = globalThis.window;
  globalThis.document = Object.assign(doc, { elementFromPoint: () => ({ closest: selector => selector === '#board [data-x]' ? { dataset: { x: '4', y: '3' } } : null }), body: { append() {} } });
  globalThis.window = win;
  t.after(() => { globalThis.document = beforeDoc; globalThis.window = beforeWin; });
  installDrag({ root, begin: card => calls.push(card.kind), preview() {}, drop: pos => calls.push(pos), end() {} });
  for (const kind of ['terrain', 'building', 'single-terrain', 'worker', 'unit']) {
    const card = { kind, matches: () => !['worker', 'unit'].includes(kind), cloneNode: () => ghost, getBoundingClientRect: () => ({ width: 80 }) };
    const handle = { closest: selector => selector === '[data-card-drag]' ? handle : card };
    root.fire('pointerdown', { target: handle, pointerType: 'touch' });
    doc.fire('pointermove', { clientX: 50, pointerType: 'touch' });
    doc.fire('pointerup', { clientX: 50, pointerType: 'touch' });
    assert.deepEqual(calls.splice(0), [kind, { x: 4, y: 3 }]);
    root.fire('pointerdown', { target: handle, pointerType: 'touch' });
    doc.fire('pointermove', { clientX: 50, pointerType: 'touch' });
    doc.fire('pointercancel', { pointerType: 'touch' });
    assert.deepEqual(calls.splice(0), [kind]);
  }
});

test('le défilement aux bords accompagne le glissement et s’arrête dès son annulation', t => {
  const root = surface(), doc = surface(), win = surface(), frames = new Map(), scrolled = [];
  let id = 0, captured = false;
  const ghost = { classList: { add() {} }, style: {}, removeAttribute() {}, setAttribute() {}, remove() {} };
  const card = { closest: () => card, matches: () => false, cloneNode: () => ghost, getBoundingClientRect: () => ({ width: 80 }) };
  for (const [name, value] of Object.entries({
    document: Object.assign(doc, { elementFromPoint: () => null, querySelector: () => null, body: { append() {} } }),
    window: Object.assign(win, { innerHeight: 600, scrollBy: (x, y) => scrolled.push([x, y]) }),
    requestAnimationFrame: fn => { frames.set(++id, fn); return id; },
    cancelAnimationFrame: frame => frames.delete(frame),
  })) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, { configurable: true, value });
    t.after(() => previous ? Object.defineProperty(globalThis, name, previous) : delete globalThis[name]);
  }
  root.setPointerCapture = () => { captured = true; };
  root.hasPointerCapture = () => captured;
  root.releasePointerCapture = () => { captured = false; };
  installDrag({ root, begin() {}, preview() {}, drop() { assert.fail('cancelled drag'); }, end() {} });
  root.fire('pointerdown', { target: card });
  doc.fire('pointermove', { clientY: 3 });
  const paint = frames.get(1); frames.delete(1); paint();
  assert.ok(scrolled[0][1] < 0);
  assert.equal(frames.size, 1);
  doc.fire('pointercancel');
  assert.equal(frames.size, 0);
  assert.equal(captured, false);
  const previousScrolls = scrolled.length;
  paint();
  assert.equal(scrolled.length, previousScrolls);
});
