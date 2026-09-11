import * as THREE from 'three'
import type { GameCommand, Outcome } from '../engine-types'
import { describeOutcome, humanize } from '../presentation'
import { Campaign } from './campaign'
import { makeWorldSave, serializeWorld, storeWorld, type SpatialState } from './persistence'
import { createWorld, type WorldScene } from './world'
import { SimulationClock } from './clock'
import { GameInput, type InputAction } from './input'
import { initPhysics, MotionWorld, type Pose } from './physics'
import { GameAudio } from './audio'
import { sceneWeather } from './weather'
import { ActivityDirector } from './activities/director'
import { createActivityProps } from './activities/props'
import type { ActivityRequest, CrossingMethod } from './campaign'
import type { GameSettings, Overlay, RuntimeCallbacks, RuntimeSnapshot } from './contracts'

export function initialSpatial(): SpatialState {
  return {
    regionId: 'independence',
    terrain: 'Plains',
    regionIndex: 0,
    wagon: { x: 0, z: 20, yaw: 0, speed: 0 },
    player: { x: -3, z: 20, yaw: 0, pitch: -0.06 },
    mode: 'riding',
    frontierZ: 20,
    travelRemainder: 0,
    activity: null,
  }
}
type Options = {
  callbacks: RuntimeCallbacks
  settings: GameSettings
  spatial?: SpatialState
  persist?: boolean
}
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
function phase(status: string | Record<string, string>) {
  return typeof status === 'string' ? status : Object.keys(status)[0]
}

/** Owns the live game; rendering, campaign commits and UI notifications meet only here. */
export class GameRuntime {
  private canvas: HTMLCanvasElement
  private campaign: Campaign
  private callbacks: RuntimeCallbacks
  private settings: GameSettings
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera: THREE.PerspectiveCamera
  private world: WorldScene
  private physics: MotionWorld
  private input: GameInput
  private audio = new GameAudio()
  private activities: ActivityDirector
  private props: ReturnType<typeof createActivityProps>
  private clock = new SimulationClock()
  private spatial: SpatialState
  private paused = true
  private disposed = false
  private animation = 0
  private lastNow = 0
  private elapsed = 0
  private saveElapsed = 0
  private publishElapsed = 0
  private distance = 0
  private previousWagon: Pose
  private previousPlayer: { x: number; z: number; yaw: number; pitch: number }
  private lastStatus = ''
  private lastLandmark = ''
  private abort = new AbortController()
  private resizeObserver: ResizeObserver
  private frameTimes: number[] = []
  private frameSamples: Array<{ ms: number; mode: string; speed: number; region: number }> = []
  private fps = 0
  private smoothedFrame = 16.7
  private interaction: RuntimeSnapshot['interaction'] = null
  private persist: boolean
  private lastEvent = ''
  private presentSavedDecision = true
  private renderDirty = true

