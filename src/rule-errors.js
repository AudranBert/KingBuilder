import { message, t, definitionText } from "./i18n.js";
import { BUILDINGS, TERRAINS } from "./configuration.js";

export function ruleIssue(key, params = [], details = {}) {
  return { code: key.replace("messages.", ""), ...(key.startsWith("messages.") ? {} : { messageKey: key }), params, ...details };
}

export function ruleIssueText(issue, localized = false) {
  if (!issue) return "";
  if (typeof issue === "string") return issue;
  const text = localized ? t : message;
  const terrainName = id => localized
    ? definitionText("terrains", TERRAINS[id]).toLowerCase()
    : TERRAINS[id].name.toLowerCase();
  const buildingName = (id, field) => localized
    ? definitionText("buildings", BUILDINGS[id], field)
    : BUILDINGS[id][field];
  if (issue.code === "terrainMismatch")
    return text("messages.incompatibleTerrainRequiresInsteadOf", [
      buildingName(issue.building, "name"),
      issue.required.map(terrainName).join(text("messages.or")),
      terrainName(issue.actual), buildingName(issue.building, "pattern"),
    ]);
  if (issue.code === "patternMismatch")
    return `${buildingName(issue.building, "name")} : ${buildingName(issue.building, "pattern")}`;
  if (issue.code === "insufficientResourcesMissingNotEnoughGold" && issue.missing)
    return text("messages.insufficientResourcesMissingNotEnoughGold", [
      Object.entries(issue.missing).map(([id, amount]) => text(`messages.amount.${id}`, [amount])).join(", "),
    ]);
  return text(issue.messageKey ?? `messages.${issue.code}`, issue.params ?? []);
}

export class RuleError extends Error {
  constructor(issue) {
    super(ruleIssueText(issue));
    this.name = "RuleError";
    this.code = issue.code;
    this.issue = issue;
  }
}
