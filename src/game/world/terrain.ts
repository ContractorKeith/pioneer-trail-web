import * as THREE from 'three'
import { bake, beam, ellipsoid, mesh, randomSeed } from './geometry'
import { noise } from './materials'
import type { Materials } from './materials'

export type RegionKind = 'plains' | 'woodland' | 'mountains' | 'desert'
export interface Obstacle {
  id: string
  x: number
  y: number
  z: number
  halfX: number
  halfY: number
  halfZ: number
}
export interface River {
  startZ: number
  endZ: number
  current: number
  depth: number
}
const smooth = (a: number, b: number, n: number) => THREE.MathUtils.smoothstep(n, a, b)

export function regionKind(terrain = 'Plains'): RegionKind {
  if (/mountain|hill/i.test(terrain)) return 'mountains'
  if (/forest|river|wood/i.test(terrain)) return 'woodland'
  if (/desert/i.test(terrain)) return 'desert'
  return 'plains'
}

export function createTerrainField(kind: RegionKind, crossing: boolean) {
  const trailX = (z: number) =>
    smooth(35, 75, z) * (Math.sin((z - 35) * 0.027) * 4.5 + Math.sin((z - 35) * 0.061) * 1.25)
  const trailY = (z: number) =>
    kind === 'mountains'
      ? Math.max(0, z - 42) * 0.033 + Math.sin(z * 0.031) * 0.37
      : Math.sin(z * 0.025) * 0.32 + Math.sin(z * 0.056) * 0.16
  const streamX = (z: number) => 23 + Math.sin(z * 0.028) * 3.5
  const river: River | null = crossing ? { startZ: 104, endZ: 136, current: 0.8, depth: 1.2 } : null
  const waterY = (z: number) =>
    crossing && z > 98 && z < 142 ? trailY(120) - 0.13 : trailY(z) - 0.24
  function authoredHeight(x: number, z: number) {
    const distance = Math.abs(x - trailX(z)),
      n = noise(x * 0.038, z * 0.042)
    const verge = smooth(2.4, 9, distance)
    let h = trailY(z) + ((n - 0.47) * 2 + Math.sin(x * 0.14 + z * 0.032) * 0.32) * verge
    h -= Math.exp(-Math.pow((distance - 0.82) * 6, 2)) * 0.043
    if (kind === 'mountains')
      h +=
        Math.pow(Math.max(0, distance - 13), 1.22) *
        0.15 *
        (0.6 + noise(x * 0.05, z * 0.045) * 0.75)
    if (kind === 'plains' || kind === 'desert')
      h += Math.pow(Math.max(0, distance - 27), 1.1) * 0.024 * noise(x * 0.032, z * 0.04)
    // A real side channel supplies fishing water in every playable region.
    const streamDistance = Math.abs(x - streamX(z))
    const bank = 1 - smooth(3.7, 6.5, streamDistance)
    const bed = waterY(z) - 0.95 + smooth(1, 5, streamDistance) * 0.82
    h = THREE.MathUtils.lerp(h, Math.min(h, bed), bank)
    if (crossing) {
      const bankBlend = smooth(98, 106, z) * (1 - smooth(134, 142, z))
      const channelBed = waterY(120) - 1.2 + noise(x * 0.07, z * 0.09) * 0.14
      h = THREE.MathUtils.lerp(h, channelBed, bankBlend)
    }
    // Camp furnishings share a contiguous gentle grade, clear of tufts and trees.
    for (const [cx, cz, radius] of [
      [-7, 23, 7],
      [7.5, 29, 5],
    ] as const) {
      const blend = 1 - smooth(radius - 1.5, radius, Math.hypot(x - cx, z - cz))
      h = THREE.MathUtils.lerp(h, trailY(cz), blend)
    }
    return h
  }
  // Collision and rendering use the same piecewise-linear triangles, including ruts.
  const step = 1,
    minX = -104,
    maxX = 104,
    minZ = -44,
    maxZ = 292
  const columns = (maxX - minX) / step + 1,
    rows = (maxZ - minZ) / step + 1
  const heights = new Float32Array(columns * rows)
  for (let iz = 0; iz < rows; iz++)
    for (let ix = 0; ix < columns; ix++)
      heights[iz * columns + ix] = authoredHeight(minX + ix * step, minZ + iz * step)
  function heightAt(x: number, z: number) {
    const gx = THREE.MathUtils.clamp((x - minX) / step, 0, columns - 1.00001),
      gz = THREE.MathUtils.clamp((z - minZ) / step, 0, rows - 1.00001)
    const ix = Math.floor(gx),
      iz = Math.floor(gz),
      fx = gx - ix,
      fz = gz - iz,
      at = iz * columns + ix
    const a = heights[at],
      b = heights[at + 1],
      c = heights[at + columns],
      d = heights[at + columns + 1]
    return fx + fz <= 1
      ? a + (b - a) * fx + (c - a) * fz
      : d + (c - d) * (1 - fx) + (b - d) * (1 - fz)
  }
  return {
    kind,
    trailX,
    trailY,
    streamX,
    waterY,
    river,
    heightAt,
    heights,
    step,
    minX,
    minZ,
    columns,
    rows,
  }
}

