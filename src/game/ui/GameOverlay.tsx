import { useState } from 'react'
import { BookOpen, Heart, Mail, MapPin, Package, Users, Wrench } from 'lucide-react'
import type { GameCommand, GameView } from '../../engine-types'
import { humanize, money, phase } from '../../presentation'
import type { Overlay } from '../contracts'
import { Dialog } from '../../components/Dialog'
import { TrailMap } from '../../components/TrailMap'
import { OutfitOverlay } from './OutfitOverlay'

export interface OverlayProps {
  overlay: Exclude<Overlay, null>
  view: GameView
  onClose: () => void
  command: (command: GameCommand) => unknown
  onAction: (action: 'dismount') => void
  onNewJourney: () => void
  settings: React.ReactNode
  activity: {
    kind: string
    phase: string
    hint: string
    progress: number
    shots?: number
    tension?: number
  } | null
}

const title: Record<Exclude<Overlay, null>, string> = {
  pause: 'Paused',
  map: 'Trail map',
  journal: 'Field journal',
  inventory: 'Wagon and supplies',
  party: 'Your party',
  settings: 'Settings',
  camp: 'Camp',
  trader: 'Trade',
  dialogue: 'Conversation',
  river: 'River crossing',
  encounter: 'Trail moment',
  route: 'Choose the trail',
  ending: 'Journey complete',
}

export function GameOverlay(props: OverlayProps) {
  const { overlay, view, onClose, command } = props
  const wide = overlay === 'map' || overlay === 'inventory' || overlay === 'route'
  return (
    <Dialog
      title={title[overlay]}
      eyebrow={overlay === 'pause' ? 'Pioneer Trail' : `Day ${view.day + 1}`}
      wide={wide}
      onClose={onClose}
    >
      {overlay === 'pause' && <Pause onClose={onClose} />}
      {overlay === 'map' && <TrailMap view={view} />}
      {overlay === 'journal' && <Journal view={view} />}
      {overlay === 'inventory' && <Inventory view={view} />}
      {overlay === 'party' && <Party view={view} command={command} />}
      {overlay === 'settings' && props.settings}
      {overlay === 'camp' && <Camp view={view} command={command} activity={props.activity} />}
      {overlay === 'trader' && <Trader view={view} command={command} />}
      {overlay === 'dialogue' && <Conversation view={view} command={command} />}
      {overlay === 'river' && <River view={view} command={command} onAction={props.onAction} />}
      {overlay === 'encounter' && <Encounter view={view} command={command} />}
      {overlay === 'route' && <Route view={view} command={command} />}
      {overlay === 'ending' && <Ending view={view} onNewJourney={props.onNewJourney} />}
      {overlay === 'inventory' && phase(view) === 'Outfitting' && (
        <OutfitOverlay view={view} command={command} />
      )}
    </Dialog>
  )
}

