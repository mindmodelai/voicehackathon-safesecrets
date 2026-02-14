import type { AvatarState, SpeakingStyle, AvatarEvent } from '@shared/types';
/**
 * Priority-based avatar state machine.
 * Priority order: listening > speaking > thinking > idle
 *
 * Internal flags track which activities are active so that
 * "end" events can resolve to the correct next state.
 */
export declare class AvatarStateMachineImpl {
    currentState: AvatarState;
    currentStyle: SpeakingStyle;
    private isUserSpeaking;
    private isTTSActive;
    private isThinking;
    transition(event: AvatarEvent): AvatarState;
    /**
     * Resolves the current state based on active flags, respecting priority.
     * listening > speaking > thinking > idle
     */
    private resolveState;
    /**
     * Returns the video source path for the current state and style.
     * Speaking state uses style-specific variants; other states use a single video.
     */
    getVideoSource(): string;
}
export declare function createAvatarStateMachine(): AvatarStateMachineImpl;
