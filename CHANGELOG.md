# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [1.2.0] - 2026-09-29

### Added
- **In-app updates**: when a new version is found, an update window shows what changed and downloads it with a progress bar. The file is checked against the release's `SHA256SUMS.txt` before being installed, then the app restarts. Works with the Windows installer and portable version, AppImage, .deb, .rpm, .pacman and macOS. "Skip this version" is available.

### Changed
- Release descriptions come from this changelog.

### Fixed
- `SHA256SUMS.txt` lists the Windows files under their published names.

## [1.2.0-beta.2] - 2026-09-28

Test release for the in-app updates: 1.2.0-beta.1 should offer it in its update window, download it, install it and restart.

## [1.2.0-beta.1] - 2026-09-28

### Added
- **In-app updates**: when a new version is found, an update window shows what changed and downloads it with a progress bar. The file is checked against the release's `SHA256SUMS.txt` before being installed, then the app restarts. Works with the Windows installer and portable version, AppImage, .deb, .rpm, .pacman and macOS. "Skip this version" is available.

### Changed
- Release descriptions come from this changelog.

### Fixed
- `SHA256SUMS.txt` lists the Windows files under their published names.

## [1.1.1] - 2026-09-27

### Added
- Ready for SignPath code signing (free for open source, certificate by SignPath Foundation), enabled as soon as the project is approved.
- Windows executables are signed with a self-signed certificate in the maintainer's name until SignPath signing is active (publisher and file metadata visible in the file properties).
- Every release file comes with a signed build provenance attestation (Sigstore) and a `SHA256SUMS.txt` file.

### Fixed
- Release build: removed a leftover duplicate signing step that would have broken Windows builds once SignPath is enabled.

## [1.1.0] - 2026-09-26

First stable release with full Linux support. Changes since 1.0.0:

### Added
- **Linux support** on X11 and Wayland (GNOME, KDE Plasma, Sway, Hyprland…). On GNOME the paste shortcut is added to GNOME's custom shortcuts, so it works on every version (Fedora, Ubuntu…).
- **Automatic mode**: filters everything you copy, so a normal Ctrl+V / Cmd+V is always safe.
- **Update notifications** (stable or beta versions), clipboard auto-clear, "filter only" mode, start minimized.
- Filter search, live test preview with per-filter counts, case-sensitive filters, System compatibility panel.
- Readable, translated names for the 112 default filters.
- Command-line options `--paste`, `--filter-clipboard`, `--toggle-auto`, `--show`, `--hidden`.
- Arch Linux package and macOS Intel builds.

### Changed
- Electron 44. The filtering engine is 1.5–4.6× faster and runs in a background thread.
- The SWIFT/BIC filter now works (restricted to ISO country codes, case-sensitive).
- "Reset default filters" also restores deleted default filters.

### Fixed
- Broken default patterns (SWIFT, passport, driving licence, salary, Azure SAS).
- Editing a filter could move it out of its category or make it disappear.
- French translation encoding; Cmd+Q on macOS; auto-start did nothing.

### Security
- Sandboxed interface served from an internal `app://` protocol (a crafted template could previously run code on the computer).
- A catastrophic regular expression can no longer freeze the app; nothing is pasted in that case.
- The interface is served from an internal `app://` protocol limited to the app's own files, instead of `file://`.
- Electron fuses: the executable can no longer be used as a Node.js interpreter (`ELECTRON_RUN_AS_NODE`, `NODE_OPTIONS`, `--inspect`), only loads the app from its archive, and checks the archive's integrity (Windows, macOS).
- External links: only the project's GitHub pages can be opened from the app.
- System tools (PowerShell, osascript) are started from their absolute path; relative `PATH` entries are ignored.
- CI: GitHub Actions pinned to commit SHAs, no credentials left on the runner, CodeQL analysis, dependency review on pull requests.
- Updated build dependencies with known vulnerabilities (`fast-uri`, `js-yaml`, `@xmldom/xmldom`).

## [1.1.0-beta.2] - 2026-09-26

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

[Unreleased]: https://github.com/50bvd/clipboardfilter/compare/v1.2.0...develop
[1.2.0]: https://github.com/50bvd/clipboardfilter/compare/v1.1.1...v1.2.0
[1.2.0-beta.2]: https://github.com/50bvd/clipboardfilter/compare/v1.2.0-beta.1...v1.2.0-beta.2
[1.2.0-beta.1]: https://github.com/50bvd/clipboardfilter/compare/v1.1.1...v1.2.0-beta.1
[1.1.1]: https://github.com/50bvd/clipboardfilter/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/50bvd/clipboardfilter/compare/v1.0.0...v1.1.0
[1.1.0-beta.2]: https://github.com/50bvd/clipboardfilter/compare/v1.1.0-beta.1...v1.1.0-beta.2
[1.1.0-beta.1]: https://github.com/50bvd/clipboardfilter/compare/v1.0.0...v1.1.0-beta.1
[1.0.0]: https://github.com/50bvd/clipboardfilter/releases/tag/v1.0.0
