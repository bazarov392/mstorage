import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    MStorage,
    JsonValueFormatter,
    EncodingValueFormatter,
} from '../../src/m-storage';
import type { MStorageValue } from '../../src/m-storage';
import { keyValueContract } from '../contracts/key-value.contract';
import { MemoryStorage, mStorageFixture, CustomFormatter } from './fixtures';

afterEach(() =>
{
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

for (const Formatter of [JsonValueFormatter, EncodingValueFormatter])
{
    keyValueContract(
        Formatter.name,
        () =>
            mStorageFixture({
                storage: new MemoryStorage(),
                formatter: new Formatter(),
            }),
    );
    describe(Formatter.name, () =>
    {
        it('uses consistent physical keys for every operation and preserves other prefixes', () =>
        {
            const backend = new MemoryStorage();
            for (const prefix of [undefined, '', 'app:🌍|'])
            {
                const storage = new MStorage({
                    storage: backend,
                    prefix,
                    formatter: new Formatter(),
                });
                const other = new MStorage({
                    storage: backend,
                    prefix: 'other:',
                    formatter: new Formatter(),
                });
                other.set('a', 'other');
                storage.set('a', 'one');
                storage.set('b', 'two');
                expect(backend.getItem((prefix ?? 'ms_') + 'a')).not.toBeNull();
                expect(storage.get('a')).toBe('one');
                expect(storage.ttl('a')).toBe(Infinity);
                storage.remove(['a', 'b']);
                expect(storage.get('a')).toBeNull();
                expect(storage.get('b')).toBeNull();
                expect(other.get('a')).toBe('other');
                storage.set('a', 'again');
                storage.remove('a');
                expect(storage.get('a')).toBeNull();
                backend.setItem('unrelated', 'raw');
                storage.clear();
                expect(backend.length).toBe(0);
            }
        });
        it('does not migrate when changing prefix', () =>
        {
            const backend = new MemoryStorage();
            new MStorage({
                storage: backend,
                prefix: 'a',
                formatter: new Formatter(),
            }).set('key', 'v');
            expect(
                new MStorage({
                    storage: backend,
                    prefix: 'b',
                    formatter: new Formatter(),
                }).get('key'),
            ).toBeNull();
            expect(
                new MStorage({
                    storage: backend,
                    prefix: 'a',
                    formatter: new Formatter(),
                }).get('key'),
            ).toBe('v');
        });
        it('preserves fractional expiration, rounded zero, and exact expiration boundary', () =>
        {
            vi.useFakeTimers();
            vi.setSystemTime(1_000);
            const backend = new MemoryStorage();
            const formatter = new Formatter();
            const storage = new MStorage({ storage: backend, formatter });
            storage.set('key', 'v', 1.0005);
            expect(formatter.decode(backend.getItem('ms_key')!).expiresAt).toBe(
                2000.5,
            );
            vi.setSystemTime(2000);
            expect(storage.ttl('key')).toBe(0);
            expect(storage.get('key')).toBe('v');
            vi.setSystemTime(2001);
            expect(storage.ttl('key')).toBeNull();
            expect(backend.length).toBe(0);
            storage.set('key', 'v', 1);
            vi.setSystemTime(3001);
            expect(storage.get('key')).toBeNull();
            expect(backend.length).toBe(0);
            backend.setItem(
                'ms_epoch',
                formatter.encode({ value: 'v', expiresAt: 0 }),
            );
            expect(storage.get('epoch')).toBeNull();
            expect(backend.length).toBe(0);
        });
        it('replaces and cancels TTL; rejects invalid TTL before formatting or writing', () =>
        {
            vi.useFakeTimers();
            vi.setSystemTime(0);
            const backend = new MemoryStorage();
            const formatter = new Formatter();
            const encode = vi.spyOn(formatter, 'encode');
            const storage = new MStorage({ storage: backend, formatter });
            storage.set('key', 'old', 1);
            storage.set('key', 'new', 2);
            vi.setSystemTime(1000);
            expect(storage.ttl('key')).toBe(1);
            for (const ttl of [undefined, 0, -1, -Number.MAX_VALUE])
            {
                storage.set('key', 'forever', ttl);
                expect(storage.ttl('key')).toBe(Infinity);
            }
            const raw = backend.getItem('ms_key');
            encode.mockClear();
            for (
                const ttl of [
                    NaN,
                    Infinity,
                    -Infinity,
                    Number.MAX_VALUE,
                    Number.MAX_SAFE_INTEGER,
                ]
            )
                expect(() => storage.set('key', 'bad', ttl)).toThrow(
                    RangeError,
                );
            expect(() => storage.set('key', 'bad', '1' as unknown as number))
                .toThrow(TypeError);
            expect(encode).not.toHaveBeenCalled();
            expect(backend.getItem('ms_key')).toBe(raw);
        });
        it('propagates all backend errors without fallback', () =>
        {
            const backend = new MemoryStorage();
            const storage = new MStorage({
                storage: backend,
                formatter: new Formatter(),
            });
            const error = new Error('backend failed');
            for (
                const [method, invoke] of [
                    ['setItem', () => storage.set('k', 'v')],
                    ['getItem', () => storage.get('k')],
                    ['getItem', () => storage.ttl('k')],
                    ['removeItem', () => storage.remove('k')],
                    ['clear', () => storage.clear()],
                ] as const
            )
            {
                const spy = vi.spyOn(backend, method).mockImplementation(() =>
                {
                    throw error;
                });
                expect(invoke).toThrow(error);
                spy.mockRestore();
            }
            backend.setItem(
                'ms_k',
                new Formatter().encode({ value: 'v', expiresAt: 0 }),
            );
            vi.spyOn(backend, 'removeItem').mockImplementation(() =>
            {
                throw error;
            });
            expect(() => storage.get('k')).toThrow(error);
        });
    });
}

it('reads ordinary v1 JSON without rewriting, including large legacy timestamps', () =>
{
    const backend = new MemoryStorage();
    const storage = new MStorage({ storage: backend });
    for (const expiresAt of [null, Date.now() + 10_000.5, Number.MAX_VALUE])
    {
        const raw = JSON.stringify(['legacy', expiresAt]);
        backend.setItem('ms_k', raw);
        expect(storage.get('k')).toBe('legacy');
        expect(backend.getItem('ms_k')).toBe(raw);
    }
});

it('keeps corrupt JSON and invalid custom records; skips unnecessary formatter calls', () =>
{
    const backend = new MemoryStorage();
    const json = new JsonValueFormatter();
    const encode = vi.spyOn(json, 'encode');
    const decode = vi.spyOn(json, 'decode');
    const storage = new MStorage({ storage: backend, formatter: json });
    expect(storage.get('missing')).toBeNull();
    expect(storage.ttl('missing')).toBeNull();
    expect(decode).not.toHaveBeenCalled();
    for (const raw of ['bad json', 'null', '[123,0]', '["v","0"]', '["v",-1]'])
    {
        backend.setItem('ms_k', raw);
        expect(() => storage.get('k')).toThrow();
        expect(() => storage.ttl('k')).toThrow();
        expect(backend.getItem('ms_k')).toBe(raw);
    }
    decode.mockClear();
    storage.remove('k');
    storage.clear();
    expect(decode).not.toHaveBeenCalled();
    expect(encode).not.toHaveBeenCalled();
    for (
        const record of [null, {}, { value: 3, expiresAt: 0 }, {
            value: 'v',
            expiresAt: NaN,
        }, Promise.resolve({ value: 'v', expiresAt: 0 })]
    )
    {
        decode.mockReturnValue(record as MStorageValue);
        backend.setItem('ms_k', 'original');
        expect(() => storage.get('k')).toThrow();
        expect(() => storage.ttl('k')).toThrow();
        expect(backend.getItem('ms_k')).toBe('original');
    }
    encode.mockImplementation(() =>
    {
        throw new Error('encode failed');
    });
    expect(() => storage.set('k', 'new')).toThrow('encode failed');
    encode.mockReturnValue(Promise.resolve('bad') as unknown as string);
    expect(() => storage.set('k', 'new')).toThrow(TypeError);
    expect(backend.getItem('ms_k')).toBe('original');
});

it('preserves this on custom formatter and backend methods', () =>
{
    const backend = new MemoryStorage();
    const formatter = new CustomFormatter();
    const storage = new MStorage({ storage: backend, formatter });
    storage.set('k', 'v');
    expect(backend.getItem('ms_k')).toBe('custom:["v",null]');
    expect(storage.get('k')).toBe('v');
    expect(storage.ttl('k')).toBe(Infinity);
    storage.remove('k');
    storage.clear();
    expect(backend.length).toBe(0);
});

it('provides a synchronous MemoryStorage contract including missing, empty, and indexed keys', () =>
{
    const backend = new MemoryStorage();
    expect(backend.length).toBe(0);
    expect(backend.key(0)).toBeNull();
    expect(backend.getItem('missing')).toBeNull();
    expect(backend.setItem('a', '')).toBeUndefined();
    expect(backend.getItem('a')).toBe('');
    expect(backend.length).toBe(1);
    expect(backend.key(0)).toBe('a');
    expect(backend.key(1)).toBeNull();
    backend.setItem('a', 'new');
    expect(backend.length).toBe(1);
    expect(backend.getItem('a')).toBe('new');
    expect(backend.removeItem('missing')).toBeUndefined();
    expect(backend.clear()).toBeUndefined();
    expect(backend.length).toBe(0);
    backend.clear();
});
