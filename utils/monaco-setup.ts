/**
 * Monaco Editor setup with @codingame/monaco-vscode-api
 * Provides VS Code-level localization via language packs.
 *
 * Language packs MUST be imported BEFORE monaco-editor imports.
 * Locale switching is done via page reload (setLocale callback).
 */

const availableLanguages = [
  { locale: 'en', languageName: 'English' },
  { locale: 'ja', languageName: '日本語' },
  { locale: 'zh-hans', languageName: '中文（简体）' },
]

let initialized = false

/**
 * Initialize Monaco with VS Code API and localization.
 * Must be called once before any editor creation.
 * Returns true if this was a fresh initialization.
 */
export async function initMonacoEnvironment(locale: string): Promise<boolean> {
  if (initialized) return false
  initialized = true

  // 1. Load language pack BEFORE monaco-vscode-api (critical for i18n)
  await loadLanguagePack(locale)

  // 2. Import and initialize the VS Code API layer
  const [{ initialize }, { default: getLocalizationServiceOverride }] = await Promise.all([
    import('@codingame/monaco-vscode-api'),
    import('@codingame/monaco-vscode-localization-service-override'),
  ])

  await initialize({
    ...getLocalizationServiceOverride({
      async setLocale(id: string) {
        // Reload page with locale param — simplest reliable approach
        const url = new URL(window.location.href)
        url.searchParams.set('locale', id)
        window.location.href = url.toString()
      },
      async clearLocale() {
        const url = new URL(window.location.href)
        url.searchParams.delete('locale')
        window.location.href = url.toString()
      },
      availableLanguages,
    }),
  })

  // 3. Setup web workers (using new URL() for @codingame compatibility)
  self.MonacoEnvironment = {
    getWorker(_: string, label: string) {
      switch (label) {
        case 'typescript':
        case 'javascript':
          return new Worker(
            new URL('monaco-editor/esm/vs/language/typescript/ts.worker.js', import.meta.url),
            { type: 'module' }
          )
        case 'json':
          return new Worker(
            new URL('monaco-editor/esm/vs/language/json/json.worker.js', import.meta.url),
            { type: 'module' }
          )
        case 'css':
        case 'scss':
        case 'less':
          return new Worker(
            new URL('monaco-editor/esm/vs/language/css/css.worker.js', import.meta.url),
            { type: 'module' }
          )
        case 'html':
        case 'handlebars':
        case 'razor':
          return new Worker(
            new URL('monaco-editor/esm/vs/language/html/html.worker.js', import.meta.url),
            { type: 'module' }
          )
        default:
          return new Worker(
            new URL('monaco-editor/esm/vs/editor/editor.worker.js', import.meta.url),
            { type: 'module' }
          )
      }
    },
  }

  return true
}

/**
 * Load the appropriate VSCode language pack.
 * Must be called BEFORE any @codingame/monaco-vscode-api import.
 */
async function loadLanguagePack(locale: string): Promise<void> {
  switch (locale) {
    case 'ja':
      await import('@codingame/monaco-vscode-language-pack-ja')
      break
    case 'zh':
      await import('@codingame/monaco-vscode-language-pack-zh-hans')
      break
    // en uses built-in English
  }
}
