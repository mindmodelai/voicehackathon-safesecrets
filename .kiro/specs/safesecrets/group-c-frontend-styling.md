# Group C: Frontend Design & Styling Tasks

These tasks focus on visual polish, responsive layout, and CSS for the SafeSecrets frontend.
They are safe to work on in parallel with backend work — no backend files are touched.

## File Scope (what you CAN touch)

- `frontend/src/App.css` (new — global app layout styles)
- `frontend/src/components/HeartAvatar.module.css` (new — avatar component styles)
- `frontend/src/components/ArtifactPanel.module.css` (exists — can be enhanced)
- `frontend/index.html` (minor — add Google Fonts link, favicon)
- `frontend/src/main.tsx` (minor — import global CSS)
- `frontend/src/App.tsx` (minor — add className imports if needed)
- `frontend/src/components/HeartAvatar.tsx` (minor — add CSS module import)

## Files to AVOID (other agent or completed work)

- All `*.test.*` and `*.property.test.*` files
- All backend files (`backend/`)
- All shared files (`shared/`)
- `frontend/src/ws-client.ts`, `frontend/src/audio-manager.ts`, `frontend/src/avatar-state-machine.ts`

---

## Task C.1 — Global App Layout & Theme

Create `frontend/src/App.css` with:

- Two-panel layout: left panel (avatar, ~40% width) + right panel (artifact, ~60% width)
- Valentine's Day color palette: deep reds (#8B0000, #DC143C), warm pinks (#FFB6C1, #FFF0F5), cream (#FFFAF5)
- CSS custom properties for the theme (so components can reference them):
  ```css
  :root {
    --ss-bg: #FFF0F5;
    --ss-panel-bg: #FFFAF5;
    --ss-accent: #DC143C;
    --ss-accent-dark: #8B0000;
    --ss-text: #3A2A1A;
    --ss-text-muted: #8B6F50;
    --ss-border: #F0E0D0;
    --ss-font-display: 'Playfair Display', Georgia, serif;
    --ss-font-body: 'Inter', system-ui, sans-serif;
    --ss-radius: 12px;
  }
  ```
- Body styling: full viewport height, centered content, subtle gradient background
- `.app` container: flexbox row, max-width 1200px, centered, gap between panels
- `.app__left-panel`: centered content, flex column, justify center
- `.app__right-panel`: flex column, overflow-y auto
- `.app__start-button`: large pill button, Valentine red, white text, hover glow effect, pulse animation when idle
- Responsive: stack panels vertically below 768px

Update `frontend/src/main.tsx` to import `./App.css`.
Update `frontend/index.html` to add Google Fonts (Playfair Display + Inter) and a favicon.

## Task C.2 — Heart Avatar Styling

Create `frontend/src/components/HeartAvatar.module.css` with:

- `.avatar` container: centered, circular or heart-shaped clip-path, fixed size (280×280px desktop, 200×200px mobile)
- `.avatar video`: object-fit cover, fills container
- State-based visual overlays (applied via `heart-avatar--{state}` class already on the div):
  - `idle`: subtle floating animation (translateY oscillation), soft drop shadow
  - `listening`: pulsing red glow border (box-shadow animation), slight scale-up
  - `thinking`: shimmer gradient overlay animation (left-to-right sweep)
  - `speaking`: rhythmic scale pulse (simulates talking), colored glow matching style
- Transitions between states should be smooth (transition: all 0.3s ease)

Update `frontend/src/components/HeartAvatar.tsx` to import and apply the CSS module classes.

## Task C.3 — Artifact Panel Polish

Enhance `frontend/src/components/ArtifactPanel.module.css`:

- Use the CSS custom properties from C.1 instead of hardcoded colors
- Add a subtle entrance animation when the note first appears (fade-in + slide-up)
- Style the note area like a real notepad: faint ruled lines background, slightly tilted paper effect (subtle rotate transform)
- Tags: add a small heart icon (❤) before each tag via ::before pseudo-element
- Refinement buttons: add icons or emoji before labels (✂️ shorter, 💪 bolder, 💕 romantic, 🇫🇷 French)
- Copy button: add a checkmark animation on click (CSS-only, using :active state)
- Disabled state: clear visual distinction (opacity, cursor)
- Scrollable note area if content is long (max-height with overflow-y)

## Task C.4 — Responsive & Accessibility Polish

- Ensure all interactive elements have visible focus indicators (outline on :focus-visible)
- Add `prefers-reduced-motion` media query to disable animations
- Add `prefers-color-scheme: dark` basic dark mode (swap backgrounds, text colors)
- Test that the layout works at 320px, 768px, and 1200px widths
- Ensure sufficient color contrast ratios (4.5:1 minimum for text)
- Add skip-to-content link for keyboard navigation

---

## Branch & PR Convention

Use branch: `task/group-c-frontend-styling`
PR title: `Group C: Frontend design and styling`
Tag after merge: `task/group-c-styling`
