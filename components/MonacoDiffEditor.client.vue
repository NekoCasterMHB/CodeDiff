<template>
  <div ref="containerRef" class="monaco-diff-editor" />
</template>

<script setup lang="ts">
import { initMonacoEnvironment } from '~/utils/monaco-setup'

type MonacoType = typeof import('monaco-editor')

const props = withDefaults(
  defineProps<{
    leftContent: string
    rightContent: string
    language?: string
    readOnly?: boolean
    theme?: string
    lang?: string
  }>(),
  {
    language: 'plaintext',
    readOnly: false,
    theme: 'vs-dark',
    lang: 'ja',
  }
)

const emit = defineEmits<{
  'update:leftContent': [value: string]
  'update:rightContent': [value: string]
}>()

const containerRef = ref<HTMLDivElement>()
let monaco: MonacoType | null = null
let diffEditor: import('monaco-editor').editor.IStandaloneDiffEditor | null = null
let originalModel: import('monaco-editor').editor.ITextModel | null = null
let modifiedModel: import('monaco-editor').editor.ITextModel | null = null
const disposables: (import('monaco-editor').IDisposable)[] = []

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
  monaco = null
}

async function create() {
  if (!containerRef.value) return

  cleanup()

  // 1. Initialize VS Code API layer with locale (loads language pack + workers)
  await initMonacoEnvironment(props.lang)

  // 2. Dynamically import monaco-editor (aliased to @codingame/monaco-vscode-editor-api)
  monaco = await import('monaco-editor')

  // 3. Create editor
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
    minimap: { enabled: false },
    scrollBeyondLastLine: false,
    lineNumbers: 'on',
    lineNumbersMinChars: 4,
    automaticLayout: true,
    fontSize: 14,
    fontFamily: "'JetBrains Mono', 'Cascadia Code', 'Fira Code', 'Consolas', monospace",
    padding: { top: 12, bottom: 12 },
    wordWrap: 'off',
    glyphMargin: false,
    folding: false,
    lineDecorationsWidth: 0,
    renderIndicators: false,
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
  monaco!.editor.setModelLanguage(originalModel, lang)
  monaco!.editor.setModelLanguage(modifiedModel, lang)
}

watch(() => [props.leftContent, props.rightContent, props.language], sync)
watch(() => props.theme, () => monaco?.editor.setTheme(props.theme))

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
</style>
