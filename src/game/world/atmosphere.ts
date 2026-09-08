import * as THREE from 'three'
import { beam, ellipsoid, mesh, randomSeed } from './geometry'
import type { Point } from './geometry'
import type { Materials } from './materials'
import type { TerrainField } from './terrain'

export type Weather = 'clear' | 'rain' | 'snow' | 'fog'

function softTexture(flame = false) {
  const size = 64,
    data = new Uint8Array(size * size * 4)
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const u = (x / size - 0.5) * 2,
        v = y / size,
        i = (y * size + x) * 4
      const r = flame
        ? Math.hypot(u / (0.18 + (1 - v) * 0.82), (v - 0.38) * 1.6)
        : Math.hypot(u, (v - 0.5) * 2)
      const alpha = Math.pow(Math.max(0, 1 - r), flame ? 1.2 : 2.1)
      data[i] = 255
      data[i + 1] = flame ? Math.round(86 + (1 - v) * 167) : 255
      data[i + 2] = flame ? Math.round((1 - v) * 62) : 255
      data[i + 3] = Math.round(alpha * 255)
    }
  const texture = new THREE.DataTexture(data, size, size)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.magFilter = THREE.LinearFilter
  texture.minFilter = THREE.LinearFilter
  texture.needsUpdate = true
  return texture
}

