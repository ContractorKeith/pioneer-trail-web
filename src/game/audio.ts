import type { GameSettings } from './contracts'

export interface AudioState {
  speed: number
  walking: boolean
  water: boolean
  camp: boolean
  paused: boolean
  weather: string
}
export interface AudioInspection {
  state: AudioContextState | 'unavailable'
  rms: number
  masterGain: number
  volume: number
  muted: boolean
  unlocked: boolean
}

/**
 * Lightweight procedural ambience. The runtime supplies factual spatial state; this class only
 * turns it into sound after a user gesture has unlocked the browser audio context.
 */
export class GameAudio {
  private context?: AudioContext
  private master?: GainNode
  private analyser?: AnalyserNode
  private samples?: Float32Array<ArrayBuffer>
  private wagon?: GainNode
  private feet?: GainNode
  private water?: GainNode
  private camp?: GainNode
  private wind?: GainNode
  private sources: AudioBufferSourceNode[] = []
  private unlocked = false
  private settings: Pick<GameSettings, 'muted' | 'volume'> = { muted: true, volume: 0.45 }
  private nextStep = 0
  private nextCreature = 0

  unlock() {
    this.unlocked = true
    const context = this.ensure()
    if (context?.state === 'suspended') void context.resume().catch(() => undefined)
  }

  setSettings(settings: Pick<GameSettings, 'muted' | 'volume'>) {
    this.settings = settings
    this.applyVolume()
  }

  /** Read-only diagnostic for browser evidence. It never creates or resumes audio. */
  inspect(): AudioInspection {
    if (!this.context || !this.master || !this.analyser || !this.samples)
      return {
        state: 'unavailable',
        rms: 0,
        masterGain: 0,
        volume: this.settings.volume,
        muted: this.settings.muted,
        unlocked: this.unlocked,
      }
    this.analyser.getFloatTimeDomainData(this.samples)
    const rms = Math.sqrt(
      this.samples.reduce((sum, sample) => sum + sample * sample, 0) / this.samples.length,
    )
    return {
      state: this.context.state,
      rms,
      masterGain: this.master.gain.value,
      volume: this.settings.volume,
      muted: this.settings.muted,
      unlocked: this.unlocked,
    }
  }

  update(state: AudioState) {
    if (!this.unlocked) return
    const context = this.ensure()
    if (!context) return
    const quiet = state.paused || this.settings.muted ? 0 : 1
    const moving = Math.min(1, Math.abs(state.speed) / 4)
    this.fade(this.wagon, quiet * (state.walking ? 0 : 0.08 + moving * 0.18))
    this.fade(this.feet, quiet * (state.walking ? 0.025 + moving * 0.08 : 0))
    this.fade(this.water, quiet * (state.water ? 0.12 : 0))
    this.fade(this.camp, quiet * (state.camp ? 0.105 : 0))
    this.fade(
      this.wind,
      quiet * (/(rain|snow|blizzard|storm|fog)/i.test(state.weather) ? 0.11 : 0.028),
    )
    if (!quiet) return
    const now = context.currentTime
    const cadence = state.walking
      ? Math.max(0.26, 0.72 - moving * 0.32)
      : Math.max(0.18, 0.48 - moving * 0.23)
    if ((state.walking || moving > 0.12) && now >= this.nextStep) {
      this.nextStep = now + cadence
      this.step(state.walking, moving)
    }
    if (!state.walking && !state.camp && moving > 0.08 && now >= this.nextCreature) {
      this.nextCreature = now + 6 + Math.random() * 9
      this.oxBreath(now)
    }
    if (state.camp && now >= this.nextCreature) {
      this.nextCreature = now + 0.18 + Math.random() * 0.55
      this.crackle(now)
    }
  }

  dispose() {
    for (const source of this.sources) {
      try {
        source.stop()
      } catch {
        /* ended already */
      }
    }
    this.sources = []
    void this.context?.close().catch(() => undefined)
    this.context = undefined
    this.master = undefined
    this.analyser = undefined
    this.samples = undefined
  }

