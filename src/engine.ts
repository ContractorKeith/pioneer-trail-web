import type { EngineResult, GameCommand, GameView } from './engine-types'

type WasmEngine = {
  free(): void
  apply(command: string): string
  view(): string
  save(): string
  load(save: string): string
  minigame_snapshot(): string
  minigame_action(action: string): string
  minigame_tick(frames: number): string
  finish_minigame(): string
  begin_activity(request: string): string
  record_activity(record: string): string
  finish_activity(request: string): string
}
type WasmModule = {
  default(input?: RequestInfo | URL | Response | BufferSource): Promise<void>
  TrailEngine: new (seed: string) => WasmEngine
}

// `wasm-bindgen` writes exports into a mutable module global after an await.
// Concurrent create calls can therefore construct pointers in separate instances
// while later method calls dispatch through only the last instance.
let wasmModulePromise: Promise<WasmModule> | null = null
function loadWasmModule(): Promise<WasmModule> {
  if (!wasmModulePromise) {
    wasmModulePromise = (async () => {
      const wasmUrl = new URL('/wasm/pioneer_trail_web_engine.js', window.location.href).href
      const module = (await import(/* @vite-ignore */ wasmUrl)) as WasmModule
      await module.default()
      return module
    })().catch((error) => {
      wasmModulePromise = null
      throw error
    })
  }
  return wasmModulePromise
}

/** Keeps opaque Rust save JSON out of JS parsing so 64-bit RNG state remains exact. */
export class TrailEngine {
  private readonly wasm: WasmEngine
  private disposed = false
  private constructor(wasm: WasmEngine) {
    this.wasm = wasm
  }

  static async create(seed = `${Date.now()}`): Promise<TrailEngine> {
    const module = await loadWasmModule()
    return new TrailEngine(new module.TrailEngine(seed))
  }
  dispose() {
    if (!this.disposed) {
      this.wasm.free()
      this.disposed = true
    }
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
  beginActivity(request: unknown): EngineResult {
    return JSON.parse(this.wasm.begin_activity(JSON.stringify(request))) as EngineResult
  }
  recordActivity(record: unknown): EngineResult {
    return JSON.parse(this.wasm.record_activity(JSON.stringify(record))) as EngineResult
  }
  finishActivity(request: unknown): EngineResult {
    return JSON.parse(this.wasm.finish_activity(JSON.stringify(request))) as EngineResult
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
