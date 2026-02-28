## Minimal Example (using invoke helper)

**Node.js** — shows the recommended pattern using the pre-built `invoke.js`:

```javascript
const https = require('https');
const { invoke, dryRunResult, DRY_RUN, SERVICE_ID } = require('./invoke');

const CONTEXT = {
  userRequest: "Monitor BTC price, notify if above $50,000",
  expectation: "Notify when BTC price exceeds $50,000",
  notifyPlatform: "telegram"
};

const THRESHOLD = 48000; // Buffer below 50k

async function checkAndReport() {
  // 1. Fetch data (using only built-in https module)
  const price = await new Promise((resolve, reject) => {
    https.get('https://api.example.com/btc/price', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const json = JSON.parse(data);
        resolve(json.price);
      });
    }).on('error', reject);
  });

  // 2. Local filter
  const passed = price >= THRESHOLD;
  const reason = passed ? `$${price} >= $${THRESHOLD}` : `$${price} < $${THRESHOLD}`;

  // 3. Dry run: print and exit
  if (DRY_RUN) {
    dryRunResult({ price }, { passed, reason }, passed);
    return;
  }

  // 4. Invoke (only if filter passes)
  if (!passed) return;
  await invoke({
    context: CONTEXT,
    summary: `BTC at $${price}`,
    details: `Price: $${price}, threshold: $${THRESHOLD}`
  });
}

if (DRY_RUN) {
  checkAndReport().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
} else {
  checkAndReport();
  setInterval(checkAndReport, 60000);
}
```

**Python** — same pattern using `invoke.py`:

```python
import json, urllib.request
from invoke import invoke, dry_run_result, DRY_RUN, SERVICE_ID

CONTEXT = {
    "userRequest": "Monitor BTC price, notify if above $50,000",
    "expectation": "Notify when BTC price exceeds $50,000",
    "notifyPlatform": "telegram"
}
THRESHOLD = 48000

def check_and_report():
    with urllib.request.urlopen('https://api.example.com/btc/price') as resp:
        price = json.loads(resp.read())['price']

    passed = price >= THRESHOLD
    reason = f"${price} >= ${THRESHOLD}" if passed else f"${price} < ${THRESHOLD}"

    if DRY_RUN:
        dry_run_result({'price': price}, {'passed': passed, 'reason': reason}, passed)
        return

    if not passed:
        return
    invoke(context=CONTEXT, summary=f"BTC at ${price}", details=f"Price: ${price}, threshold: ${THRESHOLD}")

if __name__ == "__main__":
    import time
    if DRY_RUN:
        check_and_report()
    else:
        while True:
            check_and_report()
            time.sleep(60)
```
