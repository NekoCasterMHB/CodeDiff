<template>
  <div class="h-screen flex flex-col bg-background">
    <!-- Header -->
    <header class="flex items-center justify-between h-12 px-4 border-b border-border bg-elevated shrink-0">
      <div class="flex items-center gap-2">
        <div class="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
          <UIcon name="i-lucide-git-compare-arrows" class="w-4 h-4 text-primary-foreground" />
        </div>
        <span class="text-sm font-bold text-default">CodeDiff</span>
      </div>
      <UButton
        icon="i-lucide-sun-moon"
        size="sm"
        variant="ghost"
        color="neutral"
        @click="toggleTheme"
      />
    </header>

    <!-- Page -->
    <div class="flex-1 min-h-0">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
const colorMode = useColorMode()
function toggleTheme() {
  colorMode.preference = colorMode.preference === 'dark' ? 'light' : 'dark'
}
</script>
