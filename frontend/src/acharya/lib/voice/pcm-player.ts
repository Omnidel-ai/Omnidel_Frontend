"use client";

const SAMPLE_RATE = 24_000;
const WORKLET_URL = "/audio/voice-pcm-worklet.js";

export type PcmProgress = {
  generation: number;
  playedSeconds: number;
  sourceSeconds: number;
  queuedSeconds: number;
  underruns: number;
};

export type PcmRendered = {
  generation: number;
  samples: Float32Array;
  sampleRate: number;
  startFrame: number;
};

export type PcmPlayerOptions = {
  onError?: (error: Error) => void;
  onProgress?: (progress: PcmProgress) => void;
  /** Enable only while collecting lossless diagnostic evidence. */
  onRendered?: (rendered: PcmRendered) => void;
  maxQueueSeconds?: number;
};

export type PcmAdmission = {
  generation: number;
  sourceStartSeconds: number;
  durationSeconds: number;
};

type Command =
  | { type: "enqueue"; generation: number; sequence: number; samples: Float32Array }
  | { type: "finish"; generation: number };

/** Dedicated 24 kHz playback, independent of the microphone's audio graph. */
export class PcmPlayer {
  readonly context: AudioContext;
  readonly output: GainNode;
  readonly ready: Promise<void>;
  private readonly options: PcmPlayerOptions;
  private readonly maxQueueFrames: number;
  private node: AudioWorkletNode | null = null;
  private pending: Command[] = [];
  private currentGeneration = 0;
  private sequence = 0;
  private playedFrames = 0;
  private sourceFrames = 0;
  private underruns = 0;
  private closed = false;
  private failure: Error | null = null;
  private closePromise: Promise<void> | null = null;

  constructor(options: PcmPlayerOptions = {}) {
    this.options = options;
    const maxQueueSeconds = options.maxQueueSeconds ?? 30;
    if (!Number.isFinite(maxQueueSeconds) || maxQueueSeconds < 0.08 || maxQueueSeconds > 300) {
      throw new Error("PCM queue limit must be between 0.08 and 300 seconds");
    }
    this.maxQueueFrames = Math.floor(maxQueueSeconds * SAMPLE_RATE);
    this.context = new AudioContext({ sampleRate: SAMPLE_RATE, latencyHint: "interactive" });
    this.output = this.context.createGain();
    this.output.gain.value = 1;
    this.output.connect(this.context.destination);
    if (this.context.sampleRate !== SAMPLE_RATE) {
      const error = new Error(`24 kHz voice playback is unavailable (received ${this.context.sampleRate} Hz)`);
      void this.context.close().catch(() => undefined);
      throw error;
    }
    // This call is synchronous with construction so a user gesture can unlock
    // playback before awaiting worklet download or a server response.
    const gestureResume = this.context.resume();
    void gestureResume.catch((error: unknown) => {
      if (!this.closed) this.fail(error);
    });
    this.ready = this.initialize();
    // Consumers can enqueue immediately; initialization failure is also surfaced
    // through onError, while callers awaiting ready still receive the rejection.
    void this.ready.catch(() => undefined);
  }

  get generation() { return this.currentGeneration; }
  get playedSeconds() { return this.playedFrames / SAMPLE_RATE; }
  get sourceSeconds() { return this.sourceFrames / SAMPLE_RATE; }
  get queuedSeconds() { return Math.max(0, this.sourceFrames - this.playedFrames) / SAMPLE_RATE; }

  private assertOpen() {
    if (this.failure) throw this.failure;
    if (this.closed) throw new Error("PCM player is closed");
  }

  private fail(cause: unknown): Error {
    const error = cause instanceof Error ? cause : new Error(String(cause));
    if (!this.failure && !this.closed) {
      this.failure = error;
      this.pending = [];
      void this.close().catch(() => undefined);
      this.options.onError?.(error);
    }
    return this.failure ?? error;
  }

  private async initialize() {
    try {
      if (!this.context.audioWorklet) throw new Error("This browser does not support the voice audio worklet");
      await this.context.audioWorklet.addModule(WORKLET_URL);
      this.assertOpen();
      const node = new AudioWorkletNode(this.context, "voice-pcm-player", {
        numberOfInputs: 0,
        numberOfOutputs: 1,
        outputChannelCount: [1],
        processorOptions: {
          generation: this.currentGeneration,
          maxQueueFrames: this.maxQueueFrames,
          capture: !!this.options.onRendered,
        },
      });
      node.port.onmessage = (event: MessageEvent) => this.receive(event.data);
      node.onprocessorerror = () => { this.fail(new Error("Voice audio processor stopped unexpectedly")); };
      node.connect(this.output);
      this.node = node;
      const commands = this.pending;
      this.pending = [];
      for (const command of commands) this.send(command);
    } catch (error) {
      if (this.closed && !this.failure) throw error;
      throw this.fail(error);
    }
  }

