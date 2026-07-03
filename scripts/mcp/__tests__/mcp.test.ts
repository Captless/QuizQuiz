import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { execSync } from 'child_process'

const CLI = 'npx tsx scripts/mcp/index.ts'

describe('MCP CLI', () => {
  it('shows help without error', () => {
    const out = execSync(`${CLI} --help`, { encoding: 'utf-8' })
    expect(out).toContain('Usage:')
    expect(out).toContain('supabase')
    expect(out).toContain('render')
    expect(out).toContain('deploy')
    expect(out).toContain('reset-dev')
    expect(out).toContain('env-sync')
  })

  it('shows supabase subcommands', () => {
    const out = execSync(`${CLI} supabase --help`, { encoding: 'utf-8' })
    expect(out).toContain('migrate')
    expect(out).toContain('seed')
    expect(out).toContain('func')
    expect(out).toContain('secret')
  })

  it('shows render subcommands', () => {
    const out = execSync(`${CLI} render --help`, { encoding: 'utf-8' })
    expect(out).toContain('env:set')
    expect(out).toContain('deploy')
    expect(out).toContain('service:get')
    expect(out).toContain('service:scale')
    expect(out).toContain('domain:set')
  })

  it('dry-run deploy exits with proper error when env vars missing', () => {
    try {
      execSync(`${CLI} deploy --dry-run`, { encoding: 'utf-8' })
    } catch (err: any) {
      const output = (err.stdout || err.stderr || err.message).toString()
      expect(output).toContain('RENDER_API_TOKEN')
      return
    }
    expect.unreachable('Should have thrown')
  })

  it('version flag works', () => {
    const out = execSync(`${CLI} --version`, { encoding: 'utf-8' })
    expect(out).toContain('1.0.0')
  })
})

describe('Config loader', () => {
  const OLD_ENV = { ...process.env }

  afterAll(() => {
    process.env = OLD_ENV
  })

  it('throws on missing env vars', () => {
    delete process.env.SUPABASE_URL
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    delete process.env.RENDER_API_TOKEN
    delete process.env.RENDER_SERVICE_ID

    expect(() => {
      const { loadConfig } = require('../utils/config')
      loadConfig()
    }).toThrow()
  })
})
