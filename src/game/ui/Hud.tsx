import {
  BookOpen,
  Compass,
  Heart,
  Map,
  Menu,
  Package,
  Pause,
  Settings,
  Tent,
  Users,
} from 'lucide-react'
import type { RuntimeSnapshot } from '../contracts'
import type { Overlay } from '../contracts'
import type { InputAction } from '../input'
import type { PointerEvent } from 'react'
import { humanize, phase } from '../../presentation'

export function Hud({
  snapshot,
  onOpen,
  onInteract,
  onAction,
  onResume,
  onKey,
}: {
  snapshot: RuntimeSnapshot
  onOpen: (overlay: Overlay) => void
  onInteract: () => void
  onAction: (action: InputAction) => void
  onResume: () => void
  onKey: (code: string, down: boolean) => void
}) {
  const view = snapshot.view
  const party = view.party.filter((member) => member.alive)
  const health = party.length
    ? Math.round(party.reduce((sum, member) => sum + member.health, 0) / party.length)
    : 0
  const interaction = snapshot.interaction
  const decision = view.pending_event
    ? { label: 'Resolve trail moment', overlay: 'encounter' as const }
    : phase(view) === 'AwaitingFork' && !view.active_minigame
      ? { label: 'Choose the trail', overlay: 'route' as const }
      : ['Arrived', 'Failed'].includes(phase(view))
        ? { label: 'Review ending', overlay: 'ending' as const }
        : null
  return (
    <>
      <header className="trail-hud">
        <div className="hud-mark">
          <Compass size={19} />
          <span>Pioneer Trail</span>
        </div>
        <div className="hud-metrics">
          <span>Day {view.day + 1}</span>
          <span>{view.miles.toLocaleString()} mi</span>
          <span>
            {humanize(view.weather)}
            {snapshot.sceneWeather === 'fog' ? ' · fog' : ''}
          </span>
        </div>
        {snapshot.paused ? (
          <button className="hud-resume" onClick={onResume}>
            Resume journey
          </button>
        ) : (
          <button className="hud-icon" aria-label="Pause" onClick={() => onOpen('pause')}>
            <Pause size={18} />
          </button>
        )}
      </header>
      <aside className="vitals" aria-label="Journey condition">
        <div>
          <Heart size={15} />
          <span>Party</span>
          <strong>{health}%</strong>
        </div>
        <div>
          <Package size={15} />
          <span>Food</span>
          <strong>{view.inventory.food ?? 0} lb</strong>
        </div>
        <div>
          <Tent size={15} />
          <span>{snapshot.mode === 'riding' ? 'Wagon' : 'On foot'}</span>
          <strong>{Math.round(Math.abs(snapshot.speed) * 2.24)} mph</strong>
        </div>
      </aside>
      {interaction && (
        <button className="interact-prompt" onClick={onInteract}>
          <kbd>E</kbd>
          <span>{interaction.label}</span>
        </button>
      )}
      {snapshot.activity && (
        <div className="activity-readout">
          <strong>{humanize(snapshot.activity.kind)}</strong>
          <span>{snapshot.activity.hint}</span>
          {snapshot.activity.kind === 'fish' && (
            <em>{fishPrompt(snapshot.activity.tension, snapshot.activity.phase)}</em>
          )}
          <i>
            <b style={{ width: `${Math.round(snapshot.activity.progress * 100)}%` }} />
          </i>
          {snapshot.activity.tension !== undefined && (
            <label className="tension-meter">
              Line tension
              <i>
                <b style={{ width: `${percent(snapshot.activity.tension)}%` }} />
              </i>
            </label>
          )}
        </div>
      )}
      {snapshot.activity?.kind === 'hunt' && (
        <div className="activity-reticle" aria-hidden="true" />
      )}
      <nav className="hud-nav" aria-label="Trail tools">
        {decision && (
          <button
            aria-label={decision.label}
            title={`${decision.label} (Enter)`}
            onClick={() => onOpen(decision.overlay)}
          >
            <Compass size={18} />
            <span>{decision.label}</span>
          </button>
        )}
        <button aria-label="Map" onClick={() => onOpen('map')}>
          <Map size={18} />
          <span>Map</span>
        </button>
        <button aria-label="Wagon" onClick={() => onOpen('inventory')}>
          <Package size={18} />
          <span>Wagon</span>
        </button>
        <button aria-label="Party" onClick={() => onOpen('party')}>
          <Users size={18} />
          <span>Party</span>
        </button>
        <button aria-label="Journal" onClick={() => onOpen('journal')}>
          <BookOpen size={18} />
          <span>Journal</span>
        </button>
        <button aria-label="Camp" onClick={() => onAction('camp')}>
          <Tent size={18} />
          <span>Camp</span>
        </button>
        <button aria-label="Settings" onClick={() => onOpen('settings')}>
          <Settings size={18} />
          <span>Settings</span>
        </button>
      </nav>
      <div className="control-hint">
        <Menu size={14} /> WASD move · mouse look · E interact{decision && ' · Enter decision'}
      </div>
      <TouchControls
        mode={snapshot.mode}
        onKey={onKey}
        onAction={onAction}
        onInteract={onInteract}
      />
    </>
  )
}

