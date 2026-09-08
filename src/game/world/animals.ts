import * as THREE from 'three'
import { bake, beam, box, curve, ellipsoid, loft, mesh } from './geometry'
import type { Materials } from './materials'
import type { Point } from './geometry'

interface Leg {
  hip: THREE.Vector3
  upper: THREE.Mesh
  lower: THREE.Mesh
  hoof: THREE.Group
  phase: number
}

const limbUp = new THREE.Vector3(0, 1, 0)
const limbDirection = new THREE.Vector3()

function setLimb(limb: THREE.Mesh, a: THREE.Vector3, b: THREE.Vector3) {
  limb.position.copy(a).add(b).multiplyScalar(0.5)
  limb.scale.y = a.distanceTo(b)
  limb.quaternion.setFromUnitVectors(limbUp, limbDirection.copy(b).sub(a).normalize())
}

export function createQuadruped(m: Materials, species: 'ox' | 'deer', cream = false) {
  const root = new THREE.Group(),
    body = new THREE.Group(),
    detail = new THREE.Group()
  root.name = species
  root.add(body)
  body.add(detail)
  const ox = species === 'ox',
    fur = cream ? m.creamFur : m.fur
  const sections = ox
    ? [
        { z: -1.13, y: 1.21, rx: 0.015, ry: 0.08 },
        { z: -1.02, y: 1.26, rx: 0.35, ry: 0.4 },
        { z: -0.72, y: 1.28, rx: 0.48, ry: 0.51 },
        { z: -0.12, y: 1.24, rx: 0.52, ry: 0.56 },
        { z: 0.43, y: 1.32, rx: 0.46, ry: 0.59 },
        { z: 0.71, y: 1.39, rx: 0.38, ry: 0.58 },
        { z: 0.92, y: 1.38, rx: 0.285, ry: 0.38 },
        { z: 1.12, y: 1.35, rx: 0.27, ry: 0.31 },
        { z: 1.34, y: 1.21, rx: 0.25, ry: 0.27 },
        { z: 1.54, y: 1.08, rx: 0.23, ry: 0.155 },
        { z: 1.63, y: 1.08, rx: 0.045, ry: 0.09 },
      ]
    : [
        { z: -0.78, y: 1.12, rx: 0.025, ry: 0.08 },
        { z: -0.62, y: 1.15, rx: 0.28, ry: 0.36 },
        { z: -0.22, y: 1.16, rx: 0.29, ry: 0.36 },
        { z: 0.3, y: 1.23, rx: 0.27, ry: 0.38 },
        { z: 0.5, y: 1.47, rx: 0.18, ry: 0.37 },
        { z: 0.62, y: 1.73, rx: 0.13, ry: 0.23 },
        { z: 0.86, y: 1.75, rx: 0.13, ry: 0.19 },
        { z: 1.03, y: 1.68, rx: 0.09, ry: 0.09 },
        { z: 1.1, y: 1.68, rx: 0.01, ry: 0.03 },
      ]
  mesh(detail, loft(sections), fur)
  if (ox) {
    // Dewlap hangs continuously against the shoulder rather than a floating neck sphere.
    curve(
      detail,
      [
        [0, 1.1, 0.76],
        [0, 0.8, 0.92],
        [0, 0.91, 1.18],
      ],
      0.09,
      fur,
    )
    ellipsoid(detail, [0.235, 0.135, 0.15], [0, 1.07, 1.52], m.muzzle)
    for (const sign of [-1, 1]) {
      ellipsoid(detail, [0.025, 0.024, 0.035], [sign * 0.16, 1.11, 1.65], m.eye, 12)
      ellipsoid(detail, [0.027, 0.035, 0.05], [sign * 0.251, 1.39, 1.17], m.eye, 12)
      ellipsoid(detail, [0.04, 0.016, 0.059], [sign * 0.252, 1.438, 1.15], fur)
      const ear = ellipsoid(detail, [0.25, 0.068, 0.13], [sign * 0.37, 1.58, 1.04], fur)
      ear.rotation.z = sign * 0.22
      ellipsoid(detail, [0.14, 0.024, 0.078], [sign * 0.42, 1.62, 1.045], m.muzzle)
      const horn = new THREE.Group()
      // Tapered swept horns, curved outward and then upward.
      for (let i = 0; i < 9; i++) {
        const p = (t: number): Point => [
          sign * (0.22 + Math.sin(t * 1.48) * 0.49),
          1.65 + t * t * 0.46,
          0.98 + t * 0.15,
        ]
        beam(
          horn,
          p(i / 9),
          p((i + 1) / 9),
          0.069 * (1 - i / 9),
          m.horn,
          0.069 * (1 - (i + 1) / 9) + 0.003,
          10,
        )
      }
      detail.add(horn)
    }
  } else {
    ellipsoid(detail, [0.085, 0.068, 0.065], [0, 1.69, 1.065], m.muzzle)
    for (const sign of [-1, 1]) {
      ellipsoid(detail, [0.019, 0.028, 0.028], [sign * 0.126, 1.8, 0.84], m.eye, 12)
      const ear = ellipsoid(detail, [0.083, 0.21, 0.046], [sign * 0.17, 1.93, 0.68], fur)
      ear.rotation.z = sign * -0.54
      curve(
        detail,
        [
          [sign * 0.09, 1.93, 0.7],
          [sign * 0.2, 2.2, 0.55],
          [sign * 0.31, 2.49, 0.5],
          [sign * 0.38, 2.65, 0.63],
        ],
        0.024,
        m.horn,
      )
      for (let i = 0; i < 3; i++)
        curve(
          detail,
          [
            [sign * (0.17 + i * 0.06), 2.15 + i * 0.14, 0.56],
            [sign * (0.32 + i * 0.07), 2.35 + i * 0.13, 0.76],
          ],
          0.013,
          m.horn,
          8,
        )
    }
    ellipsoid(detail, [0.13, 0.14, 0.04], [0, 1.27, -0.765], m.white)
  }
  bake(detail)
  const tail = new THREE.Group()
  body.add(tail)
  tail.position.set(0, ox ? 1.48 : 1.28, ox ? -1.08 : -0.73)
  curve(
    tail,
    [
      [0, 0, 0],
      [0.04, -0.31, -0.09],
      [0.035, -0.65, -0.12],
    ],
    ox ? 0.027 : 0.018,
    fur,
    12,
  )
  ellipsoid(
    tail,
    ox ? [0.07, 0.15, 0.065] : [0.06, 0.07, 0.035],
    [0.035, -0.65, -0.12],
    ox ? m.darkWood : m.white,
  )
  bake(tail)
  const legs: Leg[] = []
  for (const sign of [-1, 1])
    for (const front of [false, true]) {
      const hip = new THREE.Vector3(
        sign * (ox ? 0.32 : 0.18),
        ox ? 1.12 : 1.02,
        front ? (ox ? 0.63 : 0.35) : ox ? -0.76 : -0.56,
      )
      const upper = mesh(
        root,
        new THREE.CylinderGeometry(ox ? 0.09 : 0.04, ox ? 0.145 : 0.087, 1, 12),
        fur,
      )
      const lower = mesh(
        root,
        new THREE.CylinderGeometry(ox ? 0.058 : 0.026, ox ? 0.087 : 0.041, 1, 10),
        fur,
      )
      const hoof = new THREE.Group()
      root.add(hoof)
      for (const split of [-1, 1])
        box(
          hoof,
          [ox ? 0.066 : 0.039, ox ? 0.13 : 0.095, ox ? 0.21 : 0.14],
          [split * (ox ? 0.036 : 0.021), ox ? 0.065 : 0.0475, 0.028],
          m.hoof,
          0.026,
        )
      bake(hoof)
      legs.push({
        hip,
        upper,
        lower,
        hoof,
        phase: (sign === 1 ? Math.PI : 0) + (front ? Math.PI : 0),
      })
    }
  let lastDistance = 0,
    gait = 0
  const scratch = new THREE.Vector3(),
    knee = new THREE.Vector3(),
    foot = new THREE.Vector3(),
    toe = new THREE.Vector3()
  function update(
    time: number,
    distance: number,
    speed: number,
    floor?: (local: THREE.Vector3) => number,
  ) {
    gait += (distance - lastDistance) * (ox ? 3.2 : 4.6)
    lastDistance = distance
    const moving = Math.min(1, Math.abs(speed) / 0.5)
    body.position.y = Math.sin(gait * 2) * 0.012 * moving
    body.rotation.z = Math.sin(gait) * 0.009 * moving
    tail.rotation.z = Math.sin(time * 1.7) * 0.12
    for (const leg of legs) {
      const phase = gait + leg.phase,
        stride = ox ? 0.32 : 0.27
      foot.copy(leg.hip)
      foot.z += Math.cos(phase) * stride * moving
      foot.y = 0.018 + Math.max(0, Math.sin(phase)) * (ox ? 0.16 : 0.2) * moving
      if (floor) foot.y += floor(scratch.copy(foot))
      const hip = leg.hip,
        midY = (hip.y + foot.y) / 2,
        midZ = (hip.z + foot.z) / 2
      const length = ox ? 0.58 : 0.53,
        span = Math.hypot(hip.y - foot.y, hip.z - foot.z)
      const bend = Math.sqrt(Math.max(0.001, length * length - (span * span) / 4))
      const direction = hip.z > 0 ? 1 : -1
      knee.set(
        hip.x,
        midY + ((foot.z - hip.z) / Math.max(0.01, span)) * bend * direction,
        midZ + ((hip.y - foot.y) / Math.max(0.01, span)) * bend * direction,
      )
      setLimb(leg.upper, hip, knee)
      toe.copy(foot)
      toe.y += ox ? 0.13 : 0.09
      setLimb(leg.lower, knee, toe)
      leg.hoof.position.copy(foot)
    }
  }
  update(0, 0, 0)
  return { root, update }
}

