import type { GameView, Outcome } from './engine-types'

export const humanize = (value: string) =>
  value.replace(/([a-z])([A-Z])/g, '$1 $2').replaceAll('_', ' ')
export const money = (cents: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: cents % 100 ? 2 : 0,
  }).format(cents / 100)
export const phase = (view: GameView) =>
  typeof view.status === 'string' ? view.status : Object.keys(view.status)[0]
export const trailFor = (view: GameView) =>
  view.content.trails.find((trail) => trail.id === view.trail_id) ?? view.content.trails[0]
export const placeName = (view: GameView, id: string) =>
  trailFor(view)?.nodes.find((node) => node.id === id)?.name ?? humanize(id)
export const isRejected = (outcomes: Outcome[]) =>
  outcomes.some((outcome) => typeof outcome === 'object' && 'Rejected' in outcome)

export function describeOutcome(outcome: Outcome, view: GameView): string | null {
  if (typeof outcome === 'string')
    return (
      (
        {
          Configured: 'Your party is ready. Outfit your wagon before leaving.',
          Departed: 'The wagon rolls west. Your journey has begun.',
        } as Record<string, string>
      )[outcome] ?? humanize(outcome)
    )
  const [kind, data] = Object.entries(outcome)[0]
  const d = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>
  switch (kind) {
    case 'Message':
      return String(data)
    case 'Rejected':
      return (
        (
          {
            InvalidPhase: 'That action is not available here. Resolve the current decision first.',
            InsufficientCash: 'You do not have enough money for that purchase.',
            CapacityExceeded: 'That exceeds your wagon capacity or the item limit.',
            InvalidChoice: 'You do not have the supplies or conditions for that choice.',
            InvalidSetup: 'That setup is not available. Check your trail, era and party names.',
            NoPendingEvent: 'That event has already been resolved.',
          } as Record<string, string>
        )[String(data)] ??
        `Action unavailable: ${typeof data === 'string' ? humanize(data) : JSON.stringify(data)}`
      )
    case 'Purchased':
      return `Bought ${d.quantity} ${humanize(String(d.item_id))} for ${money(Number(d.cost_cents))}.`
    case 'DayAdvanced':
      return `Day ${Number(d.day) + 1} · ${d.miles} miles traveled · ${humanize(String(d.weather))}.`
    case 'Event':
    case 'Quote':
      return String(d.text)
    case 'Conversation':
      return (d.lines as string[]).join(' ')
    case 'ArrivedAt':
      return `Reached ${placeName(view, String(d.landmark_id))}.`
    case 'ForkAvailable':
      return 'The trail divides. Choose the way ahead.'
    case 'RiverCrossingRequired':
      return 'A river lies ahead. Scout the crossing before proceeding.'
    case 'Treated':
      return `${view.party[Number(d.member_index)]?.name ?? 'Your companion'} received treatment for ${humanize(String(d.ailment_id))}.`
    case 'Gathered':
      return `Brought back ${d.food_lbs} lb of food over ${d.days} day${Number(d.days) === 1 ? '' : 's'}. After meals, your food changed by ${Number(d.net_food_lbs) > 0 ? '+' : ''}${d.net_food_lbs} lb.`
    case 'MemberDied':
      return `${d.name} has died. Their memory remains in your journal.`
    case 'Score':
      return `Journey score: ${d.points}.`
    case 'LetterAccepted':
      return `Carrying a letter for ${d.recipient}, bound for ${placeName(view, String(d.destination_id))}.`
    case 'LetterDeclined':
      return 'You leave the letter for another traveler.'
    case 'LetterDelivered':
      return `Delivered the letter to ${d.recipient}. Earned ${money(Number(d.reward_cents))}.`
    default:
      return null
  }
}
