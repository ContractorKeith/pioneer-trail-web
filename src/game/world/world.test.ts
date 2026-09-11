import * as THREE from 'three'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createWorld } from './index'
import type { WorldScene } from './index'
import { createTerrainField, regionKind } from './terrain'
import { loft } from './geometry'
import { initPhysics, MotionWorld } from '../physics'

describe('authored region contract', () => {
  const scene = new THREE.Scene()
  let world: WorldScene
  beforeAll(() => {
    world = createWorld(scene, { seed: 18, terrain: 'RiverValley', river: true, quality: 'low' })
  })
  afterAll(() => world.dispose())

  it('uses exactly the rendered ground triangles for collision height', () => {
    scene.updateMatrixWorld(true)
    const ground: THREE.Mesh[] = []
    scene.traverse((object) => {
      if (
        object instanceof THREE.Mesh &&
        !Array.isArray(object.material) &&
        object.material instanceof THREE.MeshStandardMaterial &&
        object.material.map &&
        object.geometry.getAttribute('color') &&
        !('isInstancedMesh' in object)
      )
        ground.push(object)
    })
    expect(ground.length).toBeGreaterThan(20)
    const ray = new THREE.Raycaster()
    for (const [x, z] of [
      [0, 20],
      [-7.1, 23.6],
      [0.82, 43.2],
      [-4.26, 82.72],
      [15.4, 55.6],
      [24.5, 34.1],
      [1.24, 108.38],
      [-2.83, 128.82],
      [1.58, 139.53],
      [-29.43, 210.22],
    ]) {
      ray.set(new THREE.Vector3(x, 100, z), new THREE.Vector3(0, -1, 0))
      const hit = ray.intersectObjects(ground, false)[0]
      expect(hit, `visible ground at ${x},${z}`).toBeDefined()
      expect(hit.point.y).toBeCloseTo(world.heightAt(x, z), 4)
    }
  })

  it('keeps the atmospheric shell inside the camera range at every view direction', () => {
    const sky = scene.getObjectByName('atmospheric-sky') as THREE.Mesh<
      THREE.SphereGeometry,
      THREE.ShaderMaterial
    >
    sky.geometry.computeBoundingSphere()
    expect(sky.geometry.boundingSphere!.radius).toBeLessThan(10)
    expect(sky.material.depthTest).toBe(false)
    const uniforms = sky.material.uniforms
    for (const light of [0, 0.06, 0.4, 1]) {
      world.update({
        dt: 1 / 60,
        time: 12,
        speed: 0,
        distance: 0,
        cameraPosition: new THREE.Vector3(0, 2, 20),
        sheltered: false,
        weather: 'clear',
        daylight: light,
      })
      expect(Number.isFinite(uniforms.daylight.value)).toBe(true)
      expect(uniforms.sunDirection.value.toArray().every(Number.isFinite)).toBe(true)
    }
  })

  it('preserves full daylight while raising the night lighting floor', () => {
    let hemi: THREE.HemisphereLight | undefined
    let moon: THREE.DirectionalLight | undefined
    scene.traverse((child) => {
      if (child instanceof THREE.HemisphereLight) hemi = child
      if (child instanceof THREE.DirectionalLight) moon = child
    })
    world.update({ dt: 1 / 60, time: 12, speed: 0, distance: 0, cameraPosition: new THREE.Vector3(), sheltered: false, weather: 'clear', daylight: 1 })
    expect(hemi!.intensity).toBeCloseTo(1.52)
    expect(scene.environmentIntensity).toBeCloseTo(0.54)
    expect(moon!.intensity).toBeCloseTo(0)
    world.update({ dt: 1 / 60, time: 12, speed: 0, distance: 0, cameraPosition: new THREE.Vector3(), sheltered: false, weather: 'clear', daylight: 0 })
    expect(hemi!.intensity).toBeCloseTo(0.42)
    expect(scene.environmentIntensity).toBeCloseTo(0.28)
    expect(moon!.intensity).toBeCloseTo(0.7)
  })

  it('exposes a traversable river, visible hazard IDs, and a dry bank interaction', () => {
    expect(world.river).toMatchObject({ startZ: 104, endZ: 136, depth: 1.2 })
    const bank = world.locations.find((location) => location.id === 'riverbank')!
    expect(bank.position[2]).toBeLessThan(world.river!.startZ)
    expect(world.heightAt(0, 120)).toBeLessThan(world.waterHeightAt(0, 120) - 1)
    expect(
      world.obstacles.filter((obstacle) => obstacle.id.startsWith('river-rock-')),
    ).toHaveLength(4)
    expect(
      world.obstacles.every(
        (obstacle) =>
          Number.isFinite(obstacle.y) &&
          obstacle.halfX > 0 &&
          obstacle.halfY > 0 &&
          obstacle.halfZ > 0,
      ),
    ).toBe(true)
  })

  it('keeps living wildlife and their full bodies on dry banks throughout their patrols', () => {
    const footprint = new THREE.Box3()
    const stream = createTerrainField('woodland', true)
    for (let time = 0; time < 360; time += 3) {
      world.update({
        dt: 1 / 60,
        time,
        speed: 0,
        distance: 0,
        cameraPosition: new THREE.Vector3(0, 2, 20),
        sheltered: false,
        weather: 'clear',
        daylight: 0.8,
      })
      for (const animal of world.wildlife) {
        footprint.setFromObject(animal.root)
        expect(
          footprint.max.z < world.river!.startZ - 1 || footprint.min.z > world.river!.endZ + 1,
          `${animal.id} enters crossing at time ${time}`,
        ).toBe(true)
        for (const z of [footprint.min.z, animal.position.z, footprint.max.z]) {
          expect(footprint.max.x, `${animal.id} enters side channel at time ${time}`).toBeLessThan(
            stream.streamX(z) - 5,
          )
        }
        expect(animal.position.y).toBeCloseTo(
          world.heightAt(animal.position.x, animal.position.z),
          5,
        )
      }
    }
  })

  it('recognizes actual tent and trader roof shelter regardless of view direction', () => {
    expect(world.shelteredAt(-10, world.heightAt(-10, 25.8) + 1.68, 25.8)).toBe(true)
    expect(world.shelteredAt(8.5, world.heightAt(8.5, 30.8) + 1.68, 30.8)).toBe(true)
    expect(world.shelteredAt(-13, world.heightAt(-13, 25.8) + 1.68, 25.8)).toBe(false)
    expect(world.shelteredAt(8.5, world.heightAt(8.5, 32) + 1.68, 32)).toBe(false)
    expect(world.shelteredAt(-10, world.heightAt(-10, 25.8) + 2.3, 25.8)).toBe(false)
  })

  it('retains restored carcass positions and hides animals only on collection', () => {
    const animal = world.wildlife[0]
    animal.alive = false
    animal.position.set(5.123, 0, 71.456)
    const frame = {
      dt: 1 / 60,
      time: 400,
      speed: 0,
      distance: 0,
      cameraPosition: new THREE.Vector3(0, 2, 20),
      sheltered: false,
      weather: 'clear' as const,
      daylight: 0.8,
    }
    world.update(frame)
    expect(animal.position.x).toBe(5.123)
    expect(animal.position.z).toBe(71.456)
    expect(animal.root.visible).toBe(true)
    animal.harvested = true
    world.update({ ...frame, time: 420 })
    expect(animal.root.visible).toBe(false)
  })

  it('rotates wagon wheels from actual signed distance, even at zero speed', () => {
    world.update({
      dt: 1 / 60,
      time: 10,
      speed: 0,
      distance: 3.9,
      cameraPosition: new THREE.Vector3(0, 2, 20),
      sheltered: false,
      weather: 'clear',
      daylight: 0.8,
    })
    const wheels = world.wagon.children.filter((child) => child.position.y === 0.78)
    expect(wheels).toHaveLength(4)
    wheels.forEach((wheel) => expect(wheel.rotation.x).toBeCloseTo(5))
    expect(world.seatLocal.toArray()).toEqual([0, 2.35, 0.5])
  })

  it('disposes region resources and removes owned scene objects idempotently', () => {
    const material = new THREE.SpriteMaterial(),
      sprite = new THREE.Sprite(material)
    world.wagon.add(sprite)
    let disposalCount = 0
    material.addEventListener('dispose', () => disposalCount++)
    let textured: THREE.MeshStandardMaterial | undefined
    scene.traverse((object) => {
      if (
        object instanceof THREE.Mesh &&
        object.material instanceof THREE.MeshStandardMaterial &&
        object.material.map
      )
        textured = object.material
    })
    expect(textured?.map).toBeDefined()
    let materialDisposals = 0,
      textureDisposals = 0
    textured!.addEventListener('dispose', () => materialDisposals++)
    textured!.map!.addEventListener('dispose', () => textureDisposals++)
    world.dispose()
    world.dispose()
    expect(disposalCount).toBe(1)
    expect(materialDisposals).toBe(1)
    expect(textureDisposals).toBe(1)
    expect(scene.children).toHaveLength(0)
    expect(scene.environment).toBeNull()
  })
})

