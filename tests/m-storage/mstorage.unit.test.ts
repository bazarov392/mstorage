import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MStorage } from '../../src/m-storage';
import { keyValueContract } from '../contracts/key-value.contract';
import { MemoryStorage, mStorageFixture } from './fixtures';

beforeEach(() => {
    vi.stubGlobal('window', {});
    vi.stubGlobal('localStorage', new MemoryStorage());
    vi.stubGlobal('sessionStorage', new MemoryStorage());
});

afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

for (const storage of ['local', 'session'] as const) {
    for (const encryptKeys of [false, true]) {
        keyValueContract(`${storage}, hash keys: ${encryptKeys}`, () =>
            mStorageFixture({ storage, encryptKeys }),
        );
    }
}

describe('MStorage compatibility', () => {
    it('uses localStorage by default and keeps sessionStorage separate', () => {
        const local = new MStorage();
        const session = new MStorage({ storage: 'session' });
        local.set('key', 'local');
        session.set('key', 'session');
        expect(new MStorage().get('key')).toBe('local');
        expect(session.get('key')).toBe('session');
    });

    it('removes multiple keys', () => {
        const storage = new MStorage();
        storage.set('a', 'one');
        storage.set('b', 'two');
        storage.set('c', 'three');
        storage.remove(['a', 'b']);
        expect(storage.get('a')).toBeNull();
        expect(storage.get('b')).toBeNull();
        expect(storage.get('c')).toBe('three');
    });

    it('expires at the TTL boundary and removes expired data on read', () => {
        vi.useFakeTimers();
        vi.setSystemTime(1_000);
        const storage = new MStorage();
        storage.set('key', 'value', 2);
        expect(storage.ttl('key')).toBe(2);
        vi.setSystemTime(2_999);
        expect(storage.get('key')).toBe('value');
        vi.setSystemTime(3_000);
        expect(storage.get('key')).toBeNull();
        expect(localStorage.getItem('ms_key')).toBeNull();
    });

    it('rounds remaining TTL to seconds and cleans expired data on ttl()', () => {
        vi.useFakeTimers();
        vi.setSystemTime(0);
        const storage = new MStorage();
        storage.set('key', 'value', 2);
        vi.setSystemTime(600);
        expect(storage.ttl('key')).toBe(1);
        vi.setSystemTime(2_000);
        expect(storage.ttl('key')).toBeNull();
        expect(localStorage.getItem('ms_key')).toBeNull();
    });

    it('treats missing TTL, zero, and negative TTL as no expiration', () => {
        const storage = new MStorage();
        expect(storage.ttl('missing')).toBeNull();
        for (const ttl of [undefined, 0, -1]) {
            storage.set('key', 'value', ttl);
            expect(storage.ttl('key')).toBe(Infinity);
        }
    });

    it('replaces an existing expiration when overwriting', () => {
        vi.useFakeTimers();
        vi.setSystemTime(0);
        const storage = new MStorage();
        storage.set('key', 'old', 1);
        storage.set('key', 'new');
        vi.setSystemTime(2_000);
        expect(storage.get('key')).toBe('new');
        expect(storage.ttl('key')).toBe(Infinity);
    });

    it('hashes keys but leaves stored values readable', () => {
        const storage = new MStorage({ encryptKeys: true });
        storage.set('key', 'plain text');
        const key = localStorage.key(0)!;
        expect(key).toMatch(/^[a-f0-9]{56}$/);
        expect(localStorage.getItem('ms_key')).toBeNull();
        expect(JSON.parse(localStorage.getItem(key)!)).toEqual([
            'plain text',
            null,
        ]);
        expect(new MStorage({ encryptKeys: true }).get('key')).toBe(
            'plain text',
        );
    });

    it('preserves v1 clear behavior: clears the entire backing storage', () => {
        localStorage.setItem('unrelated', 'value');
        new MStorage().clear();
        expect(localStorage.length).toBe(0);
    });

    it('propagates malformed data and write failures', () => {
        const storage = new MStorage();
        localStorage.setItem('ms_bad', 'not json');
        expect(() => storage.get('bad')).toThrow(SyntaxError);
        const error = new DOMException('Full', 'QuotaExceededError');
        vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
            throw error;
        });
        expect(() => storage.set('key', 'value')).toThrow(error);
    });
});
