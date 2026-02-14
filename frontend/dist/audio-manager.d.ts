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
export declare class AudioManagerImpl implements AudioManager {
    private mediaStream;
    private captureContext;
    private scriptProcessor;
    private sourceNode;
    private playbackContext;
    /** Scheduled playback end time (in AudioContext seconds) */
    private scheduledTime;
    /** Currently playing source nodes — tracked so stopPlayback can kill them */
    private activeSources;
    private playing;
    startCapture(onChunk: (chunk: ArrayBuffer) => void): Promise<void>;
    stopCapture(): void;
    playAudioChunk(chunk: ArrayBuffer): void;
    /**
     * Immediately stops all queued/playing audio — critical for barge-in.
     */
    stopPlayback(): void;
    isPlaying(): boolean;
}
export declare function createAudioManager(): AudioManager;
