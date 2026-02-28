## Full Example: Node.js Stock Monitor (with Local Filtering + Dry Run)

```javascript
const https = require('https');
const { invoke, dryRunResult, DRY_RUN, SERVICE_ID } = require('./invoke');

// User's original request
const CONTEXT = {
  userRequest: "Monitor AAPL stock, notify me if it drops more than 5%",
  expectation: "Notify when AAPL price drops more than 5% from reference price",
  notifyPlatform: "telegram"
};

// ============ LOCAL FILTERING CONFIG ============
// Set threshold slightly lower than user's requirement (5% -> 3%)
// This allows LLM to make judgment calls on edge cases
const LOCAL_THRESHOLD_PERCENT = 3.0;
let referencePrice = null;
let lastNotifiedPrice = null;

// ============ DATA FETCHING ============
// IMPORTANT: Always validate API responses! External APIs may return:
// - Rate limit errors (429)
// - Unexpected JSON structure
// - HTML error pages instead of JSON
async function fetchStockPrice(symbol) {
  // Example using a free API (replace with your preferred source)
  return new Promise((resolve, reject) => {
    https.get(`https://api.example.com/stock/${symbol}/price`, (res) => {
      // Check HTTP status first
      if (res.statusCode !== 200) {
        reject(new Error(`API returned status ${res.statusCode}`));
        return;
      }
      
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          
          // CRITICAL: Validate response structure before accessing nested properties
          if (!json || typeof json.price === 'undefined') {
            reject(new Error(`Invalid API response: missing 'price' field. Got: ${data.substring(0, 100)}`));
            return;
          }
          
          resolve(json.price);
        } catch (e) {
          // JSON parse failed - API might have returned HTML error page
          reject(new Error(`Failed to parse API response: ${e.message}. Raw: ${data.substring(0, 100)}`));
        }
      });
    }).on('error', reject);
  });
}

// ============ MAIN LOGIC WITH LOCAL FILTERING ============
async function checkAndReport() {
  try {
    const currentPrice = await fetchStockPrice('AAPL');
    console.log(`[${SERVICE_ID}] AAPL: $${currentPrice}`);
    
    // For dry run, use current price as both reference and current
    const refPrice = referencePrice || currentPrice;
    if (referencePrice === null) {
      referencePrice = currentPrice;
      console.log(`[${SERVICE_ID}] Reference price set: $${referencePrice}`);
    }
    
    // Calculate change percentage
    const changePercent = ((currentPrice - refPrice) / refPrice) * 100;
    
    // ====== LOCAL FILTER ======
    const passesFilter = Math.abs(changePercent) >= LOCAL_THRESHOLD_PERCENT;
    const filterReason = passesFilter
      ? `Change ${changePercent.toFixed(2)}% exceeds threshold ${LOCAL_THRESHOLD_PERCENT}%`
      : `Change ${changePercent.toFixed(2)}% below threshold ${LOCAL_THRESHOLD_PERCENT}%`;
    
    // ====== DRY RUN: print results and exit ======
    if (DRY_RUN) {
      dryRunResult(
        { symbol: 'AAPL', currentPrice, referencePrice: refPrice },
        { passed: passesFilter, reason: filterReason, changePercent },
        passesFilter
      );
      return;
    }
    
    if (!passesFilter) {
      console.log(`[${SERVICE_ID}] ${filterReason}, skipping LLM`);
      return;
    }
    
    // Avoid duplicate notifications for same price level
    if (lastNotifiedPrice && Math.abs(currentPrice - lastNotifiedPrice) < 1) {
      console.log(`[${SERVICE_ID}] Already notified at similar price, skipping`);
      return;
    }
    
    // ====== PASSES LOCAL FILTER - CALL LLM ======
    console.log(`[${SERVICE_ID}] ${filterReason} - calling LLM for evaluation`);
    
    const result = await invoke({
      context: CONTEXT,
      summary: `AAPL ${changePercent > 0 ? 'rose' : 'dropped'} ${Math.abs(changePercent).toFixed(2)}%`,
      details: `Current: $${currentPrice.toFixed(2)}, Reference: $${refPrice.toFixed(2)}`,
      metadata: { symbol: 'AAPL', currentPrice, referencePrice: refPrice, changePercent }
    });
    
    console.log(`[${SERVICE_ID}] LLM decision: ${result.data?.action}`);
    
    if (result.data?.action === 'notified') {
      lastNotifiedPrice = currentPrice;
    }
  } catch (error) {
    console.error(`[${SERVICE_ID}] Error:`, error.message);
    if (DRY_RUN) throw error; // Let dry run fail visibly
  }
}

// ============ ENTRY POINT ============
if (DRY_RUN) {
  console.log(`[${SERVICE_ID}] Running in DRY RUN mode...`);
  checkAndReport()
    .then(() => process.exit(0))
    .catch((e) => { console.error(`[${SERVICE_ID}] Dry run failed:`, e.message); process.exit(1); });
} else {
  console.log(`[${SERVICE_ID}] Starting stock monitor...`);
  checkAndReport();
  setInterval(checkAndReport, 60000);
}
```
