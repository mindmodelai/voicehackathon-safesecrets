/**
 * AudioManager — handles browser microphone capture and TTS audio playback.
 *
 * Capture: Uses ScriptProcessorNode to grab raw PCM 16-bit LE audio from the mic
 *          at 16kHz (what Transcribe expects).
 * Playback: Uses Web Audio API (AudioContext) to queue and play streamed
 *           TTS audio chunks, with immediate stop support for barge-in.
 */

export interface AudioManager {
  startCapture(onChunk: (chunk: ArrayBuffer) => void): Promise<void>;
  stopCapture(): void;
  playAudioChunk(chunk: ArrayBuffer): void;
  stopPlayback(): void;
  isPlaying(): boolean;
}

const TARGET_SAMPLE_RATE = 16000;

/**
 * Downsamples a Float32Array from sourceSampleRate to targetSampleRate
 * using simple linear interpolation.
 */
function downsample(buffer: Float32Array, sourceSampleRate: number, targetSampleRate: number): Float32Array {
  if (sourceSampleRate === targetSampleRate) return buffer;
  const ratio = sourceSampleRate / targetSampleRate;
  const newLength = Math.round(buffer.length / ratio);
  const result = new Float32Array(newLength);
  for (let i = 0; i < newLength; i++) {
    const srcIndex = i * ratio;
    const low = Math.floor(srcIndex);
    const high = Math.min(low + 1, buffer.length - 1);
    const frac = srcIndex - low;
    result[i] = buffer[low] * (1 - frac) + buffer[high] * frac;
  }
  return result;
}

/**
 * Converts Float32 samples (-1..1) to 16-bit signed PCM little-endian.
 */
function float32ToPcm16(samples: Float32Array): ArrayBuffer {
  const pcm = new ArrayBuffer(samples.length * 2);
  const view = new DataView(pcm);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return pcm;
}

export class AudioManagerImpl implements AudioManager {
  private mediaStream: MediaStream | null = null;
  private captureContext: AudioContext | null = null;
  private scriptProcessor: ScriptProcessorNode | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;

  private playbackContext: AudioContext | null = null;
  /** Scheduled playback end time (in AudioContext seconds) */
  private scheduledTime = 0;
  /** Currently playing source nodes — tracked so stopPlayback can kill them */
  private activeSources: AudioBufferSourceNode[] = [];
  private playing = false;

  // ── Capture ──────────────────────────────────────────────

  async startCapture(onChunk: (chunk: ArrayBuffer) => void): Promise<void> {
    if (this.captureContext) {
      return; // already capturing
    }

    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        sampleRate: TARGET_SAMPLE_RATE,
        echoCancellation: true,
        noiseSuppression: true,
      },
    });

    // Create an AudioContext — browser may give us a higher sample rate
    this.captureContext = new AudioContext({ sampleRate: TARGET_SAMPLE_RATE });
    const actualSampleRate = this.captureContext.sampleRate;

    this.sourceNode = this.captureContext.createMediaStreamSource(this.mediaStream);

    // ScriptProcessorNode with buffer size 4096, mono input, mono output
    this.scriptProcessor = this.captureContext.createScriptProcessor(4096, 1, 1);

    this.scriptProcessor.onaudioprocess = (event: AudioProcessingEvent) => {
      const inputData = event.inputBuffer.getChannelData(0);

      // Downsample if the AudioContext gave us a higher rate
      const downsampled = actualSampleRate !== TARGET_SAMPLE_RATE
        ? downsample(inputData, actualSampleRate, TARGET_SAMPLE_RATE)
        : inputData;

      // Convert to 16-bit PCM LE (what Transcribe expects)
      const pcmBuffer = float32ToPcm16(downsampled);
      onChunk(pcmBuffer);
    };

    this.sourceNode.connect(this.scriptProcessor);
    this.scriptProcessor.connect(this.captureContext.destination);
  }

  stopCapture(): void {
    if (this.scriptProcessor) {
      this.scriptProcessor.disconnect();
      this.scriptProcessor = null;
    }
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
    if (this.captureContext) {
      this.captureContext.close();
      this.captureContext = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((t) => t.stop());
      this.mediaStream = null;
    }
  }

  // ── Playback ─────────────────────────────────────────────

  playAudioChunk(chunk: ArrayBuffer): void {
    if (!this.playbackContext) {
      this.playbackContext = new AudioContext();
    }

    const ctx = this.playbackContext;

    // Resume if suspended (browsers require user gesture)
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    // TTS audio from Polly is raw PCM 16-bit LE at 16kHz
    // We need to decode it into an AudioBuffer
    const pcmData = new Int16Array(chunk);
    const floatData = new Float32Array(pcmData.length);
    for (let i = 0; i < pcmData.length; i++) {
      floatData[i] = pcmData[i] / 32768;
    }

    const audioBuffer = ctx.createBuffer(1, floatData.length, 16000);
    audioBuffer.getChannelData(0).set(floatData);

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);

    // Schedule seamlessly after the last queued chunk
    const startAt = Math.max(ctx.currentTime, this.scheduledTime);
    source.start(startAt);
    this.scheduledTime = startAt + audioBuffer.duration;

    this.activeSources.push(source);
    this.playing = true;

    source.onended = () => {
      const idx = this.activeSources.indexOf(source);
      if (idx !== -1) {
        this.activeSources.splice(idx, 1);
      }
      if (this.activeSources.length === 0) {
        this.playing = false;
      }
    };
  }

  /**
   * Immediately stops all queued/playing audio — critical for barge-in.
   */
  stopPlayback(): void {
    for (const source of this.activeSources) {
      try {
        source.stop();
      } catch {
        // already stopped — ignore
      }
    }
    this.activeSources = [];
    this.scheduledTime = 0;
    this.playing = false;
  }

  isPlaying(): boolean {
    return this.playing;
  }
}

export function createAudioManager(): AudioManager {
  return new AudioManagerImpl();
}
