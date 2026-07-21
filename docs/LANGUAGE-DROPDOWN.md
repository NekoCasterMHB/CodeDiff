# 多语言切换下拉列表（带国旗图标）

## 安装依赖

```bash
pnpm add @iconify-json/openmoji
```

`@nuxt/ui` 会自动解析 Iconify 图标，无需额外引入 CSS。

## 完整代码

### `nuxt.config.ts`

```ts
// 无需额外配置，只需确保 modules 包含 @nuxt/ui
modules: ['@nuxt/ui', '@nuxthub/core', '@nuxtjs/i18n'],
```

### `app.vue` — Template

```vue
<template>
  <UApp>
    <UHeader>
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
        <!-- 其他按钮... -->
      </template>
    </UHeader>
  </UApp>
</template>
```

### `app.vue` — Script

```ts
import type { DropdownMenuItem } from '@nuxt/ui'

const { locale, locales, setLocale } = useI18n()

// ── 国旗图标映射 ──────────────────────────
const flagIcons: Record<string, string> = {
  ja: 'i-openmoji-flag-japan',
  zh: 'i-openmoji-flag-china',
  en: 'i-openmoji-flag-united-states',
}

// ── 当前语言代码（用于触发按钮图标） ────
const currentLangCode = computed(() => locale.value)

// ── 当前语言名称（用于触发按钮文字） ────
const currentLang = computed(() => {
  const loc = locales.value.find(l => l.code === locale.value)
  if (!loc) return ''
  return loc.name
})

// ── 下拉列表项 ──────────────────────────
const langItems = computed<DropdownMenuItem[][]>(() => [
  locales.value.map(loc => ({
    label: loc.name,
    icon: flagIcons[loc.code],     // ← 国旗图标自动显示
    active: locale.value === loc.code,
    onSelect: () => { setLocale(loc.code) },
  })),
])
```

### `nuxt.config.ts` — i18n 配置参考

```ts
i18n: {
  langDir: 'locales',
  defaultLocale: 'ja',
  strategy: 'no_prefix',
  locales: [
    { code: 'ja', iso: 'ja-JP', file: 'ja.json', name: '日本語' },
    { code: 'en', iso: 'en-US', file: 'en.json', name: 'English' },
    { code: 'zh', iso: 'zh-CN', file: 'zh.json', name: '中文' },
  ],
  detectBrowserLanguage: {
    useCookie: true,
    cookieKey: 'codediff-locale',
  },
},
```

## 关键点

| 项目 | 说明 |
|------|------|
| 图标命名 | `i-{集合名}-{图标名}`，如 `i-openmoji-flag-japan` |
| 触发按钮 | 用 `:icon` + `:label` + `trailing-icon` |
| 下拉项 | `DropdownMenuItem` 的 `icon` 属性自动渲染 |
| 图标集 | `@iconify-json/openmoji` — 方形，完整显示，全平台兼容 |

## 其他可用图标集

| 包名 | 示例 | 形状 |
|------|------|------|
| `@iconify-json/openmoji` | `i-openmoji-flag-japan` | 方形 ✅ |
| `@iconify-json/twemoji` | `i-twemoji-flag-japan` | 方形（可能被裁剪） |
| `@iconify-json/circle-flags` | `i-circle-flags-jp` | 圆形 |
| `@iconify-json/emojione` | `i-emojione-flag-for-japan` | 方形 |

切换图标集只需三步：

```bash
pnpm add @iconify-json/新包名     # 1. 安装
pnpm remove @iconify-json/旧包名  # 2. 卸载旧的
# 3. 修改 app.vue 中 flagIcons 映射值
```
