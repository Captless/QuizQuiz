import axios from 'axios'

const RENDER_API = 'https://api.render.com/v1'

function client(token: string) {
  return axios.create({
    baseURL: RENDER_API,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  })
}

interface ServiceDetails {
  service: {
    id: string
    name: string
    url: string
    type: string
    plan: string
    region: string
    autoDeploy: string
    healthCheckPath: string
    numInstances: number
    createdAt: string
    updatedAt: string
  }
  suspender: null | { reason: string }
}

export async function getService(token: string, serviceId: string) {
  const api = client(token)
  try {
    const { data } = await api.get<ServiceDetails>(`/services/${serviceId}`)
    const s = data.service
    console.log('')
    console.log('=== Render Service Details ===')
    console.log(`  Name:           ${s.name}`)
    console.log(`  ID:             ${s.id}`)
    console.log(`  URL:            ${s.url}`)
    console.log(`  Type:           ${s.type}`)
    console.log(`  Plan:           ${s.plan}`)
    console.log(`  Region:         ${s.region}`)
    console.log(`  Instances:      ${s.numInstances}`)
    console.log(`  Auto Deploy:    ${s.autoDeploy}`)
    console.log(`  Health Check:   ${s.healthCheckPath || '(none)'}`)
    console.log(`  Created:        ${s.createdAt}`)
    console.log(`  Updated:        ${s.updatedAt}`)
    if (data.suspender) console.log(`  Suspended:      ${data.suspender.reason}`)
    console.log('')
    return data
  } catch (err: any) {
    throw new Error(`Failed to fetch service: ${err.response?.data?.message || err.message}`)
  }
}

export async function scaleService(token: string, serviceId: string, plan: string) {
  const api = client(token)
  try {
    const { data } = await api.patch(`/services/${serviceId}`, { plan })
    console.log(`Service scaled to plan "${plan}".`)
    return data
  } catch (err: any) {
    throw new Error(`Failed to scale service: ${err.response?.data?.message || err.message}`)
  }
}

export async function setDomain(token: string, serviceId: string, hostname: string) {
  const api = client(token)
  try {
    const { data } = await api.post(`/services/${serviceId}/custom-domains`, { hostname })
    console.log(`Custom domain "${hostname}" added.`)
    return data
  } catch (err: any) {
    throw new Error(`Failed to set domain: ${err.response?.data?.message || err.message}`)
  }
}
