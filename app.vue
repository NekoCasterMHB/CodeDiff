<template>
  <UApp>
    <UHeader :ui="{ header: '', container: 'w-full! max-w-full! px-2 sm:px-3 lg:px-4' }">
      <template #left>
        <NuxtLink to="/" class="flex items-center gap-2">
          <div class="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <UIcon name="i-lucide-git-compare-arrows" class="w-5 h-5 text-(--ui-bg)" />
          </div>
          <span class="font-bold text-lg">CodeDiff</span>
        </NuxtLink>
      </template>

      <template #right>
        <UColorModeSwitch />
        <UDropdownMenu :items="langItems" :content="{ align: 'end' }">
          <UButton
            :label="currentLang"
            :icon="flagIcons[currentLangCode]"
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
          variant="subtle"
          @click="openShareDialog"
        >
          {{ $t('header.share') }}
        </UButton>
      </template>

      <template #body>
        <ClientOnly>
          <DiffFileList />
        </ClientOnly>
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
const colorMode = useColorMode()

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

const isViewPage = computed(() => route.path.startsWith('/view'))

const shareOpen = ref(false)
function openShareDialog() { shareOpen.value = true }

const flagIcons: Record<string, string> = {
  ja: 'i-openmoji-flag-japan',
  zh: 'i-openmoji-flag-china',
  en: 'i-openmoji-flag-united-states',
}

const currentLangCode = computed(() => locale.value)

const currentLang = computed(() => {
  const loc = locales.value.find(l => l.code === locale.value)
  if (!loc) return ''
  return loc.name
})

const langItems = computed(() => [
  locales.value.map(loc => ({
    label: loc.name,
    icon: flagIcons[loc.code],
    active: locale.value === loc.code,
    onSelect: () => { setLocale(loc.code) },
  })),
])
</script>
