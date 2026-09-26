// ==================================================
// CLIPBOARDFILTER - Update checker
// Asks the GitHub releases API whether a newer version exists. Nothing is
// downloaded or installed automatically: the user is sent to the release page.
// The only data sent is a standard HTTPS request to api.github.com.
// ==================================================

import { app, net } from 'electron';
import { compareVersions, isPrerelease } from './version';

const RELEASES_API = 'https://api.github.com/repos/50bvd/clipboardfilter/releases?per_page=30';
export const RELEASES_PAGE = 'https://github.com/50bvd/clipboardfilter/releases';

export interface UpdateInfo {
  status: 'idle' | 'checking' | 'up-to-date' | 'available' | 'error';
  current: string;
  latest?: string;
  url?: string;
  prerelease?: boolean;
  checkedAt?: number;
}

/** Only release pages of this repository may be opened from the app. */
export function isTrustedReleaseUrl(url: unknown): url is string {
  return typeof url === 'string' && url.startsWith(`${RELEASES_PAGE}/`) && !/[\s"'<>]/.test(url);
}

export async function checkForUpdates(includePrereleases: boolean): Promise<UpdateInfo> {
  const current = app.getVersion();
  const response = await net.fetch(RELEASES_API, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': `ClipboardFilter/${current}`
    },
    signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) throw new Error(`GitHub API returned ${response.status}`);
  const releases = await response.json();
  if (!Array.isArray(releases)) throw new Error('Unexpected GitHub API response');

  let best: { tag: string; url: string; prerelease: boolean } | null = null;
  for (const r of releases) {
    if (!r || r.draft || typeof r.tag_name !== 'string') continue;
    if (r.prerelease && !includePrereleases) continue;
    if (!isTrustedReleaseUrl(r.html_url)) continue;
    if (!best || compareVersions(r.tag_name, best.tag) > 0) {
      best = { tag: r.tag_name, url: r.html_url, prerelease: !!r.prerelease };
    }
  }

  const checkedAt = Date.now();
  if (best && compareVersions(best.tag, current) > 0) {
    return { status: 'available', current, latest: best.tag.replace(/^v/, ''), url: best.url, prerelease: best.prerelease, checkedAt };
  }
  return { status: 'up-to-date', current, checkedAt };
}

/** Beta users follow pre-releases by default, stable users only stable releases. */
export function defaultUpdateChannel(): 'stable' | 'beta' {
  return isPrerelease(app.getVersion()) ? 'beta' : 'stable';
}
