import { supabase } from './supabase'

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession()
  const token = data?.session?.access_token
  return token ? { 'Authorization': `Bearer ${token}` } : {}
}

export async function generateQuiz(
  topic: string,
  difficulty: string,
  type: string,
  num: number,
  file?: File
): Promise<any[]> {
  let url = '/api/generate'
  let body: any
  const headers: Record<string, string> = { ...await authHeaders() }

  if (file) {
    const fd = new FormData()
    fd.append('file', file)
    fd.append('topic', topic)
    fd.append('difficulty', difficulty)
    fd.append('type', type)
    fd.append('num', String(num))
    url = '/api/generate-from-file'
    body = fd
  } else {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify({ topic, difficulty, type, num })
  }

  const res = await fetch(url, { method: 'POST', headers, body })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Failed to generate quiz')
  if (!data.questions?.length) throw new Error('No questions returned')
  return data.questions
}

export async function suggestTopics(subject: string, grade: string, topic?: string): Promise<string[]> {
  try {
    const res = await fetch('/api/suggest-topics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...await authHeaders() },
      body: JSON.stringify({ subject, grade, topic })
    })
    const data = await res.json()
    return data.topics || []
  } catch {
    return []
  }
}

export async function getConfig(): Promise<{ googleClientId: string; stripePublishableKey: string; stripePaymentLink: string }> {
  const res = await fetch('/api/config')
  return res.json()
}

export async function createCheckoutSession(): Promise<string> {
  const res = await fetch('/api/create-checkout-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...await authHeaders() }
  })
  if (!res.ok) throw new Error('Failed to create checkout session')
  const data = await res.json()
  return data.url
}

export async function checkPaymentStatus(sessionId: string): Promise<boolean> {
  const res = await fetch(`/api/status?session_id=${encodeURIComponent(sessionId)}`)
  const data = await res.json()
  return data.paid === true
}

export async function getUsage(): Promise<{ usageCount: number; paid: boolean }> {
  try {
    const res = await fetch('/api/usage', { headers: { ...await authHeaders() } })
    if (!res.ok) throw new Error('not authorized')
    return await res.json()
  } catch {
    return { usageCount: 0, paid: false }
  }
}

export async function incrementUsage(): Promise<number> {
  const res = await fetch('/api/usage/increment', { method: 'POST', headers: { ...await authHeaders() } })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Failed to increment usage')
  return data.usageCount
}
