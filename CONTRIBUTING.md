# Contributing to ClipboardFilter

Thanks for your interest! Bug reports, new filters, translations and code are all welcome.

## Branches

| Branch | Role |
|--------|------|
| `main` | Stable releases only. Never commit directly. |
| `develop` | Pre-production. Every pull request targets this branch. Each push produces test builds (Actions › *Build & Release* › Artifacts). |
| `feature/<name>`, `fix/<name>`, `docs/<name>` | Your work, created from `develop`. |
| `hotfix/<name>` | Urgent fix for a released version, created from `main` and merged into `main` **and** `develop`. |

```
feature/xyz ──PR──▶ develop ──(beta tag)──▶ pre-release
                       │
                       └──PR "Release x.y.z"──▶ main ──(tag)──▶ release
```

## Workflow

1. Fork the repository (or create a branch if you are a maintainer).
2. Create your branch from `develop`:
   ```bash
   git checkout develop && git pull
   git checkout -b feature/my-feature
   ```
3. Make your change, then run:
   ```bash
   npm ci
   npm test          # type-check, build and unit tests
   npm start         # try it in the real app
   ```
4. Open a pull request **against `develop`** and fill in the template.
5. CI must be green and the maintainer must approve before merging. Pull requests are squash-merged.

## Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add a Wayland paste backend
fix(linux): read the clipboard with wl-paste when unfocused
docs: explain GNOME shortcuts
chore(deps): bump electron to 44.5.0
```

Types: `feat`, `fix`, `perf`, `refactor`, `docs`, `test`, `chore`, `ci`, `i18n`.

## Adding or changing a default filter

- Edit `default-filters.json`. Add a `descriptionKey` (`filters.<category>.<name>`) and its translation in `locales/en.json` and `locales/fr.json` (other languages fall back to English).
- Check it in the **Test** tab against realistic text: a filter that matches ordinary words is worse than no filter.
- Avoid nested quantifiers such as `(a+)+`. They are stopped after 3 seconds, but the paste is then cancelled.
- **Never** put real secrets in examples, tests or issues. Tests build their fake secrets at runtime (see `test/fixtures.js`).

## Translations

UI strings live in `locales/<lang>.json`. Missing keys fall back to English. To add a language, copy `en.json`, translate the values and add its name in `LOCALE_NAMES` in `src/renderer.js`.

## Releases (maintainer)

1. Update `version` in `package.json` and move the "Unreleased" entries of `CHANGELOG.md` under the new version.
2. **Beta**: tag `develop`, e.g. `v1.2.0-beta.1`. This produces a GitHub pre-release.
3. **Stable**: open a pull request `develop` → `main` titled `Release 1.2.0`, merge it, then tag `main` with `v1.2.0`. This produces a GitHub release.

Without git: **Actions › Build & Release › Run workflow**, choose the branch (`develop` for a beta, `main` for a stable version) and type the tag (e.g. `v1.2.0-beta.1`). The tag must match the `version` in `package.json`. The workflow builds the installers, creates the tag and publishes the release.

## Code of conduct

By participating you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md).
