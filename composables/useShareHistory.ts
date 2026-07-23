export interface ShareHistoryItem {
  id: string
  shareUrl: string
  fileNames: string[]
  fileIds: string[]
  fileHashes: string[]
  fileCount: number
  createdAt: string
  expiresAt: string
  ownerToken: string
  password: string
  contentHash: string
}

const DB_NAME = 'codediff-db'
const STORE_NAME = 'share-history'
const KEY = 'shares'

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 3)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function saveAll(items: ShareHistoryItem[]) {
  if (import.meta.server) return
  try {
    const db = await openDB()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
      tx.objectStore(STORE_NAME).put(items, KEY)
    })
  } catch (e) { console.error('[ShareHistory] saveAll error:', e) }
}

async function loadAll(): Promise<ShareHistoryItem[]> {
  if (import.meta.server) return []
  try {
    const db = await openDB()
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const req = tx.objectStore(STORE_NAME).get(KEY)
      req.onsuccess = () => resolve(req.result || [])
      req.onerror = () => reject(req.error)
    })
  } catch { return [] }
}

export function useShareHistory() {
  const items = ref<ShareHistoryItem[]>([])
  const loaded = ref(false)

  async function add(item: ShareHistoryItem) {
    items.value.unshift(item)
    // Use toRaw to strip Vue reactive proxy — IDB can't clone reactive arrays
    await saveAll(toRaw(items.value))
  }

  async function remove(id: string) {
    items.value = items.value.filter(i => i.id !== id)
    await saveAll(toRaw(items.value))
  }

  async function updateContentHash(id: string, hash: string, fileHashes?: string[], fileIds?: string[]) {
    const item = items.value.find(i => i.id === id)
    if (item) {
      item.contentHash = hash
      if (fileHashes) item.fileHashes = fileHashes
      if (fileIds) item.fileIds = fileIds
      await saveAll(toRaw(items.value))
    }
  }

  async function load() {
    const data = await loadAll()
    items.value = data || []
    loaded.value = true
  }

  /**
   * Auto-migrate old history items: fill in missing fileIds and fileHashes
   * by matching file names against current editor files.
   * Call this when opening the history modal.
   */
  async function migrateMissingFields(currentFiles: any[]) {
    let changed = false
    for (const item of items.value) {
      if (!item.fileIds || item.fileIds.length === 0) {
        item.fileIds = item.fileNames.map(name => {
          const match = currentFiles.find(f => f.leftPath === name || f.rightPath === name)
          return match?.fileId || ''
        })
        changed = true
      }
      if (!item.fileHashes || item.fileHashes.length === 0) {
        item.fileHashes = item.fileNames.map(name => {
          const match = currentFiles.find(f => f.leftPath === name || f.rightPath === name)
          if (!match) return ''
          const data = `${match.leftContent || ''}|${match.rightContent || ''}`
          let hash = 0
          for (let i = 0; i < data.length; i++) {
            hash = ((hash << 5) - hash) + data.charCodeAt(i)
            hash |= 0
          }
          return String(hash)
        })
        changed = true
      }
    }
    if (changed) await saveAll(toRaw(items.value))
  }

  return { items, loaded, load, add, remove, updateContentHash, migrateMissingFields }
}
