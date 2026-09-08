import { describe, expect, it } from 'vitest'
import { SimulationClock } from './clock'
describe('game clock', () => {
  it('discards hidden time and bounds a stalled frame to six physics steps', () => {
    const clock = new SimulationClock()
    let ticks = 0
    clock.advance(20, true, () => ticks++)
    expect(ticks).toBe(0)
    clock.advance(1 / 60, false, () => ticks++)
    expect(ticks).toBe(1)
    clock.advance(20, false, () => ticks++)
    expect(ticks).toBe(7)
  })
  it('moves the same distance with 30, 60 and 144 Hz rendering', () => {
    for (const hz of [30, 60, 144]) {
      const clock = new SimulationClock()
      let distance = 0
      for (let frame = 0; frame < hz * 10; frame++)
        clock.advance(1 / hz, false, (dt) => (distance += 6 * dt))
      expect(distance).toBeCloseTo(60, 6)
    }
  })
})
