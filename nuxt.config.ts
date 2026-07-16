// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  srcDir: '.',

  devServer: {
    port: 4040,
  },

  modules: ['@nuxt/ui', '@nuxthub/core', '@nuxtjs/i18n'],

  i18n: {
    lazy: true,
    langDir: 'locales',
    defaultLocale: 'zh',
    strategy: 'no_prefix',
    locales: [
      { code: 'zh', iso: 'zh-CN', file: 'zh.json', name: '中文', flag: '🇨🇳' },
      { code: 'ja', iso: 'ja-JP', file: 'ja.json', name: '日本語', flag: '🇯🇵' },
    ],
    detectBrowserLanguage: false,
  },

  css: ['~/assets/css/main.css'],

  hub: {
    database: true,
  },

  nitro: {
    preset: 'cloudflare-pages',
    experimental: {
      openAPI: true,
    },
  },

  vite: {
    optimizeDeps: {
      include: ['monaco-editor', 'diff', 'nanoid'],
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            monaco: ['monaco-editor'],
          },
        },
      },
    },
  },

  app: {
    head: {
      title: 'CodeDiff - 在线代码差分高亮工具',
      meta: [
        { name: 'description', content: '在线代码差分对比工具，支持一键分享、密码加密、并排对比' },
      ],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
      ],
    },
  },
})
