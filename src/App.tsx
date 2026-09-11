import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertTriangle, Download, Upload, Volume2, VolumeX } from 'lucide-react'
import type { GameCommand } from './engine-types'
import { isRejected, phase } from './presentation'
import { Campaign } from './game/campaign'
import {
  DEFAULT_SETTINGS,
  type GameSettings,
  type Overlay,
  type RuntimeSnapshot,
} from './game/contracts'
import type { InputAction } from './game/input'
import { GameRuntime, initialSpatial } from './game/runtime'
import {
  importWorld,
  migrateLegacy,
  preserveWorldRaw,
  readWorld,
  serializeWorld,
  WORLD_BACKUP_KEY,
  WORLD_SAVE_KEY,
} from './game/persistence'
import { Dialog } from './components/Dialog'
import { GameOverlay } from './game/ui/GameOverlay'
import { Hud } from './game/ui/Hud'
import { SetupOverlay, type JourneySetup } from './game/ui/SetupOverlay'
import { planOutfit } from './outfitting'
import './App.css'

const SETTINGS_KEY = 'pioneer-trail:settings:v2'
function loadSettings(): GameSettings {
  const reduced =
    typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
  try {
    const parsed = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') as Partial<GameSettings>
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      reducedMotion: typeof parsed.reducedMotion === 'boolean' ? parsed.reducedMotion : reduced,
    }
  } catch {
    return { ...DEFAULT_SETTINGS, reducedMotion: reduced }
  }
}

