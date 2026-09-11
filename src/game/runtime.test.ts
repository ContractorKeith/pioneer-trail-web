import { describe, expect, it } from 'vitest'
import { elapsedAtNight } from './runtime'

describe('night evidence timing', () => {
  it('lands at the daylight trough on day five', () => {
    const day = 5
    const elapsed = elapsedAtNight(day)
    const light = 0.5 + 0.5 * Math.sin((day * 0.6 + elapsed * 0.009 + 0.65) % (Math.PI * 2))
    expect(light).toBeCloseTo(0)
  })
})
