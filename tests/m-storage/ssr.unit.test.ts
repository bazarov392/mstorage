import { afterEach, expect, it, vi } from 'vitest';
import { MStorage, JsonValueFormatter } from '../../src/m-storage';
import { MemoryStorage } from './fixtures';

afterEach(() =>
{
    vi.useRealTimers();
});

it.each([undefined, {}, { localStorage: undefined }])(
    'uses a working private memory backend when window/localStorage is unavailable: %j',
    (browserWindow) =>
    {
        vi.stubGlobal('window', browserWindow);
        vi.useFakeTimers();
        vi.setSystemTime(1000);

        const formatter = new JsonValueFormatter();
        const encode = vi.spyOn(formatter, 'encode');
        const decode = vi.spyOn(formatter, 'decode');
        const storage = new MStorage({ formatter });

        expect(storage.get('k')).toBeNull();
        expect(storage.set('k', 'v', 1)).toBeUndefined();
        expect(storage.get('k')).toBe('v');
        expect(storage.ttl('k')).toBe(1);
        expect(encode).toHaveBeenCalled();
        expect(decode).toHaveBeenCalled();
        expect(() => storage.set('k', 'bad', NaN)).toThrow(RangeError);
        expect(storage.get('k')).toBe('v');

        // No implicit singleton shared between requests or instances.
        const other = new MStorage();
        other.set('k', 'other');
        expect(storage.get('k')).toBe('v');

        vi.setSystemTime(2000);
        expect(storage.get('k')).toBeNull();
        expect(storage.ttl('k')).toBeNull();

        storage.set('a', 'one');
        storage.set('b', 'two');
        storage.remove(['a', 'b']);
        expect(storage.get('a')).toBeNull();
        expect(storage.get('b')).toBeNull();

        storage.set('k', 'again');
        storage.clear();
        expect(storage.get('k')).toBeNull();
        expect(other.get('k')).toBe('other');
    },
);

it('does not access native getter for explicit backends and propagates getter errors otherwise', () =>
{
    const error = new Error('access denied');
    const getter = vi.fn(() =>
    {
        throw error;
    });
    vi.stubGlobal(
        'window',
        Object.defineProperty({}, 'localStorage', { get: getter }),
    );
    new MStorage({ storage: new MemoryStorage() }).set('k', 'v');
    expect(getter).not.toHaveBeenCalled();
    expect(() => new MStorage()).toThrow(error);
});

it('uses window.localStorage by default', () =>
{
    const backend = new MemoryStorage();
    vi.stubGlobal('window', { localStorage: backend });
    new MStorage().set('k', 'v');
    expect(backend.getItem('ms_k')).toBe('["v",null]');
});
