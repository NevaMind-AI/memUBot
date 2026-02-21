# Context Evaluation Toolkit

This toolkit evaluates whether layered context strategy reduces prompt tokens without harming context quality.

## Commands

- Build dataset v1 from local real sessions:
  - `npm run eval:context:build-v1`
- Run evaluation:
  - `npm run eval:context:run`
- Run evaluation on generated v1 dataset:
  - `npm run eval:context:run:v1`
- Run gate checks against latest run:
  - `npm run eval:context:gate`
- Run both:
  - `npm run eval:context:all`

## Runner options

`scripts/context-eval/runner.ts` supports these optional arguments:

- `--dataset <path>`: JSONL dataset path (default `tests/layered-context/datasets/context-eval.template.jsonl`)
- `--outputDir <path>`: output root directory (default `reports/context-eval`)
- `--runId <id>`: fixed run identifier
- `--maxCases <n>`: cap dataset cases
- `--withEmbedding true|false`: enable dense embedding retrieval (default `true`)
- `--requireEmbedding true|false`: fail if embedding is unavailable/invalid (default `true`)
- `--embeddingApiKey <key>`: explicit embedding API key
- `--embeddingBaseUrl <url>`: explicit embedding base URL
- `--embeddingTimeoutMs <n>`: embedding request timeout in ms (default `1200`)
- `--userDataDir <path>`: path used to auto-discover auth/settings for embedding key
- `--maxPromptTokens <n>`
- `--maxRecentMessages <n>` (default `24`)
- `--maxArchives <n>` (default `12`)
- `--archiveChunkSize <n>` (default `8`)
- `--scoreThresholdHigh <float>`
- `--top1Top2Margin <float>`
- `--maxItemsForL1 <n>`
- `--maxItemsForL2 <n>`

Example:

```bash
npm run eval:context:run -- --dataset tests/layered-context/datasets/context-eval.template.jsonl --maxPromptTokens 6000 --maxCases 20
```

When `requireEmbedding=true`, runner tries key discovery in this order:
1) CLI args, 2) env vars (`CONTEXT_EVAL_EMBEDDING_API_KEY` / `MEMU_API_KEY`), 3) `getAuthService().getAuthState().memuApiKey`, 4) `<userDataDir>/auth/session.json`, 5) `<userDataDir>/config/settings.json`.

## Dataset builder options

`scripts/context-eval/build-dataset-v1.ts` supports:

- `--userDataDir <path>`: app userData directory (auto-detected by default)
- `--outputPath <path>`: output JSONL path (default `tests/layered-context/datasets/context-eval.v1.jsonl`)
- `--targetCases <n>`: number of sampled cases (default `100`)
- `--variantsPerQuery <n>`: generate multiple windows for one query (default `3`)
- `--minHistoryMessages <n>` (default `18`)
- `--minWindowMessages <n>` (default `22`)
- `--maxWindowMessages <n>` (default `48`)
- `--minQueryChars <n>` (default `5`)
- `--platforms telegram,discord,slack,feishu` (default all)
- `--redact true|false` (default `true`)
- `--seed <n>` (default `42`)

Builder also writes `<dataset>.meta.json` with source and layer-mix statistics.

## Gate options

`scripts/context-eval/gate.ts` supports:

- `--summary <path>`: summary JSON path. If omitted, uses `reports/context-eval/latest.json`.
- `--runId <id>` and `--outputDir <path>`: load summary from a specific run.
- `--minTokenSavings <float>` (default `0.18`)
- `--maxEvidenceRecallDrop <float>` (default `0.03`)
- `--maxInformationLossRate <float>` (default `0.05`)
- `--minLayerAdequacyRate <float>` (default `0.80`)

Example:

```bash
npm run eval:context:gate -- --minTokenSavings 0.3 --maxEvidenceRecallDrop 0.01
```

## Dataset JSONL schema

Each line is one JSON object:

```json
{
  "id": "case-id",
  "platform": "telegram",
  "chatId": null,
  "query": "user query for retrieval",
  "messages": [
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ],
  "labels": {
    "expectedEvidence": ["keyword or phrase"],
    "expectedLayerMin": "L0",
    "tags": ["optional-tag"]
  }
}
```

The template dataset is intentionally small and mainly demonstrates schema plus reporting flow. Use real long-session production-like cases for gate decisions.

## Output files

Each run writes to `reports/context-eval/<runId>/`:

- `summary.json`: machine-readable metrics
- `summary.md`: high-level report
- `cases.csv`: per-case comparison table
- `regressions.md`: detailed regression analysis

And updates:

- `reports/context-eval/latest.json`: pointer to the latest run summary