function percent(value: number) {
  return Math.round(Math.max(0, Math.min(1, value <= 1 ? value : value / 100)) * 100)
}

function fishPrompt(tension: number | undefined, phase: string) {
  const state = phase.toLowerCase()
  if (/ready|cast/.test(state)) return 'Cast when ready. Keep the line clear of the bank.'
  if (/wait|idle|search/.test(state)) return 'Wait patiently for a pull on the line.'
  if (/bite|hook/.test(state)) return 'Bite! Press Space to hook the fish.'
  if (/reel|fight|tension/.test(state))
    return (tension ?? 0) > 0.72
      ? 'Line is tight. Ease off Space before it snaps.'
      : 'Reel steadily with Space and keep the tension balanced.'
  return 'Watch the line and react when the fish bites.'
}

function TouchControls({
  mode,
  onKey,
  onAction,
  onInteract,
}: {
  mode: RuntimeSnapshot['mode']
  onKey: (code: string, down: boolean) => void
  onAction: (action: InputAction) => void
  onInteract: () => void
}) {
  return (
    <section className="touch-controls" aria-label="Touch controls">
      <div
        className="touch-pad"
        aria-label={mode === 'riding' ? 'Wagon movement' : 'Walking movement'}
      >
        <HoldControl code="KeyW" label="Forward" onKey={onKey} />
        <HoldControl code="KeyA" label={mode === 'riding' ? 'Steer left' : 'Left'} onKey={onKey} />
        <HoldControl code="KeyS" label="Reverse" onKey={onKey} />
        <HoldControl
          code="KeyD"
          label={mode === 'riding' ? 'Steer right' : 'Right'}
          onKey={onKey}
        />
      </div>
      <div className="touch-actions" aria-label="Trail actions">
        <button type="button" onClick={onInteract}>
          <kbd>E</kbd> Interact
        </button>
        <HoldControl
          code="Space"
          label="Brake / reel"
          onKey={onKey}
          onPress={() => onAction('primary')}
        />
        <button type="button" onClick={() => onAction('reload')}>
          <kbd>R</kbd> Reload
        </button>
        <button type="button" onClick={() => onAction('finish')}>
          <kbd>X</kbd> Finish
        </button>
        <button type="button" onClick={() => onAction('hunt')}>
          <kbd>H</kbd> Hunt
        </button>
        <button type="button" onClick={() => onAction('fish')}>
          <kbd>F</kbd> Fish
        </button>
      </div>
    </section>
  )
}

function HoldControl({
  code,
  label,
  onKey,
  onPress,
}: {
  code: string
  label: string
  onKey: (code: string, down: boolean) => void
  onPress?: () => void
}) {
  const release = (event: PointerEvent<HTMLButtonElement>) => {
    onKey(code, false)
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId)
  }
  return (
    <button
      type="button"
      className={`touch-key touch-${code}`}
      aria-label={label}
      onPointerDown={(event) => {
        event.preventDefault()
        event.currentTarget.setPointerCapture(event.pointerId)
        onKey(code, true)
        onPress?.()
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={() => onKey(code, false)}
    >
      {label}
    </button>
  )
}