it('lofted hero surfaces face outward and have finite normals', () => {
  const geometry = loft(
    [
      { z: -1, y: 0, rx: 1, ry: 1 },
      { z: 0, y: 0, rx: 1, ry: 1 },
      { z: 1, y: 0, rx: 1, ry: 1 },
    ],
    12,
    16,
  )
  const positions = geometry.getAttribute('position'),
    normals = geometry.getAttribute('normal')
  for (let i = 0; i < positions.count; i++) {
    expect(
      positions.getX(i) * normals.getX(i) + positions.getY(i) * normals.getY(i),
    ).toBeGreaterThan(0.9)
    expect(Number.isFinite(normals.getZ(i))).toBe(true)
  }
  geometry.dispose()
})

it('maps campaign terrain names and produces different region relief', () => {
  expect(
    ['Plains', 'Forest', 'RiverValley', 'Hills', 'Mountains', 'Desert'].map(regionKind),
  ).toEqual(['plains', 'woodland', 'woodland', 'mountains', 'mountains', 'desert'])
  const plains = createTerrainField('plains', false),
    mountains = createTerrainField('mountains', false)
  expect(mountains.heightAt(-65, 200) - mountains.heightAt(0, 200)).toBeGreaterThan(10)
  expect(plains.heightAt(-65, 200) - plains.heightAt(0, 200)).toBeLessThan(5)
})

