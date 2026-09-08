import { readFile } from 'node:fs/promises'
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import init, { TrailEngine as WasmEngine } from '../public/wasm/pioneer_trail_web_engine.js'
import type { EngineResult, GameView } from '../src/engine-types'
import { Campaign, type EngineBoundary } from '../src/game/campaign'
import { ActivityDirector } from '../src/game/activities/director'
import { makeWorldSave, type SpatialState, type WorldSave } from '../src/game/persistence'
import type { WorldScene } from '../src/game/world'

await init({
  module_or_path: await readFile(
    new URL('../public/wasm/pioneer_trail_web_engine_bg.wasm', import.meta.url),
  ),
})

function campaignFromSave(raw?: string): Campaign {
  const engine = new WasmEngine('18446744073709551615')
  const boundary: EngineBoundary = {
    apply: (command) => JSON.parse(engine.apply(JSON.stringify(command))) as EngineResult,
    view: () => JSON.parse(engine.view()) as GameView,
    save: () => engine.save(),
    load: (save) => JSON.parse(engine.load(save)) as GameView,
    beginActivity: (request) =>
      JSON.parse(engine.begin_activity(JSON.stringify(request))) as EngineResult,
    recordActivity: (request) =>
      JSON.parse(engine.record_activity(JSON.stringify(request))) as EngineResult,
    finishActivity: (request) =>
      JSON.parse(engine.finish_activity(JSON.stringify(request))) as EngineResult,
  }
  const campaign = new Campaign(boundary)
  if (raw) campaign.load(raw)
  else {
    campaign.command({
      Configure: {
        trail_id: 'oregon',
        era_id: '1848',
        occupation_id: 'banker',
        departure_month: 3,
        party: ['Ada', 'James', 'Ruth', 'Thomas', 'Clara'],
      },
    })
    for (const [item, quantity] of [
      ['oxen', 3],
      ['food', 1500],
      ['ammunition', 10],
    ] as const)
      campaign.command({ Buy: { item_id: item, quantity } })
    campaign.command('Depart')
  }
  return campaign
}

function fixture(saved?: WorldSave, committed = () => {}) {
  const campaign = campaignFromSave(saved?.campaign)
  const spatial: SpatialState = saved
    ? structuredClone(saved.spatial)
    : {
        regionId: 'test-camp',
        terrain: campaign.view().terrain,
        regionIndex: 0,
        wagon: { x: 0, z: 20, yaw: 0, speed: 0 },
        player: { x: 0, z: -5, yaw: 0, pitch: 0 },
        mode: 'walking',
        frontierZ: 20,
        travelRemainder: 0,
        activity: null,
      }
  const root = new THREE.Group()
  root.position.z = -5
  const geometry = new THREE.BoxGeometry(1.5, 1.5, 1.5)
  const material = new THREE.MeshBasicMaterial()
  const target = new THREE.Mesh(geometry, material)
  target.position.y = 1
  target.userData.wildlifeId = 'deer-1'
  root.add(target)
  root.updateMatrixWorld(true)
  const animal = {
    id: 'deer-1',
    animal: 'Deer' as const,
    root,
    position: root.position,
    alive: true,
    harvested: false,
  }
  const world: WorldScene = {
    wagon: new THREE.Group(),
    seatLocal: new THREE.Vector3(),
    heightAt: () => 0,
    waterHeightAt: () => 0,
    shelteredAt: () => false,
    trailX: () => 0,
    obstacles: [],
    locations: [],
    wildlife: [animal],
    river: null,
    length: 240,
    update: () => {},
    dispose: () => {
      geometry.dispose()
      material.dispose()
    },
  }
  const camera = new THREE.PerspectiveCamera()
  camera.position.y = 1
  camera.updateMatrixWorld(true)
  let writes = 0,
    rejectWrite = Infinity
  let durable = saved
  const save = () => {
    writes += 1
    if (writes === rejectWrite) throw new Error('QuotaExceededError')
    durable = makeWorldSave(campaign, spatial)
  }
  campaign.setAutosave(save)
  const director = new ActivityDirector({
    campaign,
    spatial: () => spatial,
    world: () => world,
    camera,
    now: () => 10,
    save,
    notice: () => {},
    committed,
  })
  director.restoreWildlife()
  return {
    campaign,
    spatial,
    animal,
    director,
    world,
    get durable() {
      return durable!
    },
    rejectSaveAfter(successfulWrites: number) {
      rejectWrite = writes + successfulWrites + 1
    },
  }
}

function reachFishingWater(campaign: Campaign) {
  for (let days = 0; days < 50 && !campaign.view().can_fish; days += 1) {
    const event = campaign.view().pending_event
    if (event) {
      const choice = event.choices.find((candidate) => candidate.available)
      if (!choice) throw new Error('No available encounter choice')
      campaign.command({ Respond: { event_id: event.id, choice_id: choice.id } })
    } else campaign.command('TravelDay')
  }
  expect(campaign.view().can_fish).toBe(true)
}

