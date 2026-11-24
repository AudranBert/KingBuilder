import { test } from "node:test";
import assert from "node:assert/strict";
import { rulesView } from "../src/ui/views.js";
import { setLanguage } from "../src/i18n.js";

test("le livret Markdown reste fixe quels que soient le mode et les réglages", () => {
  try {
    for (const language of ["fr", "en"]) {
      setLanguage(language, { persist: false });
      const expected = rulesView();
      assert.match(expected, /<h3>1\./);
      assert.match(expected, /<ul>\s*<li>/);
      assert.doesNotMatch(expected, /\{\{|<!--|undefined/);
      for (const mode of ["solo", "local", "online"]) {
        assert.equal(rulesView({ mode, players: [{}, {}, {}, {}], missionsEnabled: false,
          boardSize: 13, turnLimit: 40, openingTilesPerPlayer: 0, mapId: "test" }), expected);
      }
    }
  } finally { setLanguage("fr", { persist: false }); }
});
