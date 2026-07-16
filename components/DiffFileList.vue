<template>
  <div class="flex flex-col h-full">
    <!-- Header -->
    <div class="flex items-center justify-between px-3 py-2.5 border-b border-border">
      <span class="text-xs font-semibold text-muted uppercase tracking-wider">文件</span>
      <UButton icon="i-lucide-plus" size="2xs" variant="ghost" color="neutral" @click="addAndEmit" />
    </div>

    <!-- List -->
    <div class="flex-1 overflow-y-auto py-1">
      <div
        v-for="(file, i) in diff.files.value"
        :key="file.id"
        :class="[
          'group flex items-center gap-2 mx-1.5 px-2.5 py-2 rounded-md cursor-pointer transition-colors text-sm',
          diff.activeFileId.value === file.id
            ? 'bg-primary/12 text-primary font-medium'
            : 'hover:bg-muted text-default',
        ]"
        @click="select(file.id)"
      >
        <UIcon :name="icon(file.language)" class="w-4 h-4 shrink-0" :class="diff.activeFileId.value === file.id ? 'text-primary' : 'text-muted'" />
        <span class="flex-1 truncate text-xs">{{ file.leftPath || file.rightPath || `文件 ${i + 1}` }}</span>
        <span v-if="hasDiff(file)" class="w-1.5 h-1.5 rounded-full bg-warning shrink-0" />
        <UButton
          icon="i-lucide-x"
          size="2xs"
          variant="ghost"
          color="neutral"
          class="opacity-0 group-hover:opacity-100 shrink-0 -mr-1"
          @click.stop="diff.removeFile(file.id)"
        />
      </div>
    </div>

    <!-- Footer -->
    <div class="px-2 py-2 border-t border-border">
      <UButton block variant="ghost" size="xs" icon="i-lucide-file-plus" @click="addAndEmit">
        添加文件
      </UButton>
    </div>
  </div>
</template>

<script setup lang="ts">
const diff = useDiff()
const emit = defineEmits<{ select: [] }>()

function select(id: string) { diff.setActiveFile(id); emit('select') }
function addAndEmit() { diff.addFile(); emit('select') }
function hasDiff(f: { leftContent: string; rightContent: string }) { return f.leftContent && f.rightContent && f.leftContent !== f.rightContent }
function icon(lang: string): string {
  const m: Record<string, string> = {
    typescript: 'i-lucide-file-type2', javascript: 'i-lucide-file-type', html: 'i-lucide-file-code',
    css: 'i-lucide-file-css', json: 'i-lucide-file-json', python: 'i-lucide-file-code-2',
    markdown: 'i-lucide-file-text', plaintext: 'i-lucide-file',
  }
  return m[lang] || 'i-lucide-file'
}
</script>
