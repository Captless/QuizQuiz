import { migrate } from './migrate'
import { seed } from './seed'
import { deployFunctions } from './functions'
import { setSecret, deleteSecret } from './secrets'
import { confirmAction } from '../utils/prompt'
import { success, error, info } from '../utils/logger'

export interface SupabaseOptions {
  dryRun: boolean
  yes: boolean
  supabaseUrl: string
  supabaseKey: string
}

export async function handleMigrate(opts: SupabaseOptions, noReset?: boolean) {
  info('Supabase: Starting database migration...')
  if (opts.dryRun) {
    info('DRY RUN: Would run: supabase db [reset --skip-seed &&] push')
    return
  }
  const ok = await confirmAction(
    'This will modify your Supabase database schema. Continue?',
    opts.yes
  )
  if (!ok) {
    info('Migration cancelled.')
    return
  }
  await migrate(noReset)
  success('Supabase migration complete.')
}

export async function handleSeed(opts: SupabaseOptions) {
  info('Supabase: Seeding database...')
  if (opts.dryRun) {
    info('DRY RUN: Would run seed script')
    return
  }
  const ok = await confirmAction('Seed the database?', opts.yes)
  if (!ok) {
    info('Seed cancelled.')
    return
  }
  await seed(opts.supabaseUrl, opts.supabaseKey)
  success('Supabase seed complete.')
}

export async function handleFunctionUpload(opts: SupabaseOptions, filePath: string) {
  info(`Supabase: Deploying function from ${filePath}...`)
  if (opts.dryRun) {
    info(`DRY RUN: Would deploy function ${filePath}`)
    return
  }
  await deployFunctions(filePath, opts.supabaseUrl, opts.supabaseKey)
  success(`Function ${filePath} deployed.`)
}

export async function handleSecretSet(opts: SupabaseOptions, key: string, value: string) {
  info(`Supabase: Setting secret ${key}...`)
  if (opts.dryRun) {
    info(`DRY RUN: Would set secret ${key}=${'*'.repeat(value.length)}`)
    return
  }
  await setSecret(key, value, opts.supabaseUrl, opts.supabaseKey)
  success(`Secret ${key} set.`)
}

export async function handleSecretDelete(opts: SupabaseOptions, key: string) {
  info(`Supabase: Deleting secret ${key}...`)
  if (opts.dryRun) {
    info(`DRY RUN: Would delete secret ${key}`)
    return
  }
  const ok = await confirmAction(`Delete secret "${key}"?`, opts.yes)
  if (!ok) {
    info('Delete cancelled.')
    return
  }
  await deleteSecret(key, opts.supabaseUrl, opts.supabaseKey)
  success(`Secret ${key} deleted.`)
}
