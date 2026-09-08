import { useEffect, useRef, useState } from 'react'
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  Check,
  ChevronRight,
  Compass,
  Crosshair,
  Download,
  Fish,
  Flag,
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
import {
  describeOutcome,
  humanize,
  isRejected,
  money,
  phase,
  placeName,
  trailFor,
} from './presentation'
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
  const goal = trail?.nodes.find((node) => node.id === trail.goal_node_id)
  const progress = goal ? Math.min(100, (view.miles / goal.mile) * 100) : 0
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
  const latestJournal =
    view.journal.at(-1)?.text ?? '“There is a kind of hope you can only find on the open road.”'
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
    <div className={`app-shell ${settings.reducedMotion ? 'reduced-motion' : ''}`}>
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
        <div className="side-journey">
          <span className="eyebrow" style={{ fontSize: 8, letterSpacing: 1.5 }}>
            TAKE THE LONG WAY HOME
          </span>
          <blockquote>
            “Not all who wander
            <br />
            are lost. Some are
            <br />
            building a new life.”
          </blockquote>
          <div className="side-foot">
            <span>EST. {view.date.year}</span>
            <button
              className="icon-button"
              aria-label="Open settings"
              onClick={() => open('settings')}
            >
              <SettingsIcon size={17} strokeWidth={1.4} />
            </button>
          </div>
        </div>
      </aside>
      <main className="app-main">
        <header className="topbar">
          <div className="breadcrumb">
            <span>Your journey</span>
            <ChevronRight size={12} />
            {trail?.name ?? 'The Oregon Trail'}
          </div>
          <div className="mobile-brand">
            <Mountain size={22} strokeWidth={1.2} />
            Pioneer Trail
          </div>
          <div className="topbar-right">
            <span className="saved-label">
              <i className="saved-dot" />
              {welcome
                ? 'A new adventure awaits'
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
          <div className="status-strip">
            {[
              {
                label: 'DISTANCE',
                value: welcome ? '0' : view.miles.toLocaleString(),
                unit: 'miles',
                icon: Compass,
              },
              {
                label: 'FOOD',
                value: welcome ? '—' : (view.inventory.food ?? 0).toLocaleString(),
                unit: 'lbs',
                icon: Sprout,
              },
              {
                label: 'PARTY HEALTH',
                value: welcome ? 'Ready' : `${health}%`,
                unit: welcome ? '' : health > 75 ? 'good' : health > 40 ? 'fair' : 'poor',
                icon: Heart,
              },
              {
                label: 'PROVISIONS',
                value: welcome ? '—' : money(view.cash_cents),
                unit: 'available',
                icon: Package,
              },
              {
                label: 'TRAVEL PACE',
                value: welcome ? 'Your call' : humanize(view.pace),
                unit: welcome ? '' : humanize(view.rations),
                icon: Wind,
              },
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
          <div className="lower-grid">
            <section>
              <div className="section-heading">
                <h3>Life along the trail</h3>
                <button className="text-button" onClick={() => open(welcome ? 'setup' : 'camp')}>
                  Explore camp
                  <ArrowRight size={12} />
                </button>
              </div>
              <div className="activity-grid">
                {actions.map((action) => (
                  <button
                    key={action.title}
                    className="activity-card"
                    onClick={() => {
                      if (welcome) open('setup')
                      else if (action.panel === 'hunt') {
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
                    <action.icon size={25} strokeWidth={1.3} />
                    <strong>{action.title}</strong>
                    <small>{action.sub}</small>
                    <span>{action.shortcut}</span>
                  </button>
                ))}
              </div>
              <div className="action-footer">
                <p>
                  {welcome
                    ? 'The little moments make the journey.'
                    : `${view.daily_food_lbs} lb of food per day. ${view.daily_food_lbs ? Math.floor((view.inventory.food ?? 0) / view.daily_food_lbs) : 0} days of meals in the wagon.`}
                </p>
                <button className="button" onClick={advance}>
                  {advanceLabel}
                  <ArrowRight size={15} />
                </button>
              </div>
              {!welcome && status === 'Travelling' && !view.pending_event && (
                <div className="button-row" style={{ marginTop: 14, justifyContent: 'flex-end' }}>
                  <button className="text-button muted" onClick={() => open('travel')}>
                    Pace & rest
                  </button>
                  <span className="muted">·</span>
                  <button
                    className="text-button"
                    onClick={() => {
                      setAuto((old) => !old)
                      setPanel(null)
                    }}
                  >
                    {auto ? 'Pause travel' : 'Travel automatically'}
                  </button>
                </div>
              )}
              <div className="journal-preview">
                <BookOpen size={21} strokeWidth={1.2} />
                <div>
                  <span className="eyebrow">
                    {welcome ? 'A NOTE FOR THE ROAD' : 'FROM YOUR FIELD JOURNAL'}
                  </span>
                  <p>{latestJournal}</p>
                </div>
              </div>
            </section>
            <section>
              <div className="section-heading">
                <h3>The way ahead</h3>
                <button className="text-button" onClick={() => open(welcome ? 'setup' : 'map')}>
                  View map
                  <ArrowRight size={12} />
                </button>
              </div>
              <div className="route-card">
                <span className="eyebrow" style={{ color: '#788868', fontSize: 9 }}>
                  NEXT ON THE HORIZON
                </span>
                <div className="next-stop">{welcome ? 'Kansas River Crossing' : nextStop}</div>
                <div className="route-endpoints">
                  <span>{welcome ? 'Independence' : 'Your departure'}</span>
                  <Flag size={13} strokeWidth={1.2} />
                  <span>{goal?.name ?? 'Oregon'}</span>
                </div>
                <div className="route-line">
                  <span style={{ width: `${progress}%` }} />
                </div>
                <p>
                  {welcome
                    ? 'About 2,000 miles of possibility.'
                    : `${Math.round(progress)}% of the distance west · ${view.route_miles_remaining} miles to your next stop.`}
                  <br />
                  {welcome
                    ? 'One day, one decision, one memory at a time.'
                    : 'Take what you need. Leave room for a little hope.'}
                </p>
              </div>
              {!welcome && (
                <button
                  className="text-button muted"
                  style={{ marginTop: 17 }}
                  onClick={() => open('journal')}
                >
                  <BookOpen size={13} />
                  {view.journal.length} memories in your journal
                  <ArrowRight size={12} />
                </button>
              )}
            </section>
          </div>
          <footer className="page-footer">
            <span>
              <Mountain size={14} strokeWidth={1} />
              PIONEER TRAIL · THE JOURNEY IS THE STORY
            </span>
            <span>
              {welcome ? (
                'MADE FOR THE WANDERER IN YOU'
              ) : (
                <>
                  <Check size={11} />
                  {saved ? 'Saved locally' : 'Export to keep your journey'} · Seed {view.seed}
                </>
              )}
            </span>
          </footer>
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
          eyebrow={panel === 'setup' ? 'WRITE YOUR OWN STORY' : `${location} · DAY ${view.day + 1}`}
          onClose={closePanel}
          wide={['store', 'camp', 'setup', 'hunt'].includes(panel)}
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
