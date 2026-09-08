import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { trailAudio } from '../audio'
import type { SceneMode, TrailSceneProps } from './TrailScene'
import './scenes.css'

const sceneCopy: Record<SceneMode, string> = {
  trail: 'The wagon road rolls west beneath an open sky.',
  camp: 'The wagon is parked. Firelight holds back the cold.',
  hunt: 'You step quietly through the cover, looking for food.',
  fish: 'The current works around your line at the riverbank.',
  river: 'The far bank is a decision away.',
  snow: 'Snow closes around the trail and softens every sound.',
  repair: 'The wheel waits in the dirt beside the wagon.',
  talk: 'A fellow traveler waits by the fire.',
}

/** Presentational atmosphere over a hand-authored first-person plate. It never owns game state. */
export default function SceneCanvas({
  mode,
  weather,
  moving = false,
  reducedMotion,
  className = '',
}: TrailSceneProps) {
  const host = useRef<HTMLDivElement>(null)
  const [webgl, setWebgl] = useState(true)
  useEffect(() => {
    trailAudio.setScene(mode, weather)
  }, [mode, weather])

  useEffect(() => {
    const element = host.current
    if (!element || reducedMotion || !webgl) return
    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: 'low-power',
      })
    } catch {
      queueMicrotask(() => setWebgl(false))
      return
    }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5))
    renderer.setSize(element.clientWidth, element.clientHeight, false)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    element.prepend(renderer.domElement)
    const world = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 30)
    camera.position.z = 5
    const storm = /rain|storm/i.test(weather)
    const snow = mode === 'snow' || /snow/i.test(weather)
    const water = mode === 'fish' || mode === 'river'
    const weatherLayer = storm || snow ? fallingWeather(snow) : undefined
    if (weatherLayer) world.add(weatherLayer.points)
    const glints = water ? waterGlints() : undefined
    if (glints) world.add(glints.points)
    const fire = mode === 'camp' || mode === 'talk' ? embers() : undefined
    if (fire) world.add(fire.points)
    const resize = () => {
      const { clientWidth: w, clientHeight: h } = element
      camera.aspect = w / Math.max(h, 1)
      camera.updateProjectionMatrix()
      renderer.setSize(w, h, false)
    }
    const onMove = (event: PointerEvent) => {
      const box = element.getBoundingClientRect()
      const x = (event.clientX - box.left) / box.width - 0.5
      const y = (event.clientY - box.top) / box.height - 0.5
      element.style.setProperty('--look-x', `${x * -1.2}%`)
      element.style.setProperty('--look-y', `${y * -1.2}%`)
      camera.position.x = x * 0.09
      camera.position.y = -y * 0.05
    }
    const lost = (event: Event) => {
      event.preventDefault()
      setWebgl(false)
    }
    const observer = new ResizeObserver(resize)
    observer.observe(element)
    element.addEventListener('pointermove', onMove)
    renderer.domElement.addEventListener('webglcontextlost', lost)
    let frame = 0
    let previous = performance.now()
    const render = (now: number) => {
      const dt = Math.min((now - previous) / 1000, 0.05)
      previous = now
      if (weatherLayer) weatherLayer.advance(dt)
      if (glints) glints.advance(dt)
      if (fire) fire.advance(dt)
      if (moving) camera.position.x = Math.sin(now / 1100) * 0.035
      renderer.render(world, camera)
      frame = requestAnimationFrame(render)
    }
    resize()
    render(previous)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      element.removeEventListener('pointermove', onMove)
      renderer.domElement.removeEventListener('webglcontextlost', lost)
      world.traverse((node) => {
        if (node instanceof THREE.Points) {
          node.geometry.dispose()
          node.material.dispose()
        }
      })
      renderer.dispose()
      renderer.domElement.remove()
    }
  }, [mode, weather, moving, reducedMotion, webgl])

  return (
    <div
      ref={host}
      className={`trail-scene scene-${mode} ${className}`}
      aria-label={sceneCopy[mode]}
      role="img"
    >
      <div className="scene-fallback" aria-hidden={webgl && !reducedMotion}>
        {sceneCopy[mode]}
      </div>
      <div className="scene-vignette" aria-hidden="true" />
    </div>
  )
}

function pointLayer(positions: number[], color: string, size: number, opacity: number) {
  const geometry = new THREE.BufferGeometry().setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3),
  )
  const material = new THREE.PointsMaterial({
    color,
    size,
    opacity,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
  return new THREE.Points(geometry, material)
}

function fallingWeather(snow: boolean) {
  const positions: number[] = []
  const speeds: number[] = []
  for (let i = 0; i < 155; i++) {
    positions.push(((i * 47) % 100) / 10 - 5, ((i * 29) % 100) / 10 - 5, -((i * 31) % 80) / 20)
    speeds.push(0.8 + (i % 7) * 0.11)
  }
  const points = pointLayer(
    positions,
    snow ? '#f8ffff' : '#b7d9df',
    snow ? 0.042 : 0.022,
    snow ? 0.72 : 0.5,
  )
  return {
    points,
    advance(dt: number) {
      const p = points.geometry.attributes.position
      for (let i = 0; i < p.count; i++) {
        p.setY(i, p.getY(i) - speeds[i] * dt)
        if (p.getY(i) < -5) p.setY(i, 5)
      }
      p.needsUpdate = true
    },
  }
}

function waterGlints() {
  const positions: number[] = []
  for (let i = 0; i < 75; i++)
    positions.push(((i * 37) % 100) / 10 - 5, ((i * 17) % 25) / 100 - 2.1, -1.2 - (i % 11) * 0.13)
  const points = pointLayer(positions, '#f8df9c', 0.032, 0.42)
  return {
    points,
    advance(dt: number) {
      points.rotation.z += dt * 0.06
      points.position.x = Math.sin(performance.now() / 1700) * 0.035
    },
  }
}

function embers() {
  const positions: number[] = []
  for (let i = 0; i < 42; i++)
    positions.push(((i * 19) % 20) / 50 - 0.2, -2.2 + (i % 11) / 14, -1.5 - (i % 4) * 0.08)
  const points = pointLayer(positions, '#ffb05a', 0.045, 0.84)
  return {
    points,
    advance(dt: number) {
      const p = points.geometry.attributes.position
      for (let i = 0; i < p.count; i++) {
        p.setY(i, p.getY(i) + dt * (0.12 + (i % 3) * 0.05))
        if (p.getY(i) > -1.35) p.setY(i, -2.25)
      }
      p.needsUpdate = true
    },
  }
}
