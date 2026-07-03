import { info, warn, success, error } from '../utils/logger'
import { handleMigrate, handleSeed } from '../supabase/index'
import { loadConfig } from '../utils/config'
import { confirmAction } from '../utils/prompt'

interface ResetDevOptions {
  dryRun: boolean
  yes: boolean
}

export async function resetDev(opts: ResetDevOptions) {
  const cfg = loadConfig()

  warn('⚠️  THIS WILL ERASE ALL DATA IN YOUR DEVELOPMENT DATABASE  ⚠️')
  const ok = await confirmAction('Continue with reset?', opts.yes)
  if (!ok) {
    info('Reset cancelled.')
    return
  }

  const supabaseOpts = {
    dryRun: opts.dryRun,
    yes: true,
    supabaseUrl: cfg.supabaseUrl,
    supabaseKey: cfg.supabaseServiceRoleKey,
  }

  // Step 1: Reset DB
  info('Step 1/2: Resetting database schema...')
  try {
    await handleMigrate(supabaseOpts, false)
  } catch (err: any) {
    error('Migration failed during reset.', { error: err.message })
    process.exit(1)
  }

  // Step 2: Reseed
  info('Step 2/2: Re-seeding database...')
  try {
    await handleSeed(supabaseOpts)
  } catch (err: any) {
    error('Re-seed failed.', { error: err.message })
    process.exit(1)
  }

  success('Development database has been reset and re-seeded.')
}
