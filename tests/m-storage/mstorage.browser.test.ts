import { afterEach, expect, it } from 'vitest';
import {
    MStorage,
    JsonValueFormatter,
    EncodingValueFormatter,
} from '../../src/m-storage';
import { keyValueContract } from '../contracts/key-value.contract';
import { mStorageFixture } from './fixtures';

afterEach(() =>
{
    localStorage.clear();
    sessionStorage.clear();
});
for (const storage of [localStorage, sessionStorage])
{
    for (const Formatter of [JsonValueFormatter, EncodingValueFormatter])
    {
        keyValueContract(
            `native ${
                storage === localStorage ? 'local' : 'session'
            } ${Formatter.name}`,
            () => mStorageFixture({ storage, formatter: new Formatter() }),
        );
        it(`preserves UTF-16 and fractional timestamps in ${Formatter.name}`, () =>
        {
            const formatter = new Formatter();
            const value = '\ud800|\udfff\u0000🌍';
            const expiresAt = Date.now() + 10_000.5;
            storage.setItem('ms_k', formatter.encode({ value, expiresAt }));
            const subject = new MStorage({ storage, formatter });
            expect(subject.get('k')).toBe(value);
            expect(formatter.decode(storage.getItem('ms_k')!).expiresAt).toBe(
                expiresAt,
            );
            storage.setItem(
                'ms_expired',
                formatter.encode({ value, expiresAt: 0 }),
            );
            expect(subject.ttl('expired')).toBeNull();
            expect(storage.getItem('ms_expired')).toBeNull();
            storage.setItem('unrelated', 'v');
            subject.clear();
            expect(storage.length).toBe(0);
        });
    }
}
it('persists across instances and separates local and session storage', () =>
{
    new MStorage().set('k', 'local');
    new MStorage({ storage: sessionStorage }).set('k', 'session');
    expect(new MStorage().get('k')).toBe('local');
    expect(new MStorage({ storage: sessionStorage }).get('k')).toBe('session');
});
