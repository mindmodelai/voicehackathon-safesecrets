import styles from './VideoFrame.module.css';

export function VideoFrame() {
  return (
    <div className={styles.bubble}>
      <video
        className={styles.video}
        src="/videos/idle-compressed.mp4"
        loop
        autoPlay
        muted
        playsInline
        aria-hidden="true"
      />
    </div>
  );
}
