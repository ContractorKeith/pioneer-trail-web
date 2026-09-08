import * as THREE from 'three'
import { bake, beam, box, curve, ellipsoid, loft, mesh } from './geometry'
import type { Materials } from './materials'
import { barrel, crate } from './wagon'

export function createPerson(m: Materials, trader = false) {
  const root = new THREE.Group(),
    clothes = new THREE.Group(),
    head = new THREE.Group()
  root.add(clothes, head)
  const coat = trader ? m.blueCloth : m.coat
  const torso = loft(
    [
      { z: 0.76, y: 0, rx: 0.21, ry: 0.135 },
      { z: 0.83, y: 0, rx: 0.23, ry: 0.145 },
      { z: 1.02, y: 0, rx: 0.185, ry: 0.13 },
      { z: 1.24, y: 0, rx: 0.235, ry: 0.14 },
      { z: 1.38, y: 0, rx: 0.23, ry: 0.115 },
      { z: 1.43, y: 0, rx: 0.09, ry: 0.08 },
    ],
    26,
    20,
  )
  torso.rotateX(-Math.PI / 2)
  mesh(clothes, torso, coat)
  for (const sign of [-1, 1]) {
    const leg = loft(
      [
        { z: 0.14, y: -0.01, rx: 0.067, ry: 0.068 },
        { z: 0.29, y: -0.003, rx: 0.065, ry: 0.079 },
        { z: 0.47, y: -0.025, rx: 0.076, ry: 0.087 },
        { z: 0.6, y: -0.014, rx: 0.083, ry: 0.098 },
        { z: 0.76, y: 0, rx: 0.108, ry: 0.118 },
        { z: 0.88, y: 0, rx: 0.11, ry: 0.118 },
      ],
      26,
      18,
    )
    leg.rotateX(-Math.PI / 2)
    mesh(clothes, leg, m.trousers, [sign * 0.12, 0, 0])
    mesh(
      clothes,
      loft(
        [
          { z: -0.1, y: 0.095, rx: 0.016, ry: 0.04 },
          { z: -0.075, y: 0.095, rx: 0.069, ry: 0.087 },
          { z: 0.03, y: 0.1, rx: 0.079, ry: 0.088 },
          { z: 0.13, y: 0.065, rx: 0.075, ry: 0.047 },
          { z: 0.215, y: 0.052, rx: 0.05, ry: 0.038 },
          { z: 0.238, y: 0.052, rx: 0.006, ry: 0.015 },
        ],
        22,
        16,
      ),
      m.leather,
      [sign * 0.12, 0, 0],
    )
    box(clothes, [0.139, 0.026, 0.29], [sign * 0.12, 0.021, 0.066], m.darkWood, 0.013)
    curve(
      clothes,
      [
        [sign * 0.12 - 0.055, 0.13, -0.059],
        [sign * 0.12, 0.166, 0.049],
        [sign * 0.12 + 0.055, 0.13, -0.059],
      ],
      0.004,
      m.canvasSeam,
      10,
    )
    beam(clothes, [sign * 0.23, 1.33, 0], [sign * 0.31, 1.07, 0.06], 0.09, coat, 0.072, 14)
    beam(clothes, [sign * 0.31, 1.07, 0.06], [sign * 0.24, 0.89, 0.17], 0.072, coat, 0.054, 14)
    mesh(clothes, new THREE.CylinderGeometry(0.057, 0.057, 0.055, 14), m.shirt, [
      sign * 0.245,
      0.91,
      0.16,
    ])
    ellipsoid(clothes, [0.074, 0.072, 0.072], [sign * 0.31, 1.07, 0.06], coat)
    const hand = ellipsoid(clothes, [0.05, 0.079, 0.036], [sign * 0.235, 0.86, 0.18], m.skin)
    hand.rotation.z = sign * 0.23
    ellipsoid(clothes, [0.022, 0.04, 0.021], [sign * 0.195, 0.885, 0.203], m.skin, 12)
    for (let finger = 0; finger < 3; finger++)
      curve(
        clothes,
        [
          [sign * (0.21 + finger * 0.014), 0.851, 0.211],
          [sign * (0.216 + finger * 0.014), 0.81, 0.211],
        ],
        0.002,
        m.muzzle,
        5,
      )
    // Raised lapels, breast pocket and a cloth collar avoid featureless cylinder clothing.
    const lapel = box(clothes, [0.077, 0.28, 0.013], [sign * 0.071, 1.28, 0.142], m.darkWood)
    lapel.rotation.z = sign * -0.27
  }
  box(clothes, [0.35, 0.044, 0.29], [0, 0.92, 0], m.leather)
  box(clothes, [0.072, 0.06, 0.018], [0, 0.92, 0.151], m.brass)
  box(clothes, [0.13, 0.115, 0.019], [-0.125, 1.14, 0.144], coat)
  for (let i = 0; i < 4; i++)
    ellipsoid(clothes, [0.013, 0.013, 0.009], [0, 1.06 + i * 0.077, 0.15], m.brass, 8)
  mesh(clothes, new THREE.CylinderGeometry(0.055, 0.067, 0.16, 16), m.skin, [0, 1.47, 0])
  const scarf = box(clothes, [0.19, 0.071, 0.13], [0, 1.425, 0.055], m.redCloth, 0.02)
  scarf.rotation.z = 0.1
  box(clothes, [0.064, 0.21, 0.025], [0.031, 1.32, 0.16], m.redCloth)
  head.position.y = 1.54
  head.scale.set(0.9, 0.85, 0.93)
  const skull = loft(
    [
      { z: -0.065, y: 0, rx: 0.015, ry: 0.045 },
      { z: -0.03, y: 0.009, rx: 0.078, ry: 0.082 },
      { z: 0.055, y: 0.01, rx: 0.117, ry: 0.096 },
      { z: 0.15, y: 0.002, rx: 0.119, ry: 0.102 },
      { z: 0.235, y: -0.009, rx: 0.095, ry: 0.088 },
      { z: 0.268, y: -0.01, rx: 0.01, ry: 0.018 },
    ],
    26,
    24,
  )
  skull.rotateX(-Math.PI / 2)
  mesh(head, skull, m.skin)
  ellipsoid(head, [0.019, 0.032, 0.025], [0, 0.075, 0.102], m.skin)
  for (const sign of [-1, 1]) {
    ellipsoid(head, [0.018, 0.031, 0.016], [sign * 0.117, 0.082, 0], m.skin, 12)
    ellipsoid(head, [0.019, 0.007, 0.005], [sign * 0.046, 0.118, 0.092], m.canvasSeam, 12)
    ellipsoid(head, [0.008, 0.006, 0.006], [sign * 0.046, 0.118, 0.097], m.eye, 12)
    curve(
      head,
      [
        [sign * 0.027, 0.126, 0.096],
        [sign * 0.047, 0.13, 0.098],
        [sign * 0.066, 0.122, 0.089],
      ],
      0.004,
      m.skin,
      8,
    )
    beam(head, [sign * 0.028, 0.141, 0.097], [sign * 0.068, 0.145, 0.086], 0.0045, m.darkWood)
  }
  curve(
    head,
    [
      [-0.03, 0.025, 0.092],
      [0, 0.022, 0.101],
      [0.03, 0.025, 0.092],
    ],
    0.0025,
    m.muzzle,
    10,
  )
  if (trader) {
    for (const sign of [-1, 1]) {
      const moustache = ellipsoid(
        head,
        [0.028, 0.01, 0.008],
        [sign * 0.026, 0.048, 0.103],
        m.darkWood,
      )
      moustache.rotation.z = sign * 0.13
    }
  }
  const brim = mesh(
    head,
    new THREE.CylinderGeometry(0.245, 0.245, 0.012, 40),
    m.leather,
    [0, 0.232, 0],
  )
  brim.scale.z = 0.84
  const crown = mesh(
    head,
    new THREE.CylinderGeometry(0.124, 0.148, 0.137, 28),
    m.darkWood,
    [0, 0.301, 0],
  )
  crown.scale.z = 0.91
  mesh(head, new THREE.CylinderGeometry(0.144, 0.148, 0.027, 28, 1, true), m.leather, [0, 0.253, 0])
  bake(clothes)
  bake(head)
  return {
    root,
    update(time: number) {
      head.rotation.y = Math.sin(time * 0.35) * 0.09
      clothes.rotation.z = Math.sin(time * 0.7) * 0.004
    },
  }
}

