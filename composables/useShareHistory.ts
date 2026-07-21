export interface ShareHistoryItem {
  id: string
  shareUrl: string
  fileNames: string[]
  fileCount: number
  createdAt: string
  expiresAt: string
  ownerToken: string
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

  async function load() {
    const data = await loadAll()
    items.value = data || []
    loaded.value = true
  }

  return { items, loaded, load, add, remove }
}
