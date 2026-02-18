import { memo, useState, useEffect } from 'react';
import type { SovereigntyMode } from '../../../shared/types.js';
import { SOVEREIGNTY_MODES } from '../../../shared/types.js';
import { SmallestLogo } from './SmallestLogo';
import styles from './ArtifactPanel.module.css';

export interface ArtifactPanelProps {
  sovereigntyMode: SovereigntyMode;
  onModeChange: (mode: SovereigntyMode) => void;
  isActive: boolean;
  noteText?: string;
}

const MODE_KEYS = Object.keys(SOVEREIGNTY_MODES) as SovereigntyMode[];

const MODE_SERVICE_LISTS: Record<SovereigntyMode, string[]> = {
  full_canada: ['CA Transcribe STT', 'CA Bedrock LLM', 'CA Polly Neural TTS'],
  canada_us_voice: ['CA Transcribe STT', 'CA Bedrock LLM', 'US Polly Generative TTS'],
  us_bedrock_voice: ['US Transcribe STT', 'US Bedrock LLM', 'US Polly Generative TTS'],
  full_us: ['Smallest.ai Pulse STT', 'US Bedrock LLM', 'Smallest.ai Lightning TTS'],
  aws_free: ['Smallest.ai Lightning STT', 'OpenAI LLM', 'Smallest.ai Lightning TTS'],
};

const MODE_FLAGS: Record<SovereigntyMode, 'ca' | 'us'> = {
  full_canada: 'ca',
  canada_us_voice: 'ca',
  us_bedrock_voice: 'us',
  full_us: 'us',
  aws_free: 'us',
};

// Baked-in layout values — desktop
const DESKTOP_OPEN = {
  perspective: 310, originY: 0, rotateY: 6.5,
  height: 115, marginTop: -18, marginLeft: 55,
  fontSize: 1, lineHeight: 1,
  padTop: 28, padRight: 52, padBottom: 0, padLeft: 36,
  marginBottom: 3,
};
const DESKTOP_CLOSED = {
  perspective: 400, originY: 20, rotateY: 6,
  height: 115, marginTop: -16, marginLeft: 33,
};

// Baked-in layout values — mobile (≤768px)
const MOBILE_OPEN = {
  perspective: 310, originY: 0, rotateY: 6.5,
  height: 123, marginTop: -9, marginLeft: 55,
  fontSize: 1, lineHeight: 1.2,
  padTop: 28, padRight: 54, padBottom: 21, padLeft: 24,
  marginBottom: 18,
};
const MOBILE_CLOSED = {
  perspective: 310, originY: 20, rotateY: 6,
  height: 115, marginTop: -24, marginLeft: -9,
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

export const ArtifactPanel = memo(function ArtifactPanel({ sovereigntyMode, onModeChange, isActive, noteText }: ArtifactPanelProps) {
  const isMobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches;
  const open = isMobile ? MOBILE_OPEN : DESKTOP_OPEN;
  const closed = isMobile ? MOBILE_CLOSED : DESKTOP_CLOSED;

  const [showContent, setShowContent] = useState(!isActive);
  const [isCopied, setIsCopied] = useState(false);

  useEffect(() => {
    setShowContent(false);
    const timer = setTimeout(() => setShowContent(true), 2000);
    return () => clearTimeout(timer);
  }, [isActive]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isCopied) {
      timer = setTimeout(() => setIsCopied(false), 2000);
    }
    return () => clearTimeout(timer);
  }, [isCopied]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(noteText || '');
      setIsCopied(true);
    } catch (e) {
      console.error('Copy failed', e);
    }
  };

  return (
    <div className={styles.panel}>
      <div className={styles.promptSection}>
        <div style={{ width: '100%' }}>
          <p className={styles.promptHeading}>How Safe Is<br />Your Secret?</p>
          <p className={styles.promptSub}>Choose your Canadian Sovereignty settings below.</p>
        </div>
      </div>

      <div className={styles.optionsWrapper} style={isActive ? {
        perspective: `${open.perspective}px`,
        perspectiveOrigin: `right ${open.originY}%`,
      } : {
        perspective: `${closed.perspective}px`,
        perspectiveOrigin: `right ${closed.originY}%`,
      }}>
        <div className={styles.optionsSection} style={isActive ? {
          transform: `rotateY(${open.rotateY}deg)`,
          height: `${open.height}%`,
          marginTop: `${open.marginTop}px`,
          marginLeft: `${open.marginLeft}px`,
        } : {
          transform: `rotateY(${closed.rotateY}deg)`,
          height: `${closed.height}%`,
          marginTop: `${closed.marginTop}px`,
          marginLeft: `${closed.marginLeft}px`,
        }}>
          {showContent && (
            isActive ? (
              <div className={styles.noteContainer} style={{ bottom: `${open.marginBottom}px` }}>
                <p className={styles.notePlaceholder} style={{
                  fontSize: `${open.fontSize}rem`,
                  lineHeight: open.lineHeight,
                  paddingTop: `${open.padTop}px`,
                  paddingRight: `${open.padRight}px`,
                  paddingBottom: `${open.padBottom}px`,
                  paddingLeft: `${open.padLeft}px`,
                }}>{noteText || 'Your secret note will appear here…'}</p>
                <button
                  type="button"
                  onClick={handleCopy}
                  className={styles.copyButton}
                  aria-label={isCopied ? "Note copied" : "Copy note to clipboard"}
                  data-testid="copy-button"
                >
                  {isCopied ? '✅ Copied' : '📋 Copy'}
                </button>
              </div>
            ) : (
              <div className={styles.radioGroup} role="radiogroup" aria-label="Sovereignty mode">
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
