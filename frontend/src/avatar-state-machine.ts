import type { AvatarState, SpeakingStyle, AvatarEvent } from '@shared/types';

/**
 * Priority-based avatar state machine.
 * Priority order: listening > speaking > thinking > idle
 *
 * Internal flags track which activities are active so that
 * "end" events can resolve to the correct next state.
 */
export class AvatarStateMachineImpl {
  currentState: AvatarState = 'idle';
  currentStyle: SpeakingStyle = 'soft';

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
        this.currentStyle = event.style;
        // Only transition if not listening (listening has higher priority)
        if (!this.isUserSpeaking) {
          this.currentState = 'speaking';
        }
        break;

      case 'TTS_END':
        this.isTTSActive = false;
        // Only change state if not in a higher-priority state
        if (!this.isUserSpeaking) {
          this.currentState = this.resolveState();
        }
        break;

      case 'THINKING_START':
        this.isThinking = true;
        // Only transition if not listening or speaking
        if (!this.isUserSpeaking && !this.isTTSActive) {
          this.currentState = 'thinking';
        }
        break;

      case 'THINKING_END':
        this.isThinking = false;
        // Only change state if not in a higher-priority state
        if (!this.isUserSpeaking && !this.isTTSActive) {
          this.currentState = this.resolveState();
        }
        break;
    }

    return this.currentState;
  }

  /**
   * Resolves the current state based on active flags, respecting priority.
   * listening > speaking > thinking > idle
   */
  private resolveState(): AvatarState {
    if (this.isUserSpeaking) return 'listening';
    if (this.isTTSActive) return 'speaking';
    if (this.isThinking) return 'thinking';
    return 'idle';
  }

  /**
   * Returns the video source path for the current state and style.
   * Speaking state uses style-specific variants; other states use a single video.
   */
  getVideoSource(): string {
    if (this.currentState === 'speaking') {
      return `/videos/speaking-${this.currentStyle}.mp4`;
    }
    return `/videos/${this.currentState}.mp4`;
  }
}

export function createAvatarStateMachine(): AvatarStateMachineImpl {
  return new AvatarStateMachineImpl();
}
