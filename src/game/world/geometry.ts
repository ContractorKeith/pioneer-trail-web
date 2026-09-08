import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'

export type Point = [number, number, number]
const up = new THREE.Vector3(0, 1, 0)

export function mesh(
  parent: THREE.Object3D,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  position: Point = [0, 0, 0],
) {
  const result = new THREE.Mesh(geometry, material)
  result.position.set(...position)
  result.castShadow = true
  result.receiveShadow = true
  parent.add(result)
  return result
}

export function box(
  parent: THREE.Object3D,
  size: Point,
  position: Point,
  material: THREE.Material,
  bevel = 0.012,
) {
  return mesh(
    parent,
    bevel
      ? new RoundedBoxGeometry(...size, 1, Math.min(bevel, ...size.map((n) => n / 5)))
      : new THREE.BoxGeometry(...size),
    material,
    position,
  )
}

export function beam(
  parent: THREE.Object3D,
  a: Point,
  b: Point,
  radius: number,
  material: THREE.Material,
  radiusEnd = radius,
  segments = 8,
) {
  const start = new THREE.Vector3(...a)
  const end = new THREE.Vector3(...b)
  const result = mesh(
    parent,
    new THREE.CylinderGeometry(radiusEnd, radius, start.distanceTo(end), segments),
    material,
  )
  result.position.copy(start.add(end).multiplyScalar(0.5))
  result.quaternion.setFromUnitVectors(
    up,
    new THREE.Vector3(...b).sub(new THREE.Vector3(...a)).normalize(),
  )
  return result
}

export function ellipsoid(
  parent: THREE.Object3D,
  radius: Point,
  position: Point,
  material: THREE.Material,
  segments = 16,
) {
  const geometry = new THREE.SphereGeometry(1, segments, Math.max(8, segments / 2))
  geometry.scale(...radius)
  return mesh(parent, geometry, material, position)
}

export function curve(
  parent: THREE.Object3D,
  points: Point[],
  radius: number,
  material: THREE.Material,
  segments = 28,
) {
  return mesh(
    parent,
    new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p))),
      segments,
      radius,
      6,
      false,
    ),
    material,
  )
}

// Authored cross-sections form a continuous surface, including the changing neck and muzzle.
export function loft(
  sections: { z: number; y: number; x?: number; rx: number; ry: number }[],
  rings = 48,
  sides = 24,
) {
  const centers = new THREE.CatmullRomCurve3(
    sections.map((s) => new THREE.Vector3(s.x || 0, s.y, s.z)),
    false,
    'catmullrom',
    0.3,
  )
  const radii = new THREE.CatmullRomCurve3(
    sections.map((s) => new THREE.Vector3(s.rx, s.ry, 0)),
    false,
    'catmullrom',
    0.25,
  )
  const positions: number[] = [],
    uv: number[] = [],
    indices: number[] = []
  for (let ring = 0; ring <= rings; ring++) {
    const t = ring / rings,
      center = centers.getPoint(t),
      radius = radii.getPoint(t)
    for (let side = 0; side <= sides; side++) {
      const a = (side / sides) * Math.PI * 2
      positions.push(
        center.x + Math.cos(a) * Math.max(0.004, radius.x),
        center.y + Math.sin(a) * Math.max(0.004, radius.y),
        center.z,
      )
      uv.push(t, side / sides)
      if (ring < rings && side < sides) {
        const i = ring * (sides + 1) + side
        indices.push(i, i + 1, i + sides + 1, i + 1, i + sides + 2, i + sides + 1)
      }
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

// Collapse only explicitly static subtrees; animated joints stay independent.
export function bake(group: THREE.Group) {
  group.updateMatrixWorld(true)
  const inverse = group.matrixWorld.clone().invert()
  const batches = new Map<THREE.Material, THREE.BufferGeometry[]>()
  const originals = new Set<THREE.BufferGeometry>()
  group.traverse((object) => {
    if (!(object instanceof THREE.Mesh) || Array.isArray(object.material)) return
    const geometry = object.geometry
      .clone()
      .applyMatrix4(inverse.clone().multiply(object.matrixWorld))
    const flat = geometry.index ? geometry.toNonIndexed() : geometry
    if (flat !== geometry) geometry.dispose()
    if (!flat.getAttribute('uv'))
      flat.setAttribute(
        'uv',
        new THREE.Float32BufferAttribute(
          new Float32Array(flat.getAttribute('position').count * 2),
          2,
        ),
      )
    // Every material batch has a common minimal vertex format, retaining authored leaf colors.
    const vertexColors = 'vertexColors' in object.material && object.material.vertexColors
    if (vertexColors && !flat.getAttribute('color'))
      flat.setAttribute(
        'color',
        new THREE.Float32BufferAttribute(
          new Float32Array(flat.getAttribute('position').count * 3).fill(1),
          3,
        ),
      )
    for (const name of Object.keys(flat.attributes))
      if (!['position', 'normal', 'uv', ...(vertexColors ? ['color'] : [])].includes(name))
        flat.deleteAttribute(name)
    const entries = batches.get(object.material) || []
    entries.push(flat)
    batches.set(object.material, entries)
    originals.add(object.geometry)
  })
  group.clear()
  for (const [material, geometries] of batches) {
    const merged = mergeGeometries(geometries)
    if (merged) mesh(group, merged, material)
    geometries.forEach((g) => g.dispose())
  }
  originals.forEach((g) => g.dispose())
  return group
}

export function randomSeed(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0
    return state / 4294967296
  }
}

export function disposeTree(root: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>(),
    materials = new Set<THREE.Material>(),
    textures = new Set<THREE.Texture>()
  root.traverse((object) => {
    if (
      object instanceof THREE.Mesh ||
      object instanceof THREE.Points ||
      object instanceof THREE.Line ||
      object instanceof THREE.Sprite
    ) {
      geometries.add(object.geometry)
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        materials.add(material)
        for (const value of Object.values(material))
          if (value instanceof THREE.Texture) textures.add(value)
      }
    }
    if (object instanceof THREE.Light && 'shadow' in object)
      (object as THREE.DirectionalLight).shadow?.dispose()
    if (object instanceof THREE.InstancedMesh) object.dispose()
  })
  geometries.forEach((g) => g.dispose())
  materials.forEach((m) => m.dispose())
  textures.forEach((t) => t.dispose())
  root.removeFromParent()
  root.clear()
  return { geometries, materials, textures }
}
