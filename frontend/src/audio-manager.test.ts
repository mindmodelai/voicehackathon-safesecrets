import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AudioManagerImpl, createAudioManager } from './audio-manager';

// ── Mock helpers ───────────────────────────────────────────

function createMockMediaStream() {
  const track = { stop: vi.fn(), kind: 'audio' };
  return { getTracks: () => [track], _track: track } as unknown as MediaStream;
}

function createMockScriptProcessor() {
  return {
    onaudioprocess: null as ((e: AudioProcessingEvent) => void) | null,
    connect: vi.fn(),
    disconnect: vi.fn(),
  };
}

function createMockSourceNode() {
  return {
    connect: vi.fn(),
    disconnect: vi.fn(),
  };
}

type MockSourceNode = {
  buffer: AudioBuffer | null;
  connect: ReturnType<typeof vi.fn>;
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  onended: (() => void) | null;
};

/**
 * Creates a mock AudioContext that supports both capture and playback APIs.
 * Each call to createFullMockContext() returns a fresh instance.
 */
function createFullMockContext(
  scriptProcessor: ReturnType<typeof createMockScriptProcessor>,
  sourceNode: ReturnType<typeof createMockSourceNode>,
) {
  const bufferSources: MockSourceNode[] = [];
  const channelData = new Float32Array(128);
  const mockAudioBuffer = {
    duration: 0.5,
    getChannelData: vi.fn(() => channelData),
  };

  return {
    // Capture APIs
    sampleRate: 16000,
    destination: {} as AudioDestinationNode,
    createMediaStreamSource: vi.fn(() => sourceNode),
    createScriptProcessor: vi.fn(() => scriptProcessor),
    close: vi.fn(),
    // Playback APIs
    state: 'running' as AudioContextState,
    currentTime: 0,
    resume: vi.fn(async () => {}),
    createBuffer: vi.fn(() => mockAudioBuffer),
    createBufferSource: vi.fn(() => {
      const src: MockSourceNode = {
        buffer: null,
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
        onended: null,
      };
      bufferSources.push(src);
      return src as unknown as AudioBufferSourceNode;
    }),
    _sources: bufferSources,
  };
}

/** Simulates an onaudioprocess event */
function fireAudioProcess(sp: ReturnType<typeof createMockScriptProcessor>, length: number) {
  sp.onaudioprocess?.({
    inputBuffer: { getChannelData: () => new Float32Array(length) },
  } as unknown as AudioProcessingEvent);
}

// ── Tests ──────────────────────────────────────────────────

