export const SAVE_KEY = 'pioneer-trail:journey:v1'
export const SETTINGS_KEY = 'pioneer-trail:settings:v1'

export interface Settings {
  sound: boolean
  reducedMotion: boolean
}

// The Rust save is deliberately an opaque string: parsing its u64 RNG state in JS loses precision.
export function storeJourney(save: string, storage: Storage = localStorage): void {
  storage.setItem(SAVE_KEY, save)
}

export function readJourney(storage: Storage = localStorage): string | null {
  return storage.getItem(SAVE_KEY)
}

export function loadSettings(storage: Storage = localStorage): Settings {
  const defaults = {
    sound: false,
    reducedMotion:
      typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches,
  }
  try {
    const raw = storage.getItem(SETTINGS_KEY)
    if (!raw) return defaults
    const value = JSON.parse(raw)
    return {
      sound: typeof value.sound === 'boolean' ? value.sound : defaults.sound,
      reducedMotion:
        typeof value.reducedMotion === 'boolean' ? value.reducedMotion : defaults.reducedMotion,
    }
  } catch {
    return defaults
  }
}

export function downloadSave(save: string): void {
  const url = URL.createObjectURL(new Blob([save], { type: 'application/json' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'pioneer-trail-journey.json'
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
