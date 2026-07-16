<template>
  <div class="h-full flex">
    <!-- Left Sidebar: File List -->
    <aside
      :class="[
        'flex flex-col border-r border-border bg-elevated shrink-0 transition-all duration-200',
        collapsed ? 'w-0 overflow-hidden border-r-0' : 'w-56',
      ]"
    >
      <DiffFileList @select="collapsed = false" />
    </aside>

    <!-- Toggle Button -->
    <button
      class="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-5 h-12 bg-elevated border border-border rounded-r-md flex items-center justify-center hover:bg-muted transition-colors"
      :class="collapsed ? 'left-0' : 'left-56'"
      @click="collapsed = !collapsed"
    >
      <UIcon
        :name="collapsed ? 'i-lucide-chevron-right' : 'i-lucide-chevron-left'"
        class="w-3 h-3 text-muted"
      />
    </button>

    <!-- Right: Toolbar + Editor -->
    <div class="flex-1 flex flex-col min-w-0">
      <!-- Toolbar -->
      <div class="flex items-center gap-2 h-10 px-3 border-b border-border bg-elevated shrink-0">
        <!-- File name -->
        <UInput
          :model-value="fileName"
          placeholder="文件名（如 app.ts）"
          size="2xs"
          class="w-48"
          @update:model-value="updateFileName"
        />

        <div class="flex-1" />

        <!-- Add file -->
        <UButton icon="i-lucide-file-plus" size="2xs" variant="ghost" color="neutral" @click="diff.addFile()" />

        <!-- Separator -->
        <div class="w-px h-4 bg-border" />

        <!-- Diff navigation -->
        <div class="flex items-center gap-0.5">
          <UButton icon="i-lucide-chevron-up" size="2xs" variant="ghost" color="neutral" @click="goPrevDiff" />
          <span class="text-xs text-muted min-w-8 text-center">{{ diffNavText }}</span>
          <UButton icon="i-lucide-chevron-down" size="2xs" variant="ghost" color="neutral" @click="goNextDiff" />
        </div>

        <!-- Separator -->
        <div class="w-px h-4 bg-border" />

        <!-- Share -->
        <UButton icon="i-lucide-share-2" size="2xs" variant="soft" @click="shareOpen = true">
          分享
        </UButton>
      </div>

      <!-- Monaco Editor -->
      <div
        class="flex-1 relative overflow-hidden"
        @dragover.prevent="onDragOver"
        @dragleave="onDragLeave"
        @drop.prevent="onDrop"
      >
        <div
          v-if="dragging"
          class="absolute inset-0 z-20 flex items-center justify-center bg-primary/5 border-2 border-dashed border-primary m-2 rounded-lg pointer-events-none"
        >
          <div class="text-center">
            <UIcon name="i-lucide-file-up" class="w-8 h-8 text-primary mx-auto mb-1" />
            <p class="text-xs text-primary">释放文件以上传</p>
          </div>
        </div>

        <ClientOnly>
          <MonacoDiffEditor
            v-if="diff.activeFile.value"
            ref="monacoRef"
            :key="diff.activeFileId.value"
            :left-content="diff.activeFile.value.leftContent"
            :right-content="diff.activeFile.value.rightContent"
            :language="diff.activeFile.value.language || 'plaintext'"
            :read-only="false"
            :theme="editorTheme"
            @update:left-content="v => updateFile('leftContent', v)"
            @update:right-content="v => updateFile('rightContent', v)"
          />
          <div v-else class="flex items-center justify-center h-full text-muted">
            <div class="text-center">
              <UIcon name="i-lucide-file-code" class="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p class="text-xs">点击左侧「添加文件」或拖拽文件到此处</p>
            </div>
          </div>
          <template #fallback>
            <div class="flex items-center justify-center h-full">
              <UIcon name="i-lucide-loader-circle" class="w-5 h-5 animate-spin text-muted" />
            </div>
          </template>
        </ClientOnly>
      </div>
    </div>

    <!-- Share Dialog -->
    <ShareDialog v-model:open="shareOpen" />
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })

const diff = useDiff()
const colorMode = useColorMode()
const collapsed = ref(false)
const shareOpen = ref(false)
const dragging = ref(false)
const monacoRef = ref()
const editorTheme = computed(() => colorMode.preference === 'dark' ? 'vs-dark' : 'vs')

// ── File name ──
const fileName = computed(() => {
  const f = diff.activeFile.value
  return f ? (f.leftPath || f.rightPath || '') : ''
})
function updateFileName(v: string) {
  const f = diff.activeFile.value
  if (f) diff.updateFile(f.id, { leftPath: v, rightPath: v })
}
function updateFile(key: 'leftContent' | 'rightContent', v: string) {
  const f = diff.activeFile.value
  if (f) diff.updateFile(f.id, { [key]: v })
}

// ── Diff navigation ──
const diffNavText = ref('')
function goNextDiff() {
  const de = monacoRef.value?.getDiffEditor()
  if (!de) return
  de.goToDiff('next')
  updateDiffNav()
}
function goPrevDiff() {
  const de = monacoRef.value?.getDiffEditor()
  if (!de) return
  de.goToDiff('previous')
  updateDiffNav()
}
function updateDiffNav() {
  const de = monacoRef.value?.getDiffEditor()
  if (!de) return
  const changes = de.getLineChanges()
  if (!changes?.length) { diffNavText.value = '0/0'; return }
  // Get current position
  const modified = de.getModifiedEditor()
  const pos = modified?.getPosition()
  if (!pos) { diffNavText.value = `0/${changes.length}`; return }
  // Find current diff index
  let idx = 0
  for (let i = 0; i < changes.length; i++) {
    if (changes[i].modifiedStartLineNumber > pos.lineNumber) break
    idx = i + 1
  }
  diffNavText.value = `${idx}/${changes.length}`
}

// Refresh nav text on model change (debounced to avoid loop)
let navTimer: ReturnType<typeof setTimeout> | null = null
watch(() => diff.activeFileId.value, () => {
  if (navTimer) clearTimeout(navTimer)
  navTimer = setTimeout(updateDiffNav, 300)
})

// ── Drag & Drop ──
let dragCounter = 0
function onDragOver(e: DragEvent) { e.dataTransfer!.dropEffect = 'copy'; dragging.value = true }
function onDragLeave() { dragCounter--; if (dragCounter <= 0) { dragging.value = false; dragCounter = 0 } }
async function onDrop(e: DragEvent) {
  dragging.value = false; dragCounter = 0
  const dtFiles = e.dataTransfer?.files
  if (!dtFiles?.length) return
  const list: { name: string; content: string }[] = []
  for (const f of dtFiles) {
    if (f.type === '' && f.size === 0) continue
    list.push({ name: f.name, content: await f.text() })
  }
  if (!list.length) return
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  const side: 'left' | 'right' = (e.clientX - rect.left) / rect.width < 0.5 ? 'left' : 'right'
  diff.handleFileDrop(side, list)
}
</script>
