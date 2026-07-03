export async function resetUsage(supabaseUrl: string, supabaseKey: string, userId: string) {
  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { error } = await supabase
    .from('profiles')
    .update({ usage_count: 0 })
    .eq('id', userId)

  if (error) throw new Error(`Failed to reset usage for ${userId}: ${error.message}`)
  console.log(`Usage reset to 0 for user ${userId}`)
}

export async function setUsage(supabaseUrl: string, supabaseKey: string, userId: string, count: number) {
  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { error } = await supabase
    .from('profiles')
    .upsert({ id: userId, usage_count: count }, { onConflict: 'id' })

  if (error) throw new Error(`Failed to set usage for ${userId}: ${error.message}`)
  console.log(`Usage set to ${count} for user ${userId}`)
}

export async function getUsageForUser(supabaseUrl: string, supabaseKey: string, userId: string) {
  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, name, usage_count, subscription_status, created_at')
    .eq('id', userId)
    .maybeSingle()

  if (error) throw new Error(`Failed to get usage for ${userId}: ${error.message}`)

  if (!data) {
    console.log(`No profile found for user ${userId}`)
    return
  }

  console.log('')
  console.log('=== User Profile ===')
  console.log(`  ID:                  ${data.id}`)
  console.log(`  Email:               ${data.email || '(not set)'}`)
  console.log(`  Name:                ${data.name || '(not set)'}`)
  console.log(`  Usage Count:         ${data.usage_count}`)
  console.log(`  Subscription Status: ${data.subscription_status}`)
  console.log(`  Created At:          ${data.created_at}`)
  console.log('')
}
