<template>
  <div class="h-screen flex flex-col bg-background">
    <!-- Top Navigation Bar -->
    <nav class="flex items-center h-12 px-3 border-b border-border bg-elevated shrink-0 gap-3">
      <!-- Left: Drawer Toggle + Logo -->
      <div class="flex items-center gap-2">
        <UButton
          icon="i-lucide-panel-left"
          size="sm"
          variant="ghost"
          color="neutral"
          @click="drawerOpen = !drawerOpen"
        />
        <div class="flex items-center gap-1.5">
          <div class="w-6 h-6 rounded-md bg-primary flex items-center justify-center">
            <UIcon name="i-lucide-git-compare-arrows" class="w-3.5 h-3.5 text-primary-foreground" />
          </div>
          <span class="text-sm font-bold text-default hidden sm:inline">CodeDiff</span>
        </div>
      </div>

      <!-- Center: File Name Input -->
      <div class="flex-1 flex justify-center">
        <UInput
          :model-value="currentFileName"
          placeholder="输入文件名（如 app.ts）..."
          size="xs"
          class="max-w-md w-full"
          @update:model-value="updateFileName"
        />
      </div>

      <!-- Right: Actions -->
      <div class="flex items-center gap-1">
        <UButton
          icon="i-lucide-sun-moon"
          size="sm"
          variant="ghost"
          color="neutral"
          @click="toggleTheme"
        />
        <UButton
          v-if="showShare"
          icon="i-lucide-share-2"
          size="sm"
          @click="shareOpen = true"
        >
          分享
        </UButton>
        <UButton
          v-if="showNewDiff"
          icon="i-lucide-plus"
          size="sm"
          variant="soft"
          @click="navigateTo('/')"
        >
          新建
        </UButton>
      </div>
    </nav>

    <!-- Page Content -->
    <div class="flex-1 min-h-0">
      <slot />
    </div>

    <!-- Drawer: File List -->
    <USlideover v-model:open="drawerOpen" title="文件列表" side="left">
      <template #body>
        <DiffFileList />
      </template>
    </USlideover>

    <!-- Share Dialog -->
    <ShareDialog v-model:open="shareOpen" />
  </div>
</template>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    showShare?: boolean
    showNewDiff?: boolean
  }>(),
  {
    showShare: true,
    showNewDiff: false,
  }
)

const diff = useDiff()
const colorMode = useColorMode()
const drawerOpen = ref(false)
const shareOpen = ref(false)

const currentFileName = computed(() => {
  const f = diff.activeFile.value
  return f ? (f.leftPath || f.rightPath || '') : ''
})

function updateFileName(value: string) {
  const f = diff.activeFile.value
  if (f) diff.updateFile(f.id, { leftPath: value, rightPath: value })
}

function toggleTheme() {
  colorMode.preference = colorMode.preference === 'dark' ? 'light' : 'dark'
}
</script>
