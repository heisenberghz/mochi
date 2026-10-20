/**
 * Content-Security-Policy for both renderer surfaces.
 *
 * `style-src` allows 'unsafe-inline' because the Den paints the focus ring's
 * conic-gradient through a React inline style. `script-src` does not: the app
 * ships no inline or eval'd script, and never needs to.
 */

const BASE_DIRECTIVES = [
  "default-src 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
];

/** The policy that ships. */
export const CSP_PROD = [
  ...BASE_DIRECTIVES,
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "connect-src 'self'",
].join('; ');

/**
 * Development needs two extra permissions: Vite's HMR socket, and the inline
 * script preamble that @vitejs/plugin-react injects for hot refresh.
 */
export const CSP_DEV = [
  ...BASE_DIRECTIVES,
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "connect-src 'self' ws: wss:",
].join('; ');

const CSP_META = /(<meta\s+http-equiv="Content-Security-Policy"\s+content=")[^"]*(")/;

/**
 * Write `policy` into the page's Content-Security-Policy meta tag.
 *
 * Throws if the meta tag is missing, so a build can never quietly ship
 * without a policy.
 */
export function applyCsp(html: string, policy: string): string {
  if (!CSP_META.test(html)) {
    throw new Error('index.html is missing its Content-Security-Policy meta tag');
  }
  return html.replace(CSP_META, (_match, before, after) => `${before}${policy}${after}`);
}
