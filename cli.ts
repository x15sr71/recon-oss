#!/usr/bin/env node
import {
  intro,
  outro,
  select,
  text,
  confirm,
  isCancel,
} from "@clack/prompts";
import fs from "fs";
import path from "path";
import { runPipeline } from "./run.js";
import { CONFIG } from "./config.js";

const ENV_PATH = path.resolve(".env");
const MOTIVE_PATH = path.join(CONFIG.dataDir, "motive.json");

function loadEnvFile(): Record<string, string> {
  if (!fs.existsSync(ENV_PATH)) return {};
  const lines = fs.readFileSync(ENV_PATH, "utf-8").split("\n");
  const obj: Record<string, string> = {};
  for (const line of lines) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) obj[m[1].trim()] = m[2].trim();
  }
  return obj;
}

function saveEnvFile(env: Record<string, string>) {
  const lines = Object.entries(env).map(([k, v]) => `${k}=${v}`);
  fs.writeFileSync(ENV_PATH, lines.join("\n") + "\n");
}

async function handleInit() {
  intro("recon-oss init");

  const existingEnv = loadEnvFile();

  const repoOwner = await text({
    message: "GitHub repo owner (e.g. Infisical):",
    initialValue: existingEnv["REPO_OWNER"] ?? "Infisical",
  });
  if (isCancel(repoOwner)) return;

  const repoName = await text({
    message: "GitHub repo name (e.g. infisical):",
    initialValue: existingEnv["REPO_NAME"] ?? "infisical",
  });
  if (isCancel(repoName)) return;

  const ghToken = await text({
    message: "GitHub token (PAT with public_repo):",
    initialValue: existingEnv["GITHUBTOKEN"] ?? "",
  });
  if (isCancel(ghToken)) return;

  const llmProvider = await select({
    message: "LLM provider:",
    options: [
      { value: "ollama", label: "Ollama (local)" },
      { value: "anthropic", label: "Anthropic (Claude API)" },
    ],
    initialValue: existingEnv["LLMPROVIDER"] ?? "ollama",
  });
  if (isCancel(llmProvider)) return;

  let llmModel = existingEnv["LLMMODEL"] ?? "qwen3:14b";
  let ollamaUrl = existingEnv["OLLAMAURL"] ?? "http://localhost:11434";
  let anthropicKey = existingEnv["ANTHROPICAPIKEY"] ?? "";

  if (llmProvider === "ollama") {
    llmModel = (await text({
      message: "Ollama model name:",
      initialValue: llmModel,
    })) as string;
    ollamaUrl = (await text({
      message: "Ollama base URL:",
      initialValue: ollamaUrl,
    })) as string;
  } else {
    llmModel = (await text({
      message: "Claude model:",
      initialValue: llmModel || "claude-haiku-4-5",
    })) as string;
    anthropicKey = (await text({
      message: "Anthropic API key:",
      initialValue: anthropicKey,
    })) as string;
  }

  const delivery = await select({
    message: "Delivery channel:",
    options: [
      { value: "cli", label: "CLI only" },
      { value: "telegram", label: "Telegram bot" },
    ],
    initialValue: existingEnv["DELIVERY"] ?? "cli",
  });
  if (isCancel(delivery)) return;

  let telegramToken = existingEnv["TELEGRAMTOKEN"] ?? "";
  let telegramChatId = existingEnv["TELEGRAMCHATID"] ?? "";

  if (delivery === "telegram") {
    telegramToken = (await text({
      message: "Telegram bot token:",
      initialValue: telegramToken,
    })) as string;
    telegramChatId = (await text({
      message: "Telegram chat ID:",
      initialValue: telegramChatId,
    })) as string;
  }

  // Motive (for motive.json)
  const goal = (await text({
    message: "Your contribution goal (short sentence):",
    initialValue:
      "Hard security/auth bugs in backend identity-services. Want to impress maintainers.",
  })) as string;

  const subsystems = (await text({
    message: "Subsystems to focus on (comma-separated):",
    initialValue: "identity-, audit-logs, secret-management",
  })) as string;

  const avoid = (await text({
    message: "What to avoid (comma-separated):",
    initialValue: "frontend, docs-only PRs, CSS/styling changes",
  })) as string;

  const difficulty = (await text({
    message: "Preferred difficulty (easy/medium/hard):",
    initialValue: "hard",
  })) as string;

  const careerContext = (await text({
    message: "Context (e.g. student, goal company, etc.):",
    initialValue:
      "3rd year CS student targeting full-time role via OSS contributions.",
  })) as string;

  const confirmWrite = await confirm({
    message: "Write .env and motive.json with these values?",
    initialValue: true,
  });
  if (isCancel(confirmWrite) || !confirmWrite) {
    outro("Init cancelled, no files written.");
    return;
  }

  // Write .env (using existing values as defaults)
  const newEnv = {
    ...existingEnv,
    REPO_OWNER: String(repoOwner),
    REPO_NAME: String(repoName),
    GITHUBTOKEN: String(ghToken),
    LLMPROVIDER: String(llmProvider),
    LLMMODEL: String(llmModel),
    OLLAMAURL: ollamaUrl,
    ANTHROPICAPIKEY: anthropicKey,
    DELIVERY: String(delivery),
    TELEGRAMTOKEN: telegramToken,
    TELEGRAMCHATID: telegramChatId,
  };
  saveEnvFile(newEnv);

  // Write motive.json
  fs.mkdirSync(CONFIG.dataDir, { recursive: true });
  const motive = {
    goal,
    subsystems: subsystems.split(",").map((s) => s.trim()).filter(Boolean),
    difficulty,
    avoid: avoid.split(",").map((s) => s.trim()).filter(Boolean),
    careercontext: careerContext,
  };
  fs.writeFileSync(MOTIVE_PATH, JSON.stringify(motive, null, 2));

  outro("Init complete. You can now run `recon-oss run`.");
}

async function main() {
  intro("recon-oss");

  const command = await select({
    message: "What do you want to do?",
    options: [
      { value: "init", label: "Initialize recon-oss" },
      { value: "run", label: "Run digest now" },
    ],
  });

  if (isCancel(command)) {
    outro("Cancelled.");
    return;
  }

  if (command === "init") {
    await handleInit();
  } else if (command === "run") {
    await runPipeline();
    outro("Digest run complete.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});