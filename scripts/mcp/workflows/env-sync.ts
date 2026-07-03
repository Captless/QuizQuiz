import { readFileSync } from 'fs'
import { resolve } from 'path'
import { info, success, error } from '../utils/logger'
import { handleEnvBatch } from '../render/index'
import { loadConfig } from '../utils/config'
import { confirmAction } from '../utils/prompt'

interface EnvSyncOptions {
  dryRun: boolean
  yes: boolean
  file: string
}

export async function envSync(opts: EnvSyncOptions) {
  const cfg = loadConfig()
  const fullPath = resolve(process.cwd(), opts.file)

  info(`Syncing environment variables from ${fullPath} to Render...`)

  // Parse and validate
  let vars: Record<string, string>
  try {
    if (fullPath.endsWith('.json')) {
      vars = JSON.parse(readFileSync(fullPath, 'utf-8'))
    } else {
      // Parse .env format
      const content = readFileSync(fullPath, 'utf-8')
      vars = {}
      for (const line of content.split('\n')) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) continue
        const eqIdx = trimmed.indexOf('=')
        if (eqIdx === -1) continue
        const key = trimmed.slice(0, eqIdx).trim()
        let value = trimmed.slice(eqIdx + 1).trim()
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1)
        }
        if (key) vars[key] = value
      }
    }
  } catch (err: any) {
    error(`Failed to parse env file: ${err.message}`)
    process.exit(1)
  }

  info(`Found ${Object.keys(vars).length} variables to sync.`)
  if (opts.dryRun) {
    info('DRY RUN: Would sync the following variables:')
    for (const [key, val] of Object.entries(vars)) {
      info(`  ${key}=${'*'.repeat(val.length)}`)
    }
    return
  }

  const ok = await confirmAction(
    `Sync ${Object.keys(vars).length} env vars from ${opts.file} to Render?`,
    opts.yes
  )
  if (!ok) { info('Sync cancelled.'); return }

  const renderOpts = {
    dryRun: false,
    yes: true,
    renderApiToken: cfg.renderApiToken,
    renderServiceId: cfg.renderServiceId,
  }

  await handleEnvBatch(renderOpts, fullPath)
  success('Environment variables synced to Render.')
}
