import { describe, expect, it } from 'vitest';
import { isAllowedExternalUrl } from './external-links';

describe('isAllowedExternalUrl', () => {
  it('allows an https URL on an allow-listed host', () => {
    expect(isAllowedExternalUrl('https://github.com/mochipet/desktop')).toBe(true);
  });

  it('refuses https on a host that is not allow-listed', () => {
    expect(isAllowedExternalUrl('https://example.com/')).toBe(false);
  });

  it('refuses a look-alike host', () => {
    expect(isAllowedExternalUrl('https://github.com.evil.test/x')).toBe(false);
    expect(isAllowedExternalUrl('https://notgithub.com/')).toBe(false);
  });

  it('refuses a non-https scheme even on an allow-listed host', () => {
    expect(isAllowedExternalUrl('http://github.com/')).toBe(false);
    expect(isAllowedExternalUrl('file:///C:/Windows/System32/cmd.exe')).toBe(false);
    expect(isAllowedExternalUrl('javascript:alert(1)')).toBe(false);
  });

  it('refuses a malformed URL', () => {
    expect(isAllowedExternalUrl('')).toBe(false);
    expect(isAllowedExternalUrl('not a url')).toBe(false);
  });

  it('is case-insensitive about the host', () => {
    expect(isAllowedExternalUrl('https://GitHub.com/mochipet')).toBe(true);
  });
});
