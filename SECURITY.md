# Security Policy

ClipboardFilter handles sensitive data, so security reports are taken seriously.

## Supported versions

| Version | Supported |
|---------|-----------|
| 1.1.x | ✅ |
| 1.1.0 betas | ❌ please upgrade to 1.1.0 |
| 1.0.x | ❌ please upgrade |

## Reporting a vulnerability

**Do not open a public issue.** Report it privately through
[GitHub Security Advisories](https://github.com/50bvd/clipboardfilter/security/advisories/new).

Please include the affected version, your operating system and the steps to reproduce.
You should receive an answer within 7 days. Once a fix is released, the advisory is published
and you are credited unless you prefer otherwise.

## How the app protects your data

- Filtering runs locally; clipboard content never leaves your computer and is never logged.
- The only network request is the optional update check (GitHub releases API).
- The interface runs sandboxed without Node.js access, behind a strict Content Security Policy.
- A filter that takes too long is stopped and nothing is pasted (fail closed).

## Scope

In scope: sensitive data leaking through the app (unfiltered paste, logs, configuration file),
code execution through imported templates, flaws in the IPC bridge or the renderer sandbox.

Out of scope: a default filter that misses a particular format (open a regular issue or a pull request instead).
