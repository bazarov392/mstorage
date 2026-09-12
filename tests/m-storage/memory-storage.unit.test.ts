import { expect, it } from 'vitest';
import { MemoryStorage, MStorage } from '../../src/m-storage';

it('enumerates live keys without losing empty or special key names', () =>
{
    const storage = new MemoryStorage();
    const keys = ['', '__proto__', 'constructor', '🌍', 'a|b'];

    for (const key of keys)
        storage.setItem(key, '');

    expect(storage.length).toBe(keys.length);
    expect(new Set(keys.map((_, index) => storage.key(index)))).toEqual(
        new Set(keys),
    );

    for (const key of keys)
        expect(storage.getItem(key)).toBe('');

    storage.setItem('constructor', 'updated');
    storage.removeItem('__proto__');
    expect(storage.length).toBe(keys.length - 1);
    expect(storage.getItem('constructor')).toBe('updated');
    expect(storage.getItem('__proto__')).toBeNull();
    expect(
        Array.from(
            { length: storage.length },
            (_, index) => storage.key(index),
        ),
    ).not.toContain('__proto__');

    for (
        const index of [
            -1,
            0.5,
            NaN,
            Infinity,
            -Infinity,
            storage.length,
            Number.MAX_SAFE_INTEGER,
        ]
    )
        expect(storage.key(index)).toBeNull();

    storage.clear();
    expect(storage.key(0)).toBeNull();
});

it('isolates memory instances and shares data only when the same backend is explicitly reused', () =>
{
    const backend = new MemoryStorage();
    const separate = new MemoryStorage();
    const first = new MStorage({ storage: backend });
    const second = new MStorage({ storage: backend });

    first.set('k', 'value');
    expect(second.get('k')).toBe('value');
    expect(separate.getItem('ms_k')).toBeNull();

    second.clear();
    expect(first.get('k')).toBeNull();
});
