import { useEffect, useRef, useState } from 'react'
import { trailAudio } from '../audio'
import './scenes.css'

export type MinigameKind = 'Hunt' | 'Raft'
export interface MinigameSnapshot {
  kind: MinigameKind
  seed: string
  ammo_available: number
  seconds_remaining?: number
  food_lbs?: number
  shots?: number
  crosshair?: { x: number; y: number }
  cargo_lost_lbs?: number
  casualties?: number
  targets?: Array<{
    id: string | number
    x: number
    y: number
    name?: string
    alive?: boolean
    aim?: { x: number; y: number } | null
  }>
  rocks?: Array<{ id: string | number; x: number; y: number; charged?: boolean }>
  raft_x?: number
}
export interface MinigameController {
  minigameSnapshot(): MinigameSnapshot | undefined
  minigameAction(action: {
    kind: 'key' | 'text_key' | 'aim' | 'shoot' | 'steer'
    key?: string
    x?: number
    y?: number
    direction?: 'left' | 'right'
  }): void | Promise<void>
  minigameTick(frames: number): void | Promise<void>
  finishMinigame(): void | Promise<void>
}

/**
 * Rendering and controls for a logical minigame owned by the Rust bridge. This component
 * deliberately never calculates food, hits, collisions, or final result payloads.
 */
export function Minigame({
  controller,
  reducedMotion,
  onFinish,
}: {
  controller?: MinigameController
  reducedMotion: boolean
  onFinish?: () => void
}) {
  const [snapshot, setSnapshot] = useState<MinigameSnapshot | undefined>(() =>
    controller?.minigameSnapshot(),
  )
  const ticking = useRef<number | undefined>(undefined)
  const lastFrame = useRef<number | undefined>(undefined)
  const elapsed = useRef(0)
  const minigameKind = snapshot?.kind
  useEffect(() => {
    if (!controller || reducedMotion) return
    const resetClock = () => {
      elapsed.current = 0
      lastFrame.current = performance.now()
    }
    const loop = async (now: number) => {
      const previous = lastFrame.current ?? now
      lastFrame.current = now
      // The original world advances at 30 Hz, independent of display refresh. Do not make
      // up missed time after a hidden tab or a long browser stall.
      if (document.visibilityState === 'visible') elapsed.current += Math.min(100, now - previous)
      else elapsed.current = 0
      const frames = Math.min(3, Math.floor(elapsed.current / (1000 / 30)))
      elapsed.current -= frames * (1000 / 30)
      if (frames > 0) {
        await controller.minigameTick(frames)
        setSnapshot(controller.minigameSnapshot())
      }
      ticking.current = requestAnimationFrame(loop)
    }
    ticking.current = requestAnimationFrame(loop)
    document.addEventListener('visibilitychange', resetClock)
    return () => {
      if (ticking.current) cancelAnimationFrame(ticking.current)
      document.removeEventListener('visibilitychange', resetClock)
      lastFrame.current = undefined
      elapsed.current = 0
    }
  }, [controller, reducedMotion])
  useEffect(() => {
    if (minigameKind) trailAudio.setScene(minigameKind === 'Hunt' ? 'hunt' : 'river')
  }, [minigameKind])

  if (!controller || !snapshot)
    return (
      <section className="minigame minigame-loading" aria-live="polite">
        <p>The trail scene is preparing. The journey has not advanced.</p>
      </section>
    )
  const hunt = snapshot.kind === 'Hunt'
  const doAction = async (action: Parameters<MinigameController['minigameAction']>[0]) => {
    await controller.minigameAction(action)
    if (action.kind === 'shoot') trailAudio.play('shot')
    setSnapshot(controller.minigameSnapshot())
  }
  const finish = async () => {
    await controller.finishMinigame()
    onFinish?.()
  }
  const textAction = (key: string) => doAction({ kind: 'text_key', key })
  return (
    <section
      className={`minigame ${hunt ? 'minigame-hunt' : 'minigame-raft'}`}
      onKeyDown={(event) => {
        if (event.key === 'Escape') void finish()
        if (
          reducedMotion &&
          (hunt
            ? [' ', '1', '2', '3', '4', '5'].includes(event.key)
            : [' ', '1', '2', '3'].includes(event.key))
        ) {
          event.preventDefault()
          void textAction(event.key)
        }
        if (!reducedMotion && hunt && event.key === ' ') {
          event.preventDefault()
          void doAction({ kind: 'shoot' })
        }
        if (
          !reducedMotion &&
          ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)
        ) {
          event.preventDefault()
          void doAction({ kind: 'key', key: event.key })
        }
      }}
      tabIndex={0}
      aria-label={hunt ? 'Hunt' : 'Raft the Columbia'}
    >
      <header>
        <span>{hunt ? 'Hunt for food' : 'Raft the Columbia'}</span>
        <small>{snapshot.seconds_remaining ?? '—'} seconds</small>
      </header>
      <div
        className="minigame-field"
        role="application"
        aria-label={
          hunt ? 'Use the target list or aim and fire.' : 'Steer between the approaching rocks.'
        }
      >
        {hunt ? (
          <>
            {snapshot.targets
              ?.filter((target) => target.alive !== false)
              .map((target) => (
                <button
                  key={target.id}
                  type="button"
                  className="minigame-target"
                  style={{
                    left: `${gridPercent(target.x, 80)}%`,
                    top: `${gridPercent(target.y, 23)}%`,
                  }}
                  onClick={() =>
                    void doAction({
                      kind: 'aim',
                      x: target.aim?.x ?? target.x,
                      y: target.aim?.y ?? target.y,
                    })
                  }
                  aria-label={`Aim at ${target.name ?? 'animal'}`}
                >
                  <AnimalSilhouette name={target.name} />
                </button>
              ))}
            {snapshot.crosshair && (
              <i
                className="minigame-reticle"
                aria-hidden="true"
                style={{
                  left: `${gridPercent(snapshot.crosshair.x, 80)}%`,
                  top: `${gridPercent(snapshot.crosshair.y, 23)}%`,
                }}
              />
            )}
          </>
        ) : (
          <>
            <i className="minigame-bank minigame-bank-left" aria-hidden="true" />
            <i className="minigame-bank minigame-bank-right" aria-hidden="true" />
            {snapshot.rocks
              ?.filter((rock) => !rock.charged)
              .map((rock) => (
                <i
                  key={rock.id}
                  className="minigame-rock"
                  style={{
                    left: `${gridPercent(rock.x, 80)}%`,
                    top: `${gridPercent(rock.y, 23)}%`,
                  }}
                />
              ))}
          </>
        )}
        {!hunt && (
          <i
            className="minigame-raft-marker"
            style={{ left: `${gridPercent(snapshot.raft_x ?? 40, 80)}%` }}
            aria-hidden="true"
          />
        )}
      </div>
      <footer>
        <span>
          {hunt
            ? `Food ${snapshot.food_lbs ?? 0} lb · shots ${snapshot.shots ?? 0} / ${snapshot.ammo_available}`
            : `Cargo lost ${snapshot.cargo_lost_lbs ?? 0} lb · deaths ${snapshot.casualties ?? 0}`}
        </span>
        {hunt ? (
          reducedMotion ? (
            <span className="minigame-target-list">
              {snapshot.targets
                ?.filter((target) => target.alive !== false && target.aim)
                .slice(0, 5)
                .map((target, index) => (
                  <button
                    key={target.id}
                    type="button"
                    onClick={() => void textAction(String(index + 1))}
                  >
                    {index + 1}. {target.name}
                  </button>
                ))}
              <button type="button" onClick={() => void textAction(' ')}>
                Wait 1 second
              </button>
            </span>
          ) : (
            <button type="button" onClick={() => void doAction({ kind: 'shoot' })}>
              Fire
            </button>
          )
        ) : reducedMotion ? (
          <span>
            <button type="button" onClick={() => void textAction('1')}>
              1. Left
            </button>
            <button type="button" onClick={() => void textAction('2')}>
              2. Center
            </button>
            <button type="button" onClick={() => void textAction('3')}>
              3. Right
            </button>
            <button type="button" onClick={() => void textAction(' ')}>
              Wait 1 second
            </button>
          </span>
        ) : (
          <span>
            <button
              type="button"
              onClick={() => void doAction({ kind: 'steer', direction: 'left' })}
            >
              Steer left
            </button>
            <button
              type="button"
              onClick={() => void doAction({ kind: 'steer', direction: 'right' })}
            >
              Steer right
            </button>
          </span>
        )}
        <button type="button" onClick={() => void finish()}>
          {hunt
            ? 'Return to camp'
            : (snapshot.seconds_remaining ?? 1) > 0
              ? 'Return to bank'
              : 'Finish crossing'}
        </button>
      </footer>
    </section>
  )
}

