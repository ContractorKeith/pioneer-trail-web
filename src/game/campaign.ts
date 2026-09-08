import { TrailEngine } from '../engine'
import type { EngineResult, GameCommand, GameView } from '../engine-types'

export type ActivityKind = 'hunt' | 'fish' | 'crossing'
export type CrossingMethod = 'Ford' | 'Caulk' | 'Guide' | 'Raft'
export type Animal = 'Buffalo' | 'Deer' | 'Bear' | 'Rabbit' | 'Squirrel'
export type ActivityRequest =
  { kind: 'hunt' | 'fish' } | { kind: 'crossing'; method: CrossingMethod }
export type ActivityEvent =
  | { kind: 'shot'; targetId: string | null; animal: Animal | null }
  | { kind: 'collect'; targetId: string }
  | { kind: 'catch'; fishId: string; foodLbs: number }
  | { kind: 'collision'; obstacleId: string }
export interface ActivityRecord {
  id: string
  sequence: number
  event: ActivityEvent
}
export interface ActivitySnapshot {
  id: string
  kind: ActivityKind
  method: CrossingMethod | null
  seed: string
  sequence: number
  shots: number
  ammo_limit: number
  food_lbs: number
  food_limit: number
  cargo_lost_lbs: number
  collision_loss_lbs: number
  started_day: number
  day_cost: number
  targets: string[]
  pending_kills: Record<string, Animal>
  collected_kills: Record<string, Animal>
  obstacles: string[]
}
export interface CampaignView extends GameView {
  activity: ActivitySnapshot | null
  next_travel_miles: number | null
  ammunition_available: number
  capacity_lbs: number
}
export interface CampaignResult extends EngineResult {
  view: CampaignView
}
export interface EngineBoundary {
  view(): GameView
  apply(command: GameCommand): EngineResult
  save(): string
  load(raw: string): GameView
  beginActivity(request: unknown): EngineResult
  recordActivity(record: unknown): EngineResult
  finishActivity(request: unknown): EngineResult
}

/** Two navigable world metres represent one campaign mile. Only new forward frontier counts. */
export const METERS_PER_CAMPAIGN_MILE = 2

export class Campaign {
  private readonly engine: EngineBoundary
  private current: CampaignView
  private remainder = 0
  private autosave: (() => void) | null = null

  constructor(engine: EngineBoundary) {
    this.engine = engine
    this.current = engine.view() as CampaignView
  }

  static async create(seed?: string): Promise<Campaign> {
    return new Campaign(await TrailEngine.create(seed))
  }

  static async fromSave(raw: string): Promise<Campaign> {
    const campaign = await Campaign.create('1')
    campaign.load(raw)
    return campaign
  }

  view(): CampaignView {
    return this.current
  }
  save(): string {
    return this.engine.save()
  }

  /** Configure a synchronous atomic browser writer before accepting gameplay input. */
  setAutosave(writer: (() => void) | null): void {
    this.autosave = writer
  }

  get travelRemainder(): number {
    return this.remainder
  }
  set travelRemainder(value: number) {
    if (!Number.isFinite(value) || value < 0 || value > 60)
      throw new Error('Invalid travel remainder.')
    this.remainder = value
  }

  load(raw: string): CampaignView {
    this.current = this.engine.load(raw) as CampaignView
    this.remainder = 0
    return this.current
  }

  command(command: GameCommand): CampaignResult {
    return this.mutate(() => this.engine.apply(command))
  }

  beginActivity(request: ActivityRequest): CampaignResult {
    return this.mutate(() => this.engine.beginActivity(request))
  }

  recordActivity(record: ActivityRecord): CampaignResult {
    return this.mutate(() => this.engine.recordActivity(record))
  }

  finishActivity(id: string, completed = true): CampaignResult {
    return this.mutate(() => this.engine.finishActivity({ id, completed }))
  }

  /** Call from the fixed step with newly reached forward distance, never wheel spin or walking. */
  travelMeters(forwardMeters: number): CampaignResult | null {
    if (!Number.isFinite(forwardMeters) || forwardMeters < 0 || forwardMeters > 10) {
      throw new Error('Travel samples must be finite forward distances of at most 10 metres.')
    }
    if (this.current.status !== 'Travelling' || this.current.pending_event || this.current.activity)
      return null
    if (forwardMeters === 0) return null
    const beforeSample = this.remainder
    this.remainder += forwardMeters
    const outcomes: CampaignResult['outcomes'] = []
    let committed = false
    while (
      this.current.status === 'Travelling' &&
      !this.current.pending_event &&
      !this.current.activity
    ) {
      const forecast = this.current.next_travel_miles
      if (forecast === null) break
      const threshold = Math.max(1, forecast) * METERS_PER_CAMPAIGN_MILE
      if (this.remainder + 1e-8 < threshold) break
      let result: CampaignResult
      try {
        result = this.mutate(() => {
          this.remainder = Math.max(0, this.remainder - threshold)
          const result = this.engine.apply('TravelDay')
          if (result.view.status !== 'Travelling' || result.view.pending_event) this.remainder = 0
          return result
        })
      } catch (error) {
        if (!committed) this.remainder = beforeSample
        throw error
      }
      outcomes.push(...result.outcomes)
      committed = true
      if (result.outcomes.some((outcome) => typeof outcome === 'object' && 'Rejected' in outcome))
        break
    }
    return committed ? { outcomes, view: this.current } : null
  }

  private mutate(action: () => EngineResult): CampaignResult {
    const before = this.engine.save()
    const remainder = this.remainder
    try {
      const result = action() as CampaignResult
      this.current = result.view
      if (
        !result.outcomes.some((outcome) => typeof outcome === 'object' && 'Rejected' in outcome)
      ) {
        this.autosave?.()
      }
      return result
    } catch (error) {
      this.current = this.engine.load(before) as CampaignView
      this.remainder = remainder
      throw error
    }
  }
}
