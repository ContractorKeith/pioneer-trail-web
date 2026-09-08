import { Campaign, type ActivityKind } from './campaign'

export const WORLD_SAVE_KEY = 'pioneer-trail:world:v2'
export const WORLD_BACKUP_KEY = 'pioneer-trail:world:backup:v2'
export const LEGACY_SAVE_KEY = 'pioneer-trail:journey:v1'
export const PRESERVED_WORLD_PREFIX = 'pioneer-trail:preserved:'
const MAX_SAVE_LENGTH = 6 * 1024 * 1024

export interface SpatialState {
  regionId: string
  terrain: string
  regionIndex: number
  wagon: { x: number; z: number; yaw: number; speed: number }
  player: { x: number; z: number; yaw: number; pitch: number }
  mode: 'riding' | 'walking'
  frontierZ: number
  travelRemainder: number
  activity: null | {
    id: string
    kind: ActivityKind
    elapsed: number
    phase: string
    data: Record<string, number | string | boolean>
  }
}

export interface WorldSave {
  version: 2
  campaign: string
  spatial: SpatialState
  savedAt: string
}

export type SaveReadResult =
  | { kind: 'world'; save: WorldSave }
  | { kind: 'legacy'; raw: string }
  | { kind: 'invalid'; raw: string; message: string; backup?: WorldSave }
  | { kind: 'empty' }

const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const text = (value: unknown, max = 128): value is string =>
  typeof value === 'string' &&
  value.length > 0 &&
  value.length <= max &&
  ![...value].some((char) => char.charCodeAt(0) < 32)
const finite = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max

export function validateSpatial(value: unknown): asserts value is SpatialState {
  if (
    !object(value) ||
    !text(value.regionId) ||
    !text(value.terrain) ||
    !finite(value.regionIndex, 0, 10000) ||
    !Number.isInteger(value.regionIndex) ||
    !finite(value.frontierZ, -1_000_000, 1_000_000) ||
    !finite(value.travelRemainder, 0, 60) ||
    !['riding', 'walking'].includes(String(value.mode))
  )
    throw new Error('Invalid saved world location.')
  for (const name of ['wagon', 'player']) {
    const body = value[name]
    if (
      !object(body) ||
      !finite(body.x, -10000, 10000) ||
      !finite(body.z, -1_000_000, 1_000_000) ||
      !finite(body.yaw, -1_000_000, 1_000_000)
    )
      throw new Error(`Invalid saved ${name} location.`)
    if (name === 'wagon' && !finite(body.speed, -30, 30))
      throw new Error('Invalid saved wagon speed.')
    if (name === 'player' && !finite(body.pitch, -Math.PI / 2, Math.PI / 2))
      throw new Error('Invalid saved view angle.')
  }
  const activity = value.activity
  if (activity !== null) {
    if (
      !object(activity) ||
      !text(activity.id) ||
      !['hunt', 'fish', 'crossing'].includes(String(activity.kind)) ||
      !finite(activity.elapsed, 0, 86400) ||
      !text(activity.phase) ||
      !object(activity.data) ||
      Object.keys(activity.data).length > 128
    )
      throw new Error('Invalid activity recovery state.')
    for (const [key, entry] of Object.entries(activity.data)) {
      if (
        !text(key) ||
        !(
          typeof entry === 'boolean' ||
          entry === '' ||
          text(entry, 1024) ||
          finite(entry, -1e9, 1e9)
        )
      ) {
        throw new Error('Invalid activity recovery data.')
      }
    }
  }
}

/** Parse only the envelope. Campaign bytes, including every u64, remain opaque to JavaScript. */
export function parseWorld(raw: string): WorldSave {
  if (raw.length > MAX_SAVE_LENGTH) throw new Error('Save exceeds the supported 6 MB limit.')
  const value: unknown = JSON.parse(raw)
  if (
    !object(value) ||
    value.version !== 2 ||
    typeof value.campaign !== 'string' ||
    !value.campaign.length
  ) {
    throw new Error(
      'Unsupported save version. Preserve or export this file before starting another journey.',
    )
  }
  if (!text(value.savedAt, 64) || !Number.isFinite(Date.parse(value.savedAt)))
    throw new Error('Invalid save timestamp.')
  validateSpatial(value.spatial)
  return value as unknown as WorldSave
}

export function makeWorldSave(campaign: Campaign, spatial: SpatialState): WorldSave {
  const save: WorldSave = {
    version: 2,
    campaign: campaign.save(),
    spatial: structuredClone(spatial),
    savedAt: new Date().toISOString(),
  }
  save.spatial.travelRemainder = campaign.travelRemainder
  const activity = campaign.view().activity
  if (!activity) save.spatial.activity = null
  else if (save.spatial.activity?.id !== activity.id) {
    save.spatial.activity = {
      id: activity.id,
      kind: activity.kind,
      elapsed: 0,
      phase: 'active',
      data: {},
    }
  }
  validateSpatial(save.spatial)
  return save
}

