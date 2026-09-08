/** Fixed-step game time; hidden/menu frames must never bank future simulation. */
export class SimulationClock {
  private remainder = 0
  readonly timestep = 1 / 60

  advance(seconds: number, paused: boolean, step: (dt: number) => void): number {
    if (paused || !Number.isFinite(seconds) || seconds < 0) {
      this.remainder = 0
      return 0
    }
    this.remainder += Math.min(seconds, 0.1)
    while (this.remainder + 1e-10 >= this.timestep) {
      step(this.timestep)
      this.remainder = Math.max(0, this.remainder - this.timestep)
    }
    return this.remainder / this.timestep
  }
}
