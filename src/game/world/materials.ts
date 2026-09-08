import * as THREE from 'three'
import { randomSeed } from './geometry'

export function noise(x: number, y: number) {
  const hash = (a: number, b: number) => {
    const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453
    return s - Math.floor(s)
  }
  const ix = Math.floor(x),
    iy = Math.floor(y),
    fx = x - ix,
    fy = y - iy
  const u = fx * fx * (3 - 2 * fx),
    v = fy * fy * (3 - 2 * fy)
  return THREE.MathUtils.lerp(
    THREE.MathUtils.lerp(hash(ix, iy), hash(ix + 1, iy), u),
    THREE.MathUtils.lerp(hash(ix, iy + 1), hash(ix + 1, iy + 1), u),
    v,
  )
}

type Surface = 'wood' | 'canvas' | 'bark' | 'earth' | 'hide' | 'rock' | 'leather'

function texture(kind: Surface, color: string, bump = false) {
  const size = 256,
    data = new Uint8Array(size * size * 4),
    base = new THREE.Color(color),
    random = randomSeed(61)
  base.convertLinearToSRGB()
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const broad = noise(x / 22, y / 22),
        fine = random()
      let shade = 0.77 + broad * 0.26 + fine * 0.07
      if (kind === 'wood') {
        const bend = Math.sin(y / 53) * 6 + noise(x / 51, y / 80) * 10
        const grain = Math.sin((x + bend) * 1.7 + noise(x / 7, y / 38) * 3)
        shade = 0.71 + noise(x / 4, y / 84) * 0.3 + grain * 0.065 + fine * 0.04
        const knot = Math.hypot((x - 81) / 9, (y - 151) / 29)
        if (knot < 2.5) shade -= Math.cos(knot * 10) * (2.5 - knot) * 0.065
      } else if (kind === 'canvas')
        shade =
          0.84 +
          (x % 3 === 0 ? -0.065 : 0.04) +
          (y % 3 === 0 ? -0.065 : 0.04) +
          broad * 0.1 +
          fine * 0.035
      else if (kind === 'bark')
        shade = 0.53 + noise(x / 5, y / 65) * 0.54 + noise(x / 12, y / 17) * 0.12
      else if (kind === 'hide')
        shade = 0.73 + noise(x / 61, y / 55) * 0.22 + noise(x / 14, y / 8) * 0.1 + fine * 0.07
      else if (kind === 'earth')
        shade =
          0.935 + (fine - 0.5) * 0.045 + (noise(x / 5, y / 5) - 0.5) * 0.06 + (broad - 0.5) * 0.025
      else if (kind === 'rock') shade = 0.58 + broad * 0.39 + noise(x / 5, y / 5) * 0.15
      else if (kind === 'leather') shade = 0.71 + broad * 0.2 + fine * 0.12
      const i = (y * size + x) * 4
      for (let channel = 0; channel < 3; channel++)
        data[i + channel] = Math.max(
          0,
          Math.min(
            255,
            Math.round(
              255 * shade * (bump ? 1 : channel === 0 ? base.r : channel === 1 ? base.g : base.b),
            ),
          ),
        )
      data[i + 3] = 255
    }
  const result = new THREE.DataTexture(data, size, size)
  result.colorSpace = bump ? THREE.NoColorSpace : THREE.SRGBColorSpace
  result.wrapS = result.wrapT = THREE.RepeatWrapping
  result.magFilter = THREE.LinearFilter
  result.minFilter = THREE.LinearMipmapLinearFilter
  result.generateMipmaps = true
  result.anisotropy = 4
  result.needsUpdate = true
  return result
}

function surface(kind: Surface, color: string, roughness = 0.86, repeat = 1) {
  const map = texture(kind, color),
    bumpMap = texture(kind, '#ffffff', true)
  map.repeat.set(repeat, repeat)
  bumpMap.repeat.copy(map.repeat)
  return new THREE.MeshStandardMaterial({
    map,
    bumpMap,
    bumpScale: kind === 'bark' ? 0.11 : kind === 'wood' ? 0.025 : kind === 'earth' ? 0.003 : 0.012,
    roughness,
    metalness: 0,
  })
}

export function createMaterials() {
  const materials = {
    oak: surface('wood', '#9f7245'),
    paleWood: surface('wood', '#b9925c'),
    darkWood: surface('wood', '#5b3a24'),
    canvas: surface('canvas', '#e2d5ad', 0.96, 4),
    canvasSeam: surface('canvas', '#ad9870', 0.95, 2),
    iron: new THREE.MeshStandardMaterial({ color: '#3f413d', metalness: 0.78, roughness: 0.5 }),
    brass: new THREE.MeshStandardMaterial({ color: '#9d8047', metalness: 0.72, roughness: 0.43 }),
    leather: surface('leather', '#55402c', 0.87, 2),
    rope: surface('canvas', '#c0a777', 0.97, 3),
    fur: surface('hide', '#806047'),
    creamFur: surface('hide', '#bb9d72'),
    muzzle: surface('hide', '#625143', 0.89),
    hoof: new THREE.MeshStandardMaterial({ color: '#332d27', roughness: 0.67 }),
    eye: new THREE.MeshStandardMaterial({ color: '#161513', roughness: 0.18 }),
    horn: surface('wood', '#d2c4a0', 0.61),
    bark: surface('bark', '#695442', 0.96, 2),
    foliage: new THREE.MeshStandardMaterial({
      color: '#91a369',
      roughness: 0.92,
      side: THREE.DoubleSide,
      vertexColors: true,
    }),
    pine: new THREE.MeshStandardMaterial({
      color: '#354f40',
      roughness: 1,
      side: THREE.DoubleSide,
    }),
    grass: new THREE.MeshStandardMaterial({
      color: '#8b8c4e',
      roughness: 1,
      side: THREE.DoubleSide,
      vertexColors: true,
    }),
    rock: surface('rock', '#817e70', 0.98, 2),
    ground: surface('earth', '#d4c7af', 1, 1),
    skin: surface('hide', '#b9825e', 0.93),
    shirt: surface('canvas', '#b8b4a0', 0.94, 3),
    coat: surface('canvas', '#586355', 0.95, 3),
    trousers: surface('canvas', '#686b69', 0.96, 2),
    redCloth: surface('canvas', '#925347', 0.95, 3),
    blueCloth: surface('canvas', '#526779', 0.95, 3),
    white: new THREE.MeshStandardMaterial({ color: '#e0d9c5', roughness: 0.9 }),
    coal: new THREE.MeshStandardMaterial({
      color: '#24231e',
      roughness: 1,
      emissive: '#d53b0b',
      emissiveIntensity: 0.35,
    }),
  }
  materials.canvas.side = THREE.DoubleSide
  materials.ground.vertexColors = true
  return materials
}

export type Materials = ReturnType<typeof createMaterials>
