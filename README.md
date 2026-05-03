# recon-oss

Reconnaissance for open source contributors.

Monitors a GitHub repo's merged PRs and open issues, uses a local LLM to generate a daily digest, and personalizes it based on what you're trying to contribute — and remembers your feedback over time.

Built because manually reading 10-20 merged PRs a day to figure out what to work on next is exhausting.

> **Work in progress.** Currently a working script. CLI with proper setup wizard coming soon.

---

## The idea

When you're trying to contribute to an active OSS project, you have two problems:

1. The repo moves fast — PRs merge daily across multiple subsystems
2. You don't know which open issues the team actually cares about right now

recon-oss solves this by running a daily pipeline that fetches what merged, correlates it with open issues, and asks an LLM to surface contribution opportunities — personalized to your specific goal (e.g. "I want hard backend auth bugs, not frontend work").

It also remembers your feedback. If you reply "focus on issue #442 from now on", the next digest reflects that.

---

## What's working right now

- Fetches merged PRs from the last 24h via GitHub API
- On first run, bootstraps up to 500 issues and 100 PRs into a local SQLite database
- Every subsequent run does a delta sync — only fetches what changed since last time
- Builds a prompt combining three memory layers and calls a local Ollama model
- Prints the digest to terminal and saves it to `data/summary.txt`
- Accepts feedback after each run — stored in `data/chat.json` and injected into the next prompt
- Telegram delivery is wired up but optional

---

## Architecture

The pipeline runs in five stages:

```
GitHub API (delta only after first run)
        ↓
   SQLite sync (repo.db)
        ↓
   Prompt assembly
   [ motive.json + chat.json + SQL queries ]
        ↓
   Local LLM (Ollama)
        ↓
   Delivery (terminal / Telegram)
        ↓
   User feedback → stored in chat.json → used in next run
```

Three memory layers:

| Memory | File | What it stores |
|--------|------|----------------|
| Motive | `data/motive.json` | Your contribution goals, subsystems to focus on, what to avoid |
| Repo state | `data/repo.db` | All issues and merged PRs, incrementally updated |
| Chat history | `data/chat.json` | Past digests and your replies — feeds into next run's prompt |

---

## File structure

```
recon-oss/
├── run.mjs              # entry point — runs the full pipeline
├── config.mjs           # all settings live here (repo, LLM, limits)
├── core/
│   ├── sync.mjs         # GitHub API fetcher — bootstrap + delta sync
│   ├── context.mjs      # builds the LLM prompt from all three memories
│   └── llm.mjs          # Ollama API call
├── memory/
│   ├── db.mjs           # SQLite read/write for issues and PRs
│   ├── chat.mjs         # chat history read/write
│   └── motive.mjs       # loads and formats user motive
├── delivery/
│   ├── index.mjs        # routes to the right delivery channel
│   ├── cli.mjs          # terminal output + feedback prompt
│   └── telegram.mjs     # Telegram bot send + reply capture
└── data/                # gitignored — local state lives here
    ├── repo.db
    ├── motive.json
    ├── chat.json
    └── summary.txt
```

---

## Running it (current, manual setup)

Requirements: Node.js 18+, Ollama running locally with a model pulled.

```bash
git clone https://github.com/x15sr71/recon-oss
cd recon-oss
npm install
```

Edit `config.mjs` and fill in:
- `github.token` — personal access token with `public_repo` scope
- `repo.owner` and `repo.name` — the repo you want to monitor
- `llm.model` — whichever Ollama model you have (tested with `qwen3:14b`)
- `motive` — your actual contribution goals

```bash
ollama serve   # if not already running
node run.mjs
```

First run bootstraps the database (takes a minute). Every run after that is fast — only syncs what changed.

---

## What's coming

- [ ] `recon-oss init` — interactive CLI setup wizard, no manual config editing
- [ ] `npm install -g recon-oss` — proper global install
- [ ] Cron setup built into the CLI
- [ ] OpenAI / Anthropic / Gemini as LLM options alongside Ollama
- [ ] Better prompt tuning — current model sometimes ignores user directives
- [ ] Homebrew tap

---

## Contributing

Open to contributions, especially on:

- Prompt improvements — making the LLM follow user feedback more strictly
- Additional delivery channels (Discord, Slack, email)
- LLM provider adapters (the interface is already modular in `core/llm.mjs`)
- Testing with repos other than Infisical

If you're using it to track a different repo and hit issues, open an issue with the repo name and what broke.

---

## Why local LLM by default

No API keys needed, no per-run cost, runs offline. The architecture supports cloud LLMs and that's coming — but Ollama first means anyone can run it immediately without a credit card.

---

MIT License
