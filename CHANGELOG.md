# Changelog

All notable changes to this project are documented in this file.

## [0.1.6] - 2026-02-25

### Fixed
- Fixed global Bun install launcher path resolution by resolving symlinked `bin/openclaw-audit-tui` path before locating `src/index.tsx`.

## [0.1.5] - 2026-02-25

### Fixed
- Synced header version display with `package.json` version.
- Improved all-view live updates: forced event reload polling every 3s while in All View.
- Fixed preload race conditions that could leave all-view stale until restart.

### Changed
- Search/filter matching now supports fuzzy matching for command palette, entries, tool-name filters, and all-events text query.

## [0.1.4] - 2026-02-25

### Fixed
- npm trusted publishing workflow now clears `NODE_AUTH_TOKEN` during publish so OIDC flow is used.

## [0.1.3] - 2026-02-25

### Fixed
- Updated npm publish workflow to trigger directly on `v*` tag pushes for trusted publishing compatibility.

## [0.1.2] - 2026-02-25

### Fixed
- Fixed startup race where default `All View` could preload events with an empty session list and remain blank.
- `All View` loading now waits for sessions before marking event cache as loaded.

## [0.1.1] - 2026-02-25

### Changed
- Default landing view is now `All View` (global events timeline).
- Previous sessions browser is now named `Tree View`.
- Added quick keyboard switch back to Tree View from All View (`t`).

### Fixed
- Simplified advanced filter UX and stabilized keyboard behavior with deterministic field/edit modes.
- Improved edit/write diff rendering by supporting `old_string`, `newText`, and `file_path` payload shapes.

## [0.1.0] - 2026-02-25

### Added
- New project identity: `openclaw-audit-tui`.
- Rich session metrics in table view: events, messages, tools, errors, provider.
- Global All Events inspector with scope toggle and timeline sparkline.
- Advanced filtering for entries and all-events (type, role, tool category, tool name, errors, text query).
- Command palette, breadcrumb navigation, and backstack navigation.
- Rich markdown and JSON rendering in detail panes.
- File edit/write diff rendering in entry and all-events inspectors.
- Nerd Font icon mode with ASCII fallback support.

### Changed
- Sessions are sorted by last activity.
- Session rows now expose active state and compaction indicators.
- Search shortcut (`/`) routes directly into all-events search flow.

### Fixed
- Improved model/provider extraction for sessions where model-change events are missing.
- Sanitized invalid/future timestamps in all-events aggregation.
- Fixed list selection-follow behavior in long entry/event lists.
- Fixed advanced filter interaction and keyboard usability.
