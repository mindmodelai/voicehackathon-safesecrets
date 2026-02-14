import { memo } from 'react';
import type { SovereigntyMode } from '../../../shared/types.js';
import { SOVEREIGNTY_MODES } from '../../../shared/types.js';
import styles from './ArtifactPanel.module.css';

export interface ArtifactPanelProps {
  sovereigntyMode: SovereigntyMode;
  onModeChange: (mode: SovereigntyMode) => void;
}

export const ArtifactPanel = memo(function ArtifactPanel({ sovereigntyMode, onModeChange }: ArtifactPanelProps) {
  return (
    <div className={styles.panel}>
      <div className={styles.promptSection}>
        <div>
          <p className={styles.promptHeading}>How Safe Is<br />Your Secret?</p>
          <p className={styles.promptSub}>Choose your Sovereignty settings below.</p>
        </div>
      </div>

      <div className={styles.optionsWrapper}>
        <div className={styles.optionsSection}>
          {(Object.entries(SOVEREIGNTY_MODES) as [SovereigntyMode, typeof SOVEREIGNTY_MODES[SovereigntyMode]][]).map(([mode, config]) => (
            <button
              key={mode}
              onClick={() => onModeChange(mode)}
              title={config.description}
              className={`${styles.modeButton} ${sovereigntyMode === mode ? styles.modeButtonActive : ''}`}
            >
              {config.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
});
