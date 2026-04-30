import * as dagCBOR from '@ipld/dag-cbor'
import { CID } from 'multiformats/cid'
import { sha256 } from 'multiformats/hashes/sha2'
import fs from 'fs'
import path from 'path'

const LOG_FILE = path.join(process.cwd(), 'agents', 'task-log.json')
const EXEC_FILE = path.join(process.cwd(), 'agents', 'execution-log.json')

// DAG-CBOR CID generate karo
async function generateIPLDCID(data) {
    const bytes = dagCBOR.encode(data)
    const hash = await sha256.digest(bytes)
    const cid = CID.create(1, dagCBOR.code, hash)
    return cid.toString()
}

// File  saving 
function saveToFile(filePath, entry) {
    let logs = []
    if (fs.existsSync(filePath)) {
        try {
            logs = JSON.parse(fs.readFileSync(filePath, 'utf8'))
        } catch(e) {
            logs = []
        }
    }
    logs.push(entry)
    fs.writeFileSync(filePath, JSON.stringify(logs, null, 2))
}

export async function logTask(taskData) {
    // Real IPLD Task DAG Node
    const taskNode = {
        assigned_to:        taskData.agent,
        workflow:           taskData.workflow,
        status:             taskData.status,
        explanation:        taskData.explanation,
        timestamp:          Date.now(),
        inputs:             taskData.inputs  || {},
        outputs:            taskData.outputs || null,
        parent_task:        taskData.parentCID || null,
        escalated_to_human: false,
        subtasks:           []
    }

    // make CID FROM DAG-CBOR
    const cid = await generateIPLDCID(taskNode)
    taskNode.task_id = cid

    saveToFile(LOG_FILE, taskNode)

    console.log(`[IPLD] Task Node created`)
    console.log(`[IPLD] Workflow  : ${taskData.workflow}`)
    console.log(`[IPLD] Agent     : ${taskData.agent}`)
    console.log(`[IPLD] Status    : ${taskData.status}`)
    console.log(`[IPLD] CID       : ${cid}`)
    if (taskData.parentCID) {
        console.log(`[IPLD] Parent    : ${taskData.parentCID}`)
    }

    return cid
}

export async function logExecution(execData) {
    // Real IPLD Execution Log Node
    const execNode = {
        task_ref:  execData.taskCID,
        event:     execData.event,
        agent:     execData.agent,
        outcome:   execData.outcome,
        timestamp: Date.now(),
        tx_hash:   execData.txHash  || null,
        gas_used:  execData.gasUsed || null
    }

    // make CID FROM DAG-CBOR
    const cid = await generateIPLDCID(execNode)
    execNode.log_id = cid

    saveToFile(EXEC_FILE, execNode)

    console.log(`[IPLD] Execution Node created`)
    console.log(`[IPLD] Event     : ${execData.event}`)
    console.log(`[IPLD] Agent     : ${execData.agent}`)
    console.log(`[IPLD] Outcome   : ${execData.outcome}`)
    console.log(`[IPLD] CID       : ${cid}`)
    console.log(`[IPLD] Task ref  : ${execData.taskCID}`)

    return cid
}

export function getTaskHistory() {
    if (!fs.existsSync(LOG_FILE)) return []
    return JSON.parse(fs.readFileSync(LOG_FILE, 'utf8'))
}

export function getExecutionHistory() {
    if (!fs.existsSync(EXEC_FILE)) return []
    return JSON.parse(fs.readFileSync(EXEC_FILE, 'utf8'))
}