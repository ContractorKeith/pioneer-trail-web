export type TrailCue = 'shot' | 'tool' | 'positive' | 'button'

type SceneMode = 'trail' | 'camp' | 'hunt' | 'fish' | 'river' | 'snow' | 'repair' | 'talk'

/** Cosmetic, self-contained procedural sound; it never touches simulation state. */
export class TrailAudio {
  private context?: AudioContext
  private master?: GainNode
  private sources: AudioScheduledSourceNode[] = []
  private timers: number[] = []
  private enabled = false
  private scene: SceneMode = 'trail'
  private weather = ''

  setEnabled(enabled: boolean) {
    this.enabled = enabled
    if (enabled) this.start()
    else this.stop()
  }

  setScene(scene: SceneMode, weather = '') {
    this.scene = scene
    this.weather = weather
    if (this.enabled) this.start()
  }

  play(cue: TrailCue) {
    if (!this.enabled) return
    const context = this.ensure()
    if (!context || !this.master) return
    const now = context.currentTime
    if (cue === 'shot') {
      this.noiseBurst(now, 0.18, 0.32, 170, 'lowpass')
      this.tone(now, 115, 42, 0.16, 0.13, 'sawtooth')
    } else if (cue === 'tool') {
      this.tone(now, 260, 95, 0.16, 0.08, 'triangle')
      this.tone(now + 0.08, 210, 72, 0.14, 0.05, 'triangle')
    } else {
      this.tone(
        now,
        cue === 'positive' ? 440 : 320,
        cue === 'positive' ? 660 : 250,
        0.13,
        0.055,
        'sine',
      )
    }
  }

  dispose() {
    this.stop()
    void this.context?.close()
    this.context = undefined
    this.master = undefined
  }

  private ensure() {
    try {
      if (!this.context) {
        this.context = new AudioContext()
        this.master = this.context.createGain()
        this.master.gain.value = 0.22
        this.master.connect(this.context.destination)
      }
      // AudioContext resume can be rejected before a user gesture; fail silently.
      void this.context.resume().catch(() => undefined)
      return this.context
    } catch {
      return undefined
    }
  }

  private start() {
    this.stop()
    const context = this.ensure()
    if (!context || !this.master) return
    const snowy = this.scene === 'snow' || this.weather.toLowerCase().includes('snow')
    const watery = this.scene === 'river' || this.scene === 'fish'
    const camp = this.scene === 'camp'
    this.loopingNoise(
      snowy ? 90 : watery ? 520 : 280,
      snowy ? 'lowpass' : watery ? 'bandpass' : 'lowpass',
      snowy ? 0.022 : watery ? 0.055 : 0.016,
    )
    if (camp) this.scheduleCrackle()
    if (watery) this.scheduleWaterBird()
    if (this.scene === 'trail' || this.scene === 'repair') this.scheduleWagonCreak()
    if (this.scene === 'hunt') this.scheduleBirdCall()
  }

  private loopingNoise(frequency: number, type: BiquadFilterType, volume: number) {
    const context = this.context!
    const source = context.createBufferSource()
    const filter = context.createBiquadFilter()
    const gain = context.createGain()
    source.buffer = this.noiseBuffer(2.5)
    source.loop = true
    filter.type = type
    filter.frequency.value = frequency
    gain.gain.value = volume
    source.connect(filter).connect(gain).connect(this.master!)
    source.start()
    this.sources.push(source)
  }

  private scheduleCrackle = () => {
    if (!this.enabled || this.scene !== 'camp') return
    if (this.context)
      this.noiseBurst(
        this.context.currentTime,
        0.035 + Math.random() * 0.045,
        0.055,
        1800 + Math.random() * 1800,
        'highpass',
      )
    this.later(this.scheduleCrackle, 170 + Math.random() * 530)
  }

  private scheduleWaterBird = () => {
    if (!this.enabled || (this.scene !== 'river' && this.scene !== 'fish')) return
    if (this.context) this.tone(this.context.currentTime, 1300, 1750, 0.16, 0.018, 'sine')
    this.later(this.scheduleWaterBird, 4500 + Math.random() * 7000)
  }

  private scheduleBirdCall = () => {
    if (!this.enabled || this.scene !== 'hunt') return
    if (this.context) this.tone(this.context.currentTime, 900, 1800, 0.11, 0.022, 'sine')
    this.later(this.scheduleBirdCall, 3800 + Math.random() * 8000)
  }

  private scheduleWagonCreak = () => {
    if (!this.enabled || (this.scene !== 'trail' && this.scene !== 'repair')) return
    if (this.context) this.tone(this.context.currentTime, 105, 68, 0.34, 0.018, 'triangle')
    this.later(this.scheduleWagonCreak, 2600 + Math.random() * 4800)
  }

  private later(callback: () => void, delay: number) {
    this.timers.push(window.setTimeout(callback, delay))
  }

  private tone(
    now: number,
    start: number,
    end: number,
    duration: number,
    volume: number,
    type: OscillatorType,
  ) {
    const context = this.context!
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.type = type
    oscillator.frequency.setValueAtTime(start, now)
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, end), now + duration)
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.012)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration)
    oscillator.connect(gain).connect(this.master!)
    oscillator.start(now)
    oscillator.stop(now + duration + 0.02)
    this.sources.push(oscillator)
    oscillator.onended = () => {
      this.sources = this.sources.filter((source) => source !== oscillator)
    }
  }

  private noiseBurst(
    now: number,
    duration: number,
    volume: number,
    frequency: number,
    type: BiquadFilterType,
  ) {
    const context = this.context!
    const source = context.createBufferSource()
    const filter = context.createBiquadFilter()
    const gain = context.createGain()
    source.buffer = this.noiseBuffer(duration)
    filter.type = type
    filter.frequency.value = frequency
    gain.gain.setValueAtTime(volume, now)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration)
    source.connect(filter).connect(gain).connect(this.master!)
    source.start(now)
    source.stop(now + duration)
    this.sources.push(source)
    source.onended = () => {
      this.sources = this.sources.filter((item) => item !== source)
    }
  }

  private noiseBuffer(seconds: number) {
    const context = this.context!
    const buffer = context.createBuffer(
      1,
      Math.ceil(context.sampleRate * seconds),
      context.sampleRate,
    )
    const samples = buffer.getChannelData(0)
    for (let index = 0; index < samples.length; index += 1) samples[index] = Math.random() * 2 - 1
    return buffer
  }

  private stop() {
    this.timers.forEach((timer) => window.clearTimeout(timer))
    this.timers = []
    this.sources.forEach((source) => {
      try {
        source.stop()
      } catch {
        /* already ended */
      }
    })
    this.sources = []
  }
}

export const trailAudio = new TrailAudio()