it('can leave the captured Hills road contact and drive the sampled trail from spawn', async () => {
  await initPhysics()
  const world = createWorld(new THREE.Scene(), {
    seed: 19,
    terrain: 'Hills',
    river: false,
    quality: 'low',
  })
  const idle = { forward: 1, turn: 0, strafe: 0, brake: false, sprint: false }
  const starts = [
    { x: 0.15870369284219163, z: 33.93221768321818, yaw: 0.12208333333333499, speed: 0 },
    { x: 0, z: 20, yaw: 0, speed: 0 },
  ]
  const trail = Array.from({ length: 24 }, (_, i) => ({ x: world.trailX(i * 10), z: i * 10 }))
  try {
    for (const start of starts) {
      const physics = new MotionWorld(world)
      let pose = { ...start },
        turn = 0
      physics.setWagon(pose)
      try {
        for (let tick = 0; tick < 60 * 45 && pose.z < 225; tick++) {
          // Match the normal-input walkthrough's 200ms road observations and lookahead.
          if (tick % 12 === 0) {
            const target = trail.reduce((a, b) =>
              Math.abs(b.z - (pose.z + 14)) < Math.abs(a.z - (pose.z + 14)) ? b : a,
            )
            const desired = Math.atan2(target.x - pose.x, Math.max(8, target.z - pose.z))
            const delta = Math.atan2(Math.sin(desired - pose.yaw), Math.cos(desired - pose.yaw))
            turn = Math.abs(delta) > 0.04 ? Math.sign(delta) : 0
          }
          pose = physics.drive(pose, { ...idle, turn }, 1 / 60)
          expect(physics.lastObstacle, `Road contact from ${JSON.stringify(start)}`).toBeNull()
        }
        expect(pose.z).toBeGreaterThan(225)
        expect(physics.collisions).toBe(0)
      } finally {
        physics.dispose()
      }
    }
  } finally {
    world.dispose()
  }
})

