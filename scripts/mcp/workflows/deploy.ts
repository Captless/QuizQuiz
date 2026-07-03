import { info, success, error } from '../utils/logger'
import { handleMigrate, handleSeed } from '../supabase/index'
import { handleEnvBatch, handleDeploy } from '../render/index'
import { loadConfig } from '../utils/config'

interface DeployOptions {
  dryRun: boolean
  yes: boolean
  target: 'production' | 'staging' | 'preview'
  seed?: boolean
  wait?: boolean
}

export async function fullDeploy(opts: DeployOptions) {
  const cfg = loadConfig()

  info(`Starting full deployment to ${opts.target}...`)

  const supabaseOpts = {
    dryRun: opts.dryRun,
    yes: opts.yes,
    supabaseUrl: cfg.supabaseUrl,
    supabaseKey: cfg.supabaseServiceRoleKey,
  }

  const renderOpts = {
    dryRun: opts.dryRun,
    yes: opts.yes,
    renderApiToken: cfg.renderApiToken,
    renderServiceId: cfg.renderServiceId,
  }

  // Step 1: Database migration
  info('Step 1/3: Running database migration...')
  try {
    await handleMigrate(supabaseOpts, false)
  } catch (err: any) {
    error('Migration failed — aborting deploy.', { error: err.message })
    process.exit(1)
  }

  // Step 2: Seed (optional)
  if (opts.seed) {
    info('Step 2/3: Seeding database...')
    try {
      await handleSeed(supabaseOpts)
    } catch (err: any) {
      error('Seed failed — continuing without seed.', { error: err.message })
    }
  }

  // Step 3: Trigger Render deploy
  info(opts.seed ? 'Step 3/3:' : 'Step 2/2:')
  info('Triggering Render deployment...')
  try {
    await handleDeploy(renderOpts, opts.wait)
  } catch (err: any) {
    error('Render deploy failed.', { error: err.message })
    process.exit(1)
  }

  success(`Full deployment to ${opts.target} complete!`)
}
