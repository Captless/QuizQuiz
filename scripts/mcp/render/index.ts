import { setEnvVars, unsetEnvVars, batchEnvVars } from './env'
import { triggerDeploy } from './deploy'
import { getService, scaleService, setDomain } from './service'
import { confirmAction, selectOption } from '../utils/prompt'
import { success, error, info } from '../utils/logger'

export interface RenderOptions {
  dryRun: boolean
  yes: boolean
  renderApiToken: string
  renderServiceId: string
}

export async function handleEnvSet(opts: RenderOptions, name: string, value: string) {
  info(`Render: Setting env var ${name}...`)
  if (opts.dryRun) {
    info(`DRY RUN: Would set ${name}=${'*'.repeat(value.length)} on service ${opts.renderServiceId}`)
    return
  }
  const ok = await confirmAction(`Set env var "${name}" on Render?`, opts.yes)
  if (!ok) { info('Cancelled.'); return }
  await setEnvVars(opts.renderApiToken, opts.renderServiceId, { [name]: value })
  success(`Env var ${name} set on Render.`)
}

export async function handleEnvUnset(opts: RenderOptions, name: string) {
  info(`Render: Unsetting env var ${name}...`)
  if (opts.dryRun) {
    info(`DRY RUN: Would unset ${name} on service ${opts.renderServiceId}`)
    return
  }
  const ok = await confirmAction(`Unset env var "${name}" on Render?`, opts.yes)
  if (!ok) { info('Cancelled.'); return }
  await unsetEnvVars(opts.renderApiToken, opts.renderServiceId, [name])
  success(`Env var ${name} unset on Render.`)
}

export async function handleEnvBatch(opts: RenderOptions, filePath: string) {
  info(`Render: Batch updating env vars from ${filePath}...`)
  if (opts.dryRun) {
    info(`DRY RUN: Would batch update env vars from ${filePath}`)
    return
  }
  const ok = await confirmAction('Batch update environment variables on Render?', opts.yes)
  if (!ok) { info('Cancelled.'); return }
  await batchEnvVars(opts.renderApiToken, opts.renderServiceId, filePath)
  success('Batch env var update complete.')
}

export async function handleDeploy(opts: RenderOptions, wait?: boolean) {
  info('Render: Triggering deployment...')
  if (opts.dryRun) {
    info(`DRY RUN: Would trigger deploy for service ${opts.renderServiceId}`)
    return
  }
  const ok = await confirmAction('Trigger a new deployment on Render?', opts.yes)
  if (!ok) { info('Cancelled.'); return }
  await triggerDeploy(opts.renderApiToken, opts.renderServiceId, wait)
  success('Render deploy triggered.')
}

export async function handleServiceGet(opts: RenderOptions) {
  info('Render: Fetching service details...')
  if (opts.dryRun) {
    info(`DRY RUN: Would fetch service ${opts.renderServiceId}`)
    return
  }
  await getService(opts.renderApiToken, opts.renderServiceId)
}

export async function handleServiceScale(opts: RenderOptions) {
  info('Render: Selecting plan...')
  const plan = await selectOption('Select a plan:', ['starter', 'standard', 'pro', 'pro_plus', 'business', 'custom'])
  if (opts.dryRun) {
    info(`DRY RUN: Would scale to ${plan}`)
    return
  }
  const ok = await confirmAction(`Scale Render service to "${plan}" plan?`, opts.yes)
  if (!ok) { info('Cancelled.'); return }
  await scaleService(opts.renderApiToken, opts.renderServiceId, plan)
  success(`Render service scaled to ${plan}.`)
}

export async function handleSetDomain(opts: RenderOptions, hostname: string) {
  info(`Render: Setting custom domain ${hostname}...`)
  if (opts.dryRun) {
    info(`DRY RUN: Would set domain ${hostname} on service ${opts.renderServiceId}`)
    return
  }
  const ok = await confirmAction(`Set custom domain "${hostname}" on Render?`, opts.yes)
  if (!ok) { info('Cancelled.'); return }
  await setDomain(opts.renderApiToken, opts.renderServiceId, hostname)
  success(`Domain ${hostname} set on Render.`)
}
