import { metrics } from '../../agents/metrics.js'

export const filecoinMetrics = Object.freeze({
  uploadCount: metrics.counter(
    'atos_filecoin_uploads_total',
    'Total Filecoin upload operations.',
    ['backend', 'status']
  ),
  retrieveCount: metrics.counter(
    'atos_filecoin_retrieves_total',
    'Total Filecoin retrieve operations.',
    ['backend', 'status']
  ),
  uploadBytes: metrics.counter(
    'atos_filecoin_upload_bytes_total',
    'Total bytes uploaded to Filecoin.',
    ['backend']
  ),
  retrieveBytes: metrics.counter(
    'atos_filecoin_retrieve_bytes_total',
    'Total bytes retrieved from Filecoin.',
    ['backend']
  ),
  dealCount: metrics.counter(
    'atos_filecoin_deals_total',
    'Total Filecoin deal proposals.',
    ['status']
  ),
  uploadDuration: metrics.histogram(
    'atos_filecoin_upload_duration_seconds',
    'Filecoin upload operation duration.',
    ['backend'],
    { buckets: [0.5, 1, 2, 5, 10, 30, 60] }
  ),
  retrieveDuration: metrics.histogram(
    'atos_filecoin_retrieve_duration_seconds',
    'Filecoin retrieve operation duration.',
    ['backend'],
    { buckets: [0.5, 1, 2, 5, 10, 30, 60] }
  ),
  dealDuration: metrics.histogram(
    'atos_filecoin_deal_duration_seconds',
    'Filecoin deal proposal duration.',
    ['status'],
    { buckets: [0.5, 1, 2, 5, 10, 30] }
  ),
  storageSize: metrics.gauge(
    'atos_filecoin_storage_size_bytes',
    'Total data size stored on Filecoin.',
    ['backend']
  ),
  pendingDeals: metrics.gauge(
    'atos_filecoin_pending_deals',
    'Number of pending Filecoin deals.',
    []
  ),
  activeDeals: metrics.gauge(
    'atos_filecoin_active_deals',
    'Number of active Filecoin deals.',
    []
  )
})
