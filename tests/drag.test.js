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
    closest() {
      return this;
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
    hit = { closest: (s) => (s === "[data-worker-reserve]" ? {} : null) };
    root.fire("pointerdown", { target: card });
    doc.fire("pointermove", { clientX: 30 });
    doc.fire("pointerup");
    assert.deepEqual(calls, [
      "begin",
      null,
      ["drop", { workerReserve: true }],
      "end",
    ]);
  } finally {
    globalThis.document = oldDoc;
    globalThis.window = oldWin;
  }
});
