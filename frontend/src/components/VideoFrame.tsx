import { useRef, useEffect, useState } from 'react';
import type { AvatarState } from '../../../shared/types.js';
import type { Phoneme } from '../../../shared/types.js';
import styles from './VideoFrame.module.css';

export interface VideoFrameProps {
  avatarState: AvatarState;
  phoneme?: Phoneme | string;
  /** True when the Web Audio scheduler is actively playing TTS audio */
  isAudioPlaying: boolean;
}

const PHONEME_VIDEOS: Record<string, string> = {
  MBP: '/videos/MBP-compressed.mp4',
  TDNL: '/videos/TDNL-compressed.mp4',
  AHAA: '/videos/AHAA-compressed.mp4',
  OUW: '/videos/OUW-compressed.mp4',
  EE: '/videos/EE-compressed.mp4',
  FV: '/videos/FV-compressed.mp4',
};

/**
 * Video rules:
 * 1. Idle video ALWAYS plays as the base layer (prevents layout shift)
 * 2. Audio playing + valid phoneme → phoneme overlay plays once, then conversation-looping overlay
 * 3. Audio playing + no phoneme   → conversation-looping overlay
 * 4. No audio + thinking          → thinking overlay
 * 5. No audio + idle              → only idle base visible (overlays hidden)
 */
export function VideoFrame({ avatarState, phoneme, isAudioPlaying }: VideoFrameProps) {
  const phonemeRef = useRef<HTMLVideoElement>(null);
  const loopRef = useRef<HTMLVideoElement>(null);
  const thinkingRef = useRef<HTMLVideoElement>(null);
  // 'phoneme' | 'loop' | 'thinking' | 'none' (none = only idle base visible)
  const [overlay, setOverlay] = useState<'phoneme' | 'loop' | 'thinking' | 'none'>('none');
  const prevPhonemeRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (isAudioPlaying) {
      const phonemeVideo = phoneme && PHONEME_VIDEOS[phoneme];
      if (phonemeVideo && phoneme !== prevPhonemeRef.current) {
        prevPhonemeRef.current = phoneme;
        setOverlay('phoneme');
        const v = phonemeRef.current;
        if (v) {
          v.src = phonemeVideo;
          v.load();
          v.play().catch(() => {});
        }
      } else if (overlay !== 'phoneme' && overlay !== 'loop') {
        // Audio started but no new phoneme — go to conversation-looping
        setOverlay('loop');
        loopRef.current?.play().catch(() => {});
      }
    } else {
      prevPhonemeRef.current = undefined;
      if (avatarState === 'thinking') {
        setOverlay('thinking');
        thinkingRef.current?.play().catch(() => {});
      } else {
        setOverlay('none');
      }
    }
  }, [isAudioPlaying, phoneme, avatarState, overlay]);

  // When phoneme clip ends and audio is still playing, switch to conversation-looping
  useEffect(() => {
    const v = phonemeRef.current;
    if (!v) return;
    const onEnded = () => {
      if (isAudioPlaying) {
        setOverlay('loop');
        loopRef.current?.play().catch(() => {});
      }
    };
    v.addEventListener('ended', onEnded);
    return () => v.removeEventListener('ended', onEnded);
  }, [isAudioPlaying]);

  return (
    <div className={styles.bubble}>
      {/* Base layer: idle video always playing — prevents layout shift */}
      <video
        className={styles.video}
        src="/videos/idle-compressed.mp4"
        loop
        autoPlay
        muted
        playsInline
        aria-hidden="true"
        style={{ zIndex: 0 }}
      />
      {/* Overlay: thinking */}
      <video
        ref={thinkingRef}
        className={styles.video}
        src="/videos/thinking-compressed.mp4"
        loop
        muted
        playsInline
        aria-hidden="true"
        style={{ zIndex: 1, opacity: overlay === 'thinking' ? 1 : 0 }}
      />
      {/* Overlay: phoneme clip */}
      <video
        ref={phonemeRef}
        className={styles.video}
        muted
        playsInline
        aria-hidden="true"
        style={{ zIndex: 1, opacity: overlay === 'phoneme' ? 1 : 0 }}
      />
      {/* Overlay: conversation-looping */}
      <video
        ref={loopRef}
        className={styles.video}
        src="/videos/conversationlooping-compressed.mp4"
        loop
        muted
        playsInline
        preload="auto"
        aria-hidden="true"
        style={{ zIndex: 1, opacity: overlay === 'loop' ? 1 : 0 }}
      />
    </div>
  );
}
