import fs from 'node:fs'
import path from 'node:path'
import { createLogger } from '../../agents/logger.js'

const logger = createLogger('upload-store')
const STORE_PATH = path.join(process.cwd(), 'backend', 'filecoin', 'uploads.json')
const EVENTS_PATH = path.join(process.cwd(), 'backend', 'filecoin', 'events.json')

function readStore(filePath) {
  if (!fs.existsSync(filePath)) return []
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'))
  } catch {
    return []
  }
}

function writeStore(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2))
}

export function addUpload(entry) {
  const records = readStore(STORE_PATH)
  records.push({
    ...entry,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString()
  })
  writeStore(STORE_PATH, records)
  return records[records.length - 1]
}

export function getUploads({ page = 1, limit = 20, sort = 'createdAt', order = 'desc', agent, status, search } = {}) {
  let records = readStore(STORE_PATH)

  if (agent) records = records.filter(r => r.sourceAgent === agent)
  if (status) records = records.filter(r => r.status === status)
  if (search) {
    const q = search.toLowerCase()
    records = records.filter(r => r.cid?.toLowerCase().includes(q) || r.sourceAgent?.toLowerCase().includes(q) || r.type?.toLowerCase().includes(q))
  }

  const total = records.length

  const sorted = [...records].sort((a, b) => {
    const aVal = a[sort] ?? ''
    const bVal = b[sort] ?? ''
    const cmp = typeof aVal === 'string' ? aVal.localeCompare(bVal) : aVal - bVal
    return order === 'asc' ? cmp : -cmp
  })

  const start = (page - 1) * limit
  const items = sorted.slice(start, start + limit)

  return { items, total, page, limit, totalPages: Math.ceil(total / limit) }
}

export function getUploadByCid(cid) {
  const records = readStore(STORE_PATH)
  return records.find(r => r.cid === cid) || null
}

export function getStats() {
  const records = readStore(STORE_PATH)
  const totalUploads = records.length
  const totalSize = records.reduce((sum, r) => sum + (r.size || 0), 0)
  const verified = records.filter(r => r.verified).length
  const failed = records.filter(r => r.status === 'failed').length
  const agents = [...new Set(records.map(r => r.sourceAgent).filter(Boolean))]

  const agentBreakdown = agents.map(agent => {
    const agentRecords = records.filter(r => r.sourceAgent === agent)
    return { agent, count: agentRecords.length, lastArchive: agentRecords[agentRecords.length - 1]?.createdAt || null }
  })

  const retrievals = records.filter(r => r.retrieved).length
  const retrievalSuccess = retrievals > 0 ? Math.round((records.filter(r => r.retrieved && r.status === 'success').length / retrievals) * 100) : 100

  return { totalUploads, totalSize, verified, failed, agents: agentBreakdown, retrievalSuccessRate: retrievalSuccess, totalRetrievals: retrievals }
}

export function getAnalytics({ days = 30 } = {}) {
  const records = readStore(STORE_PATH)
  const now = Date.now()
  const cutoff = now - days * 86400000

  const recent = records.filter(r => new Date(r.createdAt).getTime() >= cutoff)

  const byDay = {}
  const byAgent = {}
  let cumulativeSize = 0
  const growth = []
  let verifiedCount = 0
  let failedCount = 0

  for (const r of recent) {
    const day = r.createdAt?.slice(0, 10) || 'unknown'
    byDay[day] = (byDay[day] || 0) + 1

    const agent = r.sourceAgent || 'unknown'
    byAgent[agent] = (byAgent[agent] || 0) + 1

    cumulativeSize += r.size || 0
    growth.push({ date: r.createdAt, cumulativeSize })

    if (r.verified) verifiedCount++
    if (r.status === 'failed') failedCount++
  }

  const uploadActivity = Object.entries(byDay).map(([date, count]) => ({ date, count })).sort((a, b) => a.date.localeCompare(b.date))
  const agentContributions = Object.entries(byAgent).map(([agent, count]) => ({ agent, count }))
  const totalCheck = verifiedCount + failedCount
  const verificationRate = totalCheck > 0 ? Math.round((verifiedCount / totalCheck) * 100) : 100

  return { uploadActivity, agentContributions, storageGrowth: growth, verificationRate, verifiedCount, failedCount }
}

export function getReports({ page = 1, limit = 20 } = {}) {
  const records = readStore(STORE_PATH)
  const reports = records.filter(r => r.type === 'agent-report' || r.sourceAgent)
  const total = reports.length
  const start = (page - 1) * limit
  const items = reports.slice(start, start + limit)
  return { items, total, page, limit, totalPages: Math.ceil(total / limit) }
}

const sseClients = new Set()

export function addEvent(event) {
  const events = readStore(EVENTS_PATH)
  const entry = { ...event, id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, timestamp: new Date().toISOString() }
  events.push(entry)
  if (events.length > 1000) events.splice(0, events.length - 1000)
  writeStore(EVENTS_PATH, events)

  const payload = JSON.stringify(entry)
  for (const client of sseClients) {
    try { client.write(`data: ${payload}\n\n`) } catch { sseClients.delete(client) }
  }
  return entry
}

export function getRecentEvents({ limit = 50 } = {}) {
  const events = readStore(EVENTS_PATH)
  return events.slice(-limit).reverse()
}

export function addSSEClient(res) {
  sseClients.add(res)
  res.on('close', () => sseClients.delete(res))
}
