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
  return formatMessage(language, key, values);
}

function formatMessage(targetLanguage, key, values = []) {
  const template = catalogs[targetLanguage][key] ?? english[key] ?? key;
  return template.replace(/\{(\d+)\}/g, (placeholder, index) => index < values.length ? String(values[index] ?? "") : placeholder);
}

// Rules emit English source messages independently of the display language.
export function message(key, values = []) {
  return (english[key] ?? key).replace(/\{(\d+)\}/g, (placeholder, index) => index < values.length ? String(values[index] ?? "") : placeholder);
}

// Configuration owns English definition text; only translations live in fr.js.
// Register it for shared keys used by views and nested rule messages as well.
export function registerDefinitions(category, definitions) {
  for (const definition of definitions) {
    for (const field of ["name", "description", "pattern", "intent"]) {
      if (typeof definition[field] === "string")
        english[`${category}.${definition.id}.${field}`] = definition[field];
    }
  }
  translationIndex = null;
}

export function definitionText(category, definition, field = "name") {
  const id = definition?.definitionId ?? definition?.id;
  const key = `${category}.${id}.${field}`;
  return String((language === "fr" ? french[key] : undefined) ?? definition?.[field] ?? english[key] ?? "");
}

export function kingdomName(name) {
  if (typeof name !== "string") return name;
  for (const key of ["players.amber", "players.jade", "messages.amber"])
    if (name === english[key] || name.replaceAll("’", "'") === french[key].replaceAll("’", "'")) return t(key);
  return name;
}

// Accept English rule messages and French messages from existing online games.
// Match complete templates at that boundary, never scan rendered HTML.
const escapeRegExp = value => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
let translationIndex;
function getTranslationIndex() {
  if (translationIndex) return translationIndex;
  const entries = [...Object.entries(french), ...Object.entries(english)];
  const exactMessages = new Map(entries.filter(([, value]) => !/\{\d+\}/.test(value)).map(([key, value]) => [value, { key, lowercase: false }]));
  for (const [key, value] of entries) {
    if (/^(buildings|terrains|units|resources)\..*\.name$/.test(key) || (key.startsWith("messages.") && !/\{\d+\}/.test(value)))
      exactMessages.set(value.toLowerCase(), { key, lowercase: true });
  }
  const parameterizedMessages = entries.filter(([key, value]) => key.startsWith("messages.") && /\{\d+\}/.test(value)).map(([key, template]) => {
    const indices = [];
    const source = template.split(/(\{\d+\})/).map(part => {
      const index = part.match(/^\{(\d+)\}$/);
      if (!index) return escapeRegExp(part);
      indices.push(Number(index[1]));
      return "([\\s\\S]*?)";
    }).join("");
    return { key, indices, pattern: new RegExp(`^${source}$`, "i"), specificity: template.replace(/\{\d+\}/g, "").length };
  }).sort((a, b) => b.specificity - a.specificity);
  return translationIndex = { exactMessages, parameterizedMessages };
}

export function translateMessage(value, depth = 0) {
  return translateTo(language, value, depth);
}

export function sourceText(value) {
  return translateTo("en", value, 0);
}

function translateTo(targetLanguage, value, depth) {
  if (value == null) return "";
  const message = String(value);
  if (depth > 4) return message;
  const { exactMessages, parameterizedMessages } = getTranslationIndex();
  const exact = exactMessages.get(message);
  if (exact) {
    const translated = formatMessage(targetLanguage, exact.key);
    return exact.lowercase ? translated.toLowerCase() : translated;
  }
  for (const { key, indices, pattern } of parameterizedMessages) {
    const match = message.match(pattern);
    if (!match) continue;
    const values = [];
    indices.forEach((index, position) => { values[index] = translateTo(targetLanguage, match[position + 1], depth + 1); });
    return formatMessage(targetLanguage, key, values);
  }
  // Lists contain known terrain names or resource amounts, never arbitrary prose.
  for (const separator of [", ", " or ", " ou "]) {
    const parts = message.split(separator);
    if (parts.length < 2 || !parts.every(part =>
      /^(terrains|resources)\./.test(exactMessages.get(part)?.key ?? "") ||
      parameterizedMessages.some(entry => entry.key.startsWith("messages.amount.") && entry.pattern.test(part)))) continue;
    return parts.map(part => translateTo(targetLanguage, part, depth + 1))
      .join(separator === ", " ? separator : formatMessage(targetLanguage, "messages.or"));
  }
  return message;
}

export function translateDocument(root = globalThis.document, renderText) {
  if (!root?.documentElement) return;
  root.documentElement.lang = language;
  for (const element of root.querySelectorAll("[data-i18n]")) {
    const text = t(element.getAttribute("data-i18n"));
    const html = renderText?.(text);
    if (html?.includes('class="resource-symbol"')) element.innerHTML = html;
    else element.textContent = text;
  }
  for (const attribute of ["aria-label", "title", "placeholder", "content"]) {
    for (const element of root.querySelectorAll(`[data-i18n-${attribute}]`))
      element.setAttribute(attribute, t(element.getAttribute(`data-i18n-${attribute}`)));
  }
}
