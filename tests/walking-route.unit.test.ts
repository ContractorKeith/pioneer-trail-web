import { beforeAll, expect, it } from 'vitest'
import { Scene } from 'three'
import { createWorld } from '../src/game/world'
import { initPhysics, MotionWorld, type Pose } from '../src/game/physics'
import { planWalkingRoute } from '../scripts/walking-route'

beforeAll(initPhysics)
const idle = { forward: 0, strafe: 0, turn: 0, brake: false, sprint: false }
const cases = Array.from({ length: 35 }, (_, i) => i + 11).flatMap((seed) =>
  [
    [-0.3, 79.8, -0.15],
    [0, 80.5, 0],
    [0.3, 81.5, 0.15],
  ].map(([x, z, yaw]) => ({
    seed,
    wagon: { x: x!, z: z!, yaw: yaw!, speed: 0 },
  })),
)

it.each(cases)(
  'walks to the bank around actual solids: seed $seed wagon $wagon',
  ({ seed, wagon }) => {
    const ground = createWorld(new Scene(), {
      seed,
      terrain: 'RiverValley',
      river: true,
      quality: 'low',
    })
    const physics = new MotionWorld(ground)
    physics.setWagon(wagon)
    try {
      const start = [-1, 1]
        .map((side) => ({
          x: wagon.x + Math.cos(wagon.yaw) * 3 * side,
          z: wagon.z - Math.sin(wagon.yaw) * 3 * side,
          yaw: wagon.yaw,
          speed: 0,
        }))
        .find((pose) => physics.canStand(pose.x, pose.z))
      expect(start, 'At least one normal dismount must be possible').toBeDefined()
      const bank = ground.locations.find((location) => location.id === 'riverbank')!.position
      const target = { x: bank[0], z: bank[2] + 2 }
      const route = planWalkingRoute(ground, wagon, start!, target)
      let pose: Pose = { ...start! },
        steps = 0
      for (const point of route) {
        for (
          let tries = 0;
          tries < 100 && Math.hypot(point.x - pose.x, point.z - pose.z) >= 0.14;
          tries++
        ) {
          const dx = point.x - pose.x,
            dz = point.z - pose.z
          const forward = Math.sin(pose.yaw) * dx + Math.cos(pose.yaw) * dz
          const right = -Math.cos(pose.yaw) * dx + Math.sin(pose.yaw) * dz
          const input =
            Math.abs(forward) > Math.abs(right)
              ? { ...idle, forward: Math.sign(forward) }
              : { ...idle, strafe: Math.sign(right) }
          // Real movement frames, including one-frame scheduling jitter between observations.
          const ms = Math.min(
            80,
            Math.max(16, (Math.max(Math.abs(forward), Math.abs(right)) / 3.2) * 1000),
          )
          for (let tick = 0; tick < Math.ceil((ms / 1000) * 60) + (steps % 2); tick++)
            pose = physics.walk(pose, input, 1 / 60)
          steps++
          expect(physics.lastObstacle).toBeNull()
        }
        expect(Math.hypot(point.x - pose.x, point.z - pose.z)).toBeLessThan(0.14)
      }
      expect(Math.hypot(pose.x - target.x, pose.z - target.z)).toBeLessThan(0.14)
      expect(physics.collisions).toBe(0)
    } finally {
      physics.dispose()
      ground.dispose()
    }
  },
)

it('plans an escape from the exact recorded Green River rock contact', () => {
  const ground = createWorld(new Scene(), {
    seed: 26,
    terrain: 'RiverValley',
    river: true,
    quality: 'low',
  })
  try {
    const wagon = {
      x: 0.2539057230648727,
      z: 80.52189851940904,
      yaw: 0.13472222222222224,
      speed: 0,
    }
    const start = { x: -1.2654302219447242, z: 91.64821075925462, yaw: wagon.yaw, speed: 0 }
    const bank = ground.locations.find((location) => location.id === 'riverbank')!.position
    const route = planWalkingRoute(ground, wagon, start, { x: bank[0], z: bank[2] + 2 })
    expect(route.length).toBeGreaterThan(0)
    expect(route[0]!.z).toBeLessThan(start.z)
    expect(planWalkingRoute(ground, wagon, start, start)).toEqual([])
  } finally {
    ground.dispose()
  }
})
