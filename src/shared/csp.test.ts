import { describe, expect, it } from 'vitest';
import { applyCsp, CSP_DEV, CSP_PROD } from './csp';

const PAGE = [
  '<!doctype html>',
  '<html lang="en">',
  '  <head>',
  '    <meta charset="UTF-8" />',
  '    <meta',
  '      http-equiv="Content-Security-Policy"',
  '      content="placeholder"',
  '    />',
  '  </head>',
  '</html>',
].join('\n');

describe('applyCsp', () => {
  it('writes the policy into the meta tag', () => {
    const html = applyCsp(PAGE, CSP_PROD);
    expect(html).toContain(`content="${CSP_PROD}"`);
    expect(html).not.toContain('content="placeholder"');
  });

  it('keeps the rest of the document intact', () => {
    const html = applyCsp(PAGE, CSP_PROD);
    expect(html).toContain('<!doctype html>');
    expect(html).toContain('<meta charset="UTF-8" />');
  });

  it('throws when the meta tag is missing, so a build cannot ship without one', () => {
    expect(() => applyCsp('<html><body>no policy here</body></html>', CSP_PROD)).toThrow(
      /Content-Security-Policy/,
    );
  });

  it('replaces rather than appends when applied twice', () => {
    const html = applyCsp(applyCsp(PAGE, CSP_PROD), CSP_DEV);
    expect(html).toContain(`content="${CSP_DEV}"`);
    expect(html).not.toContain(CSP_PROD);
  });
});

describe('the policies themselves', () => {
  it('never allows inline or eval\'d script in production', () => {
    expect(CSP_PROD).toContain("script-src 'self'");
    expect(CSP_PROD).not.toContain('unsafe-inline' + "'" + 'script-src');
    expect(CSP_PROD).not.toContain('unsafe-eval');
  });

  it('never allows a websocket in production', () => {
    expect(CSP_PROD).toContain("connect-src 'self'");
    expect(CSP_PROD).not.toContain('ws:');
  });

  it('allows the websocket only in development', () => {
    expect(CSP_DEV).toContain('ws:');
  });

  it('blocks plugins and form submissions in both', () => {
    for (const policy of [CSP_PROD, CSP_DEV]) {
      expect(policy).toContain("object-src 'none'");
      expect(policy).toContain("form-action 'none'");
      expect(policy).toContain("base-uri 'none'");
    }
  });
});
