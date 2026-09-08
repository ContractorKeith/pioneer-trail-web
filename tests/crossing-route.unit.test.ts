import { beforeAll, expect, it } from 'vitest'
import { Scene } from 'three'
import { createWorld } from '../src/game/world'
import { initPhysics, MotionWorld, type Pose } from '../src/game/physics'
import { CrossingExitDriver } from '../scripts/crossing-route'

beforeAll(initPhysics)
const idle = { forward: 0, turn: 0, strafe: 0, brake: false, sprint: false }
const recorded: Pose = {
  x: -9.33869910447421,
  z: 139.37939811015195,
  yaw: 0.4861111111111138,
  speed: 0,
}

function crossing(seed: number) {
  return createWorld(new Scene(), { terrain: 'RiverValley', river: true, seed, quality: 'low' })
}

it('reproduces the recorded far-bank trap without relying on collision-count growth', () => {
  const ground = crossing(14),
    physics = new MotionWorld(ground)
  try {
    let pose = { ...recorded }
    physics.setWagon(pose)
    const beforeCollisions = physics.collisions
    for (let n = 0; n < 600; n++) pose = physics.drive(pose, { ...idle, forward: 1 }, 1 / 60)
    expect(pose).toEqual(recorded)
    expect(physics.lastObstacle).toBe('rock-94')
    expect(physics.collisions).toBe(beforeCollisions)
  } finally {
    physics.dispose()
    ground.dispose()
  }
})

function exit(seed: number, start: Pose, jitter = 0, pace = 1) {
  const ground = crossing(seed),
    physics = new MotionWorld(ground),
    driver = new CrossingExitDriver(ground, ground.river!, pace)
  let pose = { ...start },
    ticks = 0,
    calls = 0
  const contacts = new Set<string>()
  const controls = []
  physics.setWagon(pose)
  try {
    while (ticks < 60 * 25) {
      const control = driver.next(pose)
      if (!control) break
      controls.push(control)
      expect([-1, 0, 1]).toContain(control.forward)
      expect([-1, 0, 1]).toContain(control.turn)
      const count = Math.round(control.seconds * 60) + (calls++ % 2 ? jitter : 0)
      for (let n = 0; n < count; n++) {
        pose = physics.drive(
          pose,
          { ...idle, ...control },
          1 / 60,
          pace,
          pose.z > ground.river!.startZ && pose.z < ground.river!.endZ ? ground.river!.current : 0,
        )
        if (physics.lastObstacle) contacts.add(physics.lastObstacle)
        ticks++
        // The real runtime commits and replaces the region as soon as this plane is crossed.
        if (pose.z > ground.river!.endZ + 8) break
      }
      if (pose.z > ground.river!.endZ + 8) break
    }
    expect(pose.z).toBeGreaterThan(ground.river!.endZ + 8)
    expect(driver.next(pose)).toBeNull()
    expect([...contacts]).toEqual([])
    return { ticks, controls }
  } finally {
    driver.dispose()
    driver.dispose()
    physics.dispose()
    ground.dispose()
  }
}

it.each([0, 1, 3])('exits the exact recorded contact with %i extra scheduling frames', (jitter) => {
  const result = exit(14, recorded, jitter)
  expect(result.ticks).toBeLessThan(60 * 10)
})

it.each(Array.from({ length: 35 }, (_, i) => i + 11))(
  'crosses the far bank through actual seed %i geometry and current',
  (seed) => {
    exit(seed, { x: -7, z: 130, yaw: 0.12, speed: 5.8 }, 2)
  },
)

it.each([14, 26, 29, 41].flatMap((seed) => [1, 1.15, 1.3].map((pace) => ({ seed, pace }))))(
  'exits from the channel entry in seed $seed at pace $pace',
  ({ seed, pace }) => {
    exit(seed, { x: -7, z: 127, yaw: 0.2, speed: 6.4 * pace }, 3, pace)
  },
)

it('rejects an approach outside its scope and never reports an unfinished crossing as complete', () => {
  const ground = crossing(14),
    driver = new CrossingExitDriver(ground, ground.river!)
  try {
    expect(() => driver.next({ ...recorded, z: 80 })).toThrow('far end')
    expect(() => driver.next({ ...recorded, z: NaN })).toThrow('finite')
    expect(driver.next({ x: 0, z: 144, yaw: 0, speed: 0 })).not.toBeNull()
    expect(driver.next({ x: 0, z: 144.001, yaw: 0, speed: 0 })).toBeNull()
  } finally {
    driver.dispose()
    ground.dispose()
  }
})
