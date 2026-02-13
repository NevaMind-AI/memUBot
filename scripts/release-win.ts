import 'dotenv/config'

import { createReadStream } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { CloudFrontClient, CreateInvalidationCommand } from '@aws-sdk/client-cloudfront'

type ReleaseConfig = {
  exeName: string
  s3Bucket: string
  s3Prefix: string
  cloudFrontDistributionId: string
  invalidationPath?: string
  region: string
  s3Acl?: string
}

function getProjectRoot(): string {
  const __filename = fileURLToPath(import.meta.url)
  const __dirname = path.dirname(__filename)
  return path.resolve(__dirname, '..')
}

function env(name: string): string | undefined {
  const v = process.env[name]
  return v && v.trim().length > 0 ? v.trim() : undefined
}

function requireEnv(name: string): string {
  const v = env(name)
  if (!v) throw new Error(`Missing required env: ${name}`)
  return v
}

function parseArgs(argv: string[]): { force: boolean; skipBuild: boolean; mode: string } {
  const force = argv.includes('--force')
  const skipBuild = argv.includes('--skip-build')
  const modeIdx = argv.indexOf('--mode')
  const mode = modeIdx !== -1 && argv[modeIdx + 1] ? argv[modeIdx + 1] : process.env.APP_MODE || 'memu'
  return { force, skipBuild, mode }
}

function loadConfig(): ReleaseConfig {
  const exeName = env('MEMU_RELEASE_EXE_NAME') ?? 'memUbot.exe'
  const s3Bucket = requireEnv('MEMU_S3_BUCKET')
  const s3Prefix = env('MEMU_S3_PREFIX') ?? 'downloads'
  const cloudFrontDistributionId = requireEnv('MEMU_CLOUDFRONT_DISTRIBUTION_ID')
  const invalidationPath = env('MEMU_CLOUDFRONT_INVALIDATION_PATH_WIN')
  const region = env('AWS_REGION') ?? env('AWS_DEFAULT_REGION') ?? 'us-east-1'
  const s3Acl = env('MEMU_S3_ACL')

  return {
    exeName,
    s3Bucket,
    s3Prefix,
    cloudFrontDistributionId,
    invalidationPath,
    region,
    s3Acl
  }
}

async function run(command: string, args: string[], cwd: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: 'inherit',
      shell: true,
      env: process.env
    })
    child.on('error', reject)
    child.on('exit', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`Command failed: ${command} ${args.join(' ')} (exit ${code})`))
    })
  })
}

async function walk(dir: string): Promise<string[]> {
  const out: string[] = []
  const entries = await fs.readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    const p = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...(await walk(p)))
    else out.push(p)
  }
  return out
}

async function findLatestSetupExe(distDir: string): Promise<string> {
  const files = await walk(distDir)
  const exeFiles = files.filter(
    (f) => f.toLowerCase().endsWith('.exe') && f.toLowerCase().includes('setup')
  )
  if (exeFiles.length === 0) throw new Error(`No setup EXE found under ${distDir}`)

  let best = exeFiles[0]
  let bestMtime = (await fs.stat(best)).mtimeMs
  for (const f of exeFiles.slice(1)) {
    const m = (await fs.stat(f)).mtimeMs
    if (m > bestMtime) {
      best = f
      bestMtime = m
    }
  }
  return best
}

async function renameExe(distDir: string, exeName: string, force: boolean): Promise<string> {
  const source = await findLatestSetupExe(distDir)
  const target = path.join(distDir, exeName)

  if (path.resolve(source) === path.resolve(target)) {
    return target
  }

  // Prevent accidental overwrite unless --force
  try {
    await fs.stat(target)
    if (!force) {
      throw new Error(`Target already exists: ${target} (use --force to overwrite)`)
    }
    await fs.rm(target, { force: true })
  } catch {
    // Target does not exist
  }

  await fs.rename(source, target)
  return target
}

async function uploadToS3(
  filePath: string,
  cfg: ReleaseConfig
): Promise<{ bucket: string; key: string }> {
  const client = new S3Client({ region: cfg.region })
  const prefix = cfg.s3Prefix.replace(/^\/+/, '').replace(/\/+$/, '')
  const key = `${prefix}/${cfg.exeName}`

  const put = new PutObjectCommand({
    Bucket: cfg.s3Bucket,
    Key: key,
    Body: createReadStream(filePath),
    ContentType: 'application/x-msdownload',
    ACL: cfg.s3Acl as any
  })

  await client.send(put)
  return { bucket: cfg.s3Bucket, key }
}

async function invalidateCloudFront(cfg: ReleaseConfig, s3Key: string): Promise<string> {
  const client = new CloudFrontClient({ region: cfg.region })
  const pathFromKey = `/${s3Key}`
  const invalidationPath = cfg.invalidationPath ?? pathFromKey

  const cmd = new CreateInvalidationCommand({
    DistributionId: cfg.cloudFrontDistributionId,
    InvalidationBatch: {
      CallerReference: `${Date.now()}`,
      Paths: {
        Quantity: 1,
        Items: [invalidationPath]
      }
    }
  })

  const res = await client.send(cmd)
  return res.Invalidation?.Id ?? 'unknown'
}

async function main(): Promise<void> {
  const { force, skipBuild, mode } = parseArgs(process.argv.slice(2))
  // Ensure APP_MODE is set for child processes
  process.env.APP_MODE = mode
  const cfg = loadConfig()
  const root = getProjectRoot()
  const distDir = path.join(root, 'dist')

  console.log('memU bot release (windows)')
  console.log(`- Mode: ${mode}`)
  console.log(`- S3 bucket: ${cfg.s3Bucket}`)
  console.log(`- S3 prefix: ${cfg.s3Prefix}`)
  console.log(`- CloudFront distribution: ${cfg.cloudFrontDistributionId}`)
  console.log(`- EXE name: ${cfg.exeName}`)
  console.log(`- Region: ${cfg.region}`)

  if (!skipBuild) {
    console.log('\n[1/4] Building windows installer...')
    await run('npm', ['run', 'build:win'], root)
  } else {
    console.log('\n[1/4] Skipping build (--skip-build)')
  }

  console.log('\n[2/4] Renaming exe...')
  await fs.mkdir(distDir, { recursive: true })
  const finalExePath = await renameExe(distDir, cfg.exeName, force)
  console.log(`- EXE: ${finalExePath}`)

  console.log('\n[3/4] Uploading to S3...')
  const { key } = await uploadToS3(finalExePath, cfg)
  console.log(`- s3://${cfg.s3Bucket}/${key}`)

  console.log('\n[4/4] Invalidating CloudFront...')
  const invalidationId = await invalidateCloudFront(cfg, key)
  console.log(`- Invalidation: ${invalidationId}`)

  console.log('\nDone.')
}

main().catch((err) => {
  console.error('\nRelease failed:')
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
