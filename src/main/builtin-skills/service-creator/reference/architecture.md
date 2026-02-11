## Architecture: Two-Layer Filtering

**CRITICAL: Services must implement local rule filtering BEFORE calling the invoke API.**

```
Data Source → Local Rules Filter → (passes?) → Invoke API → LLM Evaluation → User
                    ↓ (fails)
                 Discard silently
```

### Why Two Layers?

1. **Local Rules (Fast, Free)**: Quick algorithmic checks that filter out 99% of irrelevant data
2. **LLM Evaluation (Smart, Costly)**: Intelligent judgment for edge cases that pass local rules

### Example: Stock Monitoring

User: "Monitor AAPL, notify me if it drops more than 5%"

**Layer 1 - Local Rules** (in service code):
- Calculate price change percentage
- Only proceed if change > 3% (slightly lower threshold as buffer)

**Layer 2 - LLM Evaluation** (via invoke API):
- LLM receives: "AAPL dropped 4.2% in the last hour"
- LLM decides: Should this trigger a notification? (Yes, it's close to 5% and significant)

This way:
- Normal 0.5% fluctuations → filtered locally, no LLM call
- 4.2% drop → passes local filter, LLM makes final decision
- Saves 95%+ of LLM calls while maintaining intelligent judgment
