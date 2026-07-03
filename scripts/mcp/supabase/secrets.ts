export async function setSecret(key: string, value: string, supabaseUrl: string, supabaseKey: string) {
  try {
    const { createClient } = await import('@supabase/supabase-js')
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { error } = await supabase
      .from('secrets')
      .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' })
    if (error) throw error
    console.log(`Secret "${key}" set.`)
  } catch (err) {
    throw new Error(`Failed to set secret "${key}": ${(err as Error).message}`)
  }
}

export async function deleteSecret(key: string, supabaseUrl: string, supabaseKey: string) {
  try {
    const { createClient } = await import('@supabase/supabase-js')
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { error } = await supabase
      .from('secrets')
      .delete()
      .eq('key', key)
    if (error) throw error
    console.log(`Secret "${key}" deleted.`)
  } catch (err) {
    throw new Error(`Failed to delete secret "${key}": ${(err as Error).message}`)
  }
}
