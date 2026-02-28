## Modifying Existing Services

When the user asks to change an existing service, you must keep **three data sources in sync**:

| Location | Contains | Purpose |
|----------|----------|---------|
| Service code (logic) | Actual parameters, thresholds, targets | Runtime behavior |
| Service code (`CONTEXT`) | `userRequest`, `expectation` | Sent to invoke API |
| `service.json` | `context` object | Service metadata |

### The Synchronization Rule

**Any change to user requirements must be reflected in ALL three locations.**

The `invoke` API uses `context.userRequest` and `context.expectation` for LLM evaluation. If these don't match the actual service behavior:
- The LLM may reject valid notifications (outdated context suggests different criteria)
- The LLM may approve invalid notifications (context doesn't reflect current logic)

### Common Modification Scenarios

| User Request | Code Logic | CONTEXT.userRequest | CONTEXT.expectation |
|--------------|------------|---------------------|---------------------|
| "Change to 5pm" | Update time constant | Update to mention 5pm | Update target time |
| "Make it 3% instead" | Update threshold variable | Update percentage mentioned | Update threshold description |
| "Monitor BTC instead of ETH" | Update asset symbol | Update asset name | Update what to monitor |
| "Check every 10 minutes" | Update interval | Update frequency mentioned | Update check interval |
| "Only notify on drops" | Update condition logic | Update trigger description | Update notification criteria |

### Modification Workflow

1. **Stop**: `service_stop` to halt the running service
2. **Update code**: Use `str_replace_editor` to modify:
   - The actual logic/parameters
   - The `CONTEXT` object (`userRequest` and `expectation`)
3. **Update metadata**: Use `str_replace_editor` on `service.json` to update the `context` field
4. **Restart**: `service_start` to apply changes

### Key Principle

Think of it this way: if someone reads `service.json` or the `CONTEXT` in code, they should understand **exactly** what the service currently does - not what it was originally created to do.
