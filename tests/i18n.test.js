import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import english from "../src/locales/en.js";
import french from "../src/locales/fr.js";
import { t, message, definitionText, registerDefinitions, translateMessage, getLanguage, setLanguage, restoreLanguage, translateDocument, kingdomName } from "../src/i18n.js";
import { createGame, BUILDINGS } from "../src/engine.js";
import { BUILDING_CONFIGURATION, TERRAIN_TILE_CONFIGURATION, MISSION_CONFIGURATION } from "../src/configuration.js";
import { catalogueView, buildingDetailsView, playersView, rulesView, trainingView } from "../src/ui/views.js";
import { e, resourceTextHTML } from "../src/ui/html.js";
import { placementErrorText } from "../src/ui/interactions.js";

test("les ressources dans les descriptions utilisent leurs icônes sans interpréter du HTML", () => {
  try {
    for(const language of ['fr','en']) {
      setLanguage(language, {persist:false});
      const prose=language==='fr' ? '1 or, 2 blé, 3 matériaux <script>' : '1 gold, 2 food, 3 materials <script>';
      const html=resourceTextHTML(prose);
      for(const icon of ['gold','wheat','wood']) assert.match(html,new RegExp(`resources/${icon}\\.svg`));
      assert.match(html,/&lt;script&gt;/);assert.doesNotMatch(html,/<script>/);
      assert.equal(resourceTextHTML(language==='fr' ? 'forêt ou plaine' : 'forest or plain'),language==='fr' ? 'forêt ou plaine' : 'forest or plain');
      const visibleText=html.replace(/<[^>]*>/g,'');
      assert.doesNotMatch(visibleText, /\b(or|blé|matériaux|gold|food|materials)\b/);
      assert.match(buildingDetailsView('port'), /class="resource-symbol"[^>]*>.*resources\/gold\.svg/);
      assert.match(catalogueView(),/class="resource-symbol"/);
    }
  } finally {setLanguage('fr',{persist:false});}
});

test("English JSON text is authoritative and missing French translations fall back to it", () => {
  const farm = BUILDINGS.farm;
  const edited = { ...farm, name: "Edited farm" };
  const added = { id: "test_new_building", name: "New workshop", description: "A new production building." };
  try {
    setLanguage("en", { persist: false });
    assert.equal(definitionText("buildings", farm), "Farm");
    assert.equal(definitionText("buildings", edited), "Edited farm");
    assert.equal(message("messages.theGameIsOver"), "The game is over.");
    setLanguage("fr", { persist: false });
    assert.equal(definitionText("buildings", farm), "Ferme");
    assert.equal(definitionText("buildings", added), "New workshop");
    assert.equal(definitionText("buildings", added, "description"), added.description);
    assert.equal(message("messages.theGameIsOver"), "The game is over.");
    registerDefinitions("buildings", [added]);
    assert.equal(t("buildings.test_new_building.name"), "New workshop");
    const source = readFileSync(new URL("../src/locales/en.js", import.meta.url), "utf8");
    assert.doesNotMatch(source, /"buildings\.farm\.(name|description|pattern)"/);
  } finally {
    for (const field of ["name", "description"]) delete english[`buildings.test_new_building.${field}`];
    registerDefinitions("buildings", [farm]);
    setLanguage("fr", { persist: false });
  }
});

test("English engine messages and legacy French messages display in either language", () => {
  try {
    setLanguage("fr", { persist: false });
    assert.equal(translateMessage(message("messages.theGameIsOver")), "La partie est terminée.");
    assert.equal(translateMessage("La partie est terminée."), "La partie est terminée.");
    assert.equal(translateMessage("Cannot place: requires plain or fields here."), "Impossible : il faut plaine ou champs ici.");
    assert.equal(translateMessage("Cannot place: insufficient resources: missing 2 materials, 1 food (not enough gold)."),
      "Impossible : Ressources insuffisantes : il manque 2 matériaux, 1 nourriture (or insuffisant).");
    assert.equal(translateMessage("Unknown player <King>"), "Unknown player <King>");
    assert.equal(kingdomName("Kingdom of Amber"), french["players.amber"]);
    assert.equal(kingdomName("Amber"), "Ambre");
    setLanguage("en", { persist: false });
    assert.equal(translateMessage("La partie est terminée."), "The game is over.");
    assert.equal(kingdomName("Royaume d'Ambre"), "Kingdom of Amber");
  } finally { setLanguage("fr", { persist: false }); }
});

