import { jsx as _jsx } from "react/jsx-runtime";
import { useRef, useEffect } from 'react';
import styles from './HeartAvatar.module.css';
/**
 * Returns the video source path for the given avatar state and speaking style.
 * Speaking state uses style-specific variants; other states use a single video.
 */
export function getVideoSourceForState(state, style) {
    if (state === 'speaking') {
        return `/videos/speaking-${style}.mp4`;
    }
    return `/videos/${state}.mp4`;
}
/**
 * 3D Heart Avatar component.
 * Renders a looping video element that switches source based on the current
 * AvatarState and SpeakingStyle. Visual states include:
 * - idle: ambient loop
 * - listening: glow animation
 * - thinking: shimmer animation
 * - speaking: style-specific variant (soft, flirty, serious)
 */
export function HeartAvatar({ avatarState, speakingStyle }) {
    const videoRef = useRef(null);
    const videoSrc = getVideoSourceForState(avatarState, speakingStyle);
    useEffect(() => {
        const video = videoRef.current;
        if (!video)
            return;
        // Only reload when the source actually changes
        if (video.getAttribute('src') !== videoSrc) {
            video.src = videoSrc;
            video.load();
            video.play().catch(() => {
                // Autoplay may be blocked by browser policy — silently ignore
            });
        }
    }, [videoSrc]);
    return (_jsx("div", { className: `${styles.avatar} heart-avatar heart-avatar--${avatarState}`, "data-style": speakingStyle, role: "img", "aria-label": `Heart avatar — ${avatarState}`, children: _jsx("video", { ref: videoRef, src: videoSrc, loop: true, autoPlay: true, muted: true, playsInline: true, "data-testid": "heart-avatar-video", "aria-hidden": "true" }) }));
}
//# sourceMappingURL=HeartAvatar.js.map