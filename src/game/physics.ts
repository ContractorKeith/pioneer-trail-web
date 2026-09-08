import RAPIER from '@dimforge/rapier3d-compat'
import type { MoveInput } from './contracts'

export interface Obstacle {
  id: string
  x: number
  y: number
  z: number
  halfX: number
  halfY: number
  halfZ: number
}
export interface Pose {
  x: number
  z: number
  yaw: number
  speed: number
}
export interface Ground {
  heightAt(x: number, z: number): number
  obstacles: Obstacle[]
  length: number
}
let ready: Promise<void> | undefined
export function initPhysics() {
  return (ready ??= RAPIER.init())
}
const rotation = (yaw: number) => ({ x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) })

/** Terrain is sampled from the renderer's height function; Rapier sweeps block solid objects. */
export class MotionWorld {
  private world: RAPIER.World
  private wagonCollider: RAPIER.Collider
  private wagonShape = new RAPIER.Cuboid(1.25, 1.5, 2.3)
  private oxShape = new RAPIER.Cuboid(0.42, 0.85, 1.45)
  private oxColliders: RAPIER.Collider[] = []
  private playerShape = new RAPIER.Capsule(0.55, 0.3)
  readonly ground: Ground
  collisions = 0
  lastObstacle: string | null = null
  private obstacleNames = new Map<number, string>()

