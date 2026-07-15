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
}>()

const containerRef = ref<HTMLDivElement>()
let diffEditor: monaco.editor.IStandaloneDiffEditor | null = null
let originalModel: monaco.editor.ITextModel | null = null
let modifiedModel: monaco.editor.ITextModel | null = null
let resizeObserver: ResizeObserver | null = null
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
  resizeObserver?.disconnect()
  resizeObserver = null
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
    enableSplitViewResizing: true,
    renderOverviewRuler: true,
    minimap: { enabled: false },
    scrollBeyondLastLine: false,
    lineNumbers: 'on',
    automaticLayout: true,
    fontSize: 14,
    fontFamily: "'JetBrains Mono', 'Cascadia Code', 'Fira Code', 'Consolas', monospace",
    padding: { top: 12, bottom: 12 },
    wordWrap: 'off',
    glyphMargin: true,
    folding: true,
    lineDecorationsWidth: 10,
    renderIndicators: true,
  })

  diffEditor.setModel({ original: originalModel, modified: modifiedModel })

  if (!props.readOnly) {
    disposables.push(
      originalModel.onDidChangeContent(() => emit('update:leftContent', originalModel!.getValue())),
      modifiedModel.onDidChangeContent(() => emit('update:rightContent', modifiedModel!.getValue()))
    )
  }
}

function sync() {
  if (!originalModel || !modifiedModel) return
  const lang = getLang(props.language)
  if (originalModel.getValue() !== props.leftContent) originalModel.setValue(props.leftContent)
  if (modifiedModel.getValue() !== props.rightContent) modifiedModel.setValue(props.rightContent)
  monaco.editor.setModelLanguage(originalModel, lang)
  monaco.editor.setModelLanguage(modifiedModel, lang)
}

watch(() => [props.leftContent, props.rightContent, props.language], sync)
watch(() => props.theme, () => monaco.editor.setTheme(props.theme))

onMounted(() => nextTick(create))
onUnmounted(cleanup)

defineExpose({ getDiffEditor: () => diffEditor })
</script>

<style scoped>
.monaco-diff-editor {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
}
</style>
