<template>
  <UApp>
    <UHeader toggle-side="left" :ui="{ header: 'px-2!', container: 'w-full! max-w-100xl' }">
      <template #left>
        <div class="flex items-center gap-2">
          <div class="w-7 h-7 rounded-lg bg-(--ui-primary) flex items-center justify-center">
            <UIcon name="i-lucide-git-compare-arrows" class="w-4 h-4 text-(--ui-bg)" />
          </div>
          <span class="font-bold text-lg">CodeDiff</span>
        </div>
      </template>

      <template #toggle>
        <UButton
          v-if="!isViewPage"
          icon="i-lucide-panel-left"
          color="neutral"
          variant="ghost"
          aria-label="Toggle sidebar"
          @click="sidebarOpen = !sidebarOpen"
        />
      </template>

      <template #right>
        <UColorModeSwitch />
        <UDropdownMenu :items="langItems" :content="{ align: 'end' }">
          <UButton
            :label="currentLang"
            trailing-icon="i-lucide-chevron-down"
            size="sm"
            variant="outline"
            color="neutral"
            class="text-xs"
          />
        </UDropdownMenu>
        <UButton
          v-if="!isViewPage"
          icon="i-lucide-share-2"
          size="sm"
          variant="soft"
          @click="shareOpen = true"
        >
          {{ $t('header.share') }}
        </UButton>
      </template>

      <template #body>
        <DiffFileList />
      </template>
    </UHeader>

    <div class="flex h-[calc(100vh-var(--ui-header-height))]">
      <NuxtLayout>
        <NuxtPage />
      </NuxtLayout>
    </div>

    <ShareDialog v-model:open="shareOpen" />
  </UApp>
</template>

<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'

const colorMode = useColorMode()
if (import.meta.server) {
  colorMode.preference = 'light'
  colorMode.value = 'light'
}

const { locale, locales, setLocale } = useI18n()

// Dynamic page title
const titles: Record<string, string> = {
  en: 'CodeDiff - Online Code Diff Tool',
  zh: 'CodeDiff - 在线代码差分高亮工具',
  ja: 'CodeDiff - オンラインコード差分ツール',
}
useHead({
  title: () => titles[locale.value] || titles.en,
})
const route = useRoute()
const sidebarOpen = useState('sidebar-open', () => true)
const shareOpen = ref(false)

const isViewPage = computed(() => route.path.startsWith('/view'))

const currentLang = computed(() => {
  const loc = locales.value.find(l => l.code === locale.value)
  return loc ? `${loc.flag} ${loc.name}` : '🌐'
})

const langItems = computed<DropdownMenuItem[][]>(() => [
  locales.value.map(loc => ({
    label: `${loc.flag} ${loc.name}`,
    active: locale.value === loc.code,
    onSelect: () => { setLocale(loc.code) },
  })),
])
</script>
