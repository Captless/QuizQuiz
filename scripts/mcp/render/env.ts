import axios from 'axios'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const RENDER_API = 'https://api.render.com/v1'

function client(token: string) {
  return axios.create({
    baseURL: RENDER_API,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  })
}

export async function setEnvVars(token: string, serviceId: string, vars: Record<string, string>) {
  const api = client(token)
  const entries = Object.entries(vars).map(([key, value]) => ({
    key,
    value,
    isSecret: key.toLowerCase().includes('key') || key.toLowerCase().includes('secret') || key.toLowerCase().includes('token'),
  }))
  const { data } = await api.patch(`/services/${serviceId}/env-vars`, { envVars: entries })
  console.log(`Set ${entries.length} env var(s) on service ${serviceId}`)
  return data
}

export async function unsetEnvVars(token: string, serviceId: string, names: string[]) {
  const api = client(token)
  const { data: current } = await api.get(`/services/${serviceId}/env-vars`)
  const remaining = (current.envVars || []).filter(
    (v: { key: string }) => !names.includes(v.key)
  )
  const { data } = await api.patch(`/services/${serviceId}/env-vars`, { envVars: remaining })
  console.log(`Removed ${names.length} env var(s) from service ${serviceId}`)
  return data
}

export async function batchEnvVars(token: string, serviceId: string, filePath: string) {
  const fullPath = resolve(process.cwd(), filePath)
  const content = readFileSync(fullPath, 'utf-8')
  const vars: Record<string, string> = JSON.parse(content)
  return setEnvVars(token, serviceId, vars)
}
