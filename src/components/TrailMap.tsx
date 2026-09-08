import { useRef, useState, type PointerEvent } from 'react'
import naturalEarth from '../data/map/natural-earth-west.json'
import { trailNodeCoordinates } from '../data/map/trail-node-coordinates'
import type { GameView, Landmark } from '../engine-types'
import './map.css'

type Coord = readonly [number, number]
const bounds = { west: -126, east: -86, north: 49, south: 31 }
const xy = ([lon, lat]: Coord) => ({
  x: ((lon - bounds.west) / (bounds.east - bounds.west)) * 1100,
  y: ((bounds.north - lat) / (bounds.north - bounds.south)) * 690,
})
const path = (parts: ReadonlyArray<ReadonlyArray<ReadonlyArray<number>>>) =>
  parts
    .map((part) =>
      part
        .map((coord, index) => {
          const p = xy([coord[0], coord[1]])
          return `${index ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`
        })
        .join(' '),
    )
    .join(' ')
const nodeCoord = (node: Landmark): Coord => trailNodeCoordinates[node.id]
type ContentNode = Landmark & { routes?: Array<{ target_id: string; distance_miles: number }> }
const edgePath = (nodes: ContentNode[]) =>
  nodes.flatMap(
    (node) =>
      node.routes?.flatMap((route) =>
        trailNodeCoordinates[route.target_id]
          ? [[nodeCoord(node), trailNodeCoordinates[route.target_id]] satisfies Coord[]]
          : [],
      ) ?? [],
  )
const interpolate = (from: Coord, to: Coord, fraction: number): Coord => [
  from[0] + (to[0] - from[0]) * fraction,
  from[1] + (to[1] - from[1]) * fraction,
]
function chosenTrail(view: GameView) {
  return view.content.trails.find((trail) => trail.id === view.trail_id) ?? view.content.trails[0]
}
function label(name: string) {
  return name
    .replace(' Crossing', '')
    .replace('Great Salt Lake Valley', 'Salt Lake Valley')
    .replace('Independence, Missouri', 'Independence')
}
function visitedIds(view: GameView) {
  return new Set(
    (view.visited_landmarks as Array<{ landmark_id?: string }>).flatMap((item) =>
      item.landmark_id ? [item.landmark_id] : [],
    ),
  )
}

