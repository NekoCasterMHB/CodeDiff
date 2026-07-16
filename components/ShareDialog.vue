<template>
  <UModal v-model:open="open" :title="$t('share.title')">
    <template #body>
      <div class="space-y-4">
        <!-- File Selection -->
        <div class="space-y-1.5">
          <label class="text-xs font-medium text-default">{{ $t('share.selectFiles') }}</label>
          <div class="border border-(--ui-border) rounded-lg divide-y divide-(--ui-border) max-h-48 overflow-y-auto">
            <label
              v-for="f in filesWithContent"
              :key="f.id"
              class="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-(--ui-bg-elevated) transition-colors"
            >
              <UCheckbox :model-value="selectedIds.has(f.id)" @update:model-value="toggle(f.id)" />
              <UIcon :name="fileIcon(f.language)" class="w-3.5 h-3.5 text-(--ui-text-muted) shrink-0" />
              <span class="text-xs truncate">{{ f.leftPath || f.rightPath || $t('diffFile.fallbackName', { index: 1 }) }}</span>
              <span v-if="f.leftContent !== f.rightContent" class="w-1.5 h-1.5 rounded-full bg-(--ui-warning) shrink-0 ml-auto" />
            </label>
            <div v-if="!filesWithContent.length" class="px-3 py-4 text-center text-xs text-(--ui-text-muted)">
              {{ $t('share.noFiles') }}
            </div>
          </div>
          <div class="flex items-center gap-2">
            <UButton size="2xs" variant="ghost" class="!text-[0.65rem]" @click="selectAll">{{ $t('share.selectAll') }}</UButton>
            <UButton size="2xs" variant="ghost" class="!text-[0.65rem]" @click="deselectAll">{{ $t('share.deselectAll') }}</UButton>
          </div>
        </div>

        <!-- Encryption info -->
        <div class="flex items-center gap-2 text-xs text-(--ui-text-muted)">
          <UIcon name="i-lucide-shield-check" class="w-3.5 h-3.5 text-(--ui-success)" />
          <span>{{ $t('share.encrypted') }}</span>
        </div>

        <!-- Share URL -->
        <div v-if="shareUrl" class="space-y-2">
          <label class="text-xs font-medium text-default">{{ $t('share.urlLabel') }}</label>
          <div class="flex gap-2">
            <UInput :model-value="shareUrl" readonly class="flex-1" size="sm" />
            <UButton icon="i-lucide-copy" size="sm" color="neutral" variant="soft" @click="copyUrl">
              {{ copied ? $t('share.copied') : $t('share.copy') }}
            </UButton>
          </div>
          <p class="text-xs text-(--ui-text-muted)">{{ $t('share.urlHint') }}</p>
        </div>

        <!-- Loading -->
        <div v-if="loading" class="flex items-center justify-center py-3">
          <UIcon name="i-lucide-loader-circle" class="w-4 h-4 animate-spin text-(--ui-primary)" />
          <span class="ml-2 text-xs text-(--ui-text-muted)">{{ $t('share.encrypting') }}</span>
        </div>

        <!-- Error -->
        <div v-if="error" class="text-xs text-(--ui-error)">{{ error }}</div>
      </div>
    </template>

    <template #footer>
      <div class="flex justify-between items-center w-full">
        <span class="text-xs text-(--ui-text-muted)">{{ selectedIds.size }}/{{ filesWithContent.length }} {{ $t('share.selected') }}</span>
        <div class="flex gap-2">
          <UButton v-if="!shareUrl" variant="soft" color="neutral" size="sm" @click="open = false">
            {{ $t('share.cancel') }}
          </UButton>
          <UButton v-if="!shareUrl && !loading" icon="i-lucide-share" size="sm" @click="generateShare">
            {{ $t('share.generate') }}
          </UButton>
          <UButton v-if="shareUrl" variant="soft" size="sm" @click="open = false">
            {{ $t('share.close') }}
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import type { DiffFile } from '~/types/diff'

const diff = useDiff()
const { encrypt, buildShareUrl, isCryptoAvailable, generatePassword } = useCrypto()

const open = defineModel<boolean>('open', { default: false })

const shareUrl = ref('')
const loading = ref(false)
const copied = ref(false)
const error = ref('')
const selectedIds = ref(new Set<string>())

// Files that have at least some content
const filesWithContent = computed(() =>
  diff.files.value.filter(f => f.leftContent || f.rightContent)
)

// Reset selection when dialog opens
watch(open, (v) => {
  if (v) {
    shareUrl.value = ''
    error.value = ''
    selectedIds.value = new Set(filesWithContent.value.filter(f => f.leftContent !== f.rightContent).map(f => f.id))
  }
})

function toggle(id: string) {
  const s = new Set(selectedIds.value)
  if (s.has(id)) s.delete(id); else s.add(id)
  selectedIds.value = s
}
function selectAll() { selectedIds.value = new Set(filesWithContent.value.map(f => f.id)) }
function deselectAll() { selectedIds.value = new Set() }

function fileIcon(lang: string): string {
  const m: Record<string, string> = { typescript: 'i-lucide-file-type2', javascript: 'i-lucide-file-type', html: 'i-lucide-file-code', css: 'i-lucide-file-css', json: 'i-lucide-file-json', python: 'i-lucide-file-code-2', markdown: 'i-lucide-file-text', plaintext: 'i-lucide-file' }
  return m[lang] || 'i-lucide-file'
}

async function generateShare() {
  error.value = ''
  if (selectedIds.value.size === 0) { error.value = '请至少选择一个文件。'; return }
  loading.value = true

  try {
    if (!isCryptoAvailable()) throw new Error('当前浏览器不支持 Web Crypto API。')

    const selectedFiles = filesWithContent.value.filter(f => selectedIds.value.has(f.id))
    const shareData = { files: selectedFiles }

    const password = generatePassword()
    const { encryptedData, iv, salt } = await encrypt(shareData, password)

    const response = await $fetch<{ id: string; url: string }>('/api/diff/create', {
      method: 'POST',
      body: { encryptedData, iv, salt, fileCount: selectedFiles.length },
    })

    shareUrl.value = buildShareUrl(response.id, password)
  } catch (err: any) {
    error.value = err.data?.statusMessage || err.message || '生成分享链接失败。'
  } finally {
    loading.value = false
  }
}

async function copyUrl() {
  try { await navigator.clipboard.writeText(shareUrl.value); copied.value = true }
  catch { const ta = document.createElement('textarea'); ta.value = shareUrl.value; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); copied.value = true }
  setTimeout(() => { copied.value = false }, 2000)
}
</script>
