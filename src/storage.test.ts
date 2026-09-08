import { describe, expect, it } from 'vitest'
import { loadSettings, readJourney, storeJourney } from './storage'

function memoryStorage(): Storage {
  const values = new Map<string, string>()
  return {
    get length() {
      return values.size
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (i) => [...values.keys()][i] ?? null,
    removeItem: (key) => {
      values.delete(key)
    },
    setItem: (key, value) => {
      values.set(key, value)
    },
  }
}

describe('browser persistence', () => {
  it('preserves large RNG integers byte for byte through browser storage', () => {
    const storage = memoryStorage()
    const save = '{"rng":{"seed":18446744073709551615,"word_pos":9999999999999999999}}'
    storeJourney(save, storage)
    expect(readJourney(storage)).toBe(save)
  })
  it('does not destroy the prior save when browser storage rejects a write', () => {
    const storage = memoryStorage()
    storeJourney('last valid journey', storage)
    storage.setItem = () => {
      throw new Error('QuotaExceededError')
    }
    expect(() => storeJourney('next journey', storage)).toThrow('QuotaExceededError')
    expect(readJourney(storage)).toBe('last valid journey')
  })
  it('recovers from invalid settings with muted defaults', () => {
    const storage = memoryStorage()
    storage.setItem('pioneer-trail:settings:v1', '{bad')
    expect(loadSettings(storage).sound).toBe(false)
  })
})
