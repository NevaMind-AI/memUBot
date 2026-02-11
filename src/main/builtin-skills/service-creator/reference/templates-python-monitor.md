## Full Example: Python with Local Filtering + Dry Run

```python
#!/usr/bin/env python3
import os
import time
from invoke import invoke, dry_run_result, DRY_RUN, SERVICE_ID

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

def get_cpu_usage():
    # Implement your CPU monitoring logic
    # Example using built-in os module:
    load = os.getloadavg()[0]  # 1-minute load average
    cpu_count = os.cpu_count() or 1
    return min(100, (load / cpu_count) * 100)

def check_and_report():
    global last_notified_at
    
    cpu = get_cpu_usage()
    print(f"[{SERVICE_ID}] CPU: {cpu:.1f}%")
    
    # ====== LOCAL FILTER ======
    passes_filter = cpu >= LOCAL_THRESHOLD
    filter_reason = (
        f"CPU {cpu:.1f}% exceeds threshold {LOCAL_THRESHOLD}%"
        if passes_filter
        else f"CPU {cpu:.1f}% below threshold {LOCAL_THRESHOLD}%"
    )
    
    # ====== DRY RUN: print results and exit ======
    if DRY_RUN:
        dry_run_result(
            {'cpu_percent': round(cpu, 1)},
            {'passed': passes_filter, 'reason': filter_reason},
            passes_filter
        )
        return
    
    if not passes_filter:
        print(f"[{SERVICE_ID}] {filter_reason}, skipping LLM")
        return
    
    # Cooldown check
    if last_notified_at:
        elapsed = time.time() - last_notified_at
        if elapsed < COOLDOWN_SECONDS:
            print(f"[{SERVICE_ID}] In cooldown period, skipping")
            return
    
    # ====== PASSES LOCAL FILTER - CALL LLM ======
    print(f"[{SERVICE_ID}] {filter_reason} - calling LLM for evaluation")
    
    result = invoke(
        context=CONTEXT,
        summary=f"Server CPU at {cpu:.1f}%",
        details=f"CPU usage has reached {cpu:.1f}%, which is above the monitoring threshold.",
        metadata={"cpu_percent": round(cpu, 1)}
    )
    
    print(f"[{SERVICE_ID}] LLM decision: {result.get('data', {}).get('action')}")
    
    if result.get('data', {}).get('action') == 'notified':
        last_notified_at = time.time()

# ============ ENTRY POINT ============
if __name__ == "__main__":
    if DRY_RUN:
        print(f"[{SERVICE_ID}] Running in DRY RUN mode...")
        try:
            check_and_report()
        except Exception as e:
            print(f"[{SERVICE_ID}] Dry run failed: {e}")
            exit(1)
    else:
        print(f"[Service:{SERVICE_ID}] Starting CPU monitor...")
        while True:
            check_and_report()
            time.sleep(30)
```
