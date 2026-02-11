import { exec } from 'child_process'
import { promisify } from 'util'
import { serviceManager } from '../services/back-service'
import type { ServiceType, ServiceRuntime } from '../services/back-service'

const execAsync = promisify(exec)

/**
 * Service tool executor
 * Handles execution of service management tools
 */

interface ServiceCreateInput {
  name: string
  description: string
  type: ServiceType
  runtime: ServiceRuntime
  entryFile: string
  schedule?: string
  userRequest: string
  expectation: string
  notifyPlatform?: string
}

/**
 * Check if a runtime is available on the system
 */
async function checkRuntimeAvailable(runtime: ServiceRuntime): Promise<{ available: boolean; version?: string; error?: string }> {
  const command = runtime === 'node' ? 'node --version' : 'python3 --version'
  const runtimeName = runtime === 'node' ? 'Node.js' : 'Python 3'
  
  try {
    const { stdout } = await execAsync(command, { timeout: 5000 })
    const version = stdout.trim()
    console.log(`[ServiceExecutor] ${runtimeName} available: ${version}`)
    return { available: true, version }
  } catch (error) {
    console.log(`[ServiceExecutor] ${runtimeName} not available:`, error)
    
    return {
      available: false,
      error: `${runtimeName} is not installed or not available in PATH. You can help the user install it using the bash tool, then retry creating the service.`
    }
  }
}

interface ServiceIdInput {
  serviceId: string
}

interface ServiceDryRunInput {
  serviceId: string
  timeoutMs?: number
}

/**
 * Execute a service tool
 */
