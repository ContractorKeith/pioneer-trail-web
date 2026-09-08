#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root/engine"
cargo_bin="${CARGO:-$HOME/.cargo/bin/cargo}"
bindgen_bin="${WASM_BINDGEN:-$HOME/.cargo/bin/wasm-bindgen}"
"$cargo_bin" build -p pioneer-trail-web-engine --target wasm32-unknown-unknown --release
mkdir -p "$root/public/wasm"
"$bindgen_bin" target/wasm32-unknown-unknown/release/pioneer_trail_web_engine.wasm --target web --out-dir "$root/public/wasm" --out-name pioneer_trail_web_engine
