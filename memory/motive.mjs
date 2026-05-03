import fs from "fs";
import path from "path";
import { CONFIG } from "../config.mjs";

const MOTIVE_PATH = path.join(CONFIG.dataDir, "motive.json");

// Hardcoded for now — CLI will ask these questions interactively later
const DEFAULT_MOTIVE = {
  goal: "Hard security/auth bugs in backend identity-* services. Want to impress Infisical maintainers and get noticed for a potential hire.",
  subsystems: ["identity-*", "audit-logs", "secret-management"],
  difficulty: "hard",
  avoid: ["frontend", "docs-only PRs", "CSS/styling changes"],
  career_context: "3rd year CS student targeting full-time role at Infisical via OSS contributions",
};

export function loadMotive() {
  if (!fs.existsSync(MOTIVE_PATH)) {
    fs.mkdirSync(CONFIG.dataDir, { recursive: true });
    fs.writeFileSync(MOTIVE_PATH, JSON.stringify(DEFAULT_MOTIVE, null, 2));
    console.log("  [motive] Initialized motive.json with defaults.");
  }
  return JSON.parse(fs.readFileSync(MOTIVE_PATH, "utf-8"));
}

export function formatMotiveForPrompt(motive) {
  return `
CONTRIBUTOR PROFILE:
- Goal: ${motive.goal}
- Focus subsystems: ${motive.subsystems.join(", ") || "all"}
- Preferred difficulty: ${motive.difficulty}
- Avoid: ${motive.avoid.join(", ") || "nothing specific"}
- Context: ${motive.career_context}
`.trim();
}