export default function App() {
  const canvas = useRef<HTMLCanvasElement>(null),
    runtime = useRef<GameRuntime | null>(null),
    importInput = useRef<HTMLInputElement>(null),
    mountQueue = useRef(Promise.resolve()),
    settingsRef = useRef<GameSettings>(DEFAULT_SETTINGS)
  const [snapshot, setSnapshot] = useState<RuntimeSnapshot | null>(null),
    [settings, setSettings] = useState(loadSettings),
    [overlay, setOverlay] = useState<Overlay>(null),
    [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null),
    [loading, setLoading] = useState('Preparing the trail…'),
    [legacySave, setLegacySave] = useState<string | null>(null),
    [invalidSave, setInvalidSave] = useState<{ raw: string; backup?: string } | null>(null)
  const open = useCallback((next: Overlay) => {
    if (!next) {
      setOverlay(null)
      return
    }
    runtime.current?.pause()
    setOverlay(next)
  }, [])
  const close = useCallback(() => {
    setOverlay(null)
    if (snapshot && !['Arrived', 'Failed', 'Setup'].includes(phase(snapshot.view)))
      runtime.current?.resume()
  }, [snapshot])
  const callbacks = useCallback(
    () => ({
      onSnapshot: (next: RuntimeSnapshot) => {
        setSnapshot(next)
      },
      onOpen: open,
      onNotice: (text: string) => setNotice({ text }),
      onError: (text: string) => setNotice({ text, error: true }),
    }),
    [open],
  )
  const mount = useCallback(
    (campaign: Campaign, spatial = initialSpatial(), persist = true) => {
      const task = mountQueue.current.then(async () => {
        if (!canvas.current) return
        runtime.current?.dispose()
        runtime.current = await GameRuntime.create(canvas.current, campaign, {
          callbacks: callbacks(),
          settings: settingsRef.current,
          spatial,
          persist,
        })
      })
      mountQueue.current = task.catch(() => undefined)
      return task
    },
    [callbacks],
  )
  const validRecoveryCopy = async () => {
    const raw = localStorage.getItem(WORLD_BACKUP_KEY)
    if (!raw) return undefined
    try {
      await importWorld(raw)
      return raw
    } catch {
      return undefined
    }
  }
  const archiveActiveWorld = () => {
    try {
      return preserveWorldRaw()
    } catch (error) {
      setNotice({ text: `Your current save could not be preserved: ${String(error)}`, error: true })
      return undefined
    }
  }
  useEffect(() => {
    let live = true
    void (async () => {
      try {
        const saved = readWorld()
        if (saved.kind === 'world') {
          setLoading('Restoring your journey…')
          try {
            const restored = await importWorld(serializeWorld(saved.save))
            if (live) await mount(restored.campaign, restored.spatial, true)
          } catch (error) {
            const archived = archiveActiveWorld()
            const backup = await validRecoveryCopy()
            if (live) {
              setNotice({
                text: archived
                  ? `Your saved journey could not be restored: ${String(error)}`
                  : `Your saved journey could not be restored, and browser storage could not archive it. Export the original bytes before replacing this journey.`,
                error: true,
              })
              setInvalidSave({
                raw:
                  archived?.raw ??
                  localStorage.getItem(WORLD_SAVE_KEY) ??
                  serializeWorld(saved.save),
                backup,
              })
              await mount(await Campaign.create(), initialSpatial(), false)
            }
          }
        } else if (saved.kind === 'legacy') {
          setLegacySave(saved.raw)
          if (live) await mount(await Campaign.create(), initialSpatial(), false)
        } else {
          if (saved.kind === 'invalid') {
            const candidate = saved.backup ? serializeWorld(saved.backup) : undefined
            let backup: string | undefined
            try {
              if (candidate) {
                await importWorld(candidate)
                backup = candidate
              }
            } catch {
              /* A parsable envelope is not necessarily a recoverable campaign. */
            }
            setNotice({ text: saved.message, error: true })
            setInvalidSave({
              raw: saved.raw,
              backup,
            })
          }
          if (live) await mount(await Campaign.create(), initialSpatial(), false)
        }
      } catch (error) {
        if (live)
          setNotice({
            text: `The saved journey could not be restored: ${String(error)}`,
            error: true,
          })
        if (live) await mount(await Campaign.create(), initialSpatial(), false)
      } finally {
        if (live) setLoading('')
      }
    })()
    return () => {
      live = false
      runtime.current?.dispose()
    }
  }, [mount])
  useEffect(() => {
    settingsRef.current = settings
    runtime.current?.setSettings(settings)
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
    } catch {
      /* session settings remain active */
    }
  }, [settings])
  useEffect(() => {
    if (overlay) return
    const reopenDecision = (event: KeyboardEvent) => {
      if (
        event.code === 'Enter' &&
        !event.repeat &&
        (event.target === canvas.current || event.target === document.body)
      ) {
        event.preventDefault()
        runtime.current?.action('decision')
      }
    }
    window.addEventListener('keydown', reopenDecision)
    return () => window.removeEventListener('keydown', reopenDecision)
  }, [overlay])
  useEffect(() => {
    if (!notice || notice.error) return
    const timer = window.setTimeout(() => setNotice(null), 5000)
    return () => clearTimeout(timer)
  }, [notice])
  const command = (item: GameCommand) => {
    try {
      const result = runtime.current?.command(item)
      if (item === 'Depart') {
        setOverlay(null)
        runtime.current?.resume()
      }
      return result
    } catch (error) {
      setNotice({ text: `That action could not be completed: ${String(error)}`, error: true })
    }
  }
  const start = async (setup: JourneySetup) => {
    const party = setup.party.map((name) => name.trim())
    if (party.some((name) => !name)) {
      setNotice({
        text: 'Every traveler needs a name. Remove blank entries or add a name to continue.',
        error: true,
      })
      return
    }
    let configured: Campaign | null = null
    try {
      const current = readWorld()
      if ((current.kind === 'world' || current.kind === 'invalid') && !archiveActiveWorld()) return
      const campaign = await Campaign.create(setup.seed)
      campaign.command({ SetDifficulty: setup.difficulty })
      const result = campaign.command({
        Configure: {
          trail_id: setup.trail_id,
          era_id: setup.era_id,
          occupation_id: setup.occupation_id,
          departure_month: setup.departure_month,
          party,
        },
      })
      if (isRejected(result.outcomes)) {
        setNotice({
          text: 'That journey setup is unavailable. Review the trail, year, and occupation.',
          error: true,
        })
        return
      }
      configured = campaign
      const plan = planOutfit(campaign.view(), setup.preset)
      for (const purchase of plan.purchases) {
        const purchaseResult = campaign.command({
          Buy: { item_id: purchase.itemId, quantity: purchase.quantity },
        })
        if (isRejected(purchaseResult.outcomes))
          throw new Error('Starting supplies could not be loaded.')
      }
      const departure = campaign.command('Depart')
      if (isRejected(departure.outcomes))
        throw new Error('The wagon could not depart with these supplies.')
      await mount(campaign, initialSpatial(), true)
      runtime.current?.resume()
      if (result.outcomes.length)
        setNotice({ text: 'Your party is ready. The wagon is loaded and on the trail.' })
    } catch (error) {
      if (configured) {
        await mount(configured, initialSpatial(), true)
        setOverlay('inventory')
        setNotice({
          text: 'Your journey is configured, but the selected supplies could not be loaded. Adjust the wagon before departing.',
          error: true,
        })
        return
      }
      setNotice({ text: `Could not begin this journey: ${String(error)}`, error: true })
    }
  }
  const newJourney = async () => {
    try {
      const current = readWorld()
      if ((current.kind === 'world' || current.kind === 'invalid') && !archiveActiveWorld()) return
      await mount(await Campaign.create(), initialSpatial(), false)
      setOverlay(null)
      setNotice({ text: 'Choose a new route and party. Your previous journey remains archived.' })
    } catch (error) {
      setNotice({ text: `Could not prepare a new journey: ${String(error)}`, error: true })
    }
  }
  const migrate = async () => {
    if (!legacySave) return
    try {
      const current = readWorld()
      if ((current.kind === 'world' || current.kind === 'invalid') && !archiveActiveWorld()) return
      const migrated = await migrateLegacy(legacySave, initialSpatial())
      await mount(migrated.campaign, migrated.spatial)
      setLegacySave(null)
      setInvalidSave(null)
      setOverlay(null)
      setNotice({ text: 'Your older journey was migrated and kept as a world save.' })
    } catch (error) {
      setNotice({ text: `The older save could not be migrated: ${String(error)}`, error: true })
    }
  }
  const importSave = async (file?: File) => {
    if (!file) return
    try {
      if (file.size > 5_000_000) throw new Error('Save is larger than 5 MB.')
      const restored = await importWorld(await file.text())
      const current = readWorld()
      if ((current.kind === 'world' || current.kind === 'invalid') && !archiveActiveWorld()) return
      await mount(restored.campaign, restored.spatial)
      setInvalidSave(null)
      setLegacySave(null)
      setOverlay(null)
      setNotice({ text: 'Journey restored.' })
    } catch (error) {
      setNotice({ text: `This save could not be imported: ${String(error)}`, error: true })
    }
    if (importInput.current) importInput.current.value = ''
  }
  const exportSave = () => {
    try {
      const body = runtime.current?.save()
      if (!body) return
      const anchor = document.createElement('a')
      anchor.href = URL.createObjectURL(new Blob([body], { type: 'application/json' }))
      anchor.download = 'pioneer-trail-world-save.json'
      anchor.click()
      window.setTimeout(() => URL.revokeObjectURL(anchor.href), 1000)
    } catch (error) {
      setNotice({ text: `Could not export this journey: ${String(error)}`, error: true })
    }
  }
  const action = (next: InputAction) => {
    runtime.current?.action(next)
  }
  if (!snapshot)
    return (
      <main className="loading-screen">
        <canvas ref={canvas} className="game-canvas" />
        <p>{loading}</p>
        {notice && <p className="loading-error">{notice.text}</p>}
      </main>
    )
  const needsSetup = phase(snapshot.view) === 'Setup'
  return (
    <main className={`game-shell ${settings.reducedMotion ? 'reduced-motion' : ''}`}>
      <canvas
        ref={canvas}
        className="game-canvas"
        aria-label="Pioneer Trail 3D world. Click to look around and use WASD to move."
        tabIndex={0}
      />
      {!needsSetup && (
        <Hud
          snapshot={snapshot}
          onOpen={open}
          onInteract={() => action('interact')}
          onAction={action}
          onResume={() => runtime.current?.resume()}
          onKey={(code, down) => runtime.current?.setKey(code, down)}
        />
      )}
      {notice && (
        <div className={`notice ${notice.error ? 'is-error' : ''}`} role="status">
          {notice.error && <AlertTriangle size={17} />}
          {notice.text}
        </div>
      )}
      {needsSetup && (
        <Dialog
          title="Begin a journey"
          eyebrow="Pioneer Trail"
          dismissible={false}
          onClose={() => undefined}
        >
          <SetupOverlay view={snapshot.view} onStart={(setup) => void start(setup)} />
        </Dialog>
      )}
      {legacySave && (
        <Dialog
          title="Older journey found"
          eyebrow="Saved journey"
          onClose={() => setLegacySave(null)}
        >
          <p className="overlay-lede">
            This browser has a preserved pre-world save. Migrate it deliberately or export it before
            starting anew.
          </p>
          <div className="dialog-actions">
            <button className="primary-action" onClick={() => void migrate()}>
              Migrate journey
            </button>
            <button onClick={() => download(legacySave, 'pioneer-trail-legacy-save.json')}>
              Export old save
            </button>
          </div>
        </Dialog>
      )}
      {invalidSave && (
        <Dialog
          title="Save needs recovery"
          eyebrow="Saved journey"
          onClose={() => setInvalidSave(null)}
        >
          <p className="overlay-lede">
            The saved bytes remain intact. Export them, or restore the last valid recovery copy.
          </p>
          <div className="dialog-actions">
            <button onClick={() => download(invalidSave.raw, 'pioneer-trail-unreadable-save.json')}>
              Export preserved save
            </button>
            {invalidSave.backup && (
              <button
                className="primary-action"
                onClick={() =>
                  void importSave(
                    new File([invalidSave.backup!], 'recovery.json', { type: 'application/json' }),
                  )
                }
              >
                Restore recovery copy
              </button>
            )}
          </div>
        </Dialog>
      )}
      {overlay && (
        <GameOverlay
          overlay={overlay}
          view={snapshot.view}
          mode={snapshot.mode}
          onClose={close}
          command={command}
          onAction={action}
          activity={snapshot.activity}
          onNewJourney={() => void newJourney()}
          settings={
            <SettingsPanel
              settings={settings}
              setSettings={setSettings}
              exportSave={exportSave}
              importSave={() => importInput.current?.click()}
              onNewJourney={() => void newJourney()}
            />
          }
        />
      )}
      <input
        ref={importInput}
        className="visually-hidden"
        type="file"
        accept="application/json,.json"
        onChange={(event) => void importSave(event.target.files?.[0])}
      />
    </main>
  )
}

