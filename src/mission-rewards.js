import { t } from "./i18n.js";

export function missionRewardText(reward, translate = t) {
  return Object.entries(reward).map(([type, amount]) =>
    translate(`messages.missionRewardAmount.${type}`, [amount])).join(", ");
}
