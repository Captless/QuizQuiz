#!/usr/bin/env node

import { Command } from 'commander'
import { loadConfig } from './utils/config'
import { setJsonMode } from './utils/logger'
import {
  handleMigrate, handleSeed, handleFunctionUpload,
  handleSecretSet, handleSecretDelete,
} from './supabase/index'
import {
  handleEnvSet, handleEnvUnset, handleEnvBatch,
  handleDeploy, handleServiceGet, handleServiceScale, handleSetDomain,
} from './render/index'
import { fullDeploy } from './workflows/deploy'
import { resetDev } from './workflows/reset-dev'
import { envSync } from './workflows/env-sync'

const program = new Command()

program
  .name('mcp')
  .description('QuikQuiz Management Control Panel — manage Supabase & Render from the CLI')
  .version('1.0.0')
  .option('--dry-run', 'Print actions without executing them')
  .option('-y, --yes', 'Skip all confirmation prompts')
  .option('--json', 'Output logs in JSON format')
  .hook('preAction', (thisCommand) => {
    const opts = thisCommand.optsWithGlobals()
    if (opts.json) setJsonMode(true)
  })

/* ── Supabase ────────────────────────────────────────────── */

const supabase = program.command('supabase').description('Manage Supabase resources')

supabase
  .command('migrate')
  .option('--no-reset', 'Skip DB reset, only push new migrations')
  .description('Run database migrations (reset + push)')
  .action(async (opts) => {
    const globals = program.optsWithGlobals()
    const cfg = loadConfig()
    await handleMigrate({
      dryRun: globals.dryRun, yes: globals.yes,
      supabaseUrl: cfg.supabaseUrl, supabaseKey: cfg.supabaseServiceRoleKey,
    }, opts.noReset === false ? undefined : true)
  })

supabase
  .command('seed')
  .description('Seed the database with initial data')
  .action(async () => {
    const globals = program.optsWithGlobals()
    const cfg = loadConfig()
    await handleSeed({
      dryRun: globals.dryRun, yes: globals.yes,
      supabaseUrl: cfg.supabaseUrl, supabaseKey: cfg.supabaseServiceRoleKey,
    })
  })

supabase
  .command('func')
  .argument('<path>', 'Path to function file')
  .description('Deploy an Edge Function')
  .action(async (path) => {
    const globals = program.optsWithGlobals()
    const cfg = loadConfig()
    await handleFunctionUpload({
      dryRun: globals.dryRun, yes: globals.yes,
      supabaseUrl: cfg.supabaseUrl, supabaseKey: cfg.supabaseServiceRoleKey,
    }, path)
  })

supabase
  .command('secret')
  .description('Manage Supabase secrets')

supabase
  .command('secret:set')
  .argument('<key>', 'Secret key')
  .argument('<value>', 'Secret value')
  .description('Set a secret')
  .action(async (key, value) => {
    const globals = program.optsWithGlobals()
    const cfg = loadConfig()
    await handleSecretSet({
      dryRun: globals.dryRun, yes: globals.yes,
      supabaseUrl: cfg.supabaseUrl, supabaseKey: cfg.supabaseServiceRoleKey,
    }, key, value)
  })

supabase
  .command('secret:delete')
  .argument('<key>', 'Secret key to delete')
  .description('Delete a secret')
  .action(async (key) => {
    const globals = program.optsWithGlobals()
    const cfg = loadConfig()
    await handleSecretDelete({
      dryRun: globals.dryRun, yes: globals.yes,
      supabaseUrl: cfg.supabaseUrl, supabaseKey: cfg.supabaseServiceRoleKey,
    }, key)
  })

/* ── Render ──────────────────────────────────────────────── */

const render = program.command('render').description('Manage Render services')

