import * as dagCBOR from '@ipld/dag-cbor'
import { CID } from 'multiformats/cid'
import { sha256 } from 'multiformats/hashes/sha2'

export async function encodeIPLDNode(data) {
  const clean = JSON.parse(JSON.stringify(data))
  const bytes = dagCBOR.encode(clean)
  const hash = await sha256.digest(bytes)
  const cid = CID.create(1, dagCBOR.code, hash)
  return { cid: cid.toString(), bytes, node: clean }
}

export async function decodeIPLDNode(bytes) {
  const node = dagCBOR.decode(bytes)
  const hash = await sha256.digest(bytes)
  const cid = CID.create(1, dagCBOR.code, hash)
  return { cid: cid.toString(), node }
}

export async function verifyIPLDIntegrity(data, expectedCid) {
  const { cid } = await encodeIPLDNode(data)
  return { valid: cid === expectedCid, actual: cid, expected: expectedCid }
}

export function cidToBytes(cidStr) {
  const cid = CID.parse(cidStr)
  return cid.bytes
}

export function bytesToCID(bytes) {
  return CID.decode(bytes).toString()
}

export function linksFromNode(node) {
  const links = []
  for (const [key, value] of Object.entries(node)) {
    if (typeof value === 'string' && /^b[A-Za-z2-7]{58,}$/.test(value)) {
      try {
        CID.parse(value)
        links.push({ name: key, cid: value })
      } catch {}
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === 'string' && /^b[A-Za-z2-7]{58,}$/.test(item)) {
          try {
            CID.parse(item)
            links.push({ cid: item })
          } catch {}
        }
      }
    }
  }
  return links
}
