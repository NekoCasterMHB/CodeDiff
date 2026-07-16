<template>
  <div class="h-full flex">
    <!-- Sidebar: File List -->
    <aside class="w-56 flex flex-col border-r border-(--ui-border) bg-(--ui-bg-elevated) shrink-0">
      <div class="flex items-center gap-2 px-3 py-2.5 border-b border-(--ui-border)">
        <UIcon name="i-lucide-folder-tree" class="w-4 h-4 text-(--ui-text-muted) shrink-0" />
        <span class="text-xs font-semibold text-(--ui-text-muted) uppercase tracking-wider">{{ $t('view.files') }}</span>
      </div>
      <div class="flex-1 overflow-y-auto py-1">
        <div
          v-for="(f, i) in files"
          :key="f.id"
          :class="[
            'flex items-center gap-2 mx-1.5 px-2.5 py-2 rounded-md cursor-pointer transition-colors text-sm border-l-2',
            activeFileId === f.id
              ? 'bg-(--ui-primary)/12 text-(--ui-primary) font-medium border-l-(--ui-primary)'
              : 'hover:bg-(--ui-bg-muted) text-(--ui-text) border-l-transparent',
          ]"
          @click="activeFileId = f.id"
        >
          <UIcon :name="fileIcon(f.language)" class="w-4 h-4 shrink-0" :class="activeFileId === f.id ? 'text-(--ui-primary)' : 'text-(--ui-text-muted)'" />
          <span class="flex-1 truncate text-xs">{{ f.leftPath || f.rightPath || `文件 ${i + 1}` }}</span>
          <span v-if="f.leftContent !== f.rightContent" class="w-1.5 h-1.5 rounded-full bg-(--ui-warning) shrink-0" />
        </div>
      </div>
    </aside>

    <!-- Content -->
    <div class="flex-1 flex flex-col min-w-0 min-h-0">
      <div v-if="loading" class="flex-1 flex items-center justify-center">
        <UIcon name="i-lucide-loader-circle" class="w-6 h-6 animate-spin text-(--ui-text-muted)" />
      </div>

      <div v-else-if="error" class="flex-1 flex items-center justify-center">
        <div class="text-center">
          <UIcon name="i-lucide-triangle-alert" class="w-10 h-10 text-(--ui-error) mx-auto mb-3" />
          <p class="text-sm text-(--ui-text-muted)">{{ error }}</p>
          <UButton size="sm" class="mt-3" @click="navigateTo('/')">返回首页</UButton>
        </div>
      </div>

      <div v-else-if="activeFile" class="flex-1 flex flex-col min-h-0">
        <!-- File name bar -->
        <div class="flex items-center h-8 px-3 border-b border-(--ui-border) bg-(--ui-bg-elevated) shrink-0 gap-1.5">
          <UIcon name="i-lucide-file-text" class="w-3.5 h-3.5 text-(--ui-text-muted) mr-1.5 shrink-0" />
          <span class="text-xs text-(--ui-text) truncate">{{ activeFile.leftPath || activeFile.rightPath || 'untitled' }}</span>
        </div>
        <div class="flex-1 relative overflow-hidden">
          <ClientOnly>
            <MonacoDiffEditor
              :key="activeFile.id"
              :left-content="activeFile.leftContent"
              :right-content="activeFile.rightContent"
              :language="activeFile.language"
              :read-only="true"
              :theme="editorTheme"
            />
            <template #fallback>
              <div class="flex items-center justify-center h-full">
                <UIcon name="i-lucide-loader-circle" class="w-5 h-5 animate-spin text-(--ui-text-muted)" />
              </div>
            </template>
          </ClientOnly>
        </div>
      </div>

      <div v-else class="flex-1 flex items-center justify-center text-(--ui-text-muted) text-xs">无内容</div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'view' })

import type { DiffFile } from '~/types/diff'

const route = useRoute()
const { decrypt, getPasswordFromHash, isCryptoAvailable } = useCrypto()

const loading = ref(true)
const error = ref('')
const files = ref<DiffFile[]>([])
const activeFileId = ref('')
const activeFile = computed(() => files.value.find(f => f.id === activeFileId.value))
const colorMode = useColorMode()
const editorTheme = computed(() => colorMode.preference === 'dark' ? 'vs-dark' : 'vs')

function fileIcon(lang: string): string {
  const m: Record<string, string> = {
    typescript: 'i-lucide-file-type2', javascript: 'i-lucide-file-type', html: 'i-lucide-file-code',
    css: 'i-lucide-file-css', json: 'i-lucide-file-json', python: 'i-lucide-file-code-2',
    markdown: 'i-lucide-file-text', plaintext: 'i-lucide-file',
  }
  return m[lang] || 'i-lucide-file'
}

onMounted(loadDiff)

async function loadDiff() {
  loading.value = true; error.value = ''
  try {
    if (!isCryptoAvailable()) throw new Error('当前浏览器不支持 Web Crypto API。')
    const id = route.params.id as string
    if (!id) throw new Error('无效的分享链接。')
    const record = await $fetch<{ id: string; encryptedData: string; iv: string; salt: string; fileCount: number; createdAt: string }>(`/api/diff/${id}`)
    const password = getPasswordFromHash()
    if (!password) throw new Error('链接中缺少解密密码（#pwd=...）。')
    let decrypted: { files: DiffFile[] }
    try { decrypted = await decrypt(record.encryptedData, record.iv, record.salt, password) }
    catch { throw new Error('解密失败，密码可能不正确。') }
    files.value = decrypted.files || []
    activeFileId.value = files.value[0]?.id || ''
  } catch (err: any) {
    error.value = err.data?.statusMessage || err.message || '加载失败'
  } finally { loading.value = false }
}
</script>
