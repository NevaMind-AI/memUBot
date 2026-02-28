## Full Example: Node.js Simple Reminder Service (with Dry Run)

```javascript
// Simple reminder service - runs periodically and notifies user
const { invoke, dryRunResult, DRY_RUN, SERVICE_ID } = require('./invoke');

const INTERVAL_MINUTES = 15; // Reminder interval

const CONTEXT = {
  userRequest: "Remind me to drink water every 15 minutes",
  expectation: "Send a reminder notification every 15 minutes",
  notifyPlatform: "telegram"
};

async function sendReminder() {
  try {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });

    // ====== DRY RUN: verify logic and exit ======
    if (DRY_RUN) {
      dryRunResult(
        { currentTime: timeStr, intervalMinutes: INTERVAL_MINUTES },
        { passed: true, reason: 'Reminder services always invoke (time-based, no data filter)' },
        true
      );
      return;
    }

    console.log(`[${SERVICE_ID}] Sending reminder at ${timeStr}`);
    
    const result = await invoke({
      context: CONTEXT,
      summary: "Time to drink water!",
      details: `Current time: ${timeStr}. Stay hydrated!`,
      metadata: { time: timeStr }
    });
    
    console.log(`[${SERVICE_ID}] Result: ${result.data?.action}`);
  } catch (error) {
    console.error(`[${SERVICE_ID}] Error:`, error.message);
    if (DRY_RUN) throw error;
  }
}

// ============ ENTRY POINT ============
if (DRY_RUN) {
  console.log(`[${SERVICE_ID}] Running in DRY RUN mode...`);
  sendReminder()
    .then(() => process.exit(0))
    .catch((e) => { console.error(`[${SERVICE_ID}] Dry run failed:`, e.message); process.exit(1); });
} else {
  console.log(`[${SERVICE_ID}] Reminder service started`);
  console.log(`[${SERVICE_ID}] Will remind every ${INTERVAL_MINUTES} minutes`);
  sendReminder();
  setInterval(sendReminder, INTERVAL_MINUTES * 60 * 1000);
}
```
