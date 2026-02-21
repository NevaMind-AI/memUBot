/**
 * Generate fuzzy-boundary temporary topic transition test cases.
 *
 * Unlike the large-1000 dataset where main/temp domains are clearly distinct
 * (e.g. deployment vs copywriting), this generator uses domain pairs that share
 * vocabulary and concepts, making topic boundary detection harder.
 */

import fs from 'node:fs/promises'
import path from 'node:path'

interface DomainPair {
  mainDomain: string
  tempDomain: string
  mainMessages: Array<{ role: 'user' | 'assistant'; content: string }>
  tempMessages: Array<{ role: 'user' | 'assistant'; content: string }>
  mainReference: string
  queries: {
    stayMain: string
    enterTemp: string
    stayTemp: string
    replaceTemp: string
    exitTemp: string
  }
}

const FUZZY_PAIRS: DomainPair[] = [
  {
    mainDomain: 'api-latency',
    tempDomain: 'api-rate-limiting',
    mainReference:
      'assistant: API latency optimization covers p99 response time targets, slow endpoint profiling, connection pool tuning, and upstream timeout configuration.',
    mainMessages: [
      { role: 'user', content: 'Our API p99 latency spiked to 1200ms after the last release.' },
      { role: 'assistant', content: 'I traced the regression to a missing connection pool limit on the user-service upstream.' },
      { role: 'user', content: 'What about the slow endpoint profiling results?' },
      { role: 'assistant', content: 'The /api/orders endpoint shows 800ms avg due to an unindexed join in the query layer.' },
      { role: 'user', content: 'Are there timeout config changes we should apply?' },
      { role: 'assistant', content: 'Recommend reducing upstream timeout from 30s to 5s and adding circuit breaker on the gateway.' }
    ],
    tempMessages: [
      { role: 'user', content: 'We need to implement rate limiting for the public API tier.' },
      { role: 'assistant', content: 'Current plan uses token bucket at 100 req/s per API key with burst allowance of 150.' },
      { role: 'user', content: 'How do we handle throttled requests?' },
      { role: 'assistant', content: 'Return 429 with Retry-After header and log the client ID for abuse pattern analysis.' },
      { role: 'user', content: 'What about the rate limit config for internal services?' },
      { role: 'assistant', content: 'Internal services bypass public rate limits but have a separate circuit breaker at 500 req/s.' }
    ],
    queries: {
      stayMain: 'Show me the p99 latency trend for the orders endpoint after we tuned the connection pool.',
      enterTemp: 'We should set up per-client request throttling to protect against API abuse.',
      stayTemp: 'What retry-after interval should we return when a client hits the token bucket limit?',
      replaceTemp: 'Can you draft the on-call rotation schedule for next quarter?',
      exitTemp: 'Go back to the latency investigation and check if the upstream timeout change improved p99.'
    }
  },
  {
    mainDomain: 'db-schema-migration',
    tempDomain: 'db-query-optimization',
    mainReference:
      'assistant: Database schema migration tracks ALTER TABLE scripts, backward compatibility checks, zero-downtime migration strategy, and rollback DDL.',
    mainMessages: [
      { role: 'user', content: 'The users table migration adds a nullable preferences JSONB column.' },
      { role: 'assistant', content: 'Migration script uses ALTER TABLE ADD COLUMN with DEFAULT NULL for zero-downtime compatibility.' },
      { role: 'user', content: 'Do we have a rollback DDL ready?' },
      { role: 'assistant', content: 'Rollback drops the column but we need to verify no application code references it first.' },
      { role: 'user', content: 'What about the foreign key constraint on the orders table?' },
      { role: 'assistant', content: 'The FK migration uses CREATE INDEX CONCURRENTLY followed by ADD CONSTRAINT with NOT VALID then VALIDATE.' }
    ],
    tempMessages: [
      { role: 'user', content: 'The dashboard query on the orders table takes over 3 seconds.' },
      { role: 'assistant', content: 'EXPLAIN ANALYZE shows a sequential scan on 2M rows due to missing composite index.' },
      { role: 'user', content: 'Which index strategy would help most?' },
      { role: 'assistant', content: 'A covering index on (user_id, created_at) with INCLUDE (total) eliminates the heap lookup.' },
      { role: 'user', content: 'Any concern about index bloat?' },
      { role: 'assistant', content: 'Schedule periodic REINDEX CONCURRENTLY and monitor index-to-table size ratio.' }
    ],
    queries: {
      stayMain: 'Walk me through the backward compatibility check for the JSONB column migration.',
      enterTemp: 'The query on the orders join is too slow—can we analyze the execution plan?',
      stayTemp: 'Should we add a partial index to skip soft-deleted rows in the orders query?',
      replaceTemp: 'Write the release notes for the v2.4 changelog.',
      exitTemp: 'Return to the schema migration and confirm the FK constraint rollback DDL is tested.'
    }
  },
  {
    mainDomain: 'react-component-testing',
    tempDomain: 'react-render-performance',
    mainReference:
      'assistant: React component testing covers unit test setup with Testing Library, mock provider patterns, snapshot regression, and coverage thresholds.',
    mainMessages: [
      { role: 'user', content: 'The UserProfile component test fails after the state refactor.' },
      { role: 'assistant', content: 'The test wrapper is missing the updated AuthContext provider mock.' },
      { role: 'user', content: 'How should we structure the mock for the new useAuth hook?' },
      { role: 'assistant', content: 'Create a test utility that wraps components in both AuthProvider and QueryClientProvider mocks.' },
      { role: 'user', content: 'Are our snapshot tests still valid?' },
      { role: 'assistant', content: 'Three snapshot tests need updating because the DOM structure changed with the new layout component.' }
    ],
    tempMessages: [
      { role: 'user', content: 'The dashboard page re-renders 12 times on initial load.' },
      { role: 'assistant', content: 'React DevTools Profiler shows cascading state updates in the filter chain causing unnecessary re-renders.' },
      { role: 'user', content: 'Should we memoize the chart component?' },
      { role: 'assistant', content: 'Wrap ExpenseChart in React.memo with a custom comparison on the data prop to avoid deep equality checks.' },
      { role: 'user', content: 'What about the virtual scrolling for the transactions list?' },
      { role: 'assistant', content: 'Switch to react-window with overscanCount of 5 to keep render count under control for 10k rows.' }
    ],
    queries: {
      stayMain: 'Update the snapshot tests for the UserProfile component after the layout DOM change.',
      enterTemp: 'The component tree re-renders too many times when filters change—can we profile it?',
      stayTemp: 'Check if wrapping the TransactionRow in React.memo reduces the flamegraph render time.',
      replaceTemp: 'Help me set up the project Storybook configuration for the design system.',
      exitTemp: 'Go back to the test failures and fix the AuthContext mock for the useAuth hook.'
    }
  },
  {
    mainDomain: 'k8s-deployment',
    tempDomain: 'docker-image-optimization',
    mainReference:
      'assistant: Kubernetes deployment work covers pod scheduling, service mesh routing, HPA autoscaling rules, and rolling update strategy.',
    mainMessages: [
      { role: 'user', content: 'The payment-service pods keep getting evicted during peak hours.' },
      { role: 'assistant', content: 'Pod QoS is BestEffort because resource requests are not set—need Guaranteed or Burstable class.' },
      { role: 'user', content: 'What HPA target should we use?' },
      { role: 'assistant', content: 'Target CPU utilization at 60 percent with min 3 max 12 replicas based on traffic pattern analysis.' },
      { role: 'user', content: 'How is the rolling update configured?' },
      { role: 'assistant', content: 'Strategy is RollingUpdate with maxSurge 25 percent and maxUnavailable 0 for zero-downtime.' }
    ],
    tempMessages: [
      { role: 'user', content: 'The Docker image for payment-service is 1.8GB and takes 8 minutes to build.' },
      { role: 'assistant', content: 'Multi-stage build with alpine base can reduce image to under 200MB.' },
      { role: 'user', content: 'How do we improve layer caching?' },
      { role: 'assistant', content: 'Move dependency install before COPY source so the npm install layer is cached across code changes.' },
      { role: 'user', content: 'Any security scanning concerns?' },
      { role: 'assistant', content: 'Trivy scan found 3 high-severity CVEs in the node:18 base—switch to node:18-slim and patch.' }
    ],
    queries: {
      stayMain: 'Adjust the HPA minReplicas to 5 for the payment-service and verify pod scheduling affinity.',
      enterTemp: 'The image pull takes too long—can we slim down the Docker layers for faster startup?',
      stayTemp: 'Does switching from node:18 to node:18-alpine break any native dependency in the Dockerfile?',
      replaceTemp: 'Draft the incident postmortem template for last week\'s outage.',
      exitTemp: 'Return to the K8s deployment and confirm the rolling update maxSurge setting works with the new replica count.'
    }
  },
  {
    mainDomain: 'user-authentication',
    tempDomain: 'user-session-management',
    mainReference:
      'assistant: User authentication flow covers OAuth2 PKCE login, MFA TOTP enrollment, password hashing with argon2, and social login provider integration.',
    mainMessages: [
      { role: 'user', content: 'The Google OAuth login flow fails on mobile Safari.' },
      { role: 'assistant', content: 'The PKCE code verifier is not being stored correctly due to Safari ITP blocking the redirect cookie.' },
      { role: 'user', content: 'Should we switch to a different OAuth flow for mobile?' },
      { role: 'assistant', content: 'Use the authorization code flow with a server-side session instead of relying on client-side PKCE state.' },
      { role: 'user', content: 'What about the MFA enrollment rate?' },
      { role: 'assistant', content: 'Only 23 percent of users have MFA enabled—consider a progressive nudge after third login.' }
    ],
    tempMessages: [
      { role: 'user', content: 'Users report being logged out after 15 minutes of inactivity.' },
      { role: 'assistant', content: 'The session idle timeout is set to 900 seconds; refresh token rotation extends active sessions.' },
      { role: 'user', content: 'How does the session cookie interact with the refresh token?' },
      { role: 'assistant', content: 'Session cookie carries the access token with 15-min expiry; refresh token in httpOnly cookie extends up to 7 days.' },
      { role: 'user', content: 'Any concurrent session limits?' },
      { role: 'assistant', content: 'Currently no limit—recommend capping at 5 concurrent sessions with oldest-first eviction.' }
    ],
    queries: {
      stayMain: 'Check the PKCE code verifier storage fix for mobile Safari and test the OAuth redirect flow.',
      enterTemp: 'Users complain about session expiration—what are the current idle timeout and refresh token settings?',
      stayTemp: 'Should we increase the refresh token lifetime from 7 days to 30 days for mobile users?',
      replaceTemp: 'Set up the email notification template for the new feature announcement.',
      exitTemp: 'Go back to the OAuth flow and verify the MFA TOTP enrollment nudge logic after three logins.'
    }
  },
  {
    mainDomain: 'payment-processing',
    tempDomain: 'payment-fraud-detection',
    mainReference:
      'assistant: Payment processing work covers Stripe integration, webhook idempotency, invoice reconciliation, and refund workflow automation.',
    mainMessages: [
      { role: 'user', content: 'The Stripe webhook for payment_intent.succeeded sometimes arrives twice.' },
      { role: 'assistant', content: 'We use the event ID as idempotency key in Redis with a 24-hour TTL to deduplicate.' },
      { role: 'user', content: 'How does the invoice reconciliation handle partial refunds?' },
      { role: 'assistant', content: 'Partial refund adjusts the line item amount and creates a credit memo linked to the original invoice.' },
      { role: 'user', content: 'What about the refund SLA for enterprise customers?' },
      { role: 'assistant', content: 'Enterprise refunds must be processed within 48 hours with Slack notification to the account manager.' }
    ],
    tempMessages: [
      { role: 'user', content: 'We saw a spike in chargebacks from new accounts last week.' },
      { role: 'assistant', content: 'Fraud scoring flagged 12 accounts with velocity pattern: 5+ transactions under 2 minutes.' },
      { role: 'user', content: 'What fraud rules are currently active?' },
      { role: 'assistant', content: 'Active rules include velocity check, BIN country mismatch, and disposable email detection.' },
      { role: 'user', content: 'Should we add device fingerprinting?' },
      { role: 'assistant', content: 'Device fingerprint adds a signal but needs consent banner for GDPR—recommend as optional enrichment.' }
    ],
    queries: {
      stayMain: 'Verify the webhook idempotency dedup works when Stripe retries the payment_intent.succeeded event.',
      enterTemp: 'Several new accounts triggered chargebacks—can we check the fraud velocity detection rules?',
      stayTemp: 'What threshold should the fraud velocity check use for flagging rapid small transactions?',
      replaceTemp: 'Help me draft the quarterly product roadmap presentation for stakeholders.',
      exitTemp: 'Return to the payment integration and finalize the partial refund credit memo flow.'
    }
  },
  {
    mainDomain: 'cicd-pipeline',
    tempDomain: 'build-optimization',
    mainReference:
      'assistant: CI/CD pipeline covers GitHub Actions workflow config, deployment gates, environment promotion strategy, and rollback triggers.',
    mainMessages: [
      { role: 'user', content: 'The staging deployment gate keeps failing on the smoke test step.' },
      { role: 'assistant', content: 'Smoke test hits a stale environment variable—the config map was not updated after last promotion.' },
      { role: 'user', content: 'How does our promotion from staging to production work?' },
      { role: 'assistant', content: 'Manual approval gate in GitHub Actions followed by canary deploy at 10 percent then full rollout.' },
      { role: 'user', content: 'What triggers an automatic rollback?' },
      { role: 'assistant', content: 'Error rate above 5 percent in the canary window or p99 latency exceeding 2x baseline triggers auto-rollback.' }
    ],
    tempMessages: [
      { role: 'user', content: 'The CI build takes 22 minutes—too slow for developer iteration.' },
      { role: 'assistant', content: 'Largest bottleneck is the full test suite running sequentially; parallelizing cuts it to 8 minutes.' },
      { role: 'user', content: 'Can we cache the dependency installation step?' },
      { role: 'assistant', content: 'GitHub Actions cache on node_modules with hash of package-lock saves 3 minutes per run.' },
      { role: 'user', content: 'What about the TypeScript compilation step?' },
      { role: 'assistant', content: 'Enable incremental compilation with tsBuildInfo cache to reduce tsc from 4 minutes to 40 seconds.' }
    ],
    queries: {
      stayMain: 'Fix the staging smoke test config map and re-trigger the deployment gate approval.',
      enterTemp: 'The CI build is too slow for fast iteration—can we parallelize the test suite?',
      stayTemp: 'Does the GitHub Actions cache for node_modules persist across different branch builds?',
      replaceTemp: 'Create the API documentation for the new webhook endpoints.',
      exitTemp: 'Go back to the deployment pipeline and verify the canary auto-rollback error rate threshold.'
    }
  },
  {
    mainDomain: 'backend-error-handling',
    tempDomain: 'backend-observability',
    mainReference:
      'assistant: Backend error handling covers structured error codes, retry policies, circuit breaker patterns, and user-facing error message mapping.',
    mainMessages: [
      { role: 'user', content: 'The order service throws untyped errors that crash the request handler.' },
      { role: 'assistant', content: 'Need a base AppError class with code, message, and isOperational flag to distinguish expected from unexpected.' },
      { role: 'user', content: 'How should retry work for transient downstream failures?' },
      { role: 'assistant', content: 'Exponential backoff with jitter, max 3 retries, and circuit breaker open after 5 consecutive failures.' },
      { role: 'user', content: 'What error codes do we expose to the client?' },
      { role: 'assistant', content: 'Map internal codes to HTTP status: VALIDATION_ERROR->400, NOT_FOUND->404, UPSTREAM_TIMEOUT->503.' }
    ],
    tempMessages: [
      { role: 'user', content: 'Our error logs are noisy and hard to correlate across services.' },
      { role: 'assistant', content: 'Structured logging with trace ID propagation via OpenTelemetry context would link related events.' },
      { role: 'user', content: 'Should we set up distributed tracing?' },
      { role: 'assistant', content: 'Jaeger with OpenTelemetry SDK auto-instruments HTTP and gRPC calls for cross-service trace correlation.' },
      { role: 'user', content: 'What metrics should we track for error observability?' },
      { role: 'assistant', content: 'Error rate by service, p95 error response time, and circuit breaker state changes as Prometheus counters.' }
    ],
    queries: {
      stayMain: 'Add the isOperational flag to the AppError base class and update the retry policy jitter range.',
      enterTemp: 'We need better visibility into errors across services—can we set up trace ID correlation?',
      stayTemp: 'What OpenTelemetry exporter config do we need to ship traces to Jaeger?',
      replaceTemp: 'Help me plan the team offsite agenda for next month.',
      exitTemp: 'Return to the error handling refactor and finalize the circuit breaker open threshold.'
    }
  },
  {
    mainDomain: 'search-indexing',
    tempDomain: 'search-relevance',
    mainReference:
      'assistant: Search indexing pipeline covers Elasticsearch index mapping, bulk ingestion, reindex strategy, and alias rotation for zero-downtime updates.',
    mainMessages: [
      { role: 'user', content: 'The product reindex job takes 6 hours and blocks search updates.' },
      { role: 'assistant', content: 'Switch to alias-based reindex: build new index in background then atomic alias swap.' },
      { role: 'user', content: 'How do we handle schema changes in the index mapping?' },
      { role: 'assistant', content: 'Create a versioned mapping template and migrate via reindex API with transform script.' },
      { role: 'user', content: 'What about the bulk ingestion throughput?' },
      { role: 'assistant', content: 'Increase bulk batch size to 5000 docs and use 4 parallel ingest threads with refresh_interval -1 during bulk.' }
    ],
    tempMessages: [
      { role: 'user', content: 'Search results for "wireless headphones" rank bluetooth speakers too high.' },
      { role: 'assistant', content: 'The BM25 scoring does not account for category affinity—need a function_score boost for exact category match.' },
      { role: 'user', content: 'Should we add synonym expansion?' },
      { role: 'assistant', content: 'Yes, a synonym filter mapping "wireless" to "bluetooth" helps but also introduces noise for unrelated categories.' },
      { role: 'user', content: 'How do we measure relevance improvement?' },
      { role: 'assistant', content: 'Use NDCG@10 on a curated judgment list and A/B test click-through rate against the current ranking.' }
    ],
    queries: {
      stayMain: 'Check the alias swap strategy and confirm the versioned mapping template handles the new field.',
      enterTemp: 'Users complain that search results for exact product names rank competitor items higher.',
      stayTemp: 'Should we increase the function_score boost weight for exact title match in the relevance tuning?',
      replaceTemp: 'Draft the job description for the new backend engineer opening.',
      exitTemp: 'Go back to the indexing pipeline and verify bulk ingestion throughput after increasing batch size.'
    }
  },
  {
    mainDomain: 'data-etl-pipeline',
    tempDomain: 'data-quality-validation',
    mainReference:
      'assistant: Data ETL pipeline covers Airflow DAG orchestration, source extraction connectors, transformation logic, and warehouse load scheduling.',
    mainMessages: [
      { role: 'user', content: 'The daily ETL DAG failed at the extraction step for the CRM source.' },
      { role: 'assistant', content: 'CRM API rate limit was hit during full extraction—switch to incremental extraction with cursor pagination.' },
      { role: 'user', content: 'How is the transformation step handling null values?' },
      { role: 'assistant', content: 'Null coalescing fills defaults for required columns; optional columns pass through as-is.' },
      { role: 'user', content: 'When does the warehouse load run relative to extraction?' },
      { role: 'assistant', content: 'Load task depends on both extraction and transformation success; runs nightly at 02:00 UTC with a 4-hour SLA.' }
    ],
    tempMessages: [
      { role: 'user', content: 'The revenue dashboard shows impossible negative values for some accounts.' },
      { role: 'assistant', content: 'Data quality check found 340 rows with sign-flipped amounts due to a currency conversion bug.' },
      { role: 'user', content: 'What validation rules should we add?' },
      { role: 'assistant', content: 'Add range checks on monetary columns, referential integrity on account IDs, and freshness SLA alerts.' },
      { role: 'user', content: 'How do we handle validation failures?' },
      { role: 'assistant', content: 'Quarantine bad rows to a staging table, alert the data team, and exclude from downstream aggregation.' }
    ],
    queries: {
      stayMain: 'Fix the CRM extraction cursor pagination and confirm the Airflow DAG dependency chain.',
      enterTemp: 'Some warehouse tables have duplicate rows and missing foreign keys—can we add validation checks?',
      stayTemp: 'What threshold should the range check use to quarantine outlier monetary values?',
      replaceTemp: 'Help me set up the new developer onboarding checklist for the data team.',
      exitTemp: 'Return to the ETL pipeline and verify the warehouse load SLA after switching to incremental extraction.'
    }
  }
]

