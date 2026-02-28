---
name: Service Creator
description: Guide for creating background monitoring services that can proactively notify users
---

# Service Creator Skill

This skill guides you on how to create background services that monitor data and proactively notify users.

**Reference documents directory**: `{{SKILL_DIR}}/reference/`

When you need detailed information on a specific topic below, use `read_file` to load the corresponding reference document. Do NOT read all references upfront — only load what you need for the current step.

| Reference File | When to Read |
|----------------|--------------|
| `reference/architecture.md` | Before designing a new service's filtering logic |
| `reference/dry-run.md` | When implementing dry run mode or verifying dry run output |
| `reference/modification.md` | When modifying an existing service |
| `reference/guidelines.md` | For best practices and example conversations |
| `reference/templates-minimal.md` | When writing service code (recommended starting point) |
| `reference/templates-stock-monitor.md` | When building a data-monitoring service with local filtering |
| `reference/templates-python-monitor.md` | When building a Python monitoring service |
| `reference/templates-reminder.md` | When building a reminder/time-based service |

## When to Use

Create a service when the user asks you to:
- Monitor something continuously (stocks, websites, APIs, files, etc.)
- Get notified when certain conditions are met
- Run periodic checks or tasks
- Watch for changes or events

**Examples of user requests:**
- "Help me monitor XX stock, notify me if it drops more than 5%"
- "Watch this API endpoint and tell me when it returns data"
- "Check my server status every 5 minutes"
- "Monitor this folder for new files"

## Architecture Overview

Services use a **two-layer filtering** pattern: Local Rules Filter → Invoke API (LLM Evaluation).
Read `reference/architecture.md` for full details when designing filter logic.

## Service Creation Workflow

### Step 0: Runtime Availability Check (Automatic)

When you call `service_create`, the system automatically checks if the required runtime (Node.js or Python) is available. If not available, the tool returns an error.

**When runtime is missing:**
1. Ask the user if they want you to install it
2. If yes, try to install using methods that DON'T require sudo:
   - **macOS**: Use Homebrew (`brew install node` / `brew install python3`) - no sudo needed
   - **If no Homebrew**: Install Homebrew first, or use nvm/pyenv
   - **Linux/Windows**: Explain to user that installation requires manual steps (sudo password or admin rights)
3. After installation succeeds, retry `service_create`

**Note**: You cannot use sudo or su commands as they require password interaction. Only use installation methods that work without elevated privileges.

### Step 1: Create Service Metadata

Use the `service_create` tool with:
- `name`: Human-readable name
- `description`: What the service does
- `type`: Choose based on whether the task has a definite end:
  - `"longRunning"`: Never exits, runs indefinitely (e.g., "monitor stock price every 30s", "wake me up every day at 8am", "send weekly report every Monday")
  - `"scheduled"`: Completes and exits after task is done (e.g., "remind me at 4:30pm today", "remind me to drink water 3 times", "notify me tomorrow morning")
- `runtime`: `"node"` or `"python"`
- `entryFile`: Entry file name (e.g., `"index.js"` or `"main.py"`)
- `schedule`: For scheduled services, interval like `"*/5"` (every 5 minutes)
- `userRequest`: The user's original request (verbatim)
- `expectation`: What should trigger a notification

### Step 2: Write Service Code

After creating the service, write the code to the returned `servicePath`.

**Before writing code**: Read `reference/templates-minimal.md` for the recommended pattern. For more complex scenarios, read the appropriate full template.

**Pre-built invoke helper**: The `service_create` tool automatically generates an invoke helper file in the service directory:
- **Node.js**: `invoke.js` — use `const { invoke, dryRunResult, DRY_RUN, SERVICE_ID } = require('./invoke');`
- **Python**: `invoke.py` — use `from invoke import invoke, dry_run_result, DRY_RUN, SERVICE_ID`

**Invoke API uses named parameters** (NOT positional args):
- **Node.js**: `await invoke({ context: CONTEXT, summary: '...', details: '...', metadata: {} })`
- **Python**: `invoke(context=CONTEXT, summary='...', details='...', metadata={})`

This eliminates the need to copy-paste the invoke boilerplate. Just import and use it.

**CRITICAL: Service Code Requirements**

1. **Service lifecycle depends on type**:
   - `longRunning`: Never exit - keep running indefinitely with `setInterval`
   - `scheduled`: Exit with `process.exit(0)` after task completion (e.g., reminder sent, N executions done)
2. **Use the pre-built invoke helper** - Import from `./invoke` instead of writing your own HTTP client
3. **Implement local filtering first** - Use algorithms/rules to filter data before calling API
4. **Set appropriate thresholds** - Use slightly lower thresholds than user specified to catch edge cases
5. **Only call invoke when conditions are potentially met** - Save LLM tokens for important decisions
6. **Include context** - Pass the user's original request and expectations to LLM
7. **Validate external API responses** - Always check HTTP status code AND response structure before accessing nested properties. External APIs may return rate limit errors, unexpected JSON, or HTML error pages.
8. **Handle errors gracefully** - Wrap all API calls in try-catch and log meaningful error messages. Don't let the service crash due to temporary API failures.
9. **Respect rate limits** - Free APIs often have rate limits (e.g., 10-30 requests/minute). Don't poll too frequently.
10. **Implement dry run mode** - The service MUST support dry run mode. Read `reference/dry-run.md` for the specification and patterns.
11. **Only use built-in modules** - Only use Node.js or Python standard library modules (http, https, fs, os, json, urllib, etc.). Do NOT use third-party packages (no axios, requests, cheerio, etc.) to avoid dependency issues.

**IMPORTANT**: Use `setInterval()` (Node.js) or loops (Python) to keep the service running. For `scheduled` type, call `process.exit(0)` when the task is complete.

### Step 3: Verify with Dry Run (MANDATORY)

After writing the service code, you MUST run `service_dry_run` to verify it works. Read `reference/dry-run.md` for full verification criteria, iteration rules, and failure handling.

### Step 4: Start the Service

Only after a successful dry run, use `service_start` with the serviceId to start the service.

## Modifying Existing Services

When modifying a service, read `reference/modification.md` first — it describes the critical synchronization rules between code, CONTEXT, and service.json.

## Available Tools

- `service_create` - Create a new service
- `service_dry_run` - **Run a service in dry-run mode to verify it works (MANDATORY before starting)**
- `service_list` - List all services and their status
- `service_start` - Start a service (only after successful dry run)
- `service_stop` - Stop a service
- `service_delete` - Delete a service
- `service_get_info` - Get detailed service information
