# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [1.2.5] - 2026-09-30

### Fixed
- A 64-character Wi-Fi PSK was masked by the WPA passphrase filter and its last character was left visible.
- No filter runs across lines anymore: a number at the end of a line (UTR, SIREN, NIR…) could be joined with the next line.
- IBAN: uppercase whole words only (a Solana address was taken for an IBAN); an IBAN is masked as an IBAN rather than as a VAT or SIRET number.
- Order of the broad filters: an MD5 hash is masked as a hash (not as a Solana address), a date of birth is no longer masked again as a path.
- E-mail addresses are masked after the specific filters, so a Sentry DSN or a vCenter login is masked by its own filter.
- Filtering is stable: already masked text is neither changed nor counted again.
- Matricule: the value has to contain a digit.
- Existing configurations get these fixes automatically (default filters you did not modify).

## [1.2.4] - 2026-09-30

### Fixed
- With optional filters enabled, broad filters cut other secrets up: a card number became `4*** ** ** ***…` (NIR), database URLs and webhooks became `https:/***PATH_REDACTED***` (paths), crypto addresses became `***AZURE_SECRET_REDACTED***`. Broad filters (paths, numbers, IDs, generic tokens) now run after the specific ones.
- Optional filters that masked normal text are narrower:
  - paths: a lone `/` ("Réseau / système") and URLs are no longer taken for paths;
  - CVV: needs "CVV", "CVC" or "cryptogramme" (any 3-4 digit number was masked, e.g. "1500 euros");
  - postal address: needs a street type (rue, avenue, boulevard, street…);
  - phone: real phone formats only (a postal code or a date was masked);
  - French NIR: no longer matches inside a longer number;
  - Azure client secret: the real format (`…8Q~…`) instead of any 34-40 character word;
  - Solana: whole words only.
- Existing configurations get these fixes automatically (default filters you did not modify).

## [1.2.3] - 2026-09-30

Every default filter was checked against a sample of the format it detects and against normal French and English text.

### Fixed
- Normal text was masked by some default filters:
  - "community of…", "strong passphrase protects…", "the bearer of…", `secret "…"` in sentences;
  - uppercase words such as BUSINESS, HOSPITAL or PLATFORM, taken for SWIFT/BIC codes: a BIC is now masked when it follows "BIC" or "SWIFT";
  - any 11-digit number (order numbers, `+33612345678`), taken for an RPPS number: it now has to follow "RPPS";
  - `se=1`, `sp=3`, taken for Azure SAS tokens: the token now has to contain a signature (`sig=`);
  - words containing "bb", taken for Bitbucket tokens: only `ATBB…` and `BBDC-…` tokens are masked.
- The JWT after "Bearer" was masked twice.
- Seven optional filters (medical record number, patient ID, employee ID, contract, payslip, driver's license, serial number) never matched "Label: value".
- JSON (`"passphrase": "…"`) and snmpd (`rocommunity …`) syntaxes are detected.
- Existing configurations get these fixes automatically (default filters you did not modify).

## [1.2.2] - 2026-09-30

### Fixed
- The Azure SAS filter matched inside words: `wpa_passphrase=...` became `wpa_passphra***AZURE_SAS_REDACTED***`.
- Cisco SNMP communities and Wi-Fi passphrases were masked twice (wrong count, altered text).
- Private key and OpenVPN key replacements showed a literal `\n` instead of a line break.
- Existing configurations get these fixes automatically (default filters you did not modify).

## [1.2.1] - 2026-09-29

### Changed
- Windows: the automatic paste calls the Windows SendInput API directly instead of running a PowerShell script. Security software (for example Palo Alto Cortex XDR) could flag the PowerShell helper as a keylogger. The old `paste-helper.ps1` file is deleted at startup.

## [1.2.1-beta.1] - 2026-09-29

### Changed
- Windows: the automatic paste calls the Windows SendInput API directly instead of running a PowerShell script. Security software (for example Palo Alto Cortex XDR) could flag the PowerShell helper as a keylogger. The old `paste-helper.ps1` file is deleted at startup.

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

[Unreleased]: https://github.com/50bvd/clipboardfilter/compare/v1.2.5...develop
[1.2.5]: https://github.com/50bvd/clipboardfilter/compare/v1.2.4...v1.2.5
[1.2.4]: https://github.com/50bvd/clipboardfilter/compare/v1.2.3...v1.2.4
[1.2.3]: https://github.com/50bvd/clipboardfilter/compare/v1.2.2...v1.2.3
[1.2.2]: https://github.com/50bvd/clipboardfilter/compare/v1.2.1...v1.2.2
[1.2.1]: https://github.com/50bvd/clipboardfilter/compare/v1.2.0...v1.2.1
[1.2.1-beta.1]: https://github.com/50bvd/clipboardfilter/compare/v1.2.0...v1.2.1-beta.1
[1.2.0]: https://github.com/50bvd/clipboardfilter/compare/v1.1.1...v1.2.0
[1.2.0-beta.2]: https://github.com/50bvd/clipboardfilter/compare/v1.2.0-beta.1...v1.2.0-beta.2
[1.2.0-beta.1]: https://github.com/50bvd/clipboardfilter/compare/v1.1.1...v1.2.0-beta.1
[1.1.1]: https://github.com/50bvd/clipboardfilter/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/50bvd/clipboardfilter/compare/v1.0.0...v1.1.0
[1.1.0-beta.2]: https://github.com/50bvd/clipboardfilter/compare/v1.1.0-beta.1...v1.1.0-beta.2
[1.1.0-beta.1]: https://github.com/50bvd/clipboardfilter/compare/v1.0.0...v1.1.0-beta.1
[1.0.0]: https://github.com/50bvd/clipboardfilter/releases/tag/v1.0.0
