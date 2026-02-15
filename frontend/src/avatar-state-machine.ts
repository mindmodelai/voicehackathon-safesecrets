import type { AvatarState, AvatarEvent } from '@shared/types';

/**
 * Priority-based avatar state machine.
 * Priority order: listening > speaking > thinking > idle
 *
 * Internal flags track which activities are active so that
 * "end" events can resolve to the correct next state.
 */
export class AvatarStateMachineImpl {
  currentState: AvatarState = 'idle';

  // Internal activity flags
  private isUserSpeaking = false;
  private isTTSActive = false;
  private isThinking = false;

  transition(event: AvatarEvent): AvatarState {
    switch (event.type) {
      case 'USER_SPEAKING_START':
        this.isUserSpeaking = true;
        this.currentState = 'listening';
        break;

      case 'USER_SPEAKING_END':
        this.isUserSpeaking = false;
        this.currentState = this.resolveState();
        break;

      case 'TTS_START':
        this.isTTSActive = true;
        if (!this.isUserSpeaking) {
          this.currentState = 'speaking';
        }
        break;

      case 'TTS_END':
        this.isTTSActive = false;
        if (!this.isUserSpeaking) {
          this.currentState = this.resolveState();
        }
        break;

      case 'THINKING_START':
        this.isThinking = true;
        if (!this.isUserSpeaking && !this.isTTSActive) {
          this.currentState = 'thinking';
        }
        break;

      case 'THINKING_END':
        this.isThinking = false;
        if (!this.isUserSpeaking && !this.isTTSActive) {
          this.currentState = this.resolveState();
        }
        break;
    }

    return this.currentState;
  }

  private resolveState(): AvatarState {
    if (this.isUserSpeaking) return 'listening';
    if (this.isTTSActive) return 'speaking';
    if (this.isThinking) return 'thinking';
    return 'idle';
  }
}

export function createAvatarStateMachine(): AvatarStateMachineImpl {
  return new AvatarStateMachineImpl();
}
