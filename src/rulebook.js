import { resourceTextHTML } from "./ui/html.js";

async function loadRulebook(language) {
  const url = new URL(`../config/rules/rules.${language}.md`, import.meta.url);
  if (url.protocol === "file:") {
    const { readFile } = await import("node:fs/promises");
    return readFile(url, "utf8");
  }
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw Error(`Cannot load rules.${language}.md: HTTP ${response.status}`);
  return response.text();
}

const [fr, en] = await Promise.all([loadRulebook("fr"), loadRulebook("en")]);
const rulebooks = { fr, en };

// Deliberately small Markdown subset. All prose is escaped before rendering.
export function renderRules(language, values) {
  const markdown = (rulebooks[language] ?? en).replace(/\{\{(\w+)\}\}/g, (placeholder, key) => {
    if (!Object.hasOwn(values, key)) throw Error(`Unknown rulebook variable: ${key}`);
    return String(values[key]);
  });
  const html = [];
  let list = false;
  const closeList = () => { if (list) { html.push("</ul>"); list = false; } };
  for (const line of markdown.split(/\r?\n/)) {
    if (line.startsWith("- ")) {
      if (!list) { html.push("<ul>"); list = true; }
      html.push(`<li>${resourceTextHTML(line.slice(2))}</li>`);
    } else {
      closeList();
      if (line.startsWith("## ")) html.push(`<h3>${resourceTextHTML(line.slice(3))}</h3>`);
      else if (line.trim()) html.push(`<p>${resourceTextHTML(line)}</p>`);
    }
  }
  closeList();
  return html.join("\n");
}
