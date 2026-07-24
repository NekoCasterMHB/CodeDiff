<template>
  <div class="flex flex-col h-full group-data-[state=collapsed]/sidebar:hidden">
    <!-- List -->
    <draggable
      v-model="diff.files.value"
      item-key="id"
      :animation="200"
      ghost-class="opacity-50"
      class="flex-1 overflow-y-auto py-1"
      style="scrollbar-width: thin; scrollbar-color: hsl(var(--ui-border)) transparent;"
    >
      <template #item="{ element: file, index: i }">
      <div
        :key="file.id"
        :class="[
          'group/file flex items-center gap-2 mx-2 px-3 py-1 rounded-md cursor-pointer transition-colors text-md relative overflow-hidden',
          diff.activeFileId.value === file.id
            ? 'bg-primary/12 text-primary font-medium'
            : 'hover:bg-muted text-default',
        ]"
        @click="select(file.id)"
      >
        <!-- <UIcon name="i-lucide-grip-vertical" class="w-4 h-4 shrink-0 text-muted/40 hover:text-muted drag-handle cursor-grab active:cursor-grabbing relative z-10 order-0 transition-opacity p-1 -ml-1" /> -->
        <span v-if="hasDiff(file)" class="shrink-0 relative z-10 order-6 inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-warning text-white text-[10px] font-semibold leading-none px-1">{{ file.hunkCount || diffCount(file) }}</span>
        <UButton
          icon="i-lucide-trash-2"
          size="sm"
          variant="ghost"
          color="neutral"
          class="opacity-0 group-hover/file:opacity-100 shrink-0 -mr-1 relative z-20 peer/delete hover:bg-red-500/20 hover:text-red-500 cursor-pointer order-5"
          @click.stop="diff.removeFile(file.id)"
        />
        <UIcon :name="icon(file.language)" class="w-3 h-3 shrink-0 relative z-10 peer-hover/delete:hidden transition-colors duration-300 order-1" :class="diff.activeFileId.value === file.id ? 'text-primary' : 'text-muted'" />
        <UIcon name="i-lucide-file-x-2" class="w-3 h-3 shrink-0 relative z-10 hidden peer-hover/delete:inline-block text-red-500 transition-colors duration-300 order-1" />
        <UTooltip :text="`${file.leftPath || file.rightPath || $t('diffFile.fallbackName', { index: i + 1 })} | ${$t('diffFile.diffCount', { count: file.hunkCount || diffCount(file) })} | ${$t('diffFile.diffLines', { lines: diffLines(file) })}`" :content="{ side: 'bottom' }">
          <span class="flex-1 truncate text-sm relative z-10 peer-hover/delete:line-through peer-hover/delete:text-red-500 transition-colors duration-300 order-2">{{ file.leftPath || file.rightPath || $t('diffFile.fallbackName', { index: i + 1 }) }}</span>
        </UTooltip>
        <!-- Red delete hover background (after button for peer selector) -->
        <div class="absolute inset-0 bg-red-500/20 rounded-md transition-transform duration-300 ease-out translate-x-[120%] peer-hover/delete:translate-x-0 z-0 pointer-events-none" />
      </div>
      </template>
    </draggable>

    <!-- Footer: GitHub link -->
    <div class=" py-0 border-t border-default">
      <UButton
        icon="i-simple-icons-github"
        variant="ghost"
        color="neutral"
        size="lg"
        label="GitHub"
        to="https://github.com/NekoCasterMHB/CodeDiff"
        target="_blank"
        block
        class="py-3 text-md"
      />
    </div>

  </div>
</template>

<script setup lang="ts">
import draggable from 'vuedraggable'

const diff = useDiff()
const emit = defineEmits<{ select: [] }>()

function select(id: string) { diff.setActiveFile(id); emit('select') }
function addAndEmit() { diff.addFile(); emit('select') }
function hasDiff(f: { leftContent: string; rightContent: string }) { return f.leftContent && f.rightContent && f.leftContent !== f.rightContent }
function diffCount(f: { leftContent: string; rightContent: string }): number {
  if (!f.leftContent || !f.rightContent) return 0
  const left = f.leftContent.split('\n')
  const right = f.rightContent.split('\n')
  let blocks = 0
  let inBlock = false
  const max = Math.max(left.length, right.length)
  for (let i = 0; i < max; i++) {
    const diff = left[i] !== right[i]
    if (diff && !inBlock) { blocks++; inBlock = true }
    else if (!diff) { inBlock = false }
  }
  return Math.max(blocks, 1)
}
function diffLines(f: { leftContent: string; rightContent: string }): number {
  if (!f.leftContent || !f.rightContent) return 0
  const left = f.leftContent.split('\n')
  const right = f.rightContent.split('\n')
  const max = Math.max(left.length, right.length)
  let changes = 0
  for (let i = 0; i < max; i++) {
    if (left[i] !== right[i]) changes++
  }
  return Math.max(changes, 1)
}
function icon(lang: string): string {
  const m: Record<string, string> = {
    typescript: 'i-lucide-file-type2', javascript: 'i-lucide-file-type', html: 'i-lucide-file-code',
    css: 'i-lucide-file-css', json: 'i-lucide-file-json', python: 'i-lucide-file-code-2',
    markdown: 'i-lucide-file-text', plaintext: 'i-lucide-file',
  }
  return m[lang] || 'i-lucide-file'
}
</script>
