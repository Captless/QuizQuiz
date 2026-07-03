import { execSync } from 'child_process'

export async function migrate(noReset?: boolean) {
  const cwd = process.cwd()
  try {
    if (!noReset) {
      console.log('Running: supabase db reset --skip-seed')
      execSync('npx supabase db reset --skip-seed', { cwd, stdio: 'inherit' })
    }
    console.log('Running: supabase db push')
    execSync('npx supabase db push', { cwd, stdio: 'inherit' })
  } catch (err) {
    throw new Error(`Migration failed: ${(err as Error).message}`)
  }
}
