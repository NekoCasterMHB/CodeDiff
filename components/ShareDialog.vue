<template>
  <UModal v-model:open="open" :title="$t('share.title')">
    <template #body>
      <div class="space-y-4">
        <!-- File Selection -->
        <div class="space-y-1.5">
          <label class="text-xs font-medium text-default">{{ generated ? $t('share.selectedFiles') : $t('share.selectFiles') }}</label>
          <div class="border border-default rounded-lg divide-y divide-default max-h-48 overflow-y-auto">
            <label
              v-for="f in displayedFiles"
              :key="f.id"
              class="flex items-center gap-2 px-3 py-2 transition-colors"
              :class="generated ? '' : 'cursor-pointer hover:bg-elevated'"
            >
              <UCheckbox v-if="!generated" :model-value="selectedIds.has(f.id)" @update:model-value="toggle(f.id)" />
              <UIcon :name="fileIcon(f.language)" class="w-3.5 h-3.5 text-muted shrink-0" />
              <span class="text-xs truncate">{{ f.leftPath || f.rightPath || $t('diffFile.fallbackName', { index: 1 }) }}</span>
              <span v-if="f.leftContent !== f.rightContent" class="w-1.5 h-1.5 rounded-full bg-warning shrink-0 ml-auto" />
            </label>
            <div v-if="!displayedFiles.length" class="px-3 py-4 text-center text-xs text-muted">
              {{ $t('share.noFiles') }}
            </div>
          </div>
          <div v-if="!generated" class="flex items-center gap-2">
            <UButton size="sm" variant="soft" @click="selectAll">{{ $t('share.selectAll') }}</UButton>
            <UButton size="sm" variant="soft" @click="deselectAll">{{ $t('share.deselectAll') }}</UButton>
          </div>
        </div>

        <!-- Expiration -->
        <div v-if="!generated" class="space-y-1.5">
          <label class="text-xs font-medium text-default">{{ $t('share.expiresIn') }}</label>
          <div class="flex items-center gap-2">
            <UInputNumber
              v-model="expiresInDays"
              :min="1"
              :max="30"
              size="sm"
              class="w-20"
            />
            <span class="text-xs text-muted">{{ $t('share.days') }}</span>
            <span class="text-xs text-muted ml-auto">{{ $t('share.expiresAt') }}: {{ expiresAtText }}</span>
          </div>
        </div>

        <!-- Expiration (read-only after generation) -->
        <div v-if="generated" class="flex items-center gap-2 text-xs text-muted">
          <UIcon name="i-lucide-clock" class="w-3.5 h-3.5 shrink-0" />
          <span>{{ $t('share.expiresAt') }}: {{ lockedExpiresAt }}</span>
        </div>

        <!-- Encryption info -->
        <div class="flex items-center gap-2 text-xs text-muted">
          <UIcon name="i-lucide-shield-check" class="w-3.5 h-3.5 text-success" />
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
          <p class="text-xs text-muted">{{ $t('share.urlHint') }}</p>
        </div>

        <!-- Loading -->
        <div v-if="loading" class="flex items-center justify-center py-3">
          <UIcon name="i-lucide-loader-circle" class="w-4 h-4 animate-spin text-primary" />
          <span class="ml-2 text-xs text-muted">{{ $t('share.encrypting') }}</span>
        </div>

        <!-- Error -->
        <div v-if="error" class="text-xs text-error">{{ error }}</div>
      </div>
    </template>

    <template #footer>
      <div class="flex justify-between items-center w-full">
        <span class="text-xs text-muted">{{ selectedIds.size }}/{{ filesWithContent.length }} {{ $t('share.selected') }}</span>
        <div class="flex gap-2">
          <UButton v-if="!shareUrl" variant="soft" color="neutral" size="sm" @click="() => { open = false }">
            {{ $t('share.cancel') }}
          </UButton>
          <UButton v-if="!shareUrl && !loading" icon="i-lucide-share" size="sm" @click="generateShare">
            {{ $t('share.generate') }}
          </UButton>
          <UButton v-if="shareUrl" variant="soft" size="sm" @click="() => { open = false }">
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
const generated = ref(false)
const selectedIds = ref(new Set<string>())
const expiresInDays = ref(3)
const lockedExpiresAt = ref('')

function calcExpireDate(days: number): string {
  // Use JST (UTC+9) to match cleanup cron timezone (GitHub Actions: JST 00:00 = UTC 15:00)
  const now = new Date()
  const jstNow = new Date(now.getTime() + 9 * 3600_000)
  jstNow.setUTCDate(jstNow.getUTCDate() + days)
  jstNow.setUTCHours(0, 0, 0, 0)
  const y = jstNow.getUTCFullYear()
  const m = jstNow.getUTCMonth() + 1
  const day = jstNow.getUTCDate()
  return `${y}/${m}/${day} 00:00`
}

const expiresAtText = computed(() => calcExpireDate(expiresInDays.value))

// Files that have at least some content
const filesWithContent = computed(() =>
  diff.files.value.filter(f => f.leftContent || f.rightContent)
)

// After generation: only show selected files; before: show all
const displayedFiles = computed(() =>
  generated.value
    ? filesWithContent.value.filter(f => selectedIds.value.has(f.id))
    : filesWithContent.value
)

// Reset selection when dialog opens
watch(open, (v) => {
  if (v) {
    shareUrl.value = ''
    error.value = ''
    generated.value = false
    lockedExpiresAt.value = ''
    expiresInDays.value = 3
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
      body: { encryptedData, iv, salt, fileCount: selectedFiles.length, expiresInDays: expiresInDays.value },
    })

    shareUrl.value = buildShareUrl(response.id, password)

    // Lock expiration display and disable file selection
    lockedExpiresAt.value = calcExpireDate(expiresInDays.value)
    generated.value = true
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
