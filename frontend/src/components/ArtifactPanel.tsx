import { memo, useState, useEffect, useMemo } from 'react';
import type { SovereigntyMode } from '../../../shared/types.js';
import { SOVEREIGNTY_MODES } from '../../../shared/types.js';
import { SmallestLogo } from './SmallestLogo';
import styles from './ArtifactPanel.module.css';

export interface ArtifactPanelProps {
  sovereigntyMode: SovereigntyMode;
  onModeChange: (mode: SovereigntyMode) => void;
  isActive: boolean;
  noteTuner?: {
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
  };
  tunerText?: string;
}

const MODE_KEYS = Object.keys(SOVEREIGNTY_MODES) as SovereigntyMode[];

const MODE_SERVICE_LISTS: Record<SovereigntyMode, string[]> = {
  full_canada: ['CA Transcribe STT', 'CA Bedrock LLM', 'CA Polly Neural TTS'],
  canada_us_voice: ['CA Transcribe STT', 'CA Bedrock LLM', 'US Polly Generative TTS'],
  us_bedrock_voice: ['US Transcribe STT', 'US Bedrock LLM', 'US Polly Generative TTS'],
  full_us: ['Smallest.ai Pulse STT', 'US Bedrock LLM', 'Smallest.ai Lightning TTS'],
};

const MODE_FLAGS: Record<SovereigntyMode, 'ca' | 'us'> = {
  full_canada: 'ca',
  canada_us_voice: 'ca',
  us_bedrock_voice: 'us',
  full_us: 'us',
};

function FlagIcon({ country, className }: { country: 'ca' | 'us'; className?: string }) {
  if (country === 'ca') {
    return (
      <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 20" aria-label="Canada">
        <rect width="10" height="20" fill="#d52b1e"/>
        <rect x="10" width="20" height="20" fill="#fff"/>
        <rect x="30" width="10" height="20" fill="#d52b1e"/>
        <path d="M20 3.5l-1.5 4.5-3-1 1.5 3H14l2.5 2-1 3L20 13l4.5 2.5-1-3L26 10.5h-3l1.5-3-3 1z" fill="#d52b1e"/>
      </svg>
    );
  }
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 20" aria-label="United States">
      <rect width="40" height="20" fill="#b22234"/>
      <rect y="1.54" width="40" height="1.54" fill="#fff"/>
      <rect y="4.62" width="40" height="1.54" fill="#fff"/>
      <rect y="7.69" width="40" height="1.54" fill="#fff"/>
      <rect y="10.77" width="40" height="1.54" fill="#fff"/>
      <rect y="13.85" width="40" height="1.54" fill="#fff"/>
      <rect y="16.92" width="40" height="1.54" fill="#fff"/>
      <rect width="16" height="10.77" fill="#3c3b6e"/>
    </svg>
  );
}

export const ArtifactPanel = memo(function ArtifactPanel({ sovereigntyMode, onModeChange, isActive, noteTuner, tunerText }: ArtifactPanelProps) {
  // Only apply tuner styles on desktop (>768px)
  const isMobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches;
  const tuner = isMobile ? undefined : noteTuner;
  // Delayed content visibility — waits 2s after isActive changes before showing new content
  const [showContent, setShowContent] = useState(!isActive);

  useEffect(() => {
    setShowContent(false);
    const timer = setTimeout(() => setShowContent(true), 2000);
    return () => clearTimeout(timer);
  }, [isActive]);

  return (
    <div className={styles.panel}>
      <div className={styles.promptSection}>
        <div style={{ width: '100%' }}>
          <p className={styles.promptHeading}>How Safe Is<br />Your Secret?</p>
          <p className={styles.promptSub}>Choose your Canadian Sovereignty <br className="desktop-only" />settings below.</p>
        </div>
      </div>

      <div className={styles.optionsWrapper} style={isActive && tuner ? {
        perspective: `${tuner.perspective}px`,
        perspectiveOrigin: `right ${tuner.originY}%`,
      } : {
        perspective: '400px',
        perspectiveOrigin: 'right 20%',
      }}>
        <div className={styles.optionsSection} style={isActive && tuner ? {
          transform: `rotateY(${tuner.rotateY}deg)`,
          height: `${tuner.height}%`,
          marginTop: `${tuner.marginTop}px`,
          marginLeft: `${tuner.marginLeft}px`,
        } : {
          transform: 'rotateY(6deg)',
          height: '108%',
          marginTop: '-24px',
          marginLeft: '6px',
        }}>
          {showContent && (
            isActive ? (
              <>
                <div className={styles.noteContainer} style={tuner ? { bottom: `${tuner.marginBottom}px` } : undefined}>
                  <p className={styles.notePlaceholder} style={tuner ? { fontSize: `${tuner.fontSize}rem`, lineHeight: tuner.lineHeight, paddingTop: `${tuner.padTop}px`, paddingRight: `${tuner.padRight}px`, paddingBottom: `${tuner.padBottom}px`, paddingLeft: `${tuner.padLeft}px` } : undefined}>{tunerText || 'Your secret note will appear here…'}</p>
                  <button
                    type="button"
                    onClick={() => { navigator.clipboard.writeText(tunerText || ''); }}
                    className={styles.copyButton}
                    aria-label="Copy note to clipboard"
                  >📋</button>
                </div>
              </>
            ) : (
              <div className={styles.radioGroup} role="radiogroup" aria-label="Sovereignty mode">
                {/* Vertical connecting line */}
                <div className={styles.radioLine} />
                {MODE_KEYS.map((mode) => {
                  const config = SOVEREIGNTY_MODES[mode];
                  const selected = sovereigntyMode === mode;
                  const isFourth = mode === 'full_us';
                  return (
                    <button
                      key={mode}
                      role="radio"
                      aria-checked={selected}
                      onClick={() => onModeChange(mode)}
                      title={config.description}
                      className={styles.radioItem}
                    >
                      <span className={`${styles.radioDisc} ${selected ? styles.radioDiscSelected : ''}`}>
                        <span className={`${styles.radioFlag} ${selected ? styles.radioFlagSelected : ''}`}>
                          <FlagIcon country={MODE_FLAGS[mode]} className={MODE_FLAGS[mode] === 'us' ? styles.radioFlagSvgUs : styles.radioFlagSvg} />
                        </span>
                      </span>
                      <span className={styles.radioText}>
                        {isFourth ? (
                          <SmallestLogo className={`${styles.smallestLogoOnly} ${selected ? styles.smallestLogoOnlySelected : ''}`} />
                        ) : (
                          <>
                            <span className={`${styles.radioLabel} ${selected ? styles.radioLabelSelected : ''}`}>
                              {config.label}
                            </span>
                            <ul className={`${styles.radioServiceList} ${selected ? styles.radioServiceListSelected : ''}`}>
                              {MODE_SERVICE_LISTS[mode].map((svc) => (
                                <li key={svc}>{svc}</li>
                              ))}
                            </ul>
                          </>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            )
          )}
        </div>
      </div>

    </div>
  );
});
