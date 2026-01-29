import 'dotenv/config'

import { createReadStream } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { CloudFrontClient, CreateInvalidationCommand } from '@aws-sdk/client-cloudfront'

type ReleaseConfig = {
  dmgName: string
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

function parseArgs(argv: string[]): { force: boolean; skipBuild: boolean } {
  const force = argv.includes('--force')
  const skipBuild = argv.includes('--skip-build')
  return { force, skipBuild }
}

function loadConfig(): ReleaseConfig {
  const dmgName = env('MEMU_RELEASE_DMG_NAME') ?? 'memUbot.dmg'
  const s3Bucket = requireEnv('MEMU_S3_BUCKET')
  const s3Prefix = env('MEMU_S3_PREFIX') ?? 'downloads'
  const cloudFrontDistributionId = requireEnv('MEMU_CLOUDFRONT_DISTRIBUTION_ID')
  const invalidationPath = env('MEMU_CLOUDFRONT_INVALIDATION_PATH')
  const region = env('AWS_REGION') ?? env('AWS_DEFAULT_REGION') ?? 'us-east-1'
  const s3Acl = env('MEMU_S3_ACL')

  return {
    dmgName,
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
    const child = spawn(command, args, { cwd, stdio: 'inherit', shell: false })
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

async function findLatestDmg(distDir: string): Promise<string> {
  const files = await walk(distDir)
  const dmgFiles = files.filter((f) => f.toLowerCase().endsWith('.dmg'))
  if (dmgFiles.length === 0) throw new Error(`No DMG found under ${distDir}`)

  let best = dmgFiles[0]
  let bestMtime = (await fs.stat(best)).mtimeMs
  for (const f of dmgFiles.slice(1)) {
    const m = (await fs.stat(f)).mtimeMs
    if (m > bestMtime) {
      best = f
      bestMtime = m
    }
  }
  return best
}

async function renameDmg(distDir: string, dmgName: string, force: boolean): Promise<string> {
  const source = await findLatestDmg(distDir)
  const target = path.join(distDir, dmgName)

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

async function uploadToS3(filePath: string, cfg: ReleaseConfig): Promise<{ bucket: string; key: string }> {
  const client = new S3Client({ region: cfg.region })
  const prefix = cfg.s3Prefix.replace(/^\/+/, '').replace(/\/+$/, '')
  const key = `${prefix}/${cfg.dmgName}`

  const put = new PutObjectCommand({
    Bucket: cfg.s3Bucket,
    Key: key,
    Body: createReadStream(filePath),
    ContentType: 'application/x-apple-diskimage',
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
  const { force, skipBuild } = parseArgs(process.argv.slice(2))
  const cfg = loadConfig()
  const root = getProjectRoot()
  const distDir = path.join(root, 'dist')

  console.log('memU bot release (mac)')
  console.log(`- S3 bucket: ${cfg.s3Bucket}`)
  console.log(`- S3 prefix: ${cfg.s3Prefix}`)
  console.log(`- CloudFront distribution: ${cfg.cloudFrontDistributionId}`)
  console.log(`- DMG name: ${cfg.dmgName}`)
  console.log(`- Region: ${cfg.region}`)

  if (!skipBuild) {
    console.log('\n[1/4] Building mac dmg...')
    await run('npm', ['run', 'build:mac'], root)
  } else {
    console.log('\n[1/4] Skipping build (--skip-build)')
  }

  console.log('\n[2/4] Renaming dmg...')
  await fs.mkdir(distDir, { recursive: true })
  const finalDmgPath = await renameDmg(distDir, cfg.dmgName, force)
  console.log(`- DMG: ${finalDmgPath}`)

  console.log('\n[3/4] Uploading to S3...')
  const { key } = await uploadToS3(finalDmgPath, cfg)
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

