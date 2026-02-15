import { useRef, useEffect, useState } from 'react';
import type { AvatarState } from '../../../shared/types.js';
import type { Phoneme } from '../../../shared/types.js';
import styles from './VideoFrame.module.css';

export interface VideoFrameProps {
  avatarState: AvatarState;
  phoneme?: Phoneme | string;
}

const PHONEME_VIDEOS: Record<string, string> = {
  MBP: '/videos/MBP-compressed.mp4',
  TDNL: '/videos/TDNL-compressed.mp4',
  AHAA: '/videos/AHAA-compressed.mp4',
  OUW: '/videos/OUW-compressed.mp4',
  EE: '/videos/EE-compressed.mp4',
  FV: '/videos/FV-compressed.mp4',
};

export function VideoFrame({ avatarState, phoneme }: VideoFrameProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentSrc, setCurrentSrc] = useState('/videos/idle-compressed.mp4');

  useEffect(() => {
    let nextSrc: string;

    if (avatarState === 'speaking') {
      // TTS is active — play phoneme video (looping) for entire speech duration
      nextSrc = (phoneme && PHONEME_VIDEOS[phoneme])
        ? PHONEME_VIDEOS[phoneme]
        : '/videos/idle-compressed.mp4';
    } else if (avatarState === 'thinking') {
      nextSrc = '/videos/thinking-compressed.mp4';
    } else {
      nextSrc = '/videos/idle-compressed.mp4';
    }

    if (nextSrc !== currentSrc) {
      setCurrentSrc(nextSrc);
    }
  }, [avatarState, phoneme, currentSrc]);

  // When src changes, restart playback
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.load();
    v.play().catch(() => {});
  }, [currentSrc]);

  return (
    <div className={styles.bubble}>
      <video
        ref={videoRef}
        className={styles.video}
        src={currentSrc}
        loop
        autoPlay
        muted
        playsInline
        aria-hidden="true"
      />
    </div>
  );
}
