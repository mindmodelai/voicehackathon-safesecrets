import type { RefinementRequest } from '../../../shared/types.js';
export interface ArtifactPanelProps {
    noteDraft: string;
    tags: string[];
    toneLabel: 'soft' | 'flirty' | 'serious' | null;
    onRefinement: (type: RefinementRequest['type']) => void;
    onCopy: () => void;
}
export declare const ArtifactPanel: import("react").NamedExoticComponent<ArtifactPanelProps>;
