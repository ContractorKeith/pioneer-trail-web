import { describe, expect, it } from 'vitest'
import { createFishing, pullLine, tickFishing } from './fishing'
describe('fishing timing and line control', () => {
  it('requires a timely hook and controlled reeling to land the catch', () => {
    let state = pullLine(createFishing('18446744073709551615'))
    for (let i = 0; i < 360 && state.phase !== 'bite'; i++)
      state = tickFishing(state, 1 / 60, false)
    expect(state.phase).toBe('bite')
    state = pullLine(state)
    for (let i = 0; i < 1800 && state.phase === 'reeling'; i++)
      state = tickFishing(state, 1 / 60, state.tension < 0.65)
    expect(state.phase).toBe('landed')
  })
  it('loses a bite left unanswered and a line kept under too much tension', () => {
    let missed = pullLine(createFishing('1'))
    for (let i = 0; i < 600; i++) missed = tickFishing(missed, 1 / 60, false)
    expect(missed.phase).toBe('escaped')
    let line = { ...createFishing('1'), phase: 'reeling' as const }
    let state: ReturnType<typeof createFishing> = line
    for (let i = 0; i < 600; i++) state = tickFishing(state, 1 / 60, true)
    expect(state.phase).toBe('escaped')
  })
  it('resumes the exact bite and reel state at different render rates', () => {
    let state = pullLine(createFishing('25'))
    state = tickFishing(state, 2, false)
    const resumed = JSON.parse(JSON.stringify(state))
    expect(tickFishing(resumed, 0.5, false)).toEqual(tickFishing(state, 0.5, false))
  })
})
