import { useEffect, useRef, useState } from 'react'
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  ChevronRight,
  Compass,
  Crosshair,
  Download,
  Fish,
  Heart,
  Map,
  MapPin,
  Mountain,
  Package,
  Settings as SettingsIcon,
  Sprout,
  Sun,
  Tent,
  Upload,
  Users,
  Volume2,
  VolumeX,
  Wind,
  X,
} from 'lucide-react'
import { TrailEngine } from './engine'
import type { EngineResult, GameCommand, GameView, Outcome } from './engine-types'
import { describeOutcome, humanize, isRejected, phase, placeName, trailFor } from './presentation'
import { downloadSave, loadSettings, readJourney, SETTINGS_KEY, storeJourney } from './storage'
import { trailAudio } from './audio'
import { Dialog } from './components/Dialog'
import { Setup } from './components/Setup'
import type { JourneySetup } from './components/Setup'
import { Store } from './components/Store'
import { ActivityScene, GamePanels, panelTitles } from './components/GamePanels'
import type { Panel } from './components/GamePanels'
import { TrailScene } from './components/TrailScene'
import type { SceneMode } from './components/TrailScene'
import { Minigame } from './components/Minigame'
import type { MinigameSnapshot } from './components/Minigame'
import './App.css'

function resumePanel(view: GameView): Panel | null {
  if (view.active_minigame) return 'hunt'
  if (view.pending_event) return view.can_repair ? 'repair' : 'event'
  const status = phase(view)
  if (status === 'Arrived' || status === 'Failed') return 'ending'
  if (status === 'Outfitting') return 'store'
  if (status === 'AwaitingRiver') return 'river'
  if (status === 'AwaitingFork') return 'map'
  return null
}

