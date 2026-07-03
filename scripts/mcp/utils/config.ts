import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.join(__dirname, '..', '..', '..', '.env') })

export interface McpConfig {
  supabaseUrl: string
  supabaseServiceRoleKey: string
  renderApiToken: string
  renderServiceId: string
}

const required = [
  ['SUPABASE_URL', 'Supabase project URL'],
  ['SUPABASE_SERVICE_ROLE_KEY', 'Supabase service role key'],
  ['RENDER_API_TOKEN', 'Render API token'],
  ['RENDER_SERVICE_ID', 'Render service ID'],
] as const

export function loadConfig(): McpConfig {
  const missing: string[] = []
  for (const [key, label] of required) {
    if (!process.env[key]) missing.push(`${key} (${label})`)
  }
  if (missing.length > 0) {
    const msg = `Missing required environment variables:\n${missing.map(m => `  - ${m}`).join('\n')}\n\nSet them in your .env file or export them before running MCP.`
    throw new Error(msg)
  }
  return {
    supabaseUrl: process.env.SUPABASE_URL!,
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
    renderApiToken: process.env.RENDER_API_TOKEN!,
    renderServiceId: process.env.RENDER_SERVICE_ID!,
  }
}
