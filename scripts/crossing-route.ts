import { MotionWorld, type Ground, type Pose } from '../src/game/physics'
import type { MoveInput } from '../src/game/contracts'

type River = { startZ: number; endZ: number; current: number }
type Direction = -1 | 0 | 1
export interface CrossingControl {
  forward: Direction
  turn: Direction
  brake: boolean
  seconds: number
}
type ExitPlan = {
  heading: number
  retreat: number
  origin: Pose
  stage: 'reverse' | 'brake' | 'forward'
}
const step = 1 / 60
const controlTicks = 9
const wrap = (angle: number) => Math.atan2(Math.sin(angle), Math.cos(angle))
const direction = (value: number): Direction => (value > 0 ? 1 : value < 0 ? -1 : 0)
const input = (control: CrossingControl): MoveInput => ({ ...control, strafe: 0, sprint: false })

/**
 * Verification-only far-bank driver. Call after z >= river.endZ - 10, with initialized physics.
 * Execute each returned control through normal keys, then provide the observed pose again.
 * The caller must stop when the live activity/region changes; null means the exit plane is crossed.
 */
export class CrossingExitDriver {
  private physics: MotionWorld
  private plan?: ExitPlan
  private previous?: Pose
  private stalled = 0
  private disposed = false

  constructor(
    ground: Ground,
    private river: River,
    private pace = 1,
  ) {
    this.physics = new MotionWorld(ground)
  }

  next(pose: Pose): CrossingControl | null {
    if (this.disposed) throw new Error('Crossing driver is disposed.')
    if (![pose.x, pose.z, pose.yaw, pose.speed].every(Number.isFinite))
      throw new Error('Crossing driver needs a finite observed pose.')
    if (pose.z > this.river.endZ + 8) return null
    if (!this.previous && pose.z < this.river.endZ - 10)
      throw new Error('Crossing exit driver starts at the far end of the channel.')
    if (pose.z < this.river.endZ - 14)
      throw new Error('Crossing recovery left the supported far-bank area.')
    if (this.previous && this.plan?.stage === 'forward') {
      const moved = Math.hypot(pose.x - this.previous.x, pose.z - this.previous.z)
      this.stalled = moved < 0.02 && Math.abs(pose.speed) < 0.1 ? this.stalled + 1 : 0
      // Contact can suppress motion without incrementing the runtime collision counter.
      if (this.stalled >= 3) this.plan = undefined
    }
    if (!this.plan) {
      this.plan = this.choosePlan(pose)
      this.stalled = 0
    }
    this.previous = { ...pose }
    return this.control(pose, this.plan)
  }

  private control(pose: Pose, plan: ExitPlan): CrossingControl {
    if (plan.stage === 'reverse') {
      const reversed =
        -(pose.x - plan.origin.x) * Math.sin(plan.origin.yaw) -
        (pose.z - plan.origin.z) * Math.cos(plan.origin.yaw)
      if (reversed < plan.retreat)
        return { forward: -1, turn: 0, brake: false, seconds: controlTicks * step }
      plan.stage = 'brake'
    }
    if (plan.stage === 'brake') {
      if (Math.abs(pose.speed) > 0.02)
        return { forward: 0, turn: 0, brake: true, seconds: controlTicks * step }
      plan.stage = 'forward'
    }
    const delta = wrap(plan.heading - pose.yaw)
    return {
      forward: 1,
      turn: Math.abs(delta) > 0.04 ? direction(delta) : 0,
      brake: false,
      seconds: controlTicks * step,
    }
  }

  private choosePlan(start: Pose): ExitPlan {
    // Try straight exits before spending time reversing. Every candidate uses complete train
    // sweeps, terrain grades and the same positional current condition as the live runtime.
    for (const retreat of [0, 1.2, 2.4]) {
      for (const heading of [0, -0.35, 0.35, -0.7, 0.7]) {
        const plan: ExitPlan = {
          heading,
          retreat,
          origin: { ...start },
          stage: retreat ? 'reverse' : 'forward',
        }
        if (this.canExit(start, structuredClone(plan))) return plan
      }
    }
    throw new Error(`No safe far-bank exit found from ${JSON.stringify(start)}.`)
  }

  private canExit(start: Pose, plan: ExitPlan): boolean {
    let pose = { ...start }
    this.physics.setWagon(pose)
    for (let ticks = 0; ticks < 900; ticks += controlTicks) {
      const control = this.control(pose, plan)
      for (let tick = 0; tick < controlTicks; tick++) {
        pose = this.physics.drive(
          pose,
          input(control),
          step,
          this.pace,
          pose.z > this.river.startZ && pose.z < this.river.endZ ? this.river.current : 0,
        )
        if (this.physics.lastObstacle) return false
        if (pose.z > this.river.endZ + 8.3) return true
        if (pose.z < this.river.endZ - 14 || Math.abs(pose.x) > 70) return false
      }
    }
    return false
  }

  dispose() {
    if (this.disposed) return
    this.disposed = true
    this.physics.dispose()
  }
}
