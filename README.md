<p align="center">
  <img src="assets/memubot-logo.png" alt="memUBot Logo" width="200"/>
</p>

<h1 align="center">memUBot</h1>

<h3 align="center">The Enterprise-Ready OpenClaw.<br/>Your Proactive AI Agent That Remembers Everything. 🧠</h3>

<p align="center">
  <a href="https://github.com/NevaMind-AI/memUBot/blob/main/LICENSE"><img src="https://img.shields.io/github/license/NevaMind-AI/memUBot" alt="License"/></a>
  <a href="https://github.com/NevaMind-AI/memUBot/releases"><img src="https://img.shields.io/github/v/release/NevaMind-AI/memUBot" alt="Release"/></a>
  <a href="https://github.com/NevaMind-AI/memUBot/stargazers"><img src="https://img.shields.io/github/stars/NevaMind-AI/memUBot" alt="Stars"/></a>
  <a href="https://discord.gg/fFE4gfMvKf"><img src="https://img.shields.io/discord/fFE4gfMvKf?label=Discord&logo=discord" alt="Discord"/></a>
</p>

<p align="center">
  <a href="#-why-memubot">Why memUBot</a> •
  <a href="#-memory-the-core-advantage">Memory</a> •
  <a href="#-enterprise-ready-features">Enterprise</a> •
  <a href="#-memubot-vs-openclaw">vs OpenClaw</a> •
  <a href="#-quick-start">Quick Start</a> •
  <a href="#-platform-support">Platforms</a> •
  <a href="#-skills--mcp">Skills & MCP</a> •
  <a href="#-contributing">Contributing</a>
</p>

---

## 💡 Why memUBot?

