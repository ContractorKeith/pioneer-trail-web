import { useState } from 'react'
import {
  ArrowRight,
  Tent,
  Moon,
  MessageCircle,
  Fish,
  Crosshair,
  Sprout,
  Wrench,
  Heart,
  Package,
  Flag,
  Mail,
  Compass,
  Waves,
} from 'lucide-react'
import type { EngineResult, GameCommand, GameView, Outcome } from '../engine-types'
import { humanize, money, phase, placeName } from '../presentation'
import { TrailScene } from './TrailScene'
import { TrailMap } from './TrailMap'
import type { SceneMode } from './TrailScene'

export type Panel =
  | 'setup'
  | 'store'
  | 'party'
  | 'journal'
  | 'map'
  | 'camp'
  | 'travel'
  | 'talk'
  | 'fish'
  | 'forage'
  | 'river'
  | 'event'
  | 'repair'
  | 'letter'
  | 'settings'
  | 'ending'
  | 'hunt'
  | 'trade'
export const panelTitles: Record<Panel, string> = {
  setup: 'Every journey starts somewhere.',
  store: 'The wagon & provisions',
  party: 'The people beside you',
  journal: 'Your field journal',
  map: 'The road to a new life',
  camp: 'A little shelter. A little rest.',
  travel: 'Set the pace',
  talk: 'Stories by the wayside',
  fish: 'A line in the water',
  forage: 'What the land provides',
  river: 'The water ahead',
  event: 'A moment on the trail',
  repair: 'Keep the wheels turning',
  letter: 'A letter carried west',
  settings: 'Make yourself at home',
  ending: 'The end of this chapter',
  hunt: 'Into the wild',
  trade: 'Trade along the trail',
}
export interface PanelProps {
  view: GameView
  command: (command: GameCommand) => EngineResult | undefined
  open: (panel: Panel) => void
  reducedMotion: boolean
  outcomes: Outcome[]
}

export function ActivityScene({
  mode,
  view,
  reducedMotion,
}: {
  mode: SceneMode
  view: GameView
  reducedMotion: boolean
}) {
  return (
    <div className="dialog-scene">
      <TrailScene
        mode={mode}
        weather={view.weather}
        terrain={view.terrain}
        reducedMotion={reducedMotion}
        className="scene-layer"
      />
    </div>
  )
}

