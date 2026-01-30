---
name: Service Creator
description: Guide for creating background monitoring services that can proactively notify users
---

# Service Creator Skill

This skill guides you on how to create background services that monitor data and proactively notify users.

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

## Service Creation Workflow

### Step 1: Create Service Metadata

Use the `service_create` tool with:
- `name`: Human-readable name
- `description`: What the service does
- `type`: `"longRunning"` (continuous) or `"scheduled"` (periodic)
- `runtime`: `"node"` or `"python"`
- `entryFile`: Entry file name (e.g., `"index.js"` or `"main.py"`)
- `schedule`: For scheduled services, interval like `"*/5"` (every 5 minutes)
- `userRequest`: The user's original request (verbatim)
- `expectation`: What should trigger a notification

### Step 2: Write Service Code

After creating the service, write the code to the returned `servicePath`.

**CRITICAL: Service Code Requirements**

1. **Service must run continuously** - All services are persistent processes that keep running. Use `setInterval` for periodic tasks. The service should NEVER exit unless an error occurs.
2. **Implement local filtering first** - Use algorithms/rules to filter data before calling API
3. **Set appropriate thresholds** - Use slightly lower thresholds than user specified to catch edge cases
4. **Only call invoke when conditions are potentially met** - Save LLM tokens for important decisions
5. **Include context** - Pass the user's original request and expectations to LLM

**IMPORTANT**: The service process must stay alive! Use `setInterval()` (Node.js) or `while True` loop (Python) to keep the service running and performing periodic checks.

### Step 3: Start the Service

Use `service_start` with the serviceId to start the service.

## Code Templates

### Node.js Stock Monitor (with Local Filtering)

```javascript
const http = require('http');
const https = require('https');

const SERVICE_ID = process.env.MEMU_SERVICE_ID;
const API_URL = process.env.MEMU_API_URL || 'http://127.0.0.1:31415';

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

// ============ INVOKE API ============
async function invoke(summary, details, metadata = {}) {
  const payload = {
    context: CONTEXT,
    data: { summary, details, timestamp: new Date().toISOString(), metadata },
    serviceId: SERVICE_ID
  };

  return new Promise((resolve, reject) => {
    const url = new URL('/api/v1/invoke', API_URL);
    const req = http.request({
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    });
    req.on('error', reject);
    req.write(JSON.stringify(payload));
    req.end();
  });
}

// ============ DATA FETCHING ============
async function fetchStockPrice(symbol) {
  // Example using a free API (replace with your preferred source)
  return new Promise((resolve, reject) => {
    https.get(`https://api.example.com/stock/${symbol}/price`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json.price);
        } catch (e) {
          reject(e);
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
    
    // Initialize reference price on first run
    if (referencePrice === null) {
      referencePrice = currentPrice;
      console.log(`[${SERVICE_ID}] Reference price set: $${referencePrice}`);
      return;
    }
    
    // Calculate change percentage
    const changePercent = ((currentPrice - referencePrice) / referencePrice) * 100;
    
    // ====== LOCAL FILTER ======
    // Only call LLM if change exceeds local threshold
    if (Math.abs(changePercent) < LOCAL_THRESHOLD_PERCENT) {
      console.log(`[${SERVICE_ID}] Change ${changePercent.toFixed(2)}% - below threshold, skipping LLM`);
      return; // Don't waste LLM tokens on small fluctuations
    }
    
    // Avoid duplicate notifications for same price level
    if (lastNotifiedPrice && Math.abs(currentPrice - lastNotifiedPrice) < 1) {
      console.log(`[${SERVICE_ID}] Already notified at similar price, skipping`);
      return;
    }
    
    // ====== PASSES LOCAL FILTER - CALL LLM ======
    console.log(`[${SERVICE_ID}] Change ${changePercent.toFixed(2)}% - calling LLM for evaluation`);
    
    const summary = `AAPL ${changePercent > 0 ? 'rose' : 'dropped'} ${Math.abs(changePercent).toFixed(2)}%`;
    const details = `Current: $${currentPrice.toFixed(2)}, Reference: $${referencePrice.toFixed(2)}`;
    
    const result = await invoke(summary, details, {
      symbol: 'AAPL',
      currentPrice,
      referencePrice,
      changePercent
    });
    
    console.log(`[${SERVICE_ID}] LLM decision: ${result.data?.action}`);
    
    if (result.data?.action === 'notified') {
      lastNotifiedPrice = currentPrice;
    }
  } catch (error) {
    console.error(`[${SERVICE_ID}] Error:`, error.message);
  }
}

// Run every 60 seconds
console.log(`[${SERVICE_ID}] Starting stock monitor...`);
checkAndReport();
setInterval(checkAndReport, 60000);
```

### Python with Local Filtering

```python
#!/usr/bin/env python3
import os
import json
import urllib.request
import time
from datetime import datetime

SERVICE_ID = os.environ.get('MEMU_SERVICE_ID', 'unknown')
API_URL = os.environ.get('MEMU_API_URL', 'http://127.0.0.1:31415')

CONTEXT = {
    "userRequest": "Monitor server CPU, notify if over 80%",
    "expectation": "Notify when CPU usage exceeds 80%",
    "notifyPlatform": "telegram"
}

# ============ LOCAL FILTERING CONFIG ============
# Set threshold lower than user's requirement (80% -> 70%)
LOCAL_THRESHOLD = 70
last_notified_at = None
COOLDOWN_SECONDS = 300  # Don't notify more than once per 5 minutes