describe('AudioManager', () => {
  let manager: AudioManagerImpl;
  let mockStream: MediaStream;
  let mockSP: ReturnType<typeof createMockScriptProcessor>;
  let mockSrcNode: ReturnType<typeof createMockSourceNode>;
  let mockCtx: ReturnType<typeof createFullMockContext>;

  beforeEach(() => {
    manager = new AudioManagerImpl();
    mockStream = createMockMediaStream();
    mockSP = createMockScriptProcessor();
    mockSrcNode = createMockSourceNode();
    mockCtx = createFullMockContext(mockSP, mockSrcNode);

    vi.stubGlobal('navigator', {
      mediaDevices: { getUserMedia: vi.fn(async () => mockStream) },
    });
    vi.stubGlobal('AudioContext', vi.fn(() => mockCtx));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('createAudioManager returns an AudioManagerImpl', () => {
    expect(createAudioManager()).toBeInstanceOf(AudioManagerImpl);
  });

  // ── Capture ──

  describe('startCapture', () => {
    it('requests microphone access', async () => {
      await manager.startCapture(vi.fn());
      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith(
        expect.objectContaining({ audio: expect.objectContaining({ channelCount: 1 }) }),
      );
    });

    it('creates ScriptProcessorNode and connects source', async () => {
      await manager.startCapture(vi.fn());
      expect(mockCtx.createMediaStreamSource).toHaveBeenCalled();
      expect(mockCtx.createScriptProcessor).toHaveBeenCalledWith(4096, 1, 1);
      expect(mockSrcNode.connect).toHaveBeenCalled();
      expect(mockSP.connect).toHaveBeenCalledWith(mockCtx.destination);
    });

    it('forwards PCM audio chunks via onChunk callback', async () => {
      const onChunk = vi.fn();
      await manager.startCapture(onChunk);
      fireAudioProcess(mockSP, 128);
      expect(onChunk).toHaveBeenCalledTimes(1);
      expect(onChunk).toHaveBeenCalledWith(expect.any(ArrayBuffer));
      // 128 samples * 2 bytes = 256 bytes PCM
      expect(onChunk.mock.calls[0][0].byteLength).toBe(256);
    });

    it('does nothing if already capturing', async () => {
      await manager.startCapture(vi.fn());
      await manager.startCapture(vi.fn());
      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(1);
    });
  });

  describe('stopCapture', () => {
    it('disconnects processor, source, closes context, and stops tracks', async () => {
      await manager.startCapture(vi.fn());
      manager.stopCapture();
      expect(mockSP.disconnect).toHaveBeenCalled();
      expect(mockSrcNode.disconnect).toHaveBeenCalled();
      expect(mockCtx.close).toHaveBeenCalled();
      expect((mockStream as any)._track.stop).toHaveBeenCalled();
    });

    it('is safe to call when not capturing', () => {
      expect(() => manager.stopCapture()).not.toThrow();
    });

    it('allows starting capture again after stop', async () => {
      await manager.startCapture(vi.fn());
      manager.stopCapture();
      await manager.startCapture(vi.fn());
      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(2);
    });
  });

  // ── Playback ──

  describe('playAudioChunk', () => {
    it('creates an AudioContext on first call', () => {
      manager.playAudioChunk(new ArrayBuffer(16));
      expect(AudioContext).toHaveBeenCalled();
    });

    it('reuses the same AudioContext on subsequent calls', () => {
      manager.playAudioChunk(new ArrayBuffer(16));
      manager.playAudioChunk(new ArrayBuffer(16));
      // Only 1 call for playback context
      expect(AudioContext).toHaveBeenCalledTimes(1);
    });

    it('decodes raw PCM and schedules playback', () => {
      const chunk = new ArrayBuffer(8); // 4 Int16 samples
      manager.playAudioChunk(chunk);

      expect(mockCtx.createBuffer).toHaveBeenCalledWith(1, 4, 16000);
      expect(mockCtx._sources.length).toBe(1);
      const source = mockCtx._sources[0];
      expect(source.connect).toHaveBeenCalledWith(mockCtx.destination);
      expect(source.start).toHaveBeenCalled();
    });

    it('sets isPlaying to true after scheduling', () => {
      expect(manager.isPlaying()).toBe(false);
      manager.playAudioChunk(new ArrayBuffer(16));
      expect(manager.isPlaying()).toBe(true);
    });

    it('sets isPlaying to false when all sources end', () => {
      manager.playAudioChunk(new ArrayBuffer(16));
      expect(mockCtx._sources.length).toBe(1);
      mockCtx._sources[0].onended?.();
      expect(manager.isPlaying()).toBe(false);
    });

    it('resumes suspended AudioContext', () => {
      mockCtx.state = 'suspended' as AudioContextState;
      manager.playAudioChunk(new ArrayBuffer(16));
      expect(mockCtx.resume).toHaveBeenCalled();
    });

    it('schedules chunks sequentially without overlap', () => {
      mockCtx.currentTime = 0;
      manager.playAudioChunk(new ArrayBuffer(16));
      expect(mockCtx._sources.length).toBe(1);
      manager.playAudioChunk(new ArrayBuffer(16));
      expect(mockCtx._sources.length).toBe(2);
      expect(mockCtx._sources[0].start).toHaveBeenCalledWith(0);
      expect(mockCtx._sources[1].start).toHaveBeenCalledWith(0.5);
    });
  });

  describe('stopPlayback', () => {
    it('stops all active source nodes immediately', () => {
      manager.playAudioChunk(new ArrayBuffer(16));
      manager.playAudioChunk(new ArrayBuffer(16));
      expect(mockCtx._sources.length).toBe(2);
      manager.stopPlayback();
      expect(mockCtx._sources[0].stop).toHaveBeenCalled();
      expect(mockCtx._sources[1].stop).toHaveBeenCalled();
    });

    it('sets isPlaying to false', () => {
      manager.playAudioChunk(new ArrayBuffer(16));
      expect(manager.isPlaying()).toBe(true);
      manager.stopPlayback();
      expect(manager.isPlaying()).toBe(false);
    });

    it('resets scheduled time so next chunk starts fresh', () => {
      manager.playAudioChunk(new ArrayBuffer(16));
      manager.stopPlayback();
      mockCtx.currentTime = 5;
      manager.playAudioChunk(new ArrayBuffer(16));
      expect(mockCtx._sources.length).toBe(2);
      expect(mockCtx._sources[1].start).toHaveBeenCalledWith(5);
    });

    it('is safe to call when nothing is playing', () => {
      expect(() => manager.stopPlayback()).not.toThrow();
    });

    it('handles sources that are already stopped', () => {
      manager.playAudioChunk(new ArrayBuffer(16));
      mockCtx._sources[0].stop.mockImplementation(() => { throw new Error('already stopped'); });
      expect(() => manager.stopPlayback()).not.toThrow();
    });
  });

  describe('isPlaying', () => {
    it('returns false initially', () => {
      expect(manager.isPlaying()).toBe(false);
    });

    it('returns true while sources are active', () => {
      manager.playAudioChunk(new ArrayBuffer(16));
      expect(manager.isPlaying()).toBe(true);
    });

    it('returns false after stopPlayback', () => {
      manager.playAudioChunk(new ArrayBuffer(16));
      manager.stopPlayback();
      expect(manager.isPlaying()).toBe(false);
    });
  });

  describe('addPlaybackListener', () => {
    it('notifies listeners when playback starts', () => {
      const listener = vi.fn();
      manager.addPlaybackListener(listener);
      manager.playAudioChunk(new ArrayBuffer(16));
      expect(listener).toHaveBeenCalledWith(true);
    });

    it('notifies listeners when playback ends naturally', () => {
      const listener = vi.fn();
      manager.addPlaybackListener(listener);
      manager.playAudioChunk(new ArrayBuffer(16));
      expect(listener).toHaveBeenCalledWith(true);

      mockCtx._sources[0].onended?.();
      expect(listener).toHaveBeenCalledWith(false);
    });

    it('notifies listeners when playback is stopped manually', () => {
      const listener = vi.fn();
      manager.addPlaybackListener(listener);
      manager.playAudioChunk(new ArrayBuffer(16));
      manager.stopPlayback();
      expect(listener).toHaveBeenCalledWith(false);
    });

    it('does not notify repeatedly if already playing', () => {
      const listener = vi.fn();
      manager.addPlaybackListener(listener);
      manager.playAudioChunk(new ArrayBuffer(16));
      manager.playAudioChunk(new ArrayBuffer(16));
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(true);
    });

    it('allows unsubscribing', () => {
      const listener = vi.fn();
      const unsubscribe = manager.addPlaybackListener(listener);
      unsubscribe();
      manager.playAudioChunk(new ArrayBuffer(16));
      expect(listener).not.toHaveBeenCalled();
    });
  });
});
