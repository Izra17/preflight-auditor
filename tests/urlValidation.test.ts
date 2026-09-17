import { describe, it, expect } from 'vitest';
import { validateAuditUrl, isPrivateOrReservedIp, UnsafeUrlError } from '@/lib/security/urlValidation';

describe('isPrivateOrReservedIp', () => {
  it('flags common private IPv4 ranges', () => {
    expect(isPrivateOrReservedIp('10.0.0.5')).toBe(true);
    expect(isPrivateOrReservedIp('192.168.1.1')).toBe(true);
    expect(isPrivateOrReservedIp('172.16.5.5')).toBe(true);
    expect(isPrivateOrReservedIp('127.0.0.1')).toBe(true);
    expect(isPrivateOrReservedIp('169.254.1.1')).toBe(true);
    expect(isPrivateOrReservedIp('100.64.0.1')).toBe(true);
  });

  it('allows public IPv4 addresses', () => {
    expect(isPrivateOrReservedIp('8.8.8.8')).toBe(false);
    expect(isPrivateOrReservedIp('1.1.1.1')).toBe(false);
  });

  it('flags IPv6 loopback and link-local', () => {
    expect(isPrivateOrReservedIp('::1')).toBe(true);
    expect(isPrivateOrReservedIp('fe80::1')).toBe(true);
  });
});

describe('validateAuditUrl', () => {
  it('rejects non-http(s) protocols', async () => {
    await expect(validateAuditUrl('file:///etc/passwd')).rejects.toThrow(UnsafeUrlError);
    await expect(validateAuditUrl('ftp://example.com')).rejects.toThrow(UnsafeUrlError);
  });

  it('rejects malformed URLs', async () => {
    await expect(validateAuditUrl('not a url')).rejects.toThrow(UnsafeUrlError);
  });

  it('rejects localhost', async () => {
    await expect(validateAuditUrl('http://localhost:3000')).rejects.toThrow(UnsafeUrlError);
  });

  it('rejects literal private IP addresses', async () => {
    await expect(validateAuditUrl('http://192.168.1.1/')).rejects.toThrow(UnsafeUrlError);
    await expect(validateAuditUrl('http://127.0.0.1/')).rejects.toThrow(UnsafeUrlError);
  });

  it('accepts a well-formed public https URL', async () => {
    // Uses a literal public IP to avoid a real DNS lookup in unit tests.
    const result = await validateAuditUrl('https://8.8.8.8/');
    expect(result.url.protocol).toBe('https:');
  });
});
