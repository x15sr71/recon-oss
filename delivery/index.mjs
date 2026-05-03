import { CONFIG } from "../config.mjs";
import * as telegram from "./telegram.mjs";
import * as cli from "./cli.mjs";

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