  private send(command: Command) {
    if (command.generation !== this.currentGeneration || this.closed) return;
    if (!this.node) {
      this.pending.push(command);
      return;
    }
    try {
      if (command.type === "enqueue") this.node.port.postMessage(command, [command.samples.buffer]);
      else this.node.port.postMessage(command);
    } catch (error) {
      throw this.fail(error);
    }
  }

  private receive(message: {
    type?: string; generation?: number; message?: string; playedFrames?: number;
    sourceFrames?: number; queuedFrames?: number; underruns?: number;
    samples?: Float32Array; sampleRate?: number; startFrame?: number;
  }) {
    if (this.closed) return;
    // A fatal processor error retires the whole node, even if an interrupt was
    // requested while that error message was in flight.
    if (message.type === "error") {
      this.fail(new Error(message.message || "Voice audio processor failed"));
      return;
    }
    if (message.type === "rendered" && message.samples instanceof Float32Array) {
      // Diagnostic output records samples produced by this processor. Preserve
      // the old-generation tail flushed by interrupt; it cannot schedule audio.
      this.options.onRendered?.({ generation: message.generation ?? this.currentGeneration, samples: message.samples,
        sampleRate: SAMPLE_RATE, startFrame: message.startFrame ?? 0 });
      return;
    }
    if (message.generation !== this.currentGeneration) return;
    if (message.type !== "progress") return;
    const played = message.playedFrames;
    if (!Number.isInteger(played) || played! < this.playedFrames || played! > this.sourceFrames) return;
    this.playedFrames = played!;
    this.underruns = message.underruns ?? this.underruns;
    this.options.onProgress?.({ generation: this.currentGeneration,
      playedSeconds: this.playedSeconds, sourceSeconds: this.sourceSeconds,
      queuedSeconds: this.queuedSeconds, underruns: this.underruns });
  }

  async resume(): Promise<void> {
    this.assertOpen();
    // Invoke resume before awaiting ready to preserve the caller's gesture.
    const resumed = this.context.resume();
    try {
      await Promise.all([this.ready, resumed]);
      this.assertOpen();
      if (this.context.state !== "running") throw new Error("Voice audio playback could not resume");
    } catch (error) {
      if (this.closed && !this.failure) throw error;
      throw this.fail(error);
    }
  }

  enqueue(bytes: Uint8Array): PcmAdmission {
    this.assertOpen();
    if (!(bytes instanceof Uint8Array) || bytes.byteLength === 0 || bytes.byteLength % 2 !== 0) {
      throw this.fail(new Error("Voice PCM must contain a non-empty, even number of bytes"));
    }
    const count = bytes.byteLength / 2;
    if (this.sourceFrames - this.playedFrames + count > this.maxQueueFrames) {
      throw this.fail(new Error("Voice playback queue exceeded its limit"));
    }
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const samples = new Float32Array(count);
    for (let i = 0; i < count; i++) samples[i] = view.getInt16(i * 2, true) / 32768;
    const admission = { generation: this.currentGeneration,
      sourceStartSeconds: this.sourceSeconds, durationSeconds: count / SAMPLE_RATE };
    this.sourceFrames += count;
    this.send({ type: "enqueue", generation: this.currentGeneration, sequence: this.sequence++, samples });
    return admission;
  }

  finishTurn(): void {
    this.assertOpen();
    this.send({ type: "finish", generation: this.currentGeneration });
  }

  interrupt(): void {
    // Teardown often follows an async processor error. It must remain safe even
    // when fail() has already closed the engine before notifying its owner.
    if (this.closed || this.failure) return;
    this.currentGeneration++;
    this.sequence = 0;
    this.pending = [];
    this.sourceFrames = 0;
    this.playedFrames = 0;
    this.underruns = 0;
    try {
      this.node?.port.postMessage({ type: "interrupt", generation: this.currentGeneration });
    } catch (error) {
      this.fail(error);
      return;
    }
    this.options.onProgress?.({ generation: this.currentGeneration,
      playedSeconds: 0, sourceSeconds: 0, queuedSeconds: 0, underruns: 0 });
  }

  close(): Promise<void> {
    if (this.closePromise) return this.closePromise;
    this.closed = true;
    this.currentGeneration++;
    this.pending = [];
    this.sourceFrames = 0;
    this.playedFrames = 0;
    if (this.node) {
      this.node.port.onmessage = null;
      this.node.onprocessorerror = null;
      try { this.node.port.postMessage({ type: "close" }); } catch { /* already retired */ }
      try { this.node.disconnect(); } catch { /* already disconnected */ }
      try { this.node.port.close(); } catch { /* already closed */ }
      this.node = null;
    }
    try { this.output.disconnect(); } catch { /* already disconnected */ }
    this.closePromise = this.context.state === "closed" ? Promise.resolve() : this.context.close();
    return this.closePromise;
  }
}
