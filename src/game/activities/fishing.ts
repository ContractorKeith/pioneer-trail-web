/** A saved fishing attempt: player hook timing and line tension determine its result. */
export interface FishingState {
  phase: 'ready' | 'waiting' | 'bite' | 'reeling' | 'landed' | 'escaped'
  elapsed: number
  biteAt: number
  progress: number
  tension: number
}
export function createFishing(seed: string): FishingState {
  return {
    phase: 'ready',
    elapsed: 0,
    biteAt: 3 + Number(BigInt(seed) % 250n) / 100,
    progress: 0,
    tension: 0.2,
  }
}
export function pullLine(state: FishingState): FishingState {
  if (state.phase === 'ready') return { ...state, phase: 'waiting', elapsed: 0 }
  if (state.phase === 'bite') return { ...state, phase: 'reeling', elapsed: 0 }
  if (state.phase === 'waiting') return { ...state, phase: 'escaped' }
  return state
}
export function tickFishing(state: FishingState, dt: number, reeling: boolean): FishingState {
  if (['ready', 'landed', 'escaped'].includes(state.phase)) return state
  const next = { ...state, elapsed: state.elapsed + dt }
  if (next.phase === 'waiting' && next.elapsed >= next.biteAt) next.phase = 'bite'
  if (next.phase === 'bite' && next.elapsed > next.biteAt + 1.5) next.phase = 'escaped'
  if (next.phase === 'reeling') {
    next.tension = Math.max(
      0,
      next.tension + dt * (reeling ? 0.32 + Math.sin(next.elapsed * 2.1) * 0.12 : -0.52),
    )
    next.progress = Math.max(0, next.progress + dt * (reeling ? 0.16 : -0.025))
    if (next.tension >= 1 || next.elapsed > 30) next.phase = 'escaped'
    else if (next.progress >= 1) next.phase = 'landed'
  }
  return next
}
export function fishingHint(state: FishingState): string {
  return {
    ready: 'Space · Cast the line',
    waiting: 'Wait for the bobber to dip. Do not pull early.',
    bite: 'Bite! Press Space now to hook it.',
    reeling: 'Hold Space to reel. Release before tension reaches the red end.',
    landed: 'Catch landed.',
    escaped: 'The fish escaped.',
  }[state.phase]
}
