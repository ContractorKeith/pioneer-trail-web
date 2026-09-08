import * as THREE from 'three'
import { bake, beam, box, curve, ellipsoid, mesh } from './geometry'
import type { Point } from './geometry'
import type { Materials } from './materials'
import { createQuadruped } from './animals'

export function barrel(m: Materials) {
  const group = new THREE.Group()
  const profile = [
    [0, 0],
    [0.29, 0],
    [0.31, 0.06],
    [0.35, 0.3],
    [0.36, 0.5],
    [0.34, 0.73],
    [0.29, 0.9],
    [0, 0.9],
  ].map((p) => new THREE.Vector2(...(p as [number, number])))
  mesh(group, new THREE.LatheGeometry(profile, 24), m.oak)
  for (const y of [0.09, 0.24, 0.68, 0.82]) {
    const radius = y < 0.2 || y > 0.8 ? 0.309 : 0.344
    mesh(
      group,
      new THREE.CylinderGeometry(radius + 0.012, radius + 0.012, 0.043, 24, 1, true),
      m.iron,
      [0, y, 0],
    )
  }
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * Math.PI * 2
    curve(
      group,
      [
        [Math.cos(a) * 0.297, 0.03, Math.sin(a) * 0.297],
        [Math.cos(a) * 0.359, 0.44, Math.sin(a) * 0.359],
        [Math.cos(a) * 0.297, 0.88, Math.sin(a) * 0.297],
      ],
      0.0035,
      m.darkWood,
      10,
    )
  }
  mesh(group, new THREE.CylinderGeometry(0.288, 0.288, 0.025, 24), m.paleWood, [0, 0.9, 0])
  mesh(group, new THREE.CylinderGeometry(0.034, 0.034, 0.035, 12), m.darkWood, [0.1, 0.92, 0.04])
  return bake(group)
}

export function crate(m: Materials, width = 0.7, height = 0.55, depth = 0.65) {
  const group = new THREE.Group()
  box(group, [width - 0.04, height - 0.02, depth - 0.04], [0, height / 2, 0], m.darkWood)
  for (let j = 0; j < 4; j++) {
    const y = 0.06 + (j * (height - 0.1)) / 3
    for (const sign of [-1, 1]) {
      box(group, [width, height / 4 - 0.016, 0.034], [0, y, (sign * depth) / 2], m.oak)
      box(group, [0.034, height / 4 - 0.016, depth], [(sign * width) / 2, y, 0], m.paleWood)
    }
  }
  for (const sign of [-1, 1])
    for (const z of [-depth / 2, depth / 2]) {
      box(group, [0.065, height, 0.025], [sign * width * 0.37, height / 2, z * 1.04], m.paleWood)
      for (const y of [0.08, height - 0.07])
        ellipsoid(group, [0.012, 0.012, 0.008], [sign * width * 0.37, y, z * 1.08], m.iron, 8)
    }
  for (let i = 0; i < 5; i++)
    box(group, [width / 5 - 0.01, 0.04, depth], [-width * 0.4 + (i * width) / 5, height, 0], m.oak)
  return bake(group)
}

function wheel(m: Materials, radius: number) {
  const group = new THREE.Group(),
    fixed = new THREE.Group()
  group.add(fixed)
  // Wheel axis is X; rim is a proper broad iron tire over a wooden felloe.
  for (const [r, thickness, material] of [
    [radius - 0.045, 0.069, m.paleWood],
    [radius, 0.023, m.iron],
  ] as const) {
    const ring = mesh(fixed, new THREE.TorusGeometry(r, thickness, 8, 48), material)
    ring.rotation.y = Math.PI / 2
    ring.scale.z = material === m.iron ? 3.4 : 1.4
  }
  beam(fixed, [-0.15, 0, 0], [0.16, 0, 0], 0.135, m.darkWood, 0.115, 16)
  for (const sign of [-1, 1])
    beam(fixed, [sign * 0.13, 0, 0], [sign * 0.16, 0, 0], 0.145, m.iron, 0.145, 16)
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2
    beam(
      fixed,
      [0, Math.cos(a) * 0.11, Math.sin(a) * 0.11],
      [0, Math.cos(a) * (radius - 0.07), Math.sin(a) * (radius - 0.07)],
      0.027,
      m.paleWood,
      0.041,
      6,
    )
    const seam = mesh(
      fixed,
      new THREE.TorusGeometry(radius - 0.045, 0.007, 4, 3, 0.055),
      m.darkWood,
    )
    seam.rotation.set(a, Math.PI / 2, 0)
  }
  return bake(fixed).parent as THREE.Group
}

