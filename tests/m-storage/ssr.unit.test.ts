import { expect, it, vi } from 'vitest';
import { MStorage } from '../../src/m-storage';

it('imports and preserves v1 no-op behavior without window', () =>
{
    vi.stubGlobal('window', undefined);
    for (
        const options of [
            {},
            { storage: 'local' },
            { storage: 'session' },
        ] as const
    )
    {
        const storage = new MStorage(options);
        expect(storage.get('key')).toBeNull();
        expect(storage.ttl('key')).toBeNull();
        expect(storage.set('key', 'value')).toBeNull();
        expect(storage.remove('key')).toBeUndefined();
        expect(storage.clear()).toBeUndefined();
    }
});
