<template>
  <UApp>
    <UHeader :ui="{ header: 'px-2!', container: 'w-full! max-w-full!' }">
      <template #left>
        <div class="flex items-center gap-2">
          <div class="w-7 h-7 rounded-lg bg-(--ui-primary) flex items-center justify-center cursor-pointer" @click="navigateTo('/')">
            <UIcon name="i-lucide-git-compare-arrows" class="w-4 h-4 text-(--ui-bg)" />
          </div>
          <span class="font-bold text-lg cursor-pointer" @click="navigateTo('/')">CodeDiff</span>
        </div>
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
          variant="soft"
          @click="shareOpen = true"
        >
          {{ $t('header.share') }}
        </UButton>
        <UButton
          icon="i-simple-icons-github"
          size="md"
          variant="ghost"
          color="neutral"
          to="https://github.com/NekoCasterMHB/CodeDiff"
          target="_blank"
          aria-label="GitHub"
        />
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

const langItems = computed<DropdownMenuItem[][]>(() => [
  locales.value.map(loc => ({
    label: loc.name,
    icon: flagIcons[loc.code],
    active: locale.value === loc.code,
    onSelect: () => { setLocale(loc.code) },
  })),
])
</script>
