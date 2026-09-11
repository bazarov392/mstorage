import { expect, it, vi } from 'vitest';
import { MStorage, JsonValueFormatter } from '../../src/m-storage';
import { MemoryStorage } from './fixtures';

it('preserves no-op without window but allows an explicit backend', () =>
{
    vi.stubGlobal('window', undefined);
    const formatter = new JsonValueFormatter();
    const encode = vi.spyOn(formatter, 'encode');
    const decode = vi.spyOn(formatter, 'decode');
    const storage = new MStorage({ formatter });
    expect(storage.get('k')).toBeNull();
    expect(storage.ttl('k')).toBeNull();
    expect(storage.set('k', 'v', NaN)).toBeNull();
    expect(storage.remove(['k'])).toBeUndefined();
    expect(storage.clear()).toBeUndefined();
    expect(encode).not.toHaveBeenCalled();
    expect(decode).not.toHaveBeenCalled();
    const explicit = new MStorage({ storage: new MemoryStorage() });
    expect(explicit.set('k', 'v')).toBeUndefined();
    expect(explicit.get('k')).toBe('v');
});

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
