import { createHash } from 'node:crypto';
import { expect, it, vi } from 'vitest';
import {
    migrate,
    snapshotPairs,
    hashedPairs,
} from '../../examples/m-storage/migrate';
import {
    JsonValueFormatter,
    EncodingValueFormatter,
} from '../../src/m-storage';
import { MemoryStorage } from './fixtures';

it('snapshots keys, preserves expiration and originals, detects conflicts, and resumes failed writes', () =>
{
    const backend = new MemoryStorage();
    const json = new JsonValueFormatter();
    const encoding = new EncodingValueFormatter();
    for (
        const [key, expiresAt] of [['a', 1234.5], ['b', null], [
            'c',
            0,
        ]] as const
    )
        backend.setItem('ms_' + key, json.encode({ value: key, expiresAt }));
    const pairs = snapshotPairs(backend, 'ms_', 'v2:');
    backend.setItem('ms_later', '["later",null]');
    backend.setItem('v2:b', 'occupied');
    const write = backend.setItem.bind(backend);
    const spy = vi.spyOn(backend, 'setItem').mockImplementation((key, value) =>
    {
        if(key === 'v2:c')
            throw new Error('quota');
        write(key, value);
    });
    expect(
        migrate(backend, backend, json, encoding, pairs).map((r) => r.status),
    ).toEqual(['copied', 'conflict', 'error']);
    expect(encoding.decode(backend.getItem('v2:a')!).expiresAt).toBe(1234.5);
    expect(backend.getItem('ms_a')).toBe('["a",1234.5]');
    expect(backend.getItem('ms_c')).toBe('["c",0]');
    expect(backend.getItem('v2:b')).toBe('occupied');
    spy.mockRestore();
    expect(
        migrate(backend, backend, json, encoding, pairs).map((r) => r.status),
    ).toEqual(['already-copied', 'conflict', 'copied']);
    expect(encoding.decode(backend.getItem('v2:c')!).expiresAt).toBe(0);
    expect(backend.getItem('v2:later')).toBeNull();
    expect(
        migrate(backend, backend, json, encoding, [['ms_a', 'ms_a']])[0].status,
    ).toBe('error');
    backend.setItem('bad', 'corrupt');
    expect(
        migrate(backend, backend, json, encoding, [['bad', 'v2:bad'], [
            'missing',
            'v2:missing',
        ]]).map((r) => r.status),
    ).toEqual(['error', 'missing']);
    expect(backend.getItem('bad')).toBe('corrupt');
});

it('migrates known v1 hashed names using external SHA-224 without changing expiration', () =>
{
    const backend = new MemoryStorage();
    const sha224 = (text: string) =>
        createHash('sha224').update(text).digest('hex');
    const pairs = hashedPairs(['user'], sha224, 'v2:');
    backend.setItem(sha224('ms_user'), '["legacy",1000.25]');
    const result = migrate(
        backend,
        backend,
        new JsonValueFormatter(),
        new EncodingValueFormatter(),
        pairs,
    );
    expect(result[0].status).toBe('copied');
    expect(backend.getItem('v2:user')).toBe('ms2|1000.25|legacy');
    expect(backend.getItem(sha224('ms_user'))).toBe('["legacy",1000.25]');
});
