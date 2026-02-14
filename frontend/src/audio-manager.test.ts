import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AudioManagerImpl, createAudioManager } from './audio-manager';

// ── Mock helpers ───────────────────────────────────────────

function createMockMediaStream() {
  const track = { stop: vi.fn(), kind: 'audio' };
  return { getTracks: () => [track], _track: track } as unknown as MediaStream;
}

function createMockMediaRecorder() {
  let _state: 'inactive' | 'recording' | 'paused' = 'inactive';
  const instance = {
    get state() { return _state; },
    start: vi.fn((_timeslice?: number) => { _state = 'recording'; }),
    stop: vi.fn(() => { _state = 'inactive'; }),
    ondataavailable: null as ((e: BlobEvent) => void) | null,
  };
  return instance;
}

/** Fires ondataavailable with a mock Blob of the given size */
function fireDataAvailable(recorder: ReturnType<typeof createMockMediaRecorder>, size: number) {
  const buf = new ArrayBuffer(size);
  const blob = {
    size,
    arrayBuffer: () => Promise.resolve(buf),
  };
  recorder.ondataavailable?.({ data: blob } as unknown as BlobEvent);
}

function createMockAudioContext() {
  const sources: MockSourceNode[] = [];

  const ctx = {
    state: 'running' as AudioContextState,
    currentTime: 0,
    destination: {} as AudioDestinationNode,
    resume: vi.fn(async () => {}),
    decodeAudioData: vi.fn(async (_buf: ArrayBuffer) => ({
      duration: 1.0,
    })) as unknown as AudioContext['decodeAudioData'],
    createBufferSource: vi.fn(() => {
      const source: MockSourceNode = {
        buffer: null,
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
        onended: null as (() => void) | null,
      };
      sources.push(source);
      return source as unknown as AudioBufferSourceNode;
    }),
    _sources: sources,
  };

  return ctx;
}

type MockSourceNode = {
  buffer: AudioBuffer | null;
  connect: ReturnType<typeof vi.fn>;
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  onended: (() => void) | null;
};

// ── Tests ──────────────────────────────────────────────────