function gridPercent(value: number, extent: number) {
  return Math.max(0, Math.min(100, (value / extent) * 100))
}

function AnimalSilhouette({ name }: { name?: string }) {
  const path =
    (
      {
        Buffalo: 'M3 17c1-6 5-8 10-8l2-3 2 3c4 0 7 3 7 8l-3 1-1 4h-3l-1-3h-5l-1 3H7l-1-4z',
        Deer: 'M4 18c1-5 4-7 9-7l2-4m-1 0-2-3m3 3 2-3m-1 3h3c3 0 5 3 5 7l-3 1-1 4h-2l-1-3H10l-1 3H6l-1-4z',
        Bear: 'M4 18c0-5 3-8 7-8l1-3 2 2 3-2 1 3c4 0 7 3 7 8l-3 1-1 4h-3l-1-3h-5l-1 3H7l-1-4z',
        Rabbit: 'M7 19c0-4 3-6 7-6l1-8 2 8c4 0 5 2 5 6l-2 1-1 3h-2l-1-2h-4l-1 2H9l-1-3z',
        Squirrel: 'M5 19c0-5 3-8 7-7 2-4 7-3 7 1-3-1-4 1-3 3 3 1 4 3 3 4l-3 1-1-3h-5l-1 3H8l-1-4z',
      } as Record<string, string>
    )[name ?? ''] ?? 'M4 17c0-5 4-8 9-8s8 3 8 8l-3 1-1 4h-3l-1-3H10l-1 3H6l-1-4z'
  return (
    <svg viewBox="0 0 28 28" aria-hidden="true">
      <path d={path} />
    </svg>
  )
}