export function createRabbit(m: Materials) {
  const root = new THREE.Group(),
    body = new THREE.Group()
  root.add(body)
  mesh(
    body,
    loft(
      [
        { z: -0.33, y: 0.26, rx: 0.02, ry: 0.07 },
        { z: -0.21, y: 0.26, rx: 0.18, ry: 0.21 },
        { z: 0.03, y: 0.25, rx: 0.15, ry: 0.17 },
        { z: 0.18, y: 0.31, rx: 0.09, ry: 0.13 },
        { z: 0.27, y: 0.37, rx: 0.105, ry: 0.12 },
        { z: 0.39, y: 0.32, rx: 0.049, ry: 0.04 },
        { z: 0.42, y: 0.32, rx: 0.004, ry: 0.01 },
      ],
      30,
      18,
    ),
    m.creamFur,
  )
  for (const sign of [-1, 1]) {
    const ear = ellipsoid(body, [0.047, 0.21, 0.039], [sign * 0.066, 0.61, 0.215], m.creamFur)
    ear.rotation.z = sign * -0.19
    ear.rotation.x = -0.2
    const inner = ellipsoid(body, [0.024, 0.151, 0.009], [sign * 0.07, 0.62, 0.251], m.skin)
    inner.rotation.z = sign * -0.19
    inner.rotation.x = -0.2
    ellipsoid(body, [0.015, 0.021, 0.018], [sign * 0.094, 0.395, 0.294], m.eye, 12)
    ellipsoid(body, [0.095, 0.14, 0.12], [sign * 0.13, 0.14, -0.17], m.creamFur)
    ellipsoid(body, [0.066, 0.044, 0.155], [sign * 0.13, 0.047, -0.1], m.creamFur)
    beam(body, [sign * 0.07, 0.19, 0.13], [sign * 0.074, 0.035, 0.22], 0.033, m.creamFur, 0.025)
  }
  ellipsoid(body, [0.074, 0.076, 0.067], [0, 0.29, -0.344], m.white)
  ellipsoid(body, [0.018, 0.013, 0.011], [0, 0.331, 0.409], m.muzzle, 12)
  bake(body)
  return {
    root,
    update(time: number, _distance: number, speed: number) {
      body.position.y = Math.max(0, Math.sin(time * 9)) * Math.min(0.12, Math.abs(speed) * 0.22)
      body.rotation.x = Math.sin(time * 9) * Math.min(0.1, Math.abs(speed) * 0.1)
    },
  }
}
