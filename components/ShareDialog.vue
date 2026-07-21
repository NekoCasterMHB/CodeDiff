<template>
  <UModal v-model:open="open" :title="$t('share.title')" :dismissible="false">
    <template #body>
      <div class="space-y-4">
        <!-- File Selection -->
        <div class="space-y-1.5">
          <label class="text-xs font-medium text-default">{{ generated ? $t('share.selectedFiles') : $t('share.selectFiles') }} <span class="text-muted font-normal">({{ $t('share.maxFileSize') }})</span></label>
          <div class="border border-default rounded-lg divide-y divide-default max-h-48 overflow-y-auto">
            <label
              v-for="f in displayedFiles"
              :key="f.id"
              class="flex items-center gap-2 px-3 py-2 transition-colors"
              :class="[generated ? '' : 'cursor-pointer hover:bg-elevated', fileOverLimit(f.id) && !generated ? 'opacity-50 pointer-events-none' : '']"
            >
              <UCheckbox v-if="!generated" :model-value="selectedIds.has(f.id)" :disabled="fileOverLimit(f.id)" @update:model-value="toggle(f.id)" />
              <UIcon :name="fileIcon(f.language)" class="w-3.5 h-3.5 text-muted shrink-0" />
              <span class="text-xs truncate flex-1">{{ f.leftPath || f.rightPath || $t('diffFile.fallbackName', { index: 1 }) }}</span>
              <span v-if="fileSizesReady" class="flex items-center gap-1 shrink-0">
                <UBadge size="sm" color="primary" variant="subtle" class="font-mono">gzip</UBadge>
                <span class="text-xs text-muted font-mono tabular-nums">{{ fileSizeText(f.id) }}</span>
              </span>
              <span v-if="f.leftContent !== f.rightContent" class="w-1.5 h-1.5 rounded-full bg-warning shrink-0" />
            </label>
            <div v-if="!displayedFiles.length" class="px-3 py-4 text-center text-xs text-muted">
              {{ $t('share.noFiles') }}
            </div>
          </div>
          <div v-if="!generated" class="flex items-center gap-2">
            <UButton size="xs" variant="soft" @click="selectAll">{{ $t('share.selectAll') }}</UButton>
            <UButton size="xs" variant="soft" @click="deselectAll">{{ $t('share.deselectAll') }}</UButton>
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
        <div class="flex items-center gap-2">
          <UButton
            icon="i-lucide-clock"
            size="sm"
            variant="subtle"
            color="neutral"
            @click="() => { historyOpen = true }"
          >
            {{ $t('share.history') }}
          </UButton>
          <span class="text-xs text-muted">{{ selectedIds.size }}/{{ filesWithContent.length }} {{ $t('share.selected') }}</span>
        </div>
        <div class="flex gap-2">
          <UButton v-if="!shareUrl && !loading" icon="i-lucide-share" size="sm" @click="generateShare">
            {{ $t('share.generate') }}
          </UButton>
        </div>
      </div>
    </template>
  </UModal>

  <ShareHistoryModal v-model:open="historyOpen" />
</template>

<script setup lang="ts">
import type { DiffFile } from '~/types/diff'
import { deflate as pakoDeflate } from 'pako'

const diff = useDiff()
const { encrypt, buildShareUrl, isCryptoAvailable, generatePassword } = useCrypto()
const { add: addHistory } = useShareHistory()
const { t } = useI18n()

const open = defineModel<boolean>('open', { default: false })
const historyOpen = ref(false)

const MAX_FILE_SIZE = 2_000_000 // per-file estimated POST body limit
const fileSizes = ref<Record<string, number>>({})
const fileSizesReady = ref(false)

const shareUrl = ref('')
const loading = ref(false)
const copied = ref(false)
const error = ref('')
const generated = ref(false)
const selectedIds = ref(new Set<string>())
const expiresInDays = ref(3)
const lockedExpiresAt = ref('')

function estimateFileSize(file: DiffFile): number {
  const raw = new TextEncoder().encode(JSON.stringify({ files: [file] }))
  const compressed = pakoDeflate(raw)
  const base64DataLen = Math.ceil(compressed.length / 3) * 4
  // Exact POST body length: JSON wrapper + base64 data + iv(16) + salt(24) + ownerToken(24)
  const overhead = JSON.stringify({
    encryptedData: '', iv: '', salt: '', fileCount: 1,
    expiresInDays: expiresInDays.value, shareGroup: null,
    segmentIndex: 0, totalSegments: 1, ownerToken: '',
  }).length
  return overhead + base64DataLen + 16 + 24 + 24
}

