import type { DiffFile } from '~/types/diff'
import { toRaw } from 'vue'

const DB_NAME = 'codediff-db'
const STORE_NAME = 'files'
const KEY_FILES = 'diff-files'
const KEY_ACTIVE = 'diff-active'
const STORE_HISTORY = 'share-history'

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 3)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE_NAME)) {
        req.result.createObjectStore(STORE_NAME)
      }
      if (!req.result.objectStoreNames.contains(STORE_HISTORY)) {
        req.result.createObjectStore(STORE_HISTORY)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function loadFiles(): Promise<DiffFile[]> {
  if (import.meta.server) return []
  try {
    const db = await openDB()
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const req = tx.objectStore(STORE_NAME).get(KEY_FILES)
      req.onsuccess = () => resolve(req.result || [])
      req.onerror = () => reject(req.error)
    })
  } catch { return [] }
}

async function saveFiles(files: DiffFile[]) {
  console.log('[CodeDiff] saveFiles called, count:', files.length, 'first:', files[0]?.leftPath || '(empty)')
  if (import.meta.server) return
  try {
    const db = await openDB()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const req = tx.objectStore(STORE_NAME).put(toRaw(files), KEY_FILES)
      req.onsuccess = () => { console.log('[CodeDiff] saveFiles SUCCESS'); resolve() }
      req.onerror = () => { console.error('[CodeDiff] saveFiles ERROR:', req.error); reject(req.error) }
    })
  } catch(e) { console.error('[CodeDiff] saveFiles CATCH:', e) }
}

async function loadActiveId(): Promise<string> {
  if (import.meta.server) return ''
  try {
    const db = await openDB()
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const req = tx.objectStore(STORE_NAME).get(KEY_ACTIVE)
      req.onsuccess = () => resolve(req.result || '')
      req.onerror = () => reject(req.error)
    })
  } catch { return '' }
}

async function saveActiveId(id: string) {
  console.log('[CodeDiff] saveActiveId:', id)
  if (import.meta.server) return
  try {
    const db = await openDB()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const req = tx.objectStore(STORE_NAME).put(id, KEY_ACTIVE)
      req.onsuccess = () => { console.log('[CodeDiff] saveActiveId SUCCESS'); resolve() }
      req.onerror = () => { console.error('[CodeDiff] saveActiveId ERROR:', req.error); reject(req.error) }
    })
  } catch(e) { console.error('[CodeDiff] saveActiveId CATCH:', e) }
}

/**
 * Global diff state managed via useState + IndexedDB persistence
 */
