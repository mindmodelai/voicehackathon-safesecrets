import styles from './Header.module.css';

export interface HeaderProps {
  onAboutClick?: () => void;
}

export function Header({ onAboutClick }: HeaderProps) {
  return (
    <header className={styles.header}>
      <img src="/logos/logo.png" alt="Safe Secrets" className={styles.logo} />

      <nav>
        <ul className={styles.nav}>
          <li><a className={styles.navLink} href="https://github.com/mindmodelai/voicehackathon-safesecrets" target="_blank" rel="noopener noreferrer">GitHub</a></li>
          <li><button className={styles.navButton} onClick={onAboutClick} type="button">About</button></li>
        </ul>
      </nav>

      <a href="https://waterloo-voice-hackathon.replit.app/" target="_blank" rel="noopener noreferrer">
        <img src="/logos/ailogo.png" alt="AI Voice Hackathon" className={styles.logoRight} />
      </a>
    </header>
  );
}
