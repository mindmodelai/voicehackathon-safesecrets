import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { createAvatarStateMachine } from './avatar-state-machine';
import type { AvatarEvent, SpeakingStyle } from '../../shared/types';

/**
 * Property tests for Avatar State Machine
 * Tests universal correctness properties using fast-check
 */

describe('Avatar State Machine - Property Tests', () => {
  /**
   * Property 1: Avatar state machine priority invariant
   * Priority order: listening > speaking > thinking > idle
   * 
   * No matter what sequence of events occurs, the priority order must never be violated.
   */
  it('Property 1: maintains priority order (listening > speaking > thinking > idle)', () => {
    const speakingStyleArb = fc.constantFrom<SpeakingStyle>('soft', 'flirty', 'serious');
    
    const avatarEventArb = fc.oneof(
      fc.constant<AvatarEvent>({ type: 'USER_SPEAKING_START' }),
      fc.constant<AvatarEvent>({ type: 'USER_SPEAKING_END' }),
      fc.record({
        type: fc.constant('TTS_START' as const),
        style: speakingStyleArb,
      }),
      fc.constant<AvatarEvent>({ type: 'TTS_END' }),
      fc.constant<AvatarEvent>({ type: 'THINKING_START' }),
      fc.constant<AvatarEvent>({ type: 'THINKING_END' })
    );

    fc.assert(
      fc.property(fc.array(avatarEventArb, { minLength: 1, maxLength: 20 }), (events) => {
        const sm = createAvatarStateMachine();
        
        // Track which activities are currently active
        let userSpeaking = false;
        let ttsActive = false;
        let thinking = false;

        for (const event of events) {
          // Update activity flags
          if (event.type === 'USER_SPEAKING_START') userSpeaking = true;
          if (event.type === 'USER_SPEAKING_END') userSpeaking = false;
          if (event.type === 'TTS_START') ttsActive = true;
          if (event.type === 'TTS_END') ttsActive = false;
          if (event.type === 'THINKING_START') thinking = true;
          if (event.type === 'THINKING_END') thinking = false;

          const state = sm.transition(event);

          // Verify priority order is respected
          if (userSpeaking) {
            expect(state).toBe('listening');
          } else if (ttsActive) {
            expect(state).toBe('speaking');
          } else if (thinking) {
            expect(state).toBe('thinking');
          } else {
            expect(state).toBe('idle');
          }
        }
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 2: Speaking style selects correct video source
   * 
   * When in speaking state, the video source must match the current style.
   * For other states, video source should match the state name.
   */
  it('Property 2: video source matches state and style', () => {
    const speakingStyleArb = fc.constantFrom<SpeakingStyle>('soft', 'flirty', 'serious');

    fc.assert(
      fc.property(speakingStyleArb, (style) => {
        const sm = createAvatarStateMachine();
        
        // Transition to speaking state with the given style
        sm.transition({ type: 'TTS_START', style });
        
        const videoSource = sm.getVideoSource();
        expect(videoSource).toBe(`/videos/speaking-${style}.mp4`);
      }),
      { numRuns: 50 }
    );
  });

  /**
   * Property 2 (extended): Non-speaking states use state-based video source
   */
  it('Property 2 (extended): non-speaking states use correct video source', () => {
    const sm = createAvatarStateMachine();

    // Test idle state
    expect(sm.getVideoSource()).toBe('/videos/idle.mp4');

    // Test listening state
    sm.transition({ type: 'USER_SPEAKING_START' });
    expect(sm.getVideoSource()).toBe('/videos/listening.mp4');

    // Test thinking state
    sm.transition({ type: 'USER_SPEAKING_END' });
    sm.transition({ type: 'THINKING_START' });
    expect(sm.getVideoSource()).toBe('/videos/thinking.mp4');
  });

  /**
   * Additional property: State machine is deterministic
   * Same sequence of events always produces same final state
   */
  it('Additional: state machine is deterministic', () => {
    const speakingStyleArb = fc.constantFrom<SpeakingStyle>('soft', 'flirty', 'serious');
    
    const avatarEventArb = fc.oneof(
      fc.constant<AvatarEvent>({ type: 'USER_SPEAKING_START' }),
      fc.constant<AvatarEvent>({ type: 'USER_SPEAKING_END' }),
      fc.record({
        type: fc.constant('TTS_START' as const),
        style: speakingStyleArb,
      }),
      fc.constant<AvatarEvent>({ type: 'TTS_END' }),
      fc.constant<AvatarEvent>({ type: 'THINKING_START' }),
      fc.constant<AvatarEvent>({ type: 'THINKING_END' })
    );

    fc.assert(
      fc.property(fc.array(avatarEventArb, { minLength: 1, maxLength: 15 }), (events) => {
        const sm1 = createAvatarStateMachine();
        const sm2 = createAvatarStateMachine();

        let finalState1;
        let finalState2;

        for (const event of events) {
          finalState1 = sm1.transition(event);
          finalState2 = sm2.transition(event);
        }

        expect(finalState1).toBe(finalState2);
        expect(sm1.getVideoSource()).toBe(sm2.getVideoSource());
      }),
      { numRuns: 100 }
    );
  });
});
