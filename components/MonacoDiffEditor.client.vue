<template>
  <div ref="containerRef" class="monaco-diff-editor" />
</template>

<script setup lang="ts">
import * as monaco from 'monaco-editor'
import { initMonacoWorkers } from '~/utils/monaco-setup'

const props = withDefaults(
  defineProps<{
    leftContent: string
    rightContent: string
    language?: string
    readOnly?: boolean
    theme?: string
  }>(),
  {
    language: 'plaintext',
    readOnly: false,
    theme: 'vs-dark',
  }
)

const emit = defineEmits<{
  'update:leftContent': [value: string]
  'update:rightContent': [value: string]
  hunkCount: [count: number]
}>()

const containerRef = ref<HTMLDivElement>()
let diffEditor: monaco.editor.IStandaloneDiffEditor | null = null
let originalModel: monaco.editor.ITextModel | null = null
let modifiedModel: monaco.editor.ITextModel | null = null
const disposables: monaco.IDisposable[] = []

function getLang(l: string): string {
  const m: Record<string, string> = {
    typescript: 'typescript', javascript: 'javascript', html: 'html',
    css: 'css', scss: 'scss', less: 'less', json: 'json', xml: 'xml',
    yaml: 'yaml', markdown: 'markdown', python: 'python', ruby: 'ruby',
    go: 'go', rust: 'rust', java: 'java', kotlin: 'kotlin', swift: 'swift',
    c: 'c', cpp: 'cpp', csharp: 'csharp', php: 'php', sql: 'sql',
    shell: 'shell', dockerfile: 'dockerfile', ini: 'ini', plaintext: 'plaintext',
  }
  return m[l] || 'plaintext'
}

function cleanup() {
  for (const d of disposables) d.dispose()
  disposables.length = 0
  diffEditor?.dispose()
  diffEditor = null
  originalModel?.dispose()
  originalModel = null
  modifiedModel?.dispose()
  modifiedModel = null
}

