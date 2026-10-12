/* global AudioWorkletProcessor, registerProcessor, sampleRate, currentFrame */
/* A continuous mono PCM stream. Packet boundaries never become source nodes. */
class VoicePcmProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const config = options.processorOptions || {};
    this.generation = config.generation || 0;
    this.nextSequence = 0;
    this.prebufferFrames = Math.round(sampleRate * 0.08);
    this.edgeFrames = Math.max(1, Math.round(sampleRate * 0.004));
    this.interruptFrames = Math.max(1, Math.round(sampleRate * 0.006));
    this.maxQueueFrames = config.maxQueueFrames || sampleRate * 30;
    this.capture = config.capture === true;
    this.queue = [];
    this.head = 0;
    this.queuedFrames = 0;
    this.sourceFrames = 0;
    this.playedFrames = 0;
    this.underruns = 0;
    this.playing = false;
    this.finishThroughFrame = 0;
    this.fadeInRemaining = 0;
    this.fadeOutRemaining = 0;
    this.fadeOutTotal = 0;
    this.interruptTail = null;
    this.interruptOffset = 0;
    this.lastOutput = 0;
    this.closed = false;
    this.failed = false;
    this.progressFrames = 0;
    this.lastProgress = '';
    this.captureBuffer = new Float32Array(1024);
    this.captureLength = 0;
    this.captureStartFrame = 0;
    this.port.onmessage = (event) => this.receive(event.data);
    if (sampleRate !== 24000) this.fail(`PCM player requires 24000 Hz; received ${sampleRate}`);
  }

  fail(message) {
    if (this.failed || this.closed) return;
    this.failed = true;
    this.queue = [];
    this.head = 0;
    this.queuedFrames = 0;
    this.playing = false;
    this.interruptTail = null;
    this.port.postMessage({ type: 'error', generation: this.generation, message });
  }

  takeSample() {
    const item = this.queue[this.head];
    const value = item.samples[item.offset++];
    this.queuedFrames--;
    if (item.offset === item.samples.length) {
      this.head++;
      if (this.head >= 64) {
        this.queue = this.queue.slice(this.head);
        this.head = 0;
      }
    }
    return value;
  }

  flushCapture() {
    if (!this.capture || !this.captureLength) return;
    const samples = this.captureLength === this.captureBuffer.length
      ? this.captureBuffer : this.captureBuffer.slice(0, this.captureLength);
    this.port.postMessage({ type: 'rendered', generation: this.generation,
      startFrame: this.captureStartFrame, sampleRate, samples }, [samples.buffer]);
    this.captureBuffer = new Float32Array(1024);
    this.captureLength = 0;
  }

  progress(force = false) {
    const key = `${this.generation}:${this.playedFrames}:${this.queuedFrames}:${this.underruns}`;
    if (!force && this.lastProgress === key) return;
    this.lastProgress = key;
    this.port.postMessage({ type: 'progress', generation: this.generation,
      playedFrames: this.playedFrames, sourceFrames: this.sourceFrames,
      queuedFrames: this.queuedFrames, underruns: this.underruns });
  }

  receive(message) {
    if (!message || this.closed || this.failed) return;
    if (message.type === 'close') {
      this.flushCapture();
      this.closed = true;
      this.queue = [];
      this.queuedFrames = 0;
      this.interruptTail = null;
      return;
    }
    if (message.type === 'interrupt') {
      if (!Number.isInteger(message.generation) || message.generation <= this.generation) return;
      this.flushCapture();
      // Retain at most six milliseconds for a single fade, then discard all old
      // speech. New-generation input is queued separately while this tail ends.
      const tail = new Float32Array(this.interruptFrames);
      const previousTail = this.interruptTail;
      let previousTailOffset = this.interruptOffset;
      let active = this.playing;
      let fadeIn = this.fadeInRemaining;
      let fadeOut = this.fadeOutRemaining;
      let fadeOutTotal = this.fadeOutTotal;
      for (let i = 0; i < tail.length; i++) {
        const gain = (tail.length - i - 1) / tail.length;
        let next = 0;
        if (previousTail) {
          next = previousTail[previousTailOffset++] || 0;
        } else if (active && this.queuedFrames > 0) {
          if (!fadeOut && this.queuedFrames <= this.edgeFrames) {
            fadeOutTotal = this.queuedFrames;
            fadeOut = fadeOutTotal;
          }
          next = this.takeSample();
          if (fadeIn) {
            next *= 1 - fadeIn / this.edgeFrames;
            fadeIn--;
          }
          if (fadeOut) {
            next *= (fadeOut - 1) / fadeOutTotal;
            if (!--fadeOut) active = false;
          }
        }
        // Preserve the existing edge envelope. Replacing a partially faded
        // sample with raw PCM here would itself create a click on interruption.
        tail[i] = next * gain;
      }
      this.interruptTail = tail;
      this.interruptOffset = 0;
      this.queue = [];
      this.head = 0;
      this.queuedFrames = 0;
      this.sourceFrames = 0;
      this.playedFrames = 0;
      this.underruns = 0;
      this.generation = message.generation;
      this.nextSequence = 0;
      this.playing = false;
      this.finishThroughFrame = 0;
      this.fadeInRemaining = 0;
      this.fadeOutRemaining = 0;
      this.progress(true);
      return;
    }
    // Messages from an interrupted generation must never enter the new FIFO.
    if (message.generation < this.generation) return;
    if (message.generation !== this.generation) {
      this.fail('PCM generation changed without an interrupt');
      return;
    }
    if (message.type === 'finish') {
      // Mark only the audio already received. An empty/completed turn must not
      // disable prebuffering for a later turn in the same generation.
      this.finishThroughFrame = this.sourceFrames;
      return;
    }
    if (message.type !== 'enqueue') return;
    if (message.sequence !== this.nextSequence) {
      this.fail('PCM packets arrived out of sequence');
      return;
    }
    const samples = message.samples;
    if (!(samples instanceof Float32Array) || samples.length === 0) {
      this.fail('PCM packet must contain Float32 samples');
      return;
    }
    if (this.queuedFrames + samples.length > this.maxQueueFrames) {
      this.fail('PCM playback queue exceeded its limit');
      return;
    }
    for (let i = 0; i < samples.length; i++) {
      if (!Number.isFinite(samples[i]) || Math.abs(samples[i]) > 1) {
        this.fail('PCM packet contains invalid samples');
        return;
      }
    }
    this.nextSequence++;
    this.queue.push({ samples, offset: 0 });
    this.queuedFrames += samples.length;
    this.sourceFrames += samples.length;
  }

  process(_inputs, outputs) {
    const output = outputs[0] && outputs[0][0];
    if (!output) return !this.closed;
    output.fill(0);
    if (this.closed) return false;
    if (this.failed) return true;
    for (let i = 0; i < output.length; i++) {
      let value = 0;
      if (this.interruptTail) {
        value = this.interruptTail[this.interruptOffset++];
        if (this.interruptOffset === this.interruptTail.length) this.interruptTail = null;
      } else {
        if (!this.playing && this.queuedFrames > 0 &&
            (this.queuedFrames >= this.prebufferFrames || this.playedFrames < this.finishThroughFrame)) {
          this.playing = true;
          this.fadeInRemaining = this.edgeFrames;
        }
        if (this.playing && this.queuedFrames > 0) {
          // Fade only when the FIFO itself is about to empty, never at a packet
          // boundary. Persist the ramp if new data arrives during those 4 ms.
          if (!this.fadeOutRemaining && this.queuedFrames <= this.edgeFrames) {
            this.fadeOutTotal = this.queuedFrames;
            this.fadeOutRemaining = this.fadeOutTotal;
          }
          value = this.takeSample();
          this.playedFrames++;
          if (this.fadeInRemaining) {
            value *= 1 - this.fadeInRemaining / this.edgeFrames;
            this.fadeInRemaining--;
          }
          if (this.fadeOutRemaining) {
            value *= (this.fadeOutRemaining - 1) / this.fadeOutTotal;
            this.fadeOutRemaining--;
            if (!this.fadeOutRemaining) {
              this.playing = false;
              this.fadeInRemaining = 0;
              if (this.playedFrames > this.finishThroughFrame) this.underruns++;
            }
          }
        }
      }
      output[i] = value;
      this.lastOutput = value;
      if (this.capture) {
        // A browser clock discontinuity must remain at its actual position,
        // even when it falls inside a batched diagnostic message.
        if (this.captureLength && this.captureStartFrame + this.captureLength !== currentFrame + i) {
          this.flushCapture();
        }
        if (!this.captureLength) this.captureStartFrame = currentFrame + i;
        this.captureBuffer[this.captureLength++] = value;
        if (this.captureLength === this.captureBuffer.length) this.flushCapture();
      }
    }
    this.progressFrames += output.length;
    if (this.progressFrames >= sampleRate * 0.04) {
      this.progressFrames %= Math.round(sampleRate * 0.04);
      this.progress();
    }
    return true;
  }
}

registerProcessor('voice-pcm-player', VoicePcmProcessor);