describe('durable activity director with real WebAssembly', () => {
  it('resumes the committed initial checkpoint without needing a second begin write', () => {
    const f = fixture()
    try {
      f.rejectSaveAfter(1)
      expect(() => f.director.begin({ kind: 'hunt' })).not.toThrow()
      expect(f.durable.spatial.activity?.phase).toBe('active')
      const resumed = fixture(f.durable)
      try {
        expect(resumed.director.readout()?.phase).toBe('aiming')
        expect(resumed.spatial.activity?.data.loaded).toBe(true)
        expect(resumed.campaign.view().activity?.seed).toBe(f.campaign.view().activity?.seed)
        expect(resumed.campaign.view().day).toBe(0)
      } finally {
        resumed.world.dispose()
      }
    } finally {
      f.world.dispose()
    }
  })

  it('spends a shot without hitting wildlife through the visible wagon', () => {
    const f = fixture()
    const geometry = new THREE.BoxGeometry(2, 2, 1)
    const material = new THREE.MeshBasicMaterial()
    const wagonPanel = new THREE.Mesh(geometry, material)
    wagonPanel.position.set(0, 1, -2.5)
    f.world.wagon.add(wagonPanel)
    f.world.wagon.updateMatrixWorld(true)
    try {
      f.director.begin({ kind: 'hunt' })
      f.director.primary()
      expect(f.campaign.view().ammunition_available).toBe(199)
      expect(f.animal.alive).toBe(true)
      expect(f.campaign.view().activity?.pending_kills).toEqual({})
    } finally {
      geometry.dispose()
      material.dispose()
      f.world.dispose()
    }
  })

  it('keeps the actual riverbank cast target when fishing resumes after movement', () => {
    const f = fixture()
    f.world.locations.push(
      { id: 'fishing-water', kind: 'water', label: 'Stream', position: [19.5, 0, 34], radius: 3.8 },
      { id: 'riverbank', kind: 'water', label: 'Crossing', position: [0, 0, 92], radius: 5 },
    )
    f.world.river = { startZ: 104, endZ: 136, current: 0.8, depth: 2 }
    f.spatial.player = { x: 0, z: 94, yaw: 0, pitch: 0 }
    try {
      reachFishingWater(f.campaign)
      f.director.begin({ kind: 'fish' })
      f.director.primary()
      expect(f.spatial.activity?.data.castX).toBe(0)
      expect(f.spatial.activity?.data.castZ).toBe(107)
      const saved = structuredClone(f.durable)
      saved.spatial.player.z = 88
      const resumed = fixture(saved)
      try {
        expect(resumed.spatial.activity?.data.castX).toBe(0)
        expect(resumed.spatial.activity?.data.castZ).toBe(107)
        expect(resumed.director.readout()?.phase).toBe('waiting')
        expect(resumed.campaign.view().day).toBe(f.campaign.view().day)
      } finally {
        resumed.world.dispose()
      }
    } finally {
      f.world.dispose()
    }
  })

  it('keeps a fired shot durable without a second write or a free loaded round', () => {
    const f = fixture()
    try {
      f.director.begin({ kind: 'hunt' })
      f.rejectSaveAfter(1)
      expect(() => f.director.primary()).not.toThrow()
      expect(f.campaign.view().ammunition_available).toBe(199)
      expect(f.animal.alive).toBe(false)
      expect(f.spatial.activity?.data.loaded).toBe(false)
      expect(f.durable.spatial.activity).toEqual(f.spatial.activity)
      const resumed = fixture(f.durable)
      try {
        expect(resumed.animal.alive).toBe(false)
        resumed.director.primary()
        expect(resumed.campaign.view().ammunition_available).toBe(199)
      } finally {
        resumed.world.dispose()
      }
    } finally {
      f.world.dispose()
    }
  })

  it('restores the exact pre-shot checkpoint when the durable write fails', () => {
    const f = fixture()
    try {
      f.director.begin({ kind: 'hunt' })
      const beforeCampaign = f.campaign.save(),
        beforeSpatial = structuredClone(f.spatial)
      const beforeDurable = f.durable
      f.rejectSaveAfter(0)
      expect(() => f.director.primary()).toThrow('QuotaExceededError')
      expect(f.campaign.save()).toBe(beforeCampaign)
      expect(f.spatial).toEqual(beforeSpatial)
      expect(f.durable).toBe(beforeDurable)
      expect(f.animal.alive).toBe(true)
    } finally {
      f.world.dispose()
    }
  })

  it('keeps a finished hunt committed when storage rejects another write', () => {
    const f = fixture()
    try {
      f.director.begin({ kind: 'hunt' })
      f.rejectSaveAfter(1)
      expect(() => f.director.finish()).not.toThrow()
      expect(f.campaign.view().day).toBe(1)
      expect(f.campaign.view().activity).toBeNull()
      expect(f.spatial.activity).toBeNull()
      expect(f.durable.spatial.activity).toBeNull()
      expect(f.durable.campaign).toBe(f.campaign.save())
      // The next activity may fail its own save, but never sees a phantom old activity.
      expect(() => f.director.begin({ kind: 'hunt' })).toThrow('QuotaExceededError')
      expect(() => f.director.begin({ kind: 'hunt' })).not.toThrow()
    } finally {
      f.world.dispose()
    }
  })

  it('collects and restores a carcass without writing its award twice', () => {
    const f = fixture()
    try {
      f.director.begin({ kind: 'hunt' })
      f.director.primary()
      f.rejectSaveAfter(1)
      expect(() => f.director.collect()).not.toThrow()
      expect(f.animal.harvested).toBe(true)
      expect(f.campaign.view().activity?.food_lbs).toBe(55)
      const resumed = fixture(f.durable)
      try {
        expect(resumed.animal.harvested).toBe(true)
        expect(resumed.director.collect()).toBe(false)
        expect(resumed.campaign.view().activity?.food_lbs).toBe(55)
      } finally {
        resumed.world.dispose()
      }
    } finally {
      f.world.dispose()
    }
  })

  it.each(['begin', 'collect', 'finish'] as const)(
    'rolls back %s when its durable write fails',
    (operation) => {
      const f = fixture()
      try {
        if (operation !== 'begin') f.director.begin({ kind: 'hunt' })
        if (operation === 'collect') f.director.primary()
        const beforeCampaign = f.campaign.save(),
          beforeSpatial = structuredClone(f.spatial)
        const beforeDurable = f.durable
        f.rejectSaveAfter(0)
        expect(() =>
          operation === 'begin' ? f.director.begin({ kind: 'hunt' }) : f.director[operation](),
        ).toThrow('QuotaExceededError')
        expect(f.campaign.save()).toBe(beforeCampaign)
        expect(f.spatial).toEqual(beforeSpatial)
        expect(f.durable).toBe(beforeDurable)
        expect(f.animal.harvested).toBe(false)
      } finally {
        f.world.dispose()
      }
    },
  )

  it('does not resurrect the activity when its post-commit transition fails', () => {
    const f = fixture(undefined, () => {
      throw new Error('World transition failed')
    })
    try {
      f.director.begin({ kind: 'hunt' })
      expect(() => f.director.finish()).toThrow('World transition failed')
      expect(f.campaign.view().day).toBe(1)
      expect(f.campaign.view().activity).toBeNull()
      expect(f.spatial.activity).toBeNull()
      expect(f.durable.spatial.activity).toBeNull()
      expect(() => f.director.begin({ kind: 'hunt' })).not.toThrow()
    } finally {
      f.world.dispose()
    }
  })

  it('normalizes an initial fishing checkpoint with the same bite timing and no time cost', () => {
    const f = fixture()
    try {
      reachFishingWater(f.campaign)
      const day = f.campaign.view().day
      f.director.begin({ kind: 'fish' })
      const resumed = fixture(f.durable)
      try {
        expect(resumed.director.readout()?.phase).toBe('ready')
        expect(resumed.spatial.activity?.data.biteAt).toBe(f.spatial.activity?.data.biteAt)
        expect(resumed.campaign.view().activity?.seed).toBe(f.campaign.view().activity?.seed)
        expect(resumed.campaign.view().day).toBe(day)
        resumed.director.primary()
        expect(resumed.director.readout()?.phase).toBe('waiting')
      } finally {
        resumed.world.dispose()
      }
    } finally {
      f.world.dispose()
    }
  })

  it('resumes a landed catch after interrupted completion without awarding it twice', () => {
    const f = fixture()
    try {
      reachFishingWater(f.campaign)
      const beforeDay = f.campaign.view().day
      f.director.begin({ kind: 'fish' })
      f.director.primary()
      for (let frame = 0; frame < 500 && f.director.readout()?.phase === 'waiting'; frame += 1)
        f.director.tick(1 / 60, false)
      expect(f.director.readout()?.phase).toBe('bite')
      f.director.primary()
      for (let frame = 0; frame < 1800 && (f.director.readout()?.progress ?? 1) < 0.99; frame += 1)
        f.director.tick(1 / 60, (f.director.readout()?.tension ?? 1) < 0.65)
      expect(f.director.readout()?.phase).toBe('reeling')
      expect(f.director.readout()!.progress).toBeGreaterThanOrEqual(0.99)
      f.rejectSaveAfter(1)
      expect(() => f.director.tick(0.1, true)).toThrow('QuotaExceededError')
      expect(f.campaign.view().day).toBe(beforeDay)
      expect(f.campaign.view().activity?.food_lbs).toBe(12)
      expect(f.durable.spatial.activity?.phase).toBe('landed')
      const resumed = fixture(f.durable)
      try {
        expect(() => resumed.director.tick(1 / 60, false)).not.toThrow()
        expect(resumed.campaign.view().day).toBe(beforeDay + 1)
        expect(resumed.campaign.view().activity).toBeNull()
        expect(resumed.spatial.activity).toBeNull()
        f.director.tick(1 / 60, false)
        expect(resumed.campaign.save()).toBe(f.campaign.save())
        const finished = resumed.campaign.save()
        resumed.director.tick(1 / 60, false)
        expect(resumed.campaign.save()).toBe(finished)
      } finally {
        resumed.world.dispose()
      }
    } finally {
      f.world.dispose()
    }
  })
})
