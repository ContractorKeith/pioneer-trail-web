import { readFile } from 'node:fs/promises'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import init, { TrailEngine as WasmEngine } from '../public/wasm/pioneer_trail_web_engine.js'
import { TrailEngine } from '../src/engine'
import { Campaign, type ActivityEvent, type EngineBoundary } from '../src/game/campaign'
import type { EngineResult, GameView } from '../src/engine-types'
import {
  importWorld,
  LEGACY_SAVE_KEY,
  makeWorldSave,
  migrateLegacy,
  parseWorld,
  preserveWorldRaw,
  PRESERVED_WORLD_PREFIX,
  readWorld,
  serializeWorld,
  storeWorld,
  WORLD_BACKUP_KEY,
  WORLD_SAVE_KEY,
  type SpatialState,
} from '../src/game/persistence'

await init({
  module_or_path: await readFile(
    new URL('../public/wasm/pioneer_trail_web_engine_bg.wasm', import.meta.url),
  ),
})

function bridge(seed = '18446744073709551615'): EngineBoundary {
  const engine = new WasmEngine(seed)
  return {
    apply: (command) => JSON.parse(engine.apply(JSON.stringify(command))) as EngineResult,
    view: () => JSON.parse(engine.view()) as GameView,
    save: () => engine.save(),
    load: (raw) => JSON.parse(engine.load(raw)) as GameView,
    beginActivity: (request) =>
      JSON.parse(engine.begin_activity(JSON.stringify(request))) as EngineResult,
    recordActivity: (request) =>
      JSON.parse(engine.record_activity(JSON.stringify(request))) as EngineResult,
    finishActivity: (request) =>
      JSON.parse(engine.finish_activity(JSON.stringify(request))) as EngineResult,
  }
}

beforeAll(() => {
  vi.spyOn(TrailEngine, 'create').mockImplementation(async (seed) => bridge(seed) as TrailEngine)
})
afterAll(() => vi.restoreAllMocks())

function configured(seed?: string): Campaign {
  const campaign = new Campaign(bridge(seed))
  campaign.command({
    Configure: {
      trail_id: 'oregon',
      era_id: '1848',
      occupation_id: 'banker',
      party: ['Ada', 'James', 'Ruth', 'Thomas', 'Clara'],
      departure_month: 3,
    },
  })
  for (const [item, quantity] of [
    ['oxen', 3],
    ['food', 1500],
    ['clothing', 5],
    ['medicine', 3],
    ['ammunition', 10],
  ] as const) {
    campaign.command({ Buy: { item_id: item, quantity } })
  }
  campaign.command('Depart')
  return campaign
}

const spatial = (): SpatialState => ({
  regionId: 'independence:kansas_river',
  terrain: 'RiverValley',
  regionIndex: 0,
  wagon: { x: 0, z: 0, yaw: 0, speed: 0 },
  player: { x: 0, z: 0, yaw: 0, pitch: 0 },
  mode: 'riding',
  frontierZ: 0,
  travelRemainder: 0,
  activity: null,
})

