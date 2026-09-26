# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- Update notifications: the app checks GitHub releases (stable, or stable + beta) and offers to download a newer version. Can be disabled in Settings › Updates.
- GNOME (Wayland): the paste shortcut is registered as a GNOME custom shortcut, so it works on every GNOME version (Fedora, Ubuntu…), without the portal.
- Contribution guide, security policy, issue and pull request templates.
- `develop` pre-production branch with automatic test builds, Dependabot updates.

### Security
- Update `fast-uri` (build tooling dependency, high severity advisory).

## [1.1.0-beta.1] - 2026-09-26

### Added
- Linux support on X11 and Wayland (GNOME, KDE Plasma, Sway, Hyprland…): global shortcut through the desktop portal, paste through xdotool / ydotool / dotool / wtype, clipboard through wl-clipboard.
- Command-line options `--paste`, `--filter-clipboard`, `--toggle-auto`, `--show`, `--hidden`.
- Automatic mode (filters everything that is copied), clipboard auto-clear, "filter only" mode, start minimized.
- Filter search, live test preview with per-filter counts, case-sensitive filters, System compatibility panel.
- Readable, translated names for the 112 default filters.
- Arch Linux package, macOS Intel builds.

### Changed
- Electron 44. The filtering engine is 1.5–4.6× faster and runs in a background thread.
- The SWIFT/BIC filter now works (restricted to ISO country codes, case-sensitive).
- "Reset default filters" also restores deleted default filters.

### Fixed
- Broken default patterns (SWIFT, passport, driving licence, salary, Azure SAS).
- Editing a filter could move it out of its category or make it disappear.
- French translation encoding.
- Cmd+Q did not quit on macOS; auto-start did nothing.

### Security
- Sandboxed interface: a crafted template could run code on the computer.
- A catastrophic regular expression can no longer freeze the app; nothing is pasted in that case.

## [1.0.0] - 2025-12-27

- First public release (Windows).

[Unreleased]: https://github.com/50bvd/clipboardfilter/compare/v1.1.0-beta.1...develop
[1.1.0-beta.1]: https://github.com/50bvd/clipboardfilter/compare/v1.0.0...v1.1.0-beta.1
[1.0.0]: https://github.com/50bvd/clipboardfilter/releases/tag/v1.0.0