export function createWater(field: TerrainField) {
  const root = new THREE.Group(),
    positions: number[] = [],
    uvs: number[] = [],
    indices: number[] = []
  const row = (x0: number, x1: number, z: number, y: number) => {
    positions.push(x0, y, z, x1, y, z)
    uvs.push(x0 * 0.16, z * 0.16, x1 * 0.16, z * 0.16)
  }
  for (let z = -44; z <= 292; z += 2)
    row(field.streamX(z) - 4.5, field.streamX(z) + 4.5, z, field.waterY(z))
  const rows = positions.length / 6
  for (let i = 0; i < rows - 1; i++) {
    const n = i * 2
    indices.push(n, n + 2, n + 1, n + 1, n + 2, n + 3)
  }
  if (field.river) {
    const n = positions.length / 3
    row(-105, 105, field.river.startZ - 1, field.waterY(120))
    row(-105, 105, field.river.endZ + 1, field.waterY(120))
    indices.push(n, n + 2, n + 1, n + 1, n + 2, n + 3)
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  const time = { value: 0 }
  const material = new THREE.MeshStandardMaterial({
    color: '#456c68',
    roughness: 0.25,
    metalness: 0.32,
    transparent: true,
    opacity: 0.87,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
  material.onBeforeCompile = (shader) => {
    shader.uniforms.waterTime = time
    shader.vertexShader = `varying vec3 waterPosition;\n${shader.vertexShader}`.replace(
      '#include <begin_vertex>',
      '#include <begin_vertex>\nwaterPosition = position;',
    )
    shader.fragmentShader =
      `uniform float waterTime; varying vec3 waterPosition;\n${shader.fragmentShader}`.replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
      float rippleA = sin(waterPosition.x * 2.1 + waterPosition.z * 1.2 - waterTime * 1.8);
      float rippleB = cos(waterPosition.z * 3.6 - waterPosition.x * .7 - waterTime * 2.6);
      normal = normalize(normal + mat3(viewMatrix) * vec3(rippleA * .11, 0., rippleB * .075));`,
      )
  }
  material.customProgramCacheKey = () => 'trail-water-v1'
  mesh(root, geometry, material).castShadow = false
  const foamPositions: number[] = []
  for (let z = -30; z < 282; z += 0.9)
    for (const side of [-1, 1]) {
      if (Math.sin(z * 3.9) > 0.2) continue
      const x = field.streamX(z) + side * (4.25 + Math.sin(z * 2.7) * 0.18),
        y = field.waterY(z) + 0.015
      foamPositions.push(x, y, z, x + side * 0.08, y, z + 0.43)
    }
  const foam = new THREE.BufferGeometry()
  foam.setAttribute('position', new THREE.Float32BufferAttribute(foamPositions, 3))
  root.add(
    new THREE.LineSegments(
      foam,
      new THREE.LineBasicMaterial({
        color: '#c5cbb6',
        transparent: true,
        opacity: 0.35,
        depthWrite: false,
      }),
    ),
  )
  return {
    root,
    update(t: number) {
      time.value = t
    },
  }
}

export function createFire(m: Materials, position: Point) {
  const root = new THREE.Group()
  root.position.set(...position)
  const random = randomSeed(156),
    flameMap = softTexture(true),
    smokeMap = softTexture()
  for (let i = 0; i < 11; i++) {
    const a = (i / 11) * Math.PI * 2
    const rock = ellipsoid(
      root,
      [0.19, 0.13, 0.15],
      [Math.cos(a) * 0.63, 0.11, Math.sin(a) * 0.63],
      m.rock,
      10,
    )
    rock.rotation.y = a
  }
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2,
      x = Math.cos(a) * 0.46,
      z = Math.sin(a) * 0.46
    beam(root, [x, 0.11, z], [-x * 0.67, 0.25, -z * 0.67], 0.089, m.coal, 0.064)
  }
  const flames: THREE.Sprite[] = [],
    smoke: THREE.Sprite[] = []
  for (let i = 0; i < 6; i++) {
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: flameMap,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        opacity: 0.8,
      }),
    )
    sprite.position.set(Math.sin(i * 2.4) * 0.16, 0.53, Math.cos(i * 2.4) * 0.16)
    root.add(sprite)
    flames.push(sprite)
  }
  for (let i = 0; i < 22; i++) {
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: smokeMap,
        color: '#a9aaa0',
        transparent: true,
        depthWrite: false,
        opacity: 0.16,
      }),
    )
    root.add(sprite)
    smoke.push(sprite)
  }
  const emberPositions = new Float32Array(36 * 3),
    emberGeometry = new THREE.BufferGeometry()
  emberGeometry.setAttribute('position', new THREE.BufferAttribute(emberPositions, 3))
  const embers = new THREE.Points(
    emberGeometry,
    new THREE.PointsMaterial({
      color: '#ffc572',
      size: 0.033,
      map: smokeMap,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  )
  embers.frustumCulled = false
  root.add(embers)
  const light = new THREE.PointLight('#ff9c4c', 15, 13, 1.7)
  light.position.set(0, 0.67, 0)
  root.add(light)
  const phases = Array.from({ length: 36 }, () => random())
  return {
    root,
    update(time: number, weather: Weather) {
      const strength = weather === 'rain' ? 0.65 : 1
      flames.forEach((flame, i) => {
        const h = 0.65 + Math.sin(time * (6 + i) + i) * 0.14 + Math.sin(time * 13 + i) * 0.09
        flame.scale.set(0.58, h * 1.5 * strength, 1)
        flame.position.y = 0.21 + h * 0.43 * strength
        flame.material.rotation = Math.sin(time * 3 + i) * 0.12
      })
      smoke.forEach((p, i) => {
        const t = (time * 0.12 + i / smoke.length) % 1
        p.position.set(
          t * t * 1.8 + Math.sin(t * 8 + i) * 0.12,
          0.6 + t * 5.3,
          Math.sin(i * 2.4 + t) * 0.22,
        )
        p.scale.setScalar(0.45 + t * 1.8)
        p.material.opacity = (1 - t) * 0.16
        p.material.rotation = t * 2 + i
      })
      for (let i = 0; i < phases.length; i++) {
        const t = (time * 0.35 + phases[i]) % 1
        emberPositions[i * 3] = Math.sin(i * 2.4 + t * 5) * t * 0.44 + t * t * 0.7
        emberPositions[i * 3 + 1] = 0.3 + t * 2.5
        emberPositions[i * 3 + 2] = Math.cos(i * 1.7 + t * 3) * t * 0.4
      }
      emberGeometry.attributes.position.needsUpdate = true
      light.intensity = (13 + Math.sin(time * 9) * 2 + Math.sin(time * 17)) * strength
    },
  }
}

export function createAtmosphere(
  scene: THREE.Scene,
  quality: 'low' | 'balanced' | 'high',
  ground: THREE.MeshStandardMaterial,
) {
  const root = new THREE.Group(),
    random = randomSeed(107),
    time = { value: 0 },
    daylight = { value: 0.86 },
    storm = { value: 0 }
  const sunDirection = { value: new THREE.Vector3(-0.58, 0.53, 0.49).normalize() }
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(1, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: false,
      fog: false,
      uniforms: { time, daylight, storm, sunDirection },
      vertexShader:
        'varying vec3 direction; void main(){ direction=position; vec4 clip=projectionMatrix*modelViewMatrix*vec4(position,1.); gl_Position=clip.xyww; }',
      fragmentShader: `varying vec3 direction; uniform float time; uniform float daylight; uniform float storm; uniform vec3 sunDirection;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){vec2 i=floor(p), f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}
      void main(){vec3 d=normalize(direction);float h=max(0.,d.y);float lit=smoothstep(.06,.6,daylight);
        vec3 horizon=mix(vec3(.033,.054,.092),vec3(.58,.66,.65),lit);vec3 zenith=mix(vec3(.008,.017,.045),vec3(.065,.19,.36),lit);
        vec3 color=mix(horizon,zenith,pow(h,.46));float sunset=lit*(1.-smoothstep(.36,.75,daylight));
        float toward=pow(max(0.,dot(d,sunDirection)),8.); color+=vec3(.55,.17,.027)*toward*sunset+vec3(.12,.075,.03)*toward*lit;
        float sun=pow(max(0.,dot(d,sunDirection)),1200.);color+=vec3(1.,.83,.51)*sun*lit*(1.-storm);
        vec2 p=d.xz/(max(.06,d.y)+.26)*2.2+vec2(time*.004,0.);
        float clouds=noise(p)*.55+noise(p*2.1)*.28+noise(p*4.3)*.12;
        float cloud=smoothstep(.48-storm*.13,.73-storm*.16,clouds)*smoothstep(0.,.12,d.y);
        color=mix(color,mix(vec3(.71,.72,.69),vec3(.27,.34,.39),storm)*(.12+.88*lit),cloud*.85);
        color=mix(color,vec3(.24,.29,.32)*(.2+.8*lit),storm*.43);gl_FragColor=vec4(color,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    }),
  )
  sky.name = 'atmospheric-sky'
  sky.frustumCulled = false
  sky.renderOrder = -100
  root.add(sky)
  const sun = new THREE.DirectionalLight('#ffe0b0', 2.4)
  sun.castShadow = true
  sun.shadow.mapSize.setScalar(quality === 'low' ? 1024 : 2048)
  sun.shadow.camera.left = sun.shadow.camera.bottom = -33
  sun.shadow.camera.right = sun.shadow.camera.top = 33
  sun.shadow.camera.near = 0.5
  sun.shadow.camera.far = 150
  sun.shadow.bias = -0.00015
  sun.shadow.normalBias = 0.025
  sun.shadow.radius = 2
  root.add(sun, sun.target)
  const hemi = new THREE.HemisphereLight('#a9c4db', '#5d6040', 1.35)
  root.add(hemi)
  const moon = new THREE.DirectionalLight('#90b3ed', 0.04)
  moon.position.set(30, 60, -20)
  root.add(moon)
  const fog = new THREE.FogExp2('#c4cbbd', 0.0038)
  scene.fog = fog
  // Small original sky environment is locally generated; Three.js handles PMREM filtering.
  const envData = new Uint8Array(128 * 64 * 4)
  for (let y = 0; y < 64; y++)
    for (let x = 0; x < 128; x++) {
      const t = y / 63,
        color = new THREE.Color().setRGB(0.56 - t * 0.28, 0.65 - t * 0.36, 0.72 - t * 0.49)
      const i = (y * 128 + x) * 4
      envData[i] = color.r * 255
      envData[i + 1] = color.g * 255
      envData[i + 2] = color.b * 255
      envData[i + 3] = 255
    }
  const environment = new THREE.DataTexture(envData, 128, 64)
  environment.mapping = THREE.EquirectangularReflectionMapping
  environment.colorSpace = THREE.SRGBColorSpace
  environment.needsUpdate = true
  scene.environment = environment
  scene.environmentIntensity = 0.55
  const starsPositions: number[] = []
  for (let i = 0; i < 430; i++) {
    const a = random() * Math.PI * 2,
      y = 0.15 + random() * 0.85,
      r = Math.sqrt(1 - y * y)
    starsPositions.push(Math.cos(a) * r * 850, y * 850, Math.sin(a) * r * 850)
  }
  const starsGeometry = new THREE.BufferGeometry()
  starsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starsPositions, 3))
  const starsMaterial = new THREE.PointsMaterial({
    color: '#d8e3ee',
    size: 1.5,
    sizeAttenuation: false,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    fog: false,
  })
  const stars = new THREE.Points(starsGeometry, starsMaterial)
  root.add(stars)
  const count = quality === 'low' ? 650 : 1500,
    rainPositions = new Float32Array(count * 6),
    snowPositions = new Float32Array(count * 3)
  const rainGeometry = new THREE.BufferGeometry()
  rainGeometry.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3))
  const rain = new THREE.LineSegments(
    rainGeometry,
    new THREE.LineBasicMaterial({
      color: '#c4d5dd',
      transparent: true,
      opacity: 0.33,
      depthWrite: false,
    }),
  )
  rain.frustumCulled = false
  root.add(rain)
  const snowGeometry = new THREE.BufferGeometry()
  snowGeometry.setAttribute('position', new THREE.BufferAttribute(snowPositions, 3))
  const snow = new THREE.Points(
    snowGeometry,
    new THREE.PointsMaterial({
      color: '#e7eae7',
      map: softTexture(),
      size: 0.1,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
    }),
  )
  snow.frustumCulled = false
  root.add(snow)
  const seeds = Array.from({ length: count }, () => [random(), random(), random()])
  const snowAmount = { value: 0 }
  ground.onBeforeCompile = (shader) => {
    shader.uniforms.trailSnow = snowAmount
    shader.fragmentShader = `uniform float trailSnow;\n${shader.fragmentShader}`.replace(
      '#include <color_fragment>',
      '#include <color_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb, vec3(.75,.8,.82), trailSnow * .86);',
    )
  }
  ground.customProgramCacheKey = () => 'trail-snow-v1'
  const dayFog = new THREE.Color('#c4cbbd'),
    nightFog = new THREE.Color('#17263c'),
    stormFog = new THREE.Color('#71838b')
  function update(
    t: number,
    light: number,
    weather: Weather,
    camera: THREE.Vector3,
    sheltered: boolean,
  ) {
    time.value = t
    daylight.value = THREE.MathUtils.clamp(light, 0, 1)
    storm.value = weather === 'rain' || weather === 'snow' ? 0.85 : weather === 'fog' ? 0.35 : 0
    sky.position.copy(camera)
    stars.position.copy(camera)
    const day = THREE.MathUtils.smoothstep(light, 0.06, 0.6)
    sunDirection.value.set(-0.58, 0.08 + light * 0.64, 0.49).normalize()
    sun.position.copy(camera).addScaledVector(sunDirection.value, 75)
    sun.target.position.copy(camera)
    sun.target.position.z += 12
    sun.intensity = (weather === 'clear' ? 2.5 : 0.85) * day
    sun.color.set(weather === 'clear' && light < 0.7 ? '#ffc38b' : '#fff0d5')
    hemi.intensity = 0.17 + day * (weather === 'clear' ? 1.35 : 0.78)
    moon.intensity = (1 - day) * 0.32
    scene.environmentIntensity = 0.12 + day * 0.42
    starsMaterial.opacity = (1 - day) * (1 - storm.value)
    fog.color
      .copy(nightFog)
      .lerp(dayFog, day)
      .lerp(stormFog, storm.value * day)
    fog.density =
      weather === 'fog' ? 0.021 : weather === 'rain' ? 0.01 : weather === 'snow' ? 0.014 : 0.0036
    rain.visible = weather === 'rain'
    snow.visible = weather === 'snow'
    snowAmount.value = weather === 'snow' ? 0.8 : 0
    if (!rain.visible && !snow.visible) return
    for (let i = 0; i < count; i++) {
      const [sx, sy, sz] = seeds[i],
        falling = weather === 'snow' ? 1.25 : 19
      const y = ((((sy * 22 - t * falling) % 22) + 22) % 22) - 3
      const x = (sx - 0.5) * 52 + Math.sin(t * 0.55 + sz * 8) * (weather === 'snow' ? 1.4 : 0.3),
        z = (sz - 0.5) * 52
      const hide = sheltered && Math.abs(x) < 2 && Math.abs(z) < 3 && y < 3
      if (weather === 'rain') {
        const at = i * 6
        rainPositions[at] = camera.x + x
        rainPositions[at + 1] = camera.y + y + (hide ? 30 : 0)
        rainPositions[at + 2] = camera.z + z
        rainPositions[at + 3] = camera.x + x - 0.1
        rainPositions[at + 4] = camera.y + y + 0.74 + (hide ? 30 : 0)
        rainPositions[at + 5] = camera.z + z + 0.04
      } else {
        const at = i * 3
        snowPositions[at] = camera.x + x
        snowPositions[at + 1] = camera.y + y + (hide ? 30 : 0)
        snowPositions[at + 2] = camera.z + z
      }
    }
    if (rain.visible) rainGeometry.attributes.position.needsUpdate = true
    else snowGeometry.attributes.position.needsUpdate = true
  }
  return {
    root,
    update,
    dispose() {
      environment.dispose()
      scene.environment = null
    },
  }
}
