/**
 * Release script for Windows.
 *
 * Flow aligned with electron-updater auto-update:
 *   1. Build the app (produces setup .exe, latest.yml in dist/)
 *   2. Upload auto-update artifacts (all files referenced in latest.yml)
 *   3. Upload latest.yml (uploaded LAST so clients never see a yaml
 *      pointing to files that haven't been uploaded yet)
 *   4. Invalidate CloudFront cache for latest.yml only
 *      (versioned artifact file names are unique per release — no stale cache)
 */

import 'dotenv/config'

import fs from 'node:fs/promises'
import path from 'node:path'

import {
  type ReleaseConfig,
  env,
  modeEnv,
  requireModeEnv,
  parseMode,
  getProjectRoot,
  run,
  parseYmlFileUrls,
  uploadFileToS3,
  invalidateCloudFront
} from './release-utils'

// ─── Windows-specific config ────────────────────────────────────────────────

function loadConfig(mode: string): ReleaseConfig {
  const s3Bucket = requireModeEnv(mode, 'S3_BUCKET')
  const s3UpdatePrefix = modeEnv(mode, 'S3_UPDATE_PREFIX') ?? mode
  const cloudFrontDistributionId = requireModeEnv(mode, 'CLOUDFRONT_DISTRIBUTION_ID')
  const region = env('AWS_REGION') ?? env('AWS_DEFAULT_REGION') ?? 'us-east-1'
  const s3Acl = modeEnv(mode, 'S3_ACL')

  return { s3Bucket, s3UpdatePrefix, cloudFrontDistributionId, region, s3Acl }
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const mode = parseMode(process.argv.slice(2))
  process.env.APP_MODE = mode

  const cfg = loadConfig(mode)
  const root = getProjectRoot()
  const distDir = path.join(root, 'dist')
  const updatePrefix = cfg.s3UpdatePrefix.replace(/^\/+/, '').replace(/\/+$/, '')

  console.log(`Release (windows) — mode: ${mode}`)
  console.log(`  S3 bucket:     ${cfg.s3Bucket}`)
  console.log(`  Update prefix: ${updatePrefix}`)
  console.log(`  CloudFront:    ${cfg.cloudFrontDistributionId}`)
  console.log(`  Region:        ${cfg.region}`)

  // ── Step 1: Build ─────────────────────────────────────────────────────────
  console.log('\n[1/4] Building windows installer...')
  await run('npm', ['run', `build:${mode}:win`], root, { shell: true })

  // ── Step 2: Upload auto-update artifacts ──────────────────────────────────
  const ymlPath = path.join(distDir, 'latest.yml')
  try {
    await fs.stat(ymlPath)
  } catch {
    throw new Error('latest.yml not found in dist/ — build may have failed')
  }

  const fileUrls = await parseYmlFileUrls(ymlPath)
  console.log(`\n[2/4] Uploading ${fileUrls.length} auto-update artifact(s)...`)

  for (const fileName of fileUrls) {
    const filePath = path.join(distDir, fileName)
    try {
      await fs.stat(filePath)
    } catch {
      console.warn(`  [!] ${fileName} not found in dist/, skipping`)
      continue
    }
    await uploadFileToS3(
      filePath,
      cfg.s3Bucket,
      `${updatePrefix}/${fileName}`,
      cfg.region,
      cfg.s3Acl
    )
  }

  // ── Step 3: Upload latest.yml ─────────────────────────────────────────────
  // Uploaded AFTER artifacts so clients never see a yaml pointing to missing files.
  console.log('\n[3/4] Uploading latest.yml...')
  const ymlKey = `${updatePrefix}/latest.yml`
  await uploadFileToS3(ymlPath, cfg.s3Bucket, ymlKey, cfg.region, cfg.s3Acl)

  // ── Step 4: Invalidate CloudFront for latest.yml ──────────────────────────
  // Invalidation uses the CloudFront URL path (without S3 origin path).
  // The client fetches /{mode}/latest.yml, so that's what we invalidate.
  console.log('\n[4/4] Invalidating CloudFront cache for latest.yml...')
  const invalidationId = await invalidateCloudFront(
    cfg.cloudFrontDistributionId,
    [`/${mode}/latest.yml`],
    cfg.region
  )
  console.log(`  Invalidation ID: ${invalidationId}`)

  console.log('\nDone.')
}

main().catch((err) => {
  console.error('\nRelease failed:')
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