export type TerrainField = ReturnType<typeof createTerrainField>

function pineGeometry(m: Materials, variant: number) {
  const root = new THREE.Group(),
    foliage = new THREE.Group()
  const random = randomSeed(311 + variant)
  beam(root, [0, 0, 0], [0.045, 8, -0.04], 0.16, m.bark, 0.025, 9)
  const positions: number[] = [],
    uvs: number[] = []
  const triangle = (a: number[], b: number[], c: number[]) => {
    positions.push(...a, ...b, ...c)
    uvs.push(0, 0, 1, 0, 0.5, 1)
  }
  for (let tier = 0; tier < 9; tier++)
    for (let spoke = 0; spoke < 8; spoke++) {
      const y = 1.1 + tier * 0.76,
        angle = (spoke / 8) * Math.PI * 2 + tier * 1.81,
        length = (1 - tier / 11) * (1.3 + random() * 0.6)
      const dx = Math.cos(angle),
        dz = Math.sin(angle)
      beam(root, [0, y + 0.33, 0], [dx * length, y, dz * length], 0.025, m.bark, 0.004, 5)
      for (let feather = 0; feather < 7; feather++) {
        const t = feather / 7,
          centerX = dx * length * t,
          centerZ = dz * length * t,
          centerY = y + 0.35 * (1 - t)
        const width = (0.37 * (1 - t) + 0.075) * (1 - tier * 0.045)
        const endX = centerX + dx * 0.58,
          endZ = centerZ + dz * 0.58
        triangle(
          [centerX - dz * width, centerY + 0.04, centerZ + dx * width],
          [centerX + dz * width, centerY + 0.04, centerZ - dx * width],
          [endX, centerY + 0.13, endZ],
        )
        triangle(
          [centerX - dz * width, centerY, centerZ + dx * width],
          [endX, centerY + 0.13, endZ],
          [endX + dz * width * 0.4, centerY - 0.14, endZ - dx * width * 0.4],
        )
      }
    }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.computeVertexNormals()
  mesh(foliage, geometry, m.pine)
  root.add(foliage)
  return bake(root)
}