function SettingsPanel({
  settings,
  setSettings,
  exportSave,
  importSave,
  onNewJourney,
}: {
  settings: GameSettings
  setSettings: React.Dispatch<React.SetStateAction<GameSettings>>
  exportSave: () => void
  importSave: () => void
  onNewJourney: () => void
}) {
  const set = <K extends keyof GameSettings>(key: K, value: GameSettings[K]) =>
    setSettings((current) => ({ ...current, [key]: value }))
  return (
    <div className="settings-panel">
      <div className="settings-range">
        <label htmlFor="look-sensitivity">Look sensitivity</label>
        <output aria-hidden="true">{settings.sensitivity.toFixed(1)}×</output>
        <input
          id="look-sensitivity"
          type="range"
          min="0.3"
          max="2.5"
          step="0.1"
          value={settings.sensitivity}
          onChange={(event) => set('sensitivity', Number(event.target.value))}
        />
      </div>
      <div className="settings-range">
        <label htmlFor="field-of-view">Field of view</label>
        <output aria-hidden="true">{settings.fov}°</output>
        <input
          id="field-of-view"
          type="range"
          min="60"
          max="90"
          step="1"
          value={settings.fov}
          onChange={(event) => set('fov', Number(event.target.value))}
        />
      </div>
      <div className="settings-range">
        <label htmlFor="volume">Volume</label>
        <output aria-hidden="true">{Math.round(settings.volume * 100)}%</output>
        <input
          id="volume"
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={settings.volume}
          onChange={(event) => set('volume', Number(event.target.value))}
        />
      </div>
      <div className="toggle-row">
        <button aria-pressed={settings.muted} onClick={() => set('muted', !settings.muted)}>
          {settings.muted ? <VolumeX size={17} /> : <Volume2 size={17} />}
          {settings.muted ? 'Sound muted' : 'Sound on'}
        </button>
        <button
          aria-pressed={settings.reducedMotion}
          onClick={() => set('reducedMotion', !settings.reducedMotion)}
        >
          Reduce camera motion
        </button>
      </div>
      <label>
        Graphics quality
        <select
          value={settings.quality}
          onChange={(event) => set('quality', event.target.value as GameSettings['quality'])}
        >
          <option value="low">Low</option>
          <option value="balanced">Balanced</option>
          <option value="high">High</option>
        </select>
      </label>
      <label>
        Look controls
        <select
          value={settings.lookMode}
          onChange={(event) => set('lookMode', event.target.value as GameSettings['lookMode'])}
        >
          <option value="drag">Drag to look</option>
          <option value="pointer">Pointer lock</option>
        </select>
      </label>
      <div className="dialog-actions">
        <button onClick={exportSave}>
          <Download size={16} /> Export save
        </button>
        <button onClick={importSave}>
          <Upload size={16} /> Import save
        </button>
        <button onClick={onNewJourney}>New journey</button>
      </div>
    </div>
  )
}

function download(body: string, name: string) {
  const url = URL.createObjectURL(new Blob([body], { type: 'application/json' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
