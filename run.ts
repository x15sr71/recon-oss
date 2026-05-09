// run.ts
import { bootstrap, syncDelta } from "./core/sync.js";
import { buildPrompt } from "./core/context.js";
import { callLLM } from "./core/llm.js";
import { getDbStats } from "./memory/db.js";
import {
  appendExchange,
  loadChatHistory,
  appendReplyToLastExchange,
  getLastSavedReply,
} from "./memory/chat.js";
import { sendSummary, captureReply } from "./delivery/index.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { CONFIG } from "./config.js";

export async function runPipeline() {
  console.log("repo-digest modular v2");
  console.log("-".repeat(55));

  // Step 0: check previous reply (no prompt)
  console.log("05 Checking for reply from last run...");
  const previousReply = getLastSavedReply();
  if (previousReply) {
    console.log("Previous reply found:", previousReply.slice(0, 80));
  } else {
    console.log("No previous reply.");
  }

  // Step 1: sync
  const stats = await getDbStats();
  console.log("db Stats before run", stats);

  let deltaResult: any;
  if (!stats.lastSync) {
    console.log("15 First run bootstrapping...");
    deltaResult = await bootstrap();
  } else {
    console.log("15 Delta sync...");
    deltaResult = await syncDelta();
  }

  // Step 2: build prompt
  console.log("25 Building prompt from memories...");
  const prompt = await buildPrompt(deltaResult);
  console.log("--- PROMPT PREVIEW first 500 chars ---");
  console.log(prompt.slice(0, 500));
  console.log("...");

  // Step 3: call LLM
  console.log("35 Calling LLM...");
  const summary = await callLLM(prompt);

  // Step 4: save output
  const timestamp = new Date().toISOString();
  const output = [
    `REPO DIGEST ${CONFIG.repo.owner}/${CONFIG.repo.name}`,
    `Generated ${timestamp}`,
    "-".repeat(55),
    "",
    summary,
    "",
    "-".repeat(55),
    `Stats: openIssues=${stats.openIssues} totalPRs=${stats.totalPRs}`,
  ].join("\n");

  fs.mkdirSync(CONFIG.dataDir, { recursive: true });
  const outFile = path.join(CONFIG.dataDir, "summary.txt");
  fs.writeFileSync(outFile + ".tmp", output);
  fs.renameSync(outFile + ".tmp", outFile);
  console.log("45 Summary saved to", outFile);

  // Step 5: append chat memory
  const historyBefore = loadChatHistory();
  const countBefore = historyBefore.exchanges?.length ?? 0;
  appendExchange({
    runId: timestamp,
    summarySent: summary,
    userReply: null,
  });
  console.log(
    "55 Chat memory updated",
    countBefore,
    "→",
    countBefore + 1,
    "exchanges."
  );

  // Step 6: send via delivery
  await sendSummary(summary);

  // Step 7: prompt user (skip in CI)
  if (!process.env.CI) {
    const reply = await captureReply();
    if (reply) {
      appendReplyToLastExchange(reply);
      console.log("reply Stored:", reply.slice(0, 80));
    }
  }
}

// ESM-safe "main module" check
const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  runPipeline().catch((err) => {
    console.error("Error:", err.message);
    console.error(err.stack);
    process.exit(1);
  });
}