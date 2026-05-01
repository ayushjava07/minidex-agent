import * as dagCBOR from '@ipld/dag-cbor'
import { CID } from 'multiformats/cid'
import { sha256 } from 'multiformats/hashes/sha2'
import fs from 'fs'
import path from 'path'

// ─── File paths ────────────────────────────────────────────────────────────────
const LOG_FILE  = path.join(process.cwd(), 'agents', 'task-log.json')
const EXEC_FILE = path.join(process.cwd(), 'agents', 'execution-log.json')

// ─── In-memory DAG store ────────────────────────────────────────────────────────
// Key   = CID string
// Value = raw node object
const dagStore = new Map()

// ─── Core: DAG-CBOR CID generation ─────────────────────────────────────────────
async function generateIPLDCID(data) {
    // Remove any undefined values - DAG-CBOR cannot encode undefined
    const clean = JSON.parse(JSON.stringify(data))
    const bytes = dagCBOR.encode(clean)
    const hash  = await sha256.digest(bytes)
    return CID.create(1, dagCBOR.code, hash).toString()
}

// ─── Core: File persistence ─────────────────────────────────────────────────────
function readFile(filePath) {
    if (!fs.existsSync(filePath)) return []
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'))
    } catch {
        return []
    }
}

function writeFile(filePath, data) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2))
}

function appendToFile(filePath, entry) {
    const existing = readFile(filePath)
    existing.push(entry)
    writeFile(filePath, existing)
}

// ─── Core: Subtask registration ─────────────────────────────────────────────────
// When a child task is created, register it under parent's subtasks array
async function registerSubtask(parentCID, childCID) {
    if (!parentCID) return

    // Update in-memory store
    const parentNode = dagStore.get(parentCID)
    if (parentNode && !parentNode.subtasks.includes(childCID)) {
        parentNode.subtasks.push(childCID)
        dagStore.set(parentCID, parentNode)
    }

    // Update file
    const allTasks = readFile(LOG_FILE)
    const idx = allTasks.findIndex(t => t.task_id === parentCID)
    if (idx !== -1 && !allTasks[idx].subtasks.includes(childCID)) {
        allTasks[idx].subtasks.push(childCID)
        writeFile(LOG_FILE, allTasks)
        console.log(`[IPLD] Subtask ${childCID.slice(0, 16)}... registered under ${parentCID.slice(0, 16)}...`)
    }
}

// ─── PUBLIC: Log a Task DAG Node ────────────────────────────────────────────────
export async function logTask(taskData) {
    if (!taskData.agent || !taskData.workflow || !taskData.status) {
        throw new Error('[IPLD] logTask: agent, workflow, status are required')
    }

    // Build node 
    const taskNode = {
        parent_task:        taskData.parentCID  || null,
        assigned_to:        taskData.peerId     || taskData.agent,
        workflow:           taskData.workflow,
        status:             taskData.status,
        explanation:        taskData.explanation || '',
        timestamp:          Date.now(),
        inputs:             taskData.inputs      || {},
        outputs:            taskData.outputs     || null,
        escalated_to_human: taskData.escalate   || false,
        subtasks:           []
    }

    // Generate DAG-CBOR CID from node (without task_id field)
    const cid = await generateIPLDCID(taskNode)
    taskNode.task_id = cid

    // Persist
    dagStore.set(cid, taskNode)
    appendToFile(LOG_FILE, taskNode)

    // Register as subtask under parent
    if (taskData.parentCID) {
        await registerSubtask(taskData.parentCID, cid)
    }

    console.log(`[IPLD] Task Node Created`)
    console.log(`  CID         : ${cid}`)
    console.log(`  Workflow    : ${taskNode.workflow}`)
    console.log(`  Assigned to : ${taskNode.assigned_to}`)
    console.log(`  Status      : ${taskNode.status}`)
    console.log(`  Explanation : ${taskNode.explanation}`)
    if (taskNode.parent_task) {
        console.log(`  Parent      : ${taskNode.parent_task}`)
    }
    if (taskNode.inputs && Object.keys(taskNode.inputs).length > 0) {
        console.log(`  Inputs      :`, taskNode.inputs)
    }

    return cid
}

// ─── PUBLIC: Log an Execution Log Node ─────────────────────────────────────────
export async function logExecution(execData) {
    if (!execData.taskCID || !execData.event || !execData.agent) {
        throw new Error('[IPLD] logExecution: taskCID, event, agent are required')
    }

    const execNode = {
        task_ref:  execData.taskCID,
        timestamp: Date.now(),
        event:     execData.event,
        agent:     execData.peerId  || execData.agent,
        outcome:   execData.outcome || 'unknown',
        tx_hash:   execData.txHash  || null,
        gas_used:  execData.gasUsed || null
    }

    const cid = await generateIPLDCID(execNode)
    execNode.log_id = cid

    dagStore.set(cid, execNode)
    appendToFile(EXEC_FILE, execNode)

    console.log(`[IPLD] Execution Node Created`)
    console.log(`  CID      : ${cid}`)
    console.log(`  Event    : ${execNode.event}`)
    console.log(`  Agent    : ${execNode.agent}`)
    console.log(`  Outcome  : ${execNode.outcome}`)
    console.log(`  Task ref : ${execNode.task_ref}`)
    if (execNode.tx_hash) {
        console.log(`  Tx Hash  : ${execNode.tx_hash}`)
    }

    return cid
}

