<p align="center">
  <img src="assets/2501bot-logo.png" alt="2501-Bot Logo" width="200"/>
</p>

<h1 align="center">2501-Bot</h1>

<h3 align="center">The Enterprise-Ready AI Assistant.<br/>Your Proactive AI That Remembers Everything.</h3>

<p align="center">
  <a href="https://github.com/CuadraLabs/2501-Bot/blob/main/LICENSE"><img src="https://img.shields.io/github/license/CuadraLabs/2501-Bot" alt="License"/></a>
  <a href="https://github.com/CuadraLabs/2501-Bot/stargazers"><img src="https://img.shields.io/github/stars/CuadraLabs/2501-Bot" alt="Stars"/></a>
  <a href="https://discord.gg/YOUR_DISCORD"><img src="https://img.shields.io/badge/Discord-Join%20Us-5865F2?logo=discord&logoColor=white" alt="Discord"/></a>
   <a href="https://x.com/cuadralabs"><img src="https://img.shields.io/badge/Twitter-Follow-1DA1F2?logo=x&logoColor=white" alt="Twitter"/></a>
</p>

<p align="center">
  <a href="#-why-2501-bot">Why 2501-Bot</a> •
  <a href="#-memory-the-core-advantage">Memory</a> •
  <a href="#-enterprise-ready-features">Enterprise</a> •
  <a href="#-quick-start">Quick Start</a> •
  <a href="#-platform-support">Platforms</a> •
  <a href="#-skills--mcp">Skills & MCP</a> •
  <a href="#-contributing">Contributing</a>
</p>

---

## ⭐️ Star the repository

<img width="100%" src="assets/star repo.gif" />
If you find 2501-Bot useful or interesting, a GitHub Star ⭐️ would be greatly appreciated.

---

## 🙏 Acknowledgments