  constructor(ground: Ground) {
    this.ground = ground
    this.world = new RAPIER.World({ x: 0, y: 0, z: 0 })
    for (const obstacle of ground.obstacles) {
      const collider = this.world.createCollider(
        RAPIER.ColliderDesc.cuboid(obstacle.halfX, obstacle.halfY, obstacle.halfZ).setTranslation(
          obstacle.x,
          obstacle.y,
          obstacle.z,
        ),
      )
      this.obstacleNames.set(collider.handle, obstacle.id)
    }
    this.wagonCollider = this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(1.25, 1.5, 2.3).setTranslation(0, 1.5, 19.55),
    )
    this.oxColliders = [-0.75, 0.75].map((x) =>
      this.world.createCollider(
        RAPIER.ColliderDesc.cuboid(0.42, 0.85, 1.45).setTranslation(x, 0.85, 25.1),
      ),
    )
    this.world.step()
  }

  setWagon(pose: Pose) {
    const center = (x: number, z: number, y: number) => {
      const px = pose.x + Math.cos(pose.yaw) * x + Math.sin(pose.yaw) * z
      const pz = pose.z - Math.sin(pose.yaw) * x + Math.cos(pose.yaw) * z
      return { x: px, y: this.ground.heightAt(px, pz) + y, z: pz }
    }
    this.wagonCollider.setTranslation(center(0, -0.45, 1.55))
    this.wagonCollider.setRotation(rotation(pose.yaw))
    this.oxColliders.forEach((collider, index) => {
      collider.setTranslation(center(index ? 0.75 : -0.75, 5.1, 0.9))
      collider.setRotation(rotation(pose.yaw))
    })
    this.world.step()
  }

  private sweep(x: number, z: number, dx: number, dz: number, yaw: number, riding: boolean) {
    const pieces = riding
      ? [
          { x: 0, z: -0.45, y: 1.55, shape: this.wagonShape },
          { x: -0.75, z: 5.1, y: 0.9, shape: this.oxShape },
          { x: 0.75, z: 5.1, y: 0.9, shape: this.oxShape },
        ]
      : [{ x: 0, z: 0, y: 0.9, shape: this.playerShape }]
    let fraction = 1
    this.lastObstacle = null
    for (const piece of pieces) {
      const px = x + Math.cos(yaw) * piece.x + Math.sin(yaw) * piece.z
      const pz = z - Math.sin(yaw) * piece.x + Math.cos(yaw) * piece.z
      const hit = this.world.castShape(
        { x: px, y: this.ground.heightAt(px, pz) + piece.y, z: pz },
        rotation(yaw),
        { x: dx, y: 0, z: dz },
        piece.shape,
        0.035,
        1,
        false,
        undefined,
        undefined,
        undefined,
        undefined,
        riding
          ? (collider) =>
              collider.handle !== this.wagonCollider.handle &&
              !this.oxColliders.some((ox) => ox.handle === collider.handle)
          : undefined,
      )
      if (hit && hit.time_of_impact < fraction) {
        fraction = Math.max(0, hit.time_of_impact - 0.01)
        this.lastObstacle = this.obstacleNames.get(hit.collider.handle) ?? 'wagon'
      }
    }
    if (fraction < 0.98 && Math.hypot(dx, dz) > 0.001) this.collisions++
    return { x: x + dx * fraction, z: z + dz * fraction, blocked: fraction < 0.98 }
  }

  private rotationBlocked(pose: Pose, yaw: number): boolean {
    for (const part of [
      { x: 0, z: -0.45, y: 1.55, shape: this.wagonShape },
      { x: -0.75, z: 5.1, y: 0.9, shape: this.oxShape },
      { x: 0.75, z: 5.1, y: 0.9, shape: this.oxShape },
    ]) {
      const x = pose.x + Math.cos(yaw) * part.x + Math.sin(yaw) * part.z
      const z = pose.z - Math.sin(yaw) * part.x + Math.cos(yaw) * part.z
      const hit = this.world.intersectionWithShape(
        { x, y: this.ground.heightAt(x, z) + part.y, z },
        rotation(yaw),
        part.shape,
        undefined,
        undefined,
        undefined,
        undefined,
        (collider) =>
          collider.handle !== this.wagonCollider.handle &&
          !this.oxColliders.some((ox) => ox.handle === collider.handle),
      )
      if (hit) return true
    }
    return false
  }

  drive(pose: Pose, input: MoveInput, dt: number, pace = 1, current = 0): Pose {
    let speed = pose.speed
    if (input.brake) speed = Math.max(0, speed - dt * 12)
    else if (input.forward > 0) speed = Math.min(6.4 * pace, speed + dt * 2.5)
    else if (input.forward < 0) speed = Math.max(-1.8, speed - dt * 5)
    else speed *= Math.max(0, 1 - dt * 1.5)
    if (Math.abs(speed) < 0.025) speed = 0
    let yaw =
      pose.yaw + input.turn * dt * Math.min(Math.abs(speed) * 0.2, 0.8) * (speed < 0 ? -1 : 1)
    if (this.rotationBlocked(pose, yaw)) yaw = pose.yaw
    let dx = Math.sin(yaw) * speed * dt
    let dz = Math.cos(yaw) * speed * dt
    const oldY = this.ground.heightAt(pose.x, pose.z)
    const newY = this.ground.heightAt(pose.x + dx, pose.z + dz)
    const distance = Math.hypot(dx, dz)
    const slope = distance > 1e-8 ? (newY - oldY) / distance : 0
    if (slope > 0.65) {
      dx = 0
      dz = 0
      speed = 0
    } else if (slope > 0) {
      dx /= 1 + slope
      dz /= 1 + slope
    }
    const moved = this.sweep(pose.x, pose.z, dx, dz, yaw, true)
    const propulsionObstacle = this.lastObstacle
    let drifted = moved
    if (current !== 0) {
      let drift = current * dt
      const rise =
        this.ground.heightAt(moved.x + drift, moved.z) - this.ground.heightAt(moved.x, moved.z)
      const driftSlope = Math.abs(drift) > 1e-8 ? rise / Math.abs(drift) : 0
      if (driftSlope > 0.65) drift = 0
      else if (driftSlope > 0) drift /= 1 + driftSlope
      // A blocked side current must not cancel a valid reverse or tangent movement.
      if (drift !== 0) drifted = this.sweep(moved.x, moved.z, drift, 0, yaw, true)
      this.lastObstacle = propulsionObstacle ?? this.lastObstacle
    }
    const result = {
      x: Math.max(-85, Math.min(85, drifted.x)),
      z: Math.max(6, Math.min(this.ground.length - 5, drifted.z)),
      yaw,
      speed: moved.blocked ? 0 : speed,
    }
    this.setWagon(result)
    return result
  }

  walk(pose: Pose, input: MoveInput, dt: number): Pose {
    const normal = Math.max(1, Math.hypot(input.forward, input.strafe))
    const speed = input.sprint ? 5 : 3.2
    const dx =
      ((Math.sin(pose.yaw) * input.forward - Math.cos(pose.yaw) * input.strafe) * speed * dt) /
      normal
    const dz =
      ((Math.cos(pose.yaw) * input.forward + Math.sin(pose.yaw) * input.strafe) * speed * dt) /
      normal
    const rise =
      this.ground.heightAt(pose.x + dx, pose.z + dz) - this.ground.heightAt(pose.x, pose.z)
    if (rise > Math.hypot(dx, dz) * 0.9 + 0.02) return { ...pose, speed: 0 }
    const moved = this.sweep(pose.x, pose.z, dx, dz, pose.yaw, false)
    return {
      ...pose,
      x: Math.max(-85, Math.min(85, moved.x)),
      z: Math.max(4, Math.min(this.ground.length - 4, moved.z)),
      speed: Math.hypot(moved.x - pose.x, moved.z - pose.z) / dt,
    }
  }

  canStand(x: number, z: number): boolean {
    return !this.world.intersectionWithShape(
      { x, y: this.ground.heightAt(x, z) + 0.9, z },
      rotation(0),
      this.playerShape,
    )
  }
  dispose() {
    this.world.free()
  }
}
