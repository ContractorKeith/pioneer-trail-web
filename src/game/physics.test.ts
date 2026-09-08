import { beforeAll, describe, expect, it } from 'vitest'
import { initPhysics, MotionWorld } from './physics'
import { SimulationClock } from './clock'
import { createTerrainField } from './world/terrain'

const idle = { forward: 0, turn: 0, strafe: 0, brake: false, sprint: false }
const ground = { heightAt: () => 0, length: 240, obstacles: [] }
beforeAll(initPhysics)
describe('wagon and walking movement', () => {
  it('travels and brakes from input with equivalent results at different render rates', () => {
    const results = [30, 60, 144].map((hz) => {
      const world = new MotionWorld(ground)
      const clock = new SimulationClock()
      let pose = { x: 0, z: 20, yaw: 0, speed: 0 }
      for (let frame = 0; frame < hz * 6; frame++)
        clock.advance(1 / hz, false, (dt) => {
          pose = world.drive(pose, { ...idle, forward: 1 }, dt)
        })
      expect(pose.z).toBeGreaterThan(45)
      for (let tick = 0; tick < 60; tick++)
        pose = world.drive(pose, { ...idle, brake: true }, 1 / 60)
      expect(pose.speed).toBe(0)
      world.dispose()
      return pose.z
    })
    expect(results[0]).toBeCloseTo(results[1], 6)
    expect(results[1]).toBeCloseTo(results[2], 6)
  })
  it('cannot drive through a visible solid obstacle even during sustained acceleration', () => {
    const world = new MotionWorld({
      ...ground,
      obstacles: [{ id: 'boulder', x: 0, y: 1, z: 35, halfX: 3, halfY: 2, halfZ: 2 }],
    })
    let pose = { x: 0, z: 20, yaw: 0, speed: 0 }
    for (let tick = 0; tick < 600; tick++) pose = world.drive(pose, { ...idle, forward: 1 }, 1 / 60)
    expect(pose.z).toBeLessThan(31)
    expect(world.collisions).toBeGreaterThan(0)
    expect(pose.speed).toBe(0)
    world.dispose()
  })
  it('lets a dismounted player circle the wagon but blocks walking into its interior', () => {
    const world = new MotionWorld(ground)
    world.setWagon({ x: 0, z: 20, yaw: 0, speed: 0 })
    expect(world.canStand(3, 20)).toBe(true)
    expect(world.canStand(0, 19)).toBe(false)
    let pose = { x: 4, z: 20, yaw: -Math.PI / 2, speed: 0 }
    for (let tick = 0; tick < 180; tick++) pose = world.walk(pose, { ...idle, forward: 1 }, 1 / 60)
    expect(pose.x).toBeGreaterThan(1.5)
    for (const [x, z] of [
      [4, 15],
      [4, 27],
      [-4, 27],
      [-4, 15],
    ])
      expect(world.canStand(x, z)).toBe(true)
    world.dispose()
  })
  it('cannot rotate the oxen through a wall and can reverse out after contact', () => {
    const world = new MotionWorld({
      ...ground,
      obstacles: [{ id: 'wall', x: 3, y: 1, z: 40, halfX: 0.3, halfY: 3, halfZ: 25 }],
    })
    let pose = { x: 0, z: 20, yaw: 0, speed: 0 }
    for (let i = 0; i < 600; i++) {
      pose = world.drive(pose, { ...idle, forward: 1, turn: 1 }, 1 / 60)
      // Outermost team corner cannot cross the wall's near face at x=2.7.
      const furthest =
        pose.x +
        Math.sin(pose.yaw) * 5.1 +
        Math.cos(pose.yaw) * 0.75 +
        Math.abs(Math.cos(pose.yaw)) * 0.42 +
        Math.abs(Math.sin(pose.yaw)) * 1.45
      expect(furthest).toBeLessThanOrEqual(2.701)
    }
    const stuck = { ...pose }
    for (let i = 0; i < 180; i++) pose = world.drive(pose, { ...idle, forward: -1 }, 1 / 60)
    expect(pose.z).toBeLessThan(stuck.z - 2)
    world.dispose()
  })

  it.each([81, 104])('can reverse to the bank after entering the current from z=%s', (startZ) => {
    const terrain = createTerrainField('woodland', true)
    const obstacles = [
      [0, -3.8, 112, 1.1],
      [1, 3.7, 122, 1.35],
      [2, -0.85, 131, 0.95],
      [3, 10.4, 117, 1.15],
    ].map(([id, x, z, size]) => ({
      id: `river-rock-${id}`,
      x,
      y: terrain.waterY(z) - 0.24,
      z,
      halfX: size * 0.91,
      halfY: size * 1.05,
      halfZ: size * 0.91,
    }))
    const world = new MotionWorld({ ...ground, heightAt: terrain.heightAt, obstacles })
    let pose = { x: 0, z: startZ, yaw: 0, speed: 0 }
    const current = () => (pose.z > 104 && pose.z < 136 ? 0.8 : 0)
    for (let tick = 0; tick < 690; tick++)
      pose = world.drive(pose, { ...idle, forward: 1 }, 1 / 60, 1, current())
    expect(world.collisions).toBeGreaterThan(0)
    expect(world.lastObstacle).toBe('river-rock-1')
    const contact = { ...pose }
    for (let tick = 0; tick < 720 && pose.z >= 100; tick++)
      pose = world.drive(pose, { ...idle, forward: -1 }, 1 / 60, 1, current())
    expect(
      pose.z,
      `reverse escape from ${JSON.stringify(contact)} reached ${JSON.stringify(pose)}`,
    ).toBeLessThan(contact.z - 2)
    expect(pose.z).toBeLessThan(100)
    expect(pose.speed).toBeLessThan(0)
    world.dispose()
  })

  it('recovers the captured corner contact without crossing the rock or losing its collision ID', () => {
    const terrain = createTerrainField('woodland', true)
    const rock = {
      id: 'river-rock-1',
      x: 3.7,
      y: terrain.waterY(122) - 0.24,
      z: 122,
      halfX: 1.35 * 0.91,
      halfY: 1.35 * 1.05,
      halfZ: 1.35 * 0.91,
    }
    const world = new MotionWorld({ ...ground, heightAt: terrain.heightAt, obstacles: [rock] })
    // Recorded from docs/evidence/caulk-reverse-failure.json after normal browser input.
    let pose = { x: 1.2737339677754465, z: 114.20004891725557, yaw: 0, speed: 0 }
    world.setWagon(pose)
    const contacts = new Set<string>()
    for (let tick = 0; tick < 240; tick++) {
      pose = world.drive(pose, { ...idle, forward: -1 }, 1 / 60, 1, 0.8)
      if (world.lastObstacle) contacts.add(world.lastObstacle)
      // Documented wagon and ox footprints at zero yaw remain disjoint from the rock.
      for (const [localX, localZ, halfX, halfZ] of [
        [0, -0.45, 1.25, 2.3],
        [-0.75, 5.1, 0.42, 1.45],
        [0.75, 5.1, 0.42, 1.45],
      ]) {
        const overlapX = Math.abs(pose.x + localX - rock.x) < halfX + rock.halfX - 0.001
        const overlapZ = Math.abs(pose.z + localZ - rock.z) < halfZ + rock.halfZ - 0.001
        expect(overlapX && overlapZ, `solid overlap on reverse tick ${tick}`).toBe(false)
      }
    }
    expect(pose.z).toBeLessThan(110)
    expect(contacts.has('river-rock-1')).toBe(true)
    world.dispose()
  })

  it('blocks a strong side current at a wall and reports that drift-only contact', () => {
    const world = new MotionWorld({
      ...ground,
      obstacles: [{ id: 'bank-rock', x: 3, y: 1, z: 20, halfX: 0.3, halfY: 3, halfZ: 10 }],
    })
    const pose = world.drive({ x: 0, z: 20, yaw: 0, speed: 0 }, idle, 0.1, 1, 100)
    expect(pose.x).toBeGreaterThan(1)
    expect(pose.x + 1.25).toBeLessThanOrEqual(2.701)
    expect(pose.z).toBe(20)
    expect(pose.speed).toBe(0)
    expect(world.lastObstacle).toBe('bank-rock')
    world.dispose()
  })

  it('cannot inch uphill beyond the grade limit from rest or a weak side current', () => {
    for (const sideCurrent of [false, true]) {
      const world = new MotionWorld({
        ...ground,
        heightAt: (x, z) => 0.8 * (sideCurrent ? x : z),
        obstacles: [],
      })
      let pose = { x: 0, z: 20, yaw: 0, speed: 0 }
      for (let tick = 0; tick < 120; tick++)
        pose = world.drive(
          pose,
          { ...idle, forward: sideCurrent ? 0 : 1 },
          1 / 60,
          1,
          sideCurrent ? 0.2 : 0,
        )
      expect(pose.x).toBe(0)
      expect(pose.z).toBe(20)
      expect(pose.speed).toBe(0)
      world.dispose()
    }
  })
})
