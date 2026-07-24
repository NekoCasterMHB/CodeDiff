<template>
  <div class="flex flex-1 min-h-0">
    <!-- Sidebar -->
    <USidebar
      v-model:open="open"
      collapsible="icon"
      :transition="false"
      :style="{ '--sidebar-width-icon': '2.5rem' }"
      :ui="{
        gap: 'h-[calc(100%-var(--ui-header-height))]',
        container: 'absolute top-(--ui-header-height) bottom-0 h-[calc(100%-var(--ui-header-height))]',
        body: 'p-0!',
      }"
    >
      <template #header>
        <div class="flex items-center gap-2 w-full min-w-0" :class="open ? '' : 'justify-center'">
          <UIcon
            :name="open ? 'i-lucide-panel-left-close' : 'i-lucide-panel-left-open'"
            class="w-4 h-4 text-muted shrink-0 cursor-pointer hover:text-default transition-colors"
            @click="open = !open"
          />
          <span class="text-sm font-semibold text-highlighted truncate group-data-[state=collapsed]/sidebar:hidden">{{ $t('sidebar.title') }}</span>
          <div class="flex-1" />
          <UButton
            icon="i-lucide-file-plus"
            size="xs"
            variant="ghost"
            color="neutral"
            class="group-data-[state=collapsed]/sidebar:hidden shrink-0"
            @click="() => { diff.addFile() }"
          />
        </div>
      </template>
      <template #default>
        <ClientOnly>
          <DiffFileList />
        </ClientOnly>
      </template>
    </USidebar>

    <!-- Main Content -->
    <div class="flex-1 flex flex-col min-w-0">
      <!-- Toolbar -->
      <div class="flex items-center gap-2 h-10 px-4 border-b border-default bg-elevated shrink-0">
        <UIcon name="i-lucide-file-text" class="w-4 h-4 text-muted shrink-0" />
        <UInput
          :model-value="fileName"
          :placeholder="$t('toolbar.fileName')"
          size="xs"
          class="flex-1 text-xs"
          :ui="{ base: 'px-3 py-1' }"
          @update:model-value="updateFileName"
        />
        <UButton icon="i-lucide-file-plus" size="xs" variant="ghost" color="neutral" @click="() => { diff.addFile() }" />
        <div class="w-px h-4 bg-border" />
        <UButton
          icon="i-lucide-arrow-left-right"
          size="xs"
          variant="ghost"
          color="neutral"
          :disabled="swapping"
          @click="swapLeftRight"
        />
        <div class="w-px h-4 bg-border" />
        <span class="text-xs text-muted shrink-0">{{ $t('toolbar.diffNav') }}</span>
        <div class="flex items-center bg-primary/10 border border-primary/20 rounded-md overflow-hidden">
          <UButton icon="i-lucide-chevron-up" size="xs" variant="ghost" color="neutral" class="hover:bg-primary/30 rounded-none" @click="goPrevDiff" />
          <span class="text-xs text-default min-w-7 text-center font-mono">{{ diffNavText }}</span>
          <UButton icon="i-lucide-chevron-down" size="xs" variant="ghost" color="neutral" class="hover:bg-primary/30 rounded-none" @click="goNextDiff" />
        </div>
      </div>

      <!-- Monaco Editor -->
      <div
        class="flex-1 relative overflow-hidden"
        :class="{ 'editor-swapping': swapping }"
        @dragover.prevent="onDragOver"
        @dragleave="onDragLeave"
        @drop.prevent="onDrop"
      >
        <div v-if="dragging" class="absolute inset-0 z-20 flex items-center justify-center bg-primary/5 border-2 border-dashed border-primary m-2 rounded-lg pointer-events-none">
          <div class="text-center">
            <UIcon name="i-lucide-file-up" class="w-8 h-8 text-primary mx-auto mb-1" />
            <p class="text-xs text-primary">{{ $t('editor.dropHint') }}</p>
          </div>
        </div>

        <!-- Swap animation overlays -->
        <template v-if="swapping">
          <div class="absolute inset-0 z-10 swap-overlays" :class="{ 'swap-fade-out': swapPhase === 2 }">
            <div class="absolute inset-0" style="background-color:var(--ui-bg)"></div>
            <div class="absolute inset-0 flex pointer-events-none">
              <div class="swap-card swap-card-left w-1/2 h-full flex flex-col items-center justify-center gap-2 border-r border-default bg-elevated">
              <UIcon name="i-lucide-file-text" class="w-6 h-6 text-muted shrink-0" />
              <span class="text-xs text-muted font-medium text-center px-2 truncate max-w-full">{{ swapNames.left }}</span>
            </div>
            <div class="swap-card swap-card-right w-1/2 h-full flex flex-col items-center justify-center gap-2 bg-elevated">
              <UIcon name="i-lucide-file-text" class="w-6 h-6 text-muted shrink-0" />
              <span class="text-xs text-muted font-medium text-center px-2 truncate max-w-full">{{ swapNames.right }}</span>
            </div>
          </div>
        </div>
        </template>

        <div class="absolute inset-0" :class="{ 'invisible': swapping }">
          <ClientOnly>
            <MonacoDiffEditor
              v-if="diff.activeFile.value"
              ref="monacoRef"
              :key="editorKey"
              :left-content="diff.activeFile.value.leftContent"
              :right-content="diff.activeFile.value.rightContent"
              :language="diff.activeFile.value.language || 'plaintext'"
              :read-only="false"
              :theme="editorTheme"
              @update:left-content="v => updateFile('leftContent', v)"
              @update:right-content="v => updateFile('rightContent', v)"
              @hunk-count="v => diff.setFileHunkCount(diff.activeFileId.value!, v)"
            />
            <div v-else class="flex items-center justify-center h-full text-muted">
              <div class="text-center">
                <UIcon name="i-lucide-file-code" class="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p class="text-xs">{{ $t('editor.empty') }}</p>
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
    </div>
  </div>
