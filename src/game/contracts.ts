import type { CampaignView } from './campaign'

export type Quality = 'low' | 'balanced' | 'high'
export interface GameSettings {
  sensitivity: number
  fov: number
  volume: number
  muted: boolean
  quality: Quality
  reducedMotion: boolean
  lookMode: 'drag' | 'pointer'
}
export const DEFAULT_SETTINGS: GameSettings = {
  sensitivity: 1,
  fov: 72,
  volume: 0.45,
  muted: true,
  quality: 'balanced',
  reducedMotion: false,
  lookMode: 'drag',
}
export type Overlay =
  | 'pause'
  | 'map'
  | 'journal'
  | 'inventory'
  | 'party'
  | 'settings'
  | 'camp'
  | 'trader'
  | 'dialogue'
  | 'river'
  | 'encounter'
  | 'route'
  | 'ending'
  | null
export interface RuntimeSnapshot {
  mode: 'riding' | 'walking'
  paused: boolean
  sceneWeather: 'clear' | 'rain' | 'snow' | 'fog'
  speed: number
  heading: number
  position: { x: number; y: number; z: number }
  wagon: { x: number; y: number; z: number; yaw: number }
  regionId: string
  regionIndex: number
  interaction: { kind: string; label: string; distance: number } | null
  activity: {
    kind: string
    phase: string
    hint: string
    progress: number
    shots?: number
    tension?: number
  } | null
  fps: number
  frameMs: number
  drawCalls: number
  triangles: number
  geometries: number
  textures: number
  collisionCount: number
  view: CampaignView
}
export interface RuntimeCallbacks {
  onSnapshot: (snapshot: RuntimeSnapshot) => void
  onOpen: (overlay: Overlay) => void
  onNotice: (message: string) => void
  onError: (message: string) => void
}
export interface MoveInput {
  forward: number
  turn: number
  strafe: number
  brake: boolean
  sprint: boolean
}