describe('AudioManager', () => {
  let manager: AudioManagerImpl;
  let mockStream: MediaStream;
  let mockRecorder: ReturnType<typeof createMockMediaRecorder>;
  let mockAudioCtx: ReturnType<typeof createMockAudioContext>;

  beforeEach(() => {
    manager = new AudioManagerImpl();
    mockStream = createMockMediaStream();
    mockRecorder = createMockMediaRecorder();
    mockAudioCtx = createMockAudioContext();

    // Stub navigator.mediaDevices.getUserMedia
    vi.stubGlobal('navigator', {
      mediaDevices: {
        getUserMedia: vi.fn(async () => mockStream),
      },
    });

    // Stub MediaRecorder constructor
    vi.stubGlobal('MediaRecorder', vi.fn(() => mockRecorder));

    // Stub AudioContext constructor
    vi.stubGlobal('AudioContext', vi.fn(() => mockAudioCtx));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // ── Factory ──

  it('createAudioManager returns an AudioManagerImpl', () => {
    const am = createAudioManager();
    expect(am).toBeInstanceOf(AudioManagerImpl);
  });

  // ── Capture ──

  describe('startCapture', () => {
    it('requests microphone access', async () => {
      await manager.startCapture(vi.fn());
      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({ audio: true });
    });

    it('starts MediaRecorder with 250ms timeslice', async () => {
      await manager.startCapture(vi.fn());
      expect(mockRecorder.start).toHaveBeenCalledWith(250);
    });

    it('forwards audio chunks via onChunk callback', async () => {
      const onChunk = vi.fn();
      await manager.startCapture(onChunk);

      // Simulate data available
      fireDataAvailable(mockRecorder, 1024);

      // onChunk is called asynchronously (blob.arrayBuffer())
      await vi.waitFor(() => expect(onChunk).toHaveBeenCalledTimes(1));
      expect(onChunk).toHaveBeenCalledWith(expect.any(ArrayBuffer));
    });

    it('ignores zero-size blobs', async () => {
      const onChunk = vi.fn();
      await manager.startCapture(onChunk);

      fireDataAvailable(mockRecorder, 0);

      // Give the promise a tick to resolve (it shouldn't)
      await new Promise((r) => setTimeout(r, 10));
      expect(onChunk).not.toHaveBeenCalled();
    });

    it('does nothing if already capturing', async () => {
      await manager.startCapture(vi.fn());
      await manager.startCapture(vi.fn());
      // getUserMedia should only be called once
      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(1);
    });
  });

  describe('stopCapture', () => {
    it('stops the MediaRecorder and media tracks', async () => {
      await manager.startCapture(vi.fn());
      manager.stopCapture();

      expect(mockRecorder.stop).toHaveBeenCalled();
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
      expect(AudioContext).toHaveBeenCalledTimes(1);
    });

    it('reuses the same AudioContext on subsequent calls', () => {
      manager.playAudioChunk(new ArrayBuffer(16));
      manager.playAudioChunk(new ArrayBuffer(16));
      expect(AudioContext).toHaveBeenCalledTimes(1);
    });

    it('decodes audio data and schedules playback', async () => {
      manager.playAudioChunk(new ArrayBuffer(16));

      // decodeAudioData is async — wait for the source to be created
      await vi.waitFor(() => expect(mockAudioCtx._sources.length).toBe(1));

      const source = mockAudioCtx._sources[0];
      expect(source.connect).toHaveBeenCalledWith(mockAudioCtx.destination);
      expect(source.start).toHaveBeenCalled();
    });

    it('sets isPlaying to true after scheduling', async () => {
      expect(manager.isPlaying()).toBe(false);
      manager.playAudioChunk(new ArrayBuffer(16));

      await vi.waitFor(() => expect(manager.isPlaying()).toBe(true));
    });

    it('sets isPlaying to false when all sources end', async () => {
      manager.playAudioChunk(new ArrayBuffer(16));

      await vi.waitFor(() => expect(mockAudioCtx._sources.length).toBe(1));

      // Simulate source ending
      mockAudioCtx._sources[0].onended?.();
      expect(manager.isPlaying()).toBe(false);
    });

    it('resumes suspended AudioContext', async () => {
      mockAudioCtx.state = 'suspended' as AudioContextState;
      manager.playAudioChunk(new ArrayBuffer(16));

      expect(mockAudioCtx.resume).toHaveBeenCalled();
    });

    it('schedules chunks sequentially without overlap', async () => {
      mockAudioCtx.currentTime = 0;

      manager.playAudioChunk(new ArrayBuffer(16));
      await vi.waitFor(() => expect(mockAudioCtx._sources.length).toBe(1));

      manager.playAudioChunk(new ArrayBuffer(16));
      await vi.waitFor(() => expect(mockAudioCtx._sources.length).toBe(2));

      // First chunk starts at 0, second at 0 + 1.0 (duration)
      expect(mockAudioCtx._sources[0].start).toHaveBeenCalledWith(0);
      expect(mockAudioCtx._sources[1].start).toHaveBeenCalledWith(1.0);
    });
  });

  describe('stopPlayback', () => {
    it('stops all active source nodes immediately', async () => {
      manager.playAudioChunk(new ArrayBuffer(16));
      manager.playAudioChunk(new ArrayBuffer(16));

      await vi.waitFor(() => expect(mockAudioCtx._sources.length).toBe(2));

      manager.stopPlayback();

      expect(mockAudioCtx._sources[0].stop).toHaveBeenCalled();
      expect(mockAudioCtx._sources[1].stop).toHaveBeenCalled();
    });

    it('sets isPlaying to false', async () => {
      manager.playAudioChunk(new ArrayBuffer(16));
      await vi.waitFor(() => expect(manager.isPlaying()).toBe(true));

      manager.stopPlayback();
      expect(manager.isPlaying()).toBe(false);
    });

    it('resets scheduled time so next chunk starts fresh', async () => {
      manager.playAudioChunk(new ArrayBuffer(16));
      await vi.waitFor(() => expect(mockAudioCtx._sources.length).toBe(1));

      manager.stopPlayback();

      // Next chunk should start at currentTime, not at the old scheduledTime
      mockAudioCtx.currentTime = 5;
      manager.playAudioChunk(new ArrayBuffer(16));

      // _sources accumulates across the mock — first call added 1, now we expect 2
      await vi.waitFor(() => expect(mockAudioCtx._sources.length).toBe(2));

      // The new source (index 1) should start at currentTime (5), not at old scheduled time
      expect(mockAudioCtx._sources[1].start).toHaveBeenCalledWith(5);
    });

    it('is safe to call when nothing is playing', () => {
      expect(() => manager.stopPlayback()).not.toThrow();
    });

    it('handles sources that are already stopped', async () => {
      manager.playAudioChunk(new ArrayBuffer(16));
      await vi.waitFor(() => expect(mockAudioCtx._sources.length).toBe(1));

      // Make stop throw (simulating already-stopped source)
      mockAudioCtx._sources[0].stop.mockImplementation(() => {
        throw new Error('already stopped');
      });

      expect(() => manager.stopPlayback()).not.toThrow();
    });
  });

  // ── isPlaying ──

  describe('isPlaying', () => {
    it('returns false initially', () => {
      expect(manager.isPlaying()).toBe(false);
    });

    it('returns true while sources are active', async () => {
      manager.playAudioChunk(new ArrayBuffer(16));
      await vi.waitFor(() => expect(manager.isPlaying()).toBe(true));
    });

    it('returns false after stopPlayback', async () => {
      manager.playAudioChunk(new ArrayBuffer(16));
      await vi.waitFor(() => expect(manager.isPlaying()).toBe(true));
      manager.stopPlayback();
      expect(manager.isPlaying()).toBe(false);
    });
  });
});
