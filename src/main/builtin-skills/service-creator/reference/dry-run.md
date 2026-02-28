## Dry Run Mode (MANDATORY)

Every service MUST support dry run mode via the `MEMU_DRY_RUN` environment variable. When `MEMU_DRY_RUN === 'true'`:

1. **Run the main data-fetching/processing logic exactly ONCE**
2. **Print structured output** prefixed with `[DRY_RUN_RESULT]` as JSON, including:
   - `dataFetched`: The raw data obtained from external sources
   - `filterResult`: What the local filter decided (pass/reject and why)
   - `wouldInvoke`: Whether the invoke API would be called in real mode
3. **Skip the invoke API call** - Do not call invoke during dry run
4. **Skip setInterval/while loops** - Run once and exit immediately
5. **Exit with code 0 on success, non-zero on failure**

### Node.js dry run pattern

```javascript
const DRY_RUN = process.env.MEMU_DRY_RUN === 'true';

async function checkAndReport() {
  // ... fetch data ...
  // ... apply local filter ...

  if (DRY_RUN) {
    console.log('[DRY_RUN_RESULT]', JSON.stringify({
      dataFetched: fetchedData,
      filterResult: { passed: shouldInvoke, reason: filterReason },
      wouldInvoke: shouldInvoke
    }));
    return;
  }

  // ... call invoke API (only in real mode) ...
}

// Entry point
if (DRY_RUN) {
  checkAndReport().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
} else {
  checkAndReport();
  setInterval(checkAndReport, INTERVAL_MS);
}
```

### Python dry run pattern

```python
DRY_RUN = os.environ.get('MEMU_DRY_RUN') == 'true'

def check_and_report():
    # ... fetch data ...
    # ... apply local filter ...

    if DRY_RUN:
        print('[DRY_RUN_RESULT]', json.dumps({
            'dataFetched': fetched_data,
            'filterResult': {'passed': should_invoke, 'reason': filter_reason},
            'wouldInvoke': should_invoke
        }))
        return

    # ... call invoke API (only in real mode) ...

if __name__ == '__main__':
    if DRY_RUN:
        check_and_report()
    else:
        while True:
            check_and_report()
            time.sleep(INTERVAL_SECONDS)
```

### Verification (Step 3)

After writing the service code, you MUST run `service_dry_run` to verify:

1. Call `service_dry_run` with the serviceId
2. Evaluate the output:
   - **exitCode === 0 AND stdout contains `[DRY_RUN_RESULT]`**: Parse the JSON and verify:
     - `dataFetched` contains real, non-empty data from the external source
     - `filterResult` shows the local filter logic is working
     - The output makes sense given the user's request
   - **exitCode !== 0 OR stderr contains errors**: The service has bugs, fix and retry
   - **timedOut**: The service didn't exit in dry run mode, fix the entry point logic
   - **No meaningful output**: The dry run mode wasn't implemented correctly, fix it

3. **Iteration rules:**
   - If dry run fails, fix the code and call `service_dry_run` again
   - Maximum **3 attempts** per service creation
   - Common fixes: wrong API URL, missing error handling, incorrect response parsing, missing dry run exit logic

4. **Giving up (after 3 failed attempts):**
   - If the failure is due to **external factors** you cannot control (API requires paid key, API is down, data source doesn't exist, etc.), you MUST:
     1. Call `service_delete` to clean up the service
     2. Explain to the user exactly why the service cannot be created
     3. Suggest alternatives if possible (different API, different approach, etc.)
   - Do NOT leave a broken service in the system