export async function executeServiceTool(
  toolName: string,
  input: unknown
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  try {
    switch (toolName) {
      case 'service_create':
        return await executeServiceCreate(input as ServiceCreateInput)

      case 'service_list':
        return await executeServiceList()

      case 'service_start':
        return await executeServiceStart(input as ServiceIdInput)

      case 'service_stop':
        return await executeServiceStop(input as ServiceIdInput)

      case 'service_delete':
        return await executeServiceDelete(input as ServiceIdInput)

      case 'service_get_info':
        return await executeServiceGetInfo(input as ServiceIdInput)

      case 'service_dry_run':
        return await executeServiceDryRun(input as ServiceDryRunInput)

      default:
        return { success: false, error: `Unknown service tool: ${toolName}` }
    }
  } catch (error) {
    console.error(`[ServiceExecutor] Error executing ${toolName}:`, error)
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

/**
 * Create a new service
 */
async function executeServiceCreate(input: ServiceCreateInput): Promise<{
  success: boolean
  data?: unknown
  error?: string
}> {
  // Check if the required runtime is available before creating the service
  const runtimeCheck = await checkRuntimeAvailable(input.runtime)
  if (!runtimeCheck.available) {
    return {
      success: false,
      error: runtimeCheck.error
    }
  }

  const result = await serviceManager.createService({
    name: input.name,
    description: input.description,
    type: input.type,
    runtime: input.runtime,
    entryFile: input.entryFile,
    schedule: input.schedule,
    context: {
      userRequest: input.userRequest,
      expectation: input.expectation,
      notifyPlatform: input.notifyPlatform
    }
  })

  if (result.success) {
    const runtimeName = input.runtime === 'node' ? 'Node.js' : 'Python'
    return {
      success: true,
      data: {
        serviceId: result.serviceId,
        servicePath: result.servicePath,
        runtimeVersion: runtimeCheck.version,
        message: `Service created successfully (${runtimeName} ${runtimeCheck.version} detected). Now write your service code to: ${result.servicePath}/${input.entryFile}`,
        template: getServiceTemplate(input.runtime, input.type)
      }
    }
  }

  return { success: false, error: result.error }
}

/**
 * List all services
 */
async function executeServiceList(): Promise<{
  success: boolean
  data?: unknown
  error?: string
}> {
  const services = await serviceManager.listServices()
  return {
    success: true,
    data: {
      count: services.length,
      services: services.map((s) => ({
        id: s.id,
        name: s.name,
        type: s.type,
        runtime: s.runtime,
        status: s.status,
        description: s.description
      }))
    }
  }
}

/**
 * Start a service (via tool = user intent, enable auto-start)
 */
async function executeServiceStart(input: ServiceIdInput): Promise<{
  success: boolean
  data?: unknown
  error?: string
}> {
  // When started via tool, enable auto-start (same as UI behavior)
  const result = await serviceManager.startService(input.serviceId, { enableAutoStart: true })
  if (result.success) {
    return {
      success: true,
      data: { message: `Service ${input.serviceId} started successfully` }
    }
  }
  return { success: false, error: result.error }
}

/**
 * Stop a service (via tool = user intent, disable auto-start)
 */
async function executeServiceStop(input: ServiceIdInput): Promise<{
  success: boolean
  data?: unknown
  error?: string
}> {
  // When stopped via tool, disable auto-start (same as UI behavior)
  const result = await serviceManager.stopService(input.serviceId, { disableAutoStart: true })
  if (result.success) {
    return {
      success: true,
      data: { message: `Service ${input.serviceId} stopped successfully` }
    }
  }
  return { success: false, error: result.error }
}

/**
 * Delete a service
 */
async function executeServiceDelete(input: ServiceIdInput): Promise<{
  success: boolean
  data?: unknown
  error?: string
}> {
  const result = await serviceManager.deleteService(input.serviceId)
  if (result.success) {
    return {
      success: true,
      data: { message: `Service ${input.serviceId} deleted successfully` }
    }
  }
  return { success: false, error: result.error }
}

/**
 * Get service info
 */
async function executeServiceGetInfo(input: ServiceIdInput): Promise<{
  success: boolean
  data?: unknown
  error?: string
}> {
  const service = await serviceManager.getService(input.serviceId)
  if (service) {
    return { success: true, data: service }
  }
  return { success: false, error: 'Service not found' }
}

/**
 * Dry-run a service to verify it works
 */
async function executeServiceDryRun(input: ServiceDryRunInput): Promise<{
  success: boolean
  data?: unknown
  error?: string
}> {
  const result = await serviceManager.dryRunService(input.serviceId, input.timeoutMs)

  if (result.error) {
    return { success: false, error: result.error }
  }

  // Build a structured report for the Agent to evaluate
  const report = {
    exitCode: result.exitCode,
    timedOut: result.timedOut,
    stdout: result.stdout.length > 4000 ? result.stdout.slice(-4000) : result.stdout,
    stderr: result.stderr.length > 2000 ? result.stderr.slice(-2000) : result.stderr,
    diagnosis: getDryRunDiagnosis(result)
  }

  return {
    success: result.success,
    data: report
  }
}

/**
 * Provide a brief diagnosis based on dry run output
 */
function getDryRunDiagnosis(result: {
  success: boolean
  stdout: string
  stderr: string
  exitCode: number | null
  timedOut: boolean
}): string {
  if (result.timedOut) {
    return 'TIMEOUT: Service did not exit within the time limit. Ensure the dry run mode runs the main function once and exits immediately (no setInterval/while loops in dry run mode).'
  }

  if (result.exitCode !== 0) {
    return `CRASH: Service exited with code ${result.exitCode}. Check stderr for error details and fix the code.`
  }

  if (!result.stdout.trim()) {
    return 'NO_OUTPUT: Service exited successfully but produced no output. The dry run mode should print the fetched data and filter results so you can verify correctness.'
  }

  if (result.stdout.includes('[DRY_RUN_RESULT]')) {
    return 'OK: Dry run completed with structured output. Evaluate the results to confirm they are meaningful and match user expectations.'
  }

  return 'OK: Dry run completed. Review stdout to verify the output is meaningful and the service logic works correctly.'
}

/**
 * Get service code template
 */
function getServiceTemplate(runtime: ServiceRuntime, type: ServiceType): string {
  if (runtime === 'node') {
    return getNodeTemplate(type)
  } else {
    return getPythonTemplate(type)
  }
}

function getNodeTemplate(type: ServiceType): string {
  const baseTemplate = `// Service: Auto-generated by memu
// The invoke helper (invoke.js) is auto-generated — just require and use it.
const { invoke, dryRunResult, DRY_RUN, SERVICE_ID } = require('./invoke');

// Context from user request (customize these)
const CONTEXT = {
  userRequest: "YOUR_USER_REQUEST_HERE",
  expectation: "YOUR_EXPECTATION_HERE",
  notifyPlatform: "telegram" // or discord, slack, etc.
};

/**
 * Your monitoring/task logic here
 */
async function checkAndReport() {
  try {
    // TODO: Implement your monitoring logic
    // Example: fetch data, check conditions, apply local filter
    
    const fetchedData = {}; // Replace with actual fetched data
    const passesFilter = true; // Replace with actual filter logic
    const filterReason = "TODO: describe filter result";

    // Dry run: print results and return (skip invoke)
    if (DRY_RUN) {
      dryRunResult(fetchedData, { passed: passesFilter, reason: filterReason }, passesFilter);
      return;
    }

    if (!passesFilter) {
      console.log(\`[\${SERVICE_ID}] \${filterReason}, skipping\`);
      return;
    }
    
    const result = await invoke({
      context: CONTEXT,
      summary: "Event summary here",
      details: "Detailed information here"
    });
    console.log('Invoke result:', result);
  } catch (error) {
    console.error('Error:', error);
    if (DRY_RUN) throw error; // Let dry run fail visibly
  }
}
`

  if (type === 'longRunning') {
    return baseTemplate + `
// ============ ENTRY POINT ============
if (DRY_RUN) {
  console.log(\`[\${SERVICE_ID}] Running in DRY RUN mode...\`);
  checkAndReport()
    .then(() => process.exit(0))
    .catch((e) => { console.error(\`[\${SERVICE_ID}] Dry run failed:\`, e.message); process.exit(1); });
} else {
  const INTERVAL_MS = 60000; // Check every minute
  console.log(\`[Service:\${SERVICE_ID}] Starting long-running service...\`);
  checkAndReport();
  setInterval(checkAndReport, INTERVAL_MS);
  process.on('SIGTERM', () => {
    console.log(\`[Service:\${SERVICE_ID}] Received SIGTERM, shutting down...\`);
    process.exit(0);
  });
}
`
  } else {
    return baseTemplate + `
// ============ ENTRY POINT ============
if (DRY_RUN) {
  console.log(\`[\${SERVICE_ID}] Running in DRY RUN mode...\`);
  checkAndReport()
    .then(() => process.exit(0))
    .catch((e) => { console.error(\`[\${SERVICE_ID}] Dry run failed:\`, e.message); process.exit(1); });
} else {
  console.log(\`[Service:\${SERVICE_ID}] Running scheduled task...\`);
  checkAndReport().then(() => {
    console.log(\`[Service:\${SERVICE_ID}] Task completed\`);
  }).catch(error => {
    console.error(\`[Service:\${SERVICE_ID}] Task failed:\`, error);
    process.exit(1);
  });
}
`
  }
}

function getPythonTemplate(type: ServiceType): string {
  const baseTemplate = `#!/usr/bin/env python3
# Service: Auto-generated by memu
# The invoke helper (invoke.py) is auto-generated — just import and use it.
import time
from invoke import invoke, dry_run_result, DRY_RUN, SERVICE_ID

# Context from user request (customize these)
CONTEXT = {
    "userRequest": "YOUR_USER_REQUEST_HERE",
    "expectation": "YOUR_EXPECTATION_HERE",
    "notifyPlatform": "telegram"  # or discord, slack, etc.
}

def check_and_report():
    """Your monitoring/task logic here"""
    try:
        # TODO: Implement your monitoring logic
        # Example: fetch data, check conditions, apply local filter
        
        fetched_data = {}  # Replace with actual fetched data
        passes_filter = True  # Replace with actual filter logic
        filter_reason = "TODO: describe filter result"

        # Dry run: print results and return (skip invoke)
        if DRY_RUN:
            dry_run_result(fetched_data, {'passed': passes_filter, 'reason': filter_reason}, passes_filter)
            return

        if not passes_filter:
            print(f"[{SERVICE_ID}] {filter_reason}, skipping")
            return
        
        result = invoke(
            context=CONTEXT,
            summary="Event summary here",
            details="Detailed information here"
        )
        print(f"Invoke result: {result}")
    except Exception as e:
        print(f"Error: {e}")
        if DRY_RUN:
            raise  # Let dry run fail visibly
`

  if (type === 'longRunning') {
    return baseTemplate + `

# ============ ENTRY POINT ============
INTERVAL_SECONDS = 60  # Check every minute

if __name__ == "__main__":
    if DRY_RUN:
        print(f"[{SERVICE_ID}] Running in DRY RUN mode...")
        try:
            check_and_report()
        except Exception as e:
            print(f"[{SERVICE_ID}] Dry run failed: {e}")
            exit(1)
    else:
        print(f"[Service:{SERVICE_ID}] Starting long-running service...")
        while True:
            check_and_report()
            time.sleep(INTERVAL_SECONDS)
`
  } else {
    return baseTemplate + `

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
        print(f"[Service:{SERVICE_ID}] Running scheduled task...")
        check_and_report()
        print(f"[Service:{SERVICE_ID}] Task completed")
`
  }
}