test("les traductions couvrent chaque texte du catalogue et des configurations", () => {
  assert.deepEqual(Object.keys(english).sort(), Object.keys(french).sort());
  const englishMessages = new Set(Object.values(english));
  function visit(value) {
    if (!value || typeof value !== "object") return;
    for (const [key, entry] of Object.entries(value)) {
      if (["name", "description", "pattern", "intent"].includes(key) && typeof entry === "string") {
        assert.ok(englishMessages.has(entry), `Missing English source text: ${entry}`);
      } else visit(entry);
    }
  }
  visit(BUILDING_CONFIGURATION);
  visit(TERRAIN_TILE_CONFIGURATION);
  visit(MISSION_CONFIGURATION);
  for (const file of ["terrains", "units", "resources", "game-rules"])
    visit(JSON.parse(readFileSync(new URL(`../config/${file}.json`, import.meta.url))));
});

test("chaque clé utilisée existe et les paramètres concordent entre les langues", () => {
  const parameters = text => [...text.matchAll(/\{(\d+)\}/g)].map(match => match[1]).sort();
  for (const key of Object.keys(french)) {
    assert.deepEqual(parameters(french[key]), parameters(english[key]), key);
    assert.doesNotMatch(french[key], /<\/?[a-z][^>]*>/i, `HTML in translation: ${key}`);
  }
  for (const file of ["app.js", "bootstrap.js", "engine.js", "objectives.js", "online.js", "commands.js", "configuration.js", "ui/views.js", "ui/board.js", "ui/html.js", "ui/interactions.js"]) {
    const source = readFileSync(new URL(`../src/${file}`, import.meta.url), "utf8");
    for (const match of source.matchAll(/\b(?:t|sourceMessage)\("([^"]+)"/g))
      assert.ok(Object.hasOwn(french, match[1]), `${file}: ${match[1]}`);
  }
  const markup = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
  for (const match of markup.matchAll(/data-i18n(?:-[\w-]+)?="([^"]+)"/g))
    assert.ok(Object.hasOwn(french, match[1]), `index.html: ${match[1]}`);
});

test("l’anglais traduit l’interface sans modifier la partie ni les pseudos", () => {
  setLanguage("en", { persist: false });
  try {
    const game = createGame();
    game.players[0].name = "Maison <King>";
    const before = structuredClone(game);
    assert.match(playersView(game), /Maison &lt;King&gt;/);
    assert.match(playersView(game), /Materials/);
    assert.equal(t("buildings.house.name"), "House");
    assert.equal(t("static.catalogue"), "Catalog");
    assert.equal(t("app.amber", [e("Maison <King>"), 1]), "Maison &lt;King&gt; (Amber) · 1");
    assert.equal(t("app.amber", ["Maison {1}", 7]), "Maison {1} (Amber) · 7");
    assert.equal(kingdomName("Maison"), "Maison");
    assert.match(catalogueView(), /Recruit one soldier for two <span[^>]*aria-label="Food"[^>]*>.*wheat\.svg.*once per turn/);
    assert.match(catalogueView(), /losing your keep means defeat/);
    assert.match(buildingDetailsView("house"), /House/);
    assert.match(rulesView(game), /7\. Move the pieces/);
    const type = Object.keys(BUILDINGS).find(id => BUILDINGS[id].trains);
    assert.doesNotMatch(trainingView(game, "0,0", { type }), /Choisissez|terminée|ressources/);
    assert.equal(translateMessage("Impossible : il faut plaine ici."), "Cannot place: requires plain here.");
    assert.deepEqual(game, before);
  } finally { setLanguage("fr", { persist: false }); }
});

test("les textes statiques et libellés accessibles repassent en français", () => {
  const label = { textContent: "", getAttribute: () => "static.rules" };
  const attrs = new Map([["data-i18n-aria-label", "static.language"]]);
  const select = { hasAttribute: key => attrs.has(key), getAttribute: key => attrs.get(key), setAttribute: (key, value) => attrs.set(key, value) };
  const document = { documentElement: {}, querySelectorAll: selector => selector === "[data-i18n]" ? [label] : selector === "[data-i18n-aria-label]" ? [select] : [] };
  try {
    setLanguage("en", { persist: false });
    translateDocument(document);
    assert.equal(document.documentElement.lang, "en");
    assert.equal(label.textContent, "Rules");
    assert.equal(attrs.get("aria-label"), "Language");
    setLanguage("fr", { persist: false });
    translateDocument(document);
    assert.equal(document.documentElement.lang, "fr");
    assert.equal(label.textContent, "Règles");
    assert.equal(attrs.get("aria-label"), "Langue");
  } finally { setLanguage("fr", { persist: false }); }
});

test("stockage indisponible ou langue inconnue : le jeu reste utilisable", (test) => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", { configurable: true, get() { throw Error("Storage disabled"); } });
  test.after(() => previous ? Object.defineProperty(globalThis, "localStorage", previous) : delete globalThis.localStorage);
  assert.doesNotThrow(() => setLanguage("en"));
  assert.equal(getLanguage(), "en");
  assert.equal(restoreLanguage(), "fr");
  assert.equal(setLanguage("de"), "fr");
  assert.equal(t("app.mainMenu"), "Menu principal");
});

