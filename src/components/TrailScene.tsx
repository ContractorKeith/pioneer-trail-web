import { lazy, Suspense } from 'react'
import './scenes.css'

export type SceneMode = 'trail' | 'camp' | 'hunt' | 'fish' | 'river' | 'snow' | 'repair' | 'talk'
export interface TrailSceneProps {
  mode: SceneMode
  weather: string
  terrain: string
  moving?: boolean
  reducedMotion: boolean
  className?: string
}

const SceneCanvas = lazy(() => import('./SceneCanvas'))
const copy: Record<SceneMode, string> = {
  trail: 'The wagon road rolls west beneath an open sky.',
  camp: 'The wagon is parked. Firelight holds back the cold.',
  hunt: 'You step quietly through the cover, looking for food.',
  fish: 'The current works around your line at the riverbank.',
  river: 'The far bank is a decision away.',
  snow: 'Snow closes around the trail and softens every sound.',
  repair: 'The wheel waits in the dirt beside the wagon.',
  talk: 'A fellow traveler waits by the fire.',
}

/** Loads Three.js only after a cinematic scene is requested. */
export function TrailScene(props: TrailSceneProps) {
  const fallback = (
    <div
      className={`trail-scene scene-${props.mode} ${props.className ?? ''}`}
      aria-label={copy[props.mode]}
      role="img"
    >
      <div className="scene-fallback">{copy[props.mode]}</div>
      <div className="scene-vignette" aria-hidden="true" />
    </div>
  )
  if (props.reducedMotion) return fallback
  return (
    <Suspense fallback={fallback}>
      <SceneCanvas {...props} />
    </Suspense>
  )
}
