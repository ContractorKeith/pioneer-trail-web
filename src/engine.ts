import type { EngineResult, GameCommand, GameView } from './engine-types'

type WasmEngine = {
  apply(command: string): string
  view(): string
  save(): string
  load(save: string): string
  minigame_snapshot(): string
  minigame_action(action: string): string
  minigame_tick(frames: number): string
  finish_minigame(): string
}
type WasmModule = {
  default(input?: RequestInfo | URL | Response | BufferSource): Promise<void>
  TrailEngine: new (seed: string) => WasmEngine
}

/** Keeps opaque Rust save JSON out of JS parsing so 64-bit RNG state remains exact. */
export class TrailEngine {
  private readonly wasm: WasmEngine
  private constructor(wasm: WasmEngine) {
    this.wasm = wasm
  }

  static async create(seed = `${Date.now()}`): Promise<TrailEngine> {
    // Kept in public/wasm so Cloudflare serves wasm-pack's sibling JS and .wasm unchanged.
    const wasmUrl = new URL('/wasm/pioneer_trail_web_engine.js', window.location.href).href
    const module = (await import(/* @vite-ignore */ wasmUrl)) as WasmModule
    await module.default()
    return new TrailEngine(new module.TrailEngine(seed))
  }
  apply(command: GameCommand): EngineResult {
    return JSON.parse(this.wasm.apply(JSON.stringify(command))) as EngineResult
  }
  view(): GameView {
    return JSON.parse(this.wasm.view()) as GameView
  }
  save(): string {
    return this.wasm.save()
  }
  load(save: string): GameView {
    return JSON.parse(this.wasm.load(save)) as GameView
  }
  minigameSnapshot(): unknown {
    return JSON.parse(this.wasm.minigame_snapshot()) as unknown
  }
  minigameAction(action: unknown): unknown {
    return JSON.parse(this.wasm.minigame_action(JSON.stringify(action))) as unknown
  }
  minigameTick(frames = 1): unknown {
    return JSON.parse(this.wasm.minigame_tick(frames)) as unknown
  }
  finishMinigame(): EngineResult {
    return JSON.parse(this.wasm.finish_minigame()) as EngineResult
  }
}