function computeFileSizes() {
  const map: Record<string, number> = {}
  for (const f of filesWithContent.value) {
    map[f.id] = estimateFileSize(f)
  }
  fileSizes.value = map
  fileSizesReady.value = true
}

function fileOverLimit(id: string) {
  return (fileSizes.value[id] || 0) > MAX_FILE_SIZE
}

function fileSizeText(id: string) {
  const size = fileSizes.value[id]
  if (!size) return '...'
  if (size >= 1_000_000) return `${(size / 1_000_000).toFixed(1)}MB`
  return `${Math.round(size / 1000)}KB`
}

function calcExpireDate(days: number): string {
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

const filesWithContent = computed(() =>
  diff.files.value.filter(f => f.leftContent || f.rightContent)
)

const displayedFiles = computed(() =>
  generated.value
    ? filesWithContent.value.filter(f => selectedIds.value.has(f.id))
    : filesWithContent.value
)

// Reset state when dialog opens
watch(open, (v) => {
  if (v) {
    shareUrl.value = ''
    error.value = ''
    generated.value = false
    lockedExpiresAt.value = ''
    expiresInDays.value = 3
    selectedIds.value = new Set(filesWithContent.value.filter(f => f.leftContent !== f.rightContent).map(f => f.id))
    // Compute sizes asynchronously — pako.deflate is fast but still off the main thread
    setTimeout(computeFileSizes, 0)
  }
})

function toggle(id: string) {
  const s = new Set(selectedIds.value)
  if (s.has(id)) s.delete(id); else s.add(id)
  selectedIds.value = s
}
function selectAll() { selectedIds.value = new Set(filesWithContent.value.filter(f => !fileOverLimit(f.id)).map(f => f.id)) }
function deselectAll() { selectedIds.value = new Set() }

function fileIcon(lang: string): string {
  const m: Record<string, string> = { typescript: 'i-lucide-file-type2', javascript: 'i-lucide-file-type', html: 'i-lucide-file-code', css: 'i-lucide-file-css', json: 'i-lucide-file-json', python: 'i-lucide-file-code-2', markdown: 'i-lucide-file-text', plaintext: 'i-lucide-file' }
  return m[lang] || 'i-lucide-file'
}

async function generateShare() {
  error.value = ''
  if (selectedIds.value.size === 0) { error.value = t('share.selectAtLeastOne'); return }
  loading.value = true

  try {
    if (!isCryptoAvailable()) throw new Error(t('view.noCrypto'))

    const selectedFiles = filesWithContent.value.filter(f => selectedIds.value.has(f.id))
    const password = generatePassword()
    const ownerToken = generatePassword(24)
    const totalSegments = selectedFiles.length
    const shareGroup = totalSegments > 1 ? crypto.randomUUID() : null

    for (let i = 0; i < selectedFiles.length; i++) {
      const { encryptedData, iv, salt } = await encrypt({ files: [selectedFiles[i]] }, password)

      // eslint-disable-next-line no-await-in-loop
      const response = await $fetch<{ id: string; url: string }>('/api/diff/create', {
        method: 'POST',
        body: {
          encryptedData, iv, salt,
          fileCount: 1,
          expiresInDays: expiresInDays.value,
          shareGroup, segmentIndex: i, totalSegments,
          ownerToken,
        },
      })

      if (i === 0) {
        shareUrl.value = buildShareUrl(response.id, password)
      }
    }

    lockedExpiresAt.value = calcExpireDate(expiresInDays.value)
    generated.value = true

    // Save to share history (with ownerToken for delete authorization)
    const now = new Date()
    await addHistory({
      id: shareGroup || selectedFiles[0]?.id || Date.now().toString(),
      shareUrl: shareUrl.value,
      fileNames: selectedFiles.map(f => f.leftPath || f.rightPath || ''),
      fileCount: selectedFiles.length,
      createdAt: now.toLocaleDateString() + ' ' + now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      expiresAt: lockedExpiresAt.value,
      ownerToken,
    })
  } catch (err: any) {
    error.value = err.data?.statusMessage || err.message || t('share.generateFailed')
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
