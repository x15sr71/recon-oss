import { bootstrap, syncDelta } from "./core/sync";
import { buildPrompt } from "./core/context";
import { callLLM } from "./core/llm";
import { getDbStats } from "./memory/db";
import { appendExchange, loadChatHistory, appendReplyToLastExchange, getLastSavedReply } from "./memory/chat";
import { sendSummary, captureReply } from "./delivery/index";
import fs from "fs";
import path from "path";
import { CONFIG } from "./config";

async function main() {
  console.log("\n🔍 repo-digest — modular v2");
  console.log("=".repeat(55));

  // Step 0: silently read last run's reply from chat.json — NO prompting
  console.log("\n[0/5] Checking for reply from last run...");
  const previousReply = getLastSavedReply();
  if (previousReply) {
    console.log(`  → Previous reply found: "${previousReply.slice(0, 80)}"`);
  } else {
    console.log("  → No previous reply.");
  }

  // Step 1: sync
  const stats = await getDbStats();
  console.log("\n[db] Stats before run:", stats);

  let deltaResult;
  if (!stats.lastSync) {
    console.log("\n[1/5] First run — bootstrapping...");
    deltaResult = await bootstrap();
  } else {
    console.log("\n[1/5] Delta sync...");
    deltaResult = await syncDelta();
  }

  // Step 2: build prompt
  console.log("\n[2/5] Building prompt from memories...");
  const prompt = await buildPrompt(deltaResult);
  console.log("\n--- PROMPT PREVIEW (first 500 chars) ---");
  console.log(prompt.slice(0, 500));
  console.log("...\n");

  // Step 3: call LLM
  console.log("[3/5] Calling LLM...");
  const summary = await callLLM(prompt);

  // Step 4: save output
  const timestamp = new Date().toISOString();
  const output = [
    `REPO DIGEST — ${CONFIG.repo.owner}/${CONFIG.repo.name}`,
    `Generated: ${timestamp}`,
    "=".repeat(55),
    "",
    summary,
    "",
    "=".repeat(55),
    `Stats: openIssues=${stats.openIssues} | totalPRs=${stats.totalPRs}`,
  ].join("\n");

  fs.mkdirSync(CONFIG.dataDir, { recursive: true });
  const outFile = path.join(CONFIG.dataDir, "summary.txt");
  fs.writeFileSync(outFile + ".tmp", output);
  fs.renameSync(outFile + ".tmp", outFile);
  console.log(`\n[4/5] Summary saved to ${outFile}`);

  // Step 5: append this run to chat memory
  const historyBefore = loadChatHistory();
  const countBefore = historyBefore.exchanges?.length ?? 0;
  appendExchange({ runId: timestamp, summarySent: summary, userReply: null });
  console.log(`[5/5] Chat memory updated (${countBefore} → ${countBefore + 1} exchanges).`);

  // Step 6: send summary via delivery channel
  await sendSummary(summary);

  // Step 7: prompt user for reply — skip in CI
  if (!process.env.CI) {
    const reply = await captureReply();
    if (reply) {
      appendReplyToLastExchange(reply);
      console.log(`[reply] Stored: "${reply.slice(0, 80)}"`);
    }
  }
}

main().catch(err => {
  console.error("\n❌ Error:", err.message);
  console.error(err.stack);
  process.exit(1);
});
