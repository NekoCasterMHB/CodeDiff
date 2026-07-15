import type { DiffFile } from '~/types/diff'

/**
 * Global diff state managed via useState (survives page navigation)
 */
export function useDiff() {
  const files = useState<DiffFile[]>('diff-files', () => [
    {
      id: '1',
      leftPath: '',
      rightPath: '',
      leftContent: '',
      rightContent: '',
      language: 'plaintext',
    },
  ])

  const activeFileId = useState<string>('diff-active-file', () => '1')

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
    const file = files.value.find((f) => f.id === id)
    if (file) {
      Object.assign(file, updates)
    }
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
        if (side === 'left') {
          emptyFile.leftContent = dropped.content
          if (!emptyFile.leftPath) emptyFile.leftPath = dropped.name
        } else {
          emptyFile.rightContent = dropped.content
          if (!emptyFile.rightPath) emptyFile.rightPath = dropped.name
        }
        emptyFile.language = detectLanguage(dropped.name)
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
