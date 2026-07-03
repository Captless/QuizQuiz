import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import os from 'os'

const testDir = path.join(os.tmpdir(), 'quikquiz-usage-test-' + Date.now())

let mod

beforeAll(() => {
  // Ensure clean environment before loading the module
  try { fs.rmSync(testDir, { recursive: true, force: true }) } catch {}
  fs.mkdirSync(testDir, { recursive: true })
  process.env.USAGE_STORE_DIR = testDir
  // Delete the module from cache so it picks up the new env var
  delete require.cache[require.resolve('./usageStore')]
  mod = require('./usageStore')
})

afterAll(() => {
  try { fs.rmSync(testDir, { recursive: true, force: true }) } catch {}
  delete process.env.USAGE_STORE_DIR
})

describe('usageStore fallback', () => {
  beforeEach(() => {
    // Clear data for each test
    try { fs.rmSync(path.join(testDir, 'usage.json'), { force: true }) } catch {}
  })

  it('returns zero for unknown user', async () => {
    const usage = await mod.getUsage('nonexistent')
    expect(usage).toEqual({ usageCount: 0, paid: false })
  })

  it('returns zero for null/empty userId', async () => {
    const usage1 = await mod.getUsage(null)
    expect(usage1).toEqual({ usageCount: 0, paid: false })
    const usage2 = await mod.getUsage('')
    expect(usage2).toEqual({ usageCount: 0, paid: false })
  })

  it('increments usage and persists', async () => {
    const count1 = await mod.incUsage('user-1')
    expect(count1).toBe(1)

    const usage = await mod.getUsage('user-1')
    expect(usage.usageCount).toBe(1)
    expect(usage.paid).toBe(false)
  })

  it('increments multiple times', async () => {
    await mod.incUsage('user-2')
    await mod.incUsage('user-2')
    await mod.incUsage('user-2')
    const usage = await mod.getUsage('user-2')
    expect(usage.usageCount).toBe(3)
  })

  it('tracks multiple users independently', async () => {
    await mod.incUsage('alice')
    await mod.incUsage('alice')
    await mod.incUsage('bob')

    const aliceUsage = await mod.getUsage('alice')
    expect(aliceUsage.usageCount).toBe(2)

    const bobUsage = await mod.getUsage('bob')
    expect(bobUsage.usageCount).toBe(1)
  })

  it('persists to disk and survives simulated restart', async () => {
    await mod.incUsage('persist-user')
    await mod.setPaid('persist-user', true)

    // Verify file exists with data
    const dataFile = path.join(testDir, 'usage.json')
    expect(fs.existsSync(dataFile)).toBe(true)
    const raw = fs.readFileSync(dataFile, 'utf-8')
    const data = JSON.parse(raw)
    expect(data['persist-user']).toEqual({ usageCount: 1, paid: true })

    // Simulate restart by clearing cache and re-loading
    delete require.cache[require.resolve('./usageStore')]
    const reloaded = require('./usageStore')
    const usage = await reloaded.getUsage('persist-user')
    expect(usage).toEqual({ usageCount: 1, paid: true })
  })

  it('setPaid only changes paid without affecting count', async () => {
    await mod.incUsage('paid-user')
    await mod.setPaid('paid-user', true)

    const usage = await mod.getUsage('paid-user')
    expect(usage.usageCount).toBe(1)
    expect(usage.paid).toBe(true)

    await mod.incUsage('paid-user')
    const usage2 = await mod.getUsage('paid-user')
    expect(usage2.usageCount).toBe(2)
    expect(usage2.paid).toBe(true)
  })

  it('handles corrupted JSON gracefully', async () => {
    const dataFile = path.join(testDir, 'usage.json')
    fs.writeFileSync(dataFile, 'not valid json', 'utf-8')

    const usage = await mod.getUsage('corrupt-user')
    expect(usage).toEqual({ usageCount: 0, paid: false })
  })
})