function oakGeometry(m: Materials, variant: number) {
  const root = new THREE.Group(),
    random = randomSeed(847 + variant)
  const positions: number[] = [],
    colors: number[] = [],
    uvs: number[] = []
  const matrix = new THREE.Matrix4(),
    orientation = new THREE.Quaternion(),
    point = new THREE.Vector3()
  beam(root, [0, 0, 0], [0.12, 4.7, -0.03], 0.27, m.bark, 0.075, 10)
  for (let limb = 0; limb < 8; limb++) {
    const a = limb * 2.4,
      reach = 1.3 + random() * 1.1,
      y = 2.4 + limb * 0.35,
      x = Math.cos(a) * reach,
      z = Math.sin(a) * reach
    beam(root, [0, y - 0.7, 0], [x, y + 0.7, z], 0.084, m.bark, 0.026, 7)
    for (let twig = 0; twig < 4; twig++) {
      const angle = a + twig * 1.8
      beam(
        root,
        [x * 0.65, y + 0.5, z * 0.65],
        [x + Math.cos(angle) * 0.83, y + 1.02 + twig * 0.12, z + Math.sin(angle) * 0.83],
        0.018,
        m.bark,
        0.004,
        5,
      )
    }
    // Individual bent diamond leaves make an airy crown with an irregular silhouette and real holes.
    for (let leaf = 0; leaf < 76; leaf++) {
      const azimuth = random() * Math.PI * 2,
        elevation = Math.acos(2 * random() - 1),
        r = 0.4 + Math.pow(random(), 0.38) * 0.9
      const px = x + Math.cos(azimuth) * Math.sin(elevation) * r * 1.25,
        py = y + 1.05 + Math.cos(elevation) * r * 0.83,
        pz = z + Math.sin(azimuth) * Math.sin(elevation) * r * 1.25
      orientation.setFromEuler(
        new THREE.Euler((random() - 0.5) * 1.9, random() * 6.28, (random() - 0.5) * 1.6),
      )
      const length = 0.36 + random() * 0.32,
        width = length * (0.36 + random() * 0.12)
      matrix.compose(new THREE.Vector3(px, py, pz), orientation, new THREE.Vector3(1, 1, 1))
      const vertices = [
        [0, 0, -length * 0.5],
        [-width, 0.018, 0],
        [0, 0.07, length * 0.08],
        [-width, 0.018, 0],
        [0, 0.022, length * 0.5],
        [0, 0.07, length * 0.08],
        [0, 0.022, length * 0.5],
        [width, 0, -0.04],
        [0, 0.07, length * 0.08],
        [width, 0, -0.04],
        [0, 0, -length * 0.5],
        [0, 0.07, length * 0.08],
      ]
      const color = new THREE.Color().setHSL(
        0.19 + random() * 0.075,
        0.28 + random() * 0.18,
        0.47 + random() * 0.19,
      )
      for (const [vx, vy, vz] of vertices) {
        point.set(vx, vy, vz).applyMatrix4(matrix)
        positions.push(point.x, point.y, point.z)
        const light = vy > 0.04 ? 1.09 : 0.92
        colors.push(color.r * light, color.g * light, color.b * light)
        uvs.push((vx / width) * 0.5 + 0.5, vz / length + 0.5)
      }
    }
  }
  const leaves = new THREE.BufferGeometry()
  leaves.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  leaves.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  leaves.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  leaves.computeVertexNormals()
  mesh(root, leaves, m.foliage)
  return bake(root)
}

function instancesOf(
  root: THREE.Group,
  template: THREE.Group,
  transforms: THREE.Matrix4[],
  colors?: THREE.Color[],
) {
  template.updateMatrixWorld(true)
  for (const source of template.children) {
    if (!(source instanceof THREE.Mesh)) continue
    const instance = new THREE.InstancedMesh(source.geometry, source.material, transforms.length)
    for (let i = 0; i < transforms.length; i++) {
      instance.setMatrixAt(i, transforms[i])
      if (colors) instance.setColorAt(i, colors[i])
    }
    instance.castShadow = source.material.name !== 'grass'
    instance.receiveShadow = true
    instance.computeBoundingSphere()
    root.add(instance)
  }
  template.clear()
}