/** Offline map: Natural Earth land/rivers projected in the same lon/lat space as game nodes. */
export function TrailMap({ view }: { view: GameView }) {
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const drag = useRef<
    | { x: number; y: number; pan: { x: number; y: number }; scaleX: number; scaleY: number }
    | undefined
  >(undefined)
  const trail = chosenTrail(view)
  const visited = visitedIds(view)
  const current = view.current_node?.id
  const nodes = (trail.nodes as ContentNode[]).filter((node) => trailNodeCoordinates[node.id])
  const routes = edgePath(nodes)
  const routeFrom = nodes.find((node) => node.id === current)
  const activeEdge = routeFrom?.routes?.find(
    (route) =>
      route.target_id === view.target_node_id &&
      trailNodeCoordinates[route.target_id] &&
      route.distance_miles > 0,
  )
  const activePosition = activeEdge
    ? interpolate(
        nodeCoord(routeFrom!),
        trailNodeCoordinates[activeEdge.target_id],
        Math.max(0, Math.min(1, 1 - view.route_miles_remaining / activeEdge.distance_miles)),
      )
    : current
      ? trailNodeCoordinates[current]
      : undefined
  const travelPath = (view.visited_landmarks as Array<{ landmark_id?: string }>).flatMap((item) =>
    item.landmark_id && trailNodeCoordinates[item.landmark_id]
      ? [trailNodeCoordinates[item.landmark_id]]
      : [],
  )
  if (activePosition) travelPath.push(activePosition)
  const down = (event: PointerEvent<SVGSVGElement>) => {
    const box = event.currentTarget.getBoundingClientRect()
    drag.current = {
      x: event.clientX,
      y: event.clientY,
      pan,
      scaleX: 1100 / box.width,
      scaleY: 690 / box.height,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const move = (event: PointerEvent<SVGSVGElement>) => {
    if (drag.current)
      setPan({
        x: drag.current.pan.x + (event.clientX - drag.current.x) * drag.current.scaleX,
        y: drag.current.pan.y + (event.clientY - drag.current.y) * drag.current.scaleY,
      })
  }
  return (
    <section className="trail-map" aria-label="Geographic trail map">
      <header>
        <div>
          <p className="map-kicker">WESTERN TERRITORIES · {view.era_id ?? '1848'}</p>
          <h3>{trail.name}</h3>
        </div>
        <div className="map-legend">
          <i /> route <b>●</b> current camp
        </div>
      </header>
      <div className="map-frame">
        <svg
          viewBox="0 0 1100 690"
          role="img"
          aria-label={`Geographic map of the ${trail.name}`}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={() => {
            drag.current = undefined
          }}
          onPointerCancel={() => {
            drag.current = undefined
          }}
        >
          <defs>
            <pattern id="paper" width="9" height="9" patternUnits="userSpaceOnUse">
              <circle cx="1" cy="2" r=".7" fill="#755e3b" opacity=".12" />
            </pattern>
          </defs>
          <rect width="1100" height="690" fill="#a8c9cd" />
          <g transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`}>
            <g className="map-graticule">
              {[-120, -115, -110, -105, -100, -95, -90].map((lon) => {
                const x = xy([lon, 31]).x
                return <path key={lon} d={`M${x},0V690`} />
              })}
              {[35, 40, 45].map((lat) => {
                const y = xy([-126, lat]).y
                return <path key={lat} d={`M0,${y}H1100`} />
              })}
            </g>
            <g className="map-land">
              {naturalEarth.land.map((feature, index) => (
                <g key={index}>
                  <path d={path(feature.parts)} />
                  <path className="map-paper" d={path(feature.parts)} />
                </g>
              ))}
            </g>
            <text className="map-geography ocean" x={xy([-124, 40]).x} y={xy([-124, 40]).y}>
              Pacific Ocean
            </text>
            <text className="map-geography mountains" x={xy([-109, 44.6]).x} y={xy([-109, 44.6]).y}>
              Rocky Mountains
            </text>
            <g className="map-rivers">
              {naturalEarth.rivers.map((feature, index) => (
                <path key={index} d={path(feature.parts)} />
              ))}
            </g>
            <g className="map-edges">
              {routes.map((edge, index) => (
                <path key={index} d={path([edge])} />
              ))}
            </g>
            <g className="map-traveled">
              {travelPath.length > 1 && <path d={path([travelPath])} />}
            </g>
            {activePosition && (
              <g
                className="map-place is-current"
                transform={`translate(${xy(activePosition).x} ${xy(activePosition).y})`}
              >
                <circle r="8" />
              </g>
            )}
            {nodes.map((node, index) => {
              const coord = nodeCoord(node)
              const p = xy(coord)
              const isCurrent = node.id === current && !activeEdge
              const isVisited = visited.has(node.id)
              const offset = index % 3 === 0 ? [-8, -9] : index % 3 === 1 ? [8, 15] : [8, -10]
              return (
                <g
                  className={`map-place ${isCurrent ? 'is-current' : ''} ${isVisited ? 'is-done' : ''}`}
                  key={node.id}
                  transform={`translate(${p.x} ${p.y})`}
                >
                  <circle r={isCurrent ? 8 : 4.5} />
                  <text x={offset[0]} y={offset[1]} textAnchor={offset[0] < 0 ? 'end' : 'start'}>
                    {label(node.name)}
                  </text>
                </g>
              )
            })}
          </g>
        </svg>
        <div className="map-controls">
          <button
            type="button"
            aria-label="Zoom in"
            onClick={() => setZoom((value) => Math.min(5, value + 0.35))}
          >
            +
          </button>
          <button
            type="button"
            aria-label="Zoom out"
            onClick={() => setZoom((value) => Math.max(0.6, value - 0.35))}
          >
            −
          </button>
          <button
            type="button"
            aria-label="Reset map position"
            onClick={() => {
              setZoom(1)
              setPan({ x: 0, y: 0 })
            }}
          >
            ⌾
          </button>
        </div>
      </div>
      <footer>
        <span>
          <b>{view.miles.toLocaleString()} mi</b> trail miles traveled
        </span>
        <span>{view.current_node?.name ?? 'On the trail'}</span>
      </footer>
    </section>
  )
}
