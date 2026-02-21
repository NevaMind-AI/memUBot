/**
 * Generate a comprehensive temporary topic transition dataset.
 *
 * Coverage dimensions:
 * 1. Difficulty: easy (clearly distinct) / medium (related) / hard (overlapping vocabulary)
 * 2. Domains: engineering, product, design, business, data, infra, security, ML, mobile, frontend
 * 3. Query styles: direct, explicit switch ("by the way"), terse, detailed, imperative, question
 * 4. All 5 decision types balanced across difficulty levels
 */

import fs from 'node:fs/promises'
import path from 'node:path'

interface DomainPair {
  difficulty: 'easy' | 'medium' | 'hard'
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

// ========================================
// EASY pairs: clearly distinct topics
// ========================================

const ALL_PAIRS: DomainPair[] = [
  {
    difficulty: 'easy',
    mainDomain: 'kubernetes-networking',
    tempDomain: 'ui-color-palette',
    mainReference: 'K8s service mesh routing, ingress TLS termination, network policy rules, and pod-to-pod mTLS.',
    mainMessages: [
      { role: 'user', content: 'The istio sidecar proxy keeps timing out on cross-namespace calls.' },
      { role: 'assistant', content: 'Check the DestinationRule for the target service—mTLS mode might be set to STRICT while the caller uses PERMISSIVE.' },
      { role: 'user', content: 'How do we configure the ingress gateway for TLS passthrough?' },
      { role: 'assistant', content: 'Set the Gateway TLS mode to PASSTHROUGH and ensure the backend handles its own certificate.' }
    ],
    tempMessages: [
      { role: 'user', content: 'The brand color palette needs refreshing for the new marketing site.' },
      { role: 'assistant', content: 'Current primary #2563EB feels too corporate. Consider shifting to #6366F1 for a more modern look.' },
      { role: 'user', content: 'What about accessibility contrast ratios?' },
      { role: 'assistant', content: 'The proposed palette passes WCAG AA at 4.5:1 ratio against white background for all text sizes.' }
    ],
    queries: {
      stayMain: 'Add a NetworkPolicy to restrict egress from the payment namespace to only the database pods.',
      enterTemp: 'By the way, the designer wants to update the button colors for the new brand guidelines.',
      stayTemp: 'Should we use the darker shade for the hover state or add a subtle gradient effect?',
      replaceTemp: 'Can you write the sprint retrospective summary for last week?',
      exitTemp: 'Back to the K8s networking—did the mTLS fix resolve the cross-namespace timeout?'
    }
  },
  {
    difficulty: 'easy',
    mainDomain: 'ml-model-training',
    tempDomain: 'office-space-planning',
    mainReference: 'ML model training pipeline covers hyperparameter tuning, GPU allocation, dataset versioning, and experiment tracking with MLflow.',
    mainMessages: [
      { role: 'user', content: 'The fine-tuning job on 4x A100s keeps OOM-ing at batch size 32.' },
      { role: 'assistant', content: 'Try gradient accumulation with batch size 8 over 4 steps, or enable DeepSpeed ZeRO stage 3.' },
      { role: 'user', content: 'How are we tracking experiments?' },
      { role: 'assistant', content: 'MLflow server logs params, metrics, and artifacts. Each run gets a unique hash linked to the dataset version.' }
    ],
    tempMessages: [
      { role: 'user', content: 'We need to plan the new office layout for the engineering floor.' },
      { role: 'assistant', content: 'Current proposal has 40 desks in open plan with 4 meeting rooms and 2 phone booths.' },
      { role: 'user', content: 'Is there enough quiet space?' },
      { role: 'assistant', content: 'Add 6 focus pods along the window wall and convert the storage room into a small library.' }
    ],
    queries: {
      stayMain: 'Run the ablation study comparing LoRA rank 8 vs 16 on the validation set.',
      enterTemp: 'Unrelated—the facilities team is asking about desk assignment for the new hires next month.',
      stayTemp: 'How many standing desks should we order for the engineering area?',
      replaceTemp: 'Draft the Q3 OKR document for the platform team.',
      exitTemp: 'Going back to the model—what was the final validation loss after the DeepSpeed run?'
    }
  },
  {
    difficulty: 'easy',
    mainDomain: 'database-backup-recovery',
    tempDomain: 'marketing-campaign',
    mainReference: 'Database backup covers pg_dump schedules, WAL archiving, point-in-time recovery, and cross-region replication lag.',
    mainMessages: [
      { role: 'user', content: 'The nightly pg_dump is taking 4 hours and overlapping with peak traffic.' },
      { role: 'assistant', content: 'Switch to continuous WAL archiving with pgBackRest for incremental backups—eliminates the dump window.' },
      { role: 'user', content: 'What is our current RPO?' },
      { role: 'assistant', content: 'With WAL archiving every 60 seconds, RPO is under 1 minute. RTO is about 15 minutes for PITR.' }
    ],
    tempMessages: [
      { role: 'user', content: 'The Black Friday campaign email needs to go out by Wednesday.' },
      { role: 'assistant', content: 'Subject line A/B test shows "Early Access: 40% Off" outperforms "Black Friday Preview" by 12% open rate.' },
      { role: 'user', content: 'What segment are we targeting?' },
      { role: 'assistant', content: 'Active buyers with 2+ purchases in last 90 days—about 85K recipients after suppression list.' }
    ],
    queries: {
      stayMain: 'Test the PITR recovery to a timestamp before the accidental DROP TABLE.',
      enterTemp: 'Oh, the marketing team is asking about the email campaign database segment query.',
      stayTemp: 'Should we add cart abandoners from the last 30 days to the campaign segment?',
      replaceTemp: 'Help me prepare interview questions for the SRE candidate tomorrow.',
      exitTemp: 'Let me get back to the backup topic—did the WAL archiving switch reduce the nightly job duration?'
    }
  },
  {
    difficulty: 'easy',
    mainDomain: 'api-versioning-strategy',
    tempDomain: 'team-onboarding',
    mainReference: 'API versioning covers URL path versioning, header-based routing, deprecation policy, and backward compatibility guarantees.',
    mainMessages: [
      { role: 'user', content: 'Should we version via URL path like /v2/users or use Accept headers?' },
      { role: 'assistant', content: 'URL path versioning is simpler for consumers and easier to route at the gateway level.' },
      { role: 'user', content: 'How long do we support deprecated versions?' },
      { role: 'assistant', content: '6-month deprecation window with Sunset header, followed by 3 months of 410 Gone before removal.' }
    ],
    tempMessages: [
      { role: 'user', content: 'Three new engineers start next Monday and need onboarding.' },
      { role: 'assistant', content: 'Checklist covers dev environment setup, repo access, architecture overview session, and buddy assignment.' },
      { role: 'user', content: 'Who should run the architecture walkthrough?' },
      { role: 'assistant', content: 'The tech lead does a 90-minute session covering service map, data flow, and deployment pipeline.' }
    ],
    queries: {
      stayMain: 'Add the Sunset header to all v1 endpoints with the deprecation date.',
      enterTemp: 'Switching topics—can you set up the onboarding checklist for the new backend engineers?',
      stayTemp: 'Should the new hires shadow a production deploy during their first week?',
      replaceTemp: 'Write a bash script to clean up old Docker images from the registry.',
      exitTemp: 'Back to API versioning—have we added the v1 deprecation notice to the developer portal?'
    }
  },
  {
    difficulty: 'easy',
    mainDomain: 'mobile-push-notifications',
    tempDomain: 'server-cost-optimization',
    mainReference: 'Mobile push notification system covers FCM/APNS integration, notification channels, delivery tracking, and opt-in rate optimization.',
    mainMessages: [
      { role: 'user', content: 'Push delivery rate on iOS dropped to 60% after the last app update.' },
      { role: 'assistant', content: 'The provisional push authorization was not migrated—users need to re-grant explicit permission.' },
      { role: 'user', content: 'How do we track delivery confirmation?' },
      { role: 'assistant', content: 'APNS returns a device receipt; we correlate with our message ID and log to the analytics pipeline.' }
    ],
    tempMessages: [
      { role: 'user', content: 'Our AWS bill jumped 40% this month.' },
      { role: 'assistant', content: 'The spike is from 3 oversized RDS instances running in us-east-1 with no reserved instance pricing.' },
      { role: 'user', content: 'What quick wins can we get?' },
      { role: 'assistant', content: 'Right-size the dev/staging RDS to db.t3.medium and buy 1-year reserved instances for production.' }
    ],
    queries: {
      stayMain: 'Check the APNS certificate expiration date and renew before the notification channel breaks.',
      enterTemp: 'By the way, finance flagged the cloud spend—can we review the EC2 instance utilization?',
      stayTemp: 'Are there any unused EBS volumes or unattached Elastic IPs we can clean up?',
      replaceTemp: 'Help me plan the team building event for next Friday.',
      exitTemp: 'Let us return to push notifications—did re-requesting iOS permission improve the delivery rate?'
    }
  },

  // ========================================
  // MEDIUM pairs: related but distinct areas
  // ========================================
  {
    difficulty: 'medium',
    mainDomain: 'graphql-schema-design',
    tempDomain: 'rest-api-migration',
    mainReference: 'GraphQL schema design covers type definitions, resolver patterns, N+1 query prevention with DataLoader, and schema federation.',
    mainMessages: [
      { role: 'user', content: 'The User type has 30 fields and queries are over-fetching badly.' },
      { role: 'assistant', content: 'Split into UserProfile and UserSettings types with lazy-loaded connections to reduce payload.' },
      { role: 'user', content: 'How do we handle the N+1 problem on the orders field?' },
      { role: 'assistant', content: 'Use DataLoader to batch user-to-orders lookups per request cycle.' }
    ],
    tempMessages: [
      { role: 'user', content: 'We still have 15 legacy REST endpoints that need migration to the new API gateway.' },
      { role: 'assistant', content: 'Prioritize by traffic: /api/products and /api/cart account for 80% of calls.' },
      { role: 'user', content: 'Should we keep backward compatibility during migration?' },
      { role: 'assistant', content: 'Run both REST and new endpoints in parallel for 3 months with usage tracking before sunsetting.' }
    ],
    queries: {
      stayMain: 'Add pagination to the UserOrders connection type using cursor-based Relay spec.',
      enterTemp: 'Some clients still hit the old REST /api/products endpoint—should we start redirecting?',
      stayTemp: 'What HTTP status code should the legacy REST endpoints return during the sunset period?',
      replaceTemp: 'Can you review the Terraform module for the new VPC peering setup?',
      exitTemp: 'Going back to GraphQL—did the DataLoader fix reduce the resolver query count?'
    }
  },
  {
    difficulty: 'medium',
    mainDomain: 'feature-flag-system',
    tempDomain: 'ab-testing-framework',
    mainReference: 'Feature flag system covers LaunchDarkly integration, gradual rollout percentages, kill switch mechanism, and flag lifecycle management.',
    mainMessages: [
      { role: 'user', content: 'The new checkout flow flag is stuck at 10% rollout—should we increase?' },
      { role: 'assistant', content: 'Error rate in the 10% cohort is stable at 0.3%. Safe to bump to 50% for 48 hours then full.' },
      { role: 'user', content: 'How do we handle the kill switch?' },
      { role: 'assistant', content: 'LaunchDarkly kill switch instantly reverts to the old flow and triggers a PagerDuty alert.' }
    ],
    tempMessages: [
      { role: 'user', content: 'The pricing page A/B test has been running for 2 weeks with no winner.' },
      { role: 'assistant', content: 'Sample size is only 3K per variant—need at least 8K for 95% confidence on a 5% MDE.' },
      { role: 'user', content: 'Should we extend the test or declare no significant difference?' },
      { role: 'assistant', content: 'Extend for 2 more weeks. If still no signal, the variants are effectively equivalent—go with the simpler design.' }
    ],
    queries: {
      stayMain: 'Set the dark-mode flag to 100% for internal users and 25% for external.',
      enterTemp: 'The product team wants to know if we should declare the pricing A/B test inconclusive.',
      stayTemp: 'What minimum detectable effect should we target for the next homepage A/B test?',
      replaceTemp: 'Write the post-incident review for yesterday database failover.',
      exitTemp: 'Back to feature flags—what is the current rollout percentage for the new checkout flow?'
    }
  },
  {
    difficulty: 'medium',
    mainDomain: 'typescript-monorepo',
    tempDomain: 'npm-package-publishing',
    mainReference: 'TypeScript monorepo covers Turborepo build orchestration, shared tsconfig, workspace dependency management, and incremental builds.',
    mainMessages: [
      { role: 'user', content: 'Turborepo cache misses on every CI run despite no code changes.' },
      { role: 'assistant', content: 'The .env file is in the turbo hash inputs—move environment-specific config to runtime injection.' },
      { role: 'user', content: 'How do we share types across packages?' },
      { role: 'assistant', content: 'Create a @company/types workspace package with only type exports and reference via tsconfig paths.' }
    ],
    tempMessages: [
      { role: 'user', content: 'We want to publish the shared utils package to the private npm registry.' },
      { role: 'assistant', content: 'Configure .npmrc with the registry URL and use npm publish with --access restricted for scoped packages.' },
      { role: 'user', content: 'How do we handle versioning?' },
      { role: 'assistant', content: 'Use changesets for semantic versioning—each PR includes a changeset file describing the change type.' }
    ],
    queries: {
      stayMain: 'Fix the Turborepo remote cache configuration to use the self-hosted server.',
      enterTemp: 'The SDK team wants to publish @company/sdk to npm—what is our release process?',
      stayTemp: 'Should we use changesets or lerna for the npm package version bumps?',
      replaceTemp: 'Schedule the quarterly all-hands presentation for next Thursday.',
      exitTemp: 'Back to the monorepo—is the incremental build working after fixing the turbo hash inputs?'
    }
  },
  {
    difficulty: 'medium',
    mainDomain: 'logging-infrastructure',
    tempDomain: 'metrics-alerting',
    mainReference: 'Logging infrastructure covers structured log format, ELK stack ingestion, log retention policies, and PII redaction filters.',
    mainMessages: [
      { role: 'user', content: 'Elasticsearch is running out of disk because we retain 90 days of debug logs.' },
      { role: 'assistant', content: 'Reduce debug log retention to 7 days, info to 30, and error to 90. Use ILM rollover at 50GB per index.' },
      { role: 'user', content: 'Are we redacting PII from logs?' },
      { role: 'assistant', content: 'The Logstash filter masks email and IP but misses phone numbers in free-text fields.' }
    ],
    tempMessages: [
      { role: 'user', content: 'The CPU alert fired 20 times yesterday but nobody investigated.' },
      { role: 'assistant', content: 'Alert fatigue—the threshold is too low at 60%. Increase to 85% sustained for 5 minutes.' },
      { role: 'user', content: 'What metrics should trigger a PagerDuty page vs just a Slack notification?' },
      { role: 'assistant', content: 'Page for error rate > 5%, p99 > 3x baseline, or pod restart loop. Slack for CPU/memory warnings.' }
    ],
    queries: {
      stayMain: 'Add a phone number regex to the Logstash PII redaction filter.',
      enterTemp: 'The on-call engineer is overwhelmed with alerts—can we tune the alerting thresholds?',
      stayTemp: 'Should we add a silence window for the Kubernetes node scaling alerts during business hours?',
      replaceTemp: 'Create the data model diagram for the new inventory service.',
      exitTemp: 'Return to logging—did the ILM retention policy change free up enough disk on the ES cluster?'
    }
  },
  {
    difficulty: 'medium',
    mainDomain: 'ux-user-research',
    tempDomain: 'ux-interaction-design',
    mainReference: 'UX research covers user interview scripts, usability test protocols, persona development, and journey mapping sessions.',
    mainMessages: [
      { role: 'user', content: 'The usability test for the new onboarding flow had a 40% task failure rate.' },
      { role: 'assistant', content: '3 of 5 participants could not find the "Skip tutorial" button—it is too subtle in the corner.' },
      { role: 'user', content: 'Should we run another round of interviews?' },
      { role: 'assistant', content: 'Yes, recruit 5 new users from the enterprise segment to validate the persona assumptions.' }
    ],
    tempMessages: [
      { role: 'user', content: 'The multi-step form needs better progress indication.' },
      { role: 'assistant', content: 'Replace the numbered steps with a segmented progress bar showing completion percentage.' },
      { role: 'user', content: 'What about mobile touch targets?' },
      { role: 'assistant', content: 'Increase all interactive elements to minimum 44x44px and add haptic feedback on step completion.' }
    ],
    queries: {
      stayMain: 'Prepare the screener survey for recruiting enterprise users for the next round of interviews.',
      enterTemp: 'The onboarding form itself needs redesign—can we improve the multi-step interaction pattern?',
      stayTemp: 'Should the form auto-save draft state so users can resume on a different device?',
      replaceTemp: 'Write the project status update for the stakeholder meeting tomorrow.',
      exitTemp: 'Go back to the research findings—what did the enterprise users say about the tutorial skip button?'
    }
  },

  // ========================================
  // HARD pairs: highly overlapping concepts
  // ========================================
  {
    difficulty: 'hard',
    mainDomain: 'jwt-token-auth',
    tempDomain: 'api-key-auth',
    mainReference: 'JWT token auth covers access/refresh token pair, RS256 signing, token rotation, and stateless session validation.',
    mainMessages: [
      { role: 'user', content: 'The JWT access token lifetime is 15 minutes—is that too short?' },
      { role: 'assistant', content: '15 minutes with silent refresh via httpOnly cookie is the standard. Shorter risks UX friction.' },
      { role: 'user', content: 'How do we handle token revocation for banned users?' },
      { role: 'assistant', content: 'Maintain a short-lived blocklist in Redis keyed by jti claim, checked on every request.' },
      { role: 'user', content: 'What signing algorithm should we use?' },
      { role: 'assistant', content: 'RS256 with key rotation every 90 days. Publish the JWKS endpoint for consumer verification.' }
    ],
    tempMessages: [
      { role: 'user', content: 'Third-party integrators need API keys instead of JWT for server-to-server calls.' },
      { role: 'assistant', content: 'Generate a SHA-256 hashed API key per integration, stored with rate limit tier and scope permissions.' },
      { role: 'user', content: 'How do we scope API key permissions?' },
      { role: 'assistant', content: 'Attach a list of allowed endpoints and methods to each key. Validate scope on every request at the gateway.' },
      { role: 'user', content: 'What about key rotation?' },
      { role: 'assistant', content: 'Support dual active keys during rotation with a 7-day overlap window.' }
    ],
    queries: {
      stayMain: 'Rotate the RS256 signing key and update the JWKS endpoint with the new public key.',
      enterTemp: 'The partner integration team needs a way to authenticate without user sessions—can we issue API keys?',
      stayTemp: 'Should we add IP allowlisting as an extra security layer for high-privilege API keys?',
      replaceTemp: 'Help me debug the flaky end-to-end test in the checkout flow.',
      exitTemp: 'Return to JWT auth—is the Redis blocklist correctly invalidating tokens for deactivated accounts?'
    }
  },
  {
    difficulty: 'hard',
    mainDomain: 'css-design-system',
    tempDomain: 'css-responsive-layout',
    mainReference: 'Design system covers component token definitions, Tailwind theme config, spacing/typography scales, and dark mode variable mapping.',
    mainMessages: [
      { role: 'user', content: 'The spacing scale jumps from 16px to 32px with nothing in between.' },
      { role: 'assistant', content: 'Add 20px and 24px steps to the scale. Map to tokens: space-5 (20px) and space-6 (24px).' },
      { role: 'user', content: 'Dark mode colors look washed out on the card components.' },
      { role: 'assistant', content: 'The surface token maps to gray-800 in dark mode but the shadow is still using light-mode opacity. Adjust shadow-color token.' },
      { role: 'user', content: 'How do we enforce consistent usage?' },
      { role: 'assistant', content: 'Add a Stylelint rule to flag raw color/spacing values and require token references only.' }
    ],
    tempMessages: [
      { role: 'user', content: 'The dashboard layout breaks on tablet viewport between 768px and 1024px.' },
      { role: 'assistant', content: 'The grid switches from 3 columns to 1 at 768px—add a 2-column breakpoint at 768-1023px.' },
      { role: 'user', content: 'Should we use CSS Grid or Flexbox for this?' },
      { role: 'assistant', content: 'CSS Grid with grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)) handles it without explicit breakpoints.' },
      { role: 'user', content: 'What about the sidebar collapse behavior?' },
      { role: 'assistant', content: 'Below 1024px, collapse sidebar to icon-only rail. Below 768px, move to bottom navigation.' }
    ],
    queries: {
      stayMain: 'Update the Tailwind theme config to include the new spacing tokens and dark mode shadow fixes.',
      enterTemp: 'The product cards overlap on iPad—we need to fix the responsive grid behavior.',
      stayTemp: 'At what breakpoint should the filter sidebar switch from overlay to inline panel?',
      replaceTemp: 'Set up the new Sentry project for error tracking on the mobile app.',
      exitTemp: 'Back to the design system—has the Stylelint rule been configured to catch raw color values?'
    }
  },
  {
    difficulty: 'hard',
    mainDomain: 'redis-caching',
    tempDomain: 'redis-pubsub',
    mainReference: 'Redis caching covers cache invalidation strategy, TTL policies, cache-aside pattern, and hot key sharding.',
    mainMessages: [
      { role: 'user', content: 'Product listing cache miss rate is 35%—way too high.' },
      { role: 'assistant', content: 'TTL is set to 60 seconds which is too aggressive. Increase to 5 minutes with event-based invalidation.' },
      { role: 'user', content: 'How do we handle cache stampede?' },
      { role: 'assistant', content: 'Implement lock-based cache refresh: first request acquires a mutex and rebuilds while others wait or serve stale.' },
      { role: 'user', content: 'Any hot key concerns?' },
      { role: 'assistant', content: 'The homepage product list key gets 50K reads/sec. Shard across 4 replicas with consistent hashing.' }
    ],
    tempMessages: [
      { role: 'user', content: 'We need real-time inventory updates pushed to all connected dashboard clients.' },
      { role: 'assistant', content: 'Use Redis Pub/Sub channels per warehouse region. Each dashboard subscribes to relevant channels.' },
      { role: 'user', content: 'What about message reliability?' },
      { role: 'assistant', content: 'Pub/Sub is fire-and-forget. For guaranteed delivery, switch to Redis Streams with consumer groups.' },
      { role: 'user', content: 'How many subscribers can we support?' },
      { role: 'assistant', content: 'Pub/Sub handles thousands of subscribers. With Streams, use XREADGROUP for backpressure and ack tracking.' }
    ],
    queries: {
      stayMain: 'Increase the product listing cache TTL to 5 minutes and add the mutex-based stampede protection.',
      enterTemp: 'The operations team wants live inventory changes streamed to the dashboard—can we use Redis for that?',
      stayTemp: 'Should we migrate from Pub/Sub to Streams for the inventory channel to get delivery guarantees?',
      replaceTemp: 'Create the database ER diagram for the new supplier management module.',
      exitTemp: 'Return to caching—is the hot key sharding deployed and did it reduce the latency on the homepage?'
    }
  },
  {
    difficulty: 'hard',
    mainDomain: 'unit-testing',
    tempDomain: 'integration-testing',
    mainReference: 'Unit testing covers mock patterns, test isolation, coverage thresholds, and fast feedback loop with watch mode.',
    mainMessages: [
      { role: 'user', content: 'The order service unit tests are slow—120 seconds for 400 tests.' },
      { role: 'assistant', content: 'Heavy setup in beforeAll creates real DB connections. Replace with in-memory fakes for true isolation.' },
      { role: 'user', content: 'What is our coverage target?' },
      { role: 'assistant', content: '80% line coverage minimum for business logic packages. Utility packages can be lower at 60%.' },
      { role: 'user', content: 'How do we mock the payment gateway?' },
      { role: 'assistant', content: 'Create a PaymentGatewayStub implementing the interface that returns configurable success/failure responses.' }
    ],
    tempMessages: [
      { role: 'user', content: 'The checkout integration test fails intermittently in CI.' },
      { role: 'assistant', content: 'Race condition: the test does not wait for the webhook callback. Add a polling assertion with 10s timeout.' },
      { role: 'user', content: 'Should integration tests use the real database?' },
      { role: 'assistant', content: 'Yes, spin up a Postgres testcontainer per test suite for realistic behavior. Reset between tests with truncation.' },
      { role: 'user', content: 'How do we handle external service dependencies?' },
      { role: 'assistant', content: 'Use WireMock to stub external APIs with recorded responses. Run alongside testcontainers in docker-compose.' }
    ],
    queries: {
      stayMain: 'Refactor the order service beforeAll to use in-memory fakes and verify coverage stays above 80%.',
      enterTemp: 'The end-to-end checkout flow keeps failing in CI—can we look at the integration test setup?',
      stayTemp: 'Should we add a WireMock stub for the shipping rate calculator API in the integration suite?',
      replaceTemp: 'Update the README with the new local development setup instructions.',
      exitTemp: 'Go back to unit tests—did replacing the DB connection with fakes bring the test time under 30 seconds?'
    }
  },
  {
    difficulty: 'hard',
    mainDomain: 'microservice-decomposition',
    tempDomain: 'event-driven-architecture',
    mainReference: 'Microservice decomposition covers bounded context identification, service boundary definitions, shared data extraction, and API contract design.',
    mainMessages: [
      { role: 'user', content: 'The monolith order module has 15 database tables tightly coupled to user and inventory.' },
      { role: 'assistant', content: 'Start by identifying the order aggregate boundary: orders, line_items, and payments form one bounded context.' },
      { role: 'user', content: 'How do we handle the shared user data?' },
      { role: 'assistant', content: 'Order service stores a denormalized user snapshot (id, name, email) and syncs changes asynchronously.' },
      { role: 'user', content: 'What about the inventory check during order placement?' },
      { role: 'assistant', content: 'Use a synchronous API call for real-time stock check with circuit breaker fallback to cached availability.' }
    ],
    tempMessages: [
      { role: 'user', content: 'The synchronous inventory call creates tight coupling between order and inventory services.' },
      { role: 'assistant', content: 'Shift to event-driven: order publishes OrderPlaced event, inventory reserves stock asynchronously.' },
      { role: 'user', content: 'How do we handle the saga for order fulfillment?' },
      { role: 'assistant', content: 'Choreography-based saga: OrderPlaced -> InventoryReserved -> PaymentCharged -> OrderConfirmed with compensating events.' },
      { role: 'user', content: 'What message broker should we use?' },
      { role: 'assistant', content: 'Kafka for durable event log with at-least-once delivery and consumer group rebalancing.' }
    ],
    queries: {
      stayMain: 'Define the API contract for the order service including the denormalized user snapshot fields.',
      enterTemp: 'The synchronous calls between services are creating cascading failures—should we switch to events?',
      stayTemp: 'How should we configure the Kafka consumer group for the inventory reservation handler?',
      replaceTemp: 'Set up the GitHub branch protection rules for the new service repositories.',
      exitTemp: 'Return to the decomposition plan—have we finalized which tables belong to the order bounded context?'
    }
  },
  {
    difficulty: 'hard',
    mainDomain: 'ios-swift-ui',
    tempDomain: 'ios-core-data',
    mainReference: 'SwiftUI development covers view composition, state management with @Observable, navigation stack patterns, and preview provider setup.',
    mainMessages: [
      { role: 'user', content: 'The profile screen flickers when navigating back from the settings view.' },
      { role: 'assistant', content: 'The @State property resets on view recreation. Move the data source to an @Observable model held by the parent.' },
      { role: 'user', content: 'How should we structure the navigation stack?' },
      { role: 'assistant', content: 'Use NavigationStack with a NavigationPath state variable for programmatic navigation and deep linking.' },
      { role: 'user', content: 'What about the preview provider for authenticated screens?' },
      { role: 'assistant', content: 'Create a PreviewAuthContainer that injects a mock AuthService with configurable logged-in state.' }
    ],
    tempMessages: [
      { role: 'user', content: 'The app crashes when syncing Core Data with CloudKit after the model migration.' },
      { role: 'assistant', content: 'Lightweight migration failed on the new relationship. Use a mapping model for the one-to-many change.' },
      { role: 'user', content: 'Should we use NSPersistentCloudKitContainer?' },
      { role: 'assistant', content: 'Yes, but set the history tracking option and handle conflict resolution with NSMergeByPropertyObjectTrump.' },
      { role: 'user', content: 'What about fetch performance for the activity feed?' },
      { role: 'assistant', content: 'Add an NSFetchedResultsController with a batch size of 20 and section grouping by date.' }
    ],
    queries: {
      stayMain: 'Fix the @Observable model lifecycle so the profile data persists across navigation transitions.',
      enterTemp: 'The offline data sync is broken after the schema change—can we check the Core Data migration?',
      stayTemp: 'Should we increase the NSFetchedResultsController batch size for the activity feed on iPad?',
      replaceTemp: 'Write the App Store release notes for version 3.2.',
      exitTemp: 'Back to SwiftUI—did the NavigationStack refactor fix the deep linking from push notifications?'
    }
  },
  {
    difficulty: 'hard',
    mainDomain: 'webpack-bundling',
    tempDomain: 'webpack-dev-server',
    mainReference: 'Webpack bundling covers code splitting, tree shaking, chunk optimization, and production build size analysis.',
    mainMessages: [
      { role: 'user', content: 'The production bundle is 2.8MB—way too large for initial page load.' },
      { role: 'assistant', content: 'Bundle analyzer shows lodash (600KB) and moment (500KB) are fully imported. Switch to lodash-es and dayjs.' },
      { role: 'user', content: 'How do we configure code splitting?' },
      { role: 'assistant', content: 'Use dynamic import() for route-level splitting. Configure SplitChunksPlugin to extract vendor chunk at 200KB.' },
      { role: 'user', content: 'Is tree shaking working correctly?' },
      { role: 'assistant', content: 'Mark all packages as sideEffects: false in package.json and ensure ES module imports are used.' }
    ],
    tempMessages: [
      { role: 'user', content: 'The dev server takes 45 seconds to start and HMR updates are delayed by 5 seconds.' },
      { role: 'assistant', content: 'Disable source maps for node_modules in dev mode and use eval-cheap-module-source-map for app code.' },
      { role: 'user', content: 'Can we speed up the initial compilation?' },
      { role: 'assistant', content: 'Use cache type: filesystem to persist build artifacts. Also exclude large vendor libs from HMR.' },
      { role: 'user', content: 'What about the proxy config for API calls?' },
      { role: 'assistant', content: 'Add devServer.proxy entries for /api/* to forward to localhost:3001 with changeOrigin: true.' }
    ],
    queries: {
      stayMain: 'Run the bundle analyzer on the latest production build and check if the lodash-es migration reduced size.',
      enterTemp: 'Dev server startup is painfully slow—can we enable the filesystem cache for faster rebuilds?',
      stayTemp: 'Should we add the API proxy configuration for the new microservice running on port 3002?',
      replaceTemp: 'Generate the OpenAPI spec from the route definitions for the documentation site.',
      exitTemp: 'Back to the production bundle—did tree shaking eliminate the unused exports after marking sideEffects false?'
    }
  },
  {
    difficulty: 'hard',
    mainDomain: 'terraform-infra',
    tempDomain: 'ansible-config-mgmt',
    mainReference: 'Terraform infrastructure covers IaC module composition, state management, provider configuration, and plan/apply CI workflow.',
    mainMessages: [
      { role: 'user', content: 'The Terraform state file is 50MB and plan takes 8 minutes.' },
      { role: 'assistant', content: 'Split into smaller state files per environment and use workspaces with remote backend for isolation.' },
      { role: 'user', content: 'How do we share modules across teams?' },
      { role: 'assistant', content: 'Publish reusable modules to a private Terraform registry with semantic versioning.' },
      { role: 'user', content: 'What about drift detection?' },
      { role: 'assistant', content: 'Schedule a nightly terraform plan in CI that alerts if actual infra differs from the declared state.' }
    ],
    tempMessages: [
      { role: 'user', content: 'The application config on the new fleet of servers is inconsistent after manual changes.' },
      { role: 'assistant', content: 'Ansible playbook should enforce the desired state. Run it hourly via cron to correct drift.' },
      { role: 'user', content: 'Should we use roles or standalone playbooks?' },
      { role: 'assistant', content: 'Structure as Ansible roles per service: nginx, app, monitoring. Compose into site-wide playbooks.' },
      { role: 'user', content: 'How do we manage secrets in Ansible?' },
      { role: 'assistant', content: 'Use ansible-vault for sensitive vars and integrate with HashiCorp Vault for runtime secret injection.' }
    ],
    queries: {
      stayMain: 'Add drift detection as a scheduled CI pipeline that runs terraform plan every night.',
      enterTemp: 'The server fleet has config drift from manual SSH changes—can we enforce state with Ansible?',
      stayTemp: 'Should we store the Ansible vault password in the CI secrets or use an external key management service?',
      replaceTemp: 'Summarize the action items from today standup meeting.',
      exitTemp: 'Return to Terraform—did splitting the state into per-environment files reduce the plan time?'
    }
  },
  {
    difficulty: 'hard',
    mainDomain: 'postgres-performance',
    tempDomain: 'postgres-replication',
    mainReference: 'PostgreSQL performance tuning covers query plan analysis, index strategy, vacuum configuration, and connection pool sizing.',
    mainMessages: [
      { role: 'user', content: 'The dashboard aggregate query takes 12 seconds with a sequential scan on 5M rows.' },
      { role: 'assistant', content: 'Create a composite index on (tenant_id, created_at) and enable index-only scans by adding amount to INCLUDE.' },
      { role: 'user', content: 'Autovacuum seems stuck on the events table.' },
      { role: 'assistant', content: 'Table has 200M dead tuples. Reduce autovacuum_vacuum_cost_delay to 2ms and increase workers to 4 for this table.' },
      { role: 'user', content: 'What about connection pool sizing?' },
      { role: 'assistant', content: 'PgBouncer in transaction mode with max 100 server connections. App pool at 20 per instance with 5 instances.' }
    ],
    tempMessages: [
      { role: 'user', content: 'The read replica is 30 seconds behind the primary during peak writes.' },
      { role: 'assistant', content: 'Replication lag is caused by a single-threaded apply process. Enable parallel replication with max_parallel_workers = 4.' },
      { role: 'user', content: 'Should we promote the replica if the primary fails?' },
      { role: 'assistant', content: 'Use Patroni for automatic failover with DCS in etcd. Set TTL to 30s and loop_wait to 10s.' },
      { role: 'user', content: 'How do we handle split-brain scenarios?' },
      { role: 'assistant', content: 'Patroni fencing isolates the old primary. Applications reconnect via the Patroni endpoint which always points to the leader.' }
    ],
    queries: {
      stayMain: 'Run EXPLAIN ANALYZE on the dashboard query after adding the composite index and verify it uses an index-only scan.',
      enterTemp: 'The analytics read replica keeps falling behind during bulk imports—can we check the replication setup?',
      stayTemp: 'What Patroni loop_wait and TTL values give us the fastest failover without false positives?',
      replaceTemp: 'Write the data retention policy document for GDPR compliance.',
      exitTemp: 'Back to performance tuning—did reducing the autovacuum cost delay clear the dead tuples on the events table?'
    }
  },
  {
    difficulty: 'hard',
    mainDomain: 'product-roadmap-planning',
    tempDomain: 'product-analytics',
    mainReference: 'Product roadmap planning covers feature prioritization, quarterly theme alignment, dependency mapping, and stakeholder alignment.',
    mainMessages: [
      { role: 'user', content: 'The Q2 roadmap has 15 items but we can only deliver 8 with current capacity.' },
      { role: 'assistant', content: 'Apply RICE scoring: reach times impact times confidence divided by effort. Top 8 by score get committed.' },
      { role: 'user', content: 'How do we handle cross-team dependencies?' },
      { role: 'assistant', content: 'Map dependencies in a matrix and negotiate shared milestones. Block items with unresolved dependencies.' },
      { role: 'user', content: 'Stakeholders want to add 3 more items mid-quarter.' },
      { role: 'assistant', content: 'Trade off: for every new item added, one must be deferred. Present the tradeoff with impact estimates.' }
    ],
    tempMessages: [
      { role: 'user', content: 'We need to track which features drive the most engagement after launch.' },
      { role: 'assistant', content: 'Set up Mixpanel funnels for each new feature with adoption, activation, and retention events.' },
      { role: 'user', content: 'How do we measure feature success criteria?' },
      { role: 'assistant', content: 'Define leading indicators per feature: DAU for engagement, conversion rate for growth, NPS for satisfaction.' },
      { role: 'user', content: 'What about the attribution model?' },
      { role: 'assistant', content: 'Multi-touch attribution with first-touch for awareness features and last-touch for conversion features.' }
    ],
    queries: {
      stayMain: 'Re-score the deferred Q2 items using RICE and propose the final committed list for the stakeholder review.',
      enterTemp: 'Before we commit, can we look at the analytics data on which launched features actually moved the needle?',
      stayTemp: 'What retention cohort should we use to evaluate whether the new onboarding flow is working?',
      replaceTemp: 'Book the conference room for the engineering all-hands next week.',
      exitTemp: 'Return to the roadmap—based on the analytics, should we reprioritize the items before the final commit?'
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
  globalIndex: number,
  transition: string,
  query: string,
  stateBefore: 'MAIN' | 'TEMP',
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
): DatasetEntry {
  const id = `${pair.difficulty}-${transition}-${String(globalIndex).padStart(3, '0')}`
  const meta: Record<string, unknown> = {
    stateBefore,
    expectedTransition: transition,
    mainDomain: pair.mainDomain,
    tempDomain: pair.tempDomain,
    difficulty: pair.difficulty,
    purpose: `${pair.difficulty} boundary: ${pair.mainDomain} vs ${pair.tempDomain}`
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
      tags: [
        'temporary-topic',
        `difficulty-${pair.difficulty}`,
        transition,
        `main-${pair.mainDomain}`,
        `temp-${pair.tempDomain}`
      ]
    },
    metadata: meta
  }
}

function generateCases(): DatasetEntry[] {
  const entries: DatasetEntry[] = []

  for (let i = 0; i < ALL_PAIRS.length; i++) {
    const pair = ALL_PAIRS[i]
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
  const outputPath = path.resolve('tests/layered-context/datasets/context-eval.temporary-topic.comprehensive-100.jsonl')
  await fs.writeFile(outputPath, lines.join('\n') + '\n', 'utf-8')

  const byDifficulty = { easy: 0, medium: 0, hard: 0 }
  for (const pair of ALL_PAIRS) byDifficulty[pair.difficulty]++
  console.log(`[GenerateComprehensiveDataset] Wrote ${entries.length} cases to ${outputPath}`)
  console.log(`  Easy pairs: ${byDifficulty.easy} (${byDifficulty.easy * 5} cases)`)
  console.log(`  Medium pairs: ${byDifficulty.medium} (${byDifficulty.medium * 5} cases)`)
  console.log(`  Hard pairs: ${byDifficulty.hard} (${byDifficulty.hard * 5} cases)`)
}

main().catch((error) => {
  console.error('[GenerateComprehensiveDataset] Failed:', error)
  process.exit(1)
})