export function serializeWorld(save: WorldSave): string {
  const raw = JSON.stringify(save)
  parseWorld(raw)
  return raw
}

/** Archive the active file before explicit replacement or after failed Rust validation. */
export function preserveWorldRaw(
  storage: Storage = localStorage,
): { key: string; raw: string } | null {
  const raw = storage.getItem(WORLD_SAVE_KEY)
  if (raw === null) return null
  // Preserve the original bytes even if either envelope or campaign is unsupported.
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index)
    if (key?.startsWith(PRESERVED_WORLD_PREFIX) && storage.getItem(key) === raw) {
      return { key, raw }
    }
  }
  let suffix = Date.now()
  while (storage.getItem(`${PRESERVED_WORLD_PREFIX}${suffix}`) !== null) suffix += 1
  const key = `${PRESERVED_WORLD_PREFIX}${suffix}`
  storage.setItem(key, raw)
  if (storage.getItem(key) !== raw) throw new Error('The existing journey could not be preserved.')
  return { key, raw }
}

/** localStorage replaces one value atomically. Keep the previous raw file before that write. */
export function storeWorld(save: WorldSave, storage: Storage = localStorage): void {
  const raw = serializeWorld(save)
  const previous = storage.getItem(WORLD_SAVE_KEY)
  if (previous !== null && previous !== raw) {
    try {
      parseWorld(previous)
    } catch {
      preserveWorldRaw(storage)
    }
    storage.setItem(WORLD_BACKUP_KEY, previous)
  }
  storage.setItem(WORLD_SAVE_KEY, raw)
}

export function readWorld(storage: Storage = localStorage): SaveReadResult {
  const raw = storage.getItem(WORLD_SAVE_KEY)
  if (raw !== null) {
    try {
      return { kind: 'world', save: parseWorld(raw) }
    } catch (error) {
      let backup: WorldSave | undefined
      try {
        const old = storage.getItem(WORLD_BACKUP_KEY)
        if (old) backup = parseWorld(old)
      } catch {
        /* Keep both raw copies for export. */
      }
      return {
        kind: 'invalid',
        raw,
        message: error instanceof Error ? error.message : 'Invalid save.',
        backup,
      }
    }
  }
  const legacy = storage.getItem(LEGACY_SAVE_KEY)
  return legacy === null ? { kind: 'empty' } : { kind: 'legacy', raw: legacy }
}

function reconcileActivity(campaign: Campaign, spatial: SpatialState): void {
  const committed = campaign.view().activity
  if (committed === null && spatial.activity !== null) {
    throw new Error('World activity disagrees with the committed campaign. Use the recovery copy.')
  }
  if (
    committed &&
    (spatial.activity?.id !== committed.id || spatial.activity.kind !== committed.kind)
  ) {
    throw new Error('Activity recovery checkpoint is missing or belongs to another activity.')
  }
}

export async function importWorld(
  raw: string,
): Promise<{ campaign: Campaign; spatial: SpatialState }> {
  const save = parseWorld(raw)
  const campaign = await Campaign.fromSave(save.campaign)
  const spatial = structuredClone(save.spatial)
  reconcileActivity(campaign, spatial)
  campaign.travelRemainder = spatial.travelRemainder
  return { campaign, spatial }
}

/** Call only after the player chooses migration. The old storage key and exported bytes remain. */
export async function migrateLegacy(
  raw: string,
  initialSpatial: SpatialState,
): Promise<{ campaign: Campaign; spatial: SpatialState }> {
  const campaign = await Campaign.fromSave(raw)
  const spatial = structuredClone(initialSpatial)
  validateSpatial(spatial)
  const view = campaign.view()
  spatial.regionId = view.current_node?.id ?? view.target_node_id ?? spatial.regionId
  spatial.terrain = view.terrain
  if (view.active_minigame?.kind === 'Hunt') campaign.beginActivity({ kind: 'hunt' })
  else if (view.active_minigame?.kind === 'Raft') {
    campaign.beginActivity({ kind: 'crossing', method: 'Raft' })
  }
  campaign.travelRemainder = 0
  spatial.travelRemainder = 0
  const activity = campaign.view().activity
  spatial.activity = activity
    ? { id: activity.id, kind: activity.kind, elapsed: 0, phase: 'active', data: {} }
    : null
  return { campaign, spatial }
}