it.each(
  ['Plains', 'Forest', 'Hills', 'Mountains', 'Desert'].flatMap((terrain) =>
    [11, 17, 19, 50, 64, 70].map((seed) => ({ terrain, seed })),
  ),
)('keeps the full rock footprints outside the road in $terrain seed $seed', ({ terrain, seed }) => {
  const world = createWorld(new THREE.Scene(), { terrain, seed, river: false, quality: 'low' })
  try {
    const rocks = world.obstacles.filter((obstacle) => obstacle.id.startsWith('rock-'))
    expect(rocks.length).toBeGreaterThan(0)
    for (const rock of rocks) {
      // Check the entire longitudinal footprint, including bends away from its center sample.
      for (let z = rock.z - rock.halfZ; z <= rock.z + rock.halfZ; z += 0.1) {
        const distance = Math.abs(rock.x - world.trailX(z)) - rock.halfX
        expect(distance, `${rock.id} intrudes into the road at z=${z}`).toBeGreaterThanOrEqual(4)
      }
    }
  } finally {
    world.dispose()
  }
})

it('preserves saved walkable space, visible solids and wildlife across graphics presets', async () => {
  await initPhysics()
  const recipes = []
  for (const quality of ['low', 'balanced', 'high'] as const) {
    const scene = new THREE.Scene()
    const world = createWorld(scene, { seed: 18, terrain: 'RiverValley', river: true, quality })
    const physics = new MotionWorld(world)
    try {
      expect(
        physics.canStand(12.368190390989184, 83.18313720519654),
        `${quality} blocks the saved walking position`,
      ).toBe(true)
      const visibleSolids: number[][] = []
      scene.traverse((object) => {
        if (
          object instanceof THREE.InstancedMesh &&
          object.material instanceof THREE.MeshStandardMaterial &&
          object.material.map
        )
          visibleSolids.push(Array.from(object.instanceMatrix.array))
      })
      world.update({
        dt: 1 / 60,
        time: 151,
        speed: 0,
        distance: 0,
        cameraPosition: new THREE.Vector3(0, 2, 20),
        sheltered: false,
        weather: 'clear',
        daylight: 0.8,
      })
      recipes.push({
        obstacles: structuredClone(world.obstacles),
        locations: structuredClone(world.locations),
        river: world.river,
        wildlife: world.wildlife.map((animal) => ({
          id: animal.id,
          animal: animal.animal,
          position: animal.position.toArray(),
        })),
        visibleSolids,
      })
    } finally {
      physics.dispose()
      world.dispose()
    }
  }
  // Seed 18's road-overlapping rock-77 was removed; retained solids still match at every preset.
  expect(recipes[0].obstacles).toHaveLength(317)
  expect(recipes[1]).toEqual(recipes[0])
  expect(recipes[2]).toEqual(recipes[0])
}, 15_000)

it('keeps whole wildlife bodies separated beside the captured seed 14 wagon', () => {
  const world = createWorld(new THREE.Scene(), {
    seed: 14,
    terrain: 'RiverValley',
    river: true,
    quality: 'low',
  })
  world.wagon.position.set(0, world.heightAt(0, 80.75527579283103), 80.75527579283103)
  const bounds = world.wildlife.map(() => new THREE.Box3())
  try {
    expect(world.wildlife.map((animal) => animal.id)).toEqual([
      'deer-0',
      'deer-1',
      'deer-2',
      'deer-3',
      'deer-4',
      'rabbit-5',
      'rabbit-6',
      'rabbit-7',
    ])
    const trunk = world.obstacles.find((solid) => solid.id === 'tree-1-62')!
    expect(trunk.x).toBeCloseTo(-4.0049016661942005, 10)
    expect(trunk.z).toBeCloseTo(93.80418059998192, 10)
    const times = [
      ...Array.from({ length: 481 }, (_, tick) => tick / 4),
      // Both patrol oscillations repeat within 3,500s (deer) / 1,750s (rabbits).
      ...Array.from({ length: 1168 }, (_, tick) => tick * 3),
    ]
    for (const time of times) {
      world.update({
        dt: 0.25,
        time,
        speed: 0,
        distance: 0,
        cameraPosition: new THREE.Vector3(
          -12.546666666666644,
          1.5100275466567414,
          89.87527579283002,
        ),
        sheltered: false,
        weather: 'clear',
        daylight: 0.8,
      })
      world.wildlife.forEach((animal, index) => bounds[index].setFromObject(animal.root))
      for (let a = 0; a < bounds.length; a++)
        for (let b = a + 1; b < bounds.length; b++)
          expect(
            bounds[a].intersectsBox(bounds[b]),
            `${world.wildlife[a].id} intersects ${world.wildlife[b].id} at ${time}s`,
          ).toBe(false)
    }
  } finally {
    world.dispose()
  }
}, 15_000)

