# Security Policy

ClipboardFilter handles sensitive data, so security reports are taken seriously.

## Supported versions

| Version | Supported |
|---------|-----------|
| 1.1.x (including betas) | ✅ |
| 1.0.x | ❌ please upgrade |

## Reporting a vulnerability

**Do not open a public issue.** Report it privately through
[GitHub Security Advisories](https://github.com/50bvd/clipboardfilter/security/advisories/new).

Please include the affected version, your operating system and the steps to reproduce.
You should receive an answer within 7 days. Once a fix is released, the advisory is published
and you are credited unless you prefer otherwise.

## Scope

In scope: sensitive data leaking through the app (unfiltered paste, logs, configuration file),
code execution through imported templates, flaws in the IPC bridge or the renderer sandbox.

Out of scope: a default filter that misses a particular format (open a regular issue or a pull request instead).
