import { CONFIG } from "../config";
import fs from "fs";
import path from "path";

const BASE = `https://api.telegram.org/bot${CONFIG.telegram?.token}`;
const STATE_PATH = path.join(CONFIG.dataDir, "telegram_state.json");

function loadState() {
  if (!fs.existsSync(STATE_PATH)) return { lastUpdateId: 0 };
  try {
    return JSON.parse(fs.readFileSync(STATE_PATH, "utf-8"));
  } catch {
    return { lastUpdateId: 0 };
  }
}

function saveState(state) {
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

export async function send(text) {
  const res = await fetch(`${BASE}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: CONFIG.telegram.chatId,
      text: text.slice(0, 4096),
      parse_mode: "Markdown",
    }),
  });
  if (!res.ok) throw new Error(`Telegram send failed: ${await res.text()}`);
}

export async function captureReply() {
  const state = loadState();
  const res = await fetch(
    `${BASE}/getUpdates?offset=${state.lastUpdateId + 1}&timeout=0`
  );
  const data = await res.json();
  const updates = data.result ?? [];

  let latestReply = null;

  for (const update of updates) {
    const text = update.message?.text;
    const fromId = String(update.message?.chat?.id);
    if (text && fromId === String(CONFIG.telegram.chatId)) {
      latestReply = text;
    }
    state.lastUpdateId = update.update_id;
  }

  saveState(state);
  return latestReply;
}
