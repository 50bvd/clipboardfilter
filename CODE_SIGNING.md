# Code signing (SignPath Foundation)

ClipboardFilter's Windows installer can be **code‑signed for free** through the
[SignPath Foundation](https://signpath.org/) program, which issues a
publicly‑trusted certificate to qualifying **open‑source** projects. A signed
installer shows the real publisher name in the UAC prompt and stops the
"Unknown publisher" warning; combined with download reputation it clears
SmartScreen over time.

The release workflow (`.github/workflows/release.yml`) already contains the
signing steps. They stay **disabled until the secrets below exist**, so nothing
breaks before onboarding is complete: Windows release/tag builds are published
unsigned until then.

## One‑time setup

1. **Apply to SignPath Foundation** for OSS signing:
   <https://signpath.org/apply> (or <https://about.signpath.io/product/open-source>).
   Use this repository's URL. Approval is manual and can take a few days.

2. Once approved, in the SignPath web console:
   - Note your **Organization ID** (a GUID).
   - Install the **SignPath GitHub App** on `50bvd/clipboardfilter`.
   - Create a **Project** — suggested slug: `clipboardfilter`.
   - Add an **Artifact Configuration** that signs the NSIS installer produced by
     electron‑builder **and the nested `.exe` files inside it** (recursive PE
     signing). Point it at the `release/*.exe` produced by the build.
   - Create a **Signing Policy** — suggested slug: `release-signing` — backed by
     the Foundation certificate.
   - Create a CI **API token** for the GitHub integration.

3. In the GitHub repo (**Settings → Secrets and variables → Actions**):
   - **Secret** `SIGNPATH_API_TOKEN` = the SignPath CI token.
   - **Variable** `SIGNPATH_ORGANIZATION_ID` = your Organization ID.
   - *(optional variables, only if you used different slugs)*
     `SIGNPATH_PROJECT_SLUG`, `SIGNPATH_SIGNING_POLICY_SLUG`.

That's it. The next tag build (`vX.Y.Z`) or an "Actions → Build & Release → Run
workflow" with a tag will submit the Windows installer to SignPath, wait for the
signed result, and publish the **signed** installer.

## Notes / limits

- The `signpath/github-action-submit-signing-request@v1` action is referenced by
  its major tag. To match this repo's SHA‑pinning policy, pin it to the exact
  commit SHA of the version you approve.
- Signing runs **only** for Windows **tag/release** builds, not on every
  `develop` push, to avoid consuming signing quota on pre‑production artifacts.
- macOS notarization is a separate, paid Apple process and is **not** covered
  here.
- Reputation still builds gradually: a freshly signed publisher may see a
  SmartScreen prompt until enough downloads accumulate (instant only with an EV
  certificate, which the Foundation program does not provide).
