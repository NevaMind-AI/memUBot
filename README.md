<p align="center">
  <img src="modes/memu/icon.png" width="128" height="128" alt="memU bot">
</p>

<h1 align="center">memU bot</h1>

<p align="center">
  <strong>The memory-first OpenClaw alternative.</strong><br>
  Your AI assistant that actually remembers — enterprise-ready, cost-efficient, zero setup.
</p>

<p align="center">
  <a href="https://memu.bot">Website</a> •
  <a href="#why-memu">Why memU</a> •
  <a href="#supported-platforms">Platforms</a> •
  <a href="#getting-started">Getting Started</a> •
  <a href="#architecture">Architecture</a> •
  <a href="#license">License</a>
</p>

---

## Why memU over OpenClaw

OpenClaw is great for tinkerers who want a self-hosted AI assistant with maximum flexibility. memU takes a different bet: **memory is the product**.

Instead of a skill marketplace with thousands of community plugins, memU focuses on making your AI assistant truly remember — across platforms, across sessions, at minimal token cost, with no server to maintain.

### Memory-First Design

Most AI messaging assistants, including OpenClaw, treat each conversation as a blank slate. memU is built around **persistent, cross-platform memory**.

- **Automatic memorization** — Messages are continuously captured and memorized in the background. No manual saving, no copy-pasting into notes.
- **Cross-platform recall** — A conversation on Slack informs a follow-up on Telegram. Memory is unified, not siloed.
- **Layered retrieval** — A 3-tier context architecture (Abstract → Summary → Resource) means the AI retrieves exactly the depth of information it needs — no more, no less.

### Zero Setup, Just Works

No Docker. No VPS. No `docker-compose up`. memU is a native desktop app — download, open, and connect your platforms through the settings UI.

- **Desktop-native** — Electron app for macOS and Windows. Your data stays on your machine.
- **GUI configuration** — API keys, bot tokens, proxy settings, and LLM providers are all configured through the app. No `.env` files to wrangle.
- **Auto-update** — Built-in OTA updates. You're always on the latest version without lifting a finger.

### Enterprise-Ready

Built for real teams operating across multiple messaging platforms.

- **6 platforms, 1 app** — Telegram, Discord, Slack, WhatsApp, Line, and Feishu. Manage all your bots from a single window.
- **Security binding** — Per-platform user binding with one-time security codes. Only authorized users can interact with your bot.
- **Proxy support** — SOCKS5 and HTTP proxy for networks behind corporate firewalls.
- **Multi-language** — Full i18n support for English, 简体中文, and 日本語.
- **MCP integration** — Extend capabilities through Model Context Protocol servers.

### Real-Time Visibility

See exactly what your AI is doing, not just what it says.

- **Agent Activity Panel** — Live view of thinking steps, tool calls, and tool results as they happen.
- **Token metering** — Estimated vs. actual input/output token counts displayed per interaction.
- **Tool introspection** — Expand any tool call to inspect its full input and output.

### Cost-Efficient by Architecture

memU's layered context system is designed to minimize token consumption without sacrificing answer quality.

- **Short-term memory** — Abstracts at ~120 tokens, summaries at ~1,200 tokens, and full resources only when needed. Most retrievals stay at the lightest layer.
- **Smart compaction** — Large tool results and images are offloaded to disk and replaced with lightweight references in the conversation window.
- **Adaptive retrieval** — Hybrid BM25 + dense vector search with query-type-aware thresholds. The system escalates to deeper context layers only when confidence is low.
- **Budget guardrails** — Configurable `maxPromptTokens` (default 32K, up to 160K) with automatic trimming of oldest messages when limits are approached.

## Supported Platforms

| Platform | Status |
|----------|--------|
| Telegram | ✅ |
| Discord  | ✅ |
| Slack    | ✅ |
| Feishu   | ✅ |

> **Connect your first platform in minutes.** Follow the step-by-step [tutorial](https://memu.bot/tutorial).

## Getting Started

### Prerequisites

- **Node.js** >= v23.11.1
- **Anthropic API Key** — Get one from [console.anthropic.com](https://console.anthropic.com)
- A bot token for at least one messaging platform

### Install & Run

```bash
git clone https://github.com/user/memUBot.git
cd memUBot
npm install
npm run dev:memu
```

### Build

```bash
# macOS
npm run build:memu:mac

# Windows
npm run build:memu:win
```

## Architecture

```
src/
├── main/              # Electron main process
│   ├── apps/          # Platform bot implementations
│   ├── services/      # Core services (agent, MCP, memorization, layered context, etc.)
│   ├── ipc/           # IPC handlers
│   └── tools/         # Tool executors
├── renderer/          # React frontend
│   ├── components/    # UI components (Agent Activity, Settings, etc.)
│   ├── stores/        # Zustand state management
│   └── i18n/          # Internationalization (en, zh-CN, ja)
└── preload/           # Electron preload scripts
```

### Tech Stack

- **Runtime**: Electron
- **Frontend**: React + Tailwind CSS + Zustand
- **Language**: TypeScript
- **AI**: Anthropic Claude SDK
- **Build**: electron-vite + electron-builder

## License

[Apache 2.0](LICENSE)
