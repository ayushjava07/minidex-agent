import { afterEach, describe, expect, it } from 'vitest'
import { startServer } from '../../backend/server.js'

let server

afterEach(async () => {
  if (server) {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
    server = undefined
  }
})

describe('application server', () => {
  it('starts without a configured Filecoin provider', async () => {
    server = await startServer({ host: '127.0.0.1', port: 0, noStatic: true })
    const { port } = server.address()

    const response = await fetch(`http://127.0.0.1:${port}/api/v1/filecoin/status`)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.storacha.enabled).toBe(false)
    expect(body.lotus.enabled).toBe(false)
  })

  it('reports unavailable storage instead of preventing startup', async () => {
    server = await startServer({ host: '127.0.0.1', port: 0, noStatic: true })
    const { port } = server.address()

    const response = await fetch(`http://127.0.0.1:${port}/api/filecoin/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: { message: 'test' } })
    })

    expect(response.status).toBe(503)
    expect(await response.json()).toMatchObject({ success: false })
  })
})