// ─── PUBLIC: Full DAG traversal from any root CID ──────────────────────────────
// Recursively builds full tree: task → subtasks → executions
export function getFullDAG(rootCID) {
    const allTasks = readFile(LOG_FILE)
    const allExecs = readFile(EXEC_FILE)

    function buildTree(cid, depth = 0) {
        if (depth > 10) return null // prevent infinite loop

        const task = allTasks.find(t => t.task_id === cid)
        if (!task) return null

        const executions = allExecs.filter(e => e.task_ref === cid)

        const subtasks = (task.subtasks || [])
            .map(childCID => buildTree(childCID, depth + 1))
            .filter(Boolean)

        return {
            ...task,
            executions,
            subtasks
        }
    }

    return buildTree(rootCID)
}

// ─── PUBLIC: Get single node from memory or file ───────────────────────────────
export function getNode(cid) {
    // Try memory first
    if (dagStore.has(cid)) return dagStore.get(cid)

    // Fall back to file
    const allTasks = readFile(LOG_FILE)
    const task = allTasks.find(t => t.task_id === cid)
    if (task) return task

    const allExecs = readFile(EXEC_FILE)
    return allExecs.find(e => e.log_id === cid) || null
}

// ─── PUBLIC: History getters ───────────────────────────────────────────────────
export function getTaskHistory()     { return readFile(LOG_FILE) }
export function getExecutionHistory(){ return readFile(EXEC_FILE) }

// ─── PUBLIC: Integrity verification ───────────────────────────────────────────
// Prove that a stored node has not been tampered with
export async function verifyTaskIntegrity(cid) {
    const task = getTaskHistory().find(t => t.task_id === cid)
    if (!task) {
        console.log(`[IPLD] Verify: Node ${cid} not found`)
        return false
    }

    // Recompute CID without task_id field
    const { task_id, ...nodeWithoutId } = task
    const expected = await generateIPLDCID(nodeWithoutId)
    const valid = expected === cid

    console.log(`[IPLD] Integrity check for ${cid.slice(0, 16)}...`)
    console.log(`  Result: ${valid ? 'VALID - not tampered' : 'INVALID - data was modified'}`)

    return valid
}

// ─── PUBLIC: Escalate task to human ───────────────────────────────────────────
export async function escalateToHuman(taskCID, reason) {
    const allTasks = readFile(LOG_FILE)
    const idx = allTasks.findIndex(t => t.task_id === taskCID)

    if (idx === -1) {
        console.log(`[IPLD] Escalate: Task ${taskCID} not found`)
        return
    }

    allTasks[idx].escalated_to_human = true
    allTasks[idx].escalation_reason  = reason
    allTasks[idx].escalated_at       = Date.now()

    writeFile(LOG_FILE, allTasks)

    if (dagStore.has(taskCID)) {
        const node = dagStore.get(taskCID)
        node.escalated_to_human = true
        node.escalation_reason  = reason
        dagStore.set(taskCID, node)
    }

    console.log(`[IPLD] Task ${taskCID.slice(0, 16)}... escalated to human`)
    console.log(`  Reason: ${reason}`)
}

// ─── PUBLIC: Print full DAG as ASCII tree ─────────────────────────────────────
export function printDAG(rootCID) {
    const dag = getFullDAG(rootCID)
    if (!dag) {
        console.log(`[IPLD] No DAG found for ${rootCID}`)
        return
    }

    function print(node, prefix = '', isLast = true) {
        const connector = isLast ? '└── ' : '├── '
        console.log(`${prefix}${connector}[${node.workflow}] ${node.task_id.slice(0, 16)}... (${node.status})`)

        const childPrefix = prefix + (isLast ? '    ' : '│   ')

        node.executions.forEach((exec, i) => {
            const last = i === node.executions.length - 1 && node.subtasks.length === 0
            console.log(`${childPrefix}${last ? '└── ' : '├── '}exec: ${exec.event} → ${exec.outcome}`)
        })

        node.subtasks.forEach((child, i) => {
            print(child, childPrefix, i === node.subtasks.length - 1)
        })
    }

    console.log(`\n[IPLD] DAG from root: ${rootCID.slice(0, 16)}...`)
    print(dag)
    console.log()
}