function create() {
  if (!containerRef.value) return
  initMonacoWorkers()
  cleanup()

  const lang = getLang(props.language)
  originalModel = monaco.editor.createModel(props.leftContent, lang)
  modifiedModel = monaco.editor.createModel(props.rightContent, lang)

  diffEditor = monaco.editor.createDiffEditor(containerRef.value, {
    theme: props.theme,
    readOnly: props.readOnly,
    originalEditable: !props.readOnly,
    renderSideBySide: true,
    useInlineViewWhenSpaceIsLimited: false,
    enableSplitViewResizing: true,
    renderOverviewRuler: true,
    contextmenu: false,
    minimap: { enabled: true ,
      renderCharacters: true,
      maxColumn: 80,
    },
    scrollBeyondLastLine: false,
    lineNumbers: 'on',
    lineNumbersMinChars: 4,
    automaticLayout: true,
    fontSize: 14,
    fontFamily: "'JetBrains Mono', 'Cascadia Code', 'Fira Code', 'Consolas', monospace",
    padding: { top: 12, bottom: 12 },
    wordWrap: 'off',
    glyphMargin: false,
    folding: true,
    lineDecorationsWidth: 0,
    renderIndicators: true,
  })

  diffEditor.setModel({ original: originalModel, modified: modifiedModel })

  // Emit hunk count so the file list badge matches Monaco's diff count
  diffEditor.onDidUpdateDiff(() => {
    const changes = diffEditor?.getLineChanges()
    if (changes) emit('hunkCount', changes.length)
  })

  // Auto-reveal the first diff once rendered
  setTimeout(() => diffEditor?.revealFirstDiff(), 100)

  // Highlight current diff position with yellow box
  let currentHunkDecoMod: string[] = []
  let currentHunkDecoOrig: string[] = []
  function updateCurrentHunkHighlight() {
    const modEd = diffEditor!.getModifiedEditor()
    const origEd = diffEditor!.getOriginalEditor()
    const focusedEditor = modEd.hasTextFocus() ? modEd : origEd
    const pos = focusedEditor.getPosition()
    if (!pos) {
      currentHunkDecoMod = modEd.deltaDecorations(currentHunkDecoMod, [])
      currentHunkDecoOrig = origEd.deltaDecorations(currentHunkDecoOrig, [])
      return
    }
    const changes = diffEditor!.getLineChanges()
    if (!changes) {
      currentHunkDecoMod = modEd.deltaDecorations(currentHunkDecoMod, [])
      currentHunkDecoOrig = origEd.deltaDecorations(currentHunkDecoOrig, [])
      return
    }
    const decoOpt = (className: string) => ({ className, isWholeLine: true })
    for (const c of changes) {
      const ms = c.modifiedStartLineNumber
      const me = c.modifiedEndLineNumber ?? ms
      const os = c.originalStartLineNumber ?? 1
      const oe = c.originalEndLineNumber ?? os
      if ((pos.lineNumber >= ms && pos.lineNumber <= me) || (pos.lineNumber >= os && pos.lineNumber <= oe)) {
        currentHunkDecoMod = modEd.deltaDecorations(currentHunkDecoMod, [{
          range: new monaco.Range(Math.max(ms, 1), 1, Math.max(me, ms, 1) + 1, 1),
          options: decoOpt('current-diff-hunk'),
        }])
        currentHunkDecoOrig = origEd.deltaDecorations(currentHunkDecoOrig, [{
          range: new monaco.Range(Math.max(os, 1), 1, Math.max(oe, os, 1) + 1, 1),
          options: decoOpt('current-diff-hunk'),
        }])
        return
      }
    }
    currentHunkDecoMod = modEd.deltaDecorations(currentHunkDecoMod, [])
    currentHunkDecoOrig = origEd.deltaDecorations(currentHunkDecoOrig, [])
  }
  diffEditor!.getModifiedEditor().onDidChangeCursorPosition(() => updateCurrentHunkHighlight())
  diffEditor!.getOriginalEditor().onDidChangeCursorPosition(() => updateCurrentHunkHighlight())
  diffEditor!.getModifiedEditor().onDidFocusEditorText(() => updateCurrentHunkHighlight())
  diffEditor!.getOriginalEditor().onDidFocusEditorText(() => updateCurrentHunkHighlight())
  setTimeout(updateCurrentHunkHighlight, 600)

  if (!props.readOnly) {
    let leftTimer: ReturnType<typeof setTimeout> | null = null
    let rightTimer: ReturnType<typeof setTimeout> | null = null
    disposables.push(
      originalModel.onDidChangeContent(() => {
        if (leftTimer) clearTimeout(leftTimer)
        leftTimer = setTimeout(() => { leftTimer = null; emit('update:leftContent', originalModel!.getValue()) }, 200)
      }),
      modifiedModel.onDidChangeContent(() => {
        if (rightTimer) clearTimeout(rightTimer)
        rightTimer = setTimeout(() => { rightTimer = null; emit('update:rightContent', modifiedModel!.getValue()) }, 200)
      })
    )
  }
}

let syncTimer: ReturnType<typeof setTimeout> | null = null
function sync() {
  if (!originalModel || !modifiedModel || !diffEditor) return
  const lang = getLang(props.language)
  const origEd = diffEditor.getOriginalEditor()
  const modEd = diffEditor.getModifiedEditor()
  if (!origEd.hasTextFocus() && originalModel.getValue() !== props.leftContent) {
    originalModel.setValue(props.leftContent)
  }
  if (!modEd.hasTextFocus() && modifiedModel.getValue() !== props.rightContent) {
    modifiedModel.setValue(props.rightContent)
  }
  monaco.editor.setModelLanguage(originalModel, lang)
  monaco.editor.setModelLanguage(modifiedModel, lang)
}

watch(() => [props.leftContent, props.rightContent, props.language], () => {
  if (syncTimer) clearTimeout(syncTimer)
  syncTimer = setTimeout(sync, 150)
})
watch(() => props.theme, () => monaco.editor.setTheme(props.theme))

onMounted(() => nextTick(create))
onUnmounted(cleanup)

defineExpose({ getDiffEditor: () => diffEditor })
</script>

<style>
/* Monaco Editor overrides — must be unscoped to penetrate Shadow DOM */
.monaco-diff-editor {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
}

/* Line numbers: muted green */
.monaco-diff-editor .line-numbers {
  color: #009688 !important;
}
.vs-dark .monaco-diff-editor .line-numbers {
  color: #009688 !important;
}

/* Gutter: add right padding for gap between line number and code */
.monaco-diff-editor .margin-view-overlays .line-numbers {
  padding-right: 12px !important;
}

/* Current diff position highlight */
.current-diff-hunk {
  border-left: 3px solid #ffc107 !important;
  background: rgba(255, 193, 7, 0.08) !important;
}
</style>
