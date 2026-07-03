export async function seed(supabaseUrl: string, supabaseKey: string) {
  try {
    const { createClient } = await import('@supabase/supabase-js')
    const supabase = createClient(supabaseUrl, supabaseKey)

    const seedSql = `
      INSERT INTO profiles (id, email, name, usage_count, subscription_status, created_at)
      VALUES ('seed-demo', 'demo@quikquiz.app', 'Demo Teacher', 0, 'inactive', NOW())
      ON CONFLICT (id) DO NOTHING;
    `
    const { error: err } = await supabase.rpc('exec_sql', { sql: seedSql })
    if (err) {
      console.warn('Seed via RPC failed (may not have exec_sql function). Trying direct insert...')
      const { error: insertErr } = await supabase
        .from('profiles')
        .upsert({ id: 'seed-demo', email: 'demo@quikquiz.app', name: 'Demo Teacher', usage_count: 0, subscription_status: 'inactive' }, { onConflict: 'id' })
      if (insertErr) throw insertErr
    }
    console.log('Seed data inserted successfully.')
  } catch (err) {
    throw new Error(`Seed failed: ${(err as Error).message}`)
  }
}
