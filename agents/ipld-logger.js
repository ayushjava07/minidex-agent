import { generateCID } from './cid-helper.js'
import fs from 'fs'
import path from 'path'

const LOG_FILE = path.join(process.cwd(), 'agents', 'task-log.json')

// Task log karo
export async function logTask(taskData) {
    // Task node banao
    const taskNode = {
        task_id:            null,
        parent_task:        taskData.parentCID || null,
        assigned_to:        taskData.agent,
        workflow:           taskData.workflow,
        status:             taskData.status,
        explanation:        taskData.explanation,
        timestamp:          Date.now(),
        inputs:             taskData.inputs   || {},
        outputs:            taskData.outputs  || null,
        escalated_to_human: false,
        subtasks:           []
    }

    // CID generate karo
    const cid = await generateCID(taskNode)
    taskNode.task_id = cid

    // File mein save karo
    let logs = []
    if (fs.existsSync(LOG_FILE)) {
        try {
            logs = JSON.parse(fs.readFileSync(LOG_FILE, 'utf8'))
        } catch(e) {
            logs = []
        }
    }

    logs.push(taskNode)
    fs.writeFileSync(LOG_FILE, JSON.stringify(logs, null, 2))

    console.log(`[IPLD] Task logged`)
    console.log(`[IPLD] Workflow: ${taskData.workflow}`)
    console.log(`[IPLD] CID: ${cid}`)
    if (taskData.parentCID) {
        console.log(`[IPLD] Parent CID: ${taskData.parentCID}`)
    }

    return cid
}

// Execution log karo
export async function logExecution(execData) {
    const execNode = {
        log_id:    null,
        task_ref:  execData.taskCID,
        timestamp: Date.now(),
        event:     execData.event,
        agent:     execData.agent,
        outcome:   execData.outcome,
        tx_hash:   execData.txHash || null,
        gas_used:  execData.gasUsed || null
    }

    const cid = await generateCID(execNode)
    execNode.log_id = cid

    // Execution log file
    const execFile = path.join(process.cwd(), 'agents', 'execution-log.json')
    let logs = []
    if (fs.existsSync(execFile)) {
        try {
            logs = JSON.parse(fs.readFileSync(execFile, 'utf8'))
        } catch(e) {
            logs = []
        }
    }

    logs.push(execNode)
    fs.writeFileSync(execFile, JSON.stringify(logs, null, 2))

    console.log(`[IPLD] Execution logged`)
    console.log(`[IPLD] Event: ${execData.event}`)
    console.log(`[IPLD] CID: ${cid}`)

    return cid
}

// Task history dekho
export function getTaskHistory() {
    if (!fs.existsSync(LOG_FILE)) return []
    return JSON.parse(fs.readFileSync(LOG_FILE, 'utf8'))
}