export function GamePanels({
  view,
  command,
  open,
  reducedMotion,
  outcomes,
  panel,
}: PanelProps & { panel: Panel }) {
  const [days, setDays] = useState(1)
  const [speaker, setSpeaker] = useState(view.speakers[0]?.id ?? '')
  const [tradeItem, setTradeItem] = useState('clothing')
  const [tradeAmount, setTradeAmount] = useState(1)
  const [wantedAmount, setWantedAmount] = useState(20)
  const [npcId, setNpcId] = useState('')
  const activeSpeaker = view.speakers.find((item) => item.id === speaker) ?? view.speakers[0]
  const conversation = outcomes.find(
    (outcome) => typeof outcome === 'object' && 'Conversation' in outcome,
  ) as { Conversation: { speaker_name: string; lines: string[]; favor: string | null } } | undefined
  const gathered = outcomes.find(
    (outcome) => typeof outcome === 'object' && 'Gathered' in outcome,
  ) as { Gathered: { food_lbs: number; net_food_lbs: number; days: number } } | undefined
  const commandDisabled = !view.can_camp || !!view.pending_event || !!view.active_minigame
  const scene = (mode: SceneMode) => (
    <ActivityScene mode={mode} view={view} reducedMotion={reducedMotion} />
  )

  switch (panel) {
    case 'camp':
      return (
        <>
          {scene('camp')}
          <p className="setup-intro">
            Let the oxen graze. Share the fire. Take care of the people making this journey with
            you. Looking around camp costs no time.
          </p>
          <div className="activity-grid">
            {[
              { name: 'Rest', sub: 'Restore your strength', icon: Moon, panel: 'travel' },
              { name: 'Your party', sub: 'Health & treatment', icon: Heart, panel: 'party' },
              { name: 'Talk', sub: 'Meet your neighbors', icon: MessageCircle, panel: 'talk' },
              { name: 'Provisions', sub: 'Look in your wagon', icon: Package, panel: 'store' },
              { name: 'Hunt', sub: '30-second activity', icon: Crosshair, panel: 'hunt' },
              {
                name: 'Fish',
                sub: view.can_fish ? 'Along the riverbank' : 'Find a river valley',
                icon: Fish,
                panel: 'fish',
              },
              { name: 'Forage', sub: 'Search for wild food', icon: Sprout, panel: 'forage' },
              { name: 'Trade', sub: 'With other travelers', icon: Package, panel: 'trade' },
            ].map((item) => (
              <button
                className="activity-card"
                key={item.name}
                onClick={() =>
                  item.panel === 'hunt' ? command('BeginHunt') : open(item.panel as Panel)
                }
                disabled={
                  item.panel === 'hunt'
                    ? !view.can_hunt
                    : item.panel === 'fish'
                      ? !view.can_fish
                      : false
                }
              >
                <item.icon size={23} />
                <strong>{item.name}</strong>
                <small>{item.sub}</small>
              </button>
            ))}
          </div>
          {view.offered_letter || view.active_letter ? (
            <button
              className="choice"
              style={{ width: '100%', marginTop: 18 }}
              onClick={() => open('letter')}
            >
              <span>
                <strong>A letter is waiting</strong>
                <small>Some things are worth carrying a little farther.</small>
              </span>
              <Mail size={22} />
            </button>
          ) : null}
        </>
      )
    case 'travel':
      return (
        <>
          <p className="setup-intro">
            Every mile has a cost. Choose a rhythm your people and oxen can sustain.
          </p>
          <div className="form-grid">
            <label className="field">
              <span>Travel pace</span>
              <select
                value={view.pace}
                disabled={commandDisabled}
                onChange={(event) =>
                  command({ SetPace: event.target.value as 'Steady' | 'Strenuous' | 'Grueling' })
                }
              >
                <option value="Steady">Steady · easier on the party</option>
                <option value="Strenuous">Strenuous · cover more ground</option>
                <option value="Grueling">Grueling · push your limits</option>
              </select>
            </label>
            <label className="field">
              <span>Daily rations</span>
              <select
                value={view.rations}
                disabled={commandDisabled}
                onChange={(event) =>
                  command({ SetRations: event.target.value as 'Filling' | 'Meager' | 'BareBones' })
                }
              >
                <option value="Filling">Filling · 3 lb per person</option>
                <option value="Meager">Meager · 2 lb per person</option>
                <option value="BareBones">Bare bones · 1 lb per person</option>
              </select>
            </label>
          </div>
          <div className="divider" />
          <h3>Take a little time</h3>
          <p className="small muted" style={{ margin: '10px 0 20px' }}>
            Rest may restore health. Your party still eats, and illness can progress while camped.
          </p>
          <div className="button-row">
            {[1, 3, 5].map((days) => (
              <button
                className="button secondary"
                key={days}
                disabled={commandDisabled}
                onClick={() => command({ Rest: { days } })}
              >
                <Moon size={15} />
                Rest {days} day{days > 1 ? 's' : ''}
              </button>
            ))}
          </div>
          <p className="note" style={{ marginTop: 20 }}>
            Current food use: {view.daily_food_lbs} lb each day. Weather, terrain, fatigue and
            health all affect the journey.
          </p>
        </>
      )
    case 'party':
      return (
        <>
          <p className="setup-intro">
            The trail is measured in people as much as miles. Keep everyone fed, rested and cared
            for.
          </p>
          <div className="party-list">
            {view.party.map((member, index) => (
              <div className="party-member" key={`${member.name}-${index}`}>
                <div className="avatar">{member.name.slice(0, 1)}</div>
                <div className="party-detail">
                  <div className="party-title">
                    <strong>{member.name}</strong>
                    <span>
                      {member.alive
                        ? `${member.health}% health · ${member.morale} morale`
                        : 'Remembered in your journal'}
                    </span>
                  </div>
                  <div className="health-bar">
                    <span style={{ width: `${member.health}%` }} />
                  </div>
                  <p className="small">
                    {member.alive
                      ? member.ailments.length
                        ? member.ailments.map(humanize).join(', ')
                        : 'Healthy. Ready for the road ahead.'
                      : 'Their journey ended here.'}
                  </p>
                  {member.alive &&
                    member.ailments.map((ailment) => (
                      <button
                        className="button secondary"
                        key={ailment}
                        disabled={commandDisabled}
                        onClick={() =>
                          command({ Treat: { member_index: index, ailment_id: ailment } })
                        }
                      >
                        <Heart size={13} />
                        Treat {humanize(ailment)}
                      </button>
                    ))}
                  {member.npc_id && member.alive ? (
                    <button
                      className="text-button"
                      style={{ marginTop: 9 }}
                      disabled={commandDisabled}
                      onClick={() => command({ DismissNpc: { npc_id: String(member.npc_id) } })}
                    >
                      Part ways
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
          <p className="note" style={{ marginTop: 20 }}>
            {view.inventory.medicine ?? 0} medicine kits in your wagon. Treatment uses medicine or
            an eligible living medic.
          </p>
        </>
      )
    case 'journal':
      return (
        <>
          {view.journal.length ? (
            <div className="journal-list">
              {view.journal.toReversed().map((entry, index) => (
                <article className="journal-entry" key={index}>
                  <span className="eyebrow">
                    Day {entry.day + 1} · Mile {entry.miles.toLocaleString()}
                  </span>
                  <p>{entry.text}</p>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty">
              <h3>A blank page. An open road.</h3>
              <p style={{ marginTop: 12 }}>
                Your milestones, friendships and memories will be recorded here as your journey
                unfolds.
              </p>
            </div>
          )}
        </>
      )
    case 'map':
      return <TrailMap view={view} />
    case 'talk':
      return (
        <>
          {scene('talk')}
          {view.speakers.length ? (
            <>
              <label className="field">
                <span>Pull up a seat with</span>
                <select
                  value={activeSpeaker?.id}
                  onChange={(event) => setSpeaker(event.target.value)}
                >
                  {view.speakers.map((speaker) => (
                    <option key={speaker.id} value={speaker.id}>
                      {speaker.name} ·{' '}
                      {speaker.setting === 'Fort' ? 'at the fort' : 'neighboring wagon'}
                    </option>
                  ))}
                </select>
              </label>
              {conversation && (
                <div className="conversation-reply">
                  <span className="eyebrow" style={{ marginBottom: 12 }}>
                    {conversation.Conversation.speaker_name}
                  </span>
                  {conversation.Conversation.lines.map((line, index) => (
                    <p key={index}>{line}</p>
                  ))}
                  {conversation.Conversation.favor && <p>{conversation.Conversation.favor}</p>}
                </div>
              )}
              <div className="choice-list">
                {[
                  { topic: 'Route', text: 'What is the road like ahead?' },
                  { topic: 'Supplies', text: 'How are your supplies holding up?' },
                  { topic: 'News', text: 'Any news along the trail?' },
                ].map((item) => (
                  <button
                    key={item.topic}
                    className="choice"
                    onClick={() =>
                      command({
                        Converse: {
                          speaker_id: activeSpeaker.id,
                          topic: item.topic as 'Route' | 'Supplies' | 'News',
                        },
                      })
                    }
                  >
                    <strong>{item.text}</strong>
                    <MessageCircle size={17} />
                  </button>
                ))}
              </div>
              <p className="small muted" style={{ marginTop: 20 }}>
                Conversations cost no days. Familiar faces may remember you on another day.
              </p>
            </>
          ) : (
            <p className="empty">
              No one is close enough to talk right now. You may meet another wagon farther along the
              trail.
            </p>
          )}
        </>
      )
    case 'fish':
    case 'forage':
      return (
        <>
          {scene(panel === 'fish' ? 'fish' : 'camp')}
          <p className="setup-intro">
            {panel === 'fish'
              ? 'Cast into the current and wait for a silver flash. The river decides what comes home.'
              : 'Walk beyond the wagon tracks in search of berries, roots and anything the season offers.'}
          </p>
          {gathered && (
            <>
              <div className="gather-results">
                <div>
                  <strong>{gathered.Gathered.food_lbs} lb</strong>
                  <span>Brought back</span>
                </div>
                <div>
                  <strong>
                    {gathered.Gathered.net_food_lbs > 0 ? '+' : ''}
                    {gathered.Gathered.net_food_lbs} lb
                  </strong>
                  <span>After the party ate</span>
                </div>
                <div>
                  <strong>{gathered.Gathered.days}</strong>
                  <span>Days elapsed</span>
                </div>
              </div>
            </>
          )}
          <label className="field">
            <span>How long will you search?</span>
            <select value={days} onChange={(event) => setDays(Number(event.target.value))}>
              <option value={1}>A quick search · 1 day</option>
              <option value={3}>Take your time · up to 3 days</option>
            </select>
          </label>
          <p className="note" style={{ marginTop: 18 }}>
            Your party will eat {view.daily_food_lbs * days} lb over {days} day{days > 1 ? 's' : ''}
            . The haul may not cover your meals.{' '}
            {panel === 'fish' && !view.can_fish
              ? 'Fishing requires a river valley.'
              : 'Weather and your party’s condition continue to matter.'}
          </p>
          <button
            className="button full"
            style={{ marginTop: 20 }}
            disabled={commandDisabled || (panel === 'fish' && !view.can_fish)}
            onClick={() =>
              command(
                days === 1
                  ? panel === 'fish'
                    ? 'Fish'
                    : 'Forage'
                  : { Gather: { activity: panel === 'fish' ? 'Fish' : 'Forage', days } },
              )
            }
          >
            {panel === 'fish' ? <Fish size={18} /> : <Sprout size={18} />}
            {panel === 'fish' ? 'Cast your line' : 'Search for food'}
          </button>
        </>
      )
    case 'river':
      return (
        <>
          {scene('river')}
          {view.river && (
            <>
              <div className="store-summary">
                <div>
                  River width<strong>{view.river.width_feet} ft</strong>
                </div>
                <div>
                  Current depth<strong>{view.river.depth_feet} ft</strong>
                </div>
                <div>
                  Weather<strong style={{ fontSize: 18 }}>{humanize(view.weather)}</strong>
                </div>
              </div>
              <p className="small muted">
                Study the current. Each crossing method carries its own cost and risk.
              </p>
              <div className="choice-list">
                {(['Ford', 'Caulk', 'Ferry', 'Guide', 'Wait'] as const).map((method) => {
                  const river = view.river!
                  const unavailable =
                    method === 'Ferry'
                      ? river.ferry_cost_cents === null || view.cash_cents < river.ferry_cost_cents
                      : method === 'Guide'
                        ? view.current_node?.id !== 'snake_river' ||
                          (view.inventory.clothing ?? 0) < river.guide_cost_clothing
                        : false
                  const details =
                    method === 'Ferry'
                      ? river.ferry_cost_cents === null
                        ? 'No ferry operates here in this era'
                        : `${money(river.ferry_cost_cents)} · a safer passage`
                      : method === 'Guide'
                        ? `${river.guide_cost_clothing} clothing sets · available at the Snake River`
                        : method === 'Wait'
                          ? `Wait 1 day · the party still eats ${view.daily_food_lbs} lb`
                          : `${river.risks[method] ?? 0}% crossing loss risk · 1 day`
                  return (
                    <button
                      className="choice"
                      key={method}
                      disabled={
                        unavailable || phase(view) !== 'AwaitingRiver' || !!view.pending_event
                      }
                      onClick={() => command({ CrossRiver: { method } })}
                    >
                      <span>
                        <strong>
                          {
                            {
                              Ford: 'Ford the river',
                              Caulk: 'Caulk the wagon and float',
                              Ferry: 'Take the ferry',
                              Guide: 'Hire a local guide',
                              Wait: 'Wait for better conditions',
                            }[method]
                          }
                        </strong>
                        <small>{details}</small>
                      </span>
                      <Waves size={18} />
                    </button>
                  )
                })}
              </div>
            </>
          )}
        </>
      )
    case 'event':
      return (
        <>
          {view.pending_event ? (
            <>
              <p style={{ fontFamily: 'var(--serif)', fontSize: 28, lineHeight: 1.45 }}>
                {view.pending_event.text}
              </p>
              {view.can_repair && (
                <button
                  className="choice"
                  style={{ width: '100%', marginTop: 20 }}
                  onClick={() => open('repair')}
                >
                  <span>
                    <strong>Inspect and repair the wagon</strong>
                    <small>Use a spare part, tools or your party’s skills</small>
                  </span>
                  <Wrench size={20} />
                </button>
              )}
              <div className="choice-list">
                {view.pending_event.choices.map((choice) => (
                  <button
                    className="choice"
                    key={choice.id}
                    disabled={!choice.available}
                    onClick={() =>
                      command({
                        Respond: { event_id: view.pending_event!.id, choice_id: choice.id },
                      })
                    }
                  >
                    <span>
                      <strong>{choice.label}</strong>
                      {!choice.available && <small>Requirements not met</small>}
                    </span>
                    <ArrowRight size={17} />
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <p>The way is clear again.</p>
              <button className="button" onClick={() => open('camp')}>
                Return to camp
              </button>
            </>
          )}
        </>
      )
    case 'repair':
      return (
        <>
          {scene('repair')}
          <p className="setup-intro">
            Kneel beside the wagon. Inspect the damaged wood, fit a spare if you have one, and put
            your hands to work.
          </p>
          <div className="store-summary">
            {['wheel', 'axle', 'tongue', 'tools'].map((id) => (
              <div key={id}>
                {humanize(id)}
                <strong>{view.inventory[id] ?? 0}</strong>
              </div>
            ))}
          </div>
          <p className="note">
            A spare guarantees the repair. Without one, success depends on your tools, occupation
            and the party’s repair skills. Each attempt takes a day and uses food.
          </p>
          <button
            className="button full"
            style={{ marginTop: 20 }}
            disabled={!view.can_repair}
            onClick={() => command('Repair')}
          >
            <Wrench size={17} />
            Attempt the repair · 1 day
          </button>
          {!view.can_repair && (
            <p className="small muted" style={{ marginTop: 15 }}>
              No repair is available. Resolve the event’s other choices, or return to the trail if
              the wagon is sound.
            </p>
          )}
        </>
      )
    case 'letter': {
      const carried = view.active_letter as {
        recipient: string
        destination_id: string
        reward_cents: number
      } | null
      return (
        <>
          <Mail size={40} strokeWidth={1} style={{ marginBottom: 20, color: '#a28d62' }} />
          {carried ? (
            <>
              <h3>For {carried.recipient}</h3>
              <p className="setup-intro" style={{ marginTop: 15 }}>
                Carry this sealed letter to {placeName(view, carried.destination_id)}. Delivery pays{' '}
                {money(carried.reward_cents)}.
              </p>
              <button
                className="button"
                disabled={!view.can_deliver_letter}
                onClick={() => command('DeliverLetter')}
              >
                Deliver the letter
                <ArrowRight size={16} />
              </button>
            </>
          ) : view.offered_letter ? (
            <>
              <p style={{ fontFamily: 'var(--serif)', fontSize: 26 }}>{view.offered_letter.text}</p>
              <p className="small muted" style={{ marginTop: 17 }}>
                For {view.offered_letter.recipient} at{' '}
                {placeName(view, view.offered_letter.destination_id)} ·{' '}
                {money(view.offered_letter.reward_cents)} on delivery.
              </p>
              <div className="button-row" style={{ marginTop: 24 }}>
                <button
                  className="button"
                  onClick={() => command({ AcceptLetter: { letter_id: view.offered_letter!.id } })}
                >
                  I’ll carry it
                </button>
                <button
                  className="button secondary"
                  onClick={() => command({ DeclineLetter: { letter_id: view.offered_letter!.id } })}
                >
                  Leave it for another traveler
                </button>
              </div>
            </>
          ) : (
            <p className="empty">No letter needs carrying right now.</p>
          )}
        </>
      )
    }
    case 'ending':
      return (
        <div className="ending">
          <Flag size={37} strokeWidth={1} />
          <h3>{phase(view) === 'Arrived' ? 'You made it west.' : 'The trail remembers.'}</h3>
          <p className="muted">
            {view.miles.toLocaleString()} miles. {view.day} days.{' '}
            {view.party.filter((person) => person.alive).length} travelers still beside you.
          </p>
          <div className="score">{view.score.toLocaleString()}</div>
          <span className="eyebrow">Your journey score</span>
          <div className="button-row" style={{ justifyContent: 'center', marginTop: 30 }}>
            <button className="button" onClick={() => open('journal')}>
              Read your journal
            </button>
            <button className="button secondary" onClick={() => open('setup')}>
              Begin another journey
            </button>
          </div>
        </div>
      )
    case 'trade': {
      const npcs = view.npcs as Array<{
        id: string
        name: string
        inventory: Record<string, number>
      }>
      const npc = npcs.find((person) => person.id === npcId) ?? npcs[0]
      return (
        <>
          {npc ? (
            <>
              <label className="field">
                <span>Trading partner</span>
                <select value={npc.id} onChange={(event) => setNpcId(event.target.value)}>
                  {npcs.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.name}
                    </option>
                  ))}
                </select>
              </label>
              <p className="small muted" style={{ margin: '15px 0' }}>
                Their food: {npc.inventory.food ?? 0} lb. They may accept, decline or propose a
                counteroffer.
              </p>
              <div className="form-grid">
                <label className="field">
                  <span>You offer</span>
                  <select value={tradeItem} onChange={(event) => setTradeItem(event.target.value)}>
                    {view.items.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} · {view.inventory[item.id] ?? 0} owned
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Quantity offered</span>
                  <input
                    type="number"
                    min={1}
                    value={tradeAmount}
                    onChange={(event) =>
                      setTradeAmount(Math.max(1, Math.floor(Number(event.target.value))))
                    }
                  />
                </label>
                <label className="field">
                  <span>Food requested (lb)</span>
                  <input
                    type="number"
                    min={1}
                    value={wantedAmount}
                    onChange={(event) =>
                      setWantedAmount(Math.max(1, Math.floor(Number(event.target.value))))
                    }
                  />
                </label>
              </div>
              <div className="button-row" style={{ marginTop: 20 }}>
                <button
                  className="button"
                  disabled={commandDisabled}
                  onClick={() =>
                    command({
                      Barter: {
                        npc_id: npc.id,
                        offered_item: tradeItem,
                        offered_quantity: tradeAmount,
                        wanted_item: 'food',
                        wanted_quantity: wantedAmount,
                      },
                    })
                  }
                >
                  Propose a trade
                </button>
                <button
                  className="button secondary"
                  disabled={
                    commandDisabled ||
                    view.available_party_slots === 0 ||
                    view.party.some((person) => person.npc_id === npc.id)
                  }
                  onClick={() => command({ InviteNpc: { npc_id: npc.id } })}
                >
                  Invite to your party
                </button>
              </div>
              {view.pending_counteroffer ? (
                <div className="note" style={{ marginTop: 18 }}>
                  <p>
                    Counteroffer: {view.pending_counteroffer.offered_quantity}{' '}
                    {humanize(view.pending_counteroffer.offered_item)} for{' '}
                    {view.pending_counteroffer.wanted_quantity}{' '}
                    {humanize(view.pending_counteroffer.wanted_item)}.
                  </p>
                  <button
                    className="button"
                    style={{ marginTop: 12 }}
                    onClick={() =>
                      command({
                        AcceptCounteroffer: {
                          npc_id: view.pending_counteroffer!.npc_id,
                          offered_item: view.pending_counteroffer!.offered_item,
                          offered_quantity: view.pending_counteroffer!.offered_quantity,
                          wanted_item: view.pending_counteroffer!.wanted_item,
                          wanted_quantity: view.pending_counteroffer!.wanted_quantity,
                        },
                      })
                    }
                  >
                    Accept this trade
                  </button>
                </div>
              ) : null}
            </>
          ) : (
            <p className="empty">There are no neighboring wagons here to trade with.</p>
          )}
        </>
      )
    }
    default:
      return (
        <div className="empty">
          <Tent size={30} />
          <p>A little further down the trail.</p>
          <Compass size={22} />
        </div>
      )
  }
}
