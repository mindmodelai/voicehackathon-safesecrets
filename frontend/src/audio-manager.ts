/**
 * AudioManager — handles browser microphone capture and TTS audio playback.
 *
 * Capture: Uses MediaRecorder to grab PCM-like audio chunks from the mic.
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

export class AudioManagerImpl implements AudioManager {
  private mediaStream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;

  private audioContext: AudioContext | null = null;
  /** Scheduled playback end time (in AudioContext seconds) */
  private scheduledTime = 0;
  /** Currently playing source nodes — tracked so stopPlayback can kill them */
  private activeSources: AudioBufferSourceNode[] = [];
  private playing = false;

  // ── Capture ──────────────────────────────────────────────

  async startCapture(onChunk: (chunk: ArrayBuffer) => void): Promise<void> {
    if (this.mediaRecorder) {
      return; // already capturing
    }

    this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });

    const recorder = new MediaRecorder(this.mediaStream);
    this.mediaRecorder = recorder;

    recorder.ondataavailable = (event: BlobEvent) => {
      if (event.data.size > 0) {
        event.data.arrayBuffer().then(onChunk);
      }
    };

    // Request data every 250 ms for low-latency streaming
    recorder.start(250);
  }

  stopCapture(): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
    this.mediaRecorder = null;

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((t) => t.stop());
      this.mediaStream = null;
    }
  }

  // ── Playback ─────────────────────────────────────────────

  playAudioChunk(chunk: ArrayBuffer): void {
    if (!this.audioContext) {
      this.audioContext = new AudioContext();
    }

    const ctx = this.audioContext;

    // Resume if suspended (browsers require user gesture)
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    ctx.decodeAudioData(chunk.slice(0)).then((audioBuffer) => {
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
    });
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
