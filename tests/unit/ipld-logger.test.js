import { describe, it, expect, vi, beforeEach } from 'vitest'

const virtualFs = vi.hoisted(() => {
  const store = {}
  return {
    store,
    existsSync: (p) => p in store,
    readFileSync: (p, enc) => {
      if (!(p in store)) throw new Error(`ENOENT: ${p}`)
      return enc === 'utf8' || enc === 'utf-8' ? store[p] : Buffer.from(store[p] || '')
    },
    writeFileSync: (p, data) => {
      store[p] = typeof data === 'string' ? data : JSON.stringify(data, null, 2)
    },
    mkdirSync: () => {},
    chmodSync: () => {},
  }
})

vi.mock('fs', () => ({
  existsSync: virtualFs.existsSync,
  readFileSync: virtualFs.readFileSync,
  writeFileSync: virtualFs.writeFileSync,
  mkdirSync: virtualFs.mkdirSync,
  chmodSync: virtualFs.chmodSync,
  default: {
    existsSync: virtualFs.existsSync,
    readFileSync: virtualFs.readFileSync,
    writeFileSync: virtualFs.writeFileSync,
    mkdirSync: virtualFs.mkdirSync,
    chmodSync: virtualFs.chmodSync,
  },
}))

vi.mock('@ipld/dag-cbor', () => ({
  encode: vi.fn((data) => Buffer.from(JSON.stringify(data))),
  decode: vi.fn((bytes) => JSON.parse(Buffer.from(bytes).toString())),
  code: 0x0129,
}))

vi.mock('multiformats/cid', () => ({
  CID: {
    create: vi.fn((_version, _code, hash) => ({
      toString: () => 'bafyreihtest' + Array.from(new Uint8Array(hash.digest)).slice(0, 10).map(b => b.toString(16).padStart(2, '0')).join(''),
    })),
  },
}))

vi.mock('multiformats/hashes/sha2', () => ({
  sha256: {
    digest: vi.fn(async (bytes) => {
      const b = bytes instanceof Uint8Array ? Buffer.from(bytes) : Buffer.from(bytes)
      const hash = await crypto.subtle.digest('SHA-256', b)
      return {
        code: 0x12,
        size: 32,
        digest: new Uint8Array(hash),
      }
    }),
  },
}))

