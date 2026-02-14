import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { memo } from 'react';
import styles from './ArtifactPanel.module.css';
const REFINEMENT_BUTTONS = [
    { label: 'Make it shorter', type: 'shorter' },
    { label: 'Make it bolder', type: 'bolder' },
    { label: 'Make it more romantic', type: 'more_romantic' },
    { label: 'Translate to French', type: 'translate_french' },
];
const toneStyleMap = {
    soft: styles.toneSoft,
    flirty: styles.toneFlirty,
    serious: styles.toneSerious,
};
// Memoized to prevent re-renders when parent state (like transcript) updates but artifact props haven't changed.
export const ArtifactPanel = memo(function ArtifactPanel({ noteDraft, tags, toneLabel, onRefinement, onCopy }) {
    const hasNote = noteDraft.length > 0;
    return (_jsxs("section", { className: styles.panel, "aria-label": "Love note artifact panel", children: [toneLabel && (_jsx("span", { className: `${styles.toneLabel} ${toneStyleMap[toneLabel]}`, children: toneLabel })), _jsx("div", { className: styles.noteArea, role: "region", "aria-label": "Note draft", children: hasNote ? (noteDraft) : (_jsx("span", { className: styles.placeholder, children: "Your love note will appear here\u2026" })) }), tags.length > 0 && (_jsx("div", { className: styles.tags, role: "list", "aria-label": "Note tags", children: tags.map((tag) => (_jsxs("span", { className: styles.tag, role: "listitem", children: ["#", tag] }, tag))) })), _jsxs("div", { className: styles.actions, children: [_jsx("button", { className: styles.copyButton, onClick: onCopy, disabled: !hasNote, "aria-label": "Copy note to clipboard", children: "Copy" }), REFINEMENT_BUTTONS.map(({ label, type }) => (_jsx("button", { className: styles.refinementButton, onClick: () => onRefinement(type), disabled: !hasNote, children: label }, type)))] })] }));
});
//# sourceMappingURL=ArtifactPanel.js.map