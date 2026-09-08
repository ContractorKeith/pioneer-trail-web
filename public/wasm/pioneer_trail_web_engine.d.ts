/* tslint:disable */
/* eslint-disable */

export class TrailEngine {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Applies the exact externally-tagged serde Command JSON used by the original sim.
     */
    apply(command_json: string): string;
    begin_activity(request_json: string): string;
    finish_activity(request_json: string): string;
    finish_minigame(): string;
    load(save: string): string;
    minigame_action(action_json: string): string;
    minigame_snapshot(): string;
    minigame_tick(frames: number): string;
    constructor(seed: string);
    record_activity(request_json: string): string;
    /**
     * Opaque JSON: callers must store and restore this string unchanged. It embeds content and RNG.
     */
    save(): string;
    view(): string;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_trailengine_free: (a: number, b: number) => void;
    readonly trailengine_apply: (a: number, b: number, c: number) => [number, number, number, number];
    readonly trailengine_begin_activity: (a: number, b: number, c: number) => [number, number, number, number];
    readonly trailengine_finish_activity: (a: number, b: number, c: number) => [number, number, number, number];
    readonly trailengine_finish_minigame: (a: number) => [number, number, number, number];
    readonly trailengine_load: (a: number, b: number, c: number) => [number, number, number, number];
    readonly trailengine_minigame_action: (a: number, b: number, c: number) => [number, number, number, number];
    readonly trailengine_minigame_snapshot: (a: number) => [number, number, number, number];
    readonly trailengine_minigame_tick: (a: number, b: number) => [number, number, number, number];
    readonly trailengine_new: (a: number, b: number) => [number, number, number];
    readonly trailengine_record_activity: (a: number, b: number, c: number) => [number, number, number, number];
    readonly trailengine_save: (a: number) => [number, number];
    readonly trailengine_view: (a: number) => [number, number];
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __externref_table_dealloc: (a: number) => void;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
