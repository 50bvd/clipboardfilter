# Branch rulesets

Versioned copies of this repo's branch protection, so it is documented and easy
to re-apply.

- `main.json` — protects the default branch: no deletion, no force-push, requires
  a pull request (0 approvals — solo friendly) and the CI checks
  `Test (ubuntu-latest)`, `Test (windows-latest)`, `Test (macos-latest)` to pass.
  Repository admins can bypass.
- `develop.json` — lighter: no deletion, no force-push.

## Apply them (choose one)

### A. Import in the UI (easiest)
**Settings → Rules → Rulesets → New ruleset → Import a ruleset**, then select the
JSON file. Repeat for each file. Review and **Save**.

### B. PowerShell + GitHub CLI
PowerShell has no `<<'JSON'` heredoc — pipe the file instead:

```powershell
Get-Content .github/rulesets/main.json    -Raw | gh api --method POST repos/50bvd/clipboardfilter/rulesets --input -
Get-Content .github/rulesets/develop.json -Raw | gh api --method POST repos/50bvd/clipboardfilter/rulesets --input -
```

## Note on required checks
`main.json` requires the three `Test (...)` checks from `.github/workflows/ci.yml`.
If a job name changes, update the matching `context` value (or pick it from the
dropdown when importing) so pull requests are not blocked waiting on a
non-existent check.
