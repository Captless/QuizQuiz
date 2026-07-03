import axios from 'axios'

const RENDER_API = 'https://api.render.com/v1'

function client(token: string) {
  return axios.create({
    baseURL: RENDER_API,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  })
}

export async function triggerDeploy(token: string, serviceId: string, wait?: boolean) {
  const api = client(token)
  const { data } = await api.post(`/services/${serviceId}/deploys`)
  const deployId = data.id
  console.log(`Deploy triggered: ${deployId}`)

  if (wait) {
    console.log('Waiting for deployment to complete...')
    let status = 'pending'
    while (status === 'pending' || status === 'building' || status === 'queued') {
      await new Promise(r => setTimeout(r, 5000))
      const { data: deploy } = await api.get(`/services/${serviceId}/deploys/${deployId}`)
      status = deploy.status
      console.log(`  Status: ${status}`)
    }
    if (status === 'completed') {
      console.log('Deployment completed successfully!')
    } else {
      console.warn(`Deployment finished with status: ${status}`)
    }
  }
  return data
}