function Pause({ onClose }: { onClose: () => void }) {
  return (
    <div className="pause-overlay">
      <p className="overlay-lede">The wagon and world are held safely in place.</p>
      <button className="primary-action" onClick={onClose}>
        Return to the trail
      </button>
      <p className="key-hint">
        Esc closes menus · WASD moves · E interacts · Enter reopens decisions · O settings
      </p>
    </div>
  )
}
function Journal({ view }: { view: GameView }) {
  return view.journal.length ? (
    <ol className="journal-list">
      {view.journal.toReversed().map((entry, index) => (
        <li key={index}>
          <span>
            Day {entry.day + 1} · {entry.miles.toLocaleString()} mi
          </span>
          <p>{entry.text}</p>
        </li>
      ))}
    </ol>
  ) : (
    <Empty icon={BookOpen} text="The first entry waits for a mile worth remembering." />
  )
}
function Inventory({ view }: { view: GameView }) {
  return (
    <>
      <div className="resource-strip">
        <Metric label="Cash" value={money(view.cash_cents)} />
        <Metric label="Load" value={`${view.weight_lbs.toLocaleString()} lb`} />
        <Metric label="Food" value={`${view.inventory.food ?? 0} lb`} />
      </div>
      <ul className="inventory-list">
        {Object.entries(view.inventory)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([id, amount]) => (
            <li key={id}>
              <Package size={16} />
              <span>{humanize(id)}</span>
              <strong>{amount.toLocaleString()}</strong>
            </li>
          ))}
      </ul>
    </>
  )
}
function Party({ view, command }: { view: GameView; command: (command: GameCommand) => void }) {
  return (
    <ul className="party-list">
      {view.party.map((member, index) => (
        <li key={`${member.name}-${index}`}>
          <div className="portrait">{member.name[0]}</div>
          <div>
            <strong>{member.name}</strong>
            <span>
              {member.alive
                ? `${member.health}% health · ${member.morale} morale`
                : 'Remembered on the trail'}
            </span>
            {member.alive && member.ailments.length > 0 ? (
              <div className="ailments">
                {member.ailments.map((ailment) => (
                  <button
                    key={ailment}
                    onClick={() => command({ Treat: { member_index: index, ailment_id: ailment } })}
                  >
                    <Heart size={14} /> Treat {humanize(ailment)}
                  </button>
                ))}
              </div>
            ) : (
              <small>{member.alive ? 'Healthy and traveling.' : ''}</small>
            )}
            {member.npc_id && member.alive ? (
              <button
                className="quiet-action"
                onClick={() => command({ DismissNpc: { npc_id: String(member.npc_id) } })}
              >
                Part ways
              </button>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  )
}
function Camp({
  view,
  command,
  activity,
}: {
  view: GameView
  command: (command: GameCommand) => void
  activity: OverlayProps['activity']
}) {
  return (
    <>
      <p className="overlay-lede">Rest, mend gear, and tend the people who brought you this far.</p>
      {activity && (
        <div className="activity-status">
          <strong>{humanize(activity.kind)}</strong>
          <span>{activity.hint}</span>
        </div>
      )}
      <div className="camp-settings">
        <label>
          Pace
          <select
            value={view.pace}
            onChange={(event) =>
              command({ SetPace: event.target.value as 'Steady' | 'Strenuous' | 'Grueling' })
            }
          >
            <option value="Steady">Steady</option>
            <option value="Strenuous">Strenuous</option>
            <option value="Grueling">Grueling</option>
          </select>
        </label>
        <label>
          Rations
          <select
            value={view.rations}
            onChange={(event) =>
              command({ SetRations: event.target.value as 'Filling' | 'Meager' | 'BareBones' })
            }
          >
            <option value="Filling">Filling</option>
            <option value="Meager">Meager</option>
            <option value="BareBones">Bare bones</option>
          </select>
        </label>
      </div>
      <div className="action-grid">
        <button onClick={() => command({ Rest: { days: 1 } })}>Rest one day</button>
        <button onClick={() => command({ Rest: { days: 3 } })}>Rest three days</button>
        <button disabled={!view.can_repair} onClick={() => command('Repair')}>
          <Wrench size={17} /> Repair wagon
        </button>
        <button disabled={!view.can_hunt} onClick={() => command('BeginHunt')}>
          Hunt nearby
        </button>
        <button disabled={!view.can_fish} onClick={() => command('Fish')}>
          Fish the water
        </button>
        <button onClick={() => command('Forage')}>Forage</button>
        {phase(view) === 'AtLandmark' && (
          <button onClick={() => command('Continue')}>Continue journey</button>
        )}
      </div>
    </>
  )
}
function Trader({ view, command }: { view: GameView; command: (command: GameCommand) => void }) {
  const [amount, setAmount] = useState(1)
  const [partnerId, setPartnerId] = useState('')
  const [offeredItem, setOfferedItem] = useState('')
  const [offeredQuantity, setOfferedQuantity] = useState(1)
  const [wantedItem, setWantedItem] = useState('food')
  const [wantedQuantity, setWantedQuantity] = useState(20)
  const partners = view.npcs as Array<{
    id: string
    name?: string
    inventory?: Record<string, number>
  }>
  const npc = partners.find((candidate) => candidate.id === partnerId) ?? partners[0]
  const ownedItems = view.items.filter((item) => (view.inventory[item.id] ?? 0) > 0)
  const offerId = ownedItems.some((item) => item.id === offeredItem)
    ? offeredItem
    : (ownedItems[0]?.id ?? '')
  const wanted = view.items.some((item) => item.id === wantedItem) ? wantedItem : 'food'
  const counteroffer = view.pending_counteroffer
  return (
    <>
      <p className="overlay-lede">
        Prices and stock are set by this stop. Your wagon cannot carry more than it can bear.
      </p>
      <label className="inline-field">
        Quantity{' '}
        <input
          type="number"
          min={1}
          value={amount}
          onChange={(event) => setAmount(Math.max(1, Number(event.target.value) || 1))}
        />
      </label>
      <ul className="trade-list">
        {view.items.map((item) => (
          <li key={item.id}>
            <div>
              <strong>{item.name}</strong>
              <span>
                {view.inventory[item.id] ?? 0} aboard ·{' '}
                {item.price_cents === null ? 'not sold here' : money(item.price_cents)}
              </span>
            </div>
            <div>
              <button
                disabled={item.price_cents === null || !view.can_shop}
                onClick={() => command({ Buy: { item_id: item.id, quantity: amount } })}
              >
                Buy
              </button>
              <button
                disabled={item.sell_price_cents === null || (view.inventory[item.id] ?? 0) < amount}
                onClick={() => command({ Sell: { item_id: item.id, quantity: amount } })}
              >
                Sell
              </button>
            </div>
          </li>
        ))}
      </ul>
      {npc ? (
        <div className="barter-box">
          <label className="inline-field">
            Trading partner
            <select value={npc.id} onChange={(event) => setPartnerId(event.target.value)}>
              {partners.map((partner) => (
                <option key={partner.id} value={partner.id}>
                  {partner.name ?? 'Traveler'}
                </option>
              ))}
            </select>
          </label>
          <p className="barter-stock">
            {npc.name ?? 'This traveler'} carries{' '}
            {Object.entries(npc.inventory ?? {})
              .filter(([, quantity]) => quantity > 0)
              .map(([id, quantity]) => `${quantity} ${humanize(id)}`)
              .join(' · ') || 'no listed stock'}
            .
          </p>
          <div className="barter-fields">
            <label className="inline-field">
              You offer
              <select value={offerId} onChange={(event) => setOfferedItem(event.target.value)}>
                {ownedItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} · {view.inventory[item.id] ?? 0} owned
                  </option>
                ))}
              </select>
            </label>
            <label className="inline-field">
              Offer quantity
              <input
                type="number"
                min={1}
                max={view.inventory[offerId] ?? 1}
                value={offeredQuantity}
                onChange={(event) =>
                  setOfferedQuantity(
                    Math.max(
                      1,
                      Math.min(
                        view.inventory[offerId] ?? 1,
                        Math.floor(Number(event.target.value) || 1),
                      ),
                    ),
                  )
                }
              />
            </label>
            <label className="inline-field">
              You request
              <select value={wanted} onChange={(event) => setWantedItem(event.target.value)}>
                {view.items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} · {npc.inventory?.[item.id] ?? 0} available
                  </option>
                ))}
              </select>
            </label>
            <label className="inline-field">
              Request quantity
              <input
                type="number"
                min={1}
                value={wantedQuantity}
                onChange={(event) =>
                  setWantedQuantity(Math.max(1, Math.floor(Number(event.target.value) || 1)))
                }
              />
            </label>
          </div>
          <div className="dialog-actions">
            <button
              disabled={!offerId || (view.inventory[offerId] ?? 0) < offeredQuantity}
              onClick={() =>
                command({
                  Barter: {
                    npc_id: npc.id,
                    offered_item: offerId,
                    offered_quantity: offeredQuantity,
                    wanted_item: wanted,
                    wanted_quantity: wantedQuantity,
                  },
                })
              }
            >
              Propose trade
            </button>
            <button
              disabled={
                view.available_party_slots === 0 ||
                view.party.some((member) => member.npc_id === npc.id)
              }
              onClick={() => command({ InviteNpc: { npc_id: npc.id } })}
            >
              Invite {npc.name ?? 'traveler'}
            </button>
          </div>
          {counteroffer && (
            <div className="counteroffer">
              <strong>Counteroffer</strong>
              <p>
                Give {counteroffer.offered_quantity} {humanize(counteroffer.offered_item)} for{' '}
                {counteroffer.wanted_quantity} {humanize(counteroffer.wanted_item)}.
              </p>
              <button
                disabled={counteroffer.npc_id !== npc.id}
                onClick={() => command({ AcceptCounteroffer: counteroffer })}
              >
                Accept counteroffer
              </button>
            </div>
          )}
        </div>
      ) : (
        <Empty icon={Users} text="No neighboring travelers are available to trade." />
      )}
    </>
  )
}
function Conversation({
  view,
  command,
}: {
  view: GameView
  command: (command: GameCommand) => unknown
}) {
  const [speaker, setSpeaker] = useState(view.speakers[0]?.id ?? '')
  const [reply, setReply] = useState<string | null>(null)
  const person = view.speakers.find((candidate) => candidate.id === speaker)
  const letter = view.offered_letter
  const activeLetter = view.active_letter as { text?: string; recipient?: string } | null
  return (
    <>
      {view.speakers.length ? (
        <>
          <label className="inline-field">
            Speak with{' '}
            <select value={speaker} onChange={(event) => setSpeaker(event.target.value)}>
              {view.speakers.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.name}
                </option>
              ))}
            </select>
          </label>
          {reply && <p className="conversation-reply">{reply}</p>}
          <div className="action-grid">
            {(['Route', 'Supplies', 'News'] as const).map((topic) => (
              <button
                key={topic}
                onClick={() => {
                  if (!person) return
                  const result = command({ Converse: { speaker_id: person.id, topic } }) as {
                    outcomes?: unknown[]
                  }
                  const conversation = result?.outcomes?.find(
                    (outcome): outcome is { Conversation: { lines?: string[] } } =>
                      typeof outcome === 'object' && outcome !== null && 'Conversation' in outcome,
                  )
                  if (conversation) setReply(conversation.Conversation.lines?.join(' ') ?? null)
                }}
              >
                {topic}
              </button>
            ))}
          </div>
        </>
      ) : (
        <Empty icon={Users} text="No fellow travelers are within speaking distance." />
      )}
      {letter && (
        <div className="letter">
          <Mail size={18} />
          <p>
            {letter.text} Carry this letter for {letter.recipient}; delivery earns{' '}
            {money(letter.reward_cents)}.
          </p>
          <button onClick={() => command({ AcceptLetter: { letter_id: letter.id } })}>
            Carry it
          </button>
          <button onClick={() => command({ DeclineLetter: { letter_id: letter.id } })}>
            Leave it
          </button>
        </div>
      )}
      {activeLetter && (
        <div className="letter">
          <Mail size={18} />
          <p>
            {activeLetter.text ??
              `A letter remains in your care for ${activeLetter.recipient ?? 'its recipient'}.`}
          </p>
          {view.can_deliver_letter && (
            <button onClick={() => command('DeliverLetter')}>Deliver letter</button>
          )}
        </div>
      )}
    </>
  )
}
function River({
  view,
  command,
  onAction,
}: {
  view: GameView
  command: (command: GameCommand) => void
  onAction: (action: 'dismount') => void
}) {
  const river = view.river
  if (!river) return <Empty icon={MapPin} text="The crossing is no longer ahead." />
  return (
    <>
      <div className="resource-strip">
        <Metric label="Width" value={`${river.width_feet} ft`} />
        <Metric
          label="Depth"
          value={river.depth_feet === null ? 'Unknown' : `${river.depth_feet} ft`}
        />
        <Metric label="Weather" value={humanize(view.weather)} />
      </div>
      <p className="overlay-lede">
        Choose a method, then take control of the crossing in the world.
      </p>
      <p className="river-current">
        Current: about 0.8 m/s sideways in this compressed crossing. Keep steering into the flow.
      </p>
      <div className="river-options">
        {(['Ford', 'Caulk', 'Ferry', 'Guide', 'Wait'] as const).map((method) => {
          const risk = river.risks[method]
          return (
            <button
              key={method}
              onClick={() => command({ CrossRiver: { method } })}
              disabled={
                (method === 'Ferry' &&
                  (river.ferry_cost_cents === null || view.cash_cents < river.ferry_cost_cents)) ||
                (method === 'Guide' &&
                  (view.current_node?.id !== 'snake_river' ||
                    (view.inventory.clothing ?? 0) < river.guide_cost_clothing))
              }
            >
              <strong>{method === 'Caulk' ? 'Caulk and float' : method}</strong>
              <span>
                {method === 'Guide' && view.current_node?.id !== 'snake_river'
                  ? 'No guide at this crossing'
                  : method === 'Ferry' && river.ferry_cost_cents !== null
                    ? money(river.ferry_cost_cents)
                    : method === 'Wait'
                      ? 'Costs one day'
                      : risk === null || risk === undefined
                        ? 'Conditions determine the risk'
                        : `${method === 'Guide' ? `${river.guide_cost_clothing} clothing · ` : ''}One day · ${5 + Math.floor(risk / 5)} lb cargo per collision`}
              </span>
            </button>
          )
        })}
      </div>
      {phase(view) === 'AwaitingRiver' && (
        <button className="quiet-action" onClick={() => onAction('dismount')}>
          Get down and look around
        </button>
      )}
    </>
  )
}
function Encounter({ view, command }: { view: GameView; command: (command: GameCommand) => void }) {
  return view.pending_event ? (
    <>
      <p className="event-copy">{view.pending_event.text}</p>
      <div className="action-grid">
        {view.pending_event.choices.map((choice) => (
          <button
            key={choice.id}
            disabled={!choice.available}
            onClick={() =>
              command({ Respond: { event_id: view.pending_event!.id, choice_id: choice.id } })
            }
          >
            {choice.label}
          </button>
        ))}
      </div>
    </>
  ) : (
    <Empty icon={MapPin} text="The moment has passed." />
  )
}
function Route({ view, command }: { view: GameView; command: (command: GameCommand) => void }) {
  return (
    <div className="route-list">
      {view.routes.map((route) => (
        <button
          key={route.id}
          disabled={route.available === false}
          onClick={() => command({ ChooseRoute: { route_id: route.id } })}
        >
          <strong>{route.label}</strong>
          <span>{route.distance_miles} miles</span>
        </button>
      ))}
    </div>
  )
}
function Ending({ view, onNewJourney }: { view: GameView; onNewJourney: () => void }) {
  return (
    <div className="ending">
      <MapPin size={28} />
      <p>
        {phase(view) === 'Arrived'
          ? 'Your party reached the end of this chapter.'
          : 'The trail has come to an end for this party.'}
      </p>
      <strong>Score {view.score.toLocaleString()}</strong>
      <button className="primary-action" onClick={onNewJourney}>
        New journey
      </button>
    </div>
  )
}
function Empty({ icon: Icon, text }: { icon: typeof MapPin; text: string }) {
  return (
    <div className="empty-state">
      <Icon size={27} />
      <p>{text}</p>
    </div>
  )
}
function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}
