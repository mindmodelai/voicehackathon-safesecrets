import styles from './Header.module.css';

export interface NoteTunerValues {
  perspective: number;
  originY: number;
  rotateY: number;
  height: number;
  marginTop: number;
  marginLeft: number;
  fontSize: number;
  lineHeight: number;
  padTop: number;
  padRight: number;
  padBottom: number;
  padLeft: number;
  marginBottom: number;
}

export interface HeaderProps {
  onAboutClick?: () => void;
  onTunerToggle?: () => void;
  showTuner?: boolean;
  noteTuner?: NoteTunerValues;
  onNoteTunerChange?: (v: NoteTunerValues) => void;
  tunerText?: string;
  onTunerTextChange?: (v: string) => void;
}

export function Header({ onAboutClick, onTunerToggle, showTuner, noteTuner, onNoteTunerChange, tunerText, onTunerTextChange }: HeaderProps) {
  const t = noteTuner;
  const set = (key: keyof NoteTunerValues, val: number) => {
    if (t && onNoteTunerChange) onNoteTunerChange({ ...t, [key]: val });
  };

  return (
    <header className={styles.header}>
      <img src="/logos/logo.png" alt="Safe Secrets" className={styles.logo} />

      <nav>
        <ul className={styles.nav}>
          <li><a className={styles.navLink} href="https://github.com/mindmodelai/voicehackathon-safesecrets" target="_blank" rel="noopener noreferrer">GitHub</a></li>
          <li><a className={styles.navLink} href="https://ca.linkedin.com/in/samhebeisen" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn">
            <svg className={styles.navIcon} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
          </a></li>
          <li><button className={styles.navButton} onClick={onAboutClick} type="button">About</button></li>
          <li><button className={styles.navButton} onClick={onTunerToggle} type="button">⚙️</button></li>
        </ul>
      </nav>

      <a className={styles.logoRightLink} href="https://waterloo-voice-hackathon.replit.app/" target="_blank" rel="noopener noreferrer">
        <img src="/logos/ailogo.png" alt="AI Voice Hackathon" className={styles.logoRight} />
      </a>

      {showTuner && t && (
        <div style={{ position: 'fixed', top: '60px', right: '10px', zIndex: 9999, background: '#fff', border: '1px solid #ccc', borderRadius: '10px', padding: '14px', fontSize: '0.75rem', boxShadow: '0 4px 20px rgba(0,0,0,0.15)', width: '280px', maxHeight: '90vh', overflowY: 'auto' }}>
          <div style={{ fontWeight: 700, marginBottom: '8px' }}>Note Trapezoid Tuner</div>
          {([
            ['perspective', 100, 1200, 10],
            ['originY', 0, 100, 1],
            ['rotateY', -30, 30, 0.5],
            ['height', 50, 150, 1],
            ['marginTop', -60, 60, 1],
            ['marginLeft', -60, 60, 1],
            ['fontSize', 0.5, 4, 0.1],
            ['lineHeight', 0.8, 3, 0.05],
            ['padTop', 0, 80, 1],
            ['padRight', 0, 80, 1],
            ['padBottom', 0, 80, 1],
            ['padLeft', 0, 80, 1],
            ['marginBottom', 0, 80, 1],
          ] as [keyof NoteTunerValues, number, number, number][]).map(([key, min, max, step]) => (
            <label key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
              <span style={{ minWidth: '75px' }}>{key}</span>
              <input type="range" min={min} max={max} step={step} value={t[key]} onChange={e => set(key, parseFloat(e.target.value))} style={{ flex: 1 }} />
              <span style={{ minWidth: '40px', textAlign: 'right' }}>{t[key]}</span>
            </label>
          ))}
          <div style={{ marginTop: '8px' }}>
            <div style={{ fontWeight: 600, marginBottom: '4px' }}>Preview text:</div>
            <textarea
              value={tunerText ?? ''}
              onChange={e => onTunerTextChange?.(e.target.value)}
              placeholder="Paste note text here to preview..."
              style={{ width: '100%', height: '80px', fontSize: '0.75rem', borderRadius: '6px', border: '1px solid #ccc', padding: '6px', resize: 'vertical', fontFamily: "'Handlee', cursive" }}
            />
          </div>
        </div>
      )}
    </header>
  );
}