test("les fiches et le chronomètre ne conservent aucun libellé français en anglais", () => {
  setLanguage("en", { persist: false });
  try {
    for (const id of Object.keys(BUILDINGS)) {
      const html = buildingDetailsView(id);
      assert.match(html, /Value: \d+ point\(s\)/, id);
      assert.doesNotMatch(html, /Valeur|Coût|Effet|Bâtiment|étoile/, id);
    }
    const markup = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
    const clock = markup.match(/<select id="setting-clock">([\s\S]*?)<\/select>/)[1];
    const keys = [...clock.matchAll(/data-i18n="([^"]+)"/g)].map(match => match[1]);
    assert.equal(keys.length, 7);
    assert.deepEqual(keys.map(key => t(key)), ["No time limit", "30 seconds", "1 minute", "1 min 30 sec", "2 minutes", "2 min 30 sec", "3 minutes"]);
    assert.equal(t("harvestView.assignAFree", ["worker"]), "Assign a free worker");
    assert.equal(t("messages.lesDeuxKingdomsPrennentLeurEssor"), "The two kingdoms begin to flourish.");
  } finally { setLanguage("fr", { persist: false }); }
});

test("les erreurs de placement et les ressources interpolées sont entièrement traduites", () => {
  setLanguage("en", { persist: false });
  try {
    for (const [source, expected] of [
      ["Le motif sort du plateau.", "Cannot place: the tile extends beyond the board."],
      ["Choisissez votre propre bâtiment de production.", "Cannot place: choose one of your production buildings."],
      ["Ressources insuffisantes : il manque 2 matériaux, 1 nourriture (or insuffisant).", "Cannot place: Insufficient resources: missing 2 materials, 1 food (not enough gold)."],
      ["Moulin : terrain incompatible, il faut plaine ou champs à la place de montagne. Motif.", "Cannot place: requires plain or fields here."],
    ]) assert.equal(translateMessage(placementErrorText(source)), expected);
  } finally { setLanguage("fr", { persist: false }); }
});
