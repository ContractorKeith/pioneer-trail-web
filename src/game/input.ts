import type { GameSettings, MoveInput } from './contracts'

export type InputAction =
  | 'decision'
  | 'interact'
  | 'dismount'
  | 'pause'
  | 'hunt'
  | 'fish'
  | 'reload'
  | 'primary'
  | 'finish'
  | 'map'
  | 'journal'
  | 'inventory'
  | 'party'
  | 'camp'
  | 'settings'
const actions: Record<string, InputAction> = {
  KeyE: 'interact',
  Escape: 'pause',
  Tab: 'pause',
  KeyH: 'hunt',
  KeyF: 'fish',
  KeyR: 'reload',
  KeyX: 'finish',
  KeyM: 'map',
  KeyJ: 'journal',
  KeyI: 'inventory',
  KeyP: 'party',
  KeyC: 'camp',
  KeyO: 'settings',
}
/** One input owner releases every held key and pointer when play loses focus. */
export class GameInput {
  private canvas: HTMLCanvasElement
  private action: (action: InputAction) => void
  private loseFocus: () => void
  private keys = new Set<string>()
  private drag = false
  private lastX = 0
  private lastY = 0
  private dx = 0
  private dy = 0
  private active = false
  private abort = new AbortController()
  settings: GameSettings

  constructor(
    canvas: HTMLCanvasElement,
    settings: GameSettings,
    action: (action: InputAction) => void,
    loseFocus: () => void,
  ) {
    this.canvas = canvas
    this.settings = settings
    this.action = action
    this.loseFocus = loseFocus
    const signal = this.abort.signal
    window.addEventListener('keydown', this.keyDown, { signal })
    window.addEventListener('keyup', this.keyUp, { signal })
    window.addEventListener('blur', this.blur, { signal })
    document.addEventListener('visibilitychange', this.visibility, { signal })
    document.addEventListener('pointerlockchange', this.lockChange, { signal })
    canvas.addEventListener('pointerdown', this.pointerDown, { signal })
    window.addEventListener('pointerup', this.pointerUp, { signal })
    window.addEventListener('pointercancel', this.pointerUp, { signal })
    window.addEventListener('pointermove', this.pointerMove, { signal })
    canvas.addEventListener('contextmenu', (event) => event.preventDefault(), { signal })
  }
  private keyDown = (event: KeyboardEvent) => {
    if (
      !this.active ||
      event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLSelectElement ||
      event.target instanceof HTMLTextAreaElement
    )
      return
    if (
      ['Space', 'Escape', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(
        event.code,
      )
    )
      event.preventDefault()
    this.keys.add(event.code)
    if (!event.repeat && actions[event.code]) this.action(actions[event.code])
    if (!event.repeat && event.code === 'Space') this.action('primary')
  }
  private keyUp = (event: KeyboardEvent) => {
    this.keys.delete(event.code)
  }
  private blur = () => {
    if (this.active) this.loseFocus()
    this.clear()
  }
  private visibility = () => {
    if (document.hidden) this.blur()
  }
  private lockChange = () => {
    if (
      document.pointerLockElement !== this.canvas &&
      this.active &&
      this.settings.lookMode === 'pointer'
    )
      this.blur()
  }
  private pointerDown = (event: PointerEvent) => {
    if (!this.active) return
    this.canvas.focus({ preventScroll: true })
    if (event.button === 2 || document.pointerLockElement === this.canvas) {
      this.action('primary')
      return
    }
    if (this.settings.lookMode === 'pointer') {
      this.canvas.requestPointerLock?.()?.catch(() => {
        this.settings = { ...this.settings, lookMode: 'drag' }
      })
    } else {
      this.drag = true
      this.lastX = event.clientX
      this.lastY = event.clientY
      this.canvas.setPointerCapture(event.pointerId)
    }
  }
  private pointerUp = () => {
    this.drag = false
  }
  private pointerMove = (event: PointerEvent) => {
    if (!this.active) return
    if (document.pointerLockElement === this.canvas) {
      this.dx += event.movementX
      this.dy += event.movementY
    } else if (this.drag) {
      this.dx += event.clientX - this.lastX
      this.dy += event.clientY - this.lastY
      this.lastX = event.clientX
      this.lastY = event.clientY
    }
  }
  setActive(active: boolean) {
    this.active = active
    if (!active) {
      this.clear()
      if (document.pointerLockElement === this.canvas) document.exitPointerLock()
    }
  }
  setKey(code: string, down: boolean) {
    if (down && this.active) this.keys.add(code)
    else this.keys.delete(code)
  }
  private clear() {
    this.keys.clear()
    this.drag = false
    this.dx = 0
    this.dy = 0
  }
  look(dt: number): { yaw: number; pitch: number } {
    const yaw =
      -this.dx * 0.0025 * this.settings.sensitivity +
      ((this.keys.has('ArrowLeft') ? 1 : 0) - (this.keys.has('ArrowRight') ? 1 : 0)) * dt * 1.4
    const pitch =
      -this.dy * 0.0025 * this.settings.sensitivity +
      ((this.keys.has('ArrowUp') ? 1 : 0) - (this.keys.has('ArrowDown') ? 1 : 0)) * dt
    this.dx = 0
    this.dy = 0
    return { yaw, pitch }
  }
  movement(): MoveInput {
    return {
      forward: Number(this.keys.has('KeyW')) - Number(this.keys.has('KeyS')),
      turn: Number(this.keys.has('KeyA')) - Number(this.keys.has('KeyD')),
      strafe: Number(this.keys.has('KeyD')) - Number(this.keys.has('KeyA')),
      brake: this.keys.has('Space'),
      sprint: this.keys.has('ShiftLeft') || this.keys.has('ShiftRight'),
    }
  }
  dispose() {
    this.setActive(false)
    this.abort.abort()
  }
}
