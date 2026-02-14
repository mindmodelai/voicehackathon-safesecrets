import styles from './Header.module.css';

export function Header() {
  return (
    <header className={styles.header}>
      <div className={styles.logo}>Safe Secrets</div>

      <nav>
        <ul className={styles.nav}>
          <li><a className={styles.navLink} href="#share">Share Secrets</a></li>
          <li><a className={styles.navLink} href="https://github.com/mindmodelai/voicehackathon-safesecrets" target="_blank" rel="noopener noreferrer">GitHub</a></li>
          <li><a className={styles.navLink} href="#about">About</a></li>
        </ul>
      </nav>

      <div className={styles.logoRight}>AI Voice</div>
    </header>
  );
}
