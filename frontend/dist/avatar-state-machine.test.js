import { describe, it, expect, beforeEach } from 'vitest';
import { createAvatarStateMachine } from './avatar-state-machine';
describe('AvatarStateMachine', () => {
    let sm;
    beforeEach(() => {
        sm = createAvatarStateMachine();
    });
    describe('initial state', () => {
        it('starts in idle state', () => {
            expect(sm.currentState).toBe('idle');
        });
        it('starts with soft style', () => {
            expect(sm.currentStyle).toBe('soft');
        });
    });
    describe('USER_SPEAKING_START', () => {
        it('transitions to listening from idle', () => {
            expect(sm.transition({ type: 'USER_SPEAKING_START' })).toBe('listening');
        });
        it('transitions to listening from speaking (highest priority)', () => {
            sm.transition({ type: 'TTS_START', style: 'flirty' });
            expect(sm.transition({ type: 'USER_SPEAKING_START' })).toBe('listening');
        });
        it('transitions to listening from thinking', () => {
            sm.transition({ type: 'THINKING_START' });
            expect(sm.transition({ type: 'USER_SPEAKING_START' })).toBe('listening');
        });
    });
    describe('USER_SPEAKING_END', () => {
        it('transitions to idle when nothing else active', () => {
            sm.transition({ type: 'USER_SPEAKING_START' });
            expect(sm.transition({ type: 'USER_SPEAKING_END' })).toBe('idle');
        });
        it('transitions to speaking if TTS is active', () => {
            sm.transition({ type: 'TTS_START', style: 'serious' });
            sm.transition({ type: 'USER_SPEAKING_START' });
            expect(sm.transition({ type: 'USER_SPEAKING_END' })).toBe('speaking');
        });
        it('transitions to thinking if thinking is active', () => {
            sm.transition({ type: 'THINKING_START' });
            sm.transition({ type: 'USER_SPEAKING_START' });
            expect(sm.transition({ type: 'USER_SPEAKING_END' })).toBe('thinking');
        });
        it('transitions to speaking over thinking when both active (priority)', () => {
            sm.transition({ type: 'THINKING_START' });
            sm.transition({ type: 'TTS_START', style: 'soft' });
            sm.transition({ type: 'USER_SPEAKING_START' });
            expect(sm.transition({ type: 'USER_SPEAKING_END' })).toBe('speaking');
        });
    });
    describe('TTS_START', () => {
        it('transitions to speaking from idle', () => {
            expect(sm.transition({ type: 'TTS_START', style: 'flirty' })).toBe('speaking');
        });
        it('updates style', () => {
            sm.transition({ type: 'TTS_START', style: 'serious' });
            expect(sm.currentStyle).toBe('serious');
        });
        it('does NOT transition from listening (lower priority)', () => {
            sm.transition({ type: 'USER_SPEAKING_START' });
            expect(sm.transition({ type: 'TTS_START', style: 'flirty' })).toBe('listening');
        });
        it('still records style even when listening blocks transition', () => {
            sm.transition({ type: 'USER_SPEAKING_START' });
            sm.transition({ type: 'TTS_START', style: 'serious' });
            expect(sm.currentStyle).toBe('serious');
        });
    });
    describe('TTS_END', () => {
        it('transitions to idle when nothing else active', () => {
            sm.transition({ type: 'TTS_START', style: 'soft' });
            expect(sm.transition({ type: 'TTS_END' })).toBe('idle');
        });
        it('stays in listening if user is speaking', () => {
            sm.transition({ type: 'USER_SPEAKING_START' });
            sm.transition({ type: 'TTS_START', style: 'soft' });
            expect(sm.transition({ type: 'TTS_END' })).toBe('listening');
        });
        it('transitions to thinking if thinking is active', () => {
            sm.transition({ type: 'THINKING_START' });
            sm.transition({ type: 'TTS_START', style: 'soft' });
            expect(sm.currentState).toBe('speaking');
            expect(sm.transition({ type: 'TTS_END' })).toBe('thinking');
        });
    });
    describe('THINKING_START', () => {
        it('transitions to thinking from idle', () => {
            expect(sm.transition({ type: 'THINKING_START' })).toBe('thinking');
        });
        it('does NOT transition from listening', () => {
            sm.transition({ type: 'USER_SPEAKING_START' });
            expect(sm.transition({ type: 'THINKING_START' })).toBe('listening');
        });
        it('does NOT transition from speaking', () => {
            sm.transition({ type: 'TTS_START', style: 'soft' });
            expect(sm.transition({ type: 'THINKING_START' })).toBe('speaking');
        });
    });
    describe('THINKING_END', () => {
        it('transitions to idle when nothing else active', () => {
            sm.transition({ type: 'THINKING_START' });
            expect(sm.transition({ type: 'THINKING_END' })).toBe('idle');
        });
        it('stays in listening if user is speaking', () => {
            sm.transition({ type: 'USER_SPEAKING_START' });
            sm.transition({ type: 'THINKING_START' });
            expect(sm.transition({ type: 'THINKING_END' })).toBe('listening');
        });
        it('stays in speaking if TTS is active', () => {
            sm.transition({ type: 'TTS_START', style: 'flirty' });
            sm.transition({ type: 'THINKING_START' });
            expect(sm.transition({ type: 'THINKING_END' })).toBe('speaking');
        });
    });
    describe('getVideoSource', () => {
        it('returns idle video in idle state', () => {
            expect(sm.getVideoSource()).toBe('/videos/idle.mp4');
        });
        it('returns listening video in listening state', () => {
            sm.transition({ type: 'USER_SPEAKING_START' });
            expect(sm.getVideoSource()).toBe('/videos/listening.mp4');
        });
        it('returns thinking video in thinking state', () => {
            sm.transition({ type: 'THINKING_START' });
            expect(sm.getVideoSource()).toBe('/videos/thinking.mp4');
        });
        it('returns style-specific speaking video for soft', () => {
            sm.transition({ type: 'TTS_START', style: 'soft' });
            expect(sm.getVideoSource()).toBe('/videos/speaking-soft.mp4');
        });
        it('returns style-specific speaking video for flirty', () => {
            sm.transition({ type: 'TTS_START', style: 'flirty' });
            expect(sm.getVideoSource()).toBe('/videos/speaking-flirty.mp4');
        });
        it('returns style-specific speaking video for serious', () => {
            sm.transition({ type: 'TTS_START', style: 'serious' });
            expect(sm.getVideoSource()).toBe('/videos/speaking-serious.mp4');
        });
    });
    describe('complex sequences', () => {
        it('handles barge-in: speaking → listening → back to idle', () => {
            sm.transition({ type: 'TTS_START', style: 'flirty' });
            expect(sm.currentState).toBe('speaking');
            // User barges in
            sm.transition({ type: 'USER_SPEAKING_START' });
            expect(sm.currentState).toBe('listening');
            // TTS ends during barge-in
            sm.transition({ type: 'TTS_END' });
            expect(sm.currentState).toBe('listening');
            // User stops speaking
            sm.transition({ type: 'USER_SPEAKING_END' });
            expect(sm.currentState).toBe('idle');
        });
        it('handles thinking → speaking → idle flow', () => {
            sm.transition({ type: 'THINKING_START' });
            expect(sm.currentState).toBe('thinking');
            sm.transition({ type: 'TTS_START', style: 'serious' });
            expect(sm.currentState).toBe('speaking');
            sm.transition({ type: 'THINKING_END' });
            expect(sm.currentState).toBe('speaking');
            sm.transition({ type: 'TTS_END' });
            expect(sm.currentState).toBe('idle');
        });
        it('handles full conversation cycle', () => {
            // User speaks
            sm.transition({ type: 'USER_SPEAKING_START' });
            expect(sm.currentState).toBe('listening');
            sm.transition({ type: 'USER_SPEAKING_END' });
            expect(sm.currentState).toBe('idle');
            // System thinks
            sm.transition({ type: 'THINKING_START' });
            expect(sm.currentState).toBe('thinking');
            // System speaks
            sm.transition({ type: 'TTS_START', style: 'soft' });
            expect(sm.currentState).toBe('speaking');
            sm.transition({ type: 'THINKING_END' });
            expect(sm.currentState).toBe('speaking');
            sm.transition({ type: 'TTS_END' });
            expect(sm.currentState).toBe('idle');
        });
    });
});
//# sourceMappingURL=avatar-state-machine.test.js.map