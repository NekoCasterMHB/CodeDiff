/**
 * Monaco Editor worker setup for Vite/Nuxt
 */
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker'
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker'
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker'
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker'

let initialized = false

// Monaco locale support — preload NLS message files
const loadedLocales = new Set<string>()
export async function loadMonacoLocale(locale: string) {
  const map: Record<string, string> = { ja: 'ja' }
  const file = map[locale]
  if (!file || loadedLocales.has(file)) return
  loadedLocales.add(file)
  try {
    // NLS messages must be loaded before any editor creation
    self.MonacoEnvironment = self.MonacoEnvironment || {}
    await import(`monaco-editor/esm/nls.messages.${file}.js`)
  } catch {}
}

export function initMonacoWorkers() {
  if (initialized) return
  initialized = true

  self.MonacoEnvironment = {
    getWorker(_: string, label: string) {
      if (label === 'json') return new jsonWorker()
      if (label === 'css' || label === 'scss' || label === 'less') return new cssWorker()
      if (label === 'html' || label === 'handlebars' || label === 'razor') return new htmlWorker()
      if (label === 'typescript' || label === 'javascript') return new tsWorker()
      return new editorWorker()
    },
  }
}