  private ensure() {
    if (this.context) return this.context
    try {
      const context = new AudioContext()
      this.context = context
      this.master = context.createGain()
      // Set this synchronously before any source is connected or started. A scheduled fade from
      // the default gain of 1 can leak one analyser block on Firefox when sound starts muted.
      this.master.gain.value = this.settings.muted
        ? 0
        : Math.max(0, Math.min(1, this.settings.volume))
      this.analyser = context.createAnalyser()
      this.analyser.fftSize = 1024
      this.samples = new Float32Array(this.analyser.fftSize)
      this.master.connect(this.analyser).connect(context.destination)
      this.wagon = this.loopNoise(80, 'lowpass')
      this.feet = this.loopNoise(360, 'bandpass')
      this.water = this.loopNoise(880, 'bandpass')
      this.camp = this.loopNoise(1900, 'highpass')
      this.wind = this.loopNoise(210, 'lowpass')
      this.applyVolume()
      return context
    } catch {
      return undefined
    }
  }

  private loopNoise(frequency: number, type: BiquadFilterType) {
    const context = this.context!
    const source = context.createBufferSource()
    const filter = context.createBiquadFilter()
    const gain = context.createGain()
    const buffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate)
    const samples = buffer.getChannelData(0)
    for (let index = 0; index < samples.length; index += 1) samples[index] = Math.random() * 2 - 1
    source.buffer = buffer
    source.loop = true
    filter.type = type
    filter.frequency.value = frequency
    gain.gain.value = 0
    source.connect(filter).connect(gain).connect(this.master!)
    source.start()
    this.sources.push(source)
    return gain
  }

  private fade(gain: GainNode | undefined, value: number) {
    if (!gain || !this.context) return
    gain.gain.cancelScheduledValues(this.context.currentTime)
    gain.gain.setTargetAtTime(value, this.context.currentTime, 0.08)
  }

  private applyVolume() {
    if (!this.master || !this.context) return
    const value = this.settings.muted ? 0 : Math.max(0, Math.min(1, this.settings.volume))
    this.master.gain.setTargetAtTime(value, this.context.currentTime, 0.03)
  }

  private step(walking: boolean, speed: number) {
    const context = this.context!
    const now = context.currentTime
    this.burst(now, walking ? 260 : 95, walking ? 0.045 : 0.08, walking ? 0.026 : 0.05)
    if (!walking) {
      const creak = context.createOscillator(),
        gain = context.createGain()
      creak.type = 'triangle'
      creak.frequency.setValueAtTime(92 + speed * 28, now)
      creak.frequency.exponentialRampToValueAtTime(54, now + 0.14)
      gain.gain.setValueAtTime(0.0001, now)
      gain.gain.exponentialRampToValueAtTime(0.026, now + 0.012)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16)
      creak.connect(gain).connect(this.master!)
      creak.start(now)
      creak.stop(now + 0.18)
    }
  }

  private oxBreath(now: number) {
    const context = this.context!,
      oscillator = context.createOscillator(),
      gain = context.createGain()
    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(68, now)
    oscillator.frequency.exponentialRampToValueAtTime(47, now + 0.42)
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(0.024, now + 0.08)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.5)
    oscillator.connect(gain).connect(this.master!)
    oscillator.start(now)
    oscillator.stop(now + 0.55)
  }

  private crackle(now: number) {
    this.burst(now, 2200 + Math.random() * 1600, 0.04, 0.018)
  }

  private burst(now: number, frequency: number, seconds: number, volume: number) {
    const context = this.context!,
      source = context.createBufferSource(),
      filter = context.createBiquadFilter(),
      gain = context.createGain()
    const buffer = context.createBuffer(
      1,
      Math.max(32, Math.ceil(context.sampleRate * seconds)),
      context.sampleRate,
    )
    const values = buffer.getChannelData(0)
    for (let index = 0; index < values.length; index += 1) values[index] = Math.random() * 2 - 1
    source.buffer = buffer
    filter.type = 'bandpass'
    filter.frequency.value = frequency
    gain.gain.setValueAtTime(volume, now)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + seconds)
    source.connect(filter).connect(gain).connect(this.master!)
    source.start(now)
    source.stop(now + seconds)
  }
}
