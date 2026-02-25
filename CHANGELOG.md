# Changelog

All notable changes to this project are documented in this file.

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
