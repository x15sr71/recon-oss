import { CONFIG } from "../config.js";
import * as telegram from "./telegram.js";
import * as cli from "./cli.js";

function getChannel() {
  const channel = CONFIG.delivery ?? "cli";
  if (channel === "telegram") return telegram;
  return cli; // default fallback
}

export async function sendSummary(text) {
  await getChannel().send(text);
}

export async function captureReply() {
  return await getChannel().captureReply();
}
