import type { AvatarState, SpeakingStyle } from '../../../shared/types.js';
export interface HeartAvatarProps {
    avatarState: AvatarState;
    speakingStyle: SpeakingStyle;
}
/**
 * Returns the video source path for the given avatar state and speaking style.
 * Speaking state uses style-specific variants; other states use a single video.
 */
export declare function getVideoSourceForState(state: AvatarState, style: SpeakingStyle): string;
/**
 * 3D Heart Avatar component.
 * Renders a looping video element that switches source based on the current
 * AvatarState and SpeakingStyle. Visual states include:
 * - idle: ambient loop
 * - listening: glow animation
 * - thinking: shimmer animation
 * - speaking: style-specific variant (soft, flirty, serious)
 */
export declare function HeartAvatar({ avatarState, speakingStyle }: HeartAvatarProps): import("react/jsx-runtime").JSX.Element;