describe('ipld-logger.js', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.keys(virtualFs.store).forEach(k => delete virtualFs.store[k])
  })

  describe('logTask', () => {
    it('should create a task and return CID', async () => {
      const { logTask } = await import('../../agents/ipld-logger.js')
      const cid = await logTask({
        agent: 'deploy',
        workflow: 'test-workflow',
        status: 'in-progress',
      })
      expect(cid).toBeDefined()
      expect(typeof cid).toBe('string')
      expect(cid.startsWith('bafyreih')).toBe(true)
    })

    it('should throw when agent is missing', async () => {
      const { logTask } = await import('../../agents/ipld-logger.js')
      await expect(logTask({
        workflow: 'test',
        status: 'in-progress',
      })).rejects.toThrow('agent, workflow, status are required')
    })

    it('should throw when workflow is missing', async () => {
      const { logTask } = await import('../../agents/ipld-logger.js')
      await expect(logTask({
        agent: 'deploy',
        status: 'in-progress',
      })).rejects.toThrow('agent, workflow, status are required')
    })

    it('should throw when status is missing', async () => {
      const { logTask } = await import('../../agents/ipld-logger.js')
      await expect(logTask({
        agent: 'deploy',
        workflow: 'test',
      })).rejects.toThrow('agent, workflow, status are required')
    })
  })

  describe('logExecution', () => {
    it('should create an execution entry and return CID', async () => {
      const { logExecution } = await import('../../agents/ipld-logger.js')
      const cid = await logExecution({
        taskCID: 'bafyreihtest',
        event: 'task_started',
        agent: 'deploy',
      })
      expect(cid).toBeDefined()
      expect(typeof cid).toBe('string')
    })

    it('should throw when taskCID is missing', async () => {
      const { logExecution } = await import('../../agents/ipld-logger.js')
      await expect(logExecution({ event: 'start', agent: 'deploy' })).rejects.toThrow(
        'taskCID, event, agent are required'
      )
    })

    it('should throw when event is missing', async () => {
      const { logExecution } = await import('../../agents/ipld-logger.js')
      await expect(logExecution({ taskCID: 'abc', agent: 'deploy' })).rejects.toThrow(
        'taskCID, event, agent are required'
      )
    })
  })

  describe('verifyTaskIntegrity', () => {
    it('should return false for unknown CID', async () => {
      const { verifyTaskIntegrity } = await import('../../agents/ipld-logger.js')
      const result = await verifyTaskIntegrity('nonexistent')
      expect(result).toBe(false)
    })

    it('should return true for a valid task', async () => {
      const { logTask, verifyTaskIntegrity } = await import('../../agents/ipld-logger.js')
      const cid = await logTask({
        agent: 'deploy',
        workflow: 'verify-test',
        status: 'done',
      })
      const valid = await verifyTaskIntegrity(cid)
      expect(valid).toBe(true)
    })

    it('should return false on tampered data', async () => {
      const { logTask, verifyTaskIntegrity } = await import('../../agents/ipld-logger.js')
      const cid = await logTask({
        agent: 'deploy',
        workflow: 'tamper-test',
        status: 'done',
      })
      const logPath = Object.keys(virtualFs.store).find(k => k.includes('task-log'))
      if (logPath && virtualFs.store[logPath]) {
        const data = JSON.parse(virtualFs.store[logPath])
        data[0].status = 'tampered'
        virtualFs.store[logPath] = JSON.stringify(data, null, 2)
      }
      const valid = await verifyTaskIntegrity(cid)
      expect(valid).toBe(false)
    })
  })

  describe('getFullDAG', () => {
    it('should return null for unknown root CID', async () => {
      const { getFullDAG } = await import('../../agents/ipld-logger.js')
      const dag = getFullDAG('nonexistent')
      expect(dag).toBeNull()
    })
  })

  describe('getNode', () => {
    it('should return null for unknown CID', async () => {
      const { getNode } = await import('../../agents/ipld-logger.js')
      const node = getNode('nonexistent')
      expect(node).toBeNull()
    })
  })

  describe('getTaskHistory', () => {
    it('should return empty array initially', async () => {
      const { getTaskHistory } = await import('../../agents/ipld-logger.js')
      expect(getTaskHistory()).toEqual([])
    })

    it('should contain logged tasks', async () => {
      const { logTask, getTaskHistory } = await import('../../agents/ipld-logger.js')
      await logTask({ agent: 'deploy', workflow: 'w1', status: 'ok' })
      await logTask({ agent: 'monitor', workflow: 'w2', status: 'ok' })
      const history = getTaskHistory()
      expect(history.length).toBe(2)
    })
  })

  describe('getExecutionHistory', () => {
    it('should return empty array initially', async () => {
      const { getExecutionHistory } = await import('../../agents/ipld-logger.js')
      expect(getExecutionHistory()).toEqual([])
    })
  })

  describe('escalateToHuman', () => {
    it('should update task escalation fields', async () => {
      const { logTask, escalateToHuman, getTaskHistory } = await import('../../agents/ipld-logger.js')
      const cid = await logTask({
        agent: 'deploy',
        workflow: 'escalation-test',
        status: 'stuck',
      })
      await escalateToHuman(cid, 'needs manual review')
      const tasks = getTaskHistory()
      const task = tasks.find(t => t.task_id === cid)
      expect(task).toBeDefined()
      if (task) {
        expect(task.escalated_to_human).toBe(true)
        expect(task.escalation_reason).toBe('needs manual review')
        expect(task.escalated_at).toBeDefined()
      }
    })
  })
})
