import fs from 'fs'
import path from 'path'

const PEERS_FILE = path.join(process.cwd(), 'agents', 'peers.json')
const agentToKill = process.argv[2] || 'monitor'

console.log(`Simulating failure of [${agentToKill}] agent`)
console.log('In real system: kill the process')
console.log('For demo: stop the terminal running that agent')
console.log('')
console.log('Watch report agent terminal for:')
console.log(`  [Report] ALERT: ${agentToKill} DOWN for 30s`)
console.log('  [Report] Taking over monitor tasks...')