def invoke(summary, details="", metadata=None):
    payload = {
        "context": CONTEXT,
        "data": {
            "summary": summary,
            "details": details,
            "timestamp": datetime.now().isoformat(),
            "metadata": metadata or {}
        },
        "serviceId": SERVICE_ID
    }
    
    req = urllib.request.Request(
        f"{API_URL}/api/v1/invoke",
        data=json.dumps(payload).encode(),
        headers={'Content-Type': 'application/json'},
        method='POST'
    )
    
    with urllib.request.urlopen(req) as response:
        return json.loads(response.read())

def get_cpu_usage():
    # Implement your CPU monitoring logic
    # Example: return psutil.cpu_percent()
    return 75.5  # placeholder

def check_and_report():
    global last_notified_at
    
    cpu = get_cpu_usage()
    print(f"[{SERVICE_ID}] CPU: {cpu}%")
    
    # ====== LOCAL FILTER ======
    if cpu < LOCAL_THRESHOLD:
        print(f"[{SERVICE_ID}] Below threshold ({LOCAL_THRESHOLD}%), skipping LLM")
        return
    
    # Cooldown check
    if last_notified_at:
        elapsed = time.time() - last_notified_at
        if elapsed < COOLDOWN_SECONDS:
            print(f"[{SERVICE_ID}] In cooldown period, skipping")
            return
    
    # ====== PASSES LOCAL FILTER - CALL LLM ======
    print(f"[{SERVICE_ID}] CPU {cpu}% - calling LLM for evaluation")
    
    result = invoke(
        summary=f"Server CPU at {cpu}%",
        details=f"CPU usage has reached {cpu}%, which is above the monitoring threshold.",
        metadata={"cpu_percent": cpu}
    )
    
    print(f"[{SERVICE_ID}] LLM decision: {result.get('data', {}).get('action')}")
    
    if result.get('data', {}).get('action') == 'notified':
        last_notified_at = time.time()

if __name__ == "__main__":
    print(f"[{SERVICE_ID}] Starting CPU monitor...")
    while True:
        check_and_report()
        time.sleep(30)  # Check every 30 seconds
```

### Node.js Simple Reminder Service

```javascript
// Simple reminder service - runs periodically and notifies user
const http = require('http');

const SERVICE_ID = process.env.MEMU_SERVICE_ID;
const API_URL = process.env.MEMU_API_URL || 'http://127.0.0.1:31415';
const INTERVAL_MINUTES = 15; // Reminder interval

const CONTEXT = {
  userRequest: "Remind me to drink water every 15 minutes",
  expectation: "Send a reminder notification every 15 minutes",
  notifyPlatform: "telegram"
};

async function invoke(summary, details = "", metadata = {}) {
  const payload = {
    context: CONTEXT,
    data: { summary, details, timestamp: new Date().toISOString(), metadata },
    serviceId: SERVICE_ID
  };

  return new Promise((resolve, reject) => {
    const url = new URL('/api/v1/invoke', API_URL);
    const req = http.request({
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    });
    req.on('error', reject);
    req.write(JSON.stringify(payload));
    req.end();
  });
}

async function sendReminder() {
  try {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    
    console.log(`[${SERVICE_ID}] Sending reminder at ${timeStr}`);
    
    const result = await invoke(
      "💧 Time to drink water!",
      `Current time: ${timeStr}. Stay hydrated!`,
      { time: timeStr }
    );
    
    console.log(`[${SERVICE_ID}] Result: ${result.data?.action}`);
  } catch (error) {
    console.error(`[${SERVICE_ID}] Error:`, error.message);
  }
}

// Start the service - MUST keep running!
console.log(`[${SERVICE_ID}] Reminder service started`);
console.log(`[${SERVICE_ID}] Will remind every ${INTERVAL_MINUTES} minutes`);

// Send first reminder
sendReminder();

// Keep running with setInterval - THIS IS REQUIRED!
setInterval(sendReminder, INTERVAL_MINUTES * 60 * 1000);
```

## Important Guidelines

1. **Local Filtering First**: Always implement rule-based filtering before calling invoke API
   - Use thresholds slightly lower than user's requirement (80% → 70%)
   - This allows LLM to catch edge cases while saving tokens

2. **Avoid Notification Spam**: Implement cooldown periods and deduplication
   - Track last notified state
   - Don't notify repeatedly for same condition

3. **Preserve User Intent**: Copy the user's exact words into `userRequest`

4. **Clear Expectations**: Write specific, measurable expectations

5. **Appropriate Intervals**: 
   - High-frequency data (stocks): Check every 30-60 seconds, but filter aggressively
   - Medium-frequency (servers): Check every 1-5 minutes
   - Low-frequency (daily reports): Use scheduled type

6. **Error Handling**: Services should handle errors gracefully and continue running

## Available Tools

- `service_create` - Create a new service
- `service_list` - List all services and their status
- `service_start` - Start a service
- `service_stop` - Stop a service
- `service_delete` - Delete a service
- `service_get_info` - Get detailed service information

## Example Conversation

**User**: "Help me monitor Bitcoin price, notify me if it goes above $50,000"

**You should**:
1. Use `service_create` with:
   - name: "Bitcoin Price Monitor"
   - type: "longRunning" 
   - runtime: "node"
   - userRequest: "Help me monitor Bitcoin price, notify me if it goes above $50,000"
   - expectation: "Notify when Bitcoin price exceeds $50,000 USD"

2. Write code that:
   - Fetches BTC price from an API
   - **Local filter**: Only call invoke if price > $48,000 (threshold buffer)
   - **LLM evaluation**: Let LLM make final decision on edge cases
   - Tracks last notified price to avoid spam

3. Start the service with `service_start`

4. Confirm to user: "I've created a Bitcoin price monitor. It checks the price every minute and will notify you when it approaches or exceeds $50,000."
