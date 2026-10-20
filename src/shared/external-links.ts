import { EXTERNAL_LINK_HOSTS } from './constants';

/**
 * True only for `https` URLs whose host is explicitly allow-listed.
 *
 * This is the single gate for anything that leaves the app: a link the user
 * clicks may only ever reach the browser if it passes this check. Everything
 * else — `http:`, `file:`, `javascript:`, a look-alike host, a malformed URL —
 * is refused.
 */
export function isAllowedExternalUrl(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }

  if (url.protocol !== 'https:') return false;

  return EXTERNAL_LINK_HOSTS.includes(url.hostname.toLowerCase());
}