export default function App() {
  const engine = useRef<TrailEngine | null>(null)
  const [view, setView] = useState<GameView | null>(null)
  const [panel, setPanel] = useState<Panel | null>(null)
  const [outcomes, setOutcomes] = useState<Outcome[]>([])
  const [settings, setSettings] = useState(loadSettings)
  const [toast, setToast] = useState<{ text: string; error: boolean } | null>(null)
  const [fatal, setFatal] = useState('')
  const [saved, setSaved] = useState(false)
  const [pov, setPov] = useState(false)
  const [campView, setCampView] = useState(false)
  const [moving, setMoving] = useState(false)
  const [auto, setAuto] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const latestCommand = useRef<(command: GameCommand) => EngineResult | undefined>(() => undefined)

  useEffect(() => {
    let alive = true
    void TrailEngine.create()
      .then((instance) => {
        if (!alive) return
        engine.current = instance
        try {
          const save = readJourney()
          if (save) {
            instance.load(save)
            setSaved(true)
          }
        } catch (error) {
          setToast({
            text: `Your saved journey could not be loaded. It has been kept untouched. ${String(error)}`,
            error: true,
          })
        }
        const current = instance.view()
        setView(current)
        setPanel(resumePanel(current))
      })
      .catch((error) => {
        if (alive) setFatal(`The trail could not load: ${String(error)}`)
      })
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    trailAudio.setEnabled(settings.sound)
    trailAudio.setScene(campView ? 'camp' : 'trail', view?.weather ?? 'Clear')
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
    } catch {
      /* Gameplay remains usable without settings storage. */
    }
  }, [settings, campView, view?.weather])

  useEffect(() => {
    if (!toast || toast.error) return
    const timer = setTimeout(() => setToast(null), 6500)
    return () => clearTimeout(timer)
  }, [toast])
  useEffect(() => {
    if (!moving) return
    const timer = setTimeout(() => setMoving(false), 1000)
    return () => clearTimeout(timer)
  }, [moving])

  const saveNow = () => {
    if (!engine.current) return
    try {
      storeJourney(engine.current.save())
      setSaved(true)
    } catch {
      setSaved(false)
      setToast({
        text: 'Browser storage is unavailable. Your current journey is still running; export a save from Settings before leaving.',
        error: true,
      })
    }
  }

  const receive = (result: EngineResult) => {
    setView(result.view)
    setOutcomes(result.outcomes)
    const rejected = isRejected(result.outcomes)
    const messages = result.outcomes
      .map((outcome) => describeOutcome(outcome, result.view))
      .filter((text): text is string => !!text)
    if (messages.length) setToast({ text: messages.at(-1)!, error: rejected })
    if (rejected) return result
    saveNow()
    const current = phase(result.view)
    if (result.view.active_minigame) {
      setPanel('hunt')
      setAuto(false)
    } else if (result.view.pending_event) {
      setPanel(result.view.can_repair ? 'repair' : 'event')
      setAuto(false)
    } else if (current === 'Arrived' || current === 'Failed') {
      setPanel('ending')
      setAuto(false)
    } else if (
      current === 'AwaitingRiver' &&
      (!view || phase(view) !== current || panel === 'river')
    ) {
      setPanel('river')
      setAuto(false)
    } else if (
      current === 'AwaitingFork' &&
      (!view || phase(view) !== current || panel === 'map')
    ) {
      setPanel('map')
      setAuto(false)
    } else if (result.outcomes.includes('Departed')) setPanel(null)
    else if (
      result.outcomes.some((outcome) => typeof outcome === 'object' && 'ArrivedAt' in outcome)
    ) {
      setAuto(false)
      setPanel(result.view.can_shop ? 'store' : null)
    } else if (panel === 'event' || panel === 'repair' || panel === 'river' || panel === 'hunt')
      setPanel(null)
    return result
  }

  const command = (command: GameCommand) => {
    if (!engine.current) return undefined
    try {
      if (command === 'TravelDay' || command === 'Continue') {
        setMoving(true)
        setCampView(false)
      }
      trailAudio.play(command === 'Repair' ? 'tool' : 'button')
      return receive(engine.current.apply(command))
    } catch (error) {
      setAuto(false)
      setToast({ text: `The action could not complete: ${String(error)}`, error: true })
      return undefined
    }
  }
  useEffect(() => {
    latestCommand.current = command
  })

  useEffect(() => {
    if (!auto || !view || panel) return
    const needsCare =
      (view.inventory.food ?? 0) < view.daily_food_lbs * 3 ||
      view.party.some((person) => person.alive && (person.health < 40 || person.ailments.length))
    if (phase(view) !== 'Travelling' || view.pending_event || view.active_minigame || needsCare) {
      const timeout = setTimeout(() => {
        setAuto(false)
        if (needsCare)
          setToast({
            text: 'Travel paused. Check your food and the health of your party before continuing.',
            error: false,
          })
      }, 0)
      return () => clearTimeout(timeout)
    }
    const timer = setTimeout(
      () => latestCommand.current('TravelDay'),
      settings.reducedMotion ? 900 : 1800,
    )
    return () => clearTimeout(timer)
  }, [auto, view, panel, settings.reducedMotion])

  const open = (next: Panel) => {
    setAuto(false)
    setOutcomes([])
    setPanel(next)
  }
  const closePanel = () => {
    setPanel(null)
    setOutcomes([])
  }

  const advance = () => {
    if (!view) return
    if (view.active_minigame) {
      open('hunt')
      return
    }
    if (view.pending_event) {
      open(view.can_repair ? 'repair' : 'event')
      return
    }
    switch (phase(view)) {
      case 'Setup':
        open('setup')
        break
      case 'Outfitting':
        open('store')
        break
      case 'AwaitingRiver':
        open('river')
        break
      case 'AwaitingFork':
        open('map')
        break
      case 'AtLandmark':
        command('Continue')
        break
      case 'Arrived':
      case 'Failed':
        open('ending')
        break
      default:
        command('TravelDay')
    }
  }

  const start = async (setup: JourneySetup) => {
    try {
      const fresh = await TrailEngine.create(setup.seed)
      const difficulty = fresh.apply({ SetDifficulty: setup.difficulty })
      if (isRejected(difficulty.outcomes)) throw new Error('This difficulty could not be selected.')
      const result = fresh.apply({
        Configure: {
          trail_id: setup.trail_id,
          era_id: setup.era_id,
          occupation_id: setup.occupation_id,
          departure_month: setup.departure_month,
          party: setup.party.map((name) => name.trim()),
        },
      })
      if (isRejected(result.outcomes)) {
        setToast({
          text: result.outcomes.map((outcome) => describeOutcome(outcome, result.view)).join(' '),
          error: true,
        })
        return
      }
      engine.current = fresh
      setView(result.view)
      setOutcomes([])
      setPanel('store')
      setCampView(false)
      setPov(false)
      saveNow()
    } catch (error) {
      setToast({ text: `Could not start this journey: ${String(error)}`, error: true })
    }
  }

  const importSave = async (file?: File) => {
    if (!file) return
    try {
      if (file.size > 5_000_000) throw new Error('The save is larger than 5 MB.')
      const raw = await file.text()
      const candidate = await TrailEngine.create()
      const restored = candidate.load(raw)
      engine.current = candidate
      setView(restored)
      setOutcomes([])
      setAuto(false)
      setPanel(resumePanel(restored))
      saveNow()
      setToast({ text: 'Your journey has been restored. Welcome back to the trail.', error: false })
    } catch (error) {
      setToast({
        text: `This save could not be imported. Your current journey is unchanged. ${String(error)}`,
        error: true,
      })
    }
    if (fileInput.current) fileInput.current.value = ''
  }

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (
        panel ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        (event.target as HTMLElement)?.matches('input,select,textarea,button,a')
      )
        return
      const key = event.key.toLowerCase()
      if (key === 'enter') {
        event.preventDefault()
        advance()
      } else if (view && phase(view) !== 'Setup') {
        const shortcuts: Record<string, Panel> = {
          c: 'camp',
          j: 'journal',
          m: 'map',
          p: 'party',
          s: 'store',
          r: 'travel',
        }
        if (shortcuts[key]) {
          event.preventDefault()
          open(shortcuts[key])
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  })

  if (!view)
    return (
      <div className="loading-screen">
        <Mountain size={48} strokeWidth={1} />
        <span className="eyebrow">Pioneer Trail</span>
        <h1>The west is waiting.</h1>
        <p className="muted">{fatal || 'Packing the wagon and finding the road…'}</p>
        {fatal && (
          <button className="button" onClick={() => window.location.reload()}>
            Try again
          </button>
        )}
      </div>
    )

  const status = phase(view)
  const welcome = status === 'Setup'
  const trail = trailFor(view)
  const aliveParty = view.party.filter((person) => person.alive)
  const health = aliveParty.length
    ? Math.round(aliveParty.reduce((sum, member) => sum + member.health, 0) / aliveParty.length)
    : 0
  const mode: SceneMode = campView
    ? 'camp'
    : ['Snow', 'Blizzard'].includes(view.weather)
      ? 'snow'
      : status === 'AwaitingRiver'
        ? 'river'
        : 'trail'
  const artwork = mode === 'camp' ? 'camp' : mode === 'snow' ? 'snow' : 'trail'
  const nextStop = view.target_node_id
    ? placeName(view, view.target_node_id)
    : welcome
      ? 'A whole new life'
      : status === 'Outfitting'
        ? 'The road west'
        : 'The next chapter'
  const location = view.current_node?.name ?? 'Independence, Missouri'
  const date = new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(view.date.year, view.date.month - 1, view.date.day)))
  const advanceLabel = welcome
    ? 'Begin your journey'
    : view.pending_event
      ? 'Face the moment'
      : view.active_minigame
        ? 'Resume activity'
        : status === 'Outfitting'
          ? 'Outfit your wagon'
          : status === 'AwaitingRiver'
            ? 'Scout the crossing'
            : status === 'AwaitingFork'
              ? 'Choose your route'
              : status === 'AtLandmark'
                ? 'Continue west'
                : ['Arrived', 'Failed'].includes(status)
                  ? 'Read your ending'
                  : 'Travel one day'
  const lastMessages = outcomes
    .map((outcome) => describeOutcome(outcome, view))
    .filter((text): text is string => !!text)
  const actions = [
    {
      title: 'Make camp',
      sub: 'A moment to breathe',
      icon: Tent,
      panel: 'camp' as Panel,
      shortcut: 'C',
    },
    {
      title: 'Go hunting',
      sub: 'Bring food home',
      icon: Crosshair,
      panel: 'hunt' as Panel,
      shortcut: '',
    },
    {
      title: 'Go fishing',
      sub: 'Find a quiet bank',
      icon: Fish,
      panel: 'fish' as Panel,
      shortcut: '',
    },
    {
      title: 'Meet travelers',
      sub: 'Share a story or two',
      icon: Users,
      panel: 'talk' as Panel,
      shortcut: '',
    },
  ]
  const nav = [
    { title: 'The trail', icon: Compass, panel: null },
    { title: 'Your party', icon: Users, panel: 'party' },
    { title: 'Wagon & supplies', icon: Package, panel: 'store' },
    { title: 'Field journal', icon: BookOpen, panel: 'journal' },
    { title: 'Trail map', icon: Map, panel: 'map' },
  ]
  const minigameOperation = (action: () => void) => {
    try {
      action()
    } catch (error) {
      setToast({
        text: `The activity could not continue: ${String(error)}. Your journey is still saved.`,
        error: true,
      })
    }
  }
  const minigameController = view.active_minigame
    ? {
        minigameSnapshot: () => engine.current!.minigameSnapshot() as MinigameSnapshot | undefined,
        minigameAction: (action: unknown) =>
          minigameOperation(() => {
            engine.current!.minigameAction(action)
          }),
        minigameTick: (frames: number) =>
          minigameOperation(() => {
            engine.current!.minigameTick(frames)
          }),
        finishMinigame: () =>
          minigameOperation(() => {
            receive(engine.current!.finishMinigame())
          }),
      }
    : undefined

  return (
    <div
      className={`app-shell ${welcome ? 'welcome-shell' : 'playing-shell'} ${settings.reducedMotion ? 'reduced-motion' : ''}`}
    >
      {!welcome && (
        <aside className="sidebar">
          <a
            className="brand"
            href="#"
            aria-label="Pioneer Trail home"
            onClick={(event) => {
              event.preventDefault()
              closePanel()
            }}
          >
            <span className="brand-symbol">
              <Mountain size={49} strokeWidth={1} />
            </span>
            <strong>PIONEER</strong>
            <small>TRAIL</small>
          </a>
          <div className="side-kicker">YOUR JOURNEY</div>
          <nav className="nav-list" aria-label="Journey navigation">
            {nav.map((item) => (
              <button
                key={item.title}
                className={`nav-item ${panel === item.panel ? 'active' : ''}`}
                onClick={() =>
                  item.panel ? open(welcome ? 'setup' : (item.panel as Panel)) : closePanel()
                }
              >
                <item.icon size={18} strokeWidth={1.4} />
                {item.title}
                {item.panel === null && <span className="nav-dot" />}
              </button>
            ))}
          </nav>
        </aside>
      )}
      <main className="app-main">
        <header className="topbar">
          {!welcome && (
            <div className="breadcrumb">
              <span>Your journey</span>
              <ChevronRight size={12} />
              {trail?.name ?? 'The Oregon Trail'}
            </div>
          )}
          <div className="mobile-brand">
            <Mountain size={22} strokeWidth={1.2} />
            Pioneer Trail
          </div>
          <div className="topbar-right">
            <span className="saved-label">
              <i className="saved-dot" />
              {welcome
                ? 'Your adventure starts here'
                : saved
                  ? 'Journey saved on this device'
                  : 'Save unavailable'}
            </span>
            <button
              className="icon-button"
              onClick={() => setSettings((old) => ({ ...old, sound: !old.sound }))}
              aria-label={settings.sound ? 'Mute sound' : 'Enable sound'}
              title={settings.sound ? 'Mute sound' : 'Enable sound'}
            >
              {settings.sound ? <Volume2 size={18} /> : <VolumeX size={18} />}
            </button>
            <button
              className="icon-button"
              aria-label="Settings and saves"
              onClick={() => open('settings')}
            >
              <SettingsIcon size={18} />
            </button>
          </div>
        </header>
        <div className="page-content">
          {!welcome && (
            <div className="journey-heading">
              <div>
                <span className="eyebrow">
                  {welcome ? 'A NEW CHAPTER AWAITS' : `DAY ${view.day + 1} OF YOUR JOURNEY`}
                </span>
                <h1>
                  {welcome
                    ? 'The call of the west.'
                    : campView
                      ? 'Home, for tonight.'
                      : 'Another day. A little farther.'}
                </h1>
              </div>
              <div className="date-chip">
                <CalendarDays size={15} strokeWidth={1.3} />
                {date}
              </div>
            </div>
          )}
          <section className="hero" aria-label="A view of the Pioneer Trail">
            <img
              className="hero-background"
              src={`/scenes/${artwork}.webp`}
              alt={
                campView
                  ? 'A warm campfire beside a covered wagon beneath mountain pines at dusk'
                  : mode === 'snow'
                    ? 'A covered wagon following a snowy trail into a mountain pass'
                    : 'A covered wagon on a golden trail beside a winding river and distant mountains'
              }
            />
            {pov && (
              <TrailScene
                mode={mode}
                weather={view.weather}
                terrain={view.terrain}
                moving={moving || auto}
                reducedMotion={settings.reducedMotion}
                className="scene-layer"
              />
            )}
            <div className="hero-top">
              <span className="location-badge">
                <MapPin size={13} />
                {welcome ? 'INDEPENDENCE, MISSOURI' : location}
              </span>
              <span className="weather-chip">
                {['Snow', 'Blizzard'].includes(view.weather) ? (
                  <Wind size={13} />
                ) : (
                  <Sun size={13} />
                )}{' '}
                {humanize(view.weather)}
                {!welcome && ` · ${humanize(view.terrain)}`}
              </span>
            </div>
            <div className="hero-story">
              <span className="eyebrow">
                {campView
                  ? 'THE SIMPLE THINGS THAT KEEP US GOING'
                  : welcome
                    ? 'THE HORIZON IS ONLY THE BEGINNING'
                    : `${view.miles.toLocaleString()} MILES INTO THE UNKNOWN`}
              </span>
              <h2>
                {welcome ? (
                  <>
                    Westward,
                    <br />
                    <em>together.</em>
                  </>
                ) : campView ? (
                  <>
                    Under the stars.
                    <br />
                    <em>Beside the fire.</em>
                  </>
                ) : status === 'AwaitingRiver' ? (
                  <>
                    The far bank
                    <br />
                    <em>is waiting.</em>
                  </>
                ) : mode === 'snow' ? (
                  <>
                    Through the white.
                    <br />
                    <em>Onward, still.</em>
                  </>
                ) : (
                  <>
                    A long way from
                    <br />
                    <em>where we began.</em>
                  </>
                )}
              </h2>
              <p>
                {welcome
                  ? 'An open road. An uncertain future. The people beside you make it an adventure worth taking.'
                  : campView
                    ? 'The world can wait a little. Your people need warmth, food, and a little time together.'
                    : `Follow the trail toward ${nextStop}. Every choice leaves a mark on the journey.`}
              </p>
              {welcome && (
                <button className="button light" onClick={() => open('setup')}>
                  Begin your journey
                  <ArrowRight size={16} />
                </button>
              )}
            </div>
            <div className="compass-mark">
              <span>N</span>
              <Compass size={40} strokeWidth={0.7} />
            </div>
            <div className="hero-footer">
              <span className="eyebrow">
                {welcome
                  ? 'YOUR STORY STARTS HERE'
                  : `${aliveParty.length} TRAVELERS · ONE SHARED JOURNEY`}
              </span>
              <div className="view-picker" aria-label="Scene view">
                <button className={!pov ? 'active' : ''} onClick={() => setPov(false)}>
                  <Mountain size={12} />
                  Scenic
                </button>
                <button className={pov ? 'active' : ''} onClick={() => setPov(true)}>
                  <Compass size={12} />
                  First person
                </button>
                {!welcome && (
                  <button
                    className={campView ? 'active' : ''}
                    onClick={() => {
                      setCampView((old) => !old)
                      setPov(false)
                    }}
                  >
                    <Tent size={12} />
                    Camp
                  </button>
                )}
              </div>
            </div>
          </section>
          {welcome ? (
            <div className="welcome-steps" aria-label="How to begin">
              <span>
                <b>1</b> Choose your trail
              </span>
              <span>
                <b>2</b> Name your travelers
              </span>
              <span>
                <b>3</b> Pack up & go
              </span>
              <small>On the road in a minute or two.</small>
            </div>
          ) : (
            <>
              <div className="trail-toolbar">
                <div className="status-strip">
                  {[
                    {
                      label: 'DISTANCE',
                      value: view.miles.toLocaleString(),
                      unit: 'miles',
                      icon: Compass,
                    },
                    {
                      label: 'FOOD',
                      value: Math.floor((view.inventory.food ?? 0) / (view.daily_food_lbs || 1)),
                      unit: 'days',
                      icon: Sprout,
                    },
                    { label: 'PARTY HEALTH', value: `${health}%`, unit: '', icon: Heart },
                  ].map((stat) => (
                    <div className="status-stat" key={stat.label}>
                      <stat.icon strokeWidth={1.4} />
                      <div>
                        <span>{stat.label}</span>
                        <strong>
                          {stat.value}
                          <small>{stat.unit}</small>
                        </strong>
                      </div>
                    </div>
                  ))}
                </div>
                <button className="button journey-advance" onClick={advance}>
                  {advanceLabel}
                  <ArrowRight size={17} />
                </button>
              </div>
              <div className="trail-activities">
                {actions.map((action) => (
                  <button
                    className="trail-activity"
                    key={action.title}
                    onClick={() => {
                      if (action.panel === 'hunt') {
                        if (view.active_minigame) open('hunt')
                        else if (view.can_hunt) command('BeginHunt')
                        else {
                          open('camp')
                          setToast({
                            text: 'Hunting requires ammunition and a clear moment on the trail.',
                            error: false,
                          })
                        }
                      } else open(action.panel)
                    }}
                  >
                    <action.icon size={22} strokeWidth={1.4} />
                    {action.title}
                  </button>
                ))}
              </div>
              {status === 'Travelling' && !view.pending_event && (
                <details className="travel-options">
                  <summary>Travel options</summary>
                  <div className="button-row">
                    <button className="text-button" onClick={() => open('travel')}>
                      Pace & rest
                    </button>
                    <button
                      className="text-button"
                      onClick={() => {
                        setAuto((old) => !old)
                        setPanel(null)
                      }}
                    >
                      {auto ? 'Pause travel' : 'Travel automatically'}
                    </button>
                    <span className="small muted">
                      {humanize(view.pace)} pace · {humanize(view.rations)} meals
                    </span>
                  </div>
                </details>
              )}
              {auto && (
                <button className="button secondary full" onClick={() => setAuto(false)}>
                  Pause travel
                </button>
              )}
            </>
          )}
        </div>
      </main>
      {toast && !panel && (
        <div
          className={`toast ${toast.error ? 'error' : ''}`}
          role={toast.error ? 'alert' : 'status'}
        >
          <span>{toast.text}</span>
          <button aria-label="Dismiss notification" onClick={() => setToast(null)}>
            <X size={16} />
          </button>
        </div>
      )}
      {panel && (
        <Dialog
          key={panel}
          title={
            panel === 'hunt' && view.active_minigame?.kind === 'Raft'
              ? 'Down the Columbia'
              : panelTitles[panel]
          }
          eyebrow={
            panel === 'setup' ? 'YOUR JOURNEY BEGINS HERE' : `${location} · DAY ${view.day + 1}`
          }
          onClose={closePanel}
          wide={['store', 'camp', 'setup', 'hunt', 'map'].includes(panel)}
        >
          {toast?.error && (
            <div className="note error-note" role="alert" style={{ marginBottom: 18 }}>
              <p>{toast.text}</p>
              <button
                className="text-button"
                style={{ marginTop: 8 }}
                onClick={() => setToast(null)}
              >
                Dismiss
              </button>
            </div>
          )}
          {panel === 'setup' ? (
            <Setup view={view} onStart={start} />
          ) : panel === 'store' ? (
            <Store view={view} command={command} />
          ) : panel === 'settings' ? (
            <>
              <div className="settings-row">
                <div>
                  <strong>The sounds of the trail</strong>
                  <p>Wind, water, birds, wagon creaks and a crackling fire.</p>
                </div>
                <button
                  className={`toggle ${settings.sound ? 'on' : ''}`}
                  role="switch"
                  aria-checked={settings.sound}
                  aria-label="Ambient sound"
                  onClick={() => setSettings((old) => ({ ...old, sound: !old.sound }))}
                >
                  <span />
                </button>
              </div>
              <div className="settings-row">
                <div>
                  <strong>A quieter pace</strong>
                  <p>Reduced motion and turn-based minigame controls.</p>
                </div>
                <button
                  className={`toggle ${settings.reducedMotion ? 'on' : ''}`}
                  role="switch"
                  aria-checked={settings.reducedMotion}
                  aria-label="Reduced motion"
                  onClick={() =>
                    setSettings((old) => ({ ...old, reducedMotion: !old.reducedMotion }))
                  }
                >
                  <span />
                </button>
              </div>
              <div className="divider" />
              <h3>Keep your story</h3>
              <p className="setup-intro" style={{ marginTop: 12 }}>
                Your journey saves on this browser after each action. Export a copy to keep it safe
                or carry it to another device.
              </p>
              <div className="button-row">
                <button
                  className="button"
                  disabled={welcome}
                  onClick={() => engine.current && downloadSave(engine.current.save())}
                >
                  <Download size={16} />
                  Export journey
                </button>
                <button className="button secondary" onClick={() => fileInput.current?.click()}>
                  <Upload size={16} />
                  Import journey
                </button>
              </div>
              <input
                className="sr-only"
                ref={fileInput}
                type="file"
                accept=".json,application/json"
                aria-label="Choose journey save"
                onChange={(event) => void importSave(event.target.files?.[0])}
              />
              <div className="divider" />
              <p className="small muted">
                Keyboard: Enter travel · C camp · J journal · M map · P party · S supplies · R pace
                & rest. Escape closes a panel. Minigames include their own controls.
              </p>
              <div className="divider" />
              <button className="text-button" onClick={() => open('setup')}>
                Start a new journey
                <ArrowRight size={14} />
              </button>
            </>
          ) : panel === 'hunt' && view.active_minigame ? (
            <>
              <ActivityScene
                mode={view.active_minigame.kind === 'Hunt' ? 'hunt' : 'river'}
                view={view}
                reducedMotion={settings.reducedMotion}
              />
              <Minigame controller={minigameController} reducedMotion={settings.reducedMotion} />
            </>
          ) : (
            <GamePanels
              key={panel}
              panel={panel}
              view={view}
              command={command}
              open={open}
              reducedMotion={settings.reducedMotion}
              outcomes={outcomes}
            />
          )}
          {panel === 'map' && status === 'AwaitingFork' && !view.pending_event && (
            <>
              <div className="divider" />
              <h3>Choose your way forward</h3>
              <div className="choice-list">
                {view.routes.map((route) => (
                  <button
                    className="choice"
                    key={route.id}
                    disabled={route.available === false}
                    onClick={() => {
                      const result = command({ ChooseRoute: { route_id: route.id } })
                      if (result && !isRejected(result.outcomes) && !result.view.active_minigame)
                        setPanel(null)
                    }}
                  >
                    <span>
                      <strong>{route.label}</strong>
                      <small>
                        {route.distance_miles} miles toward {placeName(view, route.target_id)}
                        {route.available === false
                          ? ' · Unavailable in this era or with these supplies'
                          : ''}
                      </small>
                    </span>
                    <ArrowRight size={19} />
                  </button>
                ))}
              </div>
            </>
          )}
          {panel === 'repair' && view.pending_event && (
            <button className="text-button" style={{ marginTop: 18 }} onClick={() => open('event')}>
              See the other choices
              <ArrowRight size={14} />
            </button>
          )}
          {lastMessages.length > 0 &&
            !['setup', 'talk', 'fish', 'forage', 'journal', 'hunt'].includes(panel) && (
              <div className="live-report" role="status">
                {lastMessages.map((message, index) => (
                  <p key={index}>{message}</p>
                ))}
              </div>
            )}
        </Dialog>
      )}
    </div>
  )
}