it('keeps the exact bank trunk clear of deer geometry and reserves west escape corridors', () => {
  const world = createWorld(new THREE.Scene(), {
    seed: 14,
    terrain: 'RiverValley',
    river: true,
    quality: 'low',
  })
  world.wagon.position.z = -30
  const frame = {
    dt: 1 / 60,
    time: 0,
    speed: 0,
    distance: 0,
    cameraPosition: new THREE.Vector3(0, 2, 20),
    sheltered: false,
    weather: 'clear' as const,
    daylight: 0.8,
  }
  try {
    const tree = world.obstacles.find((obstacle) => obstacle.id === 'tree-1-62')!
    const ray = new THREE.Raycaster(
      new THREE.Vector3(tree.x, tree.y + tree.halfY + 2, tree.z),
      new THREE.Vector3(0, -1, 0),
    )
    for (const time of [150.75, 151, 151.25]) {
      world.update({ ...frame, time })
      const deer = world.wildlife.find((animal) => animal.id === 'deer-3')!
      deer.root.updateMatrixWorld(true)
      expect(
        ray
          .intersectObject(deer.root, true)
          .some((hit) => hit.point.y >= tree.y - tree.halfY && hit.point.y <= tree.y + tree.halfY),
        `deer-3 crosses the rendered trunk center at ${time}s`,
      ).toBe(false)
    }
    const corridors = world.wildlife.map(() => new THREE.Box3())
    const body = new THREE.Box3(),
      solid = new THREE.Box3()
    for (let time = 0; time <= 360; time += 3) {
      world.update({ ...frame, time })
      world.wildlife.forEach((animal, index) =>
        corridors[index].union(body.setFromObject(animal.root)),
      )
    }
    corridors.forEach((corridor, index) => {
      corridor.min.x -= 8
      for (const obstacle of world.obstacles) {
        solid.set(
          new THREE.Vector3(
            obstacle.x - obstacle.halfX,
            obstacle.y - obstacle.halfY,
            obstacle.z - obstacle.halfZ,
          ),
          new THREE.Vector3(
            obstacle.x + obstacle.halfX,
            obstacle.y + obstacle.halfY,
            obstacle.z + obstacle.halfZ,
          ),
        )
        expect(
          corridor.intersectsBox(solid),
          `${world.wildlife[index].id} corridor intersects ${obstacle.id}`,
        ).toBe(false)
      }
    })
  } finally {
    world.dispose()
  }
}, 15_000)

