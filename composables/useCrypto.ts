import { deflate as pakoDeflate, inflate as pakoInflate } from 'pako'

/**
 * Client-side encryption/decryption using Web Crypto API (AES-GCM + PBKDF2)
 *
 * Flow:
 * - Generate a random password (or use provided one)
 * - Derive AES key from password using PBKDF2
 * - Compress + encrypt data with AES-GCM
 * - Return encrypted data + IV + salt (all base64-encoded)
 * - Embed password in URL hash for sharing
 */

const ALGORITHM = 'AES-GCM'
const KEY_LENGTH = 256
const PBKDF2_ITERATIONS = 100_000
const PBKDF2_HASH = 'SHA-256'

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

async function deriveKey(
  password: string,
  salt: Uint8Array
): Promise<CryptoKey> {
  const encoder = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  )
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: PBKDF2_HASH,
    },
    keyMaterial,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  )
}

/**
 * Generate a random password for sharing
 */
export function generatePassword(length = 16): string {
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  const array = new Uint8Array(length)
  crypto.getRandomValues(array)
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars[array[i] % chars.length]
  }
  return result
}

/**
 * Encrypt JSON-serializable data with a password
 */
export async function encrypt(
  data: unknown,
  password: string
): Promise<{ encryptedData: string; iv: string; salt: string }> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveKey(password, salt)
  const encoder = new TextEncoder()
  const encoded = encoder.encode(JSON.stringify(data))
  const compressed = pakoDeflate(encoded)

  const ciphertext = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    compressed
  )

  return {
    encryptedData: arrayBufferToBase64(ciphertext),
    iv: arrayBufferToBase64(iv),
    salt: arrayBufferToBase64(salt),
  }
}

/**
 * Decrypt data with a password
 */
export async function decrypt<T = unknown>(
  encryptedData: string,
  iv: string,
  salt: string,
  password: string
): Promise<T> {
  const key = await deriveKey(password, base64ToArrayBuffer(salt))
  const ciphertext = base64ToArrayBuffer(encryptedData)

  const plainBuffer = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv: base64ToArrayBuffer(iv) },
    key,
    ciphertext
  )

  let plainBytes = new Uint8Array(plainBuffer)
  // Try decompress; fall back to raw data for backward compatibility with uncompressed data
  try {
    plainBytes = pakoInflate(plainBytes)
  } catch { /* data wasn't compressed (legacy) */ }
  const decoder = new TextDecoder()
  return JSON.parse(decoder.decode(plainBytes)) as T
}

/**
 * Get password from URL hash (format: #pwd=xxx)
 */
export function getPasswordFromHash(): string | null {
  if (typeof window === 'undefined') return null
  const hash = window.location.hash
  const match = hash.match(/^#pwd=(.+)$/)
  return match ? match[1] : null
}

/**
 * Build share URL with embedded password
 */
export function buildShareUrl(id: string, password: string): string {
  const base = `${window.location.origin}/view/${id}`
  return `${base}#pwd=${encodeURIComponent(password)}`
}

/**
 * Check if Web Crypto API is available
 */
export function isCryptoAvailable(): boolean {
  return typeof crypto !== 'undefined' && !!crypto.subtle
}

/**
 * Composable wrapper that returns all crypto utilities
 */
export function useCrypto() {
  return {
    generatePassword,
    encrypt,
    decrypt,
    getPasswordFromHash,
    buildShareUrl,
    isCryptoAvailable,
  }
}