export function useDiff() {
  const files = useState<DiffFile[]>('diff-files', () => [])
  const activeFileId = useState<string>('diff-active-file', () => '1')
  const initialized = ref(false)

  // Load from IndexedDB on mount
  if (!import.meta.server && !initialized.value) {
    initialized.value = true
    loadFiles().then(saved => {
      files.value = saved.length > 0
        ? saved
        : [{ id: '1', leftPath: '', rightPath: '', leftContent: '', rightContent: '', language: 'plaintext' }]
      loadActiveId().then(id => {
        activeFileId.value = (id && files.value.find(f => f.id === id)) ? id : files.value[0]?.id || '1'
      })
      // Explicit initial save
      saveFiles(files.value)
      saveActiveId(activeFileId.value)
    })
  }

  if (import.meta.server) {
    files.value = [{ id: '1', leftPath: '', rightPath: '', leftContent: '', rightContent: '', language: 'plaintext' }]
    activeFileId.value = '1'
  }

  // Persist to IndexedDB on changes (debounced)
  let saveTimer: ReturnType<typeof setTimeout> | null = null
  watch(files, (v) => {
    if (!initialized.value || v.length === 0) return
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => saveFiles(v), 300)
  }, { deep: true })
  watch(activeFileId, (v) => {
    if (!initialized.value) return
    saveActiveId(v)
  })

  const activeFile = computed(() =>
    files.value.find((f) => f.id === activeFileId.value)
  )

  function addFile(file?: Partial<DiffFile>) {
    const id = String(Date.now())
    const newFile: DiffFile = {
      id,
      leftPath: file?.leftPath || '',
      rightPath: file?.rightPath || '',
      leftContent: file?.leftContent || '',
      rightContent: file?.rightContent || '',
      language:
        file?.language ||
        detectLanguage(file?.leftPath || file?.rightPath || ''),
    }
    files.value.push(newFile)
    activeFileId.value = id
    return newFile
  }

  function removeFile(id: string) {
    const idx = files.value.findIndex((f) => f.id === id)
    if (idx === -1) return
    files.value.splice(idx, 1)
    if (activeFileId.value === id && files.value.length > 0) {
      activeFileId.value = files.value[0].id
    }
  }

  function setActiveFile(id: string) {
    activeFileId.value = id
  }

  function updateFile(id: string, updates: Partial<DiffFile>) {
    const idx = files.value.findIndex((f) => f.id === id)
    if (idx === -1) return
    // Update and move to top
    const updated = { ...files.value[idx], ...updates }
    files.value.splice(idx, 1)
    files.value.unshift(updated)
    activeFileId.value = id
  }

  function swapActiveFile() {
    const f = activeFile.value
    if (!f) return
    const idx = files.value.findIndex(x => x.id === f.id)
    if (idx === -1) return
    const swapped: DiffFile = {
      ...f,
      leftPath: f.rightPath,
      rightPath: f.leftPath,
      leftContent: f.rightContent,
      rightContent: f.leftContent,
    }
    files.value[idx] = swapped
    // Keep in same position, trigger reactivity
    files.value = [...files.value]
    activeFileId.value = f.id
  }

  function handleFileDrop(
    side: 'left' | 'right',
    droppedFiles: { name: string; content: string }[]
  ) {
    for (const dropped of droppedFiles) {
      const emptyFile = files.value.find(
        (f) =>
          (side === 'left' && !f.leftContent) ||
          (side === 'right' && !f.rightContent)
      )

      if (emptyFile) {
        const updates: Partial<DiffFile> = { language: detectLanguage(dropped.name) }
        if (side === 'left') {
          updates.leftContent = dropped.content
          if (!emptyFile.leftPath) updates.leftPath = dropped.name
        } else {
          updates.rightContent = dropped.content
          if (!emptyFile.rightPath) updates.rightPath = dropped.name
        }
        updateFile(emptyFile.id, updates)
      } else {
        addFile({
          leftPath: side === 'left' ? dropped.name : '',
          rightPath: side === 'right' ? dropped.name : '',
          leftContent: side === 'left' ? dropped.content : '',
          rightContent: side === 'right' ? dropped.content : '',
          language: detectLanguage(dropped.name),
        })
      }
    }
  }

  function getShareData(): { files: DiffFile[] } {
    return { files: files.value.filter((f) => f.leftContent || f.rightContent) }
  }

  function loadShareData(data: { files: DiffFile[] }) {
    files.value = data.files.map((f, i) => ({
      ...f,
      id: f.id || String(i + 1),
      language: f.language || detectLanguage(f.leftPath || f.rightPath),
    }))
    if (files.value.length > 0) {
      activeFileId.value = files.value[0].id
    }
  }

  return {
    files,
    activeFileId,
    activeFile,
    addFile,
    removeFile,
    setActiveFile,
    updateFile,
    swapActiveFile,
    handleFileDrop,
    getShareData,
    loadShareData,
  }
}

/**
 * Detect programming language from file extension
 */
function detectLanguage(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase()
  const map: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    vue: 'html',
    svelte: 'html',
    html: 'html',
    css: 'css',
    scss: 'scss',
    less: 'less',
    json: 'json',
    xml: 'xml',
    yaml: 'yaml',
    yml: 'yaml',
    md: 'markdown',
    py: 'python',
    rb: 'ruby',
    go: 'go',
    rs: 'rust',
    java: 'java',
    kt: 'kotlin',
    swift: 'swift',
    c: 'c',
    cpp: 'cpp',
    h: 'c',
    cs: 'csharp',
    php: 'php',
    sql: 'sql',
    sh: 'shell',
    bash: 'shell',
    zsh: 'shell',
    dockerfile: 'dockerfile',
    toml: 'ini',
    ini: 'ini',
  }
  return map[ext || ''] || 'plaintext'
}