export function createWagon(m: Materials) {
  const root = new THREE.Group(),
    frame = new THREE.Group()
  root.name = 'covered-wagon'
  root.add(frame)
  for (let i = 0; i < 10; i++)
    box(frame, [0.214, 0.105, 3.75], [-0.99 + i * 0.22, 1.15, -0.45], i % 3 ? m.oak : m.paleWood)
  for (const sign of [-1, 1]) {
    box(frame, [0.16, 0.24, 3.85], [sign * 0.72, 0.98, -0.45], m.darkWood)
    for (let j = 0; j < 4; j++)
      box(
        frame,
        [0.075, 0.155, 3.74],
        [sign * 1.11, 1.31 + j * 0.178, -0.47],
        j % 2 ? m.oak : m.paleWood,
      )
    for (const z of [-2.25, -1.18, -0.07, 1.35]) {
      box(frame, [0.12, 0.82, 0.105], [sign * 1.16, 1.55, z], m.darkWood)
      for (const y of [1.27, 1.76]) {
        box(frame, [0.023, 0.1, 0.13], [sign * 1.23, y, z], m.iron)
        const nail = mesh(frame, new THREE.CylinderGeometry(0.022, 0.022, 0.022, 8), m.iron, [
          sign * 1.25,
          y,
          z,
        ])
        nail.rotation.z = Math.PI / 2
      }
    }
    box(frame, [0.105, 0.09, 3.85], [sign * 1.12, 1.93, -0.45], m.paleWood)
    // Step, handhold and metal brackets make boarding physically legible.
    box(frame, [0.47, 0.055, 0.46], [sign * 1.37, 0.57, 0.57], m.darkWood)
    for (const z of [0.36, 0.77])
      beam(frame, [sign * 1.11, 1.1, z], [sign * 1.52, 0.6, z], 0.023, m.iron)
    curve(
      frame,
      [
        [sign * 1.2, 1.58, 0.96],
        [sign * 1.3, 1.87, 0.98],
        [sign * 1.3, 2.08, 1.13],
        [sign * 1.16, 1.93, 1.29],
      ],
      0.027,
      m.iron,
      12,
    )
  }
  // Rear tailgate, hinges and latch.
  for (let i = 0; i < 4; i++) box(frame, [2.2, 0.16, 0.09], [0, 1.31 + i * 0.18, -2.31], m.oak)
  for (const x of [-0.76, 0.76]) {
    box(frame, [0.065, 0.59, 0.03], [x, 1.51, -2.37], m.iron)
    beam(frame, [x - 0.1, 1.2, -2.39], [x + 0.1, 1.2, -2.39], 0.032, m.iron)
  }
  box(frame, [0.24, 0.07, 0.034], [0, 1.85, -2.4], m.iron)
  // Broad bench at a credible seated eye height, open view onto the team.
  box(frame, [2.19, 0.14, 0.56], [0, 1.59, 0.36], m.paleWood)
  box(frame, [1.98, 0.055, 0.49], [0, 1.69, 0.34], m.leather, 0.03)
  for (const x of [-0.82, 0.82]) box(frame, [0.12, 0.41, 0.41], [x, 1.36, 0.35], m.darkWood)
  box(frame, [1.91, 0.075, 0.58], [0, 1.06, 1.56], m.paleWood)
  box(frame, [2.2, 0.18, 0.16], [0, 1.38, 1.41], m.oak)
  for (const z of [-1.58, 0.97]) {
    beam(frame, [-1.4, 0.78, z], [1.4, 0.78, z], 0.077, m.iron)
    box(frame, [1.72, 0.2, 0.2], [0, 0.86, z], m.darkWood)
    for (const x of [-0.72, 0.72])
      curve(
        frame,
        [
          [x, 1.02, z - 0.42],
          [x, 0.91, z],
          [x, 1.02, z + 0.42],
        ],
        0.028,
        m.iron,
        10,
      )
  }
  for (const sign of [-1, 1])
    beam(frame, [sign * 0.7, 0.92, 1.31], [sign * 0.22, 1.08, 5.75], 0.055, m.oak, 0.045)
  beam(frame, [0, 1.08, 4.6], [0, 1.72, 5.85], 0.041, m.iron)
  // Canvas is a tailored arched shell with subtle sag between each bent-wood hoop.
  const positions: number[] = [],
    uvs: number[] = [],
    indices: number[] = []
  const arches = 40,
    lengths = 36
  for (let j = 0; j <= lengths; j++)
    for (let i = 0; i <= arches; i++) {
      const a = (i / arches) * Math.PI,
        z = -2.37 + (j / lengths) * 2.25
      const sag = Math.pow(Math.sin((j / lengths) * Math.PI * 4), 2) * 0.04
      const fold = Math.sin(a * 22) * 0.01 * (1 - Math.sin(a))
      positions.push(Math.cos(a) * (1.14 + fold), 1.98 + Math.sin(a) * (1.22 - sag), z)
      uvs.push((i / arches) * 1.4, j / lengths)
      if (j < lengths && i < arches) {
        const n = j * (arches + 1) + i
        indices.push(n, n + 1, n + arches + 1, n + 1, n + arches + 2, n + arches + 1)
      }
    }
  const cover = new THREE.BufferGeometry()
  cover.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  cover.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  cover.setIndex(indices)
  cover.computeVertexNormals()
  mesh(frame, cover, m.canvas)
  for (let j = 0; j <= 4; j++) {
    const z = -2.35 + j * 0.555,
      hoop: Point[] = []
    for (let i = 0; i <= 20; i++) {
      const a = (i / 20) * Math.PI
      hoop.push([Math.cos(a) * 1.108, 1.94 + Math.sin(a) * 1.22, z])
    }
    curve(frame, hoop, 0.025, m.paleWood, 36)
    const seam = hoop.map((p) => [p[0] * 1.031, p[1] + 0.013, p[2]] as Point)
    curve(frame, seam, 0.009, m.canvasSeam, 36)
    for (const sign of [-1, 1]) {
      curve(
        frame,
        [
          [sign * 1.14, 2.01, z],
          [sign * 1.23, 1.85, z],
          [sign * 1.23, 1.74, z],
          [sign * 1.12, 1.79, z],
        ],
        0.012,
        m.rope,
        10,
      )
    }
  }
  // Cargo is visible through the open rear and from the bench.
  const c1 = crate(m, 0.76, 0.62, 0.73)
  c1.position.set(-0.58, 1.21, -1.79)
  frame.add(c1)
  const c2 = crate(m, 0.66, 0.43, 0.58)
  c2.position.set(-0.55, 1.87, -1.82)
  c2.rotation.y = -0.12
  frame.add(c2)
  const cask = barrel(m)
  cask.position.set(0.59, 1.21, -1.64)
  frame.add(cask)
  for (let i = 0; i < 3; i++) {
    const sack = ellipsoid(
      frame,
      [0.31, 0.25, 0.43],
      [-0.54 + i * 0.43, 1.43, -0.78 - (i % 2) * 0.16],
      m.canvas,
    )
    sack.rotation.y = i * 0.9
    curve(
      frame,
      [
        [-0.7 + i * 0.43, 1.45, -0.75],
        [-0.52 + i * 0.43, 1.7, -0.8],
        [-0.35 + i * 0.43, 1.44, -0.75],
      ],
      0.015,
      m.rope,
      10,
    )
  }
  const roll = mesh(
    frame,
    new THREE.CylinderGeometry(0.2, 0.2, 1.38, 20),
    m.blueCloth,
    [0.17, 1.39, -1.18],
  )
  roll.rotation.z = Math.PI / 2
  for (const x of [-0.28, 0.61]) {
    const tie = mesh(frame, new THREE.TorusGeometry(0.206, 0.018, 6, 24), m.leather, [
      x,
      1.39,
      -1.18,
    ])
    tie.rotation.y = Math.PI / 2
  }
  // Exterior tool and bucket.
  beam(frame, [-1.24, 1.41, -1.7], [-1.24, 1.68, -0.27], 0.023, m.paleWood)
  const spade = ellipsoid(frame, [0.018, 0.14, 0.21], [-1.24, 1.72, -0.17], m.iron)
  spade.rotation.x = -0.3
  mesh(frame, new THREE.CylinderGeometry(0.17, 0.12, 0.31, 16, 1, true), m.iron, [1.34, 1.29, -1.4])
  curve(
    frame,
    [
      [1.17, 1.42, -1.4],
      [1.34, 1.68, -1.4],
      [1.51, 1.42, -1.4],
    ],
    0.012,
    m.iron,
  )
  bake(frame)
  const wheels: THREE.Group[] = []
  for (const sign of [-1, 1])
    for (const z of [-1.58, 0.97]) {
      const part = wheel(m, 0.78)
      part.position.set(sign * 1.31, 0.78, z)
      root.add(part)
      wheels.push(part)
    }
  const team = [-1, 1].map((sign) => {
    const ox = createQuadruped(m, 'ox', sign < 0)
    ox.root.position.set(sign * 0.79, 0, 5.03)
    root.add(ox.root)
    return ox
  })
  const harness = new THREE.Group()
  root.add(harness)
  // Neck yoke and U-bows actually surround each animal at its shoulder.
  curve(
    harness,
    [
      [-1.4, 1.81, 5.76],
      [-0.81, 1.89, 5.76],
      [0, 1.8, 5.76],
      [0.81, 1.89, 5.76],
      [1.4, 1.81, 5.76],
    ],
    0.08,
    m.paleWood,
    30,
  )
  for (const sign of [-1, 1]) {
    const x = sign * 0.79
    curve(
      harness,
      [
        [x - 0.32, 1.87, 5.76],
        [x - 0.35, 1.2, 5.76],
        [x, 0.93, 5.76],
        [x + 0.35, 1.2, 5.76],
        [x + 0.32, 1.87, 5.76],
      ],
      0.031,
      m.oak,
    )
    for (const side of [-1, 1]) {
      box(harness, [0.075, 0.12, 0.15], [x + side * 0.3, 1.88, 5.76], m.iron)
      curve(
        harness,
        [
          [sign * 0.25, 1.91, 1.07],
          [sign * 0.45, 1.46, 3.3],
          [x + side * 0.18, 1.48, 6.14],
        ],
        0.01,
        m.leather,
      )
    }
    curve(
      harness,
      [
        [x - 0.24, 1.37, 6.29],
        [x, 1.13, 6.55],
        [x + 0.24, 1.37, 6.29],
        [x, 1.63, 6.07],
        [x - 0.24, 1.37, 6.29],
      ],
      0.018,
      m.leather,
    )
  }
  const ring = mesh(harness, new THREE.TorusGeometry(0.11, 0.018, 6, 20), m.iron, [0, 1.72, 5.79])
  ring.rotation.y = Math.PI / 2
  bake(harness)
  const local = new THREE.Vector3(),
    world = new THREE.Vector3()
  function update(
    time: number,
    distance: number,
    speed: number,
    heightAt: (x: number, z: number) => number,
  ) {
    for (const part of wheels) part.rotation.x = distance / 0.78
    root.updateMatrixWorld(true)
    for (const ox of team)
      ox.update(time, distance, speed, (point) => {
        world.copy(point)
        world.y = 0
        ox.root.localToWorld(world)
        world.y = heightAt(world.x, world.z)
        local.copy(world)
        ox.root.worldToLocal(local)
        return THREE.MathUtils.clamp(local.y, -0.18, 0.18)
      })
  }
  return { root, update }
}