2501-Bot is built on the foundation of [OpenClaw](https://github.com/openclaw/openclaw) and inspired by the work of the [NevaMind AI](https://github.com/NevaMind-AI) team. We extend our sincere gratitude to the original creators for their innovative contributions to the open-source AI assistant ecosystem.

---

## 💡 Why 2501-Bot?

**2501-Bot bridges the gap** between personal AI assistants and enterprise-ready deployments. Built on a **robust custom memory system**, 2501-Bot is a **proactive, 24/7 AI assistant** designed from the ground up to be **enterprise-ready** — secure, stable, cost-efficient, and easy to deploy.

### Key Differentiators

- 🧠 **Memory-First Architecture** — Powered by **CuadraLabs First QMemory System** (QDrant/Redis/Stoolap) for robust, scalable memory with semantic indexing
- 🏢 **Enterprise-Ready** — Local-first, SOC2-friendly, one-click deployment, multi-platform integration
- 🤖 **Proactive, Not Reactive** — Continuously captures intent and acts before you ask
- 💰 **10x Cost Reduction** — Intelligent memory caching slashes token consumption dramatically
- 🔒 **Security by Design** — All data stays local. No cloud leaks. No excessive permissions

---

## 🧠 Memory: The Core Advantage

What sets 2501-Bot apart from every other AI assistant is its **memory layer**, powered by the **CuadraLabs First QMemory System**.

### Beyond Traditional Memory

Traditional AI assistants store memory via flat files or basic databases. They work — but they weren't designed for enterprise-scale, multi-user, always-on agents.

**2501-Bot replaces this entire layer** with a purpose-built memory infrastructure:

| Capability | Traditional Memory | CuadraLabs First QMemory System |
|---|---|---|
| **Long-Term Memory** | Single file, manually managed | **QDrant** vector database with semantic indexing |
| **Hot Memory** | None | **Redis** for fast session storage and state |
| **Structured Storage** | Basic SQLite | **Stoolap** SQLite-like filing system |
| **Retrieval** | Basic keyword search | Hybrid search (QDrant + Redis + Stoolap) |
| **Memory Lifecycle** | Manual writes, risk of loss | Auto-flush with multi-tier persistence |
| **Multi-Agent** | Single-user, single-session | Shared memory pools with access control |
| **Observability** | None | Full audit trail, export, analytics |

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

2501-Bot isn't a toy. It's built for production.

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
| **Multi-Platform** | macOS, Windows — native support across all major OS |
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

## 🚀 Quick Start

Getting started with 2501-Bot takes just a few minutes:

### 1. Get the Installer

Visit **[cuadralabs.com/2501-bot](https://cuadralabs.com/2501-bot)** and enter your email to receive the installer package.

### 2. Configure Your Platforms

Follow the **[Setup Tutorial](https://cuadralabs.com/2501-bot/tutorial)** to connect 2501-Bot with your preferred messaging platforms (Telegram, Discord, Slack, Feishu).

### 3. Done!

Your enterprise-ready AI assistant is live and ready to go.

---

## 📱 Platform Support

2501-Bot integrates with the tools your team already uses:

| Platform | Status | Description |
|---|---|---|
| **Telegram** | ✅ Supported | Full bot API support with inline commands |
| **Discord** | ✅ Supported | Server bots with slash commands and thread support |
| **Slack** | ✅ Supported | Workspace apps with channel and DM support |
| **Feishu** | ✅ Supported | Native integration with Feishu bots and group chats |
| **WhatsApp** | ✅ Supported | WhatsApp Business API integration |
| **LINE** | ✅ Supported | LINE Messaging API integration |
| **Web Chat** | 🚧 Coming Soon | Browser-based interface |

---

## 🔧 Skills & MCP

2501-Bot is extensible through **Skills** and **MCP** (Model Context Protocol) integrations.

### Skills

Skills are custom automation modules that extend 2501-Bot's capabilities. No coding required — configure them directly in the **2501-Bot application**:

- **Scheduled Tasks** — Set up recurring automations (e.g., daily summaries, weekly reports)
- **Event-Driven Actions** — Trigger skills based on messages, keywords, or platform events
- **Built-in Templates** — Get started quickly with pre-built skill templates for common workflows

### MCP Integration

2501-Bot supports the [Model Context Protocol](https://modelcontextprotocol.io/) standard, allowing seamless connection with:

- File systems, databases, and APIs
- Browser automation tools
- Code repositories and CI/CD pipelines
- Third-party SaaS tools

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────┐
│                   2501-Bot                      │
├─────────────┬───────────────┬───────────────────┤
│  Platform   │   Agent Core  │   Skills Engine   │
│  Adapters   │               │                   │
│ ┌─────────┐ │ ┌───────────┐ │ ┌───────────────┐ │
│ │ Feishu  │ │ │  Planner  │ │ │ Built-in      │ │
│ │ Telegram│ │ │  Executor │ │ │ Custom        │ │
│ │ Discord │ │ │  Observer │ │ │ MCP           │ │
│ │ Slack   │ │ └───────────┘ │ └───────────────┘ │
│ │ WhatsApp│ │       │       │         │         │
│ │ LINE    │ │       ▼       │         │         │
│ │ Email   │ │ ┌───────────┐ │         │         │
│ │ CLI     │ │ │  Memory   │◄┼─────────┘         │
│ └─────────┘ │ │  Layer    │ │                   │
│      │      │ │ QDrant    │ │                   │
│      │      │ │ Redis     │ │                   │
│      └──────┼─┤ Stoolap   │ │                   │
│             │ └───────────┘ │                   │
├─────────────┴───────────────┴───────────────────┤
│              LLM Provider Layer                  │
│   OpenAI │ Anthropic │ Ollama │ Custom          │
└─────────────────────────────────────────────────┘
```

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
- [x] Feishu
- [x] WhatsApp
- [x] LINE
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

Issues and PRs are welcome! 🤖

---

## 📄 License

[GNU Affero General Public License v3.0](LICENSE) — Use it, fork it, deploy it. Just don't forget to star ⭐

---

## 🔗 Links

- 🧠 **[2501-Bot — The Enterprise-Ready AI Assistant](https://github.com/CuadraLabs/2501-Bot)** — The memory layer powering 2501-Bot
- 🌐 **[2501-Bot Website](https://cuadralabs.com/2501-bot)** — Official website and documentation
- 💬 **[Discord Community](https://discord.gg/YOUR_DISCORD)** — Join the conversation
- 📧 **Contact** — [contact@cuadralabs.com](mailto:contact@cuadralabs.com)

---

<p align="center">
  <b>2501-Bot</b> — Enterprise-Ready AI. Proactive by Design. Memory by <a href="https://github.com/CuadraLabs">CuadraLabs</a>. 🧠
</p>
<p align="center">
  Built with ❤️ by <a href="https://github.com/CuadraLabs">CuadraLabs</a>.
</p>
