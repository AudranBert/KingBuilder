import french from "./locales/fr.js";
import english from "./locales/en.js";

export const LANGUAGE_KEY = "kingbuilder.language";
const catalogs = { fr: french, en: english };
let language = "fr";

export function getLanguage() { return language; }

export function setLanguage(value, { persist = true } = {}) {
  language = Object.hasOwn(catalogs, value) ? value : "fr";
  if (persist) {
    try { globalThis.localStorage?.setItem(LANGUAGE_KEY, language); } catch { /* Storage may be disabled. */ }
  }
  return language;
}

export function restoreLanguage() {
  try { return setLanguage(globalThis.localStorage?.getItem(LANGUAGE_KEY), { persist: false }); }
  catch { return setLanguage("fr", { persist: false }); }
}

// Resolve a shared key, then interpolate once. Values are never translated or
// interpreted as placeholders, so player names and escaped HTML stay intact.
export function t(key, values = []) {
  const template = catalogs[language][key] ?? french[key] ?? key;
  return template.replace(/\{(\d+)\}/g, (placeholder, index) => index < values.length ? String(values[index] ?? "") : placeholder);
}

// The rules protocol keeps its source messages stable across local and online
// games. Its text is also stored in the French catalog, never in rule code.
export function message(key, values = []) {
  return (french[key] ?? key).replace(/\{(\d+)\}/g, (placeholder, index) => index < values.length ? String(values[index] ?? "") : placeholder);
}

export function definitionText(category, definition, field = "name") {
  const id = definition?.definitionId ?? definition?.id;
  const key = `${category}.${id}.${field}`;
  return Object.hasOwn(french, key) ? t(key) : String(definition?.[field] ?? "");
}

export function kingdomName(name) {
  for (const key of ["players.amber", "players.jade"])
    if (name === french[key]) return t(key);
  return name;
}

// Rule validation and older online servers return French messages. Match full
// catalog messages at that boundary, never replace words or scan rendered HTML.
const escapeRegExp = value => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const messageKeys = Object.keys(french).filter(key => key.startsWith("messages."));
const exactMessages = new Map(Object.entries(french).filter(([, value]) => !/\{\d+\}/.test(value)).map(([key, value]) => [value, { key, lowercase: false }]));
for (const [key, value] of Object.entries(french)) {
  if (/^(buildings|terrains|units|resources)\..*\.name$/.test(key))
    exactMessages.set(value.toLowerCase(), { key, lowercase: true });
}
const parameterizedMessages = messageKeys.filter(key => /\{\d+\}/.test(french[key])).map(key => {
  const indices = [];
  const source = french[key].split(/(\{\d+\})/).map(part => {
    const index = part.match(/^\{(\d+)\}$/);
    if (!index) return escapeRegExp(part);
    indices.push(Number(index[1]));
    return "([\\s\\S]*?)";
  }).join("");
  return { key, indices, pattern: new RegExp(`^${source}$`), specificity: french[key].replace(/\{\d+\}/g, "").length };
}).sort((a, b) => b.specificity - a.specificity);

export function translateMessage(value, depth = 0) {
  if (value == null) return "";
  const message = String(value);
  if (language === "fr" || depth > 4) return message;
  const exact = exactMessages.get(message);
  if (exact) return exact.lowercase ? t(exact.key).toLowerCase() : t(exact.key);
  for (const { key, indices, pattern } of parameterizedMessages) {
    const match = message.match(pattern);
    if (!match) continue;
    const values = [];
    indices.forEach((index, position) => { values[index] = translateMessage(match[position + 1], depth + 1); });
    return t(key, values);
  }
  return message;
}

export function translateDocument(root = globalThis.document) {
  if (!root?.documentElement) return;
  root.documentElement.lang = language;
  for (const element of root.querySelectorAll("[data-i18n]"))
    element.textContent = t(element.getAttribute("data-i18n"));
  for (const attribute of ["aria-label", "title", "placeholder", "content"]) {
    for (const element of root.querySelectorAll(`[data-i18n-${attribute}]`))
      element.setAttribute(attribute, t(element.getAttribute(`data-i18n-${attribute}`)));
  }
}
