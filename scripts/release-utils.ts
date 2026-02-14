/**
 * Shared utilities for release scripts.
 *
 * Provides: environment helpers, CLI arg parsing, S3 upload,
 * CloudFront invalidation, and latest-*.yml parsing.
 */

import { createReadStream } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { CloudFrontClient, CreateInvalidationCommand } from '@aws-sdk/client-cloudfront'

// ─── Types ──────────────────────────────────────────────────────────────────

export type ReleaseConfig = {
  s3Bucket: string
  /** S3 prefix for auto-update files — maps to the mode's updateUrl */
  s3UpdatePrefix: string
  cloudFrontDistributionId: string
  region: string
  s3Acl?: string
}

// ─── Project root ───────────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export function getProjectRoot(): string {
  return path.resolve(__dirname, '..')
}

// ─── Environment helpers ────────────────────────────────────────────────────

export function env(name: string): string | undefined {
  const v = process.env[name]
  return v && v.trim().length > 0 ? v.trim() : undefined
}

/**
 * Look up an env var with mode-specific prefix first, then fall back to MEMU_ prefix.
 * e.g. for mode "yumi" and baseName "S3_BUCKET":
 *   1. YUMI_S3_BUCKET
 *   2. MEMU_S3_BUCKET (legacy fallback)
 */
export function modeEnv(mode: string, baseName: string): string | undefined {
  const prefix = mode.toUpperCase()
  return env(`${prefix}_${baseName}`) ?? (prefix !== 'MEMU' ? env(`MEMU_${baseName}`) : undefined)
}

export function requireModeEnv(mode: string, baseName: string): string {
  const v = modeEnv(mode, baseName)
  if (!v) {
    const prefix = mode.toUpperCase()
    throw new Error(`Missing required env: ${prefix}_${baseName}`)
  }
  return v
}

// ─── CLI arg parsing ────────────────────────────────────────────────────────

export function parseMode(argv: string[]): string {
  const modeIdx = argv.indexOf('--mode')
  return modeIdx !== -1 && argv[modeIdx + 1] ? argv[modeIdx + 1] : process.env.APP_MODE || 'memu'
}

// ─── Child process ──────────────────────────────────────────────────────────

export async function run(
  command: string,
  args: string[],
  cwd: string,
  options?: { shell?: boolean }
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: 'inherit',
      shell: options?.shell ?? false,
      env: process.env
    })
    child.on('error', reject)
    child.on('exit', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`Command failed: ${command} ${args.join(' ')} (exit ${code})`))
    })
  })
}

// ─── YAML parsing ───────────────────────────────────────────────────────────

/**
 * Parse a latest-mac.yml / latest.yml and extract the `url` values
 * listed under `files:`. These are the artifact file names that
 * electron-updater will download relative to the publish URL.
 */
export async function parseYmlFileUrls(ymlPath: string): Promise<string[]> {
  const content = await fs.readFile(ymlPath, 'utf-8')
  const urls: string[] = []
  for (const line of content.split('\n')) {
    // Match lines like "  - url: Yumi-1.0.1-arm64-mac.zip"
    const match = line.match(/^\s+-?\s*url:\s*(.+)$/)
    if (match) {
      urls.push(match[1].trim())
    }
  }
  return urls
}

// ─── S3 upload ──────────────────────────────────────────────────────────────

const CONTENT_TYPES: Record<string, string> = {
  '.dmg': 'application/x-apple-diskimage',
  '.zip': 'application/zip',
  '.exe': 'application/x-msdownload',
  '.yml': 'text/yaml',
  '.yaml': 'text/yaml',
  '.blockmap': 'application/octet-stream'
}

function guessContentType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase()
  return CONTENT_TYPES[ext] ?? 'application/octet-stream'
}

export async function uploadFileToS3(
  filePath: string,
  bucket: string,
  key: string,
  region: string,
  acl?: string
): Promise<void> {
  const client = new S3Client({ region })
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: createReadStream(filePath),
      ContentType: guessContentType(filePath),
      ACL: acl as any
    })
  )
  console.log(`  -> s3://${bucket}/${key}`)
}

// ─── CloudFront invalidation ────────────────────────────────────────────────

export async function invalidateCloudFront(
  distributionId: string,
  paths: string[],
  region: string
): Promise<string> {
  const client = new CloudFrontClient({ region })
  const uniquePaths = [...new Set(paths)]

  const res = await client.send(
    new CreateInvalidationCommand({
      DistributionId: distributionId,
      InvalidationBatch: {
        CallerReference: `${Date.now()}`,
        Paths: {
          Quantity: uniquePaths.length,
          Items: uniquePaths
        }
      }
    })
  )

  return res.Invalidation?.Id ?? 'unknown'
}
