import { memo } from 'react';
import type { RefinementRequest } from '../../../shared/types.js';
import styles from './ArtifactPanel.module.css';

export interface ArtifactPanelProps {
  noteDraft: string;
  tags: string[];
  toneLabel: 'soft' | 'flirty' | 'serious' | null;
  onRefinement: (type: RefinementRequest['type']) => void;
  onCopy: () => void;
}

const REFINEMENT_BUTTONS: { label: string; type: RefinementRequest['type'] }[] = [
  { label: 'Make it shorter', type: 'shorter' },
  { label: 'Make it bolder', type: 'bolder' },
  { label: 'Make it more romantic', type: 'more_romantic' },
  { label: 'Translate to French', type: 'translate_french' },
];

const toneStyleMap: Record<string, string> = {
  soft: styles.toneSoft,
  flirty: styles.toneFlirty,
  serious: styles.toneSerious,
};

// Memoized to prevent re-renders when parent state (like transcript) updates but artifact props haven't changed.
export const ArtifactPanel = memo(function ArtifactPanel({ noteDraft, tags, toneLabel, onRefinement, onCopy }: ArtifactPanelProps) {
  const hasNote = noteDraft.length > 0;

  return (
    <section className={styles.panel} aria-label="Love note artifact panel">
      {toneLabel && (
        <span className={`${styles.toneLabel} ${toneStyleMap[toneLabel]}`}>
          {toneLabel}
        </span>
      )}

      <div className={styles.noteArea} role="region" aria-label="Note draft">
        {hasNote ? (
          noteDraft
        ) : (
          <span className={styles.placeholder}>Your love note will appear here…</span>
        )}
      </div>

      {tags.length > 0 && (
        <div className={styles.tags} role="list" aria-label="Note tags">
          {tags.map((tag) => (
            <span key={tag} className={styles.tag} role="listitem">
              #{tag}
            </span>
          ))}
        </div>
      )}

      <div className={styles.actions}>
        <button
          className={styles.copyButton}
          onClick={onCopy}
          disabled={!hasNote}
          aria-label="Copy note to clipboard"
        >
          Copy
        </button>
        {REFINEMENT_BUTTONS.map(({ label, type }) => (
          <button
            key={type}
            className={styles.refinementButton}
            onClick={() => onRefinement(type)}
            disabled={!hasNote}
          >
            {label}
          </button>
        ))}
      </div>
    </section>
  );
});
