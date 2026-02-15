import { describe, it, expect, beforeEach } from 'vitest';
import { AvatarStateMachineImpl } from './avatar-state-machine';

describe('AvatarStateMachine', () => {
  let sm: AvatarStateMachineImpl;

  beforeEach(() => {
    sm = new AvatarStateMachineImpl();
  });

  describe('Initial state', () => {
    it('starts in idle state', () => {
      expect(sm.currentState).toBe('idle');
    });
  });

  describe('Priority: listening > speaking > thinking > idle', () => {
    it('transitions to listening when user starts speaking', () => {
      sm.transition({ type: 'TTS_START' });
      expect(sm.transition({ type: 'USER_SPEAKING_START' })).toBe('listening');
    });

    it('stays in listening even if TTS starts', () => {
      sm.transition({ type: 'USER_SPEAKING_START' });
      expect(sm.transition({ type: 'TTS_START' })).toBe('listening');
    });

    it('stays in listening even if thinking starts', () => {
      sm.transition({ type: 'USER_SPEAKING_START' });
      expect(sm.transition({ type: 'THINKING_START' })).toBe('listening');
    });

    it('transitions to speaking when TTS starts (if not listening)', () => {
      expect(sm.transition({ type: 'TTS_START' })).toBe('speaking');
    });

    it('transitions to thinking when thinking starts (if not listening or speaking)', () => {
      expect(sm.transition({ type: 'THINKING_START' })).toBe('thinking');
    });
  });

  describe('Resolving state after activities end', () => {
    it('returns to idle when user stops speaking and nothing else is active', () => {
      sm.transition({ type: 'USER_SPEAKING_START' });
      expect(sm.transition({ type: 'USER_SPEAKING_END' })).toBe('idle');
    });

    it('returns to speaking when user stops speaking but TTS is active', () => {
      sm.transition({ type: 'TTS_START' });
      sm.transition({ type: 'USER_SPEAKING_START' });
      expect(sm.transition({ type: 'USER_SPEAKING_END' })).toBe('speaking');
    });

    it('returns to thinking when user stops speaking and TTS ends but thinking is active', () => {
      sm.transition({ type: 'THINKING_START' });
      sm.transition({ type: 'TTS_START' });
      sm.transition({ type: 'USER_SPEAKING_START' });
      sm.transition({ type: 'USER_SPEAKING_END' });
      expect(sm.transition({ type: 'TTS_END' })).toBe('thinking');
    });

    it('returns to idle when TTS ends and nothing else is active', () => {
      sm.transition({ type: 'TTS_START' });
      expect(sm.transition({ type: 'TTS_END' })).toBe('idle');
    });

    it('returns to idle when thinking ends and nothing else is active', () => {
      sm.transition({ type: 'THINKING_START' });
      expect(sm.transition({ type: 'THINKING_END' })).toBe('idle');
    });
  });

  describe('Barge-in scenarios', () => {
    it('interrupts speaking when user starts speaking', () => {
      sm.transition({ type: 'TTS_START' });
      expect(sm.currentState).toBe('speaking');
      sm.transition({ type: 'USER_SPEAKING_START' });
      expect(sm.currentState).toBe('listening');
    });

    it('stays in listening when TTS ends during user speech', () => {
      sm.transition({ type: 'TTS_START' });
      sm.transition({ type: 'USER_SPEAKING_START' });
      expect(sm.transition({ type: 'TTS_END' })).toBe('listening');
    });

    it('interrupts thinking when user starts speaking', () => {
      sm.transition({ type: 'THINKING_START' });
      expect(sm.currentState).toBe('thinking');
      sm.transition({ type: 'USER_SPEAKING_START' });
      expect(sm.currentState).toBe('listening');
    });
  });

  describe('Complex multi-activity scenarios', () => {
    it('handles overlapping TTS and thinking correctly', () => {
      sm.transition({ type: 'THINKING_START' });
      expect(sm.currentState).toBe('thinking');
      sm.transition({ type: 'TTS_START' });
      expect(sm.currentState).toBe('speaking');
      sm.transition({ type: 'TTS_END' });
      expect(sm.currentState).toBe('thinking');
      sm.transition({ type: 'THINKING_END' });
      expect(sm.currentState).toBe('idle');
    });

    it('handles all activities starting and ending in sequence', () => {
      sm.transition({ type: 'USER_SPEAKING_START' });
      sm.transition({ type: 'TTS_START' });
      sm.transition({ type: 'THINKING_START' });
      expect(sm.currentState).toBe('listening');

      sm.transition({ type: 'USER_SPEAKING_END' });
      expect(sm.currentState).toBe('speaking');

      sm.transition({ type: 'TTS_END' });
      expect(sm.currentState).toBe('thinking');

      sm.transition({ type: 'THINKING_END' });
      expect(sm.currentState).toBe('idle');
    });
  });
});
