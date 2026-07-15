<template>
  <UApp>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>

<script setup lang="ts">
// Set dark mode as default
const colorMode = useColorMode()
if (import.meta.server) {
  colorMode.preference = 'dark'
  colorMode.value = 'dark'
}
</script>
