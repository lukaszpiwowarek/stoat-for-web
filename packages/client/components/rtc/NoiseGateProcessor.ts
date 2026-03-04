import { Track } from "livekit-client";
import type { AudioProcessorOptions, TrackProcessor } from "livekit-client";

export interface NoiseGateOptions {
  /** Threshold in dB to open the gate. Default: -50 */
  threshold: number;
  /** How many dB below the open threshold before the gate closes. Default: 10 */
  hysteresisDb: number;
  /** Time in ms to open the gate after exceeding threshold. Default: 20 */
  attackMs: number;
  /** Time in ms to close the gate after falling below close threshold. Default: 200 */
  releaseMs: number;
}

const DEFAULTS: NoiseGateOptions = {
  threshold: -50,
  hysteresisDb: 10,
  attackMs: 20,
  releaseMs: 200,
};

export class NoiseGateProcessor implements TrackProcessor<Track.Kind.Audio, AudioProcessorOptions> {
  readonly name = "noise-gate";

  #options: NoiseGateOptions;
  #bypassed: boolean;
  #audioContext?: AudioContext;
  #sourceNode?: MediaStreamAudioSourceNode;
  #analyserNode?: AnalyserNode;
  #gainNode?: GainNode;
  #destinationNode?: MediaStreamAudioDestinationNode;
  #intervalId?: number;
  #gateOpen = false;

  processedTrack?: MediaStreamTrack;

  constructor(options: Partial<NoiseGateOptions> = {}, bypassed = false) {
    this.#options = { ...DEFAULTS, ...options };
    this.#bypassed = bypassed;
  }

  setBypassed(value: boolean) {
    this.#bypassed = value;

    // if the processor isn't active yet, the flag is enough
    const gain = this.#gainNode;
    const ctx = this.#audioContext;
    if (!gain || !ctx) return;

    gain.gain.cancelScheduledValues(ctx.currentTime);
    if (value) {
      // bypass on: open fully and hold
      gain.gain.setValueAtTime(1, ctx.currentTime);
      this.#gateOpen = true;
    } else {
      // bypass off: close and let the threshold logic take over
      gain.gain.setValueAtTime(0, ctx.currentTime);
      this.#gateOpen = false;
    }
  }

  async init(opts: AudioProcessorOptions): Promise<void> {
    this.#audioContext = opts.audioContext;
    this.#build(opts.track);
  }

  async restart(opts: AudioProcessorOptions): Promise<void> {
    this.#teardown();
    this.#build(opts.track);
  }

  async destroy(): Promise<void> {
    this.#teardown();
  }

  setThreshold(db: number) {
    this.#options.threshold = db;
  }

  setHysteresis(db: number) {
    this.#options.hysteresisDb = db;
  }

  // -- private --

  #build(track: MediaStreamTrack) {
    const ctx = this.#audioContext!;

    this.#sourceNode = ctx.createMediaStreamSource(new MediaStream([track]));
    this.#analyserNode = ctx.createAnalyser();
    this.#analyserNode.fftSize = 256;
    this.#gainNode = ctx.createGain();
    this.#gainNode.gain.value = this.#bypassed ? 1 : 0;
    this.#destinationNode = ctx.createMediaStreamDestination();

    this.#sourceNode
      .connect(this.#analyserNode)
      .connect(this.#gainNode)
      .connect(this.#destinationNode);

    this.processedTrack = this.#destinationNode.stream.getAudioTracks()[0];

    this.#startLoop();
  }

  #teardown() {
    if (this.#intervalId !== undefined) {
      window.clearInterval(this.#intervalId);
      this.#intervalId = undefined;
    }

    this.#sourceNode?.disconnect();
    this.#analyserNode?.disconnect();
    this.#gainNode?.disconnect();

    this.#sourceNode = undefined;
    this.#analyserNode = undefined;
    this.#gainNode = undefined;
    this.#destinationNode = undefined;
    this.processedTrack = undefined;
    this.#gateOpen = false;
  }

  #startLoop() {
    const analyser = this.#analyserNode!;
    const buffer = new Float32Array(analyser.fftSize);

    const tick = () => {
      if (this.#bypassed) return;

      if (this.#audioContext!.state === "suspended") {
        this.#audioContext!.resume();
        return;
      }

      analyser.getFloatTimeDomainData(buffer);

      // RMS amplitude → dB
      let sum = 0;
      for (const s of buffer) sum += s * s;
      const db = 20 * Math.log10(Math.max(Math.sqrt(sum / buffer.length), 1e-10));

      const ctx = this.#audioContext!;
      const gain = this.#gainNode!;
      const { threshold, hysteresisDb, attackMs, releaseMs } = this.#options;
      const closeThreshold = threshold - hysteresisDb;

      if (db >= threshold && !this.#gateOpen) {
        gain.gain.cancelScheduledValues(ctx.currentTime);
        gain.gain.setValueAtTime(gain.gain.value, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(1, ctx.currentTime + attackMs / 1000);
        this.#gateOpen = true;
      } else if (db < closeThreshold && this.#gateOpen) {
        gain.gain.cancelScheduledValues(ctx.currentTime);
        gain.gain.setValueAtTime(gain.gain.value, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + releaseMs / 1000);
        this.#gateOpen = false;
      }
    };

    this.#intervalId = window.setInterval(tick, 15);
  }
}
