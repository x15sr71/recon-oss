import "dotenv/config";

export const CONFIG = {
  repo: { owner: "Infisical", name: "infisical" },
  github: {
    token: process.env.GITHUB_TOKEN,
  },
  delivery: process.env.DELIVERY ?? "cli",
  telegram: {
    token: process.env.TELEGRAM_TOKEN,
    chatId: process.env.TELEGRAM_CHAT_ID,
  },
  llm: {
    provider: process.env.LLM_PROVIDER ?? "ollama",
    model: process.env.LLM_MODEL ?? "qwen3:14b",
    baseUrl: process.env.OLLAMA_URL ?? "http://localhost:11434",
    think: false,
    apiKey: process.env.ANTHROPIC_API_KEY ?? "",
    options: { temperature: 0.3 },
  },
  limits: {
    maxIssues: 500,
    maxPRs: 100,
    lookbackHours: 24,
    trendingIssues: 10,
    linkedIssues: 15,
    chatHistory: 25,
  },
  dataDir: "./data",
};
