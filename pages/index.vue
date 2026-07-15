<template>
  <div
    class="h-full overflow-hidden relative"
    @dragover.prevent="handleDragOver"
    @dragleave="handleDragLeave"
    @drop.prevent="handleDrop"
  >
    <!-- Drag/Drop Overlay -->
    <div
      v-if="isDragging"
      class="absolute inset-0 z-20 flex items-center justify-center bg-primary/10 border-2 border-dashed border-primary m-2 rounded-lg pointer-events-none"
    >
      <div class="text-center">
        <UIcon name="i-lucide-file-up" class="w-10 h-10 text-primary mx-auto mb-2" />
        <p class="text-sm font-medium text-primary">释放文件以上传</p>
      </div>
    </div>

    <!-- Monaco Diff Editor -->
    <ClientOnly>
      <MonacoDiffEditor
        v-if="diff.activeFile.value"
        :key="diff.activeFileId.value"
        :left-content="diff.activeFile.value.leftContent"
        :right-content="diff.activeFile.value.rightContent"
        :language="diff.activeFile.value.language || 'plaintext'"
        :read-only="false"
        :theme="editorTheme"
        @update:left-content="onLeftUpdate"
        @update:right-content="onRightUpdate"
      />
      <div v-else class="flex items-center justify-center h-full text-muted">
        <div class="text-center">
          <UIcon name="i-lucide-file-code" class="w-10 h-10 mx-auto mb-2 opacity-40" />
          <p class="text-sm">拖拽文件到此处或点击左侧菜单添加文件</p>
        </div>
      </div>
      <template #fallback>
        <div class="flex items-center justify-center h-full">
          <UIcon name="i-lucide-loader-circle" class="w-6 h-6 animate-spin text-muted" />
        </div>
      </template>
    </ClientOnly>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })

const diff = useDiff()
const colorMode = useColorMode()
const isDragging = ref(false)

const editorTheme = computed(() =>
  colorMode.preference === 'dark' ? 'vs-dark' : 'vs'
)

function onLeftUpdate(v: string) {
  const f = diff.activeFile.value
  if (f) diff.updateFile(f.id, { leftContent: v })
}
function onRightUpdate(v: string) {
  const f = diff.activeFile.value
  if (f) diff.updateFile(f.id, { rightContent: v })
}

// ── Drag & Drop ──
let dragCounter = 0

function handleDragOver(e: DragEvent) {
  e.dataTransfer!.dropEffect = 'copy'
  isDragging.value = true
}

function handleDragLeave() {
  dragCounter--
  if (dragCounter <= 0) { isDragging.value = false; dragCounter = 0 }
}

async function handleDrop(e: DragEvent) {
  isDragging.value = false
  dragCounter = 0
  const dtFiles = e.dataTransfer?.files
  if (!dtFiles?.length) return

  const fileList: { name: string; content: string }[] = []
  for (const f of dtFiles) {
    if (f.type === '' && f.size === 0) continue
    fileList.push({ name: f.name, content: await f.text() })
  }
  if (!fileList.length) return

  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  const side: 'left' | 'right' = (e.clientX - rect.left) / rect.width < 0.5 ? 'left' : 'right'
  diff.handleFileDrop(side, fileList)
}
</script>
