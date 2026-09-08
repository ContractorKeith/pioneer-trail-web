import { describe, expect, it } from 'vitest'
import naturalEarth from './natural-earth-west.json'
import engineContent from '../../../engine/crates/data/content.ron?raw'
import { trailNodeCoordinates } from './trail-node-coordinates'

describe('offline geographic map data', () => {
  it('covers every node ID generated from the engine trail content', () => {
    const trailText = engineContent.slice(
      engineContent.indexOf('trails: ['),
      engineContent.indexOf('events: ['),
    )
    const ids = trailText
      .split('\n')
      .filter((line) => line.includes('(id:"') && line.includes('kind:'))
      .flatMap((line) => line.match(/\(id:"([^"]+)/)?.[1] ?? [])
    expect(ids.length).toBeGreaterThan(0)
    expect(ids.filter((id) => !trailNodeCoordinates[id])).toEqual([])
  })
  const inside = (lon: number, lat: number, ring: number[][]) =>
    ring.reduce((inside, point, index) => {
      const prior = ring[(index + ring.length - 1) % ring.length]
      return point[1] > lat !== prior[1] > lat &&
        lon < ((prior[0] - point[0]) * (lat - point[1])) / (prior[1] - point[1]) + point[0]
        ? !inside
        : inside
    }, false)
  it('stores a clipped continental landmass, not loose vertices', () => {
    const landRings = naturalEarth.land.flatMap((feature) => feature.parts)
    expect(landRings.some((ring) => inside(-94.42, 39.09, ring))).toBe(true)
    expect(landRings.some((ring) => inside(-125, 42, ring))).toBe(false)
  })

  it('stores Natural Earth features inside the rendered western extent', () => {
    expect(naturalEarth.land.length).toBeGreaterThan(0)
    expect(naturalEarth.rivers.length).toBeGreaterThan(5)
    for (const collection of [naturalEarth.land, naturalEarth.rivers])
      for (const feature of collection)
        for (const part of feature.parts)
          for (const [lon, lat] of part) {
            expect(lon).toBeGreaterThanOrEqual(-126)
            expect(lon).toBeLessThanOrEqual(-86)
            expect(lat).toBeGreaterThanOrEqual(31)
            expect(lat).toBeLessThanOrEqual(49)
          }
  })
})
