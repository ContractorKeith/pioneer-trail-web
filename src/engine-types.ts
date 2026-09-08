/** Rust-owned deterministic simulation boundary. All enum spelling mirrors serde JSON. */
export type GameCommand =
  | 'Depart'
  | 'Continue'
  | 'TravelDay'
  | 'Forage'
  | 'Fish'
  | 'Repair'
  | 'Talk'
  | 'BeginHunt'
  | 'DeliverLetter'
  | { SetDifficulty: 'Easy' | 'Normal' | 'Hard' }
  | {
      Configure: {
        trail_id: string
        era_id: string
        occupation_id: string
        party: string[]
        departure_month: number
      }
    }
  | { Buy: { item_id: string; quantity: number } }
  | { Sell: { item_id: string; quantity: number } }
  | { SetPace: 'Steady' | 'Strenuous' | 'Grueling' }
  | { SetRations: 'Filling' | 'Meager' | 'BareBones' }
  | { Rest: { days: number } }
  | { Gather: { activity: 'Forage' | 'Fish'; days: number } }
  | { ChooseRoute: { route_id: string } }
  | { CrossRiver: { method: 'Ford' | 'Caulk' | 'Ferry' | 'Wait' | 'Guide' } }
  | { Respond: { event_id: string; choice_id: string } }
  | { Treat: { member_index: number; ailment_id: string } }
  | { Converse: { speaker_id: string; topic: 'Route' | 'Supplies' | 'News' } }
  | { AcceptLetter: { letter_id: string } }
  | { DeclineLetter: { letter_id: string } }
  | { HuntResult: { food_lbs: number; shots: number } }
  | { RaftResult: { cargo_lost_lbs: number; casualties: number; completed: boolean } }
  | {
      Barter: {
        npc_id: string
        offered_item: string
        offered_quantity: number
        wanted_item: string
        wanted_quantity: number
      }
    }
  | {
      AcceptCounteroffer: {
        npc_id: string
        offered_item: string
        offered_quantity: number
        wanted_item: string
        wanted_quantity: number
      }
    }
  | { InviteNpc: { npc_id: string } }
  | { DismissNpc: { npc_id: string } }

export interface GameView {
  seed: string
  status: string | Record<string, string>
  day: number
  date: { year: number; month: number; day: number }
  trail_id: string | null
  era_id: string | null
  occupation_id: string | null
  difficulty: 'Easy' | 'Normal' | 'Hard'
  content: GameContent
  miles: number
  weather: string
  terrain: string
  pace: string
  rations: string
  cash_cents: number
  weight_lbs: number
  daily_food_lbs: number
  score: number
  party: PartyMember[]
  inventory: Record<string, number>
  current_node: Landmark | null
  target_node_id: string | null
  route_miles_remaining: number
  routes: Route[]
  river: RiverView | null
  can_shop: boolean
  can_repair: boolean
  items: StoreItem[]
  speakers: Speaker[]
  offered_letter: Letter | null
  active_letter: unknown | null
  can_deliver_letter: boolean
  pending_event: PendingEvent | null
  pending_counteroffer: Counteroffer | null
  npcs: unknown[]
  active_minigame: { kind: 'Hunt' | 'Raft'; seed: string; ammo_available: number } | null
  journal: JournalEntry[]
  visited_landmarks: unknown[]
  has_fresh_food: boolean
  available_party_slots: number
  can_camp: boolean
  can_hunt: boolean
  can_fish: boolean
}
export interface EngineResult {
  outcomes: Outcome[]
  view: GameView
}
export type Outcome = string | { [kind: string]: unknown }
export interface PartyMember {
  name: string
  alive: boolean
  health: number
  morale: number
  ailments: string[]
  [key: string]: unknown
}
export interface Landmark {
  id: string
  name: string
  mile: number
  kind: string
  store: boolean
  [key: string]: unknown
}
export interface Route {
  available?: boolean
  id: string
  label: string
  target_id: string
  distance_miles: number
}
export interface RiverView {
  width_feet: number
  depth_feet: number | null
  ferry_cost_cents: number | null
  guide_cost_clothing: number
  risks: Record<string, number | null>
}
export interface StoreItem {
  id: string
  name: string
  unit: string
  quantity: number
  price_cents: number | null
  sell_price_cents: number | null
  weight_lbs: number
  limit: number
}
export interface Speaker {
  id: string
  name: string
  setting: 'Fort' | 'Wagon'
  topics: Array<'Route' | 'Supplies' | 'News'>
}
export interface Letter {
  id: string
  origin_id: string
  destination_id: string
  recipient: string
  text: string
  reward_cents: number
  [key: string]: unknown
}
export interface PendingEvent {
  id: string
  text: string
  choices: Array<{ id: string; label: string; available: boolean }>
}
export interface Counteroffer {
  npc_id: string
  offered_item: string
  offered_quantity: number
  wanted_item: string
  wanted_quantity: number
  offered_value_cents: number
  wanted_value_cents: number
  quoted_day: number
}
export interface JournalEntry {
  day: number
  miles: number
  kind: unknown
  text: string
}
export interface GameContent {
  eras: Array<{ id: string; name: string; year: number }>
  trails: Array<{
    id: string
    name: string
    start_node_id: string
    goal_node_id: string
    nodes: Landmark[]
  }>
  occupations: Array<{
    id: string
    name: string
    starting_cash_cents: number
    score_multiplier: number
    perk: string
  }>
  items: StoreItem[]
  ailments: Array<{
    id: string
    name: string
    severity: number
    daily_damage: number
    mortality_per_mille: number
  }>
  [key: string]: unknown
}
