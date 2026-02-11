/**
 * Invoke Library Generator
 *
 * Generates pre-built invoke helper files (invoke.js / invoke.py) that services
 * can require/import instead of copy-pasting the invoke boilerplate every time.
 *
 * This reduces Agent code-generation errors and ensures a consistent invoke API.
 */

import * as fs from 'fs/promises'
import * as path from 'path'
import type { ServiceRuntime } from './types'

/**
 * Generate the invoke helper file in the service directory.
 * Called automatically during service_create.
 */
export async function generateInvokeLib(
  serviceDir: string,
  runtime: ServiceRuntime
): Promise<void> {
  const filename = runtime === 'node' ? 'invoke.js' : 'invoke.py'
  const content = runtime === 'node' ? getNodeInvokeLib() : getPythonInvokeLib()

  await fs.writeFile(path.join(serviceDir, filename), content, 'utf-8')
}

function getNodeInvokeLib(): string {
  return `// Auto-generated invoke helper — DO NOT EDIT
// Usage: const { invoke, DRY_RUN, SERVICE_ID, dryRunResult } = require('./invoke');

const http = require('http');

const SERVICE_ID = process.env.MEMU_SERVICE_ID || 'unknown';
const API_URL = process.env.MEMU_API_URL || 'http://127.0.0.1:31415';
const DRY_RUN = process.env.MEMU_DRY_RUN === 'true';

/**
 * Call the invoke API to report data and let LLM decide whether to notify user.
 *
 * Usage:
 *   await invoke({
 *     context: CONTEXT,       // { userRequest, expectation, notifyPlatform }
 *     summary: 'event title', // Brief event summary (required)
 *     details: '...',         // Detailed information (optional)
 *     metadata: { ... }       // Additional metadata (optional)
 *   });
 *
 * @param {object} options - Named parameters (see above)
 * @returns {Promise<object>} API response
 */
async function invoke(options) {
  if (!options || typeof options !== 'object') {
    throw new Error('invoke() expects a single options object, e.g. invoke({ context, summary })');
  }
  const { context, summary, details = '', metadata = {} } = options;
  if (!context || !context.userRequest) {
    throw new Error('invoke() requires options.context with userRequest and expectation fields');
  }
  if (!summary) {
    throw new Error('invoke() requires options.summary');
  }

  const payload = {
    context,
    data: {
      summary,
      details,
      timestamp: new Date().toISOString(),
      metadata
    },
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
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error('Invalid JSON response from invoke API: ' + data.substring(0, 200)));
        }
      });
    });
    req.on('error', (err) => {
      reject(new Error('Failed to call invoke API: ' + err.message));
    });
    req.write(JSON.stringify(payload));
    req.end();
  });
}

/**
 * Print dry-run result in the standard format.
 * @param {object} dataFetched - The raw data obtained from external sources
 * @param {object} filterResult - { passed: boolean, reason: string }
 * @param {boolean} wouldInvoke - Whether invoke would be called in real mode
 */
function dryRunResult(dataFetched, filterResult, wouldInvoke) {
  console.log('[DRY_RUN_RESULT]', JSON.stringify({ dataFetched, filterResult, wouldInvoke }));
}

module.exports = { invoke, dryRunResult, DRY_RUN, SERVICE_ID, API_URL };
`
}

function getPythonInvokeLib(): string {
  return `# Auto-generated invoke helper — DO NOT EDIT
# Usage: from invoke import invoke, dry_run_result, DRY_RUN, SERVICE_ID

import os
import json
import urllib.request
from datetime import datetime

SERVICE_ID = os.environ.get('MEMU_SERVICE_ID', 'unknown')
API_URL = os.environ.get('MEMU_API_URL', 'http://127.0.0.1:31415')
DRY_RUN = os.environ.get('MEMU_DRY_RUN') == 'true'


def invoke(*, context: dict, summary: str, details: str = '', metadata: dict = None):
    """
    Call the invoke API to report data and let LLM decide whether to notify user.

    Usage:
        invoke(
            context=CONTEXT,          # { 'userRequest': ..., 'expectation': ..., 'notifyPlatform': ... }
            summary='event title',    # Brief event summary (required)
            details='...',            # Detailed information (optional)
            metadata={ ... }          # Additional metadata (optional)
        )

    Returns:
        dict: API response
    """
    if not context or not isinstance(context, dict) or 'userRequest' not in context:
        raise ValueError('invoke() requires context dict with userRequest and expectation fields')
    if not summary:
        raise ValueError('invoke() requires summary string')

    payload = {
        'context': context,
        'data': {
            'summary': summary,
            'details': details,
            'timestamp': datetime.now().isoformat(),
            'metadata': metadata or {}
        },
        'serviceId': SERVICE_ID
    }

    url = f'{API_URL}/api/v1/invoke'
    data = json.dumps(payload).encode('utf-8')

    req = urllib.request.Request(
        url,
        data=data,
        headers={'Content-Type': 'application/json'},
        method='POST'
    )

    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            return json.loads(response.read().decode('utf-8'))
    except Exception as e:
        print(f'[invoke] Error calling invoke API: {e}')
        return None


def dry_run_result(data_fetched, filter_result, would_invoke):
    """
    Print dry-run result in the standard format.

    Args:
        data_fetched: The raw data obtained from external sources
        filter_result: { 'passed': bool, 'reason': str }
        would_invoke: Whether invoke would be called in real mode
    """
    print('[DRY_RUN_RESULT]', json.dumps({
        'dataFetched': data_fetched,
        'filterResult': filter_result,
        'wouldInvoke': would_invoke
    }))
`
}