export function createLandscape(
  field: TerrainField,
  m: Materials,
  quality: 'low' | 'balanced' | 'high',
  seed: number,
) {
  const root = new THREE.Group(),
    obstacles: Obstacle[] = [],
    random = randomSeed(seed)
  root.name = `region-${field.kind}`
  const windTime = { value: 0 }
  for (const material of [m.grass, m.foliage, m.pine]) {
    material.onBeforeCompile = (shader) => {
      shader.uniforms.trailWind = windTime
      shader.vertexShader = `uniform float trailWind;\n${shader.vertexShader}`.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        float windPhase = position.z * .7 + position.x * .43;
        #ifdef USE_INSTANCING
          windPhase += instanceMatrix[3].z * .13 + instanceMatrix[3].x * .22;
        #endif
        transformed.x += sin(trailWind * 1.5 + windPhase) * ${material === m.grass ? '.12 * pow(clamp(position.y,0.,1.),2.)' : '.012 * max(0.,position.y-2.)'};
      `,
      )
    }
    material.customProgramCacheKey = () =>
      material === m.grass ? 'trail-grass-v1' : 'trail-leaf-v1'
  }
  const { columns, rows, minX, minZ, step, heights } = field
  // Chunked terrain keeps distant or rear-facing ground outside the draw list.
  for (let chunkZ = 0; chunkZ < rows - 1; chunkZ += 48)
    for (let chunkX = 0; chunkX < columns - 1; chunkX += 48) {
      const w = Math.min(48, columns - chunkX - 1),
        d = Math.min(48, rows - chunkZ - 1)
      const positions: number[] = [],
        colors: number[] = [],
        uvs: number[] = [],
        indices: number[] = []
      for (let iz = 0; iz <= d; iz++)
        for (let ix = 0; ix <= w; ix++) {
          const x = minX + (chunkX + ix) * step,
            z = minZ + (chunkZ + iz) * step,
            y = heights[(chunkZ + iz) * columns + chunkX + ix]
          positions.push(x, y, z)
          uvs.push(x / 2.5, z / 2.5)
          const roadDistance = Math.abs(x - field.trailX(z)),
            n = noise(x * 0.35, z * 0.35)
          const isCamp = Math.hypot(x + 7, z - 23) < 6 || Math.hypot(x - 7.5, z - 29) < 4
          const road = 1 - smooth(1.75, 2.8 + n * 0.6, roadDistance)
          const vegetation = new THREE.Color(
            field.kind === 'woodland'
              ? '#72815b'
              : field.kind === 'desert'
                ? '#c4a171'
                : field.kind === 'mountains'
                  ? '#818376'
                  : '#9a9860',
          )
          const dirt = new THREE.Color('#bca383')
          const rut = Math.exp(-Math.pow((roadDistance - 0.85) * 4, 2))
          vegetation
            .lerp(dirt, Math.max(road, isCamp ? 0.8 : 0))
            .multiplyScalar(0.95 + n * 0.065 - rut * 0.09)
          if (field.kind === 'mountains' && y > 13)
            vegetation.lerp(new THREE.Color('#b1b0a4'), smooth(13, 28, y))
          colors.push(vegetation.r, vegetation.g, vegetation.b)
          if (ix < w && iz < d) {
            const i = iz * (w + 1) + ix
            indices.push(i, i + w + 1, i + 1, i + 1, i + w + 1, i + w + 2)
          }
        }
      const geometry = new THREE.BufferGeometry()
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
      geometry.setAttribute(
        'normal',
        new THREE.Float32BufferAttribute(new Float32Array(positions.length), 3),
      )
      geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
      geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
      geometry.setIndex(indices)
      geometry.computeVertexNormals()
      mesh(root, geometry, m.ground).castShadow = false
    }
  const clear = (x: number, z: number, margin = 0) =>
    Math.abs(x - field.trailX(z)) < 4 + margin ||
    Math.hypot(x + 7, z - 23) < 10 + margin ||
    Math.hypot(x - 7.5, z - 29) < 8 + margin ||
    Math.abs(x - field.streamX(z)) < 7 + margin ||
    (field.river !== null && z > 96 && z < 144)
  const dummy = new THREE.Object3D()
  // Trees are authored boughs and irregular crowns, never stacked blockout cones.
  for (let variant = 0; variant < 3; variant++) {
    const transforms: THREE.Matrix4[] = [],
      colors: THREE.Color[] = []
    // Solids use the original low recipe at every preset. Changing graphics settings
    // must not create a tree inside a saved walking position or shift later RNG draws.
    const count = field.kind === 'plains' ? 35 : field.kind === 'desert' ? 10 : 110
    for (let i = 0; i < count; i++) {
      const z = -30 + random() * 305,
        x = -90 + random() * 180
      if (clear(x, z, 0.8)) continue
      if (field.kind === 'plains' && Math.abs(x - field.streamX(z)) > 13 && random() < 0.8) continue
      const scale = 0.65 + random() * 0.65,
        y = field.heightAt(x, z)
      dummy.position.set(x, y - 0.045, z)
      dummy.rotation.set(0, random() * Math.PI * 2, 0)
      dummy.scale.set(scale, scale * (0.9 + random() * 0.2), scale)
      dummy.updateMatrix()
      transforms.push(dummy.matrix.clone())
      colors.push(
        new THREE.Color().setHSL(
          0.21 + random() * 0.04,
          0.05 + random() * 0.1,
          0.85 + random() * 0.12,
        ),
      )
      obstacles.push({
        id: `tree-${variant}-${i}`,
        x,
        y: y + 1.6 * scale,
        z,
        halfX: 0.25 * scale,
        halfY: 1.6 * scale,
        halfZ: 0.25 * scale,
      })
    }
    const template =
      field.kind === 'mountains' || (variant === 2 && field.kind === 'woodland')
        ? pineGeometry(m, variant)
        : oakGeometry(m, variant)
    instancesOf(root, template, transforms, colors)
  }
  // Broad low outcrops have the same authored footprints used by the collider list.
  const stones = new THREE.Group(),
    stoneGeo = new THREE.IcosahedronGeometry(1, 1)
  const stonePos = stoneGeo.getAttribute('position')
  for (let i = 0; i < stonePos.count; i++) {
    const factor =
      0.76 + noise(stonePos.getX(i) * 4, stonePos.getZ(i) * 4 + stonePos.getY(i)) * 0.24
    stonePos.setXYZ(
      i,
      stonePos.getX(i) * factor,
      stonePos.getY(i) * factor,
      stonePos.getZ(i) * factor,
    )
  }
  stoneGeo.computeVertexNormals()
  mesh(stones, stoneGeo, m.rock)
  const rockTransforms: THREE.Matrix4[] = []
  for (let i = 0; i < 180; i++) {
    const z = -25 + random() * 300,
      x = -86 + random() * 172
    if (clear(x, z, -0.3)) continue
    const scale = 0.22 + Math.pow(random(), 2) * (field.kind === 'mountains' ? 3.7 : 1.9),
      y = field.heightAt(x, z)
    dummy.position.set(x, y + scale * 0.16, z)
    dummy.rotation.set(0.1, random() * 6.28, 0.12)
    dummy.scale.set(scale, scale * 0.68, scale * 0.86)
    dummy.updateMatrix()
    rockTransforms.push(dummy.matrix.clone())
    if (scale > 0.65)
      obstacles.push({
        id: `rock-${i}`,
        x,
        y: y + scale * 0.36,
        z,
        halfX: scale * 0.61,
        halfY: scale * 0.37,
        halfZ: scale * 0.55,
      })
  }
  instancesOf(root, stones, rockTransforms)
  if (field.river) {
    for (const [i, x, z, size] of [
      [0, -3.8, 112, 1.1],
      [1, 3.7, 122, 1.35],
      [2, -0.85, 131, 0.95],
      [3, 10.4, 117, 1.15],
    ]) {
      const y = field.waterY(z) - 0.24
      const rock = ellipsoid(root, [size, size * 1.1, size * 0.94], [x, y, z], m.rock, 12)
      rock.rotation.y = i * 1.1
      obstacles.push({
        id: `river-rock-${i}`,
        x,
        y,
        z,
        halfX: size * 0.91,
        halfY: size * 1.05,
        halfZ: size * 0.91,
      })
    }
  }
  const reeds = new THREE.Group()
  for (let i = 0; i < 5; i++) {
    const x = Math.sin(i * 2.4) * 0.19,
      z = Math.cos(i * 2.4) * 0.19,
      h = 0.65 + i * 0.11
    beam(reeds, [x, 0, z], [x + 0.06, h, z], 0.009, m.grass, 0.007, 5)
    beam(reeds, [x + 0.06, h * 0.85, z], [x + 0.06, h + 0.09, z], 0.031, m.darkWood, 0.026, 7)
  }
  bake(reeds)
  const reedTransforms: THREE.Matrix4[] = []
  for (let i = 0; i < 160; i++) {
    const z = -20 + random() * 300,
      side = i % 2 ? -1 : 1,
      x = field.streamX(z) + side * (4.7 + random() * 0.6)
    if (field.river && z > 98 && z < 142) continue
    dummy.position.set(x, field.heightAt(x, z), z)
    dummy.rotation.set(0, random() * 6.28, 0)
    dummy.scale.setScalar(0.8 + random() * 0.4)
    dummy.updateMatrix()
    reedTransforms.push(dummy.matrix.clone())
  }
  instancesOf(root, reeds, reedTransforms)
  // Ground cover batches include tapered, curved blades and seed heads.
  const grassPositions: number[] = [],
    grassColors: number[] = [],
    grassUv: number[] = []
  for (let blade = 0; blade < 7; blade++) {
    const a = blade * 2.4,
      x = Math.cos(a) * 0.13,
      z = Math.sin(a) * 0.13,
      h = 0.26 + random() * 0.35,
      w = 0.022 + random() * 0.019
    const positions = [
      x - w,
      0,
      z,
      x + w,
      0,
      z,
      x + 0.07,
      h * 0.63,
      z + 0.015,
      x - w,
      0,
      z,
      x + 0.07,
      h * 0.63,
      z + 0.015,
      x + 0.015,
      h * 0.64,
      z + 0.015,
      x + 0.015,
      h * 0.64,
      z + 0.015,
      x + 0.07,
      h * 0.63,
      z + 0.015,
      x + 0.11,
      h,
      z + 0.04,
    ]
    grassPositions.push(...positions)
    for (let v = 0; v < 9; v++) {
      const shade = v === 8 ? 1.16 : positions[v * 3 + 1] > 0.1 ? 0.93 : 0.58
      grassColors.push(shade, shade, shade)
      grassUv.push(0, 0)
    }
  }
  const grassGeometry = new THREE.BufferGeometry()
  grassGeometry.setAttribute('position', new THREE.Float32BufferAttribute(grassPositions, 3))
  grassGeometry.setAttribute('color', new THREE.Float32BufferAttribute(grassColors, 3))
  grassGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(grassUv, 2))
  grassGeometry.computeVertexNormals()
  const grassCount = quality === 'low' ? 9000 : quality === 'high' ? 26000 : 18000
  // Separate 40m patches allow inexpensive frustum culling instead of one enormous instance bound.
  for (let patch = 0; patch < 7; patch++) {
    const transforms: THREE.Matrix4[] = []
    for (let i = 0; i < grassCount / 7; i++) {
      const z = -22 + patch * 42 + random() * 42,
        x = -59 + random() * 118
      const roadDistance = Math.abs(x - field.trailX(z)),
        streamDistance = Math.abs(x - field.streamX(z))
      if (
        roadDistance < 1.85 ||
        streamDistance < 5.1 ||
        Math.hypot(x + 7, z - 23) < 7 ||
        Math.hypot(x - 7.5, z - 29) < 5 ||
        (field.river && z > 99 && z < 141)
      )
        continue
      if (field.kind === 'desert' && random() < 0.8) continue
      const scale = 0.65 + random() * 0.8
      dummy.position.set(x, field.heightAt(x, z) - 0.01, z)
      dummy.rotation.set(0, random() * Math.PI * 2, 0)
      dummy.scale.set(scale, scale, scale)
      dummy.updateMatrix()
      transforms.push(dummy.matrix.clone())
    }
    const grass = new THREE.InstancedMesh(grassGeometry, m.grass, transforms.length)
    transforms.forEach((matrix, i) => grass.setMatrixAt(i, matrix))
    grass.receiveShadow = true
    grass.computeBoundingSphere()
    root.add(grass)
  }
  // Authored distant relief follows the region: rolling prairie, wooded ridges or alpine walls.
  const distantPositions: number[] = [],
    distantColors: number[] = []
  const distantHeight = (x: number, z: number) => {
    const band = Math.max(Math.abs(x) / 110, (z - 230) / 90)
    let h =
      (noise(x * 0.009, z * 0.008) * 0.65 + noise(x * 0.018, z * 0.016) * 0.35) *
      (field.kind === 'mountains' ? 185 : field.kind === 'woodland' ? 45 : 16)
    h *= smooth(0.8, 1.8, band)
    return h - 3
  }
  for (let z = -280; z < 800; z += 20)
    for (let x = -700; x < 700; x += 20) {
      if (x > -110 && x < 110 && z > -60 && z < 300) continue
      for (const [px, pz] of [
        [x, z],
        [x, z + 20],
        [x + 20, z],
        [x + 20, z],
        [x, z + 20],
        [x + 20, z + 20],
      ]) {
        const y = distantHeight(px, pz),
          color = new THREE.Color(field.kind === 'desert' ? '#9d8463' : '#687b67')
        if (field.kind === 'mountains')
          color
            .lerp(new THREE.Color('#93958d'), smooth(32, 90, y))
            .lerp(
              new THREE.Color('#dedfd7'),
              smooth(107 + noise(px * 0.035, pz * 0.035) * 25, 147, y),
            )
        distantPositions.push(px, y, pz)
        distantColors.push(color.r, color.g, color.b)
      }
    }
  const distant = new THREE.BufferGeometry()
  distant.setAttribute('position', new THREE.Float32BufferAttribute(distantPositions, 3))
  distant.setAttribute('color', new THREE.Float32BufferAttribute(distantColors, 3))
  distant.computeVertexNormals()
  mesh(
    root,
    distant,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }),
  ).castShadow = false
  return {
    root,
    obstacles,
    update(time: number) {
      windTime.value = time
    },
  }
}
