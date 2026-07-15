<template>
  <UModal v-model:open="open" title="分享差分">
    <template #body>
      <div class="space-y-4">
        <!-- Info -->
        <div class="flex items-center gap-2 text-sm text-muted">
          <UIcon name="i-lucide-shield-check" class="w-4 h-4 text-success" />
          <span>内容已使用 AES-256-GCM 加密，密码嵌入链接中</span>
        </div>

        <!-- Share URL -->
        <div v-if="shareUrl" class="space-y-2">
          <label class="text-sm font-medium text-default">分享链接</label>
          <div class="flex gap-2">
            <UInput
              :model-value="shareUrl"
              readonly
              class="flex-1"
              size="sm"
            />
            <UButton
              icon="i-lucide-copy"
              size="sm"
              color="neutral"
              variant="soft"
              @click="copyUrl"
            >
              {{ copied ? '已复制' : '复制' }}
            </UButton>
          </div>
          <p class="text-xs text-muted">
            将此链接发送给需要查看的人，打开即自动解密显示。
          </p>
        </div>

        <!-- Loading -->
        <div v-if="loading" class="flex items-center justify-center py-4">
          <UIcon name="i-lucide-loader-circle" class="w-5 h-5 animate-spin text-primary" />
          <span class="ml-2 text-sm text-muted">正在加密并保存...</span>
        </div>

        <!-- Error -->
        <div v-if="error" class="text-sm text-error">
          {{ error }}
        </div>
      </div>
    </template>

    <template #footer>
      <div class="flex justify-end gap-2">
        <UButton
          v-if="!shareUrl"
          variant="soft"
          color="neutral"
          @click="open = false"
        >
          取消
        </UButton>
        <UButton
          v-if="!shareUrl && !loading"
          icon="i-lucide-share"
          @click="generateShare"
        >
          生成分享链接
        </UButton>
        <UButton
          v-if="shareUrl"
          variant="soft"
          @click="open = false"
        >
          关闭
        </UButton>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
const diff = useDiff()
const { encrypt, buildShareUrl, isCryptoAvailable, generatePassword } = useCrypto()

const open = defineModel<boolean>('open', { default: false })

const shareUrl = ref('')
const loading = ref(false)
const copied = ref(false)
const error = ref('')

async function generateShare() {
  error.value = ''
  loading.value = true

  try {
    if (!isCryptoAvailable()) {
      throw new Error('当前浏览器不支持 Web Crypto API，请使用现代浏览器。')
    }

    const shareData = diff.getShareData()

    if (
      shareData.files.length === 0 ||
      shareData.files.every((f) => !f.leftContent && !f.rightContent)
    ) {
      throw new Error('没有可分享的内容，请先输入代码。')
    }

    // Encrypt client-side
    const password = generatePassword()
    const { encryptedData, iv, salt } = await encrypt(shareData, password)

    // Save to server
    const response = await $fetch<{ id: string; url: string }>(
      '/api/diff/create',
      {
        method: 'POST',
        body: {
          encryptedData,
          iv,
          salt,
          fileCount: shareData.files.length,
        },
      }
    )

    // Build share URL with password embedded
    shareUrl.value = buildShareUrl(response.id, password)
  } catch (err: any) {
    error.value = err.message || '生成分享链接失败，请重试。'
  } finally {
    loading.value = false
  }
}

async function copyUrl() {
  try {
    await navigator.clipboard.writeText(shareUrl.value)
    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 2000)
  } catch {
    // Fallback
    const textarea = document.createElement('textarea')
    textarea.value = shareUrl.value
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand('copy')
    document.body.removeChild(textarea)
    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 2000)
  }
}
</script>
