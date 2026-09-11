import { afterEach, expect, it } from 'vitest';
import { MStorage } from '../../src/m-storage';
import { keyValueContract } from '../contracts/key-value.contract';
import { mStorageFixture } from './fixtures';

afterEach(() =>
{
    localStorage.clear();
    sessionStorage.clear();
});

for (const storage of ['local', 'session'] as const)
{
    for (const encryptKeys of [false, true])
    {
        keyValueContract(
            `native ${storage}, hash keys: ${encryptKeys}`,
            () => mStorageFixture({ storage, encryptKeys }),
        );
    }
}

it('persists across instances and separates native local and session storage', () =>
{
    const local = new MStorage({ storage: 'local' });
    const session = new MStorage({ storage: 'session' });
    local.set('key', 'local value');
    session.set('key', 'session value');
    expect(new MStorage().get('key')).toBe('local value');
    expect(new MStorage({ storage: 'session' }).get('key')).toBe(
        'session value',
    );
    local.remove('key');
    expect(session.get('key')).toBe('session value');
});
