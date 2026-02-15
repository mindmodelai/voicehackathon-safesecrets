import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { AvatarStateMachineImpl } from './avatar-state-machine';
import type { AvatarEvent, AvatarState } from '@shared/types';

/**
 * Property-based tests for avatar state machine.
 * Tests universal correctness properties using fast-check.
 */

describe('AvatarStateMachine - Property Tests', () => {
  /**
   * Property 1: State machine always returns a valid state
   */
  it('Property 1: always returns a valid AvatarState', () => {
    const eventArb = fc.constantFrom<AvatarEvent['type']>(
      'USER_SPEAKING_START',
      'USER_SPEAKING_END',
      'TTS_START',
      'TTS_END',
      'THINKING_START',
      'THINKING_END'
    );

    fc.assert(
      fc.property(fc.array(eventArb, { minLength: 1, maxLength: 20 }), (events) => {
        const sm = new AvatarStateMachineImpl();
        const validStates: AvatarState[] = ['idle', 'listening', 'thinking', 'speaking'];

        for (const eventType of events) {
          const state = sm.transition({ type: eventType });
          expect(validStates).toContain(state);
        }
      })
    );
  });

  /**
   * Property 2: Listening has highest priority
   * USER_SPEAKING_START always results in listening state
   */
  it('Property 2: USER_SPEAKING_START always results in listening', () => {
    const setupEventsArb = fc.array(
      fc.constantFrom<AvatarEvent['type']>(
        'TTS_START',
        'THINKING_START'
      ),
      { maxLength: 5 }
    );

    fc.assert(
      fc.property(setupEventsArb, (setupEvents) => {
        const sm = new AvatarStateMachineImpl();
        
        // Apply setup events
        for (const eventType of setupEvents) {
          sm.transition({ type: eventType });
        }

        // USER_SPEAKING_START should always result in listening
        const state = sm.transition({ type: 'USER_SPEAKING_START' });
        expect(state).toBe('listening');
      })
    );
  });

  /**
   * Property 3: State machine is deterministic
   * Same sequence of events always produces same final state
   */
  it('Property 3: deterministic - same events produce same state', () => {
    const eventArb = fc.constantFrom<AvatarEvent['type']>(
      'USER_SPEAKING_START',
      'USER_SPEAKING_END',
      'TTS_START',
      'TTS_END',
      'THINKING_START',
      'THINKING_END'
    );

    fc.assert(
      fc.property(fc.array(eventArb, { minLength: 1, maxLength: 15 }), (events) => {
        const sm1 = new AvatarStateMachineImpl();
        const sm2 = new AvatarStateMachineImpl();

        let state1: AvatarState = 'idle';
        let state2: AvatarState = 'idle';

        for (const eventType of events) {
          state1 = sm1.transition({ type: eventType });
          state2 = sm2.transition({ type: eventType });
        }

        expect(state1).toBe(state2);
        expect(sm1.currentState).toBe(sm2.currentState);
      })
    );
  });

  /**
   * Property 4: Priority order is maintained
   * listening > speaking > thinking > idle
   */
  it('Property 4: priority order is maintained', () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        fc.boolean(),
        fc.boolean(),
        (userSpeaking, ttsActive, thinking) => {
          const sm = new AvatarStateMachineImpl();

          // Set up the state
          if (thinking) sm.transition({ type: 'THINKING_START' });
          if (ttsActive) sm.transition({ type: 'TTS_START' });
          if (userSpeaking) sm.transition({ type: 'USER_SPEAKING_START' });

          // Verify priority
          if (userSpeaking) {
            expect(sm.currentState).toBe('listening');
          } else if (ttsActive) {
            expect(sm.currentState).toBe('speaking');
          } else if (thinking) {
            expect(sm.currentState).toBe('thinking');
          } else {
            expect(sm.currentState).toBe('idle');
          }
        }
      )
    );
  });

  /**
   * Property 5: Ending an activity resolves to correct next state
   */
  it('Property 5: ending activities resolves correctly', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<'USER_SPEAKING_END' | 'TTS_END' | 'THINKING_END'>(
          'USER_SPEAKING_END',
          'TTS_END',
          'THINKING_END'
        ),
        (endEvent) => {
          const sm = new AvatarStateMachineImpl();

          // Start all activities
          sm.transition({ type: 'THINKING_START' });
          sm.transition({ type: 'TTS_START' });
          sm.transition({ type: 'USER_SPEAKING_START' });

          // Should be listening (highest priority)
          expect(sm.currentState).toBe('listening');

          // End one activity
          const state = sm.transition({ type: endEvent });

          // State should still be valid
          expect(['idle', 'listening', 'thinking', 'speaking']).toContain(state);
        }
      )
    );
  });
});
