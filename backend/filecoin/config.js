import { loadLoggerConfig } from '../../agents/logger.js'
import { createLogger } from '../../agents/logger.js'

const logger = createLogger('filecoin-config')

function nonEmptyString(value, name) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${name} must be a non-empty string`)
  }
  return value.trim()
}

function nonNegativeInteger(value, name) {
  const n = Number(value)
  if (!Number.isInteger(n) || n < 0) {
    throw new Error(`${name} must be a non-negative integer`)
  }
  return n
}

function positiveInteger(value, name) {
  const n = Number(value)
  if (!Number.isInteger(n) || n <= 0) {
    throw new Error(`${name} must be a positive integer`)
  }
  return n
}

export function loadFilecoinConfig(env = process.env) {
  const issues = []

  const storachaToken = env.STORACHA_TOKEN || ''
  const storachaSpace = env.STORACHA_SPACE || ''
  const storachaEndpoint = env.STORACHA_ENDPOINT || 'https://up.web3.storage'

  const lotusApi = env.LOTUS_API_URL || ''
  const lotusToken = env.LOTUS_API_TOKEN || ''

  const dealMinDuration = nonNegativeInteger(env.DEAL_MIN_DURATION || 518400, 'DEAL_MIN_DURATION')
  const dealMinVerified = env.DEAL_MIN_VERIFIED !== 'false'

  const maxUploadSize = positiveInteger(env.FILECOIN_MAX_UPLOAD_SIZE || 104857600, 'FILECOIN_MAX_UPLOAD_SIZE')
  const uploadTimeoutMs = positiveInteger(env.FILECOIN_UPLOAD_TIMEOUT_MS || 120000, 'FILECOIN_UPLOAD_TIMEOUT_MS')
  const retryAttempts = positiveInteger(env.FILECOIN_RETRY_ATTEMPTS || 3, 'FILECOIN_RETRY_ATTEMPTS')
  const retryDelayMs = positiveInteger(env.FILECOIN_RETRY_DELAY_MS || 1000, 'FILECOIN_RETRY_DELAY_MS')

  const metricsEnabled = env.FILECOIN_METRICS_ENABLED !== 'false'
  const cacheDir = env.FILECOIN_CACHE_DIR || './.filecoin-cache'

  const apiPort = positiveInteger(env.FILECOIN_API_PORT || 4200, 'FILECOIN_API_PORT')
  const apiHost = nonEmptyString(env.FILECOIN_API_HOST || '127.0.0.1', 'FILECOIN_API_HOST')
  const apiRateLimitRps = positiveInteger(env.FILECOIN_API_RATE_LIMIT_RPS || 10, 'FILECOIN_API_RATE_LIMIT_RPS')

  if (!storachaToken && !lotusApi) {
    issues.push({
      section: 'filecoin',
      message: 'At least one of STORACHA_TOKEN or LOTUS_API_URL must be set'
    })
  }

  if (issues.length > 0) {
    const detail = issues.map(i => `[${i.section}] ${i.message}`).join('; ')
    const error = new Error(`Filecoin configuration is invalid: ${detail}`)
    error.code = 'INVALID_FILECOIN_CONFIG'
    error.issues = issues
    throw error
  }

  const config = Object.freeze({
    storacha: Object.freeze({
      token: storachaToken,
      space: storachaSpace,
      endpoint: storachaEndpoint,
      enabled: !!storachaToken
    }),
    lotus: Object.freeze({
      apiUrl: lotusApi,
      token: lotusToken,
      enabled: !!lotusApi
    }),
    deals: Object.freeze({
      minDuration: dealMinDuration,
      minVerified: dealMinVerified
    }),
    upload: Object.freeze({
      maxSize: maxUploadSize,
      timeoutMs: uploadTimeoutMs,
      retryAttempts,
      retryDelayMs
    }),
    metrics: Object.freeze({
      enabled: metricsEnabled
    }),
    cache: Object.freeze({
      dir: cacheDir
    }),
    api: Object.freeze({
      port: apiPort,
      host: apiHost,
      rateLimitRps: apiRateLimitRps
    })
  })

  logger.info('filecoin_config_loaded', {
    storachaEnabled: config.storacha.enabled,
    lotusEnabled: config.lotus.enabled,
    apiPort: config.api.port,
    dealsMinDuration: config.deals.minDuration
  })

  return config
}
