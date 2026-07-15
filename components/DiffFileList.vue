<template>
  <div class="flex flex-col h-full">
    <!-- File List -->
    <div class="flex-1 overflow-y-auto -mx-2 space-y-0.5">
      <div
        v-for="(file, index) in diff.files.value"
        :key="file.id"
        :class="[
          'group flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer transition-colors text-sm mx-2',
          diff.activeFileId.value === file.id
            ? 'bg-primary/15 text-primary font-medium'
            : 'hover:bg-muted text-default',
        ]"
        @click="selectFile(file.id)"
      >
        <!-- File Icon -->
        <UIcon :name="getIcon(file.language)" class="w-4 h-4 shrink-0 text-muted" />

        <!-- File Name -->
        <div class="flex-1 min-w-0">
          <input
            v-if="editingId === file.id"
            ref="editInputRef"
            v-model="editName"
            class="w-full bg-transparent border-b border-primary outline-none text-sm"
            @blur="doneEdit(file)"
            @keydown.enter="doneEdit(file)"
            @keydown.escape="editingId = null"
          />
          <span v-else class="block truncate" @dblclick="startEdit(file)">
            {{ file.leftPath || file.rightPath || `文件 ${index + 1}` }}
          </span>
        </div>

        <!-- Diff status dot -->
        <span
          v-if="file.leftContent && file.rightContent"
          :class="[
            'w-2 h-2 rounded-full shrink-0',
            file.leftContent !== file.rightContent ? 'bg-warning' : 'bg-success',
          ]"
        />

        <!-- Delete -->
        <UButton
          icon="i-lucide-trash-2"
          size="2xs"
          variant="ghost"
          color="neutral"
          class="opacity-0 group-hover:opacity-100 shrink-0 hover:text-error"
          @click.stop="diff.removeFile(file.id)"
        />
      </div>
    </div>

    <!-- Footer -->
    <div class="pt-2 border-t border-border mt-2">
      <UButton block variant="ghost" size="sm" icon="i-lucide-file-plus" @click="diff.addFile()">
        添加文件
      </UButton>
    </div>
  </div>
</template>

<script setup lang="ts">
const diff = useDiff()
const editingId = ref<string | null>(null)
const editName = ref('')
const editInputRef = ref()

function selectFile(id: string) {
  diff.setActiveFile(id)
}

function getIcon(lang: string): string {
  const m: Record<string, string> = {
    typescript: 'i-lucide-file-type2', javascript: 'i-lucide-file-type',
    html: 'i-lucide-file-code', css: 'i-lucide-file-css', json: 'i-lucide-file-json',
    python: 'i-lucide-file-code-2', markdown: 'i-lucide-file-text', plaintext: 'i-lucide-file',
  }
  return m[lang] || 'i-lucide-file'
}

function startEdit(file: { id: string; leftPath: string; rightPath: string }) {
  editingId.value = file.id
  editName.value = file.leftPath || file.rightPath
  nextTick(() => editInputRef.value?.focus())
}

function doneEdit(file: { id: string }) {
  if (editingId.value) {
    diff.updateFile(file.id, { leftPath: editName.value, rightPath: editName.value })
  }
  editingId.value = null
}
</script>