export function createTent(m: Materials) {
  const root = new THREE.Group()
  const positions = [
    -1.75, 0, -1.75, 0, 2.06, -1.75, 0, 2.06, 1.75, -1.75, 0, 1.75, 0, 2.06, -1.75, 1.75, 0, -1.75,
    1.75, 0, 1.75, 0, 2.06, 1.75,
  ]
  const fabric = new THREE.BufferGeometry()
  fabric.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  fabric.setAttribute(
    'uv',
    new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1], 2),
  )
  fabric.setIndex([0, 2, 1, 0, 3, 2, 4, 6, 5, 4, 7, 6])
  fabric.computeVertexNormals()
  mesh(root, fabric, m.canvas)
  const wall = new THREE.BufferGeometry()
  wall.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(
      [
        -1.75, 0, -1.75, 1.75, 0, -1.75, 0, 2.06, -1.75, -1.75, 0, 1.75, -0.55, 0, 1.75, 0, 2.06,
        1.75, 1.75, 0, 1.75, 0, 2.06, 1.75, 0.55, 0, 1.75,
      ],
      3,
    ),
  )
  wall.setAttribute(
    'uv',
    new THREE.Float32BufferAttribute(
      [0, 0, 1, 0, 0.5, 1, 0, 0, 0.4, 0, 0.5, 1, 1, 0, 0.5, 1, 0.6, 0],
      2,
    ),
  )
  wall.computeVertexNormals()
  mesh(root, wall, m.canvas)
  for (const z of [-1.79, 1.79]) {
    beam(root, [0, 0, z], [0, 2.12, z], 0.038, m.paleWood)
    beam(root, [0, 2.08, z], [0, 0.08, z * 1.7], 0.012, m.rope)
    beam(root, [0, -0.05, z * 1.7], [0, 0.24, z * 1.7 + 0.09], 0.027, m.darkWood)
  }
  beam(root, [0, 2.1, -1.83], [0, 2.1, 1.83], 0.035, m.paleWood)
  for (const sign of [-1, 1])
    for (const z of [-1.5, 0, 1.5]) {
      beam(root, [sign * 1.7, 0.075, z], [sign * 2.25, 0.06, z], 0.012, m.rope)
      beam(root, [sign * 2.25, -0.06, z], [sign * 2.26, 0.2, z + 0.08], 0.02, m.darkWood)
    }
  box(root, [1.8, 0.055, 2.7], [0, 0.05, -0.2], m.darkWood)
  box(root, [0.7, 0.08, 2.0], [0.42, 0.12, -0.3], m.redCloth, 0.035)
  return bake(root)
}

