import * as THREE from 'three'
import { createMaterials } from './materials'
import { disposeTree, randomSeed } from './geometry'
import type { Point } from './geometry'
import { createWagon, crate, barrel } from './wagon'
import { createLandscape, createTerrainField, regionKind } from './terrain'
import type { Obstacle, River } from './terrain'
import { createPerson, createTent, createTraderStall } from './people'
import { createAtmosphere, createFire, createWater } from './atmosphere'
import type { Weather } from './atmosphere'
import { createQuadruped, createRabbit } from './animals'

export type { Obstacle, River, Weather }
export type WorldQuality = 'low' | 'balanced' | 'high'
export interface WorldOptions {
  terrain?: string
  river?: boolean
  seed?: number
  /** Render density, shadows and particles only; physical layout and wildlife are invariant. */
  quality?: WorldQuality
}
export interface WorldLocation {
  id: string
  kind: 'camp' | 'trader' | 'water' | 'companion' | 'supplies'
  label: string
  position: Point
  radius: number
}
export interface Wildlife {
  id: string
  animal: 'Deer' | 'Rabbit'
  root: THREE.Group
  position: THREE.Vector3
  alive: boolean
  harvested?: boolean
}
export interface WorldFrame {
  dt: number
  time: number
  speed: number
  distance: number
  cameraPosition: THREE.Vector3
  sheltered: boolean
  weather: Weather
  daylight: number
}
export interface WorldScene {
  wagon: THREE.Group
  seatLocal: THREE.Vector3
  heightAt(x: number, z: number): number
  waterHeightAt(x: number, z: number): number
  shelteredAt(x: number, y: number, z: number): boolean
  trailX(z: number): number
  obstacles: Obstacle[]
  locations: WorldLocation[]
  wildlife: Wildlife[]
  river: River | null
  length: number
  update(frame: WorldFrame): void
  dispose(): void
}