render
  .command('env:set')
  .argument('<name>', 'Environment variable name')
  .argument('<value>', 'Environment variable value')
  .description('Set an environment variable')
  .action(async (name, value) => {
    const globals = program.optsWithGlobals()
    const cfg = loadConfig()
    await handleEnvSet({
      dryRun: globals.dryRun, yes: globals.yes,
      renderApiToken: cfg.renderApiToken, renderServiceId: cfg.renderServiceId,
    }, name, value)
  })

render
  .command('env:unset')
  .argument('<name>', 'Environment variable name')
  .description('Unset an environment variable')
  .action(async (name) => {
    const globals = program.optsWithGlobals()
    const cfg = loadConfig()
    await handleEnvUnset({
      dryRun: globals.dryRun, yes: globals.yes,
      renderApiToken: cfg.renderApiToken, renderServiceId: cfg.renderServiceId,
    }, name)
  })

render
  .command('env:batch')
  .argument('<file>', 'JSON or .env file path')
  .description('Batch set environment variables from a file')
  .action(async (file) => {
    const globals = program.optsWithGlobals()
    const cfg = loadConfig()
    await handleEnvBatch({
      dryRun: globals.dryRun, yes: globals.yes,
      renderApiToken: cfg.renderApiToken, renderServiceId: cfg.renderServiceId,
    }, file)
  })

render
  .command('deploy')
  .option('-w, --wait', 'Wait for deployment to complete')
  .description('Trigger a new deployment')
  .action(async (opts) => {
    const globals = program.optsWithGlobals()
    const cfg = loadConfig()
    await handleDeploy({
      dryRun: globals.dryRun, yes: globals.yes,
      renderApiToken: cfg.renderApiToken, renderServiceId: cfg.renderServiceId,
    }, opts.wait)
  })

render
  .command('service:get')
  .description('Get service details')
  .action(async () => {
    const globals = program.optsWithGlobals()
    const cfg = loadConfig()
    await handleServiceGet({
      dryRun: globals.dryRun, yes: globals.yes,
      renderApiToken: cfg.renderApiToken, renderServiceId: cfg.renderServiceId,
    })
  })

render
  .command('service:scale')
  .description('Scale the service (interactive plan selection)')
  .action(async () => {
    const globals = program.optsWithGlobals()
    const cfg = loadConfig()
    await handleServiceScale({
      dryRun: globals.dryRun, yes: globals.yes,
      renderApiToken: cfg.renderApiToken, renderServiceId: cfg.renderServiceId,
    })
  })

render
  .command('domain:set')
  .argument('<hostname>', 'Custom domain hostname')
  .description('Add a custom domain')
  .action(async (hostname) => {
    const globals = program.optsWithGlobals()
    const cfg = loadConfig()
    await handleSetDomain({
      dryRun: globals.dryRun, yes: globals.yes,
      renderApiToken: cfg.renderApiToken, renderServiceId: cfg.renderServiceId,
    }, hostname)
  })

/* ── Composite Workflows ─────────────────────────────────── */

program
  .command('deploy')
  .option('-t, --target <env>', 'Deployment target', 'production')
  .option('--seed', 'Also seed the database after migration')
  .option('-w, --wait', 'Wait for Render deploy to complete')
  .description('Full deployment: migrate DB + deploy to Render')
  .action(async (opts) => {
    const globals = program.optsWithGlobals()
    await fullDeploy({
      dryRun: globals.dryRun, yes: globals.yes,
      target: opts.target, seed: opts.seed, wait: opts.wait,
    })
  })

program
  .command('reset-dev')
  .description('⚠️  Reset the development database (erases all data)')
  .action(async () => {
    const globals = program.optsWithGlobals()
    await resetDev({ dryRun: globals.dryRun, yes: globals.yes })
  })

program
  .command('env-sync')
  .argument('[file]', 'Path to .env or JSON file', '.env')
  .description('Sync local environment variables to Render')
  .action(async (file) => {
    const globals = program.optsWithGlobals()
    await envSync({ dryRun: globals.dryRun, yes: globals.yes, file })
  })

program.parse(process.argv)