  static async create(
    canvas: HTMLCanvasElement,
    campaign: Campaign,
    options: Options,
  ): Promise<GameRuntime> {
    await initPhysics()
    return new GameRuntime(canvas, campaign, options)
  }
  private constructor(canvas: HTMLCanvasElement, campaign: Campaign, options: Options) {
    this.persist = options.persist ?? true
    this.canvas = canvas
    this.campaign = campaign
    this.settings = options.settings
    this.callbacks = options.callbacks
    this.spatial = options.spatial ? structuredClone(options.spatial) : initialSpatial()
    this.campaign.travelRemainder = this.spatial.travelRemainder
    const context = canvas.getContext('webgl2', {
      antialias: this.settings.quality !== 'low',
      alpha: false,
      powerPreference: 'high-performance',
    })
    if (!context)
      throw new Error(
        'Pioneer Trail needs WebGL 2. Enable hardware acceleration or use a compatible desktop browser. Your saved journey is preserved.',
      )
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      context,
      antialias: this.settings.quality !== 'low',
    })
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.05
    this.renderer.shadowMap.enabled = this.settings.quality !== 'low'
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.camera = new THREE.PerspectiveCamera(this.settings.fov, 1, 0.06, 1000)
    this.scene.add(this.camera)
    this.props = createActivityProps(this.camera)
    this.scene.add(this.props.tackle)
    this.elapsed = this.spatial.activity?.elapsed ?? 0
    this.world = this.makeWorld()
    this.physics = new MotionWorld(this.world)
    this.physics.setWagon(this.spatial.wagon)
    this.previousWagon = { ...this.spatial.wagon }
    this.previousPlayer = { ...this.spatial.player }
    this.activities = new ActivityDirector({
      campaign,
      spatial: () => this.spatial,
      world: () => this.world,
      camera: this.camera,
      now: () => this.elapsed,
      save: () => this.writeSave(),
      notice: (message) => this.callbacks.onNotice(message),
      committed: (kind) => {
        if (kind === 'crossing') this.transition(true)
        this.syncCampaign()
        this.publish()
      },
    })
    this.activities.restoreWildlife()
    this.input = new GameInput(
      canvas,
      this.settings,
      (action) => this.action(action),
      () => this.open('pause'),
    )
    this.resizeObserver = new ResizeObserver(() => this.resize())
    this.resizeObserver.observe(canvas)
    const signal = this.abort.signal
    window.addEventListener('pagehide', () => this.trySave(), { signal })
    canvas.addEventListener(
      'webglcontextlost',
      (event) => {
        event.preventDefault()
        this.pause()
        this.callbacks.onError(
          'Graphics were interrupted. Your last saved journey is preserved. Reload to resume.',
        )
      },
      { signal },
    )
    canvas.addEventListener(
      'pointerdown',
      () => {
        void this.audio.unlock()
      },
      { signal },
    )
    window.addEventListener(
      'keydown',
      () => {
        void this.audio.unlock()
      },
      { signal },
    )
    this.campaign.setAutosave(() => this.writeSave())
    this.lastStatus = phase(this.campaign.view().status)
    this.lastLandmark = this.campaign.view().current_node?.id ?? ''
    this.setSettings(this.settings)
    this.resize()
    this.updateCamera(1)
    this.animation = requestAnimationFrame(this.frame)
    this.publish()
    if (import.meta.env.DEV || new URLSearchParams(location.search).has('evidence')) {
      // Read-only observation. Tests still use real controls for mechanics and progression.
      Object.assign(window, {
        __trail: {
          snapshot: () => this.snapshot(),
          save: () => this.save(),
          frames: () => [...this.frameTimes],
          frameSamples: () => [...this.frameSamples],
          audio: () => this.audio.inspect(),
          world: () => ({
            locations: this.world.locations,
            fishingTarget: this.props.tackle.visible ? this.props.bobber.position.toArray() : null,
            river: this.world.river,
            trail: Array.from({ length: 24 }, (_, i) => ({
              x: this.world.trailX(i * 10),
              z: i * 10,
            })),
            wildlife: this.world.wildlife.map((a) => ({
              id: a.id,
              alive: a.alive,
              harvested: a.harvested,
              animal: a.animal,
              position: {
                x: a.position.x,
                y: a.position.y + (a.animal === 'Deer' ? 1.3 : 0.25),
                z: a.position.z,
              },
            })),
          }),
          renderer: () => this.rendererInfo(),
          forceNight: () => {
            this.elapsed = (Math.PI * 1.5 - 0.65) / 0.009
            this.renderDirty = true
          },
        },
      })
    }
  }
  private makeWorld(): WorldScene {
    const view = this.campaign.view()
    const river =
      phase(view.status) === 'AwaitingRiver' ||
      view.active_minigame?.kind === 'Raft' ||
      this.spatial.activity?.kind === 'crossing'
    return createWorld(this.scene, {
      terrain: this.spatial.terrain,
      river,
      seed: Number(BigInt(view.seed) % 2147483647n) + this.spatial.regionIndex,
      quality: this.settings.quality,
    })
  }
  getView() {
    return this.campaign.view()
  }
  setKey(code: string, down: boolean) {
    this.input.setKey(code, down)
  }
  command(command: GameCommand) {
    try {
      if (command === 'BeginHunt') return this.beginActivity({ kind: 'hunt' })
      if (
        command === 'Fish' ||
        (typeof command === 'object' && 'Gather' in command && command.Gather.activity === 'Fish')
      )
        return this.beginActivity({ kind: 'fish' })
      if (
        typeof command === 'object' &&
        'CrossRiver' in command &&
        ['Ford', 'Caulk', 'Guide'].includes(command.CrossRiver.method)
      )
        return this.beginActivity({
          kind: 'crossing',
          method: command.CrossRiver.method as CrossingMethod,
        })
      const result = this.campaign.command(command)
      const rejected = result.outcomes.find(
        (outcome) => typeof outcome === 'object' && 'Rejected' in outcome,
      )
      if (rejected) this.callbacks.onNotice(this.describe(rejected))
      else {
        const important = result.outcomes.filter((outcome) => typeof outcome === 'object')
        if (important.length)
          this.callbacks.onNotice(this.describe(important[important.length - 1]))
      }
      this.syncCampaign()
      if (result.view.active_minigame?.kind === 'Raft' && !result.view.activity) {
        this.transition(true)
        this.callbacks.onNotice(
          'Columbia River launch. Approach the riverbank and choose to launch the raft.',
        )
      }
      this.publish()
      return result
    } catch (error) {
      this.fail(error)
      throw error
    }
  }
  private describe(outcome: unknown): string {
    return (
      describeOutcome(outcome as Outcome, this.campaign.view()) ??
      (outcome && typeof outcome === 'object'
        ? humanize(Object.keys(outcome)[0])
        : humanize(String(outcome)))
    )
  }
  pause() {
    this.holdWorld()
    this.trySave()
    this.publish()
  }
  private holdWorld() {
    this.paused = true
    this.renderDirty = true
    this.spatial.wagon.speed = 0
    this.input.setActive(false)
    this.audio.update({
      speed: 0,
      walking: false,
      water: false,
      camp: false,
      paused: true,
      weather: 'clear',
    })
  }
  resume() {
    if (this.disposed || document.hidden) return
    this.paused = false
    this.lastNow = performance.now()
    this.input.setActive(true)
    this.canvas.focus({ preventScroll: true })
    void this.audio.unlock()
    this.publish()
  }
  private open(overlay: Overlay) {
    this.pause()
    this.callbacks.onOpen(overlay)
  }
  setSettings(settings: GameSettings) {
    this.settings = { ...settings }
    this.input.settings = this.settings
    this.camera.fov = clamp(settings.fov, 50, 100)
    this.camera.updateProjectionMatrix()
    this.renderer.shadowMap.enabled = settings.quality !== 'low'
    this.audio.setSettings({ muted: settings.muted, volume: settings.volume })
    this.resize()
  }
  private resize() {
    this.renderDirty = true
    const width = Math.max(1, this.canvas.clientWidth),
      height = Math.max(1, this.canvas.clientHeight)
    this.renderer.setPixelRatio(
      this.settings.quality === 'low'
        ? 1
        : Math.min(devicePixelRatio, this.settings.quality === 'high' ? 2 : 1.5),
    )
    this.renderer.setSize(width, height, false)
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
  }
  action(action: InputAction) {
    try {
      this.handleAction(action)
    } catch (error) {
      this.fail(error)
      this.publish()
    }
  }
  private handleAction(action: InputAction) {
    if (action === 'pause') {
      if (this.paused) this.resume()
      else this.open('pause')
      return
    }
    if (action === 'decision') {
      const view = this.campaign.view()
      if (view.pending_event) this.open('encounter')
      else if (phase(view.status) === 'AwaitingFork' && !view.active_minigame) this.open('route')
      else if (['Arrived', 'Failed'].includes(phase(view.status))) this.open('ending')
      return
    }
    if (this.paused) return
    if (action === 'primary') {
      this.activities.primary()
      this.publish()
      return
    }
    if (action === 'reload') {
      this.activities.reload()
      this.publish()
      return
    }
    if (action === 'finish') {
      this.activities.finish(false)
      this.publish()
      return
    }
    if (action === 'interact') {
      this.interact()
      return
    }
    if (['map', 'journal', 'inventory', 'party', 'settings'].includes(action)) {
      this.open(action as Overlay)
      return
    }
    if (action === 'camp') {
      this.openNear('camp')
      return
    }
    if (action === 'hunt' || action === 'fish') {
      try {
        this.beginActivity({ kind: action })
      } catch (error) {
        this.callbacks.onNotice(error instanceof Error ? error.message : String(error))
      }
      return
    }
  }
  beginActivity(request: ActivityRequest) {
    const p = this.spatial.player,
      w = this.spatial.wagon,
      world = this.world
    if (request.kind === 'crossing') {
      if (!world.river || Math.abs(w.z - (world.river.startZ - 12)) > 22)
        throw new Error('Bring the wagon to the riverbank before launching.')
      this.spatial.mode = 'riding'
      this.spatial.player.yaw = w.yaw
    } else {
      if (this.spatial.mode !== 'walking')
        throw new Error('Stop and dismount before beginning an activity.')
      if (
        request.kind === 'fish' &&
        !world.locations.some(
          (l) =>
            l.kind === 'water' &&
            Math.hypot(p.x - l.position[0], p.z - l.position[2]) < l.radius + 2,
        )
      )
        throw new Error('Approach a riverbank to fish.')
    }
    const result = this.activities.begin(request)
    this.callbacks.onOpen(null)
    this.resume()
    this.publish()
    return result
  }
  private openNear(kind: string) {
    const p = this.spatial.mode === 'riding' ? this.spatial.wagon : this.spatial.player
    const location = this.world.locations.find((location) => location.kind === kind)
    if (
      !location ||
      Math.hypot(p.x - location.position[0], p.z - location.position[2]) > location.radius + 1.5 ||
      this.spatial.mode !== 'walking'
    ) {
      this.callbacks.onNotice('Dismount and approach the campfire to make camp.')
      return
    }
    this.open('camp')
  }
  interact() {
    if (this.paused) return
    if (this.activities.collect()) {
      this.publish()
      return
    }
    const wagon = this.spatial.wagon
    if (this.spatial.mode === 'riding') {
      const rafting = this.campaign.view().active_minigame?.kind === 'Raft'
      const atRaftLaunch =
        rafting &&
        this.world.river &&
        Math.abs(wagon.speed) <= 0.2 &&
        Math.abs(wagon.z - (this.world.river.startZ - 12)) <= 22
      if (this.atRiverHalt() || atRaftLaunch) {
        if (rafting) {
          this.beginActivity({ kind: 'crossing', method: 'Raft' })
          return
        }
        this.open('river')
        return
      }
      if (Math.abs(wagon.speed) > 0.2) {
        this.callbacks.onNotice('Hold Space to stop before getting down.')
        return
      }
      for (const side of [-1, 1]) {
        const x = wagon.x + Math.cos(wagon.yaw) * 3 * side,
          z = wagon.z - Math.sin(wagon.yaw) * 3 * side
        if (!this.physics.canStand(x, z)) continue
        this.spatial.mode = 'walking'
        this.spatial.player = { x, z, yaw: wagon.yaw, pitch: 0 }
        this.previousPlayer = { ...this.spatial.player }
        this.trySave()
        this.callbacks.onNotice('On foot. WASD to walk; E near the driver’s seat to board.')
        this.publish()
        return
      }
      this.callbacks.onNotice('Both sides are blocked. Move the wagon to a clear stopping place.')
      return
    }
    const p = this.spatial.player
    if (Math.hypot(p.x - wagon.x, p.z - wagon.z) < 4.5) {
      this.spatial.mode = 'riding'
      this.spatial.player.yaw = wagon.yaw
      this.spatial.player.pitch = -0.06
      this.trySave()
      this.callbacks.onNotice('Seated. Hold W to move, A/D to steer, Space to brake.')
      this.publish()
      return
    }
    if (this.inRiverInspectionArea(p)) {
      this.open('river')
      return
    }
    this.findInteraction()
    if (!this.interaction) {
      this.callbacks.onNotice('Approach the fire, supplies, a companion, trader, or riverbank.')
      return
    }
    const map: Record<string, Overlay> = {
      camp: 'camp',
      supplies: 'inventory',
      companion: 'dialogue',
      trader: 'trader',
      water: 'river',
    }
    if (
      this.interaction.kind === 'water' &&
      this.campaign.view().active_minigame?.kind === 'Raft'
    ) {
      this.beginActivity({ kind: 'crossing', method: 'Raft' })
      return
    }
    if (this.interaction.kind === 'water' && phase(this.campaign.view().status) !== 'AwaitingRiver')
      this.callbacks.onNotice('Suitable fishing water. Press F to cast from the bank.')
    else this.open(map[this.interaction.kind] ?? 'dialogue')
  }
  private findInteraction() {
    const p = this.spatial.mode === 'riding' ? this.spatial.wagon : this.spatial.player
    if (this.spatial.mode === 'riding') {
      this.interaction = {
        kind: this.atRiverHalt() ? 'water' : 'dismount',
        label: this.atRiverHalt()
          ? 'E · Inspect the crossing'
          : Math.abs(this.spatial.wagon.speed) > 0.2
            ? 'Space · Stop the wagon'
            : 'E · Get down',
        distance: 0,
      }
      return
    }
    let closest: RuntimeSnapshot['interaction'] =
      Math.hypot(p.x - this.spatial.wagon.x, p.z - this.spatial.wagon.z) < 4.5
        ? {
            kind: 'board',
            label: 'E · Board the wagon',
            distance: Math.hypot(p.x - this.spatial.wagon.x, p.z - this.spatial.wagon.z),
          }
        : null
    // Boarding has the same priority here as in interact(), so the hint describes E's action.
    if (closest) {
      this.interaction = closest
      return
    }
    if (this.inRiverInspectionArea(p)) {
      this.interaction = { kind: 'water', label: 'E · Inspect the crossing', distance: 0 }
      return
    }
    for (const location of this.world.locations) {
      const d = Math.hypot(p.x - location.position[0], p.z - location.position[2])
      if (d <= location.radius && (!closest || d < closest.distance))
        closest = { kind: location.kind, label: `E · ${location.label}`, distance: d }
    }
    this.interaction = closest
  }
  /** The river halt is a stable interaction zone, rather than a single scenery marker. */
  private atRiverHalt() {
    const river = this.world.river
    return (
      !!river &&
      phase(this.campaign.view().status) === 'AwaitingRiver' &&
      Math.abs(this.spatial.wagon.speed) <= 0.2 &&
      Math.abs(this.spatial.wagon.z - (river.startZ - 12)) <= 22
    )
  }
  private inRiverInspectionArea(position: { x: number; z: number }) {
    const river = this.world.river
    if (!river || phase(this.campaign.view().status) !== 'AwaitingRiver') return false
    const wagon = this.spatial.wagon
    return (
      Math.abs(position.x - wagon.x) <= 20 &&
      position.z >= wagon.z - 7 &&
      position.z <= river.startZ + 5
    )
  }
  private isBlockedRiverWade(position: { x: number; z: number }) {
    const river = this.world.river
    return (
      !!river &&
      phase(this.campaign.view().status) === 'AwaitingRiver' &&
      position.z > river.startZ - 1 &&
      position.z < river.endZ + 2 &&
      Math.abs(position.x - this.world.trailX(position.z)) < 110
    )
  }
  private frame = (now: number) => {
    if (this.disposed) return
    const dt = this.lastNow ? Math.max(0, (now - this.lastNow) / 1000) : 0
    this.lastNow = now
    if (dt > 0 && !this.paused) {
      this.frameTimes.push(dt * 1000)
      this.frameSamples.push({
        ms: dt * 1000,
        mode: this.spatial.mode,
        speed: Math.abs(this.spatial.wagon.speed),
        region: this.spatial.regionIndex,
      })
      if (this.frameSamples.length > 36000) this.frameSamples.shift()
      if (this.frameTimes.length > 36000) this.frameTimes.shift()
      this.smoothedFrame = this.smoothedFrame * 0.95 + dt * 1000 * 0.05
      this.fps = 1000 / this.smoothedFrame
    }
    try {
      if (this.presentSavedDecision) {
        this.presentSavedDecision = false
        const saved = this.campaign.view(),
          status = phase(saved.status)
        if (saved.pending_event) {
          this.lastEvent = saved.pending_event.id
          this.open('encounter')
        } else if (status === 'AwaitingFork' && !saved.active_minigame) this.open('route')
        else if (status === 'Arrived' || status === 'Failed') this.open('ending')
      }
      // A paused scene is still. Redraw only for resize, settings or a campaign change.
      if (this.paused && !this.renderDirty) {
        this.animation = requestAnimationFrame(this.frame)
        return
      }
      const alpha = this.clock.advance(dt, this.paused || document.hidden, (step) =>
        this.step(step),
      )
      this.updateCamera(this.paused ? 1 : alpha)
      const weather = this.currentSceneWeather()
      this.world.update({
        dt: this.paused ? 0 : Math.min(dt, 0.1),
        time: this.spatial.activity?.elapsed ?? this.elapsed,
        speed: this.paused ? 0 : this.spatial.wagon.speed,
        distance: this.distance,
        cameraPosition: this.camera.position,
        sheltered:
          this.spatial.mode === 'riding' ||
          this.world.shelteredAt(
            this.camera.position.x,
            this.camera.position.y,
            this.camera.position.z,
          ),
        weather,
        daylight: this.daylight(),
      })
      const activity = this.spatial.activity
      const waterPosition =
        activity?.kind === 'fish' ? this.activities.fishingTarget() : this.camera.position
      this.props.update(activity?.kind ?? null, this.elapsed, activity?.phase ?? '', waterPosition)
      this.renderer.render(this.scene, this.camera)
      this.renderDirty = false
      this.audio.update({
        speed: this.spatial.wagon.speed,
        walking:
          this.spatial.mode === 'walking' &&
          (this.input.movement().forward !== 0 || this.input.movement().strafe !== 0),
        water: this.near('water', 20),
        camp: this.near('camp', 12),
        paused: this.paused,
        weather,
      })
      this.publishElapsed += dt
      if (this.publishElapsed > 0.1) {
        this.publishElapsed = 0
        this.findInteraction()
        this.publish()
      }
    } catch (error) {
      this.fail(error)
    }
    this.animation = requestAnimationFrame(this.frame)
  }
  private step(dt: number) {
    this.elapsed += dt
    this.saveElapsed += dt
    this.previousWagon = { ...this.spatial.wagon }
    this.previousPlayer = { ...this.spatial.player }
    this.activities.tick(dt, this.input.movement().brake)
    const look = this.input.look(dt)
    this.spatial.player.yaw += look.yaw
    this.spatial.player.pitch = clamp(this.spatial.player.pitch + look.pitch, -1.25, 1.2)
    if (this.spatial.mode === 'riding') {
      const movedWorld = this.world
      const view = this.campaign.view(),
        canTravel = phase(view.status) === 'Travelling' && !view.pending_event && !view.activity
      const movement = this.input.movement()
      const crossing = this.spatial.activity?.kind === 'crossing',
        river = this.world.river
      const current =
        crossing &&
        river &&
        this.spatial.wagon.z > river.startZ &&
        this.spatial.wagon.z < river.endZ
          ? river.current
          : 0
      const pose = this.physics.drive(
        this.spatial.wagon,
        movement,
        dt,
        view.pace === 'Grueling' ? 1.3 : view.pace === 'Strenuous' ? 1.15 : 1,
        current,
      )
      this.distance +=
        Math.hypot(pose.x - this.spatial.wagon.x, pose.z - this.spatial.wagon.z) *
        Math.sign(pose.speed)
      this.spatial.player.yaw += pose.yaw - this.spatial.wagon.yaw
      if (river && !crossing && pose.z > river.startZ - 9) {
        pose.z = river.startZ - 9
        pose.speed = 0
        this.callbacks.onNotice(
          'Stop at the riverbank. Get down and inspect the crossing before entering the water.',
        )
      }
      this.spatial.wagon = pose
      if (crossing) this.activities.crossing(pose, this.physics.lastObstacle)
      // A committed crossing may synchronously replace the region and reset its frontier.
      if (this.world !== movedWorld) return
      const progress = Math.max(0, pose.z - this.spatial.frontierZ)
      if (progress > 0) {
        this.spatial.frontierZ = pose.z
        if (canTravel) {
          this.campaign.travelMeters(progress)
          this.syncCampaign()
          if (this.world !== movedWorld || this.paused) return
        }
      }
      if (pose.z > this.world.length - 14 && canTravel) this.transition(false)
    } else {
      const p = this.physics.walk({ ...this.spatial.player, speed: 0 }, this.input.movement(), dt)
      if (this.isBlockedRiverWade(p)) {
        this.callbacks.onNotice('The wagon cannot follow on foot. Return and inspect the crossing (E).')
      } else {
        this.spatial.player.x = p.x
        this.spatial.player.z = p.z
      }
    }
    if (this.saveElapsed > 2) {
      this.saveElapsed = 0
      this.trySave()
    }
  }
  private near(kind: string, range: number) {
    const p = this.spatial.mode === 'riding' ? this.spatial.wagon : this.spatial.player
    return this.world.locations.some(
      (l) => l.kind === kind && Math.hypot(p.x - l.position[0], p.z - l.position[2]) < range,
    )
  }
  private daylight() {
    const v = this.campaign.view()
    return clamp(
      0.5 + 0.5 * Math.sin((v.day * 0.6 + this.elapsed * 0.009 + 0.65) % (Math.PI * 2)),
      0.02,
      1,
    )
  }
  private updateCamera(alpha: number) {
    const s = this.spatial,
      old = this.previousWagon,
      w = s.wagon
    this.world.wagon.position.set(
      THREE.MathUtils.lerp(old.x, w.x, alpha),
      this.world.heightAt(w.x, w.z),
      THREE.MathUtils.lerp(old.z, w.z, alpha),
    )
    const ahead = this.world.heightAt(w.x + Math.sin(w.yaw) * 2, w.z + Math.cos(w.yaw) * 2),
      behind = this.world.heightAt(w.x - Math.sin(w.yaw) * 2, w.z - Math.cos(w.yaw) * 2)
    const river = this.world.river,
      floating =
        this.spatial.activity?.kind === 'crossing' &&
        this.activities.method !== 'Ford' &&
        river &&
        w.z > river.startZ - 2 &&
        w.z < river.endZ + 2
    if (floating) this.world.wagon.position.y = this.world.waterHeightAt(w.x, w.z) - 0.35
    this.world.wagon.rotation.set(floating ? 0 : -Math.atan2(ahead - behind, 4), w.yaw, 0, 'YXZ')
    this.world.wagon.updateMatrixWorld(true)
    if (s.mode === 'riding') {
      const seat = this.world.seatLocal.clone().applyMatrix4(this.world.wagon.matrixWorld)
      if (!this.settings.reducedMotion && !this.paused)
        seat.y += Math.sin(this.distance * 7) * 0.012 * Math.min(1, Math.abs(w.speed))
      this.camera.position.copy(seat)
    } else {
      const x = THREE.MathUtils.lerp(this.previousPlayer.x, s.player.x, alpha),
        z = THREE.MathUtils.lerp(this.previousPlayer.z, s.player.z, alpha)
      this.camera.position.set(x, this.world.heightAt(x, z) + 1.68, z)
    }
    const yaw = s.player.yaw,
      pitch = s.player.pitch
    this.camera.lookAt(
      this.camera.position
        .clone()
        .add(
          new THREE.Vector3(
            Math.sin(yaw) * Math.cos(pitch),
            Math.sin(pitch),
            Math.cos(yaw) * Math.cos(pitch),
          ),
        ),
    )
  }
  enablePersistence() {
    this.persist = true
    this.trySave()
  }
  private syncCampaign() {
    this.renderDirty = true
    const view = this.campaign.view(),
      status = phase(view.status),
      landmark = view.current_node?.id ?? ''
    const eventId = view.pending_event?.id ?? ''
    const newEvent = eventId !== '' && eventId !== this.lastEvent
    const resolvedEvent = eventId === '' && this.lastEvent !== ''
    this.lastEvent = eventId
    const previousStatus = this.lastStatus
    const changed = status !== previousStatus || landmark !== this.lastLandmark
    this.lastStatus = status
    this.lastLandmark = landmark
    if (
      changed &&
      (['AwaitingRiver', 'AtLandmark', 'AwaitingFork'].includes(status) ||
        (previousStatus === 'AwaitingRiver' && status === 'Travelling' && this.world.river))
    )
      this.transition(true)
    if (status === 'Arrived' || status === 'Failed') {
      if (changed) this.open('ending')
      return
    }
    // A landmark and an encounter can arrive together. Resolve the encounter before its route.
    if (eventId) {
      if (newEvent) this.open('encounter')
      return
    }
    if (!changed) {
      if (resolvedEvent && status === 'AwaitingFork' && !view.active_minigame) this.open('route')
      return
    }
    if (status === 'AwaitingEvent') this.open('encounter')
    else if (status === 'AwaitingFork') this.open('route')
    else if (status === 'AwaitingRiver')
      this.callbacks.onNotice('River ahead. Stop at the bank to inspect crossing choices.')
    else if (status === 'AtLandmark')
      this.callbacks.onNotice(
        `${view.current_node?.name}. Stop to trade, speak with travelers, or continue your route.`,
      )
  }
  private transition(checkpoint: boolean) {
    const view = this.campaign.view()
    this.physics.dispose()
    this.world.dispose()
    this.spatial.regionIndex++
    this.spatial.regionId = checkpoint
      ? (view.current_node?.id ?? view.target_node_id ?? 'trail')
      : `${view.target_node_id ?? 'trail'}-${this.spatial.regionIndex}`
    this.spatial.terrain = view.terrain
    this.spatial.wagon = { x: 0, z: 20, yaw: 0, speed: checkpoint ? 0 : this.spatial.wagon.speed }
    this.spatial.player = { x: -3, z: 20, yaw: 0, pitch: -0.06 }
    this.spatial.frontierZ = 20
    this.world = this.makeWorld()
    this.physics = new MotionWorld(this.world)
    this.physics.setWagon(this.spatial.wagon)
    this.previousWagon = { ...this.spatial.wagon }
    this.previousPlayer = { ...this.spatial.player }
    this.trySave()
  }
  save() {
    return serializeWorld(makeWorldSave(this.campaign, this.spatial))
  }
  private writeSave() {
    if (!this.persist) return
    this.spatial.travelRemainder = this.campaign.travelRemainder
    storeWorld(makeWorldSave(this.campaign, this.spatial))
  }
  private trySave() {
    try {
      this.writeSave()
    } catch (error) {
      this.callbacks.onError(`Save failed; export your journey before closing: ${String(error)}`)
    }
  }
  private fail(error: unknown) {
    this.holdWorld()
    this.callbacks.onError(error instanceof Error ? error.message : String(error))
    this.publish()
  }
  private currentSceneWeather() {
    return sceneWeather(this.campaign.view().weather, this.spatial.terrain)
  }
  private snapshot(): RuntimeSnapshot {
    const w = this.spatial.wagon
    return {
      mode: this.spatial.mode,
      paused: this.paused,
      sceneWeather: this.currentSceneWeather(),
      speed: w.speed,
      heading: this.spatial.player.yaw,
      position: { x: this.camera.position.x, y: this.camera.position.y, z: this.camera.position.z },
      wagon: { ...w, y: this.world.heightAt(w.x, w.z) },
      regionId: this.spatial.regionId,
      regionIndex: this.spatial.regionIndex,
      interaction: this.interaction,
      activity: this.activities.readout(),
      fps: this.fps,
      frameMs: this.smoothedFrame,
      drawCalls: this.renderer.info.render.calls,
      triangles: this.renderer.info.render.triangles,
      geometries: this.renderer.info.memory.geometries,
      textures: this.renderer.info.memory.textures,
      collisionCount: this.physics.collisions,
      view: this.campaign.view(),
    }
  }
  private publish() {
    this.callbacks.onSnapshot(this.snapshot())
  }
  private rendererInfo() {
    const gl = this.renderer.getContext(),
      ext = gl.getExtension('WEBGL_debug_renderer_info')
    return {
      renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
      width: this.canvas.width,
      height: this.canvas.height,
      quality: this.settings.quality,
    }
  }
  dispose() {
    if (this.disposed) return
    this.trySave()
    this.disposed = true
    cancelAnimationFrame(this.animation)
    this.abort.abort()
    this.resizeObserver.disconnect()
    this.input.dispose()
    this.audio.dispose()
    this.props.dispose()
    this.physics.dispose()
    this.world.dispose()
    this.renderer.dispose()
    this.campaign.setAutosave(() => {})
  }
}
