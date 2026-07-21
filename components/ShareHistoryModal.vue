<template>
  <UModal v-model:open="open" :title="$t('share.history')">
    <template #body>
      <div class="space-y-3">
        <div v-if="!items.length" class="py-8 text-center text-xs text-muted">
          <UIcon name="i-lucide-inbox" class="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p>{{ $t('share.noHistory') }}</p>
        </div>
        <div v-for="item in items" :key="item.id" class="border border-default rounded-lg p-3 space-y-2">
          <!-- Header: time + delete -->
          <div class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-3 text-xs text-muted flex-wrap">
              <span class="flex items-center gap-1">
                <UIcon name="i-lucide-calendar" class="w-3 h-3 shrink-0" />
                <span>{{ $t('share.createdAt') }}: {{ item.createdAt }}</span>
              </span>
              <span class="flex items-center gap-1">
                <UIcon name="i-lucide-clock" class="w-3 h-3 shrink-0" />
                <span>{{ $t('share.expiresAt') }}: {{ item.expiresAt }}</span>
              </span>
            </div>
            <UButton
              icon="i-lucide-trash-2"
              size="xs"
              color="error"
              variant="ghost"
              :loading="deletingId === item.id"
              @click="cancelShare(item)"
            />
          </div>
          <!-- File names (expandable) -->
          <div>
            <button
              class="flex items-center gap-1 text-xs text-default hover:text-primary transition-colors"
              @click="toggleExpand(item.id)"
            >
              <UIcon
                :name="expandedIds.has(item.id) ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
                class="w-3 h-3 shrink-0"
              />
              <span>{{ item.fileCount }} {{ $t('share.files') }}</span>
            </button>
            <div v-if="expandedIds.has(item.id)" class="mt-1 ml-4 space-y-0.5">
              <div v-for="(name, idx) in item.fileNames" :key="idx" class="flex items-center gap-1.5 text-xs text-muted truncate">
                <UIcon name="i-lucide-file-text" class="w-3.5 h-3.5 shrink-0" />
                <span class="truncate">{{ name || $t('diffFile.fallbackName', { index: idx + 1 }) }}</span>
              </div>
            </div>
          </div>
          <!-- Share URL -->
          <div class="flex gap-1.5">
            <UInput :model-value="item.shareUrl" readonly class="flex-1" size="xs" />
            <UButton icon="i-lucide-copy" size="xs" color="neutral" variant="soft" @click="copyUrl(item.shareUrl, item.id)">
              {{ copiedId === item.id ? $t('share.copied') : $t('share.copy') }}
            </UButton>
            <UButton icon="i-lucide-external-link" size="xs" color="neutral" variant="soft" :to="item.shareUrl" target="_blank" />
          </div>
        </div>
      </div>
    </template>
    <template #footer>
      <div class="flex justify-end w-full">
        <UButton variant="soft" color="neutral" size="sm" @click="() => { open = false }">{{ $t('share.close') }}</UButton>
      </div>
    </template>
  </UModal>

  <!-- Delete confirmation modal -->
  <UModal v-model:open="confirmOpen" :title="$t('share.delete')">
    <template #body>
      <div class="flex items-start gap-4 py-2">
        <UIcon name="i-lucide-triangle-alert" class="w-10 h-10 text-error shrink-0 mt-0.5" />
        <div class="space-y-1">
          <p class="text-sm font-medium">{{ $t('share.deleteConfirm') }}</p>
          <p class="text-xs text-muted">{{ $t('share.deleteHint') }}</p>
        </div>
      </div>
    </template>
    <template #footer>
      <div class="flex justify-end gap-2 w-full">
        <UButton variant="soft" color="neutral" size="sm" @click="() => { confirmOpen = false }">{{ $t('share.cancel') }}</UButton>
        <UButton color="error" size="sm" :loading="deletingId === pendingDelete?.id" @click="doDelete">{{ $t('share.delete') }}</UButton>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import type { ShareHistoryItem } from '~/composables/useShareHistory'

const { items, load: loadHistory, remove: removeHistory } = useShareHistory()

const open = defineModel<boolean>('open', { default: false })
const confirmOpen = ref(false)
const deletingId = ref('')
const expandedIds = ref(new Set<string>())
const copiedId = ref('')
const pendingDelete = ref<ShareHistoryItem | null>(null)

watch(open, (v) => { if (v) loadHistory() })

function toggleExpand(id: string) {
  const s = new Set(expandedIds.value)
  if (s.has(id)) s.delete(id); else s.add(id)
  expandedIds.value = s
}

async function copyUrl(url: string, id: string) {
  try { await navigator.clipboard.writeText(url); copiedId.value = id }
  catch { /* fallback */ }
  setTimeout(() => { copiedId.value = '' }, 2000)
}

function cancelShare(item: ShareHistoryItem) {
  pendingDelete.value = item
  confirmOpen.value = true
}

async function doDelete() {
  const item = pendingDelete.value
  if (!item) return
  confirmOpen.value = false
  // Best-effort API deletion
  const id = item.shareUrl.split('/view/')[1]?.split('#')[0]
  if (id) {
    try {
      await $fetch(`/api/diff/${id}?token=${encodeURIComponent(item.ownerToken)}`, { method: 'DELETE' })
    } catch { /* API error — only local removal matters */ }
  }
  // Always remove from local history
  await removeHistory(item.id)
}
</script>
