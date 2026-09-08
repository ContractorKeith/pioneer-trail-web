import { MotionWorld, type Ground, type Pose } from '../src/game/physics'

type Point = { x: number; z: number }
type Node = Point & { i: number; j: number; cost: number; previous?: Node }
const idle = { forward: 0, strafe: 0, turn: 0, brake: false, sprint: false }

/** Plan verification-driver waypoints against the actual scene and parked train. */
export function planWalkingRoute(ground: Ground, wagon: Pose, start: Pose, target: Point): Point[] {
  const physics = new MotionWorld(ground)
  physics.setWagon(wagon)
  const step = 0.8,
    margin = 0.24
  const forward = { x: Math.sin(start.yaw), z: Math.cos(start.yaw) }
  const right = { x: Math.cos(start.yaw), z: -Math.sin(start.yaw) }
  const point = (i: number, j: number) => ({
    x: start.x + step * (i * right.x + j * forward.x),
    z: start.z + step * (i * right.z + j * forward.z),
  })
  const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.z - b.z)
  const clear = (p: Point) =>
    physics.canStand(p.x, p.z) &&
    [
      [margin, 0],
      [-margin, 0],
      [0, margin],
      [0, -margin],
    ].every(([x, z]) => physics.canStand(p.x + x!, p.z + z!))
  const edge = (a: Point, b: Point) => {
    const length = distance(a, b),
      count = Math.max(1, Math.ceil(length / 0.16))
    if (length < 1e-8) return physics.canStand(a.x, a.z)
    let pose = { ...a, yaw: start.yaw, speed: 0 }
    const dx = b.x - a.x,
      dz = b.z - a.z
    for (let n = 1; n <= count; n++) {
      const expected = { x: a.x + (dx * n) / count, z: a.z + (dz * n) / count }
      // A save at an existing contact must be able to retreat into clear space.
      if (distance(expected, start) > 0.6 && !clear(expected)) return false
      pose = physics.walk(
        pose,
        {
          ...idle,
          forward: (dx * forward.x + dz * forward.z) / length,
          strafe: -(dx * right.x + dz * right.z) / length,
        },
        length / count / 3.2,
      )
      if (physics.lastObstacle || distance(pose, expected) > 0.02) return false
    }
    return true
  }
  const origin: Node = { ...start, i: 0, j: 0, cost: 0 }
  const open = [origin],
    best = new Map([['0,0', 0]])
  try {
    if (distance(start, target) < 0.12) return []
    while (open.length && best.size <= 6000) {
      open.sort((a, b) => a.cost + distance(a, target) - (b.cost + distance(b, target)))
      const current = open.shift()!
      if (current.cost !== best.get(`${current.i},${current.j}`)) continue
      if (distance(current, target) < step * 1.5 && edge(current, target)) {
        const path: Point[] = [target]
        for (let node: Node | undefined = current; node?.previous; node = node.previous)
          path.unshift({ x: node.x, z: node.z })
        return path
      }
      for (const [di, dj] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const i = current.i + di!,
          j = current.j + dj!,
          next = point(i, j)
        if (next.z < 5 || next.z > ground.length - 5 || Math.abs(next.x) > 80) continue
        if (distance(next, start) + distance(next, target) > distance(start, target) + 32) continue
        const cost = current.cost + step,
          key = `${i},${j}`
        if ((best.get(key) ?? Infinity) <= cost || !edge(current, next)) continue
        best.set(key, cost)
        open.push({ ...next, i, j, cost, previous: current })
      }
    }
    throw new Error(
      `No collision-free walking route from ${JSON.stringify(start)} to ${JSON.stringify(target)}`,
    )
  } finally {
    physics.dispose()
  }
}