interface DatasetEntry {
  id: string
  platform: string
  chatId: null
  query: string
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
  labels: { tags: string[] }
  metadata: Record<string, unknown>
}

function buildEntry(
  pair: DomainPair,
  pairIndex: number,
  transition: string,
  query: string,
  stateBefore: 'MAIN' | 'TEMP',
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
): DatasetEntry {
  const id = `fuzzy-${transition}-${String(pairIndex).padStart(3, '0')}`
  const meta: Record<string, unknown> = {
    stateBefore,
    expectedTransition: transition,
    mainDomain: pair.mainDomain,
    tempDomain: pair.tempDomain,
    pairIndex,
    purpose: `fuzzy boundary: ${pair.mainDomain} vs ${pair.tempDomain}`
  }

  if (stateBefore === 'TEMP') {
    meta.frozenMainReference = pair.mainReference
  }

  return {
    id,
    platform: 'telegram',
    chatId: null,
    query,
    messages,
    labels: {
      tags: ['temporary-topic', 'fuzzy-boundary', transition, `main-${pair.mainDomain}`, `temp-${pair.tempDomain}`]
    },
    metadata: meta
  }
}

function generateCases(): DatasetEntry[] {
  const entries: DatasetEntry[] = []

  for (let i = 0; i < FUZZY_PAIRS.length; i++) {
    const pair = FUZZY_PAIRS[i]

    entries.push(buildEntry(pair, i, 'stay-main', pair.queries.stayMain, 'MAIN', pair.mainMessages))
    entries.push(buildEntry(pair, i, 'enter-temp', pair.queries.enterTemp, 'MAIN', pair.mainMessages))
    entries.push(buildEntry(pair, i, 'stay-temp', pair.queries.stayTemp, 'TEMP', pair.tempMessages))
    entries.push(buildEntry(pair, i, 'replace-temp', pair.queries.replaceTemp, 'TEMP', pair.tempMessages))
    entries.push(buildEntry(pair, i, 'exit-temp', pair.queries.exitTemp, 'TEMP', pair.tempMessages))
  }

  return entries
}

async function main(): Promise<void> {
  const entries = generateCases()
  const lines = entries.map((entry) => JSON.stringify(entry))
  const outputPath = path.resolve('tests/layered-context/datasets/context-eval.temporary-topic.fuzzy-50.jsonl')
  await fs.writeFile(outputPath, lines.join('\n') + '\n', 'utf-8')
  console.log(`[GenerateFuzzyDataset] Wrote ${entries.length} cases to ${outputPath}`)
}

main().catch((error) => {
  console.error('[GenerateFuzzyDataset] Failed:', error)
  process.exit(1)
})
