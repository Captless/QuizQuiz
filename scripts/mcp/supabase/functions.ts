import { readFileSync } from 'fs'
import { resolve } from 'path'

export async function deployFunctions(filePath: string, supabaseUrl: string, supabaseKey: string) {
  const fullPath = resolve(process.cwd(), filePath)
  try {
    const { createClient } = await import('@supabase/supabase-js')
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const code = readFileSync(fullPath, 'utf-8')
    const functionName = filePath.split(/[\\/]/).pop()?.replace(/\.(ts|js)$/, '') || 'unnamed'

    const { error } = await supabase.functions.invoke(functionName, { body: code })
    if (error) throw error
    console.log(`Function "${functionName}" deployed from ${fullPath}`)
  } catch (err) {
    throw new Error(`Function deployment failed: ${(err as Error).message}`)
  }
}
