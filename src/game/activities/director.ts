import * as THREE from 'three'
import { Campaign, type ActivityRequest, type CrossingMethod } from '../campaign'
import type { SpatialState } from '../persistence'
import type { WorldScene } from '../world'
import type { RuntimeSnapshot } from '../contracts'
import { createFishing, fishingHint, pullLine, tickFishing, type FishingState } from './fishing'

type Hooks = {
  campaign: Campaign
  spatial(): SpatialState
  world(): WorldScene
  camera: THREE.PerspectiveCamera
  now(): number
  save(): void
  notice(message: string): void
  committed(kind: string, completed: boolean): void
}
/** Converts real aiming, retrieval, fishing inputs and crossing collisions into factual domain events. */
export class ActivityDirector {
  private hooks: Hooks
  private ray = new THREE.Raycaster()
  constructor(hooks: Hooks) {
    this.hooks = hooks
    const a = this.activity,
      active = this.campaign.view().activity
    if (a && active && a.phase === 'active') {
      a.phase = a.kind === 'hunt' ? 'aiming' : a.kind === 'fish' ? 'ready' : 'crossing'
      a.data = {
        loaded: true,
        reloadUntil: 0,
        startedAt: a.elapsed,
        ...(a.kind === 'fish' ? createFishing(active.seed) : {}),
      }
    }
  }
  private get activity() {
    return this.hooks.spatial().activity
  }
  private get campaign() {
    return this.hooks.campaign
  }
  begin(request: ActivityRequest) {
    if (this.activity) throw new Error('Finish the current activity first.')
    const result = accept(this.campaign.beginActivity(request))
    const active = result.view.activity
    if (!active) throw new Error('The activity could not be started.')
    const data: Record<string, number | string | boolean> = {
      loaded: true,
      reloadUntil: 0,
      startedAt: this.hooks.now(),
    }
    if (active.kind === 'fish') Object.assign(data, createFishing(active.seed))
    this.hooks.spatial().activity = {
      id: active.id,
      kind: active.kind,
      elapsed: this.hooks.now(),
      phase: active.kind === 'hunt' ? 'aiming' : active.kind === 'fish' ? 'ready' : 'crossing',
      data,
    }
    // Autosave already persisted the recoverable 'active' checkpoint for this activity.
    this.restoreWildlife()
    this.hooks.notice(
      active.kind === 'hunt'
        ? 'Aim at wildlife. Space or right-click fires; R reloads. Walk to a carcass and press E to collect. X returns to camp.'
        : active.kind === 'fish'
          ? 'Press Space to cast. Hook the bite, then reel without breaking your line.'
          : 'Hold W to cross. A/D steer against the current. Avoid rocks; each hit damages cargo.',
    )
    return result
  }
  restoreWildlife() {
    const active = this.campaign.view().activity
    if (!active || active.kind !== 'hunt') return
    const a = this.activity
    for (const animal of this.hooks.world().wildlife) {
      animal.alive = !active.targets.includes(animal.id)
      animal.harvested = !!active.collected_kills?.[animal.id]
      if (!animal.alive && a) {
        const x = a.data[`kill:${animal.id}:x`],
          z = a.data[`kill:${animal.id}:z`]
        if (typeof x === 'number' && typeof z === 'number')
          animal.position.set(x, this.hooks.world().heightAt(x, z), z)
      }
    }
  }
  primary() {
    const a = this.activity,
      active = this.campaign.view().activity
    if (!a || !active) return
    if (a.kind === 'hunt') {
      if (a.phase === 'collecting') {
        this.hooks.notice('Shooting time is over. Collect the game you hit or press X to return.')
        return
      }
      if (!a.data.loaded) {
        this.hooks.notice(a.phase === 'reloading' ? 'Loading the next shot…' : 'Press R to reload.')
        return
      }
      if (active.shots >= active.ammo_limit) {
        this.hooks.notice('No rounds remain for this hunt. Collect your game and return.')
        a.phase = 'collecting'
        return
      }
      const world = this.hooks.world()
      this.ray.setFromCamera(new THREE.Vector2(0, 0), this.hooks.camera)
      this.ray.far = 90
      const candidates = world.wildlife.filter((animal) => animal.alive)
      const hits = this.ray.intersectObjects(
        candidates.map((animal) => animal.root),
        true,
      )
      const hit = hits[0]
      const animal = hit
        ? candidates.find((animal) => animal.id === hit.object.userData.wildlifeId)
        : undefined
      // Solid scenery and the terrain can occlude the line of fire.
      let visible = !!animal
      if (hit) {
        world.wagon.updateWorldMatrix(true, true)
        const heroHit = this.ray.intersectObject(world.wagon, true)[0]
        if (heroHit && heroHit.distance < hit.distance) visible = false
        const step = 0.35,
          origin = this.ray.ray.origin,
          dir = this.ray.ray.direction
        for (let distance = step; distance < hit.distance; distance += step) {
          const x = origin.x + dir.x * distance,
            y = origin.y + dir.y * distance,
            z = origin.z + dir.z * distance
          if (
            y < world.heightAt(x, z) + 0.03 ||
            world.obstacles.some(
              (o) =>
                Math.abs(x - o.x) < o.halfX &&
                Math.abs(z - o.z) < o.halfZ &&
                Math.abs(y - o.y) < o.halfY,
            )
          ) {
            visible = false
            break
          }
        }
      }
      const target = visible ? animal : undefined
      const previous = structuredClone(a)
      a.data.loaded = false
      a.phase = 'empty'
      if (target) {
        a.data[`kill:${target.id}:x`] = target.position.x
        a.data[`kill:${target.id}:z`] = target.position.z
      }
      try {
        accept(
          this.campaign.recordActivity({
            id: active.id,
            sequence: active.sequence + 1,
            event: { kind: 'shot', targetId: target?.id ?? null, animal: target?.animal ?? null },
          }),
        )
      } catch (error) {
        const restored = this.campaign.view().activity
        if (restored?.id === active.id && restored.sequence === active.sequence)
          this.hooks.spatial().activity = previous
        throw error
      }
      if (target) {
        target.alive = false
        this.hooks.notice('Hit. Walk to the animal and press E to collect it.')
      } else this.hooks.notice('Miss. One round spent. Press R to reload.')
    } else if (a.kind === 'fish') {
      const target = this.fishingTarget()
      const state = pullLine(this.fishing())
      Object.assign(a.data, state, { castX: target.x, castZ: target.z })
      a.phase = state.phase
      this.hooks.save()
    }
  }
  reload() {
    const a = this.activity
    if (
      !a ||
      a.kind !== 'hunt' ||
      a.phase === 'reloading' ||
      a.phase === 'collecting' ||
      a.data.loaded
    )
      return
    a.phase = 'reloading'
    a.data.reloadUntil = a.elapsed + 1.8
    this.hooks.save()
  }
  collect(): boolean {
    const a = this.activity,
      active = this.campaign.view().activity
    if (!a || a.kind !== 'hunt' || !active) return false
    const p = this.hooks.spatial().player
    const animal = this.hooks
      .world()
      .wildlife.find(
        (animal) =>
          !animal.alive &&
          !animal.harvested &&
          Math.hypot(animal.position.x - p.x, animal.position.z - p.z) < 3,
      )
    if (!animal) return false
    accept(
      this.campaign.recordActivity({
        id: a.id,
        sequence: active.sequence + 1,
        event: { kind: 'collect', targetId: animal.id },
      }),
    )
    animal.harvested = true
    this.hooks.notice(
      `Collected ${animal.animal.toLowerCase()}. ${this.campaign.view().activity?.food_lbs ?? 0} lb in the hunting bag.`,
    )
    return true
  }
  tick(dt: number, holding: boolean) {
    const a = this.activity
    if (!a) return
    a.elapsed += dt
    if (a.kind === 'hunt') {
      if (a.phase === 'reloading' && a.elapsed >= Number(a.data.reloadUntil)) {
        a.phase = 'aiming'
        a.data.loaded = true
        this.hooks.save()
      }
      if (a.elapsed - Number(a.data.startedAt ?? a.elapsed) > 45 && a.phase !== 'collecting') {
        a.phase = 'collecting'
        this.hooks.notice('The hunt is over. Collect any game you hit, then X to return.')
        this.hooks.save()
      }
    } else if (a.kind === 'fish') {
      const state = tickFishing(this.fishing(), dt, holding)
      const changed = a.phase !== state.phase
      Object.assign(a.data, state)
      a.phase = state.phase
      if (changed && state.phase !== 'landed' && state.phase !== 'escaped') this.hooks.save()
      if (state.phase === 'landed') {
        const active = this.campaign.view().activity
        if (active && !active.targets.includes(`${a.id}:catch`))
          accept(
            this.campaign.recordActivity({
              id: a.id,
              sequence: active.sequence + 1,
              event: { kind: 'catch', fishId: `${a.id}:catch`, foodLbs: 12 },
            }),
          )
        this.hooks.notice(
          'You landed 12 lb of fish. One camp day, including meals, is now recorded.',
        )
        this.finish(true)
      } else if (state.phase === 'escaped') {
        this.hooks.notice('The fish escaped. The day spent fishing and meals are recorded.')
        this.finish(false)
      }
    }
  }
  crossing(pose: { x: number; z: number }, obstacleId: string | null) {
    const a = this.activity,
      river = this.hooks.world().river,
      active = this.campaign.view().activity
    if (!a || a.kind !== 'crossing' || !river || !active) return
    if (obstacleId && !active.obstacles.includes(obstacleId) && pose.z > river.startZ - 4) {
      this.campaign.recordActivity({
        id: a.id,
        sequence: active.sequence + 1,
        event: { kind: 'collision', obstacleId },
      })
      this.hooks.notice(
        `Collision: ${active.collision_loss_lbs} lb of cargo lost. Steer clear of the obstruction.`,
      )
    }
    if (pose.z > river.endZ + 8) {
      this.hooks.notice('The team reached the far bank. Crossing costs and losses recorded once.')
      this.finish(true)
    }
  }
  /** Keep a cast at the bank where it began, even when the player moves or reloads. */
  fishingTarget(): THREE.Vector3 {
    const world = this.hooks.world(),
      player = this.hooks.spatial().player,
      data = this.activity?.data
    let x = data?.castX,
      z = data?.castZ
    if (typeof x !== 'number' || typeof z !== 'number') {
      const bank = world.locations
        .filter((location) => location.kind === 'water')
        .reduce<WorldScene['locations'][number] | undefined>(
          (nearest, location) =>
            !nearest ||
            Math.hypot(player.x - location.position[0], player.z - location.position[2]) <
              Math.hypot(player.x - nearest.position[0], player.z - nearest.position[2])
              ? location
              : nearest,
          undefined,
        )
      x = (bank?.position[0] ?? player.x) + (bank?.id === 'riverbank' ? 0 : 4)
      z =
        bank?.id === 'riverbank' && world.river
          ? world.river.startZ + 3
          : (bank?.position[2] ?? player.z)
    }
    return new THREE.Vector3(x, world.waterHeightAt(x, z) + 0.04, z)
  }
  private fishing(): FishingState {
    const a = this.activity!
    return {
      phase: a.phase as FishingState['phase'],
      elapsed: Number(a.data.elapsed ?? 0),
      biteAt: Number(a.data.biteAt ?? 4),
      progress: Number(a.data.progress ?? 0),
      tension: Number(a.data.tension ?? 0.2),
    }
  }
  finish(completed = false) {
    const a = this.activity
    if (!a) return
    const previous = structuredClone(a)
    this.hooks.spatial().activity = null
    // The campaign autosave commits the cleared spatial checkpoint with its costs and rewards.
    try {
      accept(this.campaign.finishActivity(a.id, completed))
    } catch (error) {
      if (this.campaign.view().activity?.id === a.id) this.hooks.spatial().activity = previous
      throw error
    }
    this.hooks.committed(a.kind, completed)
  }
  readout(): RuntimeSnapshot['activity'] {
    const a = this.activity,
      active = this.campaign.view().activity
    if (!a || !active) return null
    if (a.kind === 'fish') {
      const f = this.fishing()
      return {
        kind: 'fish',
        phase: f.phase,
        hint: fishingHint(f),
        progress: f.progress,
        tension: f.tension,
      }
    }
    if (a.kind === 'hunt')
      return {
        kind: 'hunt',
        phase: a.phase,
        hint: `${active.shots}/${active.ammo_limit} rounds · ${active.food_lbs} lb collected · ${a.phase === 'reloading' ? 'Reloading…' : a.phase === 'empty' ? 'R · Reload' : 'Space · Fire'} · E collect · X return`,
        progress: Math.min(1, (a.elapsed - Number(a.data.startedAt ?? a.elapsed)) / 45),
        shots: active.shots,
      }
    const river = this.hooks.world().river!,
      p = this.hooks.spatial().wagon
    return {
      kind: 'crossing',
      phase: a.phase,
      hint: `W forward · A/D steer · ${active.cargo_lost_lbs} lb cargo lost · X retreat`,
      progress: clamp((p.z - river.startZ) / (river.endZ - river.startZ), 0, 1),
    }
  }
  get method(): CrossingMethod | null {
    return this.campaign.view().activity?.method ?? null
  }
}
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

function accept<T extends { outcomes: unknown[] }>(result: T): T {
  const rejected = result.outcomes.find((o) => o && typeof o === 'object' && 'Rejected' in o)
  if (rejected) throw new Error(String((rejected as { Rejected: unknown }).Rejected))
  return result
}
