<template>
  <div class="h-full relative">
    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center h-full">
      <div class="text-center">
        <UIcon name="i-lucide-loader-circle" class="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
        <p class="text-sm text-muted">正在加载分享内容...</p>
      </div>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="flex items-center justify-center h-full">
      <div class="text-center max-w-md">
        <UIcon name="i-lucide-triangle-alert" class="w-12 h-12 text-error mx-auto mb-4" />
        <h2 class="text-lg font-semibold text-default mb-2">{{ errorTitle }}</h2>
        <p class="text-sm text-muted mb-4">{{ error }}</p>
        <UButton @click="navigateTo('/')">返回首页</UButton>
      </div>
    </div>

    <!-- Monaco Diff Viewer (read-only) -->
    <ClientOnly v-else-if="activeFile">
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
          <UIcon name="i-lucide-loader-circle" class="w-6 h-6 animate-spin text-muted" />
        </div>
      </template>
    </ClientOnly>

    <!-- Empty -->
    <div v-else class="flex items-center justify-center h-full">
      <p class="text-muted">无内容</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { DiffFile } from '~/types/diff'

const route = useRoute()
const { decrypt, getPasswordFromHash, isCryptoAvailable } = useCrypto()

const loading = ref(true)
const error = ref('')
const errorTitle = ref('加载失败')
const files = ref<DiffFile[]>([])
const activeFileId = ref('')
const activeFile = computed(() => files.value.find(f => f.id === activeFileId.value))
const colorMode = useColorMode()
const editorTheme = computed(() => colorMode.preference === 'dark' ? 'vs-dark' : 'vs')

onMounted(loadDiff)

async function loadDiff() {
  loading.value = true
  error.value = ''
  try {
    if (!isCryptoAvailable()) throw new Error('当前浏览器不支持 Web Crypto API，请使用现代浏览器。')

    const id = route.params.id as string
    if (!id) throw new Error('无效的分享链接。')

    const record = await $fetch<{
      id: string; encryptedData: string; iv: string; salt: string
      fileCount: number; createdAt: string
    }>(`/api/diff/${id}`)

    const password = getPasswordFromHash()
    if (!password) throw new Error('链接中缺少解密密码（#pwd=...）。')

    let decrypted: { files: DiffFile[] }
    try {
      decrypted = await decrypt(record.encryptedData, record.iv, record.salt, password)
    } catch {
      throw new Error('解密失败，密码可能不正确。')
    }

    files.value = decrypted.files || []
    activeFileId.value = files.value[0]?.id || ''
  } catch (err: any) {
    errorTitle.value = err.statusCode === 404 ? '未找到' : '加载失败'
    error.value = err.message || '未知错误'
  } finally {
    loading.value = false
  }
}
</script>
