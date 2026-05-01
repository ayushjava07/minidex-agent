import { ml_kem768 } from '@noble/post-quantum/ml-kem.js'
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'
import fs from 'fs'
import path from 'path'

const KEYS_DIR = path.join(process.cwd(), 'agents', 'keys')

// ─── Key persistence ────────────────────────────────────────────────────────────
// genration of key for the first time and saving it to disk, subsequent calls will load the same keys
// on restart agents will load the same keys and share public keys again to ensure they are available for peers
function saveKeys(role, publicKey, secretKey) {
    if (!fs.existsSync(KEYS_DIR)) {
        fs.mkdirSync(KEYS_DIR, { recursive: true })
    }

    fs.writeFileSync(
        path.join(KEYS_DIR, `${role}-public.key`),
        Buffer.from(publicKey)
    )
    fs.writeFileSync(
        path.join(KEYS_DIR, `${role}-secret.key`),
        Buffer.from(secretKey)
    )

    console.log(`[PQC] Keys saved for [${role}]`)
}

function loadKeys(role) {
    const pubPath = path.join(KEYS_DIR, `${role}-public.key`)
    const secPath = path.join(KEYS_DIR, `${role}-secret.key`)

    if (!fs.existsSync(pubPath) || !fs.existsSync(secPath)) {
        return null
    }

    return {
        publicKey: new Uint8Array(fs.readFileSync(pubPath)),
        secretKey: new Uint8Array(fs.readFileSync(secPath))
    }
}

// ─── Share public keys ────────────────────────────────────────────────────────
function savePublicKey(role, publicKey) {
    const keysFile = path.join(process.cwd(), 'agents', 'public-keys.json')

    let keys = {}
    if (fs.existsSync(keysFile)) {
        try {
            keys = JSON.parse(fs.readFileSync(keysFile, 'utf8'))
        } catch { keys = {} }
    }

    keys[role] = Buffer.from(publicKey).toString('hex')
    fs.writeFileSync(keysFile, JSON.stringify(keys, null, 2))
    console.log(`[PQC] Public key shared for [${role}]`)
}

function getPublicKey(role) {
    const keysFile = path.join(process.cwd(), 'agents', 'public-keys.json')

    if (!fs.existsSync(keysFile)) return null

    const keys = JSON.parse(fs.readFileSync(keysFile, 'utf8'))
    if (!keys[role]) return null

    return new Uint8Array(Buffer.from(keys[role], 'hex'))
}

// ─── AES encryption using sharedSecret ─────────────────────────────────────────
function aesEncrypt(sharedSecret, plaintext) {
    // sharedSecret's first 32 bytes = AES-256 key
    const key = Buffer.from(sharedSecret).slice(0, 32)

    // Random IV - har baar alag
    const iv = randomBytes(16)

    const cipher = createCipheriv('aes-256-cbc', key, iv)
    let encrypted = cipher.update(plaintext, 'utf8', 'hex')
    encrypted += cipher.final('hex')

    return {
        encrypted,
        iv: iv.toString('hex')
    }
}

function aesDecrypt(sharedSecret, encrypted, ivHex) {
    const key = Buffer.from(sharedSecret).slice(0, 32)
    const iv  = Buffer.from(ivHex, 'hex')

    const decipher = createDecipheriv('aes-256-cbc', key, iv)
    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')

    return decrypted
}

// ─── PUBLIC: Generate or load keys ────────────────────────────────────────────
export function generateKeys(role) {
    // Pehle check karo keys already hain kya
    const existing = loadKeys(role)
    if (existing) {
        console.log(`[PQC] Loaded existing keys for [${role}]`)
        savePublicKey(role, existing.publicKey)
        return existing
    }

    // Nayi keys generate karo
    const keys = ml_kem768.keygen()

    // Save karo
    saveKeys(role, keys.publicKey, keys.secretKey)
    savePublicKey(role, keys.publicKey)

    console.log(`[PQC] New keys generated for [${role}]`)
    console.log(`[PQC] Public key size : ${keys.publicKey.length} bytes`)
    console.log(`[PQC] Secret key size : ${keys.secretKey.length} bytes`)

    return keys
}

// ─── PUBLIC: Encrypt message for a specific agent ──────────────────────────────
export function encryptMessage(targetRole, message) {
    // take the public key of the target agent from the shared public keys file
    const publicKey = getPublicKey(targetRole)
    if (!publicKey) {
        throw new Error(`[PQC] Public key not found for [${targetRole}]`)
    }

    // Step 1: ML-KEM encapsulate
    // sharedSecret generation + cipherText creation
    // cipherText = lock sharedSecret with target's public key, yehi bhejna hai target ko
    const { cipherText, sharedSecret } = ml_kem768.encapsulate(publicKey)

    // Step 2: encrypt message with AES using sharedSecret
    const { encrypted, iv } = aesEncrypt(sharedSecret, message)

    const result = {
        cipherText:       Buffer.from(cipherText).toString('hex'),
        encryptedMessage: encrypted,
        iv:               iv,
        targetRole:       targetRole
    }

    console.log(`[PQC] Message encrypted for [${targetRole}]`)
    console.log(`  ML-KEM cipherText : ${result.cipherText.slice(0, 20)}...`)
    console.log(`  AES encrypted     : ${result.encryptedMessage.slice(0, 20)}...`)
    console.log(`  IV                : ${result.iv}`)

    return result
}

// ─── PUBLIC: Decrypt message ───────────────────────────────────────────────────
export function decryptMessage(role, cipherTextHex, encryptedMessage, iv) {
    // take agents own secret key to decapsulate the cipherText and get the sharedSecret
    const keys = loadKeys(role)
    if (!keys) {
        throw new Error(`[PQC] Secret key not found for [${role}]`)
    }

    // Step 1: ML-KEM decapsulate
    // finding sharedSecret using own secret key and cipherText
    const sharedSecret = ml_kem768.decapsulate(
        Buffer.from(cipherTextHex, 'hex'),
        keys.secretKey
    )

    // Step 2: decrypt AES using sharedSecret
    const plaintext = aesDecrypt(sharedSecret, encryptedMessage, iv)

    console.log(`[PQC] Message decrypted by [${role}]`)
    console.log(`  Plaintext : ${plaintext}`)

    return plaintext
}

// ─── PUBLIC: Get my public key ─────────────────────────────────────────────────
export function getMyPublicKey(role) {
    const keys = loadKeys(role)
    if (!keys) return null
    return Buffer.from(keys.publicKey).toString('hex')
}