function storage(): Storage {
  const values = new Map<string, string>()
  return {
    get length() {
      return values.size
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => {
      values.delete(key)
    },
    setItem: (key, value) => {
      values.set(key, value)
    },
  }
}

function record(campaign: Campaign, event: ActivityEvent): void {
  const activity = campaign.view().activity!
  campaign.recordActivity({ id: activity.id, sequence: activity.sequence + 1, event })
}

describe('real WebAssembly spatial campaign', () => {
  it('rejects every legacy minigame endpoint while a restored spatial activity is active', () => {
    const campaign = configured()
    campaign.beginActivity({ kind: 'hunt' })
    const rawEngine = new WasmEngine('1')
    rawEngine.load(campaign.save())
    const before = rawEngine.save()
    for (const call of [
      () => rawEngine.minigame_snapshot(),
      () => rawEngine.minigame_tick(900),
      () => rawEngine.minigame_action('{"kind":"finish"}'),
      () => rawEngine.finish_minigame(),
    ]) {
      expect(call).toThrow('spatial activity')
      expect(rawEngine.save()).toBe(before)
    }
    const legacy = configured('41')
    legacy.command('BeginHunt')
    rawEngine.load(legacy.save())
    expect(() => rawEngine.minigame_snapshot()).not.toThrow()
    expect(JSON.parse(rawEngine.finish_minigame()).view.day).toBe(1)
  })

  it('reserves a shot, requires carcass collection, persists mid-hunt, and commits exactly once', async () => {
    const campaign = configured()
    const disk = storage()
    const position = spatial()
    campaign.setAutosave(() => storeWorld(makeWorldSave(campaign, position), disk))
    campaign.beginActivity({ kind: 'hunt' })
    const id = campaign.view().activity!.id
    record(campaign, { kind: 'shot', targetId: 'deer-1', animal: 'Deer' })
    expect(campaign.view().ammunition_available).toBe(199)
    expect(campaign.view().activity!.food_lbs).toBe(0)
    const saved = disk.getItem(WORLD_SAVE_KEY)!
    expect(parseWorld(saved).campaign).toContain('18446744073709551615')
    const resumed = await importWorld(saved)
    expect(resumed.campaign.save()).toBe(campaign.save())
    expect(resumed.campaign.view().activity!.pending_kills).toEqual({ 'deer-1': 'Deer' })
    record(resumed.campaign, { kind: 'collect', targetId: 'deer-1' })
    expect(resumed.campaign.view().activity!.food_lbs).toBe(55)
    const beforeDuplicate = resumed.campaign.save()
    expect(() => record(resumed.campaign, { kind: 'collect', targetId: 'deer-1' })).toThrow()
    expect(resumed.campaign.save()).toBe(beforeDuplicate)
    resumed.campaign.finishActivity(id)
    expect(resumed.campaign.view().day).toBe(1)
    const finished = resumed.campaign.save()
    resumed.campaign.finishActivity(id)
    expect(resumed.campaign.save()).toBe(finished)
  })

  it('rolls back the observed shot if durable autosave fails', () => {
    const campaign = configured('41')
    campaign.beginActivity({ kind: 'hunt' })
    const before = campaign.save()
    campaign.setAutosave(() => {
      throw new Error('QuotaExceededError')
    })
    expect(() =>
      record(campaign, { kind: 'shot', targetId: 'rabbit-1', animal: 'Rabbit' }),
    ).toThrow('QuotaExceededError')
    expect(campaign.save()).toBe(before)
    expect(campaign.view().ammunition_available).toBe(200)
  })

  it('locks management while a durable activity is active without charging a second day', () => {
    const campaign = configured('41')
    campaign.beginActivity({ kind: 'hunt' })
    const before = campaign.save()
    const result = campaign.command({ Rest: { days: 1 } })
    expect(result.outcomes).toContainEqual({ Rejected: 'InvalidPhase' })
    expect(campaign.save()).toBe(before)
    expect(campaign.travelMeters(5)).toBeNull()
    expect(campaign.view().day).toBe(0)
  })

  it('advances equal campaign state at 30, 60, and 144 render samples with pause gaps', () => {
    const runs = [30, 60, 144].map((fps) => {
      const campaign = configured('41')
      const miles = campaign.view().next_travel_miles!
      const total = miles * 2
      for (let frame = 0; frame < fps * 3; frame += 1) {
        if (frame % 7 === 0) campaign.travelMeters(0)
        campaign.travelMeters(total / (fps * 3))
      }
      expect(campaign.view().day).toBe(1)
      expect(campaign.view().miles).toBe(miles)
      expect(campaign.travelRemainder).toBeCloseTo(0, 7)
      return campaign.save()
    })
    expect(new Set(runs).size).toBe(1)
  })

  it('rejects invalid distance and does not advance stationary time', () => {
    const campaign = configured('41')
    const before = campaign.save()
    for (const invalid of [NaN, Infinity, -1, 11])
      expect(() => campaign.travelMeters(invalid)).toThrow()
    for (let frame = 0; frame < 600; frame += 1) campaign.travelMeters(0)
    expect(campaign.save()).toBe(before)
  })

  it('retains a valid partial travel checkpoint when the day autosave fails', () => {
    const campaign = configured('41')
    campaign.travelRemainder = campaign.view().next_travel_miles! * 2 - 1
    const before = campaign.save()
    const remainder = campaign.travelRemainder
    campaign.setAutosave(() => {
      throw new Error('QuotaExceededError')
    })
    expect(() => campaign.travelMeters(2)).toThrow('QuotaExceededError')
    expect(campaign.save()).toBe(before)
    expect(campaign.travelRemainder).toBe(remainder)
    expect(() => makeWorldSave(campaign, spatial())).not.toThrow()
  })

  it('imports into a fresh campaign and preserves the current one on invalid state', async () => {
    const campaign = configured()
    const before = campaign.save()
    const world = makeWorldSave(campaign, spatial())
    const badWorld = { ...world, campaign: '{bad' }
    await expect(importWorld(JSON.stringify(badWorld))).rejects.toBeDefined()
    expect(campaign.save()).toBe(before)
    const valid = await importWorld(serializeWorld(world))
    expect(valid.campaign.save()).toBe(before)
    expect(valid.spatial).toEqual(world.spatial)
    expect(valid.campaign).not.toBe(campaign)
  })
})

describe('versioned opaque world files', () => {
  it('preserves a rejected inner campaign version independently of two later autosaves', async () => {
    const campaign = configured()
    const disk = storage()
    const recovery = serializeWorld(makeWorldSave(campaign, spatial()))
    const unsupported = makeWorldSave(campaign, spatial())
    unsupported.campaign = unsupported.campaign.replace('"version":2', '"version":99')
    const original = ` \n${JSON.stringify(unsupported, null, 2)}\n `
    disk.setItem(WORLD_SAVE_KEY, original)
    disk.setItem(WORLD_BACKUP_KEY, recovery)
    expect(readWorld(disk).kind).toBe('world')
    await expect(importWorld(original)).rejects.toBeDefined()
    const preserved = preserveWorldRaw(disk)!
    expect(preserved.raw).toBe(original)
    expect(disk.getItem(WORLD_SAVE_KEY)).toBe(original)
    expect(disk.getItem(WORLD_BACKUP_KEY)).toBe(recovery)

    const restored = await importWorld(recovery)
    storeWorld(makeWorldSave(restored.campaign, restored.spatial), disk)
    restored.campaign.command({ SetPace: 'Grueling' })
    storeWorld(makeWorldSave(restored.campaign, restored.spatial), disk)
    expect(disk.getItem(preserved.key)).toBe(original)
    expect(disk.getItem(WORLD_SAVE_KEY)).not.toBe(original)
    expect(disk.getItem(WORLD_BACKUP_KEY)).not.toBe(original)
    expect((await importWorld(disk.getItem(WORLD_BACKUP_KEY)!)).campaign.view().seed).toBe(
      '18446744073709551615',
    )
  })

  it('archives a supported current journey before deliberate replacement', async () => {
    const originalCampaign = configured()
    const disk = storage()
    const original = `\n${serializeWorld(makeWorldSave(originalCampaign, spatial()))}\n`
    disk.setItem(WORLD_SAVE_KEY, original)
    const preserved = preserveWorldRaw(disk)!
    const replacement = configured('3')
    storeWorld(makeWorldSave(replacement, spatial()), disk)
    replacement.command({ SetPace: 'Grueling' })
    storeWorld(makeWorldSave(replacement, spatial()), disk)
    expect(disk.getItem(preserved.key)).toBe(original)
    const recovered = await importWorld(preserved.raw)
    expect(recovered.campaign.save()).toBe(originalCampaign.save())
    expect(recovered.campaign.view().seed).toBe('18446744073709551615')
  })

  it('reuses an exact archive instead of duplicating it on repeated recovery attempts', () => {
    const disk = storage()
    disk.setItem(WORLD_SAVE_KEY, '{future-format bytes}')
    const first = preserveWorldRaw(disk)
    expect(preserveWorldRaw(disk)).toEqual(first)
    const keys = Array.from({ length: disk.length }, (_, index) => disk.key(index)!)
    expect(keys.filter((key) => key.startsWith(PRESERVED_WORLD_PREFIX))).toHaveLength(1)
    disk.setItem(WORLD_SAVE_KEY, '{different future-format bytes}')
    expect(preserveWorldRaw(disk)?.key).not.toBe(first?.key)
    expect(disk.getItem(first!.key)).toBe('{future-format bytes}')
  })

  it('fails archival without touching the active file or recovery copy', () => {
    const disk = storage()
    disk.setItem(WORLD_SAVE_KEY, 'original bytes')
    disk.setItem(WORLD_BACKUP_KEY, 'recovery bytes')
    const setItem = disk.setItem
    disk.setItem = (key, value) => {
      if (key.startsWith(PRESERVED_WORLD_PREFIX)) throw new Error('QuotaExceededError')
      setItem(key, value)
    }
    expect(() => preserveWorldRaw(disk)).toThrow('QuotaExceededError')
    expect(disk.getItem(WORLD_SAVE_KEY)).toBe('original bytes')
    expect(disk.getItem(WORLD_BACKUP_KEY)).toBe('recovery bytes')
    expect(disk.length).toBe(2)
  })

  it('distinguishes an absent save from an empty corrupted file without parsing either', () => {
    const disk = storage()
    expect(preserveWorldRaw(disk)).toBeNull()
    disk.setItem(WORLD_SAVE_KEY, '')
    const preserved = preserveWorldRaw(disk)!
    expect(preserved.raw).toBe('')
    expect(disk.getItem(preserved.key)).toBe('')
  })

  it('preserves raw large RNG integers and complete spatial progress byte-for-byte', () => {
    const campaign = configured()
    campaign.travelRemainder = 13.125
    const position = spatial()
    position.wagon = { x: 4, z: -25, yaw: 1.25, speed: 3.1 }
    position.player.pitch = 0.4
    const file = makeWorldSave(campaign, position)
    const disk = storage()
    storeWorld(file, disk)
    const loaded = readWorld(disk)
    expect(loaded).toEqual({ kind: 'world', save: file })
    expect(parseWorld(serializeWorld(file)).campaign).toBe(campaign.save())
    expect(file.spatial.travelRemainder).toBe(13.125)
  })

  it('retains the last valid world if storage rejects the primary write', () => {
    const campaign = configured()
    const disk = storage()
    storeWorld(makeWorldSave(campaign, spatial()), disk)
    const previous = disk.getItem(WORLD_SAVE_KEY)
    const originalSet = disk.setItem
    disk.setItem = (key, value) => {
      if (key === WORLD_SAVE_KEY) throw new Error('QuotaExceededError')
      originalSet(key, value)
    }
    campaign.command({ SetPace: 'Grueling' })
    expect(() => storeWorld(makeWorldSave(campaign, spatial()), disk)).toThrow('QuotaExceededError')
    expect(disk.getItem(WORLD_SAVE_KEY)).toBe(previous)
    expect(disk.getItem(WORLD_BACKUP_KEY)).toBe(previous)
  })

  it('offers invalid primary bytes and a valid recovery copy without silently replacing either', () => {
    const campaign = configured()
    const disk = storage()
    const previous = serializeWorld(makeWorldSave(campaign, spatial()))
    disk.setItem(WORLD_BACKUP_KEY, previous)
    disk.setItem(WORLD_SAVE_KEY, '{broken')
    const result = readWorld(disk)
    expect(result.kind).toBe('invalid')
    if (result.kind === 'invalid') {
      expect(result.raw).toBe('{broken')
      expect(result.backup?.campaign).toBe(campaign.save())
    }
    expect(disk.getItem(WORLD_SAVE_KEY)).toBe('{broken')
    expect(disk.getItem(WORLD_BACKUP_KEY)).toBe(previous)
  })

  it('preserves an incompatible save in its own archive before replacing the active slot', () => {
    const campaign = configured()
    const disk = storage()
    const incompatible = '{"version":99,"valuable":"original bytes"}'
    disk.setItem(WORLD_SAVE_KEY, incompatible)
    storeWorld(makeWorldSave(campaign, spatial()), disk)
    const archive = Array.from({ length: disk.length }, (_, index) => disk.key(index)!).find(
      (key) => key.startsWith('pioneer-trail:preserved:'),
    )!
    expect(disk.getItem(archive)).toBe(incompatible)
    campaign.command({ SetPace: 'Grueling' })
    storeWorld(makeWorldSave(campaign, spatial()), disk)
    expect(disk.getItem(archive)).toBe(incompatible)
  })

  it('detects legacy saves without parsing or overwriting them, then migrates only when called', async () => {
    const campaign = configured()
    // Extract the original GameState in Rust-generated text without parsing any RNG number in JS.
    const current = campaign.save()
    const start = current.indexOf('"game":') + 7
    const end = current.indexOf(',"activity":', start)
    const legacy = current.slice(start, end)
    const disk = storage()
    disk.setItem(LEGACY_SAVE_KEY, legacy)
    expect(readWorld(disk)).toEqual({ kind: 'legacy', raw: legacy })
    expect(disk.getItem(WORLD_SAVE_KEY)).toBeNull()
    const migrated = await migrateLegacy(legacy, spatial())
    expect(migrated.campaign.view().seed).toBe('18446744073709551615')
    expect(migrated.campaign.view().miles).toBe(campaign.view().miles)
    expect(disk.getItem(LEGACY_SAVE_KEY)).toBe(legacy)
  })

  it('adopts a legacy unfinished hunt without changing its seed or charging another day', async () => {
    const campaign = configured()
    campaign.command('BeginHunt')
    const seed = campaign.view().active_minigame!.seed
    const current = campaign.save()
    const start = current.indexOf('"game":') + 7
    const legacy = current.slice(start, current.indexOf(',"activity":', start))
    const migrated = await migrateLegacy(legacy, spatial())
    expect(migrated.campaign.view().activity?.seed).toBe(seed)
    expect(migrated.campaign.view().activity?.kind).toBe('hunt')
    expect(migrated.campaign.view().day).toBe(0)
    expect(migrated.campaign.view().ammunition_available).toBe(200)
    expect(migrated.spatial.activity?.id).toBe(migrated.campaign.view().activity?.id)
    expect(migrated.spatial.terrain).toBe(migrated.campaign.view().terrain)
  })

  it.each([
    (s: SpatialState) => {
      s.player.pitch = Infinity
    },
    (s: SpatialState) => {
      s.wagon.x = NaN
    },
    (s: SpatialState) => {
      s.regionIndex = -1
    },
    (s: SpatialState) => {
      s.travelRemainder = 61
    },
    (s: SpatialState) => {
      s.activity = { id: 'a', kind: 'fish', elapsed: -1, phase: 'bite', data: {} }
    },
  ])('rejects invalid spatial state before importing the campaign', (mutate) => {
    const save = makeWorldSave(configured(), spatial())
    mutate(save.spatial)
    expect(() => parseWorld(JSON.stringify(save))).toThrow()
  })

  it('rejects a world checkpoint paired with a different committed activity', async () => {
    const campaign = configured()
    campaign.beginActivity({ kind: 'hunt' })
    const save = makeWorldSave(campaign, spatial())
    save.spatial.activity!.id = 'activity-999'
    await expect(importWorld(JSON.stringify(save))).rejects.toThrow('another activity')
  })
})