/** One fully owned 240m region. The runtime owns world.wagon's world transform. */
export function createWorld(scene: THREE.Scene, options: WorldOptions = {}): WorldScene {
  const quality = options.quality || 'balanced',
    seed = options.seed ?? 1848,
    random = randomSeed(seed)
  const root = new THREE.Group()
  root.name = 'pioneer-region'
  scene.add(root)
  const materials = createMaterials(),
    field = createTerrainField(regionKind(options.terrain), Boolean(options.river))
  const landscape = createLandscape(field, materials, quality, seed),
    wagon = createWagon(materials),
    water = createWater(field)
  const originalFog = scene.fog,
    originalEnvironment = scene.environment,
    originalEnvironmentIntensity = scene.environmentIntensity
  const atmosphere = createAtmosphere(scene, quality, materials.ground)
  root.add(landscape.root, wagon.root, water.root, atmosphere.root)
  const position = (x: number, z: number): Point => [x, field.heightAt(x, z), z]
  const campPosition = position(-6.8, 21.5)
  const fire = createFire(materials, campPosition)
  root.add(fire.root)
  const tent = createTent(materials)
  tent.position.set(...position(-10, 25.8))
  tent.rotation.y = 0.34
  root.add(tent)
  const stall = createTraderStall(materials)
  stall.position.set(...position(8.5, 30))
  stall.rotation.y = Math.PI
  root.add(stall)
  const trader = createPerson(materials, true)
  trader.root.position.set(...position(8.4, 28.4))
  trader.root.rotation.y = -Math.PI * 0.8
  root.add(trader.root)
  const companion = createPerson(materials)
  companion.root.position.set(...position(-4.9, 25))
  companion.root.rotation.y = 0.5
  root.add(companion.root)
  const supplies = crate(materials, 0.9, 0.66, 0.77)
  supplies.position.set(...position(-8.8, 18.6))
  supplies.rotation.y = 0.15
  root.add(supplies)
  const cask = barrel(materials)
  cask.position.set(...position(-9.8, 18.4))
  root.add(cask)
  const locations: WorldLocation[] = [
    {
      id: 'campfire',
      kind: 'camp',
      label: 'Campfire · rest and survival',
      position: campPosition,
      radius: 3.3,
    },
    {
      id: 'trader',
      kind: 'trader',
      label: 'Trail trader',
      position: position(8.4, 28.4),
      radius: 3.2,
    },
    {
      id: 'companion',
      kind: 'companion',
      label: 'Talk with your party',
      position: position(-4.9, 25),
      radius: 2.7,
    },
    {
      id: 'supplies',
      kind: 'supplies',
      label: 'Wagon supplies and tools',
      position: position(-8.8, 18.6),
      radius: 2.6,
    },
    {
      id: 'fishing-water',
      kind: 'water',
      label: 'Riverbank · fish',
      position: position(field.streamX(34) - 6.1, 34),
      radius: 3.8,
    },
  ]
  if (field.river)
    locations.push({
      id: 'riverbank',
      kind: 'water',
      label: 'River crossing',
      position: position(field.trailX(field.river.startZ - 12), field.river.startZ - 12),
      radius: 5,
    })
  const obstacle = (
    id: string,
    x: number,
    z: number,
    halfX: number,
    halfY: number,
    halfZ: number,
  ) => landscape.obstacles.push({ id, x, y: field.heightAt(x, z) + halfY, z, halfX, halfY, halfZ })
  obstacle('supply-crate', -8.8, 18.6, 0.45, 0.34, 0.39)
  obstacle('supply-barrel', -9.8, 18.4, 0.31, 0.45, 0.31)
  obstacle('trader-table', 8.5, 29.5, 1.56, 0.45, 0.64)
  obstacle('trader-person', 8.4, 28.4, 0.21, 0.87, 0.18)
  obstacle('companion-person', -4.9, 25, 0.21, 0.87, 0.18)
  // Tent collider follows its low footprint; the entrance stays approachable.
  obstacle('tent-bedding', -10, 25.8, 1.36, 0.43, 1.36)
  const wildlife: Wildlife[] = [],
    actors: {
      actor: ReturnType<typeof createQuadruped> | ReturnType<typeof createRabbit>
      baseX: number
      baseZ: number
      phase: number
      dead: boolean
      strideDistance: number
      lastTime: number | null
    }[] = []
  const patrolX = 2.4,
    patrolZ = 2.8,
    bodyClearance = 1.3
  const clearingOffsets: { x: number; z: number }[] = []
  for (let x = -40; x <= 24; x += 2)
    for (let z = -24; z <= 24; z += 2) clearingOffsets.push({ x, z })
  clearingOffsets.sort(
    (a, b) => a.x * a.x + a.z * a.z * 1.5 - (b.x * b.x + b.z * b.z * 1.5) || a.x - b.x || a.z - b.z,
  )
  function clearing(x: number, z: number, rabbit: boolean) {
    const radius = rabbit ? 0.6 : 1.5,
      halfX = patrolX + radius + 0.35,
      halfZ = patrolZ + radius + 0.35,
      westEscape = 8.5
    const clear = (cx: number, cz: number) => {
      const minX = cx - halfX - westEscape,
        maxX = cx + halfX,
        minZ = cz - halfZ,
        maxZ = cz + halfZ
      if (minX < -94 || maxX > 85 || minZ < 12 || maxZ > 230) return false
      if (field.river && maxZ > field.river.startZ - 6 && minZ < field.river.endZ + 6) return false
      if (maxX > field.streamX(cz) - halfZ * 0.1 - 6.5) return false
      return landscape.obstacles.every(
        (solid) =>
          maxX < solid.x - solid.halfX ||
          minX > solid.x + solid.halfX ||
          maxZ < solid.z - solid.halfZ ||
          minZ > solid.z + solid.halfZ,
      )
    }
    for (const offset of clearingOffsets)
      if (clear(x + offset.x, z + offset.z)) return { x: x + offset.x, z: z + offset.z }
    // A dense local grove can use another existing clearing; never remove a solid.
    for (let cz = 20; cz <= 220; cz += 4)
      for (let cx = -76; cx <= 36; cx += 4) if (clear(cx, cz)) return { x: cx, z: cz }
    throw new Error('The authored region has no dry wildlife clearing')
  }
  for (let i = 0; i < 8; i++) {
    const rabbit = i >= 5,
      actor = rabbit ? createRabbit(materials) : createQuadruped(materials, 'deer', i % 2 === 0)
    let baseZ = i === 0 ? 45 : i === 5 ? 35 : 45 + i * 20 + random() * 9
    // Reserve the whole patrol and rotated body footprint outside the carved river banks.
    if (field.river) {
      const nearBank = field.river.startZ - 6 - patrolZ - bodyClearance - 0.5
      const farBank = field.river.endZ + 6 + patrolZ + bodyClearance + 0.5
      if (baseZ > nearBank && baseZ < farBank)
        baseZ = baseZ < (nearBank + farBank) / 2 ? nearBank : farBank
    }
    const nominalX = field.trailX(baseZ) + (i % 2 ? -1 : 1) * (6.5 + random() * 3)
    // The stream center moves at most 0.1m laterally per longitudinal meter.
    const streamLimit =
      field.streamX(baseZ) - 6.5 - patrolX - bodyClearance - 0.1 * (patrolZ + bodyClearance) - 0.2
    const cleared = clearing(Math.min(nominalX, streamLimit), baseZ, rabbit)
    const baseX = cleared.x
    baseZ = cleared.z
    actor.root.position.set(...position(baseX, baseZ))
    root.add(actor.root)
    const entry: Wildlife = {
      id: `${rabbit ? 'rabbit' : 'deer'}-${i}`,
      animal: rabbit ? 'Rabbit' : 'Deer',
      root: actor.root,
      position: actor.root.position,
      alive: true,
      harvested: false,
    }
    actor.root.traverse((child) => {
      child.userData.wildlifeId = entry.id
    })
    wildlife.push(entry)
    actors.push({
      actor,
      baseX,
      baseZ,
      phase: random() * Math.PI * 2,
      dead: false,
      strideDistance: 0,
      lastTime: null,
    })
  }
  const shelterPoint = new THREE.Vector3()
  function shelteredAt(x: number, y: number, z: number) {
    tent.worldToLocal(shelterPoint.set(x, y, z))
    const tentRoof = 2.06 * (1 - Math.abs(shelterPoint.x) / 1.75)
    if (
      Math.abs(shelterPoint.x) < 1.73 &&
      Math.abs(shelterPoint.z) < 1.73 &&
      shelterPoint.y >= 0 &&
      shelterPoint.y < tentRoof - 0.025
    )
      return true
    stall.worldToLocal(shelterPoint.set(x, y, z))
    const awningRoof = 2.55 - Math.tan(0.06) * shelterPoint.x
    return (
      Math.abs(shelterPoint.x) < 2.07 &&
      Math.abs(shelterPoint.z) < 1.39 &&
      shelterPoint.y >= 0 &&
      shelterPoint.y < awningRoof - 0.025
    )
  }
  // Deflect a patrol sideways before it reaches the complete wagon/oxen footprint.
  // This is a pure function of the current pose and patrol time, so reloads do not reroll paths.
  function avoidTrain(x: number, z: number, radius: number, prediction = 0, speed = 0) {
    const yaw = wagon.root.rotation.y,
      sin = Math.sin(yaw),
      cos = Math.cos(yaw),
      centerX = wagon.root.position.x + sin * (2 + prediction * speed),
      centerZ = wagon.root.position.z + cos * (2 + prediction * speed),
      halfX = Math.abs(cos) * 1.6 + Math.abs(sin) * 5 + radius + 0.3,
      halfZ = Math.abs(cos) * 5 + Math.abs(sin) * 1.6 + radius + 0.3,
      influence = 1 - THREE.MathUtils.smoothstep(Math.abs(z - centerZ), halfZ, halfZ + 12)
    if (influence === 0) return x
    // All patrols inhabit the stream's west bank. Their escape lane stays west,
    // independent of the wagon position: no side switching or reload state is needed.
    // Z never changes and X can only decrease, preserving both dry-bank guarantees.
    const clearX = Math.min(x, centerX - halfX)
    return THREE.MathUtils.lerp(x, clearX, influence)
  }
  let disposed = false
  function update(frame: WorldFrame) {
    if (disposed) return
    const { time, speed, distance, weather, cameraPosition, sheltered, daylight } = frame
    wagon.update(time, distance, speed, field.heightAt)
    atmosphere.update(time, daylight, weather, cameraPosition, sheltered)
    landscape.update(time)
    water.update(time)
    fire.update(time, weather)
    trader.update(time)
    companion.update(time + 5)
    wildlife.forEach((entry, i) => {
      const moving = actors[i],
        t = time * (entry.animal === 'Rabbit' ? 0.36 : 0.18) + moving.phase
      entry.root.visible = !entry.harvested
      if (entry.harvested) return
      if (entry.alive) {
        const radius = entry.animal === 'Rabbit' ? 0.6 : 1.5,
          z = moving.baseZ + Math.sin(t * 0.77) * patrolZ,
          x = avoidTrain(moving.baseX + Math.sin(t) * patrolX, z, radius),
          nextT = t + (entry.animal === 'Rabbit' ? 0.36 : 0.18) * 0.05,
          nextZ = moving.baseZ + Math.sin(nextT * 0.77) * patrolZ,
          nextX = avoidTrain(moving.baseX + Math.sin(nextT) * patrolX, nextZ, radius, 0.05, speed)
        const elapsed = moving.lastTime === null ? 0 : time - moving.lastTime,
          traveled = Math.hypot(x - entry.position.x, z - entry.position.z),
          continuous = elapsed > 0 && elapsed <= 1 && traveled < 12 * elapsed + 0.1,
          gaitSpeed = continuous ? traveled / elapsed : Math.hypot(nextX - x, nextZ - z) / 0.05
        // Stride follows actual displacement, including avoidance. Only visual phase resets
        // on a direct time seek; target positions remain a pure function of pose and time.
        if (continuous) moving.strideDistance += traveled
        else if (elapsed !== 0 || moving.lastTime === null) moving.strideDistance = time * 0.48
        moving.lastTime = time
        entry.position.set(x, field.heightAt(x, z), z)
        entry.root.rotation.set(0, Math.atan2(nextX - x, nextZ - z), 0)
        moving.actor.update(time, moving.strideDistance, gaitSpeed)
      }
      if (entry.alive) {
        moving.dead = false
      } else {
        if (!moving.dead) {
          entry.root.rotation.z = Math.PI / 2
          entry.position.y =
            field.heightAt(entry.position.x, entry.position.z) +
            (entry.animal === 'Rabbit' ? 0.18 : 0.32)
          moving.dead = true
        }
        moving.actor.update(time, time * 0.48, 0)
      }
    })
  }
  return {
    wagon: wagon.root,
    seatLocal: new THREE.Vector3(0, 2.35, 0.5),
    heightAt: field.heightAt,
    waterHeightAt: (_x: number, z: number) => field.waterY(z),
    shelteredAt,
    trailX: field.trailX,
    obstacles: landscape.obstacles,
    locations,
    wildlife,
    river: field.river,
    length: 240,
    update,
    dispose() {
      if (disposed) return
      disposed = true
      atmosphere.dispose()
      const released = disposeTree(root)
      // Dispose any palette material not used in this particular regional recipe.
      for (const material of Object.values(materials)) {
        for (const value of Object.values(material))
          if (value instanceof THREE.Texture && !released.textures.has(value)) {
            value.dispose()
            released.textures.add(value)
          }
        if (!released.materials.has(material)) material.dispose()
      }
      scene.fog = originalFog
      scene.environment = originalEnvironment
      scene.environmentIntensity = originalEnvironmentIntensity
    },
  }
}