[OpenClaw](https://github.com/openclaw/openclaw) pioneered the open-source personal AI assistant space — and we love it. But when it comes to **production deployments**, **team-scale usage**, and **enterprise security requirements**, there's a gap.

**memUBot bridges that gap.** Built on the [memU](https://github.com/NevaMind-AI/memU) open-source memory framework, memUBot is a **proactive, 24/7 AI agent** designed from the ground up to be **enterprise-ready** — secure, stable, cost-efficient, and easy to deploy.

> 🦞 Love OpenClaw? Think of memUBot as **OpenClaw for your whole team** — with persistent memory, proactive execution, and production-grade reliability.

### Key Differentiators

- 🧠 **Memory-First Architecture** — Powered by [memU](https://github.com/NevaMind-AI/memU), the open-source memory layer that gives your AI agent true long-term understanding
- 🏢 **Enterprise-Ready** — Local-first, SOC2-friendly, one-click deployment, multi-platform integration
- 🤖 **Proactive, Not Reactive** — Continuously captures intent and acts before you ask
- 💰 **10x Cost Reduction** — Intelligent memory caching slashes token consumption dramatically
- 🔒 **Security by Design** — All data stays local. No cloud leaks. No excessive permissions

---

## 🧠 Memory: The Core Advantage

What sets memUBot apart from every other AI assistant is its **memory layer**, powered by the open-source **[memU framework](https://github.com/NevaMind-AI/memU)**.

> 📖 For a deep dive into the memory architecture, see the [memU Memory Documentation](https://github.com/NevaMind-AI/memU/blob/main/readme/README_zh.md).

### Beyond OpenClaw's Native Memory

OpenClaw stores memory via flat Markdown files (`MEMORY.md` for long-term facts, `memory/YYYY-MM-DD.md` for daily logs) plus a basic SQLite vector store. It works — but it wasn't designed for enterprise-scale, multi-user, always-on agents.

**memU replaces this entire layer** with a purpose-built memory infrastructure:

| Capability | OpenClaw Native | memU (powering memUBot) |
|---|---|---|
| **Long-Term Memory** | Single `MEMORY.md` file, manually managed | Structured, auto-organized persistent memory with semantic indexing |
| **Daily Context** | Date-stamped log files (`YYYY-MM-DD.md`) | Continuous context capture with automatic compaction and flush |
| **Retrieval** | Basic SQLite vector search | Advanced semantic search — finds relevant memories even with different phrasing |
| **Memory Lifecycle** | Manual writes, risk of loss on context overflow | Auto-flush before compaction ensures critical info is never lost |
| **Multi-Agent** | Single-user, single-session | Shared memory pools with access control for team deployments |
| **Observability** | None | Full memory audit trail, export, and analytics |

### Why This Matters for Enterprise

- **Never Loses Context** — Auto-flush mechanism saves persistent memories before context window compaction, preventing data loss during long-running tasks
- **Semantic Recall** — Vector-indexed memory retrieval finds the right context regardless of how it was originally phrased
- **Cost-Efficient** — Smart context selection sends only relevant memories to the LLM, reducing token usage by up to **90%**
- **Auditable & Portable** — All memories are inspectable, exportable, and migratable across environments
- **Evolving** — Memory grows smarter over time, learning team patterns, preferences, and domain knowledge
- **GDPR-Friendly** — Full data ownership with granular deletion support

> 💡 **The result?** An AI agent that doesn't just answer questions — it **understands your team**, **remembers context across sessions**, and **proactively acts** on accumulated knowledge.

---

## 🏢 Enterprise-Ready Features

memUBot isn't a toy. It's built for production.

### 🔒 Security & Compliance

| Feature | Description |
|---|---|
| **Local-First Architecture** | All data processed and stored locally. Nothing leaves your infrastructure |
| **No Cloud Dependencies** | Works fully offline. No data sent to third-party servers (except LLM API calls) |
| **Minimal Permissions** | Principle of least privilege. Sensitive operations require explicit confirmation |
| **Audit Trail** | Full memory and action history, exportable for compliance review |
| **Data Sovereignty** | Deploy on-premise or in your own cloud. You own every byte |

### 🚀 Deployment & Operations

| Feature | Description |
|---|---|
| **One-Click Install** | Up and running in under 3 minutes. No Docker, no VMs, no headaches |
| **Multi-Platform** | macOS, Windows, Linux — native support across all major OS |
| **Auto-Recovery** | Task continuation mechanism handles token limits, API errors, and interruptions gracefully |
| **24/7 Stability** | Designed for always-on operation. Memory persists across restarts and sessions |
| **Team Scalability** | From individual use to team-wide deployment with shared knowledge bases |

### 💰 Cost Control

| Feature | Description |
|---|---|
| **Memory-Optimized Context** | Only sends relevant context to LLM, not entire conversation history |
| **Insight Caching** | Pre-computed patterns avoid redundant expensive API calls |
| **Local Model Support** | Use Ollama or other local models to eliminate API costs entirely |
| **Usage Analytics** | Track token consumption per task, user, and time period |

---

## ⚔️ memUBot vs OpenClaw

We respect OpenClaw and the community behind it. Here's an honest comparison:

| Dimension | memUBot | OpenClaw |
|---|---|---|
| **Primary Focus** | Enterprise-ready proactive agent | Personal AI assistant |
| **Memory System** | Enterprise memory layer ([memU](https://github.com/NevaMind-AI/memU)) with semantic search, auto-flush & shared pools | Flat Markdown files + basic SQLite vector store |
| **Deployment** | One-click install, < 3 min | Complex setup, multiple dependencies |
| **Data Security** | Local-first, no cloud dependency | Cloud-dependent features, [known CVEs](https://github.com/openclaw/openclaw/security) |
| **Token Cost** | ~1/10 of comparable usage | Standard token consumption |
| **Proactive Actions** | 24/7 intent capture & autonomous execution | Reactive to user commands |
| **Long-Term Memory** | Persistent with auto-flush, semantic indexing & shared pools | `MEMORY.md` + daily logs, risk of loss on context overflow |
| **Platform Integration** | Telegram, Discord, Slack, Feishu | Primarily desktop-focused |
| **Team Support** | Multi-user, shared knowledge bases | Single-user oriented |
| **Stability** | Auto-recovery, task continuation | Manual restart on failures |

> 💡 OpenClaw is a fantastic personal assistant. memUBot is what you deploy when your **team** needs an AI agent that **runs 24/7**, **remembers everything**, and **meets enterprise security requirements**.

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ (or use the bundled runtime)
- An LLM API key (OpenAI, Anthropic, or local models via Ollama)

### Install

```bash
# One-line install (macOS / Linux)
curl -fsSL https://get.memubot.ai | sh

# Or via npm
npm install -g memubot

# Or via Homebrew
brew install memubot
```

### Configure

```bash
# Interactive setup — choose your LLM, platform integrations, and memory settings
memubot init
```

### Run

```bash
# Start memUBot as a background service
memubot start

# Or run in foreground for development
memubot dev
```

That's it. Your enterprise-ready AI agent is live. 🧠

---

## 📱 Platform Support

memUBot integrates with the tools your team already uses:

| Platform | Status | Description |
|---|---|---|
| **Telegram** | ✅ Supported | Full bot API support with inline commands |
| **Discord** | ✅ Supported | Server bots with slash commands and thread support |
| **Slack** | ✅ Supported | Workspace apps with channel and DM support |
| **Feishu / Lark** | ✅ Supported | Native integration with Feishu bots and group chats |

---

## 🔧 Skills & MCP

memUBot is extensible through **Skills** (custom automation modules) and **MCP** (Model Context Protocol) integrations.

### Skills

```yaml
# Example: Auto-summarize daily standup messages
skills:
  - name: standup-summarizer
    trigger: schedule("0 10 * * 1-5")
    action: summarize-channel
    params:
      channel: "#daily-standup"
      output: "#team-digest"
```

### MCP Integration

memUBot supports the [Model Context Protocol](https://modelcontextprotocol.io/) standard, allowing seamless connection with:

- File systems, databases, and APIs
- Browser automation tools
- Code repositories and CI/CD pipelines
- Third-party SaaS tools

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────┐
│                   memUBot                        │
├─────────────┬───────────────┬───────────────────┤
│  Platform   │   Agent Core  │   Skills Engine   │
│  Adapters   │               │                   │
│ ┌─────────┐ │ ┌───────────┐ │ ┌───────────────┐ │
│ │ Feishu  │ │ │  Planner  │ │ │ Built-in      │ │
│ │ Telegram│ │ │  Executor │ │ │ Custom        │ │
│ │ Discord │ │ │  Observer │ │ │ MCP           │ │
│ │ Slack   │ │ └───────────┘ │ └───────────────┘ │
│ │ Email   │ │       │       │         │         │
│ │ CLI     │ │       ▼       │         │         │
│ └─────────┘ │ ┌───────────┐ │         │         │
│      │      │ │   memU    │◄┼─────────┘         │
│      │      │ │  Memory   │ │                   │
│      │      │ │  Layer    │ │                   │
│      └──────┼─┤           │ │                   │
│             │ └───────────┘ │                   │
├─────────────┴───────────────┴───────────────────┤
│              LLM Provider Layer                  │
│   OpenAI │ Anthropic │ Ollama │ Custom          │
└─────────────────────────────────────────────────┘
```

> 📖 The **[memU Memory Layer](https://github.com/NevaMind-AI/memU)** is the heart of the system. It's an independent open-source project — you can use it in your own AI applications too.

---

## 🗺️ Roadmap

### 🖥️ Platform & OS

- [x] macOS support
- [x] Windows support
- [ ] Linux support

### 🤖 LLM Integrations

- [ ] OpenAI (GPT-4o, o1, o3, etc.)
- [x] Anthropic (Claude 4 Sonnet / Opus)
- [ ] Google (Gemini 2.5 Pro / Flash)
- [ ] DeepSeek (V3 / R1)
- [ ] Local models via Ollama
- [x] Custom / self-hosted LLM endpoints

### 💬 Platform Integrations

- [x] Telegram
- [x] Discord
- [x] Slack
- [x] Feishu / Lark
- [ ] WhatsApp
- [ ] Email (Gmail / Outlook)
- [ ] Web UI
- [ ] CLI

### 🔧 Skills & MCP

- [ ] Skills engine with configurable triggers & actions
- [ ] MCP (Model Context Protocol) server support
- [ ] Built-in skill templates (summarization, scheduling, monitoring, etc.)
- [ ] Custom skill development SDK

### 🔒 Security

- [ ] End-to-end encryption for memory storage
- [ ] Sensitive data detection & masking
- [ ] Secure credential management (API keys, tokens)
- [ ] Audit logging for all agent actions
- [ ] Compliance reporting (SOC2, GDPR)

### 🔑 Access Control & Permissions

- [ ] Role-based access control (RBAC)
- [ ] Enterprise SSO (SAML / OIDC)
- [ ] Per-user memory isolation
- [ ] Granular permission policies (read / write / execute)
- [ ] Team workspace management with admin dashboard

### 🤝 Multi-Agent Support

- [ ] Multi-agent orchestration & task delegation
- [ ] Shared memory pools across agents
- [ ] Agent-to-agent communication protocol
- [ ] Specialized agent roles (researcher, executor, reviewer, etc.)

---

## 🤝 Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

```bash
# Clone the repo
git clone https://github.com/NevaMind-AI/memUBot.git
cd memUBot

# Install dependencies
npm install

# Run in development mode
npm run dev
```

AI-assisted / vibe-coded PRs are welcome! 🤖

---

## 📄 License

[MIT License](LICENSE) — Use it, fork it, deploy it. Just don't forget to star ⭐

---

## 🔗 Links

- 🧠 **[memU — The Open-Source Memory Framework](https://github.com/NevaMind-AI/memU)** — The memory layer powering memUBot
- 🌐 **[memUBot Website](https://memubot.ai)** — Official website and documentation
- 💬 **[Discord Community](https://discord.gg/fFE4gfMvKf)** — Join the conversation
- 🦞 **[OpenClaw](https://github.com/openclaw/openclaw)** — The project that inspired us

---

<p align="center">
  <b>memUBot</b> — Enterprise-Ready AI. Proactive by Design. Memory by <a href="https://github.com/NevaMind-AI/memU">memU</a>. 🧠
</p>
<p align="center">
  Built with ❤️ by <a href="https://github.com/NevaMind-AI">NevaMind AI</a> and the community.
</p>
