# NEXUS Separate Desktop and Mobile Studio Implementation Plan

> **For agentic workers:** Use this plan task-by-task. Steps use checkbox syntax.

**Goal:** Give NEXUS desktop and mobile genuinely separate editing interfaces while preserving one shared editing state and render pipeline.

**Architecture:** Keep `NexusVLab` as the single owner of media, clip, effect, keyframe, audio, project and render state. Keep `NexusEditorDashboard` as the desktop workspace; add a dedicated touch-first `NexusMobileEditor` that consumes the same dashboard props and reuses the existing inspector and multi-track timeline primitives.

**Tech Stack:** React 19, TypeScript, Vite 7, Tailwind CSS 4, lucide-react.

**Spec:** NEXUS Flux Creative Studio redesign brief in this conversation and MagicPath desktop/mobile prototypes.

## Global Constraints

- Do not delete or replace working editing, media, project storage, FFmpeg, effects, keyframe, audio or export behavior.
- Desktop and mobile are separate layouts and interaction models, not one responsive desktop grid.
- Both interfaces use the same engine state and media decoder.
- Keep local-first media handling and the existing 650 MB source limit.
- Preserve keyboard/mouse affordances on desktop and minimum 44px touch targets on mobile.

## Review Focus

- Viewport crossing 768px while a project is open: switch layouts without losing editor state.
- Large video sources: retain the single decoder and avoid extra media buffers.
- Mobile portrait/landscape: timeline and inspector remain reachable without horizontal page overflow.
- Missing media/audio or render errors: retain current error and progress feedback.
- Touch timeline and tool selection: actions must operate on the same clip/effect/keyframe state as desktop.

---

### Task 1: Share editor primitives

**Files:** Modify `src/components/nexus-editor-dashboard.tsx`.

- [ ] Export the existing `Inspector` and `Timeline` components without changing their behavior.
- [ ] Verify prop types remain `NexusEditorDashboardProps`.

### Task 2: Build the dedicated mobile workspace

**Files:** Create `src/components/nexus-mobile-editor.tsx`; modify `src/styles.css`.

- [ ] Create a mobile header, preview/transport, compact multi-track timeline, touch tool dock and contextual inspector sheet.
- [ ] Reuse `Inspector` and `Timeline`; do not duplicate engine state.
- [ ] Add mobile-specific responsive CSS, safe-area padding, touch targets and reduced-motion handling.

### Task 3: Route by viewport without remounting the engine

**Files:** Modify `src/routes/nexus-v-lab.tsx`.

- [ ] Construct one shared `NexusEditorDashboardProps` object.
- [ ] Render `NexusMobileEditor` below the mobile breakpoint and `NexusEditorDashboard` otherwise.
- [ ] Keep both branches under the same `NexusVLab` state owner.

### Task 4: Verify

- [ ] Run `npm run build`.
- [ ] Inspect the Vercel preview build for the feature branch.
- [ ] Report any interaction or runtime checks that could not be performed.