it('keeps living wildlife clear of the stopped and moving full wagon train on dry banks', () => {
  const world = createWorld(new THREE.Scene(), {
    seed: 14,
    terrain: 'RiverValley',
    river: true,
    quality: 'low',
  })
  const hero = new THREE.Box3(),
    animalBounds = new THREE.Box3()
  const previous = new Map<string, THREE.Vector3>()
  const field = createTerrainField('woodland', true)
  const frame = {
    dt: 1 / 60,
    time: 0,
    speed: 0,
    distance: 0,
    cameraPosition: new THREE.Vector3(0, 2, 80),
    sheltered: false,
    weather: 'clear' as const,
    daylight: 0.8,
  }
  try {
    for (let i = 0; i < 360; i++) {
      const moving = i >= 180
      const x = moving ? -5 + Math.sin(i * 0.04) * 6 : -2.713075673956288
      const z = moving ? 84 + Math.sin(i * 0.03) * 9 : 87.00364534825289
      world.wagon.position.set(x, world.heightAt(x, z), z)
      world.wagon.rotation.y = moving ? Math.sin(i * 0.025) : -0.424064606902989
      world.update({ ...frame, time: i / 4, speed: moving ? 3 : 0 })
      hero.setFromObject(world.wagon)
      const livingBounds = world.wildlife.map((animal) =>
        new THREE.Box3().setFromObject(animal.root),
      )
      for (let a = 0; a < livingBounds.length; a++)
        for (let b = a + 1; b < livingBounds.length; b++)
          expect(
            livingBounds[a].intersectsBox(livingBounds[b]),
            `${world.wildlife[a].id} overlaps ${world.wildlife[b].id} near the moving train`,
          ).toBe(false)
      for (const animal of world.wildlife) {
        animalBounds.setFromObject(animal.root)
        expect(hero.intersectsBox(animalBounds), `${animal.id} overlaps hero at ${i / 4}s`).toBe(
          false,
        )
        expect(animalBounds.max.z < 103 || animalBounds.min.z > 137).toBe(true)
        for (const animalZ of [animalBounds.min.z, animalBounds.max.z]) {
          expect(animalBounds.max.x).toBeLessThan(field.streamX(animalZ) - 5)
        }
        const last = previous.get(animal.id)
        // Frame 180 deliberately relocates the hero between two separate scenarios.
        if (last && i !== 180)
          expect(
            animal.position.distanceTo(last),
            `${animal.id} jumps between avoidance lanes`,
          ).toBeLessThan(2)
        previous.set(animal.id, animal.position.clone())
      }
    }
    world.update({ ...frame, time: 120 })
    const repeated = world.wildlife.map((animal) => animal.position.toArray())
    world.update({ ...frame, time: 400 })
    world.update({ ...frame, time: 120 })
    expect(world.wildlife.map((animal) => animal.position.toArray())).toEqual(repeated)
    const carcass = world.wildlife[3]
    carcass.alive = false
    carcass.position.copy(world.wagon.position)
    const restored = [carcass.position.x, carcass.position.z]
    world.update({ ...frame, time: 130 })
    expect([carcass.position.x, carcass.position.z]).toEqual(restored)
    carcass.harvested = true
    world.update({ ...frame, time: 140 })
    expect([carcass.position.x, carcass.position.z]).toEqual(restored)
    expect(carcass.root.visible).toBe(false)
  } finally {
    world.dispose()
  }
}, 15_000)

it('increases wildlife stride cadence when avoidance makes the body travel faster', () => {
  const cadence = (speed: number) => {
    const world = createWorld(new THREE.Scene(), {
      seed: 14,
      terrain: 'RiverValley',
      quality: 'low',
    })
    const animal = world.wildlife[0],
      body = animal.root.children[0]
    const z = animal.position.z
    let crossings = 0,
      previousRoll = 0,
      distance = 0
    const previous = new THREE.Vector3()
    try {
      for (let i = 0; i <= 90; i++) {
        world.wagon.position.set((-speed * i) / 30, 0, z)
        world.wagon.rotation.y = -Math.PI / 2
        world.update({
          dt: 1 / 30,
          time: 10 + i / 30,
          speed,
          distance: 0,
          cameraPosition: new THREE.Vector3(),
          sheltered: false,
          weather: 'clear',
          daylight: 0.8,
        })
        if (i > 0) {
          distance += animal.position.distanceTo(previous)
          if (body.rotation.z * previousRoll < 0) crossings++
        }
        previous.copy(animal.position)
        previousRoll = body.rotation.z
      }
      return { distance, crossings }
    } finally {
      world.dispose()
    }
  }
  const walking = cadence(0),
    retreating = cadence(3)
  expect(retreating.distance).toBeGreaterThan(walking.distance * 3)
  expect(retreating.crossings).toBeGreaterThan(walking.crossings + 3)
}, 15_000)
