import { getStats, getUploads } from '../filecoin/upload-store.js'

const AGENTS = ['deploy', 'monitor', 'report', 'liquidity', 'analytics']

export function getAgentStatus(req, res) {
  const stats = getStats()
  const latestUploads = getUploads({ limit: 5, sort: 'createdAt', order: 'desc' })
  const status = {}

  for (const agent of AGENTS) {
    status[`${agent}Agent`] = 'active'
  }

  status.latestCid = latestUploads.items[0]?.cid || '-'
  status.latestReport = latestUploads.items.length > 0
    ? `${stats.totalUploads} total records stored`
    : 'No activity yet'

  res.json(status)
}
