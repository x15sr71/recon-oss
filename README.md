# recon-oss

[![npm version](https://img.shields.io/npm/v/recon-oss)](https://www.npmjs.com/package/recon-oss)

Reconnaissance for open source contributors.

Monitors a GitHub repo's merged PRs and open issues, uses a local LLM to generate a daily digest, and personalizes it based on what you're trying to contribute — and remembers your feedback over time.

Built because manually reading 10-20 merged PRs a day to figure out what to work on next is exhausting.

***

## The idea

When you're trying to contribute to an active OSS project, you have two problems:

1. The repo moves fast — PRs merge daily across multiple subsystems
2. You don't know which open issues the team actually cares about right now

recon-oss solves this by running a daily pipeline that fetches what merged, correlates it with open issues, and asks an LLM to surface contribution opportunities — personalized to your specific goal (e.g. "I want hard backend auth bugs, not frontend work").

It also remembers your feedback. If you reply "focus on issue #442 from now on", the next digest reflects that.

***

## What's working right now

- Fetches merged PRs from the last 24h via GitHub API
- On first run, bootstraps up to 500 issues and 100 PRs into a local SQLite database
- Every subsequent run does a delta sync — only fetches what changed since last time
- Builds a prompt combining three memory layers and calls a local Ollama model
- Prints the digest to terminal and saves it to `data/summary.txt`
- Accepts feedback after each run — stored in `data/chat.json` and injected into the next prompt
- Telegram delivery is wired up but optional

***

## Architecture

The pipeline runs in five stages:

```text
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

***

## File structure

```text
recon-oss/
├── run.ts               # pipeline entry point — exported as runPipeline()
├── cli.ts               # interactive CLI entry point (recon-oss binary)
├── config.ts            # all settings live here (repo, LLM, limits)
├── tsconfig.json        # TypeScript compiler config
├── core/
│   ├── sync.ts          # GitHub API fetcher — bootstrap + delta sync
│   ├── context.ts       # builds the LLM prompt from all three memories
│   └── llm.ts           # Ollama / Anthropic API call
├── memory/
│   ├── db.ts            # SQLite read/write for issues and PRs
│   ├── chat.ts          # chat history read/write
│   └── motive.ts        # loads and formats user motive
├── delivery/
│   ├── index.ts         # routes to the right delivery channel
│   ├── cli.ts           # terminal output + feedback prompt
│   └── telegram.ts      # Telegram bot send + reply capture
└── data/                # local state — db and summary gitignored, chat/motive tracked for GH Actions
    ├── repo.db          # gitignored
    ├── motive.json      # tracked (GH Actions persistence)
    ├── chat.json        # tracked (GH Actions persistence)
    └── summary.txt      # gitignored
```

***

## Running it

Requirements: Node.js 18+, Ollama running locally with a model pulled.

### Via Homebrew

```bash
brew tap x15sr71/recon-oss https://github.com/x15sr71/recon-oss-homebrew
brew install recon-oss
```

### Via npm

```bash
npm install -g recon-oss
recon-oss
# → select "Initialize recon-oss"
```

### From source

```bash
git clone https://github.com/x15sr71/recon-oss
cd recon-oss
npm install
npm run build
node dist/cli.js
# → select "Initialize recon-oss"
```

The wizard will walk you through:
- GitHub repo to monitor and your PAT (`public_repo` scope)
- LLM provider — Ollama (local) or Anthropic (Claude)
- Delivery channel — terminal or Telegram
- Your contribution goals, focus subsystems, and what to avoid

Once set up, run the digest:

```bash
recon-oss
# → select "Run digest now"
```

First run bootstraps the database (takes a minute). Every run after that is fast — only syncs what changed.

***

## What's coming

- [x] `recon-oss init` — interactive CLI setup wizard, no manual config editing
- [x] `npm install -g recon-oss` — proper global install
- [ ] Cron setup built into the CLI
- [x] Anthropic / Claude as LLM option (set `LLM_PROVIDER=anthropic`)
- [ ] Better prompt tuning — current model sometimes ignores user directives
- [x] Homebrew tap

***

## Contributing

> **Note for contributors:** `data/chat.json` and `data/motive.json` are intentionally
> tracked in this repo for GitHub Actions persistence. If you clone and use recon-oss
> locally, these files will contain your personal goals and conversation history.
> Run this once after cloning to prevent accidental commits:
> ```bash
> git update-index --skip-worktree data/chat.json data/motive.json
> ```

Open to contributions, especially on:

- Prompt improvements — making the LLM follow user feedback more strictly
- Additional delivery channels (Discord, Slack, email)
- LLM provider adapters (the interface is already modular in `core/llm.ts`)
- Testing with repos other than Infisical

If you're using it to track a different repo and hit issues, open an issue with the repo name and what broke.

***

## Why local LLM by default

No API keys needed, no per-run cost, runs offline. The architecture supports cloud LLMs and that's coming — but Ollama first means anyone can run it immediately without a credit card.