</template>

<script setup lang="ts">
const diff = useDiff()
const colorMode = useColorMode()
const open = useState('sidebar-open', () => true)
const dragging = ref(false)
const monacoRef = ref()
const editorTheme = computed(() => colorMode.preference === 'dark' ? 'vs-dark' : 'vs')
const editorKey = computed(() => String(diff.activeFileId.value))

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

// Swap left/right with slide animation
const swapping = ref(false)
const swapPhase = ref(0) // 0=idle, 1=sliding, 2=fade-out
const swapNames = ref({ left: '', right: '' })
function swapLeftRight() {
  if (swapping.value || !diff.activeFile.value) return
  // Capture pre-swap names and swap data immediately
  const f = diff.activeFile.value
  swapNames.value = {
    left: f.leftPath || 'Original',
    right: f.rightPath || 'Modified',
  }
  diff.swapActiveFile()
  // Start slide animation
  swapping.value = true
  swapPhase.value = 1
  // After slide, start fade-out
  setTimeout(() => {
    swapPhase.value = 2
  }, 600)
  // After fade-out, hide overlays
  setTimeout(() => {
    swapping.value = false
    swapPhase.value = 0
  }, 900)
}

// Diff navigation
const diffNavText = ref('')
function goNextDiff() { monacoRef.value?.getDiffEditor()?.goToDiff('next'); updateNav() }
function goPrevDiff() { monacoRef.value?.getDiffEditor()?.goToDiff('previous'); updateNav() }
function updateNav() {
  const de = monacoRef.value?.getDiffEditor()
  if (!de) { setTimeout(updateNav, 200); return }
  const changes = de.getLineChanges()
  if (!changes) { setTimeout(updateNav, 200); return }
  if (!changes.length) { diffNavText.value = '0/0'; return }
  const pos = de.getModifiedEditor()?.getPosition()
  if (!pos) { diffNavText.value = `0/${changes.length}`; return }
  let idx = 0
  for (let i = 0; i < changes.length; i++) {
    if (changes[i].modifiedStartLineNumber > pos.lineNumber) break
    idx = i + 1
  }
  diffNavText.value = `${idx}/${changes.length}`
}
let navTimer: ReturnType<typeof setTimeout> | null = null
watch(() => [diff.activeFileId.value, diff.activeFile.value?.leftContent, diff.activeFile.value?.rightContent], () => {
  if (navTimer) clearTimeout(navTimer)
  navTimer = setTimeout(updateNav, 300)
})

// Drag & Drop
function onDragOver(e: DragEvent) {
  e.dataTransfer!.dropEffect = 'copy'
  if (!dragging.value) dragging.value = true
}
function onDragLeave(e: DragEvent) {
  // Only hide overlay when leaving the container (not entering a child)
  if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) {
    dragging.value = false
  }
}
async function onDrop(e: DragEvent) {
  dragging.value = false
  const target = e.currentTarget as HTMLElement | null
  const dtFiles = e.dataTransfer?.files
  if (!target || !dtFiles?.length) return
  const list: { name: string; content: string }[] = []
  for (const f of dtFiles) {
    if (f.type === '' && f.size === 0) continue
    list.push({ name: f.name, content: await f.text() })
  }
  if (!list.length) return
  const rect = target.getBoundingClientRect()
  const side: 'left' | 'right' = (e.clientX - rect.left) / rect.width < 0.5 ? 'left' : 'right'
  diff.handleFileDrop(side, list)
}

// Auto-migrate old history items and fileIds on page load
const { load: loadShareHistory, migrateMissingFields } = useShareHistory()
onMounted(async () => {
  await loadShareHistory()
  await migrateMissingFields(diff.files.value)
})
</script>

<style scoped>
@keyframes slide-right {
  from { transform: translateX(0); }
  to   { transform: translateX(100%); }
}

@keyframes slide-left {
  from { transform: translateX(0); }
  to   { transform: translateX(-100%); }
}

.editor-swapping .swap-card-left {
  animation: slide-right 0.6s ease-in-out forwards;
}

.editor-swapping .swap-card-right {
  animation: slide-left 0.6s ease-in-out forwards;
}

.swap-overlays {
  transition: opacity 0.3s ease-out;
}

.swap-overlays.swap-fade-out {
  opacity: 0;
}
</style>