export function createTraderStall(m: Materials) {
  const root = new THREE.Group()
  for (const x of [-1.85, 1.85])
    for (const z of [-1.15, 1.15]) beam(root, [x, 0, z], [x, 2.54, z], 0.06, m.darkWood)
  for (const z of [-1.2, 1.2]) beam(root, [-1.94, 2.54, z], [1.94, 2.54, z], 0.05, m.paleWood)
  const cover = box(root, [4.15, 0.035, 2.8], [0, 2.55, 0], m.canvas)
  cover.rotation.z = -0.06
  for (const x of [-1.4, 1.4])
    for (const z of [-0.49, 0.49]) box(root, [0.08, 0.84, 0.08], [x, 0.42, z + 0.5], m.darkWood)
  for (let i = 0; i < 7; i++) box(root, [0.42, 0.07, 1.28], [-1.31 + i * 0.437, 0.88, 0.5], m.oak)
  const cask = barrel(m)
  cask.position.set(-1.28, 0, -0.63)
  root.add(cask)
  const goods = crate(m, 0.72, 0.47, 0.56)
  goods.position.set(0.73, 0.93, 0.65)
  root.add(goods)
  for (let i = 0; i < 5; i++) {
    const bottle = mesh(
      root,
      new THREE.CylinderGeometry(0.044, 0.066, 0.21, 12),
      i % 2 ? m.iron : m.brass,
      [-0.8 + i * 0.18, 1.02, 0.65],
    )
    bottle.rotation.z = 0.025
    mesh(root, new THREE.CylinderGeometry(0.029, 0.029, 0.07, 12), m.darkWood, [
      -0.8 + i * 0.18,
      1.16,
      0.65,
    ])
  }
  for (let i = 0; i < 3; i++)
    box(root, [0.36, 0.08, 0.3], [-0.6, 0.97 + i * 0.09, 0.16], i % 2 ? m.redCloth : m.blueCloth)
  // Long gun and simple camp kettle are modeled merchandise.
  box(root, [0.1, 0.065, 0.4], [0.22, 0.97, 0.3], m.darkWood)
  beam(root, [0.22, 0.985, 0.2], [0.22, 0.985, -0.65], 0.017, m.iron)
  const kettle = ellipsoid(root, [0.14, 0.12, 0.14], [1.27, 1.04, 0.1], m.iron)
  kettle.rotation.z = -0.05
  curve(
    root,
    [
      [1.14, 1.06, 0.1],
      [1.27, 1.32, 0.1],
      [1.4, 1.06, 0.1],
    ],
    0.012,
    m.iron,
  )
  const sign = box(root, [1.82, 0.36, 0.055], [0, 2.12, 1.2], m.darkWood)
  sign.rotation.z = 0.018
  const letters: Record<string, number[][]> = {
    P: [
      [0, 0, 0, 1],
      [0, 1, 0.7, 1],
      [0.7, 1, 0.7, 0.55],
      [0.7, 0.55, 0, 0.55],
    ],
    R: [
      [0, 0, 0, 1],
      [0, 1, 0.7, 1],
      [0.7, 1, 0.7, 0.55],
      [0.7, 0.55, 0, 0.55],
      [0.3, 0.55, 0.8, 0],
    ],
    O: [
      [0, 0, 0, 1],
      [0, 1, 0.7, 1],
      [0.7, 1, 0.7, 0],
      [0.7, 0, 0, 0],
    ],
    V: [
      [0, 1, 0.35, 0],
      [0.35, 0, 0.7, 1],
    ],
    I: [
      [0.35, 0, 0.35, 1],
      [0, 1, 0.7, 1],
      [0, 0, 0.7, 0],
    ],
    S: [
      [0.7, 1, 0, 1],
      [0, 1, 0, 0.5],
      [0, 0.5, 0.7, 0.5],
      [0.7, 0.5, 0.7, 0],
      [0.7, 0, 0, 0],
    ],
    N: [
      [0, 0, 0, 1],
      [0, 1, 0.7, 0],
      [0.7, 0, 0.7, 1],
    ],
  }
  for (const [index, letter] of [...'PROVISIONS'].entries())
    for (const [x1, y1, x2, y2] of letters[letter]) {
      beam(
        root,
        [-0.76 + index * 0.16 + x1 * 0.125, 2.035 + y1 * 0.18, 1.234],
        [-0.76 + index * 0.16 + x2 * 0.125, 2.035 + y2 * 0.18, 1.234],
        0.005,
        m.canvasSeam,
        0.005,
        4,
      )
    }
  return bake(